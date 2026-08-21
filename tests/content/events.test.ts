// Per-event outcome tests against data/corpus/events.json: exact gold/HP/deck/
// relic deltas, A15 variants, requires-gating. Driver: createRun, then inject
// run.room = {kind:"event", eventId} (legitimate test surgery on plain state)
// and fire the def's onEnter through a live ctx, exactly like room entry does.

import { test, expect, describe } from "bun:test";
import { createRun, advance, type GameState } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content/index";
import { makeTestCtx } from "../run/runCtx";
import { RngRegistry } from "../../src/engine/core/rngRegistry";
import type { EventRoomData, RoomState } from "../../src/engine/run/runState";
import eventsCorpus from "../../data/corpus/events.json";

const bundle = buildBaseContentBundle();

describe("events vs corpus", () => {
  test("all 51 corpus events are implemented with exact id/name/pool", () => {
    const corpus = (eventsCorpus as { events: { id: string; name: string; pool: string }[] }).events;
    expect(corpus.length).toBe(51);
    const problems: string[] = [];
    for (const c of corpus) {
      const def = bundle.events.get(c.id);
      if (!def) {
        problems.push(`${c.id}: missing`);
        continue;
      }
      if (def.name !== c.name) problems.push(`${c.id}.name: got ${def.name}, corpus ${c.name}`);
      if (def.pool !== c.pool) problems.push(`${c.id}.pool: got ${def.pool}, corpus ${c.pool}`);
    }
    expect(problems).toEqual([]);
    // nothing beyond the corpus
    const unknown = [...bundle.events.keys()].filter((id) => !corpus.some((c) => c.id === id));
    expect(unknown).toEqual([]);
    const pools = { act1: 0, act2: 0, act3: 0, shrine: 0, oneTime: 0 } as Record<string, number>;
    for (const e of bundle.events.values()) pools[e.pool] = (pools[e.pool] ?? 0) + 1;
    expect(pools).toEqual({ act1: 11, act2: 13, act3: 7, shrine: 6, oneTime: 14 });
  });
});

function forceEvent(
  seed: string,
  eventId: string,
  opts?: { ascension?: number; mutate?: (s: GameState) => void; skipOnEnter?: boolean },
): GameState {
  const s = createRun({ seed, bundle, character: "IRONCLAD", ascension: opts?.ascension });
  opts?.mutate?.(s);
  s.run.room = { kind: "event", eventId };
  if (!opts?.skipOnEnter) {
    const { ctx, saveRng } = makeTestCtx(s, bundle);
    bundle.events.get(eventId)?.onEnter?.(ctx);
    saveRng();
  }
  return s;
}

/** autoWinCombat, but tolerant of play-blocking powers (Entangled etc.). */
function winCombat(s: GameState): GameState {
  let guard = 0;
  while (s.combat && !s.outcome) {
    if (guard++ > 600) throw new Error("winCombat stuck");
    const target = s.combat.monsters.findIndex((m) => !m.isDead && !m.isEscaped);
    const energy = s.combat.player.energy;
    const atkIdx = s.combat.player.piles.hand.findIndex((iid) => {
      const def = bundle.cards.get(s.combat!.cards[iid]!.defId)!;
      return def.type === "attack" && def.cost >= 0 && def.cost <= energy;
    });
    if (atkIdx !== -1 && target !== -1) {
      try {
        s = advance(s, { cmd: "playCard", handIdx: atkIdx, target }, bundle);
        continue;
      } catch {
        // blocked (e.g. Entangled): fall through to end turn
      }
    }
    s = advance(s, { cmd: "endTurn" }, bundle);
  }
  return s;
}

const pick = (s: GameState, i: number): GameState => advance(s, { cmd: "eventOption", i }, bundle);
const choose = (s: GameState, indices: number[]): GameState => advance(s, { cmd: "choose", indices }, bundle);
const roomOf = (s: GameState): RoomState => s.run.room!;
const dataOf = (s: GameState): EventRoomData => (roomOf(s) as Extract<RoomState, { kind: "event" }>).data ?? {};
const relicIds = (s: GameState): string[] => s.run.relics.map((r) => r.defId);
const deckIds = (s: GameState): string[] => s.run.deck.map((c) => c.defId);
const boost = (s: GameState): void => {
  s.run.maxHp = 999;
  s.run.hp = 999;
};

// Ironclad baseline: 80/80 HP, 99 gold, deck = 5x STRIKE_RED, 4x DEFEND_RED, BASH.

describe("act 1 events", () => {
  test("Big Fish: banana heals floor(maxHp/3); donut +5 max HP (and heals); box relic + Regret", () => {
    let s = forceEvent("BF1", "BIG_FISH", { mutate: (g) => (g.run.hp = 40) });
    s = pick(s, 0);
    expect(s.run.hp).toBe(40 + 26);
    expect(roomOf(s).kind).toBe("map");

    let d = forceEvent("BF2", "BIG_FISH");
    d = pick(d, 1);
    expect(d.run.maxHp).toBe(85);
    expect(d.run.hp).toBe(85);

    let b = forceEvent("BF3", "BIG_FISH");
    const poolBefore = b.run.pools.commonRelics.length + b.run.pools.uncommonRelics.length + b.run.pools.rareRelics.length;
    b = pick(b, 2);
    expect(b.run.relics.length).toBe(2);
    expect(deckIds(b)).toContain("REGRET");
    const poolAfter = b.run.pools.commonRelics.length + b.run.pools.uncommonRelics.length + b.run.pools.rareRelics.length;
    expect(poolAfter).toBeLessThan(poolBefore);
  });

  test("The Cleric: heal 35g/25%; purify 50g (75 at A15) removes a chosen card; gold gating", () => {
    let s = forceEvent("CL1", "THE_CLERIC", { mutate: (g) => (g.run.hp = 50) });
    s = pick(s, 0);
    expect(s.run.gold).toBe(64);
    expect(s.run.hp).toBe(70); // +floor(80*0.25)

    let p = forceEvent("CL2", "THE_CLERIC");
    p = pick(p, 1);
    expect(p.run.gold).toBe(49);
    expect(p.pending?.request.kind).toBe("cards");
    p = choose(p, [0]);
    expect(p.run.deck.length).toBe(9);
    expect(roomOf(p).kind).toBe("map");

    let a = forceEvent("CL3", "THE_CLERIC", { ascension: 15 });
    a = pick(a, 1);
    expect(a.run.gold).toBe(99 - 75);

    const poor = forceEvent("CL4", "THE_CLERIC", { mutate: (g) => (g.run.gold = 30) });
    expect(() => pick(poor, 0)).toThrow("unavailable");
    expect(() => pick(poor, 1)).toThrow("unavailable");
  });

  test("Dead Adventurer: no-ambush searches grant the shuffled rewards; phase advances", () => {
    for (let i = 0; i < 40; i++) {
      let s = forceEvent(`DAS${i}`, "DEAD_ADVENTURER");
      const rewards = dataOf(s).rewards as string[];
      const goldBefore = s.run.gold;
      const relicsBefore = s.run.relics.length;
      s = pick(s, 0);
      if (roomOf(s).kind !== "event") continue; // ambush - covered below
      expect(dataOf(s).phase).toBe(1);
      if (rewards[0] === "GOLD") expect(s.run.gold).toBe(goldBefore + 30);
      else expect(s.run.gold).toBe(goldBefore);
      if (rewards[0] === "RELIC") expect(s.run.relics.length).toBe(relicsBefore + 1);
      else expect(s.run.relics.length).toBe(relicsBefore);
      return;
    }
    throw new Error("no ambush-free search in 40 seeds");
  });

  test("Dead Adventurer ambush: Lagavulin variant starts awake; victory rewards honor unclaimed loot", () => {
    for (let i = 0; i < 40; i++) {
      let s = forceEvent(`DAA${i}`, "DEAD_ADVENTURER", { mutate: boost });
      const room = roomOf(s) as Extract<RoomState, { kind: "event" }>;
      room.data!.encounter = "LAGAVULIN_EVENT";
      room.data!.phase = 2; // 75% ambush chance
      const remaining = (room.data!.rewards as string[]).slice(2);
      s = pick(s, 0);
      if (roomOf(s).kind !== "combat") continue;
      const combat = roomOf(s) as Extract<RoomState, { kind: "combat" }>;
      expect(combat.encounterId).toBe("LAGAVULIN_EVENT");
      expect(combat.roomKind).toBe("elite");
      expect(combat.eventCombat?.eventId).toBe("DEAD_ADVENTURER");
      const lag = s.combat!.monsters[0]!;
      expect(lag.id).toBe("LAGAVULIN");
      expect(lag.powers.some((p) => p.id === "ASLEEP")).toBe(false); // awake: no preBattle
      expect(lag.block).toBe(0);
      expect(lag.move).not.toBe("LAGAVULIN_SLEEP");

      const elitesBefore = s.run.history.eliteKillsThisAct;
      s = winCombat(s);
      const rw = roomOf(s);
      if (rw.kind !== "rewards") throw new Error("expected rewards");
      expect(rw.source).toBe("event");
      const gold = rw.entries.find((e) => e.kind === "gold");
      if (!gold || gold.kind !== "gold") throw new Error("no gold");
      const bonus = remaining.filter((r) => r === "GOLD").length * 30;
      expect(gold.amount).toBeGreaterThanOrEqual(25 + bonus);
      expect(gold.amount).toBeLessThanOrEqual(35 + bonus);
      expect(rw.entries.some((e) => e.kind === "relic")).toBe(remaining.includes("RELIC"));
      expect(rw.entries.filter((e) => e.kind === "card").length).toBe(3);
      expect(s.run.history.eliteKillsThisAct).toBe(elitesBefore + 1);
      s = advance(s, { cmd: "skipRewards" }, bundle);
      expect(roomOf(s).kind).toBe("map");
      return;
    }
    throw new Error("no ambush in 40 seeds at 75% chance");
  });

  test("Golden Idol: take grants the relic then forces a trap choice; trap outcomes exact", () => {
    let s = forceEvent("GI1", "GOLDEN_IDOL");
    expect(() => pick(s, 2)).toThrow("unavailable"); // traps locked before taking
    s = pick(s, 0);
    expect(relicIds(s)).toContain("GOLDEN_IDOL");
    expect(roomOf(s).kind).toBe("event");
    expect(() => pick(s, 0)).toThrow("unavailable"); // take/leave locked on trap screen
    expect(() => pick(s, 1)).toThrow("unavailable");

    const smash = pick(s, 3);
    expect(smash.run.hp).toBe(80 - 20); // floor(80*0.25)
    const hide = pick(s, 4);
    expect(hide.run.maxHp).toBe(80 - 6); // floor(80*0.08)
    expect(hide.run.hp).toBe(74);
    const outrun = pick(s, 2);
    expect(deckIds(outrun)).toContain("INJURY");

    // A15: smash 35%, hide 10%
    let a = forceEvent("GI2", "GOLDEN_IDOL", { ascension: 15 });
    a = pick(a, 0);
    const aSmash = pick(a, 3);
    expect(aSmash.run.hp).toBe(68 - Math.floor(Math.fround(75 * 0.35)));
  });

  test("Wing Statue: pray 7 damage + removal; destroy gated on a 10+ single-hit attack", () => {
    let s = forceEvent("WS1", "WING_STATUE");
    expect(() => pick(s, 1)).toThrow("unavailable"); // base deck: max single hit is Bash 8
    s = pick(s, 0);
    expect(s.run.hp).toBe(73);
    s = choose(s, [0]);
    expect(s.run.deck.length).toBe(9);

    let d = forceEvent("WS2", "WING_STATUE", {
      mutate: (g) => (g.run.deck[9]!.upgrades = 1), // Bash+ hits for 10
    });
    d = pick(d, 1);
    expect(d.run.gold).toBeGreaterThanOrEqual(99 + 50);
    expect(d.run.gold).toBeLessThanOrEqual(99 + 80);
  });

  test("World of Goop: gather 11 damage/+75 gold; leaving loses the setup-rolled 20-50 (capped)", () => {
    let s = forceEvent("WG1", "WORLD_OF_GOOP");
    const loss = dataOf(s).loss as number;
    expect(loss).toBeGreaterThanOrEqual(20);
    expect(loss).toBeLessThanOrEqual(50);
    const g = pick(s, 0);
    expect(g.run.hp).toBe(69);
    expect(g.run.gold).toBe(174);
    const l = pick(s, 1);
    expect(l.run.gold).toBe(99 - Math.min(99, loss));

    let capped = forceEvent("WG2", "WORLD_OF_GOOP", { mutate: (g2) => (g2.run.gold = 5) });
    capped = pick(capped, 1);
    expect(capped.run.gold).toBe(0);

    const a = forceEvent("WG3", "WORLD_OF_GOOP", { ascension: 15 });
    const aLoss = dataOf(a).loss as number;
    expect(aLoss).toBeGreaterThanOrEqual(35);
    expect(aLoss).toBeLessThanOrEqual(75);
  });

  test("The Ssssserpent: 175 gold + Doubt (150 at A15)", () => {
    let s = forceEvent("SS1", "THE_SSSSSERPENT");
    s = pick(s, 0);
    expect(s.run.gold).toBe(99 + 175);
    expect(deckIds(s)).toContain("DOUBT");
    let a = forceEvent("SS2", "THE_SSSSSERPENT", { ascension: 15 });
    a = pick(a, 0);
    expect(a.run.gold).toBe(99 + 150);
  });

  test("Living Wall: forget/change/grow each alter exactly one card", () => {
    let f = forceEvent("LW1", "LIVING_WALL");
    f = choose(pick(f, 0), [0]);
    expect(f.run.deck.length).toBe(9);

    let c = forceEvent("LW2", "LIVING_WALL");
    c = choose(pick(c, 1), [0]);
    expect(c.run.deck.length).toBe(10);
    expect(deckIds(c).filter((id) => id === "STRIKE_RED").length).toBe(4); // one strike transformed
    const newCard = deckIds(c)[9]!;
    expect(bundle.cards.get(newCard)!.color).toBe("red");

    let u = forceEvent("LW3", "LIVING_WALL");
    u = choose(pick(u, 2), [0]);
    expect(u.run.deck[0]!.upgrades).toBe(1);
  });

  test("Mushrooms: eat heals 25% + Parasite; stomp fights 3 Fungi and rewards Odd Mushroom + 20-30 gold", () => {
    let e = forceEvent("MU1", "HYPNOTIZING_COLORED_MUSHROOMS", { mutate: (g) => (g.run.hp = 40) });
    e = pick(e, 1);
    expect(e.run.hp).toBe(60);
    expect(deckIds(e)).toContain("PARASITE");

    let s = forceEvent("MU2", "HYPNOTIZING_COLORED_MUSHROOMS", { mutate: boost });
    s = pick(s, 0);
    const combat = roomOf(s);
    if (combat.kind !== "combat") throw new Error("expected combat");
    expect(combat.encounterId).toBe("MUSHROOMS_EVENT");
    expect(s.combat!.monsters.map((m) => m.id)).toEqual(["FUNGI_BEAST", "FUNGI_BEAST", "FUNGI_BEAST"]);
    s = winCombat(s);
    const rw = roomOf(s);
    if (rw.kind !== "rewards") throw new Error("expected rewards");
    const gold = rw.entries.find((en) => en.kind === "gold");
    if (!gold || gold.kind !== "gold") throw new Error("no gold");
    expect(gold.amount).toBeGreaterThanOrEqual(20);
    expect(gold.amount).toBeLessThanOrEqual(30);
    expect(rw.entries.some((en) => en.kind === "relic" && en.id === "ODD_MUSHROOM")).toBe(true);
    expect(rw.entries.filter((en) => en.kind === "card").length).toBe(3);
    s = advance(s, { cmd: "skipRewards" }, bundle);
    expect(roomOf(s).kind).toBe("map");
    expect(s.combat).toBeNull();
  });

  test("Scrap Ooze: 3 damage per reach (5 at A15); success grants a relic and ends", () => {
    let s = forceEvent("SO1", "SCRAP_OOZE");
    let reaches = 0;
    while (roomOf(s).kind === "event" && reaches < 20) {
      s = pick(s, 0);
      reaches++;
    }
    expect(roomOf(s).kind).toBe("map");
    expect(s.run.relics.length).toBe(2);
    expect(s.run.hp).toBe(80 - 3 * reaches);

    let a = forceEvent("SO2", "SCRAP_OOZE", { ascension: 15 });
    const hpBefore = a.run.hp;
    a = pick(a, 0);
    expect(a.run.hp).toBe(hpBefore - 5);
  });

  test("Shining Light: round(20% maxHp) damage and 2 random upgrades (30% at A15)", () => {
    let s = forceEvent("SL1", "SHINING_LIGHT");
    s = pick(s, 0);
    expect(s.run.hp).toBe(80 - 16);
    expect(s.run.deck.reduce((n, c) => n + c.upgrades, 0)).toBe(2);
  });
});

describe("act 2 events", () => {
  test("Pleading Vagrant: pay 85 for a relic; rob for relic + Shame; gold gating", () => {
    let s = forceEvent("PV1", "PLEADING_VAGRANT");
    s = pick(s, 0);
    expect(s.run.gold).toBe(14);
    expect(s.run.relics.length).toBe(2);

    let r = forceEvent("PV2", "PLEADING_VAGRANT");
    r = pick(r, 1);
    expect(r.run.relics.length).toBe(2);
    expect(deckIds(r)).toContain("SHAME");

    const poor = forceEvent("PV3", "PLEADING_VAGRANT", { mutate: (g) => (g.run.gold = 50) });
    expect(() => pick(poor, 0)).toThrow("unavailable");
  });

  test("Ancient Writing: simplicity upgrades all 9 starter Strikes/Defends (Bash untouched)", () => {
    let s = forceEvent("AW1", "ANCIENT_WRITING");
    s = pick(s, 1);
    expect(s.run.deck.filter((c) => c.upgrades === 1).length).toBe(9);
    expect(s.run.deck[9]!.upgrades).toBe(0); // BASH

    let e = forceEvent("AW2", "ANCIENT_WRITING");
    e = choose(pick(e, 0), [0]);
    expect(e.run.deck.length).toBe(9);
  });

  test("Old Beggar: 75 gold buys a removal", () => {
    let s = forceEvent("OB1", "OLD_BEGGAR");
    s = choose(pick(s, 0), [2]);
    expect(s.run.gold).toBe(24);
    expect(s.run.deck.length).toBe(9);
  });

  test("Colosseum: forced slaver fight with no rewards (pity advances), then flee or the Nob bout", () => {
    let s = forceEvent("CO1", "COLOSSEUM", { mutate: boost });
    const pityBefore = s.run.blizzard.potionChance;
    s = pick(s, 0);
    const c1 = roomOf(s);
    if (c1.kind !== "combat") throw new Error("expected combat");
    expect(c1.encounterId).toBe("COLOSSEUM_EVENT_SLAVERS");
    expect(s.combat!.monsters.map((m) => m.id)).toEqual(["BLUE_SLAVER", "RED_SLAVER"]);
    s = winCombat(s);
    const back = roomOf(s);
    if (back.kind !== "event") throw new Error("expected event screen after fight 1");
    expect(back.screen).toBe("wonFirst");
    expect(s.run.blizzard.potionChance).toBe(pityBefore + 10); // invisible pity advance
    expect(() => pick(s, 0)).toThrow("unavailable"); // no re-fighting the slavers

    const fled = pick(s, 1);
    expect(roomOf(fled).kind).toBe("map");

    if (bundle.monsters.has("TASKMASTER") && bundle.monsters.has("GREMLIN_NOB")) {
      let v = pick(s, 2);
      const c2 = roomOf(v);
      if (c2.kind !== "combat") throw new Error("expected combat 2");
      expect(c2.encounterId).toBe("COLOSSEUM_EVENT_NOBS");
      expect(c2.roomKind).toBe("elite");
      v = winCombat(v);
      const rw = roomOf(v);
      if (rw.kind !== "rewards") throw new Error("expected rewards");
      const gold = rw.entries.find((en) => en.kind === "gold");
      expect(gold && gold.kind === "gold" ? gold.amount : 0).toBe(100);
      expect(rw.entries.filter((en) => en.kind === "relic").length).toBe(2);
      expect(rw.entries.filter((en) => en.kind === "card").length).toBe(3);
    } else {
      expect(() => pick(s, 2)).toThrow("unavailable"); // content pending guard
    }
  });

  test("Cursed Tome: pages cost 1/2/3 HP; take costs 10 (15 at A15) and offers a book relic; stop costs 3", () => {
    let s = forceEvent("CT1", "CURSED_TOME");
    s = pick(s, 0); // read
    expect(() => pick(s, 2)).toThrow("unavailable"); // can't take early
    s = pick(s, 1);
    s = pick(s, 1);
    s = pick(s, 1);
    expect(s.run.hp).toBe(80 - 6);
    const took = pick(s, 2);
    expect(took.run.hp).toBe(74 - 10);
    const rw = roomOf(took);
    if (rw.kind !== "rewards") throw new Error("expected rewards");
    const relic = rw.entries[0]!;
    if (relic.kind !== "relic") throw new Error("expected relic entry");
    expect(["NECRONOMICON", "ENCHIRIDION", "NILRYS_CODEX"]).toContain(relic.id);
    const stopped = pick(s, 3);
    expect(stopped.run.hp).toBe(74 - 3);
    expect(roomOf(stopped).kind).toBe("map");
  });

  test("Augmenter: J.A.X.; transform 2; Mutagenic Strength", () => {
    let j = forceEvent("AU1", "AUGMENTER");
    j = pick(j, 0);
    expect(deckIds(j)).toContain("JAX");

    let t = forceEvent("AU2", "AUGMENTER");
    t = choose(pick(t, 1), [0, 5]);
    expect(t.run.deck.length).toBe(10);
    expect(deckIds(t).filter((id) => id === "STRIKE_RED").length).toBe(4);
    expect(deckIds(t).filter((id) => id === "DEFEND_RED").length).toBe(3);

    let m = forceEvent("AU3", "AUGMENTER");
    m = pick(m, 2);
    expect(relicIds(m)).toContain("MUTAGENIC_STRENGTH");
  });

  test("Forgotten Altar: idol swap in place; sacrifice +5 max / -25% (pre-gain base); Decay", () => {
    let i = forceEvent("FA1", "FORGOTTEN_ALTAR", { mutate: (g) => g.run.relics.push({ defId: "GOLDEN_IDOL", counter: 0 }) });
    i = pick(i, 0);
    expect(relicIds(i)).toEqual(["BURNING_BLOOD", "BLOODY_IDOL"]);

    let s = forceEvent("FA2", "FORGOTTEN_ALTAR");
    expect(() => pick(s, 0)).toThrow("unavailable"); // no idol
    s = pick(s, 1);
    expect(s.run.maxHp).toBe(85);
    expect(s.run.hp).toBe(85 - 20); // round(80*0.25) computed at setup

    let d = forceEvent("FA3", "FORGOTTEN_ALTAR");
    d = pick(d, 2);
    expect(deckIds(d)).toContain("DECAY");
  });

  test("Council of Ghosts: -50% max HP (capped), 5 Apparitions (3 at A15)", () => {
    let s = forceEvent("GH1", "GHOSTS");
    s = pick(s, 0);
    expect(s.run.maxHp).toBe(40);
    expect(s.run.hp).toBe(40);
    expect(deckIds(s).filter((id) => id === "APPARITION").length).toBe(5);

    let a = forceEvent("GH2", "GHOSTS", { ascension: 15 });
    a = pick(a, 0);
    expect(a.run.maxHp).toBe(75 - 38); // ceil(75*0.5)
    expect(deckIds(a).filter((id) => id === "APPARITION").length).toBe(3);
  });

  test("Masked Bandits: pay drains ALL gold; fight is guarded on act-2 bandits", () => {
    let s = forceEvent("MB1", "MASKED_BANDITS");
    s = pick(s, 0);
    expect(s.run.gold).toBe(0);
    expect(roomOf(s).kind).toBe("map");

    const monstersReady = ["POINTY", "ROMEO", "BEAR"].every((m) => bundle.monsters.has(m));
    let f = forceEvent("MB2", "MASKED_BANDITS", { mutate: boost });
    if (!monstersReady) {
      expect(() => pick(f, 1)).toThrow("unavailable");
      return;
    }
    f = pick(f, 1);
    expect(roomOf(f).kind).toBe("combat");
    f = winCombat(f);
    const rw = roomOf(f);
    if (rw.kind !== "rewards") throw new Error("expected rewards");
    expect(rw.entries.some((e) => e.kind === "relic" && e.id === "RED_MASK")).toBe(true);
    expect(rw.entries.some((e) => e.kind === "potion")).toBe(false); // no potion roll here
  });

  test("The Nest: 99 gold (50 at A15) or 6 damage + Ritual Dagger", () => {
    let s = forceEvent("NE1", "THE_NEST");
    s = pick(s, 0);
    expect(s.run.gold).toBe(99 + 99);
    let a = forceEvent("NE2", "THE_NEST", { ascension: 15 });
    a = pick(a, 0);
    expect(a.run.gold).toBe(99 + 50);
    let d = forceEvent("NE3", "THE_NEST");
    d = pick(d, 1);
    expect(d.run.hp).toBe(74);
    expect(deckIds(d)).toContain("RITUAL_DAGGER");
  });

  test("The Library: 20 distinct class cards, pick 1; sleep heals 33% (20% at A15)", () => {
    let s = forceEvent("LI1", "THE_LIBRARY");
    s = pick(s, 0);
    const req = s.pending!.request;
    if (req.kind !== "option") throw new Error("expected option choice");
    expect(req.options.length).toBe(20);
    expect(new Set(req.options).size).toBe(20);
    const wanted = req.options[7]!;
    s = choose(s, [7]);
    expect(s.run.deck.length).toBe(11);
    const gained = s.run.deck[10]!;
    expect(bundle.cards.get(gained.defId)!.name).toBe(wanted);
    expect(bundle.cards.get(gained.defId)!.color).toBe("red");

    let h = forceEvent("LI2", "THE_LIBRARY", { mutate: (g) => (g.run.hp = 30) });
    h = pick(h, 1);
    expect(h.run.hp).toBe(30 + Math.round(Math.fround(80 * 0.33)));
  });

  test("The Mausoleum: relic always; Writhe guaranteed at A15", () => {
    let a = forceEvent("MA1", "THE_MAUSOLEUM", { ascension: 15 });
    a = pick(a, 0);
    expect(a.run.relics.length).toBe(2);
    expect(deckIds(a)).toContain("WRITHE");

    let s = forceEvent("MA2", "THE_MAUSOLEUM");
    const reg = RngRegistry.fromState(s.rng);
    reg.get("relicRng").randomRange(0, 99); // relic tier roll happens first
    const cursed = reg.get("miscRng").randomBoolean();
    s = pick(s, 0);
    expect(s.run.relics.length).toBe(2);
    expect(deckIds(s).includes("WRITHE")).toBe(cursed);
  });

  test("Vampires: strikes out, 5 Bites in; Blood Vial spares the max HP", () => {
    let s = forceEvent("VA1", "VAMPIRES");
    expect(() => pick(s, 0)).toThrow("unavailable"); // no Blood Vial
    s = pick(s, 1);
    expect(s.run.maxHp).toBe(80 - 24); // ceil(80*0.3)
    expect(deckIds(s).filter((id) => id === "STRIKE_RED").length).toBe(0);
    expect(deckIds(s).filter((id) => id === "BITE").length).toBe(5);
    expect(s.run.deck.length).toBe(10);

    let v = forceEvent("VA2", "VAMPIRES", { mutate: (g) => g.run.relics.push({ defId: "BLOOD_VIAL", counter: 0 }) });
    v = pick(v, 0);
    expect(v.run.maxHp).toBe(80);
    expect(relicIds(v)).not.toContain("BLOOD_VIAL");
    expect(deckIds(v).filter((id) => id === "BITE").length).toBe(5);
  });
});

describe("act 3 events", () => {
  test("Falling: preselected picks per card type; power option disabled without powers", () => {
    const s = forceEvent("FL1", "FALLING");
    const d = dataOf(s);
    expect(d.powerIdx).toBeUndefined(); // base deck has no powers
    expect(() => pick(s, 1)).toThrow("unavailable");
    expect(() => pick(s, 3)).toThrow("unavailable"); // eligible cards exist
    const skillIdx = d.skillIdx as number;
    expect(bundle.cards.get(s.run.deck[skillIdx]!.defId)!.type).toBe("skill");
    const land = pick(s, 0);
    expect(land.run.deck.length).toBe(9);
    const strike = pick(s, 2);
    expect(bundle.cards.get(strike.run.deck.map((c) => c.defId)[0]!)).toBeDefined();
    expect(strike.run.deck.length).toBe(9);
  });

  test("Mindbloom: Awake upgrades everything + Mark of the Bloom; Rich/Healthy floor-gated", () => {
    let s = forceEvent("MI1", "MINDBLOOM");
    s = pick(s, 1);
    expect(s.run.deck.every((c) => c.upgrades === 1)).toBe(true);
    expect(relicIds(s)).toContain("MARK_OF_THE_BLOOM");

    let r = forceEvent("MI2", "MINDBLOOM"); // floor 0 <= 40
    expect(() => pick(r, 3)).toThrow("unavailable");
    r = pick(r, 2);
    expect(r.run.gold).toBe(99 + 999);
    expect(deckIds(r).filter((id) => id === "NORMALITY").length).toBe(2);

    let h = forceEvent("MI3", "MINDBLOOM", { mutate: (g) => ((g.run.floor = 41), (g.run.hp = 10)) });
    expect(() => pick(h, 2)).toThrow("unavailable");
    h = pick(h, 3);
    expect(h.run.hp).toBe(h.run.maxHp);
    expect(deckIds(h)).toContain("DOUBT");
  });

  test("Mindbloom war: an act-1 boss fight that pays event rewards (no act transition)", () => {
    let s = forceEvent("MI4", "MINDBLOOM", { mutate: boost });
    s = pick(s, 0);
    const c = roomOf(s);
    if (c.kind !== "combat") throw new Error("expected combat");
    expect(["THE_GUARDIAN", "HEXAGHOST", "SLIME_BOSS"]).toContain(c.encounterId);
    expect(c.roomKind).toBe("monster"); // never the boss path
    s = winCombat(s);
    const rw = roomOf(s);
    if (rw.kind !== "rewards") throw new Error("expected rewards");
    expect(rw.source).toBe("event");
    const gold = rw.entries.find((e) => e.kind === "gold");
    expect(gold && gold.kind === "gold" ? gold.amount : 0).toBe(50);
    expect(rw.entries.some((e) => e.kind === "relic")).toBe(true);
    expect(s.run.act).toBe(1); // no transition
    s = advance(s, { cmd: "skipRewards" }, bundle);
    expect(roomOf(s).kind).toBe("map");
  });

  test("Moai Head: -12.5% max HP then full heal (zeroed by Mark of the Bloom); idol pays 333", () => {
    let s = forceEvent("MO1", "THE_MOAI_HEAD", { mutate: (g) => (g.run.hp = 20) });
    s = pick(s, 0);
    expect(s.run.maxHp).toBe(70);
    expect(s.run.hp).toBe(70);

    let m = forceEvent("MO2", "THE_MOAI_HEAD", {
      mutate: (g) => ((g.run.hp = 20), g.run.relics.push({ defId: "MARK_OF_THE_BLOOM", counter: 0 })),
    });
    m = pick(m, 0);
    expect(m.run.maxHp).toBe(70);
    expect(m.run.hp).toBe(20); // heal folded to 0

    let i = forceEvent("MO3", "THE_MOAI_HEAD", { mutate: (g) => g.run.relics.push({ defId: "GOLDEN_IDOL", counter: 0 }) });
    i = pick(i, 1);
    expect(i.run.gold).toBe(99 + 333);
    expect(relicIds(i)).not.toContain("GOLDEN_IDOL");
  });

  test("Mysterious Sphere: 2 Orb Walkers guard a rare relic + 45-55 gold", () => {
    let s = forceEvent("MS1", "MYSTERIOUS_SPHERE", { mutate: boost });
    if (!bundle.monsters.has("ORB_WALKER")) {
      expect(() => pick(s, 0)).toThrow("unavailable");
      const l = pick(s, 1);
      expect(roomOf(l).kind).toBe("map");
      return;
    }
    s = pick(s, 0);
    s = winCombat(s);
    const rw = roomOf(s);
    if (rw.kind !== "rewards") throw new Error("expected rewards");
    const gold = rw.entries.find((e) => e.kind === "gold");
    if (!gold || gold.kind !== "gold") throw new Error("no gold");
    expect(gold.amount).toBeGreaterThanOrEqual(45);
    expect(gold.amount).toBeLessThanOrEqual(55);
    expect(rw.entries.some((e) => e.kind === "relic")).toBe(true);
  });

  test("Sensory Stone: N colorless card rewards for 0/5/10 HP", () => {
    let s = forceEvent("ST1", "SENSORY_STONE");
    s = pick(s, 1);
    expect(s.run.hp).toBe(75);
    const rw = roomOf(s);
    if (rw.kind !== "rewards") throw new Error("expected rewards");
    const cards = rw.entries.filter((e) => e.kind === "card");
    expect(cards.length).toBe(6); // 2 groups of 3
    expect(new Set(cards.map((e) => (e.kind === "card" ? e.group : -1))).size).toBe(2);
    for (const e of cards) {
      if (e.kind === "card") expect(bundle.cards.get(e.id)!.color).toBe("colorless");
    }
    // taking one card closes only its group
    const firstIdx = rw.entries.findIndex((e) => e.kind === "card");
    s = advance(s, { cmd: "takeReward", i: firstIdx }, bundle);
    const after = roomOf(s);
    if (after.kind !== "rewards") throw new Error("still rewards");
    expect(after.entries.filter((e) => e.kind === "card" && !e.taken).length).toBe(3);
  });

  test("Tomb of Lord Red Mask: buying the mask costs everything; wearing it pays 222", () => {
    let s = forceEvent("TO1", "TOMB_OF_LORD_RED_MASK");
    expect(() => pick(s, 0)).toThrow("unavailable");
    s = pick(s, 1);
    expect(s.run.gold).toBe(0);
    expect(relicIds(s)).toContain("RED_MASK");

    let m = forceEvent("TO2", "TOMB_OF_LORD_RED_MASK", { mutate: (g) => g.run.relics.push({ defId: "RED_MASK", counter: 0 }) });
    m = pick(m, 0);
    expect(m.run.gold).toBe(99 + 222);
  });

  test("Winding Halls: madness/press on/retrace deltas exact", () => {
    let s = forceEvent("WH1", "WINDING_HALLS");
    s = pick(s, 0);
    expect(s.run.hp).toBe(80 - 10); // round(80*0.125)
    expect(deckIds(s).filter((id) => id === "MADNESS").length).toBe(2);

    let p = forceEvent("WH2", "WINDING_HALLS", { mutate: (g) => (g.run.hp = 40) });
    p = pick(p, 1);
    expect(p.run.hp).toBe(60);
    expect(deckIds(p)).toContain("WRITHE");

    let r = forceEvent("WH3", "WINDING_HALLS");
    r = pick(r, 2);
    expect(r.run.maxHp).toBe(76); // round(80*0.05)
  });
});

describe("shrines", () => {
  test("Match and Keep: matched pair joins the deck; 5 attempts then the event ends", () => {
    let s = forceEvent("MK1", "MATCH_AND_KEEP");
    const d = dataOf(s);
    const board = d.board as number[];
    const cards = d.cards as (string | null)[];
    expect(board.length).toBe(12);
    expect(new Set(board).size).toBe(6);
    const slotsOf = (poolIdx: number): number[] => board.map((p, i) => (p === poolIdx ? i : -1)).filter((i) => i !== -1);
    // match the class starter pair (pool slot 5, always present = BASH)
    const [a, b] = slotsOf(5);
    expect(cards[5]).toBe("BASH");
    s = pick(s, a!);
    s = pick(s, b!);
    expect(deckIds(s).filter((id) => id === "BASH").length).toBe(2);
    expect((dataOf(s).attempts as number)).toBe(1);
    // burn the remaining 4 attempts on deliberate mismatches
    for (let k = 0; k < 4; k++) {
      const first = slotsOf(0)[0]!;
      const second = slotsOf(1)[0]!;
      s = pick(s, first);
      s = pick(s, second);
      if (roomOf(s).kind !== "event") break;
    }
    expect(roomOf(s).kind).toBe("map");
  });

  test("Golden Shrine: 100 gold pray (50 at A15); 275 + Regret desecrate", () => {
    let s = forceEvent("GS1", "GOLDEN_SHRINE");
    s = pick(s, 0);
    expect(s.run.gold).toBe(199);
    let a = forceEvent("GS2", "GOLDEN_SHRINE", { ascension: 15 });
    a = pick(a, 0);
    expect(a.run.gold).toBe(149);
    let de = forceEvent("GS3", "GOLDEN_SHRINE");
    de = pick(de, 1);
    expect(de.run.gold).toBe(99 + 275);
    expect(deckIds(de)).toContain("REGRET");
  });

  test("Transmogrifier / Purifier / Upgrade Shrine: one transform / removal / upgrade", () => {
    let t = forceEvent("SH1", "TRANSMORGRIFIER");
    t = choose(pick(t, 0), [0]);
    expect(t.run.deck.length).toBe(10);
    expect(deckIds(t).filter((id) => id === "STRIKE_RED").length).toBe(4);

    let p = forceEvent("SH2", "PURIFIER");
    p = choose(pick(p, 0), [0]);
    expect(p.run.deck.length).toBe(9);

    let u = forceEvent("SH3", "UPGRADE_SHRINE");
    u = choose(pick(u, 0), [9]);
    expect(u.run.deck[9]!.upgrades).toBe(1);
  });

  test("Wheel of Change: the miscRng.random(5) roll maps to the exact outcome", () => {
    for (let i = 0; i < 12; i++) {
      let s = forceEvent(`WC${i}`, "WHEEL_OF_CHANGE");
      const reg = RngRegistry.fromState(s.rng);
      const roll = reg.get("miscRng").random(5);
      const before = { gold: s.run.gold, hp: s.run.hp, deck: s.run.deck.length, relics: s.run.relics.length };
      s = pick(s, 0);
      switch (roll) {
        case 0:
          expect(s.run.gold).toBe(before.gold + 100); // act 1
          expect(roomOf(s).kind).toBe("map");
          break;
        case 1: {
          const rw = roomOf(s);
          if (rw.kind !== "rewards") throw new Error("expected relic reward screen");
          expect(rw.entries[0]!.kind).toBe("relic");
          break;
        }
        case 2:
          expect(s.run.hp).toBe(s.run.maxHp);
          break;
        case 3:
          expect(deckIds(s)).toContain("DECAY");
          break;
        case 4:
          expect(s.pending?.request.kind).toBe("cards");
          s = choose(s, [0]);
          expect(s.run.deck.length).toBe(before.deck - 1);
          break;
        default:
          expect(s.run.hp).toBe(before.hp - Math.floor(Math.fround(80 * 0.1)));
          break;
      }
    }
  });
});

describe("one-time events", () => {
  test("Ominous Forge: forge upgrades; rummage takes Pain + Warped Tongs", () => {
    let f = forceEvent("OF1", "OMINOUS_FORGE");
    f = choose(pick(f, 0), [0]);
    expect(f.run.deck[0]!.upgrades).toBe(1);
    let r = forceEvent("OF2", "OMINOUS_FORGE");
    r = pick(r, 1);
    expect(deckIds(r)).toContain("PAIN");
    expect(relicIds(r)).toContain("WARPED_TONGS");
  });

  test("Bonfire Spirits: reward scales with the offered card's rarity", () => {
    let basic = forceEvent("BS1", "BONFIRE_SPIRITS", { mutate: (g) => (g.run.hp = 40) });
    basic = choose(pick(basic, 0), [0]); // STRIKE_RED, basic
    expect(basic.run.deck.length).toBe(9);
    expect(basic.run.hp).toBe(40); // basic pays nothing

    let curse = forceEvent("BS2", "BONFIRE_SPIRITS", {
      mutate: (g) => g.run.deck.push({ defId: "REGRET", upgrades: 0, misc: 0, bottled: false }),
    });
    curse = choose(pick(curse, 0), [10]);
    expect(relicIds(curse)).toContain("SPIRIT_POOP");

    let rare = forceEvent("BS3", "BONFIRE_SPIRITS", {
      mutate: (g) => ((g.run.hp = 40), g.run.deck.push({ defId: "BARRICADE", upgrades: 0, misc: 0, bottled: false })),
    });
    rare = choose(pick(rare, 0), [10]);
    expect(rare.run.maxHp).toBe(90);
    expect(rare.run.hp).toBe(90); // +10 max then full heal

    let common = forceEvent("BS4", "BONFIRE_SPIRITS", {
      mutate: (g) => ((g.run.hp = 40), g.run.deck.push({ defId: "IRON_WAVE", upgrades: 0, misc: 0, bottled: false })),
    });
    common = choose(pick(common, 0), [10]);
    expect(common.run.hp).toBe(45);
  });

  test("Designer In-Spire: setup-rolled variants; punch costs 3 (5 at A15); gold gating", () => {
    let s = forceEvent("DS1", "DESIGNER_IN_SPIRE");
    const upgradeChoice = dataOf(s).upgradeChoice as boolean;
    const adj = pick(s, 0);
    expect(adj.run.gold).toBe(99 - 40);
    if (upgradeChoice) {
      const done = choose(adj, [0]);
      expect(done.run.deck[0]!.upgrades).toBe(1);
      expect(done.run.deck.reduce((n, c) => n + c.upgrades, 0)).toBe(1);
    } else {
      expect(adj.run.deck.reduce((n, c) => n + c.upgrades, 0)).toBe(2);
      expect(roomOf(adj).kind).toBe("map");
    }

    let punch = forceEvent("DS2", "DESIGNER_IN_SPIRE");
    punch = pick(punch, 3);
    expect(punch.run.hp).toBe(77);
    let aPunch = forceEvent("DS3", "DESIGNER_IN_SPIRE", { ascension: 15 });
    aPunch = pick(aPunch, 3);
    expect(aPunch.run.hp).toBe(68 - 5);

    let full = forceEvent("DS4", "DESIGNER_IN_SPIRE");
    full = choose(pick(full, 2), [0]);
    expect(full.run.gold).toBe(9);
    expect(full.run.deck.length).toBe(9);
    expect(full.run.deck.reduce((n, c) => n + c.upgrades, 0)).toBe(1); // random upgrade after removal

    const poor = forceEvent("DS5", "DESIGNER_IN_SPIRE", { mutate: (g) => (g.run.gold = 30) });
    expect(() => pick(poor, 0)).toThrow("unavailable");
    expect(() => pick(poor, 2)).toThrow("unavailable");
  });

  test("Duplicator: exact copy of the chosen card", () => {
    let s = forceEvent("DU1", "DUPLICATOR", { mutate: (g) => (g.run.deck[9]!.upgrades = 1) });
    s = choose(pick(s, 0), [9]);
    expect(s.run.deck.length).toBe(11);
    expect(s.run.deck[10]!.defId).toBe("BASH");
    expect(s.run.deck[10]!.upgrades).toBe(1);
  });

  test("Face Trader: touch pays 75 (-10% max HP, min 1); trade grants an unowned face", () => {
    let t = forceEvent("FT1", "FACE_TRADER");
    t = pick(t, 0);
    expect(t.run.gold).toBe(99 + 75);
    expect(t.run.hp).toBe(80 - 8);
    let a = forceEvent("FT2", "FACE_TRADER", { ascension: 15 });
    a = pick(a, 0);
    expect(a.run.gold).toBe(99 + 50);

    const faces = ["CULTIST_HEADPIECE", "FACE_OF_CLERIC", "GREMLIN_VISAGE", "NLOTHS_HUNGRY_FACE", "SSSERPENT_HEAD"];
    let f = forceEvent("FT3", "FACE_TRADER");
    f = pick(f, 1);
    expect(faces).toContain(relicIds(f)[1]!);

    let all = forceEvent("FT4", "FACE_TRADER", {
      mutate: (g) => faces.forEach((id) => g.run.relics.push({ defId: id, counter: 0 })),
    });
    all = pick(all, 1);
    expect(relicIds(all)).toContain("CIRCLET");
  });

  test("The Divine Fountain: removes removable curses only", () => {
    let s = forceEvent("DF1", "THE_DIVINE_FOUNTAIN", {
      mutate: (g) => {
        g.run.deck.push({ defId: "REGRET", upgrades: 0, misc: 0, bottled: false });
        g.run.deck.push({ defId: "ASCENDERS_BANE", upgrades: 0, misc: 0, bottled: false });
      },
    });
    s = pick(s, 0);
    expect(deckIds(s)).not.toContain("REGRET");
    expect(deckIds(s)).toContain("ASCENDERS_BANE");
  });

  test("Knowing Skull: max(6, 10% maxHp) base cost, +1 per repeat of the same ware", () => {
    let s = forceEvent("KS1", "KNOWING_SKULL"); // base = max(6, floor(8)) = 8
    s = pick(s, 0);
    expect(s.run.hp).toBe(72);
    expect(s.run.gold).toBe(189);
    s = pick(s, 0); // second riches costs 9
    expect(s.run.hp).toBe(63);
    expect(s.run.gold).toBe(279);
    s = pick(s, 1); // success still base 8
    expect(s.run.hp).toBe(55);
    const gained = s.run.deck[10]!;
    expect(bundle.cards.get(gained.defId)!.color).toBe("colorless");
    expect(bundle.cards.get(gained.defId)!.rarity).toBe("uncommon");
    s = pick(s, 2); // potion, base 8
    expect(s.run.hp).toBe(47);
    expect(s.run.potions.some((p) => p !== null)).toBe(true);
    s = pick(s, 3); // leave: base cost, no increment
    expect(s.run.hp).toBe(39);
    expect(roomOf(s).kind).toBe("map");
  });

  test("Knowing Skull can kill: event HP loss ends the run", () => {
    let s = forceEvent("KS2", "KNOWING_SKULL", { mutate: (g) => (g.run.hp = 7) });
    s = pick(s, 0); // costs 8
    expect(s.run.hp).toBe(0);
    expect(s.outcome?.kind).toBe("death");
    expect(roomOf(s).kind).toBe("gameOver");
  });

  test("Lab: 3 potions via the reward screen (2 at A15)", () => {
    let s = forceEvent("LA1", "LAB");
    s = pick(s, 0);
    const rw = roomOf(s);
    if (rw.kind !== "rewards") throw new Error("expected rewards");
    expect(rw.entries.filter((e) => e.kind === "potion").length).toBe(3);
    s = advance(s, { cmd: "takeReward", i: 0 }, bundle);
    expect(s.run.potions.filter((p) => p !== null).length).toBe(1);

    let a = forceEvent("LA2", "LAB", { ascension: 15 });
    a = pick(a, 0);
    const arw = roomOf(a);
    if (arw.kind !== "rewards") throw new Error("expected rewards");
    expect(arw.entries.filter((e) => e.kind === "potion").length).toBe(2);
  });

  test("N'loth: eats one of the two offered relics, leaves the Gift", () => {
    let s = forceEvent("NL1", "NLOTH", { mutate: (g) => g.run.relics.push({ defId: "VAJRA", counter: 0 }) });
    const offerA = dataOf(s).offerA as string;
    const offerB = dataOf(s).offerB as string;
    expect(new Set([offerA, offerB])).toEqual(new Set(["BURNING_BLOOD", "VAJRA"]));
    s = pick(s, 0);
    expect(relicIds(s)).not.toContain(offerA);
    expect(relicIds(s)).toContain(offerB);
    expect(relicIds(s)).toContain("NLOTHS_GIFT");
  });

  test("Note For Yourself: fresh-profile stored card (Iron Wave) for a stored-away card", () => {
    let s = forceEvent("NO1", "NOTE_FOR_YOURSELF");
    s = pick(s, 0);
    expect(deckIds(s)).toContain("IRON_WAVE");
    s = choose(s, [0]);
    expect(s.run.deck.length).toBe(10); // +1 obtained, -1 stored (RUN-META-GAP: not persisted)
    expect(roomOf(s).kind).toBe("map");
  });

  test("Secret Portal: jumps straight to the act boss fight", () => {
    let s = forceEvent("SP1", "SECRET_PORTAL", { mutate: boost });
    const floorBefore = s.run.floor;
    const bossId = s.run.map!.bossId;
    s = pick(s, 0);
    const c = roomOf(s);
    if (c.kind !== "combat") throw new Error("expected boss combat");
    expect(c.roomKind).toBe("boss");
    expect(c.encounterId).toBe(bossId);
    expect(c.eventCombat).toBeUndefined(); // victory takes the normal boss path
    expect(s.run.floor).toBe(floorBefore + 1);
  });

  test("The Joust: one shared 30% owner-wins roll decides both bets", () => {
    for (let i = 0; i < 6; i++) {
      const s = forceEvent(`JO${i}`, "THE_JOUST");
      const reg = RngRegistry.fromState(s.rng);
      const ownerWins = reg.get("miscRng").randomBoolean(0.3);
      const murderer = pick(s, 0);
      expect(murderer.run.gold).toBe(99 - 50 + (ownerWins ? 0 : 100));
      const owner = pick(s, 1);
      expect(owner.run.gold).toBe(99 - 50 + (ownerWins ? 250 : 0));
    }
  });

  test("We Meet Again: potion / gold / card each buy a random relic; setup rolls fixed", () => {
    let p = forceEvent("WM1", "WE_MEET_AGAIN", { mutate: (g) => (g.run.potions[1] = "BLOCK_POTION") });
    expect(dataOf(p).potionSlot).toBe(1);
    p = pick(p, 0);
    expect(p.run.potions[1]).toBeNull();
    expect(p.run.relics.length).toBe(2);

    let g = forceEvent("WM2", "WE_MEET_AGAIN");
    const amount = dataOf(g).goldAmount as number;
    expect(amount).toBeGreaterThanOrEqual(50);
    expect(amount).toBeLessThanOrEqual(99);
    g = pick(g, 1);
    expect(g.run.gold).toBe(99 - amount);
    expect(g.run.relics.length).toBe(2);

    let c = forceEvent("WM3", "WE_MEET_AGAIN", {
      mutate: (s2) => s2.run.deck.push({ defId: "IRON_WAVE", upgrades: 0, misc: 0, bottled: false }),
    });
    expect(dataOf(c).cardIdx).toBe(10); // the only non-basic card
    c = pick(c, 2);
    expect(c.run.deck.length).toBe(10);
    expect(c.run.relics.length).toBe(2);

    let n = forceEvent("WM4", "WE_MEET_AGAIN");
    expect(dataOf(n).cardIdx).toBeUndefined(); // starter deck is all basics
    expect(() => pick(n, 2)).toThrow("unavailable");
    n = pick(n, 3); // attack
    expect(roomOf(n).kind).toBe("map");
    expect(n.run.relics.length).toBe(1);
  });

  test("The Woman in Blue: potion bundles at 20/30/40 gold; A15 leave costs 5% max HP", () => {
    let s = forceEvent("WB1", "THE_WOMAN_IN_BLUE");
    s = pick(s, 1);
    expect(s.run.gold).toBe(69);
    const rw = roomOf(s);
    if (rw.kind !== "rewards") throw new Error("expected rewards");
    expect(rw.entries.filter((e) => e.kind === "potion").length).toBe(2);

    let leave = forceEvent("WB2", "THE_WOMAN_IN_BLUE");
    leave = pick(leave, 3);
    expect(leave.run.hp).toBe(80);
    expect(roomOf(leave).kind).toBe("map");

    let a = forceEvent("WB3", "THE_WOMAN_IN_BLUE", { ascension: 15 });
    a = pick(a, 3);
    expect(a.run.hp).toBe(68 - Math.ceil(Math.fround(75 * 0.05)));
  });
});

describe("event relic hooks apply uniformly", () => {
  test("Omamori negates an event curse; Ectoplasm zeroes event gold", () => {
    let s = forceEvent("HK1", "THE_SSSSSERPENT", { mutate: (g) => g.run.relics.push({ defId: "OMAMORI", counter: 2 }) });
    s = pick(s, 0);
    expect(s.run.gold).toBe(99 + 175);
    expect(deckIds(s)).not.toContain("DOUBT");
    expect(s.run.relics.find((r) => r.defId === "OMAMORI")!.counter).toBe(1);

    let e = forceEvent("HK2", "THE_NEST", { mutate: (g) => g.run.relics.push({ defId: "ECTOPLASM", counter: 0 }) });
    e = pick(e, 0);
    expect(e.run.gold).toBe(99); // gain folded to 0
  });

  test("canSpawn gates match the corpus requirements", () => {
    const s = createRun({ seed: "SPAWN", bundle, character: "IRONCLAD" });
    const ev = (id: string) => bundle.events.get(id)!;
    expect(ev("THE_CLERIC").canSpawn!(s.run)).toBe(true);
    s.run.gold = 34;
    expect(ev("THE_CLERIC").canSpawn!(s.run)).toBe(false);
    expect(ev("DEAD_ADVENTURER").canSpawn!(s.run)).toBe(false); // floor 0 < 7
    s.run.floor = 7;
    expect(ev("DEAD_ADVENTURER").canSpawn!(s.run)).toBe(true);
    expect(ev("HYPNOTIZING_COLORED_MUSHROOMS").canSpawn!(s.run)).toBe(true);
    expect(ev("COLOSSEUM").canSpawn!(s.run)).toBe(false); // no position
    s.run.position = [3, 8];
    expect(ev("COLOSSEUM").canSpawn!(s.run)).toBe(true);
    s.run.position = [3, 7];
    expect(ev("COLOSSEUM").canSpawn!(s.run)).toBe(false);
    expect(ev("THE_MOAI_HEAD").canSpawn!(s.run)).toBe(false); // healthy, no idol
    s.run.hp = 40;
    expect(ev("THE_MOAI_HEAD").canSpawn!(s.run)).toBe(true);
    expect(ev("KNOWING_SKULL").canSpawn!(s.run)).toBe(false); // act 1
    s.run.act = 2;
    expect(ev("KNOWING_SKULL").canSpawn!(s.run)).toBe(true);
    s.run.hp = 12;
    expect(ev("KNOWING_SKULL").canSpawn!(s.run)).toBe(false);
    expect(ev("NLOTH").canSpawn!(s.run)).toBe(false); // 1 relic
    s.run.relics.push({ defId: "VAJRA", counter: 0 });
    expect(ev("NLOTH").canSpawn!(s.run)).toBe(true);
    expect(ev("SECRET_PORTAL").canSpawn!(s.run)).toBe(false);
    s.run.act = 3;
    expect(ev("SECRET_PORTAL").canSpawn!(s.run)).toBe(true);
    expect(ev("THE_DIVINE_FOUNTAIN").canSpawn!(s.run)).toBe(false);
    s.run.deck.push({ defId: "REGRET", upgrades: 0, misc: 0, bottled: false });
    expect(ev("THE_DIVINE_FOUNTAIN").canSpawn!(s.run)).toBe(true);
    expect(ev("NOTE_FOR_YOURSELF").canSpawn!(s.run)).toBe(true);
    s.run.ascension = 15;
    expect(ev("NOTE_FOR_YOURSELF").canSpawn!(s.run)).toBe(false);
  });
});
