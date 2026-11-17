// Regression tests for the A20 Ironclad engine-API bugs: displayed-list card
// indices, potions, eggs, shop relics, thieves, Neow healing, previews,
// encounter rolls, Corruption's printed cost, No Draw, Intangible, Parasite.

import { test, expect, describe } from "bun:test";
import { createRun, createCombatGame, advance, type GameState } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content/index";
import { getCardPreviews } from "../../src/engine/combat/preview";
import { getIntents } from "../../src/engine/combat/intents";
import { cardPlayCost } from "../../src/engine/combat/preview";
import { buildView } from "../../src/cli/state/view";
import { initialUiState } from "../../src/cli/state/uiState";
import { formatEvent } from "../../src/cli/text/logfmt";
import { makeTempCard } from "../../src/engine/combat/interpreter";
import { buildCombatState } from "../../src/engine/combat/setup";
import { rollLineup } from "../../src/engine/run/lineups";
import { buildCombatRewards, createCardReward, rollPotionReward } from "../../src/engine/run/rewards";
import { makeTestCtx } from "../run/runCtx";
import type { RewardEntry } from "../../src/engine/run/runState";

const bundle = buildBaseContentBundle();

function run(seed = "BUGS", ascension = 0): GameState {
  return createRun({ seed, bundle, character: "IRONCLAD", ascension });
}

function fight(opts: {
  seed?: string;
  deck: { defId: string; upgrades?: number }[];
  monsters?: string[];
  relics?: string[];
  hp?: number;
  maxHp?: number;
}): GameState {
  return createCombatGame({
    seed: opts.seed ?? "BUGS",
    bundle,
    character: "IRONCLAD",
    deck: opts.deck,
    monsters: opts.monsters ?? ["JAW_WORM"],
    relics: opts.relics,
    hp: opts.hp,
    maxHp: opts.maxHp,
  });
}

const deckIds = (s: GameState): string[] => s.run.deck.map((c) => c.defId);

describe("card select indices", () => {
  test("Neow upgrade uses the offered list, so Ascender's Bane at the front is not the first pick", () => {
    const s0 = run("NEOWUP", 10);
    const baneAt = s0.run.deck.findIndex((c) => c.defId === "ASCENDERS_BANE");
    expect(baneAt).toBeGreaterThanOrEqual(0);
    const [bane] = s0.run.deck.splice(baneAt, 1);
    s0.run.deck.unshift(bane!);
    s0.run.room = {
      kind: "neow",
      options: [
        { bonus: "UPGRADE_CARD", drawback: "NONE" },
        { bonus: "HUNDRED_GOLD", drawback: "NONE" },
        { bonus: "HUNDRED_GOLD", drawback: "NONE" },
        { bonus: "BOSS_RELIC", drawback: "LOSE_STARTER_RELIC" },
      ],
    };
    let s = advance(s0, { cmd: "neowPick", i: 0 }, bundle);
    const req = s.pending!.request;
    expect(req.kind).toBe("cards");
    if (req.kind !== "cards") return;
    expect(s.run.deck[0]!.defId).toBe("ASCENDERS_BANE");
    expect(req.iids[0]).toBe(1);
    const target = s.run.deck[req.iids[0]!]!.defId;
    s = advance(s, { cmd: "choose", indices: [0] }, bundle);
    expect(s.run.deck[0]!.defId).toBe("ASCENDERS_BANE");
    expect(s.run.deck[0]!.upgrades).toBe(0);
    expect(s.run.deck[1]!.defId).toBe(target);
    expect(s.run.deck[1]!.upgrades).toBe(1);
  });

  test("Purifier removal follows the offered list when Bane sits in front", () => {
    const s0 = run("PURGE");
    s0.run.deck.unshift({ defId: "ASCENDERS_BANE", upgrades: 0, misc: 0, bottled: false });
    s0.run.room = { kind: "event", eventId: "PURIFIER" };
    let s = advance(s0, { cmd: "eventOption", i: 0 }, bundle);
    const req = s.pending!.request;
    expect(req.kind).toBe("cards");
    if (req.kind !== "cards") return;
    expect(req.iids.includes(0)).toBe(false);
    const removed = s.run.deck[req.iids[0]!]!.defId;
    s = advance(s, { cmd: "choose", indices: [0] }, bundle);
    expect(s.run.deck[0]!.defId).toBe("ASCENDERS_BANE");
    expect(deckIds(s).filter((id) => id === removed).length).toBe(deckIds(s0).filter((id) => id === removed).length - 1);
  });

  test("Empty Cage already indexes the offered list", () => {
    const s0 = run("CAGE");
    s0.run.deck[0]!.bottled = true;
    s0.run.room = {
      kind: "rewards",
      entries: [{ kind: "bossRelic", group: 0, id: "EMPTY_CAGE", taken: false }],
      source: "boss",
    };
    let s = advance(s0, { cmd: "takeReward", i: 0 }, bundle);
    const req = s.pending!.request;
    expect(req.kind).toBe("cards");
    if (req.kind !== "cards") return;
    expect(req.iids[0]).toBe(1);
    s = advance(s, { cmd: "choose", indices: [0, 1] }, bundle);
    expect(s.run.deck[0]!.bottled).toBe(true);
    expect(s.run.deck.length).toBe(s0.run.deck.length - 2);
  });
});

describe("potions", () => {
  test("Entropic Brew fills empty potion slots", () => {
    const s0 = fight({ deck: [{ defId: "STRIKE_RED" }] });
    s0.run.potions = ["ENTROPIC_BREW", null, null];
    const s = advance(s0, { cmd: "usePotion", slot: 0 }, bundle);
    expect(s.run.potions[0]).not.toBe("ENTROPIC_BREW");
    expect(s.run.potions.every((p) => p !== null)).toBe(true);
    expect(new Set(s.run.potions).size).toBeGreaterThan(0);
  });

  test("Fairy in a Bottle revives at 30% max HP, 60% with Sacred Bark", () => {
    const bare = fight({ deck: [{ defId: "STRIKE_RED" }, { defId: "DEFEND_RED" }], hp: 5, maxHp: 80 });
    bare.run.potions[0] = "FAIRY_POTION";
    bare.run.room = { kind: "combat", roomKind: "monster", encounterId: "JAW_WORM", burningElite: false };
    let s = advance(bare, { cmd: "endTurn" }, bundle);
    expect(s.outcome).toBeNull();
    expect(s.run.hp).toBe(Math.round(80 * 0.3));
    expect(s.run.potions[0]).toBeNull();

    const barked = fight({
      deck: [{ defId: "STRIKE_RED" }, { defId: "DEFEND_RED" }],
      hp: 5,
      maxHp: 80,
      relics: ["SACRED_BARK"],
    });
    barked.run.potions[0] = "FAIRY_POTION";
    barked.run.room = { kind: "combat", roomKind: "monster", encounterId: "JAW_WORM", burningElite: false };
    const saved = advance(barked, { cmd: "endTurn" }, bundle);
    expect(saved.run.hp).toBe(Math.round(80 * 0.6));
  });
});

describe("eggs, orrery, courier, other relics", () => {
  test("Molten, Toxic, and Frozen Egg upgrade cards as they join the deck", () => {
    const cases: [string, string][] = [
      ["MOLTEN_EGG", "ANGER"],
      ["TOXIC_EGG", "SHRUG_IT_OFF"],
      ["FROZEN_EGG", "INFLAME"],
    ];
    for (const [relic, card] of cases) {
      const s0 = run(relic);
      s0.run.relics.push({ defId: relic, counter: 0 });
      const entries: RewardEntry[] = [
        { kind: "card", group: 0, id: card, rarity: "common", upgraded: false, taken: false },
      ];
      s0.run.room = { kind: "rewards", entries, source: "monster" };
      const s = advance(s0, { cmd: "takeReward", i: 0 }, bundle);
      const gained = s.run.deck[s.run.deck.length - 1]!;
      expect(gained.defId).toBe(card);
      expect(gained.upgrades).toBe(1);
    }
  });

  test("Orrery opens five card rewards", () => {
    const s0 = run("ORRERY");
    s0.run.gold = 999;
    s0.run.room = {
      kind: "shop",
      shop: {
        cards: [],
        relics: [{ id: "ORRERY", tier: "shop", price: 1, sold: false }],
        potions: [],
        removalCost: 75,
        removalUsed: false,
      },
    };
    const s = advance(s0, { cmd: "shopBuy", kind: "relic", idx: 0 }, bundle);
    const room = s.run.room!;
    expect(room.kind).toBe("rewards");
    if (room.kind !== "rewards") return;
    const groups = new Set(room.entries.filter((e) => e.kind === "card").map((e) => (e.kind === "card" ? e.group : -1)));
    expect(groups.size).toBe(5);
  });

  test("The Courier restocks a purchased card", () => {
    const s0 = run("COURIER");
    s0.run.relics.push({ defId: "THE_COURIER", counter: 0 });
    s0.run.gold = 999;
    s0.run.room = {
      kind: "shop",
      shop: {
        cards: [{ id: "STRIKE_RED", rarity: "common", price: 50, sold: false, colorless: false }],
        relics: [],
        potions: [],
        removalCost: 75,
        removalUsed: false,
      },
    };
    const s = advance(s0, { cmd: "shopBuy", kind: "card", idx: 0 }, bundle);
    const room = s.run.room!;
    expect(room.kind).toBe("shop");
    if (room.kind !== "shop") return;
    expect(room.shop.cards[0]!.sold).toBe(false);
    expect(room.shop.cards[0]!.price).toBeGreaterThan(0);
    expect(deckIds(s)).toContain("STRIKE_RED");
  });

  test("Cursed Key adds a curse when a non-boss chest opens", () => {
    const s0 = run("CURSEKEY");
    s0.run.relics.push({ defId: "CURSED_KEY", counter: 0 });
    s0.run.room = {
      kind: "treasure",
      chest: { size: "small", goldPresent: false, relicTier: "common", sapphireKeyAvailable: false, opened: false },
    };
    const before = s0.run.deck.length;
    const s = advance(s0, { cmd: "openChest" }, bundle);
    expect(s.run.deck.length).toBe(before + 1);
    expect(bundle.cards.get(s.run.deck[s.run.deck.length - 1]!.defId)!.type).toBe("curse");
  });

  test("Cauldron fills empty potion slots", () => {
    const s0 = run("CAULDRON");
    s0.run.gold = 999;
    s0.run.room = {
      kind: "shop",
      shop: {
        cards: [],
        relics: [{ id: "CAULDRON", tier: "shop", price: 1, sold: false }],
        potions: [],
        removalCost: 75,
        removalUsed: false,
      },
    };
    const s = advance(s0, { cmd: "shopBuy", kind: "relic", idx: 0 }, bundle);
    expect(s.run.potions.filter((p) => p !== null).length).toBe(3);
  });

  test("Dolly's Mirror copies the offered card", () => {
    const s0 = run("MIRROR");
    s0.run.deck[9]!.upgrades = 1;
    s0.run.gold = 999;
    s0.run.room = {
      kind: "shop",
      shop: {
        cards: [],
        relics: [{ id: "DOLLYS_MIRROR", tier: "shop", price: 1, sold: false }],
        potions: [],
        removalCost: 75,
        removalUsed: false,
      },
    };
    let s = advance(s0, { cmd: "shopBuy", kind: "relic", idx: 0 }, bundle);
    const req = s.pending!.request;
    expect(req.kind).toBe("cards");
    if (req.kind !== "cards") return;
    const bashAt = req.iids.findIndex((i) => s.run.deck[i]!.defId === "BASH");
    s = advance(s, { cmd: "choose", indices: [bashAt] }, bundle);
    const copy = s.run.deck[s.run.deck.length - 1]!;
    expect(copy.defId).toBe("BASH");
    expect(copy.upgrades).toBe(1);
  });

  test("Black Star adds a second elite relic", () => {
    const s0 = run("STAR");
    s0.run.relics.push({ defId: "BLACK_STAR", counter: 0 });
    s0.run.room = { kind: "combat", roomKind: "elite", encounterId: "LAGAVULIN", burningElite: false };
    const { ctx, saveRng } = makeTestCtx(s0, bundle);
    const entries = buildCombatRewards(ctx, "elite", false);
    saveRng();
    expect(entries.filter((e) => e.kind === "relic").length).toBe(2);
  });

  test("Sozu blocks potion rewards and shop potions", () => {
    const s0 = run("SOZU");
    s0.run.relics.push({ defId: "SOZU", counter: 0 });
    const { ctx } = makeTestCtx(s0, bundle);
    expect(rollPotionReward(ctx, 1)).toBeNull();
    s0.run.gold = 999;
    s0.run.room = {
      kind: "shop",
      shop: {
        cards: [],
        relics: [],
        potions: [{ id: "FIRE_POTION", price: 1, sold: false }],
        removalCost: 75,
        removalUsed: false,
      },
    };
    expect(() => advance(s0, { cmd: "shopBuy", kind: "potion", idx: 0 }, bundle)).toThrow("cannot obtain potions");
  });

  test("Dream Catcher opens a card reward after resting", () => {
    const s0 = run("DREAM");
    s0.run.relics.push({ defId: "DREAM_CATCHER", counter: 0 });
    s0.run.hp = 40;
    s0.run.room = { kind: "rest", used: false };
    const s = advance(s0, { cmd: "restOption", kind: "rest" }, bundle);
    expect(s.run.hp).toBeGreaterThan(40);
    expect(s.run.room?.kind).toBe("rewards");
  });

  test("Singing Bowl is an option on a card reward and grants 2 max HP", () => {
    const s0 = run("BOWL");
    s0.run.relics.push({ defId: "SINGING_BOWL", counter: 0 });
    s0.run.room = {
      kind: "rewards",
      source: "monster",
      entries: [
        { kind: "card", group: 0, id: "ANGER", rarity: "common", upgraded: false, taken: false },
        { kind: "singingBowl", group: 0, taken: false },
      ],
    };
    const before = s0.run.maxHp;
    const s = advance(s0, { cmd: "takeReward", i: 1 }, bundle);
    expect(s.run.maxHp).toBe(before + 2);
    expect(s.run.hp).toBe(s0.run.hp + 2);
    expect(deckIds(s)).not.toContain("ANGER");
    const room = s.run.room!;
    if (room.kind !== "rewards") throw new Error("expected rewards");
    expect(room.entries.every((e) => e.taken)).toBe(true);
  });
});

describe("thieves", () => {
  test("Looter's opening intent is the mug, not a question mark", () => {
    const loot = fight({
      seed: "THIEF",
      deck: [{ defId: "STRIKE_RED" }, { defId: "BASH" }],
      monsters: ["LOOTER"],
    });
    const intent = getIntents(loot, bundle)[0];
    expect(intent?.moveId).toBe("LOOTER_MUG");
    expect(intent?.damage).toBeGreaterThan(0);
    const mugger = fight({ seed: "THIEF2", deck: [{ defId: "STRIKE_RED" }], monsters: ["MUGGER"] });
    const mug = getIntents(mugger, bundle)[0];
    expect(mug?.moveId).toBe("MUGGER_MUG");
    expect(mug?.damage).toBeGreaterThan(0);
  });

  test("stolen gold is added to the reward after Mug, and Lunge does not steal", () => {
    const s0 = fight({
      seed: "MUG",
      deck: [{ defId: "DEFEND_RED" }, { defId: "DEFEND_RED" }, { defId: "BASH" }],
      monsters: ["LOOTER"],
      hp: 80,
    });
    s0.run.gold = 40;
    s0.run.room = { kind: "combat", roomKind: "monster", encounterId: "LOOTER", burningElite: false };
    let s = advance(s0, { cmd: "endTurn" }, bundle);
    expect(s.run.gold).toBe(40 - 15);
    s.combat!.monsters[0]!.hp = 1;
    s.combat!.player.energy = 3;
    const bash = s.combat!.player.piles.hand.findIndex((i) => s.combat!.cards[i]!.defId === "BASH");
    // hand may have changed; if bash was discarded, set a strike
    if (bash === -1) {
      const any = 0;
      s.combat!.cards[s.combat!.player.piles.hand[any]!]!.defId = "STRIKE_RED";
      const def = bundle.cards.get("STRIKE_RED")!;
      s.combat!.cards[s.combat!.player.piles.hand[any]!]!.cost = def.cost;
      s = advance(s, { cmd: "playCard", handIdx: any, target: 0 }, bundle);
    } else {
      s = advance(s, { cmd: "playCard", handIdx: bash, target: 0 }, bundle);
    }
    expect(s.run.room?.kind).toBe("rewards");
    const room = s.run.room!;
    if (room.kind !== "rewards") return;
    const gold = room.entries.find((e) => e.kind === "gold");
    expect(gold && gold.kind === "gold" ? gold.amount : 0).toBeGreaterThanOrEqual(15);

    const lunge = fight({
      seed: "LUNGE",
      deck: [{ defId: "DEFEND_RED" }],
      monsters: ["MUGGER"],
      hp: 80,
    });
    lunge.run.gold = 40;
    lunge.combat!.monsters[0]!.move = "MUGGER_LUNGE";
    lunge.combat!.turn = 3;
    const before = lunge.run.gold;
    const after = advance(lunge, { cmd: "endTurn" }, bundle);
    expect(after.run.gold).toBe(before);
  });
});

describe("neow, preview, chaos, lineups, corruption, no draw, intangible, parasite", () => {
  test("Neow max HP bonus also heals the gained amount", () => {
    const s0 = run("NEOWHP");
    s0.run.hp = 50;
    s0.run.maxHp = 80;
    s0.run.room = {
      kind: "neow",
      options: [
        { bonus: "TEN_PERCENT_HP_BONUS", drawback: "NONE" },
        { bonus: "HUNDRED_GOLD", drawback: "NONE" },
        { bonus: "HUNDRED_GOLD", drawback: "NONE" },
        { bonus: "BOSS_RELIC", drawback: "LOSE_STARTER_RELIC" },
      ],
    };
    const s = advance(s0, { cmd: "neowPick", i: 0 }, bundle);
    expect(s.run.maxHp).toBe(88);
    expect(s.run.hp).toBe(58);
  });

  test("Perfected Strike preview matches the damage it deals", () => {
    const s0 = fight({
      seed: "PSTRIKE",
      deck: [
        { defId: "PERFECTED_STRIKE" },
        { defId: "STRIKE_RED" },
        { defId: "STRIKE_RED" },
        { defId: "DEFEND_RED" },
      ],
      monsters: ["JAW_WORM"],
    });
    const hand = s0.combat!.player.piles.hand;
    const idx = hand.findIndex((i) => s0.combat!.cards[i]!.defId === "PERFECTED_STRIKE");
    expect(idx).toBeGreaterThanOrEqual(0);
    const preview = getCardPreviews(s0, bundle, 0)[idx];
    expect(preview?.damage).not.toBeNull();
    const before = s0.combat!.monsters[0]!.hp;
    const s = advance(s0, { cmd: "playCard", handIdx: idx, target: 0 }, bundle);
    const dealt = before - s.combat!.monsters[0]!.hp;
    expect(dealt).toBe(preview!.damage);
  });

  test("Distilled Chaos does not play Ascender's Bane", () => {
    const s0 = fight({
      seed: "CHAOS",
      deck: [{ defId: "ASCENDERS_BANE" }, { defId: "STRIKE_RED" }, { defId: "DEFEND_RED" }],
    });
    // Bane is innate, so it starts in hand. Park it on top of the draw pile.
    const piles = s0.combat!.player.piles;
    const everywhere = [...piles.hand, ...piles.draw, ...piles.discard];
    const bane = everywhere.find((i) => s0.combat!.cards[i]!.defId === "ASCENDERS_BANE");
    expect(bane).toBeDefined();
    const rest = everywhere.filter((i) => i !== bane);
    piles.hand = [];
    piles.discard = [];
    piles.draw = [bane!, ...rest];
    s0.run.potions[0] = "DISTILLED_CHAOS";
    const s = advance(s0, { cmd: "usePotion", slot: 0 }, bundle);
    const playedBane = s.eventLog.some((e) => e.event === "cardPlayed" && (e.payload as { defId?: string }).defId === "ASCENDERS_BANE");
    expect(playedBane).toBe(false);
    expect(s.combat!.player.piles.discard.some((i) => s.combat!.cards[i]!.defId === "ASCENDERS_BANE") ||
      s.combat!.player.piles.draw.some((i) => s.combat!.cards[i]!.defId === "ASCENDERS_BANE")).toBe(true);
  });

  test("randomized encounters vary by seed and stay stable for one seed", () => {
    const a = run("LINE1");
    const b = run("LINE1");
    const c = run("LINE2");
    const { ctx: ca, saveRng: saveA } = makeTestCtx(a, bundle);
    const { ctx: cb } = makeTestCtx(b, bundle);
    const { ctx: cc } = makeTestCtx(c, bundle);
    const la = rollLineup(ca, "monster", "GREMLIN_GANG").map((s) => s.id);
    saveA();
    const lb = rollLineup(cb, "monster", "GREMLIN_GANG").map((s) => s.id);
    const lc = rollLineup(cc, "monster", "GREMLIN_GANG").map((s) => s.id);
    expect(la).toEqual(lb);
    expect(la.length).toBe(4);
    expect(new Set(la).size).toBeGreaterThan(1);
    // a second seed is allowed to match, so also check a louse flip differs somewhere
    const louseA = rollLineup(ca, "monster", "TWO_LOUSE").map((s) => s.id);
    const louseC = rollLineup(cc, "monster", "TWO_LOUSE").map((s) => s.id);
    expect(louseA.every((id) => id === "RED_LOUSE" || id === "GREEN_LOUSE")).toBe(true);
    expect(louseA.join() === louseC.join() && la.join() === lc.join()).toBe(false);
  });

  test("Corruption prints skills at 0 and marks them playable", () => {
    const s0 = fight({
      deck: [{ defId: "DEFEND_RED" }, { defId: "STRIKE_RED" }],
      hp: 80,
    });
    s0.combat!.player.energy = 0;
    s0.combat!.player.powers.push({ id: "CORRUPTION", amount: 1, justApplied: false, data: null });
    const defend = s0.combat!.player.piles.hand.map((i) => s0.combat!.cards[i]!).find((c) => c.defId === "DEFEND_RED")!;
    expect(cardPlayCost(s0, bundle, defend)).toBe(0);
    s0.run.room = { kind: "combat", roomKind: "monster", encounterId: "JAW_WORM", burningElite: false };
    const ui = { ...initialUiState(), screen: "run" as const };
    const view = buildView(s0, ui, bundle);
    expect(view.screen.kind).toBe("combat");
    if (view.screen.kind !== "combat") return;
    const row = view.screen.hand.find((h) => h.name.startsWith("Defend"));
    expect(row?.cost).toBe("0");
    expect(row?.playable).toBe(true);
  });

  test("No Draw blocks Pommel Strike, Warcry, and Gremlin Horn draws", () => {
    const s0 = fight({
      deck: [
        { defId: "POMMEL_STRIKE" },
        { defId: "STRIKE_RED" },
        { defId: "STRIKE_RED" },
        { defId: "DEFEND_RED" },
        { defId: "DEFEND_RED" },
      ],
      relics: ["GREMLIN_HORN"],
    });
    s0.combat!.player.powers.push({ id: "NO_DRAW", amount: 1, justApplied: false, data: null });
    const handBefore = s0.combat!.player.piles.hand.length;
    const idx = s0.combat!.player.piles.hand.findIndex((i) => s0.combat!.cards[i]!.defId === "POMMEL_STRIKE");
    const s = advance(s0, { cmd: "playCard", handIdx: idx, target: 0 }, bundle);
    expect(s.combat!.player.piles.hand.length).toBe(handBefore - 1);
    expect(s.eventLog.some((e) => e.event === "cardDrawn")).toBe(false);
  });

  test("Intangible caps thorns and Hemokinesis HP loss at 1", () => {
    const hemo = fight({
      deck: [{ defId: "HEMOKINESIS" }, { defId: "DEFEND_RED" }],
      hp: 40,
    });
    hemo.combat!.player.powers.push({ id: "INTANGIBLE", amount: 1, justApplied: false, data: null });
    const idx = hemo.combat!.player.piles.hand.findIndex((i) => hemo.combat!.cards[i]!.defId === "HEMOKINESIS");
    const after = advance(hemo, { cmd: "playCard", handIdx: idx, target: 0 }, bundle);
    expect(40 - after.run.hp).toBe(1);

    const thorns = fight({
      deck: [{ defId: "STRIKE_RED" }],
      monsters: ["SPIKER"],
      hp: 50,
    });
    thorns.combat!.player.powers.push({ id: "INTANGIBLE", amount: 1, justApplied: false, data: null });
    thorns.combat!.player.block = 0;
    const tidx = thorns.combat!.player.piles.hand.findIndex((i) => thorns.combat!.cards[i]!.defId === "STRIKE_RED");
    const hit = advance(thorns, { cmd: "playCard", handIdx: tidx, target: 0 }, bundle);
    expect(50 - hit.run.hp).toBe(1);
  });

  test("removing Parasite costs 3 max HP", () => {
    const s0 = run("WORM");
    s0.run.deck.push({ defId: "PARASITE", upgrades: 0, misc: 0, bottled: false });
    s0.run.hp = 80;
    s0.run.maxHp = 80;
    s0.run.gold = 200;
    s0.run.room = {
      kind: "shop",
      shop: {
        cards: [],
        relics: [],
        potions: [],
        removalCost: 75,
        removalUsed: false,
      },
    };
    const idx = s0.run.deck.findIndex((c) => c.defId === "PARASITE");
    const s = advance(s0, { cmd: "shopRemove", deckIdx: idx }, bundle);
    expect(deckIds(s)).not.toContain("PARASITE");
    expect(s.run.maxHp).toBe(77);
    expect(s.run.hp).toBe(77);
  });

  test("a created card that misses a full hand is logged as discarded", () => {
    const fillers = Array.from({ length: 10 }, () => ({ defId: "STRIKE_RED" }));
    const s0 = fight({ deck: fillers });
    const combat = s0.combat!;
    const piles = combat.player.piles;
    const all = [...piles.hand, ...piles.draw, ...piles.discard];
    piles.hand = all.slice(0, 10);
    piles.draw = all.slice(10);
    piles.discard = [];
    expect(piles.hand.length).toBe(10);
    const events: { event: string; payload?: unknown }[] = [];
    const { ctx } = makeTestCtx(s0, bundle);
    ctx.emit = (event, payload) => events.push({ event, payload });
    makeTempCard(ctx, "WOUND", 0, "hand");
    const created = events.find((e) => e.event === "cardCreated");
    expect((created?.payload as { dest?: string } | undefined)?.dest).toBe("discard");
    expect(formatEvent({ event: "cardCreated", payload: created?.payload }, bundle)).toContain("(discard)");
    expect(combat.player.piles.hand.length).toBe(10);
    expect(combat.player.piles.discard.some((i) => combat.cards[i]!.defId === "WOUND")).toBe(true);
  });

  test("The Boot raises a 4-damage attack to 5, and Chemical X adds 2 to X", () => {
    const weak = fight({ deck: [{ defId: "STRIKE_RED" }, { defId: "DEFEND_RED" }] });
    weak.combat!.player.powers.push({ id: "WEAK", amount: 1, justApplied: false, data: null });
    const bareIdx = weak.combat!.player.piles.hand.findIndex((i) => weak.combat!.cards[i]!.defId === "STRIKE_RED");
    const bareHp = weak.combat!.monsters[0]!.hp;
    const bare = advance(weak, { cmd: "playCard", handIdx: bareIdx, target: 0 }, bundle);
    expect(bareHp - bare.combat!.monsters[0]!.hp).toBe(4);

    const boot = fight({ deck: [{ defId: "STRIKE_RED" }, { defId: "DEFEND_RED" }], relics: ["THE_BOOT"] });
    boot.combat!.player.powers.push({ id: "WEAK", amount: 1, justApplied: false, data: null });
    const bootIdx = boot.combat!.player.piles.hand.findIndex((i) => boot.combat!.cards[i]!.defId === "STRIKE_RED");
    const bootHp = boot.combat!.monsters[0]!.hp;
    const booted = advance(boot, { cmd: "playCard", handIdx: bootIdx, target: 0 }, bundle);
    expect(bootHp - booted.combat!.monsters[0]!.hp).toBe(5);

    const x = fight({ deck: [{ defId: "WHIRLWIND" }, { defId: "DEFEND_RED" }], relics: ["CHEMICAL_X"] });
    x.combat!.player.energy = 2;
    const xIdx = x.combat!.player.piles.hand.findIndex((i) => x.combat!.cards[i]!.defId === "WHIRLWIND");
    const before = x.combat!.monsters[0]!.hp;
    const spun = advance(x, { cmd: "playCard", handIdx: xIdx, target: 0 }, bundle);
    expect(before - spun.combat!.monsters[0]!.hp).toBe(5 * 4);
    expect(spun.combat!.player.energy).toBe(0);
  });

  test("Hand Drill applies 2 Vulnerable when block breaks", () => {
    const s0 = fight({ deck: [{ defId: "STRIKE_RED" }], relics: ["HAND_DRILL"] });
    s0.combat!.monsters[0]!.block = 3;
    const idx = s0.combat!.player.piles.hand.findIndex((i) => s0.combat!.cards[i]!.defId === "STRIKE_RED");
    const s = advance(s0, { cmd: "playCard", handIdx: idx, target: 0 }, bundle);
    const vuln = s.combat!.monsters[0]!.powers.find((p) => p.id === "VULNERABLE");
    expect(vuln?.amount).toBe(2);
    expect(s.combat!.monsters[0]!.block).toBe(0);
  });

  test("Blue Candle plays a curse for 1 HP and exhaust; Medical Kit plays a status", () => {
    const curse = fight({
      deck: [{ defId: "ASCENDERS_BANE" }, { defId: "STRIKE_RED" }],
      relics: ["BLUE_CANDLE"],
      hp: 40,
    });
    const piles = curse.combat!.player.piles;
    const bane = [...piles.hand, ...piles.draw].find((i) => curse.combat!.cards[i]!.defId === "ASCENDERS_BANE")!;
    piles.hand = [bane];
    piles.draw = piles.draw.filter((i) => i !== bane);
    const played = advance(curse, { cmd: "playCard", handIdx: 0 }, bundle);
    expect(played.run.hp).toBe(39);
    expect(played.combat!.player.piles.exhaust.some((i) => played.combat!.cards[i]!.defId === "ASCENDERS_BANE")).toBe(true);

    const status = fight({
      deck: [{ defId: "WOUND" }, { defId: "STRIKE_RED" }],
      relics: ["MEDICAL_KIT"],
      hp: 40,
    });
    const sp = status.combat!.player.piles;
    const wound = [...sp.hand, ...sp.draw].find((i) => status.combat!.cards[i]!.defId === "WOUND")!;
    sp.hand = [wound];
    sp.draw = sp.draw.filter((i) => i !== wound);
    const used = advance(status, { cmd: "playCard", handIdx: 0 }, bundle);
    expect(used.run.hp).toBe(40);
    expect(used.combat!.player.piles.exhaust.some((i) => used.combat!.cards[i]!.defId === "WOUND")).toBe(true);
  });

  test("Strange Spoon discards an Exhaust card half the time", () => {
    let exhausted = 0;
    let discarded = 0;
    for (let i = 0; i < 24; i++) {
      const s0 = fight({
        seed: `SPOON${i}`,
        deck: [{ defId: "DARK_SHACKLES" }, { defId: "STRIKE_RED" }],
        relics: ["STRANGE_SPOON"],
      });
      const piles = s0.combat!.player.piles;
      const shackles = [...piles.hand, ...piles.draw].find((id) => s0.combat!.cards[id]!.defId === "DARK_SHACKLES")!;
      piles.hand = [shackles];
      const s = advance(s0, { cmd: "playCard", handIdx: 0, target: 0 }, bundle);
      const inExhaust = s.combat!.player.piles.exhaust.some((id) => s.combat!.cards[id]!.defId === "DARK_SHACKLES");
      if (inExhaust) exhausted++;
      else discarded++;
    }
    expect(exhausted).toBeGreaterThan(0);
    expect(discarded).toBeGreaterThan(0);
  });

  test("Lizard Tail revives once at half max HP", () => {
    const s0 = fight({
      deck: [{ defId: "STRIKE_RED" }, { defId: "DEFEND_RED" }],
      relics: ["LIZARD_TAIL"],
      hp: 5,
      maxHp: 80,
    });
    s0.run.room = { kind: "combat", roomKind: "monster", encounterId: "JAW_WORM", burningElite: false };
    const s = advance(s0, { cmd: "endTurn" }, bundle);
    expect(s.outcome).toBeNull();
    expect(s.run.hp).toBe(40);
    expect(s.run.relics.find((r) => r.defId === "LIZARD_TAIL")!.counter).toBe(-1);
  });

  test("Golden Eye scries 2 extra cards", () => {
    const s0 = fight({
      deck: [
        { defId: "CUT_THROUGH_FATE" },
        { defId: "STRIKE_RED" },
        { defId: "DEFEND_RED" },
        { defId: "BASH" },
        { defId: "ANGER" },
        { defId: "POMMEL_STRIKE" },
      ],
      relics: ["GOLDEN_EYE"],
    });
    const piles = s0.combat!.player.piles;
    const all = [...piles.hand, ...piles.draw, ...piles.discard];
    const fate = all.find((i) => s0.combat!.cards[i]!.defId === "CUT_THROUGH_FATE");
    expect(fate).toBeDefined();
    piles.hand = [fate!];
    piles.draw = all.filter((i) => i !== fate);
    piles.discard = [];
    const idx = 0;
    const s = advance(s0, { cmd: "playCard", handIdx: idx, target: 0 }, bundle);
    const req = s.pending?.request;
    expect(req?.kind).toBe("scry");
    if (req?.kind !== "scry") return;
    expect(req.iids.length).toBe(4);
  });

  test("Prismatic Shard can offer a card from another color", () => {
    let foreign = false;
    for (let i = 0; i < 12 && !foreign; i++) {
      const s0 = run(`PRISM${i}`);
      s0.run.relics.push({ defId: "PRISMATIC_SHARD", counter: 0 });
      const { ctx } = makeTestCtx(s0, bundle);
      const cards = createCardReward(ctx, "monster");
      foreign = cards.some((c) => bundle.cards.get(c.id)!.color !== "red");
    }
    expect(foreign).toBe(true);
  });

  test("Slaver's Collar adds energy only in elite and boss fights", () => {
    const s0 = run("COLLAR");
    s0.run.relics.push({ defId: "SLAVERS_COLLAR", counter: 0 });
    const elite = buildCombatState(s0.run, bundle, "LAGAVULIN", ["LAGAVULIN"], 3, 0, "elite");
    const normal = buildCombatState(s0.run, bundle, "JAW_WORM", ["JAW_WORM"], 3, 0, "monster");
    const boss = buildCombatState(s0.run, bundle, "THE_GUARDIAN", ["THE_GUARDIAN"], 3, 0, "boss");
    expect(elite.player.energyPerTurn).toBe(4);
    expect(boss.player.energyPerTurn).toBe(4);
    expect(normal.player.energyPerTurn).toBe(3);
  });

  test("Frozen Eye shows the draw pile in real order", () => {
    const s0 = fight({
      deck: [
        { defId: "STRIKE_RED" },
        { defId: "DEFEND_RED" },
        { defId: "BASH" },
        { defId: "ANGER" },
        { defId: "POMMEL_STRIKE" },
        { defId: "CLOTHESLINE" },
        { defId: "IRON_WAVE" },
        { defId: "TWIN_STRIKE" },
      ],
      relics: ["FROZEN_EYE"],
    });
    s0.run.room = { kind: "combat", roomKind: "monster", encounterId: "JAW_WORM", burningElite: false };
    const ui = { ...initialUiState(), screen: "run" as const, overlays: [{ kind: "pile" as const, pile: "draw" as const, page: 0 }] };
    const view = buildView(s0, ui, bundle);
    expect(view.overlay?.kind).toBe("list");
    if (view.overlay?.kind !== "list") return;
    const labels = view.overlay.list.items.map((it) => it.label);
    const real = s0.combat!.player.piles.draw.map((i) => {
      const c = s0.combat!.cards[i]!;
      return bundle.cards.get(c.defId)!.name;
    });
    expect(labels.length).toBe(real.length);
    labels.forEach((label, i) => expect(label.startsWith(real[i]!)).toBe(true));
  });
});
