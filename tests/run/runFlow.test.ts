import { test, expect, describe } from "bun:test";
import { createRun, advance, type GameState } from "../../src/engine/game";
import { makeRunTestBundle } from "./runTestBundle";
import { makeTestCtx, autoWinCombat, stepRun, walkUntil, runSignature } from "./runCtx";
import { generateEncounters, getActDef } from "../../src/engine/run/encounters";
import { resolveUnknownRoom, generateEventId, UNKNOWN_ROOM } from "../../src/engine/run/runFlow";
import { restHealAmount } from "../../src/engine/run/rest";
import { generateShop } from "../../src/engine/run/shop";
import { setupTreasureRoom } from "../../src/engine/run/treasure";
import {
  NEOW_BONUS_TABLE_0,
  NEOW_BONUS_TABLE_1,
  NEOW_BONUS_BY_DRAWBACK,
  NEOW_TIER2_ALL,
  NEOW_DRAWBACKS,
} from "../../src/engine/run/neow";
import { RngRegistry } from "../../src/engine/core/rngRegistry";
import { seedFromString } from "../../src/engine/core/rng";
import { MAP_HEIGHT } from "../../src/engine/run/mapGen";

const bundle = makeRunTestBundle();

const run = (seed: string, ascension = 0): GameState => createRun({ seed, bundle, character: "IRONCLAD", ascension });

describe("createRun determinism", () => {
  test("same seed -> byte-identical state; different seed differs", () => {
    expect(JSON.stringify(run("AAA"))).toBe(JSON.stringify(run("AAA")));
    expect(JSON.stringify(run("AAA"))).not.toBe(JSON.stringify(run("BBB")));
  });

  test("same seed + same command walk -> byte-identical mid-run state", () => {
    let a = run("WALK");
    let b = run("WALK");
    for (let i = 0; i < 60; i++) {
      if (a.outcome) break;
      if (a.pending) {
        const req = a.pending.request;
        const picks = req.kind === "cards" ? req.iids.slice(0, req.min) : [0];
        a = advance(a, { cmd: "choose", indices: picks }, bundle);
        b = advance(b, { cmd: "choose", indices: picks }, bundle);
      } else {
        a = stepRun(a, bundle);
        b = stepRun(b, bundle);
      }
      expect(runSignature(a)).toBe(runSignature(b));
    }
  });

  test("JSON round-trip mid-run resumes identically", () => {
    let live = run("SAVE");
    for (let i = 0; i < 8; i++) live = stepRun(live, bundle);
    const restored = JSON.parse(JSON.stringify(live)) as GameState;
    const a = stepRun(live, bundle);
    const b = stepRun(restored, bundle);
    expect(runSignature(a)).toBe(runSignature(b));
  });
});

describe("run initialization", () => {
  test("starts at Neow, floor 0, 99 gold, starter relic, shuffled relic pools", () => {
    const s = run("INIT");
    expect(s.run.room!.kind).toBe("neow");
    expect(s.run.floor).toBe(0);
    expect(s.run.gold).toBe(99);
    expect(s.run.relics.map((r) => r.defId)).toEqual(["T_STARTER"]);
    expect(s.run.pools.commonRelics.length).toBe(6);
    expect(s.run.pools.bossRelics.length).toBe(8);
    expect(s.run.map!.act).toBe(1);
    expect(s.run.potionSlots).toBe(3);
    expect(s.combat).toBeNull();
  });

  test("ascension effects: A6 damaged start, A11 two potion slots, A14 lower max HP", () => {
    const a6 = run("ASC", 6);
    expect(a6.run.hp).toBe(Math.round(999 * 0.9));
    const a11 = run("ASC", 11);
    expect(a11.run.potionSlots).toBe(2);
    expect(a11.run.potions.length).toBe(2);
    const a14 = run("ASC", 14);
    expect(a14.run.maxHp).toBe(999 - 5);
  });

  test("relic pool shuffle consumes exactly 5 relicRng longs", () => {
    const s = run("RELICRNG");
    expect(s.rng.run.relicRng.counter).toBe(5);
  });
});

describe("encounter list generation", () => {
  test("self-golden lists for seed GOLDEN", () => {
    const reg = new RngRegistry(seedFromString("GOLDEN"));
    const gen = generateEncounters(getActDef(bundle.acts, 1), reg.get("monsterRng"));
    expect(gen.monsterList).toEqual([
      "A1_WEAK_2", "A1_WEAK_4", "A1_WEAK_3",
      "A1_STRONG_5", "A1_STRONG_1", "A1_STRONG_4", "A1_STRONG_5", "A1_STRONG_1", "A1_STRONG_4",
      "A1_STRONG_5", "A1_STRONG_1", "A1_STRONG_3", "A1_STRONG_5", "A1_STRONG_1", "A1_STRONG_4", "A1_STRONG_3",
    ]);
    expect(gen.eliteList).toEqual([
      "A1_ELITE_1", "A1_ELITE_3", "A1_ELITE_1", "A1_ELITE_3", "A1_ELITE_2",
      "A1_ELITE_1", "A1_ELITE_3", "A1_ELITE_1", "A1_ELITE_3", "A1_ELITE_2",
    ]);
    expect(gen.bossOrder).toEqual(["A1_BOSS_2", "A1_BOSS_1", "A1_BOSS_3"]);
  });

  test("list shapes: act1 3 weak + 13 strong; 10 elites; boss order is a permutation", () => {
    for (let i = 0; i < 20; i++) {
      const reg = new RngRegistry(seedFromString(`E${i}`));
      const gen = generateEncounters(getActDef(bundle.acts, 1), reg.get("monsterRng"));
      expect(gen.monsterList.length).toBe(16);
      const weakIds = new Set(["A1_WEAK_1", "A1_WEAK_2", "A1_WEAK_3", "A1_WEAK_4"]);
      for (let k = 0; k < 3; k++) expect(weakIds.has(gen.monsterList[k]!)).toBe(true);
      for (let k = 3; k < 16; k++) expect(gen.monsterList[k]!.startsWith("A1_STRONG_")).toBe(true);
      expect(gen.eliteList.length).toBe(10);
      expect([...gen.bossOrder].sort()).toEqual(["A1_BOSS_1", "A1_BOSS_2", "A1_BOSS_3"]);
    }
  });

  test("no-repeat rules: never equal to either of the previous two (weak+strong); elites never repeat consecutively", () => {
    for (let i = 0; i < 40; i++) {
      const reg = new RngRegistry(seedFromString(`R${i}`));
      const gen = generateEncounters(getActDef(bundle.acts, 2), reg.get("monsterRng"));
      for (let k = 1; k < gen.monsterList.length; k++) {
        expect(gen.monsterList[k]).not.toBe(gen.monsterList[k - 1]);
        if (k >= 2) expect(gen.monsterList[k]).not.toBe(gen.monsterList[k - 2]);
      }
      for (let k = 1; k < gen.eliteList.length; k++) {
        expect(gen.eliteList[k]).not.toBe(gen.eliteList[k - 1]);
      }
    }
  });

  test("acts 2/3 generate 2 weak entries", () => {
    const reg = new RngRegistry(seedFromString("W23"));
    const gen2 = generateEncounters(getActDef(bundle.acts, 2), reg.get("monsterRng"));
    expect(gen2.monsterList.length).toBe(15);
    expect(gen2.monsterList[0]!.startsWith("A2_WEAK_")).toBe(true);
    expect(gen2.monsterList[1]!.startsWith("A2_WEAK_")).toBe(true);
    expect(gen2.monsterList[2]!.startsWith("A2_STRONG_")).toBe(true);
  });
});

describe("Neow", () => {
  test("4 options follow the table structure with exclusions", () => {
    for (let i = 0; i < 60; i++) {
      const s = run(`N${i}`);
      const room = s.run.room!;
      if (room.kind !== "neow") throw new Error("not neow");
      const [o0, o1, o2, o3] = room.options;
      expect(room.options.length).toBe(4);
      expect(NEOW_BONUS_TABLE_0).toContain(o0!.bonus);
      expect(o0!.drawback).toBe("NONE");
      expect(NEOW_BONUS_TABLE_1).toContain(o1!.bonus);
      expect(o1!.drawback).toBe("NONE");
      expect(NEOW_DRAWBACKS).toContain(o2!.drawback);
      if (o2!.drawback === "PERCENT_DAMAGE") {
        expect(NEOW_TIER2_ALL).toContain(o2!.bonus);
      } else {
        expect(NEOW_BONUS_BY_DRAWBACK[o2!.drawback as keyof typeof NEOW_BONUS_BY_DRAWBACK]).toContain(o2!.bonus);
      }
      // exclusions
      if (o2!.drawback === "TEN_PERCENT_HP_LOSS") expect(o2!.bonus).not.toBe("TWENTY_PERCENT_HP_BONUS");
      if (o2!.drawback === "NO_GOLD") expect(o2!.bonus).not.toBe("TWO_FIFTY_GOLD");
      if (o2!.drawback === "CURSE") expect(o2!.bonus).not.toBe("REMOVE_TWO");
      expect(o3).toEqual({ bonus: "BOSS_RELIC", drawback: "LOSE_STARTER_RELIC" });
    }
  });

  // seed RUNSEED rolls: [REMOVE_CARD/NONE, HUNDRED_GOLD/NONE, RANDOM_COLORLESS_2/NO_GOLD, BOSS_RELIC/LOSE_STARTER_RELIC]
  test("HUNDRED_GOLD grants 100 gold and returns to the map", () => {
    let s = run("RUNSEED");
    s = advance(s, { cmd: "neowPick", i: 1 }, bundle);
    expect(s.run.gold).toBe(199);
    expect(s.run.room!.kind).toBe("map");
  });

  test("BOSS_RELIC swaps the starter relic for the first shuffled boss relic", () => {
    let s = run("RUNSEED");
    const expected = s.run.pools.bossRelics[0]!;
    s = advance(s, { cmd: "neowPick", i: 3 }, bundle);
    expect(s.run.relics.map((r) => r.defId)).toEqual([expected]);
    expect(s.run.pools.bossRelics.length).toBe(7);
  });

  test("REMOVE_CARD opens a deck choice; choosing removes the card", () => {
    let s = run("RUNSEED");
    s = advance(s, { cmd: "neowPick", i: 0 }, bundle);
    expect(s.pending).not.toBeNull();
    expect(s.pending!.request.kind).toBe("cards");
    s = advance(s, { cmd: "choose", indices: [0] }, bundle);
    expect(s.run.deck.length).toBe(9);
    expect(s.run.room!.kind).toBe("map");
  });

  test("NO_GOLD + RANDOM_COLORLESS_2: gold zeroed, 3 distinct rare colorless offered", () => {
    let s = run("RUNSEED");
    s = advance(s, { cmd: "neowPick", i: 2 }, bundle);
    expect(s.run.gold).toBe(0);
    const room = s.run.room!;
    if (room.kind !== "rewards") throw new Error("expected rewards screen");
    const cards = room.entries.filter((e) => e.kind === "card");
    expect(cards.length).toBe(3);
    for (const c of cards) {
      if (c.kind !== "card") continue;
      expect(c.rarity).toBe("rare");
      expect(bundle.cards.get(c.id)!.color).toBe("colorless");
    }
    expect(new Set(cards.map((c) => (c.kind === "card" ? c.id : ""))).size).toBe(3);
    // take one card: whole group is consumed
    const deckBefore = s.run.deck.length;
    s = advance(s, { cmd: "takeReward", i: 0 }, bundle);
    expect(s.run.deck.length).toBe(deckBefore + 1);
    const after = s.run.room!;
    if (after.kind !== "rewards") throw new Error("still rewards");
    expect(after.entries.every((e) => e.taken)).toBe(true);
    s = advance(s, { cmd: "skipRewards" }, bundle);
    expect(s.run.room!.kind).toBe("map");
  });
});

describe("map flow", () => {
  test("mapPick validates moves and resolves rooms; floor streams reseed per floor", () => {
    let s = run("MAPF");
    s = advance(s, { cmd: "neowPick", i: 1 }, bundle);
    const row5x = s.run.map!.rows[5]!.findIndex((n) => n !== null);
    expect(() => advance(s, { cmd: "mapPick", x: row5x, y: 5 }, bundle)).toThrow("must start on row 0");
    const row0 = s.run.map!.rows[0]!;
    const x = row0.findIndex((n) => n !== null);
    s = advance(s, { cmd: "mapPick", x, y: 0 }, bundle);
    expect(s.run.floor).toBe(1);
    expect(s.run.position).toEqual([x, 0]);
    // row 0 is always a monster fight
    expect(s.run.room!.kind).toBe("combat");
    expect(s.combat).not.toBeNull();
    // floor streams were reseeded for floor 1 (fresh Rng, then combat setup consumed some)
    const reg = RngRegistry.fromState(s.rng);
    expect(reg.seed).toBe(seedFromString("MAPF"));
  });

  test("combat victory produces a rewards screen; gold/card claimable; skip returns to map", () => {
    let s = run("VICT");
    s = advance(s, { cmd: "neowPick", i: 1 }, bundle);
    const x = s.run.map!.rows[0]!.findIndex((n) => n !== null);
    s = advance(s, { cmd: "mapPick", x, y: 0 }, bundle);
    s = autoWinCombat(s, bundle);
    expect(s.combat).toBeNull();
    const room = s.run.room!;
    if (room.kind !== "rewards") throw new Error("expected rewards");
    expect(room.source).toBe("monster");
    const goldIdx = room.entries.findIndex((e) => e.kind === "gold");
    const gold = room.entries[goldIdx]!;
    if (gold.kind !== "gold") throw new Error("no gold");
    expect(gold.amount).toBeGreaterThanOrEqual(10);
    expect(gold.amount).toBeLessThanOrEqual(20);
    const before = s.run.gold;
    s = advance(s, { cmd: "takeReward", i: goldIdx }, bundle);
    expect(s.run.gold).toBe(before + gold.amount);
    expect(() => advance(s, { cmd: "takeReward", i: goldIdx }, bundle)).toThrow("already taken");
    const roomAfterGold = s.run.room!;
    const cardIdx = roomAfterGold.kind === "rewards" ? roomAfterGold.entries.findIndex((e) => e.kind === "card" && !e.taken) : -1;
    const deckBefore = s.run.deck.length;
    s = advance(s, { cmd: "takeReward", i: cardIdx }, bundle);
    expect(s.run.deck.length).toBe(deckBefore + 1);
    s = advance(s, { cmd: "skipRewards" }, bundle);
    expect(s.run.room!.kind).toBe("map");
    expect(s.run.history.combatsThisAct).toBe(1);
  });

  test("player death in a run sets outcome and gameOver room", () => {
    let s = run("DEATH");
    s.run.hp = 1;
    s.run.maxHp = 1; // survivable-by-nothing
    s = advance(s, { cmd: "neowPick", i: 1 }, bundle);
    const x = s.run.map!.rows[0]!.findIndex((n) => n !== null);
    s = advance(s, { cmd: "mapPick", x, y: 0 }, bundle);
    let guard = 0;
    while (!s.outcome && guard++ < 40) s = advance(s, { cmd: "endTurn" }, bundle);
    expect(s.outcome?.kind).toBe("death");
    expect(s.run.room!.kind).toBe("gameOver");
  });
});

describe("? room resolution", () => {
  function freshCtx(seed: string) {
    const s = run(seed);
    return { s, ...makeTestCtx(s, bundle) };
  }

  test("thresholds use int(chance*100); chosen resets, others escalate", () => {
    for (let i = 0; i < 30; i++) {
      const { s, ctx } = freshCtx(`U${i}`);
      const before = { ...s.run.blizzard };
      const outcome = resolveUnknownRoom(ctx);
      const b = s.run.blizzard;
      expect(Math.abs(b.monsterChance - (outcome === "monster" ? 0.1 : before.monsterChance + 0.1))).toBeLessThan(1e-6);
      expect(Math.abs(b.shopChance - (outcome === "shop" ? 0.03 : before.shopChance + 0.03))).toBeLessThan(1e-6);
      expect(Math.abs(b.treasureChance - (outcome === "treasure" ? 0.02 : before.treasureChance + 0.02))).toBeLessThan(1e-6);
    }
  });

  test("escalation drives outcomes: monsterChance 1.0 forces MONSTER", () => {
    const { s, ctx } = freshCtx("UF");
    s.run.blizzard.monsterChance = 1.0;
    expect(resolveUnknownRoom(ctx)).toBe("monster");
    expect(s.run.blizzard.monsterChance).toBeCloseTo(0.1, 6);
  });

  test("lastRoomWasShop removes the shop share", () => {
    const { s, ctx } = freshCtx("USHOP");
    s.run.blizzard.monsterChance = 0;
    s.run.blizzard.shopChance = 1.0;
    s.run.blizzard.treasureChance = 0;
    s.run.history.lastRoomWasShop = true;
    expect(resolveUnknownRoom(ctx)).toBe("event"); // shop share suppressed
    const { s: s2, ctx: ctx2 } = freshCtx("USHOP");
    s2.run.blizzard.monsterChance = 0;
    s2.run.blizzard.shopChance = 1.0;
    s2.run.blizzard.treasureChance = 0;
    expect(resolveUnknownRoom(ctx2)).toBe("shop");
  });

  test("Tiny Chest forces every 4th ? room to treasure without consuming the roll", () => {
    const { s, ctx, registry } = freshCtx("TINY");
    s.run.relics.push({ defId: "TINY_CHEST", counter: 0 });
    s.run.history.tinyChestCounter = 3;
    const counterBefore = registry.get("eventRng").counter;
    expect(resolveUnknownRoom(ctx)).toBe("treasure");
    expect(registry.get("eventRng").counter).toBe(counterBefore); // bypassed
    expect(s.run.history.tinyChestCounter).toBe(0);
    expect(s.run.blizzard.treasureChance).toBeCloseTo(0.02, 6); // reset as "chosen"
  });

  test("Juzu Bracelet converts MONSTER to EVENT (monster chance still resets)", () => {
    const { s, ctx } = freshCtx("JUZU");
    s.run.relics.push({ defId: "JUZU_BRACELET", counter: 0 });
    s.run.blizzard.monsterChance = 1.0;
    expect(resolveUnknownRoom(ctx)).toBe("event");
    expect(s.run.blizzard.monsterChance).toBeCloseTo(0.1, 6);
  });

  test("event selection runs on an eventRng COPY and removes the pick from its pool", () => {
    const { s, ctx, registry } = freshCtx("EVSEL");
    const counterBefore = registry.get("eventRng").counter;
    const poolBefore = [...s.run.pools.eventList, ...s.run.pools.shrineList, ...s.run.pools.oneTimeEventList];
    const id = generateEventId(ctx);
    expect(id).not.toBeNull();
    expect(poolBefore).toContain(id!);
    expect(registry.get("eventRng").counter).toBe(counterBefore); // main stream untouched
    const poolAfter = [...s.run.pools.eventList, ...s.run.pools.shrineList, ...s.run.pools.oneTimeEventList];
    expect(poolAfter.length).toBe(poolBefore.length - 1);
    expect(poolAfter).not.toContain(id!);
  });

  test("shrine chance constant", () => {
    expect(UNKNOWN_ROOM.base).toEqual({ monster: 0.1, shop: 0.03, treasure: 0.02 });
  });
});

describe("rooms: rest / treasure / shop / event stubs", () => {
  function forceRoom(seed: string, room: (ctx: ReturnType<typeof makeTestCtx>["ctx"]) => void): GameState {
    let s = run(seed);
    s = advance(s, { cmd: "neowPick", i: 1 }, bundle);
    const { ctx, saveRng } = makeTestCtx(s, bundle);
    room(ctx);
    saveRng();
    return s;
  }

  test("rest heals floor(30% max HP); one use per site", () => {
    let s = forceRoom("REST", (ctx) => {
      ctx.run.room = { kind: "rest", used: false };
    });
    s.run.hp = 100;
    const maxHp = s.run.maxHp; // Neow's bonus may have raised it
    const expected = Math.min(maxHp, 100 + restHealAmount(maxHp));
    s = advance(s, { cmd: "restOption", kind: "rest" }, bundle);
    expect(s.run.hp).toBe(expected);
    expect(restHealAmount(maxHp)).toBe(Math.floor(maxHp * 0.3));
    expect(() => advance(s, { cmd: "restOption", kind: "rest" }, bundle)).toThrow("already used");
    s = advance(s, { cmd: "proceed" }, bundle);
    expect(s.run.room!.kind).toBe("map");
  });

  // Issue #7: the option list was hardcoded, so five relics that change what a
  // campfire offers did nothing. Availability follows the reference's bitset.
  describe("relics that change the campfire", () => {
    const atRest = (seed: string, relics: string[]): GameState => {
      const s = forceRoom(seed, (ctx) => {
        ctx.run.room = { kind: "rest", used: false };
      });
      for (const defId of relics) s.run.relics.push({ defId, counter: 0 });
      return s;
    };

    test("Coffee Dripper removes Rest; Fusion Hammer removes Smith", () => {
      const dripper = atRest("DRIP", ["COFFEE_DRIPPER"]);
      expect(() => advance(dripper, { cmd: "restOption", kind: "rest" }, bundle)).toThrow("not available");
      // smithing still works for it
      expect(advance(dripper, { cmd: "restOption", kind: "smith", deckIdx: 0 }, bundle).run.deck[0]!.upgrades).toBe(1);

      const hammer = atRest("HAMMER", ["FUSION_HAMMER"]);
      expect(() => advance(hammer, { cmd: "restOption", kind: "smith", deckIdx: 0 }, bundle)).toThrow("not available");
      expect(advance(hammer, { cmd: "restOption", kind: "rest" }, bundle).run.room).toEqual({ kind: "rest", used: true });
    });

    test("Girya banks a lift, three times and no more", () => {
      let s = atRest("GIRYA1", ["GIRYA"]);
      const girya = () => s.run.relics.find((r) => r.defId === "GIRYA")!;
      for (let i = 1; i <= 3; i++) {
        s = advance(s, { cmd: "restOption", kind: "lift" }, bundle);
        expect(girya().counter).toBe(i);
        s.run.room = { kind: "rest", used: false }; // next campfire
      }
      expect(() => advance(s, { cmd: "restOption", kind: "lift" }, bundle)).toThrow("not available");
      expect(girya().counter).toBe(3);
    });

    test("Shovel digs up a relic from the pool", () => {
      const s = atRest("DIG", ["SHOVEL"]);
      const before = s.run.relics.length;
      const out = advance(s, { cmd: "restOption", kind: "dig" }, bundle);
      expect(out.run.relics.length).toBe(before + 1);
      expect(out.run.room).toEqual({ kind: "rest", used: true });
    });

    test("Peace Pipe removes the chosen card and spends the site", () => {
      const s = atRest("TOKE", ["PEACE_PIPE"]);
      const size = s.run.deck.length;
      const removed = s.run.deck[1]!.defId;
      let out = advance(s, { cmd: "restOption", kind: "toke" }, bundle);
      expect(out.pending).not.toBeNull(); // it asks which card
      out = advance(out, { cmd: "choose", indices: [1] }, bundle);
      expect(out.run.deck.length).toBe(size - 1);
      expect(out.run.deck.filter((c) => c.defId === removed).length).toBeLessThan(
        s.run.deck.filter((c) => c.defId === removed).length,
      );
      expect(out.run.room).toEqual({ kind: "rest", used: true });
    });

    test("without the relics none of the extra options exist", () => {
      const s = atRest("PLAIN", []);
      for (const kind of ["lift", "toke", "dig"] as const) {
        expect(() => advance(s, { cmd: "restOption", kind }, bundle)).toThrow("not available");
      }
    });
  });

  test("smith upgrades a card; upgraded cards cannot smith again", () => {
    let s = forceRoom("SMITH", (ctx) => {
      ctx.run.room = { kind: "rest", used: false };
    });
    s = advance(s, { cmd: "restOption", kind: "smith", deckIdx: 0 }, bundle);
    expect(s.run.deck[0]!.upgrades).toBe(1);
    let s2 = forceRoom("SMITH2", (ctx) => {
      ctx.run.room = { kind: "rest", used: false };
    });
    s2.run.deck[0]!.upgrades = 1;
    expect(() => advance(s2, { cmd: "restOption", kind: "smith", deckIdx: 0 }, bundle)).toThrow("cannot be upgraded");
  });

  test("treasure: openChest awards gold+relic; takeSapphireKey takes the key instead", () => {
    let s = forceRoom("CHESTO", (ctx) => {
      ctx.run.room = { kind: "treasure", chest: setupTreasureRoom(ctx) };
    });
    const relicsBefore = s.run.relics.length;
    s = advance(s, { cmd: "openChest" }, bundle);
    expect(s.run.relics.length).toBe(relicsBefore + 1);
    expect(() => advance(s, { cmd: "openChest" }, bundle)).toThrow("already opened");

    let s2 = forceRoom("CHESTK", (ctx) => {
      ctx.run.room = { kind: "treasure", chest: setupTreasureRoom(ctx) };
    });
    const relicsBefore2 = s2.run.relics.length;
    s2 = advance(s2, { cmd: "takeSapphireKey" }, bundle);
    expect(s2.run.keys.sapphire).toBe(true);
    expect(s2.run.relics.length).toBe(relicsBefore2);
  });

  test("shop: buy card/relic/potion, gold checks, removal escalation across visits", () => {
    let s = forceRoom("SHOPC", (ctx) => {
      ctx.run.room = { kind: "shop", shop: generateShop(ctx) };
    });
    s.run.gold = 5000;
    const room = s.run.room!;
    if (room.kind !== "shop") throw new Error("not shop");
    const cardPrice = room.shop.cards[0]!.price;
    const deckBefore = s.run.deck.length;
    s = advance(s, { cmd: "shopBuy", kind: "card", idx: 0 }, bundle);
    expect(s.run.gold).toBe(5000 - cardPrice);
    expect(s.run.deck.length).toBe(deckBefore + 1);
    expect(() => advance(s, { cmd: "shopBuy", kind: "card", idx: 0 }, bundle)).toThrow("unavailable");

    s = advance(s, { cmd: "shopBuy", kind: "relic", idx: 2 }, bundle);
    expect(s.run.relics.some((r) => r.defId.startsWith("T_RELIC_S_"))).toBe(true); // SHOP tier slot

    s = advance(s, { cmd: "shopBuy", kind: "potion", idx: 0 }, bundle);
    expect(s.run.potions.filter((p) => p !== null).length).toBe(1);

    // removal
    const shopRoom = s.run.room!;
    if (shopRoom.kind !== "shop") throw new Error("not shop");
    expect(shopRoom.shop.removalCost).toBe(75);
    s = advance(s, { cmd: "shopRemove", deckIdx: 0 }, bundle);
    expect(s.run.history.cardRemovesPurchased).toBe(1);
    expect(() => advance(s, { cmd: "shopRemove", deckIdx: 0 }, bundle)).toThrow("already used");

    // a later shop prices removal at 100
    const { ctx, saveRng } = makeTestCtx(s, bundle);
    ctx.run.room = { kind: "shop", shop: generateShop(ctx) };
    saveRng();
    const later = s.run.room!;
    if (later.kind !== "shop") throw new Error("not shop");
    expect(later.shop.removalCost).toBe(100);
  });

  test("shop with empty gold refuses purchases", () => {
    let s = forceRoom("SHOPP", (ctx) => {
      ctx.run.room = { kind: "shop", shop: generateShop(ctx) };
    });
    s.run.gold = 0;
    expect(() => advance(s, { cmd: "shopBuy", kind: "card", idx: 0 }, bundle)).toThrow("not enough gold");
  });

  // Real events live in src/content/events (tests/content/events.test.ts); the
  // run test bundle's fake event ids exercise the leave-only fallback path.
  test("event rooms with unknown event ids fall back to a single leave option (roll consumption stays exact)", () => {
    let s = forceRoom("EVSTUB", (ctx) => {
      ctx.run.room = { kind: "event", eventId: generateEventId(ctx) };
    });
    s = advance(s, { cmd: "eventOption", i: 0 }, bundle);
    expect(s.run.room!.kind).toBe("map");
  });
});

describe("potions", () => {
  test("usePotion consumes the slot; discardPotion clears it", () => {
    let s = run("POTU");
    s.run.potions[0] = "T_POT_C_A";
    s.run.potions[1] = "T_POT_U_A";
    s = advance(s, { cmd: "usePotion", slot: 0 }, bundle);
    expect(s.run.potions[0]).toBeNull();
    s = advance(s, { cmd: "discardPotion", slot: 1 }, bundle);
    expect(s.run.potions[1]).toBeNull();
    expect(() => advance(s, { cmd: "usePotion", slot: 0 }, bundle)).toThrow("no potion");
  });
});

describe("act transitions", () => {
  test("boss victory: boss rewards + 3-relic choice, then act 2 with counter jump and resets", () => {
    let s = run("ACTS");
    s = walkUntil(s, bundle, (st) => st.run.room!.kind === "rewards" && st.run.room!.source === "boss");
    const room = s.run.room!;
    if (room.kind !== "rewards") throw new Error("not rewards");
    const gold = room.entries.find((e) => e.kind === "gold");
    if (!gold || gold.kind !== "gold") throw new Error("no boss gold");
    expect(gold.amount).toBeGreaterThanOrEqual(95);
    expect(gold.amount).toBeLessThanOrEqual(105);
    expect(room.entries.filter((e) => e.kind === "bossRelic").length).toBe(3);
    expect(room.entries.filter((e) => e.kind === "card").length).toBe(3); // act 1 -> rare card reward exists
    // boss chest floor bump already applied
    expect(s.run.floor).toBe(17);

    // take one boss relic: the whole group closes
    const relicIdx = room.entries.findIndex((e) => e.kind === "bossRelic");
    s = advance(s, { cmd: "takeReward", i: relicIdx }, bundle);
    const after = s.run.room!;
    if (after.kind !== "rewards") throw new Error("not rewards");
    expect(after.entries.filter((e) => e.kind === "bossRelic").every((e) => e.taken)).toBe(true);

    // dirty the counters/chances so the reset is observable
    expect(s.rng.run.cardRng.counter).toBeLessThan(250);
    s = advance(s, { cmd: "skipRewards" }, bundle);
    expect(s.run.act).toBe(2);
    expect(s.rng.run.cardRng.counter).toBe(250); // the documented counter JUMP
    expect(s.run.position).toBeNull();
    expect(s.run.map!.act).toBe(2);
    expect(s.run.blizzard.potionChance).toBe(0);
    expect(s.run.blizzard.monsterChance).toBeCloseTo(0.1, 6);
    expect(s.run.pools.monsterList.every((e) => e.startsWith("A2_"))).toBe(true);
    expect(s.run.pools.eliteList.every((e) => e.startsWith("A2_"))).toBe(true);
    expect([...s.run.pools.bossList].sort()).toEqual(["A2_BOSS_1", "A2_BOSS_2", "A2_BOSS_3"]);
    expect(s.run.hp).toBe(s.run.maxHp); // full heal below A5
    expect(s.run.history.combatsThisAct).toBe(0);
  });

  test("A5 heals only 75% of missing HP at the transition", () => {
    let s = run("ACT5", 5);
    s = walkUntil(s, bundle, (st) => st.run.room!.kind === "rewards" && st.run.room!.source === "boss");
    s.run.hp = 500; // force a known missing-HP amount
    const expected = 500 + Math.round((s.run.maxHp - 500) * 0.75);
    s = advance(s, { cmd: "skipRewards" }, bundle);
    expect(s.run.act).toBe(2);
    expect(s.run.hp).toBe(expected);
  });

  test("act 3 boss victory ends the run as a victory (Act 4 TODO)", () => {
    let s = run("WINNER");
    s = walkUntil(s, bundle, (st) => st.outcome?.kind === "victory");
    expect(s.run.act).toBe(3);
    expect(s.run.room!.kind).toBe("gameOver");
    if (s.run.room!.kind === "gameOver") expect(s.run.room!.victory).toBe(true);
    expect(() => advance(s, { cmd: "proceed" }, bundle)).toThrow("game is over");
  });

  test("boss door: mapPick to y=15 requires standing on the top rest row", () => {
    let s = run("BOSSD");
    s = advance(s, { cmd: "neowPick", i: 1 }, bundle);
    expect(() => advance(s, { cmd: "mapPick", x: 3, y: MAP_HEIGHT }, bundle)).toThrow("not reachable");
    s = walkUntil(s, bundle, (st) => st.run.room!.kind === "map" && st.run.position?.[1] === MAP_HEIGHT - 1);
    s = advance(s, { cmd: "mapPick", x: 3, y: MAP_HEIGHT }, bundle);
    const room = s.run.room!;
    if (room.kind !== "combat") throw new Error("expected boss combat");
    expect(room.roomKind).toBe("boss");
    expect(room.encounterId).toBe(s.run.map!.bossId);
  });
});
