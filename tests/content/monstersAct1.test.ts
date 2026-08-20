// Act-1 monster content tests — every corpus entity: HP bands (A0 + A7/8/9),
// exact move damage through real combats, first-turn rules, and seed-swept
// property tests of the corpus historyRules across 15+ end-turned rounds.

import { test, expect, describe } from "bun:test";
import { createCombatGame, advance, type GameState } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content/index";
import { act1Monsters, act1Powers } from "../../src/content/monsters/act1/index";
import type { CardDef, ContentBundle } from "../../src/engine/content/defs";

// ------------------------------------------------------------------------------
// bundle: base content + act-1 monsters/powers + stubs for parallel workstreams
// ------------------------------------------------------------------------------

function stubStatus(id: string): CardDef {
  return {
    id,
    name: id,
    color: "colorless",
    type: "status",
    rarity: "special",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
  };
}

function makeBundle(): ContentBundle {
  const b = buildBaseContentBundle();
  for (const m of act1Monsters) b.monsters.set(m.id, m);
  for (const p of act1Powers) if (!b.powers.has(p.id)) b.powers.set(p.id, p);
  for (const id of ["SLIMED", "DAZED", "BURN"]) {
    if (!b.cards.has(id)) b.cards.set(id, stubStatus(id)); // status cards land in a parallel workstream
  }
  if (!b.powers.has("SHARP_HIDE")) {
    // SHARP_HIDE is act-3 content; a marker stub lets Guardian's defensive mode apply it
    b.powers.set("SHARP_HIDE", {
      id: "SHARP_HIDE",
      name: "Sharp Hide",
      kind: "buff",
      stacking: "intensity",
      turnBased: false,
      hooks: {},
    });
  }
  return b;
}

const bundle = makeBundle();
const SEEDS = Array.from({ length: 20 }, (_, i) => `SEED${i}`);
const defendDeck = Array(10).fill({ defId: "DEFEND_RED" });
const strikeDeck = Array(10).fill({ defId: "STRIKE_RED" });

interface FightOpts {
  seed?: string;
  asc?: number;
  deck?: { defId: string }[];
  hp?: number;
}

function fight(monsters: string[], opts: FightOpts = {}): GameState {
  const hp = opts.hp ?? 5000;
  return createCombatGame({
    seed: opts.seed ?? "TEST",
    bundle,
    character: "IRONCLAD",
    ascension: opts.asc ?? 0,
    deck: opts.deck ?? defendDeck,
    monsters,
    hp,
    maxHp: hp,
  });
}

const endTurn = (s: GameState): GameState => advance(s, { cmd: "endTurn" }, bundle);

function play(s: GameState, name: string, target?: number): GameState {
  const idx = s.combat!.player.piles.hand.findIndex((iid) => s.combat!.cards[iid]!.defId === name);
  if (idx === -1) throw new Error(`${name} not in hand`);
  return advance(s, { cmd: "playCard", handIdx: idx, target }, bundle);
}

const mon = (s: GameState, idx = 0) => s.combat!.monsters[idx]!;
const monPower = (s: GameState, idx: number, id: string) => mon(s, idx).powers.find((p) => p.id === id);
const playerPower = (s: GameState, id: string) => s.combat!.player.powers.find((p) => p.id === id);
const countCards = (s: GameState, defId: string, upgrades?: number) =>
  Object.values(s.combat!.cards).filter((c) => c.defId === defId && (upgrades === undefined || c.upgrades === upgrades))
    .length;

function expectHpRange(monsterId: string, asc: number, lo: number, hi: number): void {
  for (const seed of SEEDS.slice(0, 6)) {
    const m = mon(fight([monsterId], { seed, asc }));
    expect(m.maxHp).toBeGreaterThanOrEqual(lo);
    expect(m.maxHp).toBeLessThanOrEqual(hi);
  }
}

/** Executed-move sequences (the intent before each endTurn) across seeds. */
function moveSequences(monsterId: string, opts: FightOpts & { turns?: number } = {}): string[][] {
  const turns = opts.turns ?? 18;
  return SEEDS.map((seed) => {
    let s = fight([monsterId], { ...opts, seed });
    const moves: string[] = [];
    for (let t = 0; t < turns; t++) {
      const m = mon(s);
      if (m.isDead || m.isEscaped || !m.move) break;
      moves.push(m.move);
      s = endTurn(s);
      if (s.outcome || !s.combat) break;
    }
    return moves;
  });
}

function maxRunLength(moves: string[], id: string): number {
  let run = 0;
  let best = 0;
  for (const m of moves) {
    run = m === id ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * Find a turn (across seeds) where `moveId` is the intent with no player
 * Vulnerable active, end the turn, and assert the exact HP delta
 * (expected base + the monster's current Strength) x hits.
 */
function expectMoveDamage(monsterId: string, moveId: string, base: number, hits = 1, opts: FightOpts = {}): void {
  for (const seed of SEEDS) {
    let s = fight([monsterId], { ...opts, seed });
    for (let t = 0; t < 25; t++) {
      const m = mon(s);
      if (m.isDead || m.isEscaped || !m.move) break;
      if (m.move === moveId && !playerPower(s, "VULNERABLE") && !playerPower(s, "INTANGIBLE")) {
        const str = monPower(s, 0, "STRENGTH")?.amount ?? 0;
        const before = s.run.hp;
        expect(s.combat!.player.block).toBe(0);
        s = endTurn(s);
        expect(before - s.run.hp).toBe((base + str) * hits);
        return;
      }
      s = endTurn(s);
      if (s.outcome || !s.combat) break;
    }
  }
  throw new Error(`${moveId} never observed for ${monsterId}`);
}

// ------------------------------------------------------------------------------
// Cultist
// ------------------------------------------------------------------------------

describe("Cultist", () => {
  test("HP: [48,54] A0, [50,56] A7", () => {
    expectHpRange("CULTIST", 0, 48, 54);
    expectHpRange("CULTIST", 7, 50, 56);
  });

  test("history: Incantation exactly once on turn 1, Dark Strike every turn after", () => {
    for (const moves of moveSequences("CULTIST")) {
      expect(moves[0]).toBe("CULTIST_INCANTATION");
      expect(moves.slice(1).every((m) => m === "CULTIST_DARK_STRIKE")).toBe(true);
    }
  });

  test("Ritual: 3 / 4 (A2) / 5 (A17); Dark Strike 6, 9, 12 as Ritual stacks", () => {
    for (const [asc, ritual] of [
      [0, 3],
      [2, 4],
      [17, 5],
    ] as const) {
      const s = endTurn(fight(["CULTIST"], { asc }));
      expect(monPower(s, 0, "RITUAL")?.amount).toBe(ritual);
    }
    let s = fight(["CULTIST"]);
    s = endTurn(s); // Incantation — no damage, Ritual queued (skips its first end-of-turn)
    const hp0 = s.run.hp;
    s = endTurn(s); // Dark Strike at Str 0
    expect(hp0 - s.run.hp).toBe(6);
    const hp1 = s.run.hp;
    s = endTurn(s); // Str 3
    expect(hp1 - s.run.hp).toBe(9);
    const hp2 = s.run.hp;
    s = endTurn(s); // Str 6
    expect(hp2 - s.run.hp).toBe(12);
  });
});

// ------------------------------------------------------------------------------
// Jaw Worm (exemplar entity — history rules only; numbers covered in slice.test.ts)
// ------------------------------------------------------------------------------

describe("Jaw Worm", () => {
  test("history: Chomp never 2x, Thrash never 3x, Bellow never 2x; first turn Chomp", () => {
    for (const moves of moveSequences("JAW_WORM")) {
      expect(moves[0]).toBe("JAW_WORM_CHOMP");
      expect(maxRunLength(moves, "JAW_WORM_CHOMP")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "JAW_WORM_THRASH")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "JAW_WORM_BELLOW")).toBeLessThanOrEqual(1);
    }
  });
});

// ------------------------------------------------------------------------------
// Louses
// ------------------------------------------------------------------------------

describe("Louses", () => {
  test("HP: Red [10,15]/[11,16] A7; Green [11,17]/[12,18] A7", () => {
    expectHpRange("RED_LOUSE", 0, 10, 15);
    expectHpRange("RED_LOUSE", 7, 11, 16);
    expectHpRange("GREEN_LOUSE", 0, 11, 17);
    expectHpRange("GREEN_LOUSE", 7, 12, 18);
  });

  test("bite damage D rolled at spawn: [5,7] A0, [6,8] A2; bite deals exactly D (+Str)", () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const d0 = mon(fight(["RED_LOUSE"], { seed })).data.biteDamage as number;
      expect(d0).toBeGreaterThanOrEqual(5);
      expect(d0).toBeLessThanOrEqual(7);
      const d2 = mon(fight(["RED_LOUSE"], { seed, asc: 2 })).data.biteDamage as number;
      expect(d2).toBeGreaterThanOrEqual(6);
      expect(d2).toBeLessThanOrEqual(8);
    }
    // exact bite: find a Bite intent and assert delta == D + strength
    for (const seed of SEEDS) {
      let s = fight(["GREEN_LOUSE"], { seed });
      const d = mon(s).data.biteDamage as number;
      for (let t = 0; t < 10; t++) {
        if (mon(s).move === "GREEN_LOUSE_BITE") {
          const before = s.run.hp;
          s = endTurn(s);
          expect(before - s.run.hp).toBe(d);
          return;
        }
        s = endTurn(s);
      }
    }
    throw new Error("bite never observed");
  });

  test("Curl Up amount bands: [3,7] A0, [4,8] A7, [9,12] A17; triggers once on unblocked damage", () => {
    for (const [asc, lo, hi] of [
      [0, 3, 7],
      [7, 4, 8],
      [17, 9, 12],
    ] as const) {
      for (const seed of SEEDS.slice(0, 5)) {
        const amt = monPower(fight(["RED_LOUSE"], { seed, asc }), 0, "CURL_UP")!.amount;
        expect(amt).toBeGreaterThanOrEqual(lo);
        expect(amt).toBeLessThanOrEqual(hi);
      }
    }
    let s = fight(["RED_LOUSE"], { seed: "CURL", deck: strikeDeck });
    const curl = monPower(s, 0, "CURL_UP")!.amount;
    s = play(s, "STRIKE_RED", 0);
    expect(mon(s).block).toBe(curl);
    expect(monPower(s, 0, "CURL_UP")).toBeUndefined();
  });

  test("history: Bite never 3x; Grow/Spit Web never 3x (A0), never 2x (A17)", () => {
    for (const moves of moveSequences("RED_LOUSE")) {
      expect(maxRunLength(moves, "RED_LOUSE_BITE")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "RED_LOUSE_GROW")).toBeLessThanOrEqual(2);
    }
    for (const moves of moveSequences("GREEN_LOUSE", { asc: 17 })) {
      expect(maxRunLength(moves, "GREEN_LOUSE_BITE")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "GREEN_LOUSE_SPIT_WEB")).toBeLessThanOrEqual(1);
    }
  });

  test("Green Louse Spit Web applies Weak 2", () => {
    for (const seed of SEEDS) {
      let s = fight(["GREEN_LOUSE"], { seed });
      for (let t = 0; t < 10; t++) {
        if (mon(s).move === "GREEN_LOUSE_SPIT_WEB" && !playerPower(s, "WEAK")) {
          s = endTurn(s);
          expect(playerPower(s, "WEAK")?.amount).toBe(2);
          return;
        }
        s = endTurn(s);
      }
    }
    throw new Error("spit web never observed");
  });
});

// ------------------------------------------------------------------------------
// Slimes
// ------------------------------------------------------------------------------

describe("Acid Slime (S)", () => {
  test("HP: [8,12] A0, [9,13] A7", () => {
    expectHpRange("ACID_SLIME_S", 0, 8, 12);
    expectHpRange("ACID_SLIME_S", 7, 9, 13);
  });

  test("first turn: always Lick at A17; both moves occur across seeds at A0; strict alternation after", () => {
    const first = new Set<string>();
    for (const moves of moveSequences("ACID_SLIME_S")) {
      first.add(moves[0]!);
      for (let i = 1; i < moves.length; i++) expect(moves[i]).not.toBe(moves[i - 1]);
    }
    expect(first.size).toBe(2);
    for (const moves of moveSequences("ACID_SLIME_S", { asc: 17 })) {
      expect(moves[0]).toBe("ACID_SLIME_S_LICK");
    }
  });

  test("Tackle 3 (A0) / 4 (A2); Lick applies Weak 1", () => {
    expectMoveDamage("ACID_SLIME_S", "ACID_SLIME_S_TACKLE", 3);
    expectMoveDamage("ACID_SLIME_S", "ACID_SLIME_S_TACKLE", 4, 1, { asc: 2 });
  });
});

describe("Acid Slime (M)", () => {
  test("HP: [28,32] A0, [29,34] A7", () => {
    expectHpRange("ACID_SLIME_M", 0, 28, 32);
    expectHpRange("ACID_SLIME_M", 7, 29, 34);
  });

  test("damage: Corrosive Spit 7 (+1 Slimed), Tackle 10; A2: 8/12", () => {
    expectMoveDamage("ACID_SLIME_M", "ACID_SLIME_M_CORROSIVE_SPIT", 7);
    expectMoveDamage("ACID_SLIME_M", "ACID_SLIME_M_TACKLE", 10);
    expectMoveDamage("ACID_SLIME_M", "ACID_SLIME_M_CORROSIVE_SPIT", 8, 1, { asc: 2 });
    expectMoveDamage("ACID_SLIME_M", "ACID_SLIME_M_TACKLE", 12, 1, { asc: 2 });
    for (const seed of SEEDS) {
      let s = fight(["ACID_SLIME_M"], { seed });
      if (mon(s).move === "ACID_SLIME_M_CORROSIVE_SPIT") {
        s = endTurn(s);
        expect(countCards(s, "SLIMED")).toBe(1);
        return;
      }
    }
    throw new Error("spit never first");
  });

  test("history A0: spit <3x, tackle <2x, lick <3x; A17: spit <3x, tackle <3x, lick <2x", () => {
    for (const moves of moveSequences("ACID_SLIME_M")) {
      expect(maxRunLength(moves, "ACID_SLIME_M_CORROSIVE_SPIT")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "ACID_SLIME_M_TACKLE")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "ACID_SLIME_M_LICK")).toBeLessThanOrEqual(2);
    }
    for (const moves of moveSequences("ACID_SLIME_M", { asc: 17 })) {
      expect(maxRunLength(moves, "ACID_SLIME_M_CORROSIVE_SPIT")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "ACID_SLIME_M_TACKLE")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "ACID_SLIME_M_LICK")).toBeLessThanOrEqual(1);
    }
  });
});

describe("Acid Slime (L)", () => {
  test("HP: [65,69] A0, [68,72] A7", () => {
    expectHpRange("ACID_SLIME_L", 0, 65, 69);
    expectHpRange("ACID_SLIME_L", 7, 68, 72);
  });

  test("damage: Corrosive Spit 11 (+2 Slimed), Tackle 16; A2: 12/18", () => {
    expectMoveDamage("ACID_SLIME_L", "ACID_SLIME_L_CORROSIVE_SPIT", 11);
    expectMoveDamage("ACID_SLIME_L", "ACID_SLIME_L_TACKLE", 16);
    expectMoveDamage("ACID_SLIME_L", "ACID_SLIME_L_CORROSIVE_SPIT", 12, 1, { asc: 2 });
    expectMoveDamage("ACID_SLIME_L", "ACID_SLIME_L_TACKLE", 18, 1, { asc: 2 });
  });

  test("split at <=50%: intent interrupt, two Acid Slime (M) at current HP", () => {
    let s = fight(["ACID_SLIME_L"], { seed: "SPLIT", deck: strikeDeck });
    const half = Math.floor(mon(s).maxHp / 2);
    let splitHp = -1;
    outer: for (let t = 0; t < 15; t++) {
      while (s.combat!.player.energy > 0 && s.combat!.player.piles.hand.some((i) => s.combat!.cards[i]!.defId === "STRIKE_RED")) {
        const before = mon(s).move;
        s = play(s, "STRIKE_RED", 0);
        if (mon(s).hp <= half) {
          expect(before).not.toBe("ACID_SLIME_L_SPLIT");
          expect(mon(s).move).toBe("ACID_SLIME_L_SPLIT");
          splitHp = mon(s).hp;
          break outer;
        }
      }
      s = endTurn(s);
    }
    expect(splitHp).toBeGreaterThan(0);
    s = endTurn(s);
    expect(mon(s, 0).id).toBe("ACID_SLIME_M");
    expect(mon(s, 1).id).toBe("ACID_SLIME_M");
    for (const idx of [0, 1]) {
      expect(mon(s, idx).hp).toBe(splitHp);
      expect(mon(s, idx).maxHp).toBe(splitHp);
      expect(mon(s, idx).move).not.toBeNull();
      expect(mon(s, idx).isDead).toBe(false);
    }
  });

  test("history A17 (adjudicated): own Corrosive Spit never 3x, Tackle never 3x, Lick never 2x", () => {
    for (const moves of moveSequences("ACID_SLIME_L", { asc: 17 })) {
      expect(maxRunLength(moves, "ACID_SLIME_L_CORROSIVE_SPIT")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "ACID_SLIME_L_TACKLE")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "ACID_SLIME_L_LICK")).toBeLessThanOrEqual(1);
    }
    for (const moves of moveSequences("ACID_SLIME_L")) {
      expect(maxRunLength(moves, "ACID_SLIME_L_CORROSIVE_SPIT")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "ACID_SLIME_L_TACKLE")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "ACID_SLIME_L_LICK")).toBeLessThanOrEqual(2);
    }
  });
});

describe("Spike Slime (S)", () => {
  test("HP: [10,14] A0, [11,15] A7; Tackle every turn at 5 (A0) / 6 (A2)", () => {
    expectHpRange("SPIKE_SLIME_S", 0, 10, 14);
    expectHpRange("SPIKE_SLIME_S", 7, 11, 15);
    for (const moves of moveSequences("SPIKE_SLIME_S", { turns: 15 })) {
      expect(moves.every((m) => m === "SPIKE_SLIME_S_TACKLE")).toBe(true);
    }
    expectMoveDamage("SPIKE_SLIME_S", "SPIKE_SLIME_S_TACKLE", 5);
    expectMoveDamage("SPIKE_SLIME_S", "SPIKE_SLIME_S_TACKLE", 6, 1, { asc: 2 });
  });
});

describe("Spike Slime (M)", () => {
  test("HP: [28,32] A0, [29,34] A7", () => {
    expectHpRange("SPIKE_SLIME_M", 0, 28, 32);
    expectHpRange("SPIKE_SLIME_M", 7, 29, 34);
  });

  test("Flame Tackle 8 (A0) / 10 (A2) + 1 Slimed; Lick applies Frail 1", () => {
    expectMoveDamage("SPIKE_SLIME_M", "SPIKE_SLIME_M_FLAME_TACKLE", 8);
    expectMoveDamage("SPIKE_SLIME_M", "SPIKE_SLIME_M_FLAME_TACKLE", 10, 1, { asc: 2 });
    for (const seed of SEEDS) {
      let s = fight(["SPIKE_SLIME_M"], { seed });
      if (mon(s).move === "SPIKE_SLIME_M_LICK") {
        s = endTurn(s);
        expect(playerPower(s, "FRAIL")?.amount).toBe(1);
        return;
      }
    }
    throw new Error("lick never first");
  });

  test("history: Flame Tackle never 3x; Lick never 3x (A0), never 2x (A17)", () => {
    for (const moves of moveSequences("SPIKE_SLIME_M")) {
      expect(maxRunLength(moves, "SPIKE_SLIME_M_FLAME_TACKLE")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "SPIKE_SLIME_M_LICK")).toBeLessThanOrEqual(2);
    }
    for (const moves of moveSequences("SPIKE_SLIME_M", { asc: 17 })) {
      expect(maxRunLength(moves, "SPIKE_SLIME_M_LICK")).toBeLessThanOrEqual(1);
    }
  });
});

describe("Spike Slime (L)", () => {
  test("HP: [64,70] A0, [67,73] A7", () => {
    expectHpRange("SPIKE_SLIME_L", 0, 64, 70);
    expectHpRange("SPIKE_SLIME_L", 7, 67, 73);
  });

  test("Flame Tackle 16 (A0) / 18 (A2); Lick Frail 2 (A0) / 3 (A17)", () => {
    expectMoveDamage("SPIKE_SLIME_L", "SPIKE_SLIME_L_FLAME_TACKLE", 16);
    expectMoveDamage("SPIKE_SLIME_L", "SPIKE_SLIME_L_FLAME_TACKLE", 18, 1, { asc: 2 });
    for (const [asc, frail] of [
      [0, 2],
      [17, 3],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["SPIKE_SLIME_L"], { seed, asc });
        if (mon(s).move === "SPIKE_SLIME_L_LICK") {
          s = endTurn(s);
          expect(playerPower(s, "FRAIL")?.amount).toBe(frail);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }
  });

  test("split at <=50% into two Spike Slime (M) at current HP", () => {
    let s = fight(["SPIKE_SLIME_L"], { seed: "SPLIT2", deck: strikeDeck });
    const half = Math.floor(mon(s).maxHp / 2);
    let splitHp = -1;
    outer: for (let t = 0; t < 15; t++) {
      while (s.combat!.player.energy > 0 && s.combat!.player.piles.hand.some((i) => s.combat!.cards[i]!.defId === "STRIKE_RED")) {
        s = play(s, "STRIKE_RED", 0);
        if (mon(s).hp <= half) {
          expect(mon(s).move).toBe("SPIKE_SLIME_L_SPLIT");
          splitHp = mon(s).hp;
          break outer;
        }
      }
      s = endTurn(s);
    }
    expect(splitHp).toBeGreaterThan(0);
    s = endTurn(s);
    expect(mon(s, 0).id).toBe("SPIKE_SLIME_M");
    expect(mon(s, 1).id).toBe("SPIKE_SLIME_M");
    expect(mon(s, 0).hp).toBe(splitHp);
    expect(mon(s, 1).hp).toBe(splitHp);
  });
});

// ------------------------------------------------------------------------------
// Gremlins
// ------------------------------------------------------------------------------

describe("Gremlins", () => {
  test("HP bands (A0/A7)", () => {
    expectHpRange("MAD_GREMLIN", 0, 20, 24);
    expectHpRange("MAD_GREMLIN", 7, 21, 25);
    expectHpRange("SNEAKY_GREMLIN", 0, 10, 14);
    expectHpRange("SNEAKY_GREMLIN", 7, 11, 15);
    expectHpRange("FAT_GREMLIN", 0, 13, 17);
    expectHpRange("FAT_GREMLIN", 7, 14, 18);
    expectHpRange("SHIELD_GREMLIN", 0, 12, 15);
    expectHpRange("SHIELD_GREMLIN", 7, 13, 17);
    expectHpRange("GREMLIN_WIZARD", 0, 21, 25);
    expectHpRange("GREMLIN_WIZARD", 7, 22, 26);
  });

  test("Mad Gremlin: Scratch every turn (4 A0 / 5 A2); Angry 1 (A17: 2) gives Str when hit", () => {
    for (const moves of moveSequences("MAD_GREMLIN", { turns: 15 })) {
      expect(moves.every((m) => m === "MAD_GREMLIN_SCRATCH")).toBe(true);
    }
    expectMoveDamage("MAD_GREMLIN", "MAD_GREMLIN_SCRATCH", 4);
    expectMoveDamage("MAD_GREMLIN", "MAD_GREMLIN_SCRATCH", 5, 1, { asc: 2 });
    let s = fight(["MAD_GREMLIN"], { seed: "ANGRY", deck: strikeDeck });
    expect(monPower(s, 0, "ANGRY")?.amount).toBe(1);
    expect(monPower(fight(["MAD_GREMLIN"], { asc: 17 }), 0, "ANGRY")?.amount).toBe(2);
    s = play(s, "STRIKE_RED", 0);
    expect(monPower(s, 0, "STRENGTH")?.amount).toBe(1);
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(5); // 4 + 1 Strength
  });

  test("Sneaky Gremlin: Puncture every turn, 9 (A0) / 10 (A2)", () => {
    for (const moves of moveSequences("SNEAKY_GREMLIN", { turns: 15 })) {
      expect(moves.every((m) => m === "SNEAKY_GREMLIN_PUNCTURE")).toBe(true);
    }
    expectMoveDamage("SNEAKY_GREMLIN", "SNEAKY_GREMLIN_PUNCTURE", 9);
    expectMoveDamage("SNEAKY_GREMLIN", "SNEAKY_GREMLIN_PUNCTURE", 10, 1, { asc: 2 });
  });

  test("Fat Gremlin: Smash every turn, 4 + Weak 1; A17 adds Frail 1", () => {
    for (const moves of moveSequences("FAT_GREMLIN", { turns: 15 })) {
      expect(moves.every((m) => m === "FAT_GREMLIN_SMASH")).toBe(true);
    }
    expectMoveDamage("FAT_GREMLIN", "FAT_GREMLIN_SMASH", 4);
    let s = endTurn(fight(["FAT_GREMLIN"]));
    expect(playerPower(s, "WEAK")?.amount).toBe(1);
    expect(playerPower(s, "FRAIL")).toBeUndefined();
    s = endTurn(fight(["FAT_GREMLIN"], { asc: 17 }));
    expect(playerPower(s, "WEAK")?.amount).toBe(1);
    expect(playerPower(s, "FRAIL")?.amount).toBe(1);
  });

  test("Shield Gremlin: Protects an ally (7 A0 / 8 A7 / 11 A17), permanent Shield Bash once alone", () => {
    for (const [asc, block] of [
      [0, 7],
      [7, 8],
      [17, 11],
    ] as const) {
      const s = endTurn(fight(["SHIELD_GREMLIN", "MAD_GREMLIN"], { asc }));
      expect(mon(s, 1).block).toBe(block); // only valid target: the Mad Gremlin
      expect(mon(s, 0).move).toBe("SHIELD_GREMLIN_PROTECT");
    }
    // kill the ally -> Protect targets itself that turn, then Shield Bash forever
    let s = fight(["SHIELD_GREMLIN", "MAD_GREMLIN"], { seed: "ALONE", deck: strikeDeck });
    for (let t = 0; t < 6 && !mon(s, 1).isDead; t++) {
      while (
        !mon(s, 1).isDead &&
        s.combat!.player.energy > 0 &&
        s.combat!.player.piles.hand.some((i) => s.combat!.cards[i]!.defId === "STRIKE_RED")
      ) {
        s = play(s, "STRIKE_RED", 1);
      }
      if (!mon(s, 1).isDead) s = endTurn(s);
    }
    expect(mon(s, 1).isDead).toBe(true);
    s = endTurn(s); // Protect (self, last alive) executes; next move locks to Shield Bash
    expect(mon(s, 0).block).toBe(7);
    expect(mon(s, 0).move).toBe("SHIELD_GREMLIN_SHIELD_BASH");
    for (let t = 0; t < 4; t++) {
      s = endTurn(s);
      if (s.outcome) break;
      expect(mon(s, 0).move).toBe("SHIELD_GREMLIN_SHIELD_BASH");
    }
  });

  test("Gremlin Wizard: A0 pattern C,C,B then [C,C,C,B]; A17: blasts every turn after the first", () => {
    const expectPrefix = (moves: string[], pattern: string[]) => {
      for (let i = 0; i < Math.min(moves.length, pattern.length); i++) {
        expect(moves[i]).toBe(pattern[i] === "C" ? "GREMLIN_WIZARD_CHARGING" : "GREMLIN_WIZARD_ULTIMATE_BLAST");
      }
    };
    for (const moves of moveSequences("GREMLIN_WIZARD", { turns: 15 })) {
      expectPrefix(moves, ["C", "C", "B", "C", "C", "C", "B", "C", "C", "C", "B", "C", "C", "C", "B"]);
    }
    for (const moves of moveSequences("GREMLIN_WIZARD", { asc: 17, turns: 10 })) {
      expectPrefix(moves, ["C", "C", "B", "B", "B", "B", "B", "B", "B", "B"]);
    }
    expectMoveDamage("GREMLIN_WIZARD", "GREMLIN_WIZARD_ULTIMATE_BLAST", 25);
    expectMoveDamage("GREMLIN_WIZARD", "GREMLIN_WIZARD_ULTIMATE_BLAST", 30, 1, { asc: 2 });
  });
});

// ------------------------------------------------------------------------------
// Looter
// ------------------------------------------------------------------------------

describe("Looter", () => {
  test("HP: [44,48] A0, [46,50] A7", () => {
    expectHpRange("LOOTER", 0, 44, 48);
    expectHpRange("LOOTER", 7, 46, 50);
  });

  test("Mug turns 1+2 (10 dmg, steals 15); turn 3 is Lunge or Smoke Bomb; Lunge->Smoke Bomb->Escape", () => {
    const thirdMoves = new Set<string>();
    for (const seed of SEEDS) {
      let s = fight(["LOOTER"], { seed });
      expect(mon(s).move).toBe("LOOTER_MUG");
      expect(s.run.gold).toBe(99);
      const hp0 = s.run.hp;
      s = endTurn(s);
      expect(hp0 - s.run.hp).toBe(10);
      expect(s.run.gold).toBe(84);
      expect(mon(s).move).toBe("LOOTER_MUG");
      s = endTurn(s);
      expect(s.run.gold).toBe(69);
      const third = mon(s).move!;
      thirdMoves.add(third);
      expect(["LOOTER_LUNGE", "LOOTER_SMOKE_BOMB"]).toContain(third);
      if (third === "LOOTER_LUNGE") {
        const hp1 = s.run.hp;
        s = endTurn(s);
        expect(hp1 - s.run.hp).toBe(12);
        expect(s.run.gold).toBe(54);
        expect(mon(s).move).toBe("LOOTER_SMOKE_BOMB");
      }
      s = endTurn(s); // Smoke Bomb executes (6 block), next is Escape
      expect(mon(s).block).toBe(6);
      expect(mon(s).move).toBe("LOOTER_ESCAPE");
      expect(mon(s).data.stolenGold).toBe(99 - s.run.gold);
      s = endTurn(s);
      expect(mon(s).isEscaped).toBe(true);
      expect(s.eventLog.some((e) => e.event === "combatEnded")).toBe(true);
    }
    expect(thirdMoves.size).toBe(2); // both branches of the 50/50 observed
  });

  test("A17 steals 20 per hit; A2 Mug deals 11", () => {
    let s = fight(["LOOTER"], { asc: 17 });
    expect(monPower(s, 0, "THIEVERY")?.amount).toBe(20);
    s = endTurn(s);
    expect(s.run.gold).toBe(79);
    const s2 = fight(["LOOTER"], { asc: 2 });
    const hp0 = s2.run.hp;
    expect(endTurn(s2).run.hp).toBe(hp0 - 11);
  });
});

// ------------------------------------------------------------------------------
// Fungi Beast
// ------------------------------------------------------------------------------

describe("Fungi Beast", () => {
  test("HP: [22,28] A0, [24,28] A7", () => {
    expectHpRange("FUNGI_BEAST", 0, 22, 28);
    expectHpRange("FUNGI_BEAST", 7, 24, 28);
  });

  test("Bite 6 flat (+Str); Grow +3/+4(A2)/+5(A17); history: Bite <3x, Grow <2x", () => {
    expectMoveDamage("FUNGI_BEAST", "FUNGI_BEAST_BITE", 6);
    for (const moves of moveSequences("FUNGI_BEAST")) {
      expect(maxRunLength(moves, "FUNGI_BEAST_BITE")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "FUNGI_BEAST_GROW")).toBeLessThanOrEqual(1);
    }
    for (const [asc, str] of [
      [0, 3],
      [2, 4],
      [17, 5],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["FUNGI_BEAST"], { seed, asc });
        if (mon(s).move === "FUNGI_BEAST_GROW") {
          s = endTurn(s);
          expect(monPower(s, 0, "STRENGTH")?.amount).toBe(str);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }
  });

  test("Spore Cloud: death applies Vulnerable 2 to the player", () => {
    let s = fight(["FUNGI_BEAST", "FUNGI_BEAST"], { seed: "SPORE", deck: strikeDeck });
    expect(monPower(s, 0, "SPORE_CLOUD")?.amount).toBe(2);
    for (let t = 0; t < 8 && !mon(s, 0).isDead; t++) {
      while (
        !mon(s, 0).isDead &&
        s.combat!.player.energy > 0 &&
        s.combat!.player.piles.hand.some((i) => s.combat!.cards[i]!.defId === "STRIKE_RED")
      ) {
        s = play(s, "STRIKE_RED", 0);
      }
      if (!mon(s, 0).isDead) s = endTurn(s);
    }
    expect(mon(s, 0).isDead).toBe(true);
    expect(playerPower(s, "VULNERABLE")?.amount).toBe(2);
  });
});

// ------------------------------------------------------------------------------
// Slavers
// ------------------------------------------------------------------------------

describe("Blue Slaver", () => {
  test("HP: [46,50] A0, [48,52] A7", () => {
    expectHpRange("BLUE_SLAVER", 0, 46, 50);
    expectHpRange("BLUE_SLAVER", 7, 48, 52);
  });

  test("Stab 12/13(A2); Rake 7/8(A2) + Weak 1 (A17: 2)", () => {
    expectMoveDamage("BLUE_SLAVER", "BLUE_SLAVER_STAB", 12);
    expectMoveDamage("BLUE_SLAVER", "BLUE_SLAVER_STAB", 13, 1, { asc: 2 });
    expectMoveDamage("BLUE_SLAVER", "BLUE_SLAVER_RAKE", 7);
    for (const [asc, weak] of [
      [0, 1],
      [17, 2],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["BLUE_SLAVER"], { seed, asc });
        if (mon(s).move === "BLUE_SLAVER_RAKE") {
          s = endTurn(s);
          expect(playerPower(s, "WEAK")?.amount).toBe(weak);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }
  });

  test("history: Stab never 3x; Rake never 3x (A0); A17 (adjudicated): Rake never 2x", () => {
    for (const moves of moveSequences("BLUE_SLAVER")) {
      expect(maxRunLength(moves, "BLUE_SLAVER_STAB")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "BLUE_SLAVER_RAKE")).toBeLessThanOrEqual(2);
    }
    for (const moves of moveSequences("BLUE_SLAVER", { asc: 17 })) {
      expect(maxRunLength(moves, "BLUE_SLAVER_RAKE")).toBeLessThanOrEqual(1);
    }
  });
});

describe("Red Slaver", () => {
  test("HP: [46,50] A0, [48,52] A7", () => {
    expectHpRange("RED_SLAVER", 0, 46, 50);
    expectHpRange("RED_SLAVER", 7, 48, 52);
  });

  test("always Stab turn 1 (13 A0 / 14 A2); Scrape 8 + Vulnerable 1 (A17: 2)", () => {
    for (const seed of SEEDS) expect(mon(fight(["RED_SLAVER"], { seed })).move).toBe("RED_SLAVER_STAB");
    expectMoveDamage("RED_SLAVER", "RED_SLAVER_STAB", 13);
    expectMoveDamage("RED_SLAVER", "RED_SLAVER_STAB", 14, 1, { asc: 2 });
    expectMoveDamage("RED_SLAVER", "RED_SLAVER_SCRAPE", 8);
    let found = false;
    for (const seed of SEEDS) {
      let s = fight(["RED_SLAVER"], { seed, asc: 17 });
      for (let t = 0; t < 10; t++) {
        if (mon(s).move === "RED_SLAVER_SCRAPE" && !playerPower(s, "VULNERABLE")) {
          s = endTurn(s);
          expect(playerPower(s, "VULNERABLE")?.amount).toBe(2);
          found = true;
          break;
        }
        s = endTurn(s);
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });

  test("Entangle at most once per combat (adjudicated); Entangled blocks Attacks for one turn", () => {
    let sawEntangle = false;
    for (const seed of SEEDS) {
      let s = fight(["RED_SLAVER"], { seed, deck: strikeDeck.slice(0, 5).concat(defendDeck.slice(0, 5)) });
      let entangles = 0;
      for (let t = 0; t < 20; t++) {
        if (mon(s).move === "RED_SLAVER_ENTANGLE") {
          entangles++;
          s = endTurn(s);
          expect(playerPower(s, "ENTANGLED")?.amount).toBe(1);
          if (!sawEntangle) {
            sawEntangle = true;
            expect(() => play(s, "STRIKE_RED", 0)).toThrow(); // attacks vetoed
            if (s.combat!.player.piles.hand.some((i) => s.combat!.cards[i]!.defId === "DEFEND_RED")) {
              s = play(s, "DEFEND_RED"); // skills still playable
            }
            s = endTurn(s);
            expect(playerPower(s, "ENTANGLED")).toBeUndefined(); // wears off after one turn
          }
        } else {
          s = endTurn(s);
        }
      }
      expect(entangles).toBeLessThanOrEqual(1);
    }
    expect(sawEntangle).toBe(true);
  });

  test("history: Scrape never 3x (A0); A17 (adjudicated): Scrape never 2x", () => {
    for (const moves of moveSequences("RED_SLAVER")) {
      expect(maxRunLength(moves, "RED_SLAVER_SCRAPE")).toBeLessThanOrEqual(2);
    }
    for (const moves of moveSequences("RED_SLAVER", { asc: 17 })) {
      expect(maxRunLength(moves, "RED_SLAVER_SCRAPE")).toBeLessThanOrEqual(1);
    }
  });
});

// ------------------------------------------------------------------------------
// Gremlin Nob (elite)
// ------------------------------------------------------------------------------

describe("Gremlin Nob", () => {
  test("HP: [82,86] A0, [85,90] A8", () => {
    expectHpRange("GREMLIN_NOB", 0, 82, 86);
    expectHpRange("GREMLIN_NOB", 8, 85, 90);
  });

  test("Bellow turn 1 -> Enrage 2 (A18: 3); playing a Skill grants Strength", () => {
    let s = fight(["GREMLIN_NOB"], { seed: "NOB" });
    expect(mon(s).move).toBe("GREMLIN_NOB_BELLOW");
    s = endTurn(s);
    expect(monPower(s, 0, "ENRAGE")?.amount).toBe(2);
    s = play(s, "DEFEND_RED");
    expect(monPower(s, 0, "STRENGTH")?.amount).toBe(2);
    const s18 = endTurn(fight(["GREMLIN_NOB"], { asc: 18 }));
    expect(monPower(s18, 0, "ENRAGE")?.amount).toBe(3);
  });

  test("damage: Rush 14 (A0) / 16 (A3); Skull Bash 6 + Vulnerable 2", () => {
    expectMoveDamage("GREMLIN_NOB", "GREMLIN_NOB_RUSH", 14);
    expectMoveDamage("GREMLIN_NOB", "GREMLIN_NOB_RUSH", 16, 1, { asc: 3 });
    expectMoveDamage("GREMLIN_NOB", "GREMLIN_NOB_SKULL_BASH", 6);
    let found = false;
    for (const seed of SEEDS) {
      let s = fight(["GREMLIN_NOB"], { seed });
      for (let t = 0; t < 10; t++) {
        if (mon(s).move === "GREMLIN_NOB_SKULL_BASH" && !playerPower(s, "VULNERABLE")) {
          s = endTurn(s);
          expect(playerPower(s, "VULNERABLE")?.amount).toBe(2);
          found = true;
          break;
        }
        s = endTurn(s);
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });

  test("history A0: Bellow only turn 1; Rush never 3x (forced Skull Bash)", () => {
    for (const moves of moveSequences("GREMLIN_NOB")) {
      expect(moves[0]).toBe("GREMLIN_NOB_BELLOW");
      expect(moves.slice(1).includes("GREMLIN_NOB_BELLOW")).toBe(false);
      expect(maxRunLength(moves, "GREMLIN_NOB_RUSH")).toBeLessThanOrEqual(2);
      for (let i = 2; i < moves.length; i++) {
        if (moves[i - 2] === "GREMLIN_NOB_RUSH" && moves[i - 1] === "GREMLIN_NOB_RUSH") {
          expect(moves[i]).toBe("GREMLIN_NOB_SKULL_BASH");
        }
      }
    }
  });

  test("A18 (adjudicated): Bellow, then repeating [Skull Bash, Rush, Rush] — never Rush-forever", () => {
    const want = ["GREMLIN_NOB_BELLOW"];
    for (let i = 0; i < 5; i++) want.push("GREMLIN_NOB_SKULL_BASH", "GREMLIN_NOB_RUSH", "GREMLIN_NOB_RUSH");
    for (const moves of moveSequences("GREMLIN_NOB", { asc: 18, turns: 16 })) {
      expect(moves).toEqual(want.slice(0, moves.length));
    }
  });
});

// ------------------------------------------------------------------------------
// Lagavulin (elite)
// ------------------------------------------------------------------------------

describe("Lagavulin", () => {
  test("HP: [109,111] A0, [112,115] A8", () => {
    expectHpRange("LAGAVULIN", 0, 109, 111);
    expectHpRange("LAGAVULIN", 8, 112, 115);
  });

  test("undisturbed: sleeps turns 1-3 (8 block + Metallicize 8), wakes turn 4, cycle A,A,Siphon", () => {
    let s = fight(["LAGAVULIN"], { seed: "LAG" });
    expect(mon(s).block).toBe(8);
    expect(monPower(s, 0, "ASLEEP")).toBeDefined();
    expect(monPower(s, 0, "METALLICIZE")?.amount).toBe(8);
    const seen: string[] = [];
    for (let t = 0; t < 9; t++) {
      seen.push(mon(s).move!);
      s = endTurn(s);
    }
    expect(seen).toEqual([
      "LAGAVULIN_SLEEP",
      "LAGAVULIN_SLEEP",
      "LAGAVULIN_SLEEP",
      "LAGAVULIN_ATTACK",
      "LAGAVULIN_ATTACK",
      "LAGAVULIN_SIPHON_SOUL",
      "LAGAVULIN_ATTACK",
      "LAGAVULIN_ATTACK",
      "LAGAVULIN_SIPHON_SOUL",
    ]);
    // natural wake removed ASLEEP and Metallicize (corpus adjudication)
    expect(monPower(s, 0, "ASLEEP")).toBeUndefined();
    expect(monPower(s, 0, "METALLICIZE")).toBeUndefined();
    expect(playerPower(s, "STRENGTH")?.amount).toBe(-2); // two Siphon Souls
    expect(playerPower(s, "DEXTERITY")?.amount).toBe(-2);
  });

  test("Attack deals 18 (A0) / 20 (A3); Siphon Soul -2/-2 at A18", () => {
    let s = fight(["LAGAVULIN"], { seed: "LAGDMG" });
    for (let t = 0; t < 3; t++) s = endTurn(s); // sleep out
    expect(mon(s).move).toBe("LAGAVULIN_ATTACK");
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(18);
    let s3 = fight(["LAGAVULIN"], { asc: 3 });
    for (let t = 0; t < 3; t++) s3 = endTurn(s3);
    const hp1 = s3.run.hp;
    s3 = endTurn(s3);
    expect(hp1 - s3.run.hp).toBe(20);
    let s18 = fight(["LAGAVULIN"], { asc: 18 });
    for (let t = 0; t < 6; t++) s18 = endTurn(s18); // S,S,S,A,A,Siphon
    expect(playerPower(s18, "STRENGTH")?.amount).toBe(-2);
    expect(playerPower(s18, "DEXTERITY")?.amount).toBe(-2);
  });

  test("wakes early on HP loss: ASLEEP + Metallicize removed, queued Sleep still executes, then attacks", () => {
    let s = fight(["LAGAVULIN"], { seed: "WAKE", deck: strikeDeck });
    s = play(s, "STRIKE_RED", 0); // 6 fully blocked by the 8 starting block
    expect(monPower(s, 0, "ASLEEP")).toBeDefined();
    s = play(s, "STRIKE_RED", 0); // 2 blocked, 4 HP lost -> wake
    expect(monPower(s, 0, "ASLEEP")).toBeUndefined();
    expect(monPower(s, 0, "METALLICIZE")).toBeUndefined();
    expect(mon(s).move).toBe("LAGAVULIN_SLEEP"); // queued sleep unchanged this turn
    s = endTurn(s);
    expect(mon(s).block).toBe(0); // no Metallicize block after waking
    expect(mon(s).move).toBe("LAGAVULIN_ATTACK");
  });

  test("history: Attack never 3x, Siphon Soul never 2x", () => {
    for (const moves of moveSequences("LAGAVULIN", { turns: 18 })) {
      expect(maxRunLength(moves, "LAGAVULIN_ATTACK")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "LAGAVULIN_SIPHON_SOUL")).toBeLessThanOrEqual(1);
    }
  });
});

// ------------------------------------------------------------------------------
// Sentry (elite)
// ------------------------------------------------------------------------------

describe("Sentry", () => {
  test("HP: [38,42] A0, [39,45] A8", () => {
    expectHpRange("SENTRY", 0, 38, 42);
    expectHpRange("SENTRY", 8, 39, 45);
  });

  test("position parity: [Bolt, Beam, Bolt] openers; strict alternation; Artifact 1 each", () => {
    let s = fight(["SENTRY", "SENTRY", "SENTRY"], { seed: "SENTRIES" });
    for (const idx of [0, 1, 2]) expect(monPower(s, idx, "ARTIFACT")?.amount).toBe(1);
    const wantFirst = ["SENTRY_BOLT", "SENTRY_BEAM", "SENTRY_BOLT"];
    for (const idx of [0, 1, 2]) expect(mon(s, idx).move).toBe(wantFirst[idx]!);
    let prev = wantFirst;
    for (let t = 0; t < 8; t++) {
      s = endTurn(s);
      const cur = [0, 1, 2].map((i) => mon(s, i).move!);
      for (const idx of [0, 1, 2]) {
        expect(cur[idx]).toBe(prev[idx] === "SENTRY_BOLT" ? "SENTRY_BEAM" : "SENTRY_BOLT");
      }
      prev = cur;
    }
  });

  test("Bolt shuffles 2 Dazed (A18: 3) into discard; Beam deals 9 (A0) / 10 (A3)", () => {
    const s = endTurn(fight(["SENTRY", "SENTRY", "SENTRY"])); // two Bolts on turn 1
    expect(countCards(s, "DAZED")).toBe(4);
    const s18 = endTurn(fight(["SENTRY", "SENTRY", "SENTRY"], { asc: 18 }));
    expect(countCards(s18, "DAZED")).toBe(6);
    // solo sentry at slot 0 opens with Bolt; turn 2 is Beam
    let solo = endTurn(fight(["SENTRY"]));
    expect(mon(solo).move).toBe("SENTRY_BEAM");
    const hp0 = solo.run.hp;
    solo = endTurn(solo);
    expect(hp0 - solo.run.hp).toBe(9);
    let solo3 = endTurn(fight(["SENTRY"], { asc: 3 }));
    const hp1 = solo3.run.hp;
    solo3 = endTurn(solo3);
    expect(hp1 - solo3.run.hp).toBe(10);
  });

  test("Artifact negates the first debuff (Bash Vulnerable)", () => {
    let s = fight(["SENTRY"], { seed: "ART", deck: Array(10).fill({ defId: "BASH" }) });
    s = play(s, "BASH", 0);
    expect(monPower(s, 0, "VULNERABLE")).toBeUndefined();
    expect(monPower(s, 0, "ARTIFACT")).toBeUndefined();
  });
});

// ------------------------------------------------------------------------------
// Slime Boss
// ------------------------------------------------------------------------------

describe("Slime Boss", () => {
  test("HP: 140 A0, 150 A9", () => {
    expectHpRange("SLIME_BOSS", 0, 140, 140);
    expectHpRange("SLIME_BOSS", 9, 150, 150);
  });

  test("fixed loop Goop Spray (3 Slimed; A19: 5) -> Preparing -> Slam (35; A4: 38)", () => {
    for (const moves of moveSequences("SLIME_BOSS", { turns: 15 })) {
      const loop = ["SLIME_BOSS_GOOP_SPRAY", "SLIME_BOSS_PREPARING", "SLIME_BOSS_SLAM"];
      moves.forEach((m, i) => expect(m).toBe(loop[i % 3]!));
    }
    let s = endTurn(fight(["SLIME_BOSS"]));
    expect(countCards(s, "SLIMED")).toBe(3);
    expect(countCards(endTurn(fight(["SLIME_BOSS"], { asc: 19 })), "SLIMED")).toBe(5);
    s = endTurn(s); // Preparing
    const hp0 = s.run.hp;
    s = endTurn(s); // Slam
    expect(hp0 - s.run.hp).toBe(35);
    let s4 = fight(["SLIME_BOSS"], { asc: 4 });
    for (let t = 0; t < 2; t++) s4 = endTurn(s4);
    const hp1 = s4.run.hp;
    s4 = endTurn(s4);
    expect(hp1 - s4.run.hp).toBe(38);
  });

  test("split at <=50%: intent interrupted; Spike Slime (L) slot 0 + Acid Slime (L) slot 2 at boss HP", () => {
    let s = fight(["SLIME_BOSS"], { seed: "BOSSSPLIT", deck: strikeDeck });
    const half = Math.floor(mon(s).maxHp / 2); // 70
    expect(half).toBe(70);
    let splitHp = -1;
    outer: for (let t = 0; t < 20; t++) {
      while (s.combat!.player.energy > 0 && s.combat!.player.piles.hand.some((i) => s.combat!.cards[i]!.defId === "STRIKE_RED")) {
        const intentBefore = mon(s).move;
        s = play(s, "STRIKE_RED", 0);
        if (mon(s).hp <= half) {
          expect(intentBefore).not.toBe("SLIME_BOSS_SPLIT");
          expect(mon(s).move).toBe("SLIME_BOSS_SPLIT");
          splitHp = mon(s).hp;
          break outer;
        }
      }
      s = endTurn(s);
    }
    expect(splitHp).toBeGreaterThan(0);
    s = endTurn(s);
    expect(s.combat!.monsters.length).toBe(3);
    expect(mon(s, 0).id).toBe("SPIKE_SLIME_L");
    expect(mon(s, 2).id).toBe("ACID_SLIME_L");
    for (const idx of [0, 2]) {
      expect(mon(s, idx).hp).toBe(splitHp);
      expect(mon(s, idx).maxHp).toBe(splitHp);
      expect(mon(s, idx).move).not.toBeNull();
    }
    expect(mon(s, 1).isEscaped).toBe(true); // inert gap slot between the spawns

    // the spawned large slimes split again at half their inherited maxHp
    const spikeHalf = Math.floor(splitHp / 2);
    let spikeSplitHp = -1;
    outer2: for (let t = 0; t < 20; t++) {
      while (
        !mon(s, 0).isEscaped &&
        s.combat!.player.energy > 0 &&
        s.combat!.player.piles.hand.some((i) => s.combat!.cards[i]!.defId === "STRIKE_RED")
      ) {
        s = play(s, "STRIKE_RED", 0);
        if (mon(s, 0).id === "SPIKE_SLIME_L" && mon(s, 0).hp <= spikeHalf) {
          expect(mon(s, 0).move).toBe("SPIKE_SLIME_L_SPLIT");
          spikeSplitHp = mon(s, 0).hp;
          break outer2;
        }
      }
      s = endTurn(s);
    }
    expect(spikeSplitHp).toBeGreaterThan(0);
    s = endTurn(s);
    expect(mon(s, 0).id).toBe("SPIKE_SLIME_M");
    expect(mon(s, 1).id).toBe("SPIKE_SLIME_M");
    expect(mon(s, 0).hp).toBe(spikeSplitHp);
    expect(mon(s, 1).hp).toBe(spikeSplitHp);
    expect(mon(s, 2).id).toBe("ACID_SLIME_L"); // untouched
  });
});

// ------------------------------------------------------------------------------
// The Guardian
// ------------------------------------------------------------------------------

describe("The Guardian", () => {
  test("HP: 240 A0, 250 A9; Mode Shift 30/35(A9)/40(A19)", () => {
    expectHpRange("THE_GUARDIAN", 0, 240, 240);
    expectHpRange("THE_GUARDIAN", 9, 250, 250);
    expect(monPower(fight(["THE_GUARDIAN"]), 0, "MODE_SHIFT")?.amount).toBe(30);
    expect(monPower(fight(["THE_GUARDIAN"], { asc: 9 }), 0, "MODE_SHIFT")?.amount).toBe(35);
    expect(monPower(fight(["THE_GUARDIAN"], { asc: 19 }), 0, "MODE_SHIFT")?.amount).toBe(40);
  });

  test("offensive loop + exact damage: Charge Up (block 9), Fierce Bash 32, Vent Steam, Whirlwind 5x4", () => {
    let s = fight(["THE_GUARDIAN"], { seed: "GRD" });
    expect(mon(s).move).toBe("THE_GUARDIAN_CHARGING_UP");
    s = endTurn(s);
    expect(mon(s).block).toBe(9);
    expect(mon(s).move).toBe("THE_GUARDIAN_FIERCE_BASH");
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(32);
    expect(mon(s).move).toBe("THE_GUARDIAN_VENT_STEAM");
    s = endTurn(s);
    expect(playerPower(s, "VULNERABLE")?.amount).toBe(2);
    expect(playerPower(s, "WEAK")?.amount).toBe(2);
    expect(mon(s).move).toBe("THE_GUARDIAN_WHIRLWIND");
    const hp1 = s.run.hp;
    s = endTurn(s);
    expect(hp1 - s.run.hp).toBe(7 * 4); // floor(5 * 1.5 Vulnerable) per hit
    expect(mon(s).move).toBe("THE_GUARDIAN_CHARGING_UP"); // loop closes
  });

  test("mode shift: 30 damage -> Defensive Mode interrupt, 20 block, +10 per shift, 20-block defensive sequence", () => {
    let s = fight(["THE_GUARDIAN"], { seed: "SHIFT", deck: strikeDeck });
    let shifted = false;
    outer: for (let t = 0; t < 10; t++) {
      while (s.combat!.player.energy > 0 && s.combat!.player.piles.hand.some((i) => s.combat!.cards[i]!.defId === "STRIKE_RED")) {
        s = play(s, "STRIKE_RED", 0);
        if (!monPower(s, 0, "MODE_SHIFT")) {
          shifted = true;
          break outer;
        }
      }
      s = endTurn(s);
    }
    expect(shifted).toBe(true);
    expect(mon(s).block).toBe(20);
    expect(mon(s).move).toBe("THE_GUARDIAN_DEFENSIVE_MODE");
    s = endTurn(s); // Defensive Mode: Sharp Hide 3 (stub power in this test bundle)
    expect(monPower(s, 0, "SHARP_HIDE")?.amount).toBe(3);
    expect(mon(s).move).toBe("THE_GUARDIAN_ROLL_ATTACK");
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(9);
    expect(mon(s).move).toBe("THE_GUARDIAN_TWIN_SLAM");
    const hp1 = s.run.hp;
    s = endTurn(s); // Twin Slam: 8x2, Sharp Hide removed, Mode Shift re-gained at 40
    expect(hp1 - s.run.hp).toBe(16);
    expect(monPower(s, 0, "SHARP_HIDE")).toBeUndefined();
    expect(monPower(s, 0, "MODE_SHIFT")?.amount).toBe(40);
    expect(mon(s).move).toBe("THE_GUARDIAN_WHIRLWIND"); // re-enters offensive loop at Whirlwind
    s = endTurn(s);
    expect(mon(s).move).toBe("THE_GUARDIAN_CHARGING_UP");
  });

  test("A4 damage tier: Fierce Bash 36, Roll Attack 10", () => {
    let s = endTurn(fight(["THE_GUARDIAN"], { asc: 4 }));
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(36);
  });
});

// ------------------------------------------------------------------------------
// Hexaghost
// ------------------------------------------------------------------------------

describe("Hexaghost", () => {
  test("HP: 250 A0, 264 A9", () => {
    expectHpRange("HEXAGHOST", 0, 250, 250);
    expectHpRange("HEXAGHOST", 9, 264, 264);
  });

  test("turn 1 Activate, turn 2 Divider = (floor(playerHP/12)+1) x6", () => {
    let s = fight(["HEXAGHOST"], { seed: "HEX", hp: 5000 });
    expect(mon(s).move).toBe("HEXAGHOST_ACTIVATE");
    s = endTurn(s);
    expect(mon(s).data.dividerDamage).toBe(Math.floor(5000 / 12) + 1); // 417
    expect(mon(s).move).toBe("HEXAGHOST_DIVIDER");
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe((Math.floor(5000 / 12) + 1) * 6); // 2502
  });

  test("fixed 7-move loop [Sear, Tackle, Sear, Inflame, Tackle, Sear, Inferno] with no randomness", () => {
    const loop = [
      "HEXAGHOST_SEAR",
      "HEXAGHOST_TACKLE",
      "HEXAGHOST_SEAR",
      "HEXAGHOST_INFLAME",
      "HEXAGHOST_TACKLE",
      "HEXAGHOST_SEAR",
      "HEXAGHOST_INFERNO",
    ];
    for (const moves of moveSequences("HEXAGHOST", { turns: 18 })) {
      expect(moves[0]).toBe("HEXAGHOST_ACTIVATE");
      expect(moves[1]).toBe("HEXAGHOST_DIVIDER");
      for (let i = 2; i < moves.length; i++) expect(moves[i]).toBe(loop[(i - 2) % 7]!);
    }
  });

  // Burns drawn into hand deal their self-damage at end of turn (2, or 4 upgraded);
  // round HP deltas include that on top of the monster's attack.
  const burnDamageInHand = (st: ReturnType<typeof fight>): number =>
    st.combat!.player.piles.hand.reduce((sum: number, iid: number) => {
      const c = st.combat!.cards[iid]!;
      return c.defId === "BURN" ? sum + (c.upgrades > 0 ? 4 : 2) : sum;
    }, 0);

  test("exact damage & effects through the loop (A0): Sear 6+Burn, Tackle 5x2, Inflame +12/+2, Inferno 2x6", () => {
    let s = fight(["HEXAGHOST"], { seed: "HEXDMG" });
    s = endTurn(s); // Activate
    s = endTurn(s); // Divider
    const hp2 = s.run.hp;
    const b2 = burnDamageInHand(s);
    s = endTurn(s); // turn 3 Sear: 6
    expect(hp2 - s.run.hp).toBe(6 + b2);
    expect(countCards(s, "BURN", 0)).toBe(1);
    const hp3 = s.run.hp;
    const b3 = burnDamageInHand(s);
    s = endTurn(s); // turn 4 Tackle: 5x2
    expect(hp3 - s.run.hp).toBe(10 + b3);
    const hp4 = s.run.hp;
    const b4 = burnDamageInHand(s);
    s = endTurn(s); // turn 5 Sear
    expect(hp4 - s.run.hp).toBe(6 + b4);
    s = endTurn(s); // turn 6 Inflame
    expect(mon(s).block).toBe(12);
    expect(monPower(s, 0, "STRENGTH")?.amount).toBe(2);
    const hp6 = s.run.hp;
    const b6 = burnDamageInHand(s);
    s = endTurn(s); // turn 7 Tackle at Str 2: 7x2
    expect(hp6 - s.run.hp).toBe(14 + b6);
    const hp7 = s.run.hp;
    const b7 = burnDamageInHand(s);
    s = endTurn(s); // turn 8 Sear at Str 2: 8
    expect(hp7 - s.run.hp).toBe(8 + b7);
    const hp8 = s.run.hp;
    const b8 = burnDamageInHand(s);
    s = endTurn(s); // turn 9 Inferno at Str 2: 4x6
    expect(hp8 - s.run.hp).toBe(24 + b8);
    // Sears from game turn 10 onward create upgraded Burns
    s = endTurn(s); // turn 10 Sear -> Burn+
    expect(countCards(s, "BURN", 1)).toBe(1);
    expect(countCards(s, "BURN")).toBe(4);
  });

  test("A4 damage tier (Tackle 6x2, Inferno 3x6) and A19 effects (2 Burns per Sear, Inflame +3)", () => {
    let s = fight(["HEXAGHOST"], { asc: 4 });
    for (let t = 0; t < 3; t++) s = endTurn(s); // Activate, Divider, Sear
    const hp0 = s.run.hp;
    const b0 = burnDamageInHand(s);
    s = endTurn(s); // Tackle 6x2
    expect(hp0 - s.run.hp).toBe(12 + b0);
    let s19 = fight(["HEXAGHOST"], { asc: 19 });
    for (let t = 0; t < 3; t++) s19 = endTurn(s19);
    expect(countCards(s19, "BURN")).toBe(2);
    for (let t = 0; t < 3; t++) s19 = endTurn(s19); // Tackle, Sear, Inflame
    expect(monPower(s19, 0, "STRENGTH")?.amount).toBe(3);
  });
});
