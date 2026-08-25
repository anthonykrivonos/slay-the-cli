import { test, expect, describe } from "bun:test";
import { createRun } from "../../src/engine/game";
import { makeRunTestBundle } from "./runTestBundle";
import { makeTestCtx } from "./runCtx";
import {
  buildCombatRewards,
  createCardReward,
  rollGoldReward,
  rollPotionReward,
  returnRandomPotion,
  obtainRelicFromPool,
  peekRelicFromPool,
} from "../../src/engine/run/rewards";
import { setupTreasureRoom, openChestContents, CHESTS } from "../../src/engine/run/treasure";
import { generateShop, computeRemovalCost, SHOP } from "../../src/engine/run/shop";

const bundle = makeRunTestBundle();

function ctxFor(seed: string, ascension = 0) {
  const s = createRun({ seed, bundle, character: "IRONCLAD", ascension });
  const { ctx } = makeTestCtx(s, bundle);
  return { s, ctx };
}

describe("card reward pity (cardRarityFactor)", () => {
  test("scripted 10-reward trajectory: -1 per common, reset to 5 on rare (self-golden)", () => {
    const { s, ctx } = ctxFor("PITY");
    expect(s.run.blizzard.cardRarityFactor).toBe(5);
    const factors: number[] = [];
    const rarities: string[][] = [];
    for (let i = 0; i < 10; i++) {
      const cards = createCardReward(ctx, "monster");
      rarities.push(cards.map((c) => c.rarity));
      factors.push(s.run.blizzard.cardRarityFactor);
    }
    expect(factors).toEqual([3, 2, 0, -3, -3, -6, 5, 3, 2, 0]);
    expect(rarities[6]![0]).toBe("rare"); // the reset point
    // replay the update rule from the observed rarities
    let f = 5;
    const replayed: number[] = [];
    for (const reward of rarities) {
      for (const r of reward) {
        if (r === "rare") f = 5;
        else if (r === "common") f = Math.max(f - 1, -40);
      }
      replayed.push(f);
    }
    expect(replayed).toEqual(factors);
  });

  test("factor never drops below the -40 floor", () => {
    const { s, ctx } = ctxFor("FLOOR");
    let sawCommonAtFloor = false;
    for (let i = 0; i < 50; i++) {
      s.run.blizzard.cardRarityFactor = -40;
      const cards = createCardReward(ctx, "monster");
      expect(s.run.blizzard.cardRarityFactor).toBeGreaterThanOrEqual(-40);
      if (cards.some((c) => c.rarity === "common")) sawCommonAtFloor = true;
    }
    expect(sawCommonAtFloor).toBe(true); // max(f-1, -40) actually exercised
  });

  test("forced rare (factor -97 guarantees the first roll) resets factor to 5 immediately", () => {
    const { s, ctx } = ctxFor("RARE");
    s.run.blizzard.cardRarityFactor = -97;
    const cards = createCardReward(ctx, "monster");
    // the FIRST card must be rare; the reset applies before the next roll,
    // so later cards in the same reward roll at factor 5 again
    expect(cards[0]!.rarity).toBe("rare");
    let f = -97;
    for (const c of cards) {
      if (c.rarity === "rare") f = 5;
      else if (c.rarity === "common") f = Math.max(f - 1, -40);
    }
    expect(s.run.blizzard.cardRarityFactor).toBe(f);
  });

  test("forced common (factor 63 pushes every roll past 43) decrements by 3", () => {
    const { s, ctx } = ctxFor("COMMON");
    s.run.blizzard.cardRarityFactor = 63;
    const cards = createCardReward(ctx, "monster");
    expect(cards.every((c) => c.rarity === "common")).toBe(true);
    expect(s.run.blizzard.cardRarityFactor).toBe(60);
  });

  test("boss rewards are always rare (no rarity roll) and reset the factor", () => {
    const { s, ctx } = ctxFor("BOSSR");
    s.run.blizzard.cardRarityFactor = -12;
    const cards = createCardReward(ctx, "boss");
    expect(cards.every((c) => c.rarity === "rare")).toBe(true);
    expect(s.run.blizzard.cardRarityFactor).toBe(5);
  });

  test("3 cards, duplicate-free within one reward", () => {
    for (const seed of ["D1", "D2", "D3", "D4", "D5"]) {
      const { ctx } = ctxFor(seed);
      const cards = createCardReward(ctx, "monster");
      expect(cards.length).toBe(3);
      expect(new Set(cards.map((c) => c.id)).size).toBe(3);
    }
  });

  test("upgrades: act 1 never; act 3 asc 0 sometimes (never on rares)", () => {
    const { ctx } = ctxFor("UPG1");
    for (let i = 0; i < 20; i++) {
      expect(createCardReward(ctx, "monster").every((c) => !c.upgraded)).toBe(true);
    }
    const { s: s3, ctx: ctx3 } = ctxFor("UPG3");
    s3.run.act = 3; // upgrade chance 0.5
    let upgraded = 0;
    for (let i = 0; i < 30; i++) {
      for (const c of createCardReward(ctx3, "monster")) {
        if (c.upgraded) {
          upgraded++;
          expect(c.rarity).not.toBe("rare");
        }
      }
    }
    expect(upgraded).toBeGreaterThan(10); // ~45 expected of 90 non-rares
  });
});

describe("potion drop pity", () => {
  test("+10 on miss, -10 on drop; base chance 40", () => {
    const { s, ctx } = ctxFor("POTS");
    for (let i = 0; i < 30; i++) {
      const before = s.run.blizzard.potionChance;
      const potion = rollPotionReward(ctx, 1);
      expect(s.run.blizzard.potionChance).toBe(potion ? before - 10 : before + 10);
    }
  });

  test("potionChance 60 guarantees a drop (chance 100); -40 guarantees none", () => {
    const { s, ctx } = ctxFor("POTG");
    s.run.blizzard.potionChance = 60;
    expect(rollPotionReward(ctx, 1)).not.toBeNull();
    s.run.blizzard.potionChance = -40;
    expect(rollPotionReward(ctx, 1)).toBeNull();
    expect(s.run.blizzard.potionChance).toBe(-30);
  });

  test(">= 4 rewards already present forces chance 0 (roll still consumed)", () => {
    const { s, ctx } = ctxFor("POTM");
    s.run.blizzard.potionChance = 60; // would otherwise guarantee a drop
    const counterBefore = ctx.rng("potionRng").counter;
    expect(rollPotionReward(ctx, 4)).toBeNull();
    expect(ctx.rng("potionRng").counter).toBe(counterBefore + 1);
  });

  test("rarity split <65 common, <90 uncommon, else rare - all rarities occur", () => {
    const { ctx } = ctxFor("PRAR");
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const id = returnRandomPotion(ctx);
      if (id) seen.add(bundle.potions.get(id)!.rarity);
    }
    expect([...seen].sort()).toEqual(["common", "rare", "uncommon"]);
  });
});

describe("gold rewards", () => {
  test("ranges: normal 10-20, elite 25-35, boss 95-105", () => {
    for (let i = 0; i < 40; i++) {
      const { ctx } = ctxFor(`G${i}`);
      const normal = rollGoldReward(ctx, "monster");
      expect(normal).toBeGreaterThanOrEqual(10);
      expect(normal).toBeLessThanOrEqual(20);
      const elite = rollGoldReward(ctx, "elite");
      expect(elite).toBeGreaterThanOrEqual(25);
      expect(elite).toBeLessThanOrEqual(35);
      const boss = rollGoldReward(ctx, "boss");
      expect(boss).toBeGreaterThanOrEqual(95);
      expect(boss).toBeLessThanOrEqual(105);
    }
  });

  test("A13 boss gold = round(gold * 0.75)", () => {
    for (let i = 0; i < 20; i++) {
      const { ctx } = ctxFor(`GA${i}`, 13);
      const boss = rollGoldReward(ctx, "boss");
      expect(boss).toBeGreaterThanOrEqual(Math.round(95 * 0.75));
      expect(boss).toBeLessThanOrEqual(Math.round(105 * 0.75));
    }
  });

  test("Golden Idol adds round(25%) on top (after A13 for bosses)", () => {
    const a = ctxFor("IDOL");
    const plain = rollGoldReward(a.ctx, "monster");
    const b = ctxFor("IDOL");
    b.s.run.relics.push({ defId: "GOLDEN_IDOL", counter: 0 });
    const idol = rollGoldReward(b.ctx, "monster");
    expect(idol).toBe(plain + Math.round(plain * 0.25));
  });
});

describe("elite rewards", () => {
  test("elite rewards: gold + relic from tier pools + card group; burning adds emerald key", () => {
    const { s, ctx } = ctxFor("ELITE");
    const entries = buildCombatRewards(ctx, "elite", true);
    expect(entries.some((e) => e.kind === "gold")).toBe(true);
    expect(entries.some((e) => e.kind === "relic")).toBe(true);
    expect(entries.some((e) => e.kind === "emeraldKey")).toBe(true);
    expect(entries.filter((e) => e.kind === "card").length).toBe(3);
    // relic came off the front of a run pool
    const relic = entries.find((e) => e.kind === "relic")!;
    expect((relic as { id: string }).id.startsWith("T_RELIC_")).toBe(true);
    expect(s.run.keys.emerald).toBe(false); // granted only when taken
  });

  test("emerald key not offered once owned", () => {
    const { s, ctx } = ctxFor("ELITE2");
    s.run.keys.emerald = true;
    const entries = buildCombatRewards(ctx, "elite", true);
    expect(entries.some((e) => e.kind === "emeraldKey")).toBe(false);
  });
});

describe("chests", () => {
  test("size distribution over 400 seeds roughly 50/33/17", () => {
    const counts = { small: 0, medium: 0, large: 0 };
    for (let i = 0; i < 400; i++) {
      const { ctx } = ctxFor(`CH${i}`);
      counts[setupTreasureRoom(ctx).size]++;
    }
    expect(counts.small).toBeGreaterThan(150);
    expect(counts.small).toBeLessThan(250);
    expect(counts.medium).toBeGreaterThan(90);
    expect(counts.medium).toBeLessThan(180);
    expect(counts.large).toBeGreaterThan(30);
    expect(counts.large).toBeLessThan(110);
  });

  test("single-roll quirk: gold presence correlates with relic tier", () => {
    for (let i = 0; i < 200; i++) {
      const { ctx } = ctxFor(`CQ${i}`);
      const chest = setupTreasureRoom(ctx);
      // small: gold needs roll<50, uncommon needs roll>=75 - mutually exclusive
      if (chest.size === "small" && chest.relicTier === "uncommon") expect(chest.goldPresent).toBe(false);
      // small chests never hold rare relics
      if (chest.size === "small") expect(chest.relicTier).not.toBe("rare");
      // large: common share is 0
      if (chest.size === "large") expect(chest.relicTier).not.toBe("common");
      // medium: rare needs roll>=85, gold needs roll<35 - mutually exclusive
      if (chest.size === "medium" && chest.relicTier === "rare") expect(chest.goldPresent).toBe(false);
      // large: gold needs roll<50 which is inside the uncommon band
      if (chest.size === "large" && chest.goldPresent) expect(chest.relicTier).toBe("uncommon");
    }
  });

  test("gold amount within 0.9x-1.1x of the size base, rounded", () => {
    for (let i = 0; i < 120; i++) {
      const { ctx } = ctxFor(`CG${i}`);
      const chest = setupTreasureRoom(ctx);
      if (!chest.goldPresent) continue;
      const contents = openChestContents(ctx, chest, false);
      const base = CHESTS.goldBaseAmount[chest.size];
      expect(contents.gold).toBeGreaterThanOrEqual(Math.round(base * 0.9));
      expect(contents.gold).toBeLessThanOrEqual(Math.round(base * 1.1));
    }
  });

  test("sapphire key replaces the relic (relic still consumed from the pool)", () => {
    const { s, ctx } = ctxFor("KEY");
    const chest = setupTreasureRoom(ctx);
    const poolSizeBefore =
      s.run.pools.commonRelics.length + s.run.pools.uncommonRelics.length + s.run.pools.rareRelics.length;
    const contents = openChestContents(ctx, chest, true);
    expect(contents.sapphireKeyTaken).toBe(true);
    expect(contents.relicId).toBeNull();
    const poolSizeAfter =
      s.run.pools.commonRelics.length + s.run.pools.uncommonRelics.length + s.run.pools.rareRelics.length;
    expect(poolSizeAfter).toBe(poolSizeBefore - 1);
  });
});

describe("relic pools", () => {
  test("consumed from the front, with exhaustion fallback to CIRCLET", () => {
    const { s } = ctxFor("POOL");
    const first = s.run.pools.commonRelics[0]!;
    expect(obtainRelicFromPool(s.run, "common")).toBe(first);
    s.run.pools.commonRelics = [];
    s.run.pools.uncommonRelics = ["U1"];
    expect(obtainRelicFromPool(s.run, "common")).toBe("U1"); // common -> uncommon
    s.run.pools.uncommonRelics = [];
    s.run.pools.rareRelics = [];
    expect(obtainRelicFromPool(s.run, "common")).toBe("CIRCLET");
    s.run.pools.bossRelics = [];
    expect(obtainRelicFromPool(s.run, "boss")).toBe("RED_CIRCLET");
  });

  // the chest screen names the relic before you trade it for the key
  test("peek returns what the take would hand over, and consumes nothing", () => {
    const { s } = ctxFor("PEEK");
    const sizes = () => s.run.pools.commonRelics.length + s.run.pools.uncommonRelics.length;
    for (const tier of ["common", "uncommon", "rare", "shop", "boss"] as const) {
      const before = sizes();
      const peeked = peekRelicFromPool(s.run, tier);
      expect(peekRelicFromPool(s.run, tier)).toBe(peeked); // idempotent
      expect(sizes()).toBe(before);
      expect(obtainRelicFromPool(s.run, tier)).toBe(peeked);
    }
    // the fallback chain matches too
    s.run.pools.commonRelics = [];
    s.run.pools.uncommonRelics = ["U1"];
    expect(peekRelicFromPool(s.run, "common")).toBe("U1");
    s.run.pools.uncommonRelics = [];
    s.run.pools.rareRelics = [];
    expect(peekRelicFromPool(s.run, "common")).toBe("CIRCLET");
    s.run.pools.bossRelics = [];
    expect(peekRelicFromPool(s.run, "boss")).toBe("RED_CIRCLET");
  });
});

describe("shop", () => {
  test("inventory shape: 2A/2S/1P (distinct pairs, power never common), 2 colorless, 3 relics, 3 potions", () => {
    for (const seed of ["S1", "S2", "S3", "S4"]) {
      const { ctx } = ctxFor(seed);
      const shop = generateShop(ctx);
      expect(shop.cards.length).toBe(7);
      const type = (i: number) => bundle.cards.get(shop.cards[i]!.id)!.type;
      expect([type(0), type(1), type(2), type(3), type(4)]).toEqual(["attack", "attack", "skill", "skill", "power"]);
      expect(shop.cards[0]!.id).not.toBe(shop.cards[1]!.id);
      expect(shop.cards[2]!.id).not.toBe(shop.cards[3]!.id);
      expect(shop.cards[4]!.rarity).not.toBe("common"); // promotion
      expect(shop.cards[5]!.colorless).toBe(true);
      expect(shop.cards[5]!.rarity).toBe("uncommon");
      expect(shop.cards[6]!.colorless).toBe(true);
      expect(shop.cards[6]!.rarity).toBe("rare");
      expect(shop.relics.length).toBe(3);
      expect(shop.relics[2]!.tier).toBe("shop");
      expect(shop.potions.length).toBe(3);
    }
  });

  test("exactly one of the 5 class cards is half price", () => {
    for (const seed of ["H1", "H2", "H3"]) {
      const { ctx } = ctxFor(seed);
      const shop = generateShop(ctx);
      let sales = 0;
      for (let i = 0; i < 5; i++) {
        const slot = shop.cards[i]!;
        const base = SHOP.basePrices.cardByRarity[slot.rarity];
        const lo = Math.trunc(base * 0.9);
        if (slot.price < lo) {
          sales++;
          // halved via integer division of the jittered price
          expect(slot.price).toBeGreaterThanOrEqual(Math.trunc(lo / 2));
          expect(slot.price).toBeLessThanOrEqual(Math.trunc((base * 1.1) / 2));
        } else {
          expect(slot.price).toBeLessThanOrEqual(Math.trunc(base * 1.1));
        }
      }
      expect(sales).toBe(1);
    }
  });

  test("colorless cards cost x1.2; relic/potion prices jitter 0.95-1.05 of base", () => {
    const { ctx } = ctxFor("PRICE");
    const shop = generateShop(ctx);
    for (const i of [5, 6]) {
      const slot = shop.cards[i]!;
      const base = SHOP.basePrices.cardByRarity[slot.rarity];
      expect(slot.price).toBeGreaterThanOrEqual(Math.trunc(base * 0.9 * 1.2) - 1);
      expect(slot.price).toBeLessThanOrEqual(Math.trunc(base * 1.1 * 1.2) + 1);
    }
    for (const r of shop.relics) {
      const base = SHOP.basePrices.relicByTier[r.tier];
      expect(r.price).toBeGreaterThanOrEqual(Math.round(base * 0.95) - 1);
      expect(r.price).toBeLessThanOrEqual(Math.round(base * 1.05) + 1);
    }
    for (const p of shop.potions) {
      const base = SHOP.basePrices.potionByRarity[bundle.potions.get(p.id)!.rarity];
      expect(p.price).toBeGreaterThanOrEqual(Math.round(base * 0.95) - 1);
      expect(p.price).toBeLessThanOrEqual(Math.round(base * 1.05) + 1);
    }
  });

  test("removal cost escalates 75 + 25 per purchase", () => {
    const { s, ctx } = ctxFor("REM");
    expect(computeRemovalCost(ctx)).toBe(75);
    s.run.history.cardRemovesPurchased = 1;
    expect(computeRemovalCost(ctx)).toBe(100);
    s.run.history.cardRemovesPurchased = 3;
    expect(computeRemovalCost(ctx)).toBe(150);
  });

  test("A16 (disputed; wiki side): every price is round(1.1x) of the A15 shop", () => {
    const a15 = ctxFor("A16", 15);
    const a16 = ctxFor("A16", 16);
    const shop15 = generateShop(a15.ctx);
    const shop16 = generateShop(a16.ctx);
    for (let i = 0; i < 7; i++) expect(shop16.cards[i]!.price).toBe(Math.round(shop15.cards[i]!.price * 1.1));
    for (let i = 0; i < 3; i++) expect(shop16.relics[i]!.price).toBe(Math.round(shop15.relics[i]!.price * 1.1));
    for (let i = 0; i < shop15.potions.length; i++) {
      expect(shop16.potions[i]!.price).toBe(Math.round(shop15.potions[i]!.price * 1.1));
    }
    expect(shop16.removalCost).toBe(Math.round(shop15.removalCost * 1.1));
  });

  test("same seed generates an identical shop", () => {
    const a = ctxFor("SAME");
    const b = ctxFor("SAME");
    expect(JSON.stringify(generateShop(a.ctx))).toBe(JSON.stringify(generateShop(b.ctx)));
  });
});
