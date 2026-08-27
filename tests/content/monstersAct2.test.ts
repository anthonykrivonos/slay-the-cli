// Act-2 monster content tests - every corpus entity: HP bands (A0 + A7/8/9 by
// category), exact move damage/effects through real combats, first-turn rules,
// seed-swept property tests of the corpus historyRules, and the boss/elite
// specifics (Champ phase 2, Collector re-summon, Automaton beam cycle, Gremlin
// Leader rally slots, Mugger stolen gold, Bronze Orb stasis round-trip).

import { test, expect, describe } from "bun:test";
import { createCombatGame, advance, type GameState } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content/index";
import { act2Monsters, act2Powers } from "../../src/content/monsters/act2/index";
import type { CardDef, ContentBundle } from "../../src/engine/content/defs";

// ------------------------------------------------------------------------------
// bundle: base content + act-2 monsters/powers + stubs for parallel workstreams
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
  for (const m of act2Monsters) b.monsters.set(m.id, m);
  for (const p of act2Powers) if (!b.powers.has(p.id)) b.powers.set(p.id, p);
  for (const id of ["SLIMED", "DAZED", "BURN", "WOUND"]) {
    if (!b.cards.has(id)) b.cards.set(id, stubStatus(id));
  }
  return b;
}

const bundle = makeBundle();
const SEEDS = Array.from({ length: 20 }, (_, i) => `A2SEED${i}`);
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

const canPlay = (s: GameState, name: string): boolean =>
  s.combat!.player.energy > 0 && s.combat!.player.piles.hand.some((i) => s.combat!.cards[i]!.defId === name);

const mon = (s: GameState, idx = 0) => s.combat!.monsters[idx]!;
const monPower = (s: GameState, idx: number, id: string) => mon(s, idx).powers.find((p) => p.id === id);
const playerPower = (s: GameState, id: string) => s.combat!.player.powers.find((p) => p.id === id);
const countCards = (s: GameState, defId: string) =>
  Object.values(s.combat!.cards).filter((c) => c.defId === defId).length;
const countInPile = (s: GameState, pile: "draw" | "hand" | "discard" | "exhaust", defId: string) =>
  s.combat!.player.piles[pile].filter((iid) => s.combat!.cards[iid]!.defId === defId).length;

function expectHpRange(monsterId: string, asc: number, lo: number, hi: number): void {
  for (const seed of SEEDS.slice(0, 6)) {
    // by id, not slot: some encounters seat their boss away from slot 0
    const m = fight([monsterId], { seed, asc }).combat!.monsters.find((x) => x.id === monsterId)!;
    expect(m.maxHp).toBeGreaterThanOrEqual(lo);
    expect(m.maxHp).toBeLessThanOrEqual(hi);
  }
}

/** Executed-move sequences (the intent before each endTurn) across seeds. */
function moveSequences(monsters: string[], idx: number, opts: FightOpts & { turns?: number } = {}): string[][] {
  const turns = opts.turns ?? 18;
  return SEEDS.map((seed) => {
    let s = fight(monsters, { ...opts, seed });
    const moves: string[] = [];
    for (let t = 0; t < turns; t++) {
      const m = mon(s, idx);
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
 * (expected base + the monster's current Strength) x hits. Solo fights only.
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
// Spheric Guardian
// ------------------------------------------------------------------------------

describe("Spheric Guardian", () => {
  test("HP fixed at 20 at every ascension (adjudicated)", () => {
    expectHpRange("SPHERIC_GUARDIAN", 0, 20, 20);
    expectHpRange("SPHERIC_GUARDIAN", 7, 20, 20);
    expectHpRange("SPHERIC_GUARDIAN", 17, 20, 20);
  });

  test("prebattle: Artifact 3, Barricade, 40 block; Activate +25 (A17: +35) and block never expires", () => {
    let s = fight(["SPHERIC_GUARDIAN"], { seed: "SPH" });
    expect(monPower(s, 0, "ARTIFACT")?.amount).toBe(3);
    expect(monPower(s, 0, "BARRICADE")).toBeDefined();
    expect(mon(s).block).toBe(40);
    expect(mon(s).move).toBe("SPHERIC_GUARDIAN_ACTIVATE");
    s = endTurn(s);
    expect(mon(s).block).toBe(65); // 40 kept + 25
    s = endTurn(s); // ATTACK_DEBUFF: block still kept
    expect(mon(s).block).toBe(65);
    const s17 = endTurn(fight(["SPHERIC_GUARDIAN"], { asc: 17 }));
    expect(mon(s17).block).toBe(75);
  });

  test("fixed script: ACTIVATE, ATTACK_DEBUFF, then SLAM/HARDEN alternating forever", () => {
    for (const moves of moveSequences(["SPHERIC_GUARDIAN"], 0, { turns: 12 })) {
      expect(moves[0]).toBe("SPHERIC_GUARDIAN_ACTIVATE");
      expect(moves[1]).toBe("SPHERIC_GUARDIAN_ATTACK_DEBUFF");
      for (let i = 2; i < moves.length; i++) {
        expect(moves[i]).toBe(i % 2 === 0 ? "SPHERIC_GUARDIAN_SLAM" : "SPHERIC_GUARDIAN_HARDEN");
      }
    }
  });

  test("damage & effects: Attack/Debuff 10 + Frail 5, Slam 10x2, Harden 10 + 15 block; A2: 11s", () => {
    let s = fight(["SPHERIC_GUARDIAN"], { seed: "SPHDMG" });
    s = endTurn(s); // ACTIVATE
    const hp1 = s.run.hp;
    s = endTurn(s); // ATTACK_DEBUFF
    expect(hp1 - s.run.hp).toBe(10);
    expect(playerPower(s, "FRAIL")?.amount).toBe(5);
    const hp2 = s.run.hp;
    s = endTurn(s); // SLAM 10x2
    expect(hp2 - s.run.hp).toBe(20);
    const blockBefore = mon(s).block;
    const hp3 = s.run.hp;
    s = endTurn(s); // HARDEN
    expect(hp3 - s.run.hp).toBe(10);
    expect(mon(s).block).toBe(blockBefore + 15);
    let s2 = fight(["SPHERIC_GUARDIAN"], { asc: 2 });
    s2 = endTurn(s2);
    const hp0 = s2.run.hp;
    s2 = endTurn(s2);
    expect(hp0 - s2.run.hp).toBe(11);
  });
});

// ------------------------------------------------------------------------------
// Chosen
// ------------------------------------------------------------------------------

describe("Chosen", () => {
  test("HP: [95,99] A0, [98,103] A7", () => {
    expectHpRange("CHOSEN", 0, 95, 99);
    expectHpRange("CHOSEN", 7, 98, 103);
  });

  test("A<17: turn 1 Poke, turn 2 Hex, then strict debuff/attack alternation", () => {
    const debuffs = ["CHOSEN_DEBILITATE", "CHOSEN_DRAIN"];
    const attacks = ["CHOSEN_ZAP", "CHOSEN_POKE"];
    for (const moves of moveSequences(["CHOSEN"], 0)) {
      expect(moves[0]).toBe("CHOSEN_POKE");
      expect(moves[1]).toBe("CHOSEN_HEX");
      for (let i = 2; i < moves.length; i++) {
        expect(i % 2 === 0 ? debuffs : attacks).toContain(moves[i]!);
      }
    }
  });

  test("A17: turn 1 Hex, then debuff/attack alternation starting with a debuff", () => {
    const debuffs = ["CHOSEN_DEBILITATE", "CHOSEN_DRAIN"];
    const attacks = ["CHOSEN_ZAP", "CHOSEN_POKE"];
    for (const moves of moveSequences(["CHOSEN"], 0, { asc: 17 })) {
      expect(moves[0]).toBe("CHOSEN_HEX");
      for (let i = 1; i < moves.length; i++) {
        expect(i % 2 === 1 ? debuffs : attacks).toContain(moves[i]!);
      }
    }
  });

  test("Hex: playing a non-Attack shuffles a Dazed into draw; Attacks don't trigger it", () => {
    let s = fight(["CHOSEN"], { asc: 17, seed: "HEX", deck: [...defendDeck.slice(0, 5), ...strikeDeck.slice(0, 5)] });
    s = endTurn(s); // HEX executes
    expect(playerPower(s, "HEX")?.amount).toBe(1);
    const before = countCards(s, "DAZED");
    if (canPlay(s, "STRIKE_RED")) {
      s = play(s, "STRIKE_RED", 0);
      expect(countCards(s, "DAZED")).toBe(before); // attack: no trigger
    }
    if (canPlay(s, "DEFEND_RED")) {
      s = play(s, "DEFEND_RED");
      expect(countCards(s, "DAZED")).toBe(before + 1);
      expect(countInPile(s, "draw", "DAZED")).toBeGreaterThanOrEqual(1);
    }
  });

  test("damage: Poke 5x2, Zap 18, Debilitate 10 + Vulnerable 2, Drain Weak 3 + Str 3; A2: 6/21/12", () => {
    expectMoveDamage("CHOSEN", "CHOSEN_POKE", 5, 2);
    expectMoveDamage("CHOSEN", "CHOSEN_ZAP", 18);
    expectMoveDamage("CHOSEN", "CHOSEN_DEBILITATE", 10);
    expectMoveDamage("CHOSEN", "CHOSEN_POKE", 6, 2, { asc: 2 });
    expectMoveDamage("CHOSEN", "CHOSEN_ZAP", 21, 1, { asc: 2 });
    expectMoveDamage("CHOSEN", "CHOSEN_DEBILITATE", 12, 1, { asc: 2 });
    let found = false;
    for (const seed of SEEDS) {
      let s = fight(["CHOSEN"], { seed });
      for (let t = 0; t < 8 && !found; t++) {
        if (mon(s).move === "CHOSEN_DEBILITATE" && !playerPower(s, "VULNERABLE")) {
          s = endTurn(s);
          expect(playerPower(s, "VULNERABLE")?.amount).toBe(2);
          found = true;
          break;
        }
        if (mon(s).move === "CHOSEN_DRAIN" && !playerPower(s, "WEAK")) {
          const str = monPower(s, 0, "STRENGTH")?.amount ?? 0;
          s = endTurn(s);
          expect(playerPower(s, "WEAK")?.amount).toBe(3);
          expect(monPower(s, 0, "STRENGTH")?.amount).toBe(str + 3);
        } else {
          s = endTurn(s);
        }
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });
});

// ------------------------------------------------------------------------------
// Shelled Parasite
// ------------------------------------------------------------------------------

describe("Shelled Parasite", () => {
  test("HP: [68,72] A0, [70,75] A7; prebattle Plated Armor 14 + 14 block", () => {
    expectHpRange("SHELLED_PARASITE", 0, 68, 72);
    expectHpRange("SHELLED_PARASITE", 7, 70, 75);
    const s = fight(["SHELLED_PARASITE"]);
    expect(monPower(s, 0, "PLATED_ARMOR")?.amount).toBe(14);
    expect(mon(s).block).toBe(14);
  });

  test("first turn: never Fell below A17 (both Double Strike and Suck seen); A17 always Fell", () => {
    const first = new Set<string>();
    for (const seed of SEEDS) {
      first.add(mon(fight(["SHELLED_PARASITE"], { seed })).move!);
    }
    expect(first.has("SHELLED_PARASITE_FELL")).toBe(false);
    expect(first.has("SHELLED_PARASITE_DOUBLE_STRIKE")).toBe(true);
    expect(first.has("SHELLED_PARASITE_SUCK")).toBe(true);
    for (const seed of SEEDS.slice(0, 6)) {
      expect(mon(fight(["SHELLED_PARASITE"], { seed, asc: 17 })).move).toBe("SHELLED_PARASITE_FELL");
    }
  });

  test("damage: Fell 18 + Frail 2, Double Strike 6x2; A2: 21/7; Plated Armor re-blocks 14 each turn", () => {
    expectMoveDamage("SHELLED_PARASITE", "SHELLED_PARASITE_DOUBLE_STRIKE", 6, 2);
    expectMoveDamage("SHELLED_PARASITE", "SHELLED_PARASITE_DOUBLE_STRIKE", 7, 2, { asc: 2 });
    let s = fight(["SHELLED_PARASITE"], { asc: 17, seed: "FELL" });
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(21); // A17 implies A2 damage tier
    expect(playerPower(s, "FRAIL")?.amount).toBe(2);
    expect(mon(s).block).toBe(14); // plated armor end-of-its-turn block
  });

  test("Suck deals 10 and heals the parasite for the unblocked damage (capped at maxHp)", () => {
    for (const seed of SEEDS) {
      let s = fight(["SHELLED_PARASITE"], { seed, deck: strikeDeck });
      for (let i = 0; i < 3 && canPlay(s, "STRIKE_RED"); i++) s = play(s, "STRIKE_RED", 0);
      for (let t = 0; t < 12; t++) {
        if (mon(s).move === "SHELLED_PARASITE_SUCK") {
          const before = mon(s).hp;
          const missing = mon(s).maxHp - before;
          expect(missing).toBeGreaterThan(0); // 18 damage into 14 block
          const php = s.run.hp;
          s = endTurn(s);
          expect(php - s.run.hp).toBe(10);
          expect(mon(s).hp - before).toBe(Math.min(10, missing));
          return;
        }
        s = endTurn(s);
      }
    }
    throw new Error("suck never observed");
  });

  test("armor break: the hit that empties Plated Armor stuns; Fell impossible right after", () => {
    const boomerangDeck = Array(10).fill({ defId: "SWORD_BOOMERANG" });
    let s = fight(["SHELLED_PARASITE"], { seed: "BREAK", deck: boomerangDeck });
    let stunned = false;
    outer: for (let t = 0; t < 20; t++) {
      while (canPlay(s, "SWORD_BOOMERANG")) {
        s = play(s, "SWORD_BOOMERANG");
        if (!monPower(s, 0, "PLATED_ARMOR")) {
          expect(mon(s).move).toBe("SHELLED_PARASITE_STUNNED");
          stunned = true;
          break outer;
        }
      }
      s = endTurn(s);
    }
    expect(stunned).toBe(true);
    const php = s.run.hp;
    s = endTurn(s); // stunned turn: no attack
    expect(s.run.hp).toBe(php);
    expect(mon(s).move).not.toBe("SHELLED_PARASITE_FELL"); // stun counts as Fell in history
    expect(["SHELLED_PARASITE_DOUBLE_STRIKE", "SHELLED_PARASITE_SUCK"]).toContain(mon(s).move!);
  });

  test("history: Fell never 2x, Double Strike never 3x, Suck never 3x", () => {
    for (const moves of moveSequences(["SHELLED_PARASITE"], 0)) {
      expect(maxRunLength(moves, "SHELLED_PARASITE_FELL")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "SHELLED_PARASITE_DOUBLE_STRIKE")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "SHELLED_PARASITE_SUCK")).toBeLessThanOrEqual(2);
    }
  });
});

// ------------------------------------------------------------------------------
// Byrd
// ------------------------------------------------------------------------------

describe("Byrd", () => {
  test("HP: [25,31] A0, [26,33] A7; Flight 3 (A17: 4)", () => {
    expectHpRange("BYRD", 0, 25, 31);
    expectHpRange("BYRD", 7, 26, 33);
    expect(monPower(fight(["BYRD"]), 0, "FLIGHT")?.amount).toBe(3);
    expect(monPower(fight(["BYRD"], { asc: 17 }), 0, "FLIGHT")?.amount).toBe(4);
  });

  test("first turn: Caw or Peck across seeds (both observed), never Swoop", () => {
    const first = new Set<string>();
    for (const seed of SEEDS) first.add(mon(fight(["BYRD"], { seed })).move!);
    expect(first.has("BYRD_SWOOP")).toBe(false);
    expect(first.has("BYRD_CAW")).toBe(true);
    expect(first.has("BYRD_PECK")).toBe(true);
  });

  test("Flight halves attack damage, loses 1 per unblocked hit, resets at end of round", () => {
    let s = fight(["BYRD"], { seed: "FLY", deck: strikeDeck });
    const hp0 = mon(s).hp;
    s = play(s, "STRIKE_RED", 0);
    expect(hp0 - mon(s).hp).toBe(3); // floor(6 * 0.5)
    expect(monPower(s, 0, "FLIGHT")?.amount).toBe(2);
    s = play(s, "STRIKE_RED", 0);
    expect(monPower(s, 0, "FLIGHT")?.amount).toBe(1);
    s = endTurn(s);
    expect(monPower(s, 0, "FLIGHT")?.amount).toBe(3); // reset to full
  });

  test("grounding: 3rd hit removes Flight and stuns; full damage while grounded; Headbutt then Fly re-applies", () => {
    let s = fight(["BYRD"], { seed: "GROUND", deck: strikeDeck });
    for (let i = 0; i < 3; i++) s = play(s, "STRIKE_RED", 0);
    expect(monPower(s, 0, "FLIGHT")).toBeUndefined();
    expect(mon(s).move).toBe("BYRD_STUNNED");
    const php = s.run.hp;
    s = endTurn(s); // stunned: no attack
    expect(s.run.hp).toBe(php);
    expect(mon(s).move).toBe("BYRD_HEADBUTT");
    const hpM = mon(s).hp;
    s = play(s, "STRIKE_RED", 0); // grounded: full 6 damage
    expect(hpM - mon(s).hp).toBe(6);
    const php2 = s.run.hp;
    s = endTurn(s); // headbutt 3
    expect(php2 - s.run.hp).toBe(3);
    expect(mon(s).move).toBe("BYRD_FLY");
    s = endTurn(s); // fly: flight back
    expect(monPower(s, 0, "FLIGHT")?.amount).toBe(3);
    expect(["BYRD_PECK", "BYRD_SWOOP", "BYRD_CAW"]).toContain(mon(s).move!);
  });

  test("damage: Peck 1x5 (A2: 1x6), Swoop 12 (A2: 14); Caw gives Strength 1", () => {
    expectMoveDamage("BYRD", "BYRD_PECK", 1, 5);
    expectMoveDamage("BYRD", "BYRD_PECK", 1, 6, { asc: 2 });
    expectMoveDamage("BYRD", "BYRD_SWOOP", 12);
    expectMoveDamage("BYRD", "BYRD_SWOOP", 14, 1, { asc: 2 });
    for (const seed of SEEDS) {
      let s = fight(["BYRD"], { seed });
      if (mon(s).move === "BYRD_CAW") {
        s = endTurn(s);
        expect(monPower(s, 0, "STRENGTH")?.amount).toBe(1);
        return;
      }
    }
    throw new Error("caw never first");
  });

  test("history (airborne): Peck never 3x, Swoop never 2x, Caw never 2x", () => {
    for (const moves of moveSequences(["BYRD"], 0)) {
      expect(maxRunLength(moves, "BYRD_PECK")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "BYRD_SWOOP")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "BYRD_CAW")).toBeLessThanOrEqual(1);
    }
  });
});

// ------------------------------------------------------------------------------
// Mugger
// ------------------------------------------------------------------------------

describe("Mugger", () => {
  test("HP: [48,52] A0, [50,54] A7", () => {
    expectHpRange("MUGGER", 0, 48, 52);
    expectHpRange("MUGGER", 7, 50, 54);
  });

  test("Mug turns 1+2 (10 dmg, steals 15); turn 3 Lunge or Smoke Bomb; Lunge->Smoke Bomb->Escape", () => {
    const thirdMoves = new Set<string>();
    for (const seed of SEEDS) {
      let s = fight(["MUGGER"], { seed });
      expect(mon(s).move).toBe("MUGGER_MUG");
      expect(s.run.gold).toBe(99);
      const hp0 = s.run.hp;
      s = endTurn(s);
      expect(hp0 - s.run.hp).toBe(10);
      expect(s.run.gold).toBe(84);
      expect(mon(s).move).toBe("MUGGER_MUG");
      s = endTurn(s);
      expect(s.run.gold).toBe(69);
      const third = mon(s).move!;
      thirdMoves.add(third);
      expect(["MUGGER_LUNGE", "MUGGER_SMOKE_BOMB"]).toContain(third);
      if (third === "MUGGER_LUNGE") {
        const hp1 = s.run.hp;
        s = endTurn(s);
        expect(hp1 - s.run.hp).toBe(16);
        expect(s.run.gold).toBe(54);
        expect(mon(s).move).toBe("MUGGER_SMOKE_BOMB");
      }
      s = endTurn(s); // Smoke Bomb executes (11 block), next is Escape
      expect(mon(s).block).toBe(11);
      expect(mon(s).move).toBe("MUGGER_ESCAPE");
      expect(mon(s).data.stolenGold).toBe(99 - s.run.gold);
      s = endTurn(s);
      expect(mon(s).isEscaped).toBe(true);
      expect(s.eventLog.some((e) => e.event === "combatEnded")).toBe(true);
    }
    expect(thirdMoves.size).toBe(2); // both branches of the 50/50 observed
  });

  test("A17: steals 20 per hit, Smoke Bomb 17 block; A2: Mug 11, Lunge 18", () => {
    let s = fight(["MUGGER"], { asc: 17 });
    expect(monPower(s, 0, "THIEVERY")?.amount).toBe(20);
    s = endTurn(s);
    expect(s.run.gold).toBe(79);
    const s2 = fight(["MUGGER"], { asc: 2 });
    const hp0 = s2.run.hp;
    expect(endTurn(s2).run.hp).toBe(hp0 - 11);
    for (const seed of SEEDS) {
      let sl = fight(["MUGGER"], { seed, asc: 2 });
      sl = endTurn(sl);
      sl = endTurn(sl);
      if (mon(sl).move === "MUGGER_LUNGE") {
        const hp1 = sl.run.hp;
        sl = endTurn(sl);
        expect(hp1 - sl.run.hp).toBe(18);
        return;
      }
    }
    throw new Error("lunge never observed");
  });
});

// ------------------------------------------------------------------------------
// Centurion & Mystic
// ------------------------------------------------------------------------------

describe("Centurion & Mystic", () => {
  test("HP: Centurion [76,80] A0, [78,83] A7 (adjudicated min 78); Mystic [48,56] A0, [50,58] A7", () => {
    expectHpRange("CENTURION", 0, 76, 80);
    expectHpRange("CENTURION", 7, 78, 83);
    expectHpRange("MYSTIC", 0, 48, 56);
    expectHpRange("MYSTIC", 7, 50, 58);
  });

  test("Centurion Defend gives the Mystic 15 block (A17: 20); Fury replaces it once alone", () => {
    for (const [asc, block] of [
      [0, 15],
      [17, 20],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["CENTURION", "MYSTIC"], { seed, asc });
        for (let t = 0; t < 6; t++) {
          if (mon(s, 0).move === "CENTURION_DEFEND") {
            const before = mon(s, 1).block;
            s = endTurn(s);
            expect(mon(s, 1).block - before).toBeGreaterThanOrEqual(block);
            found = true;
            break;
          }
          s = endTurn(s);
        }
        if (found) break;
      }
      expect(found).toBe(true);
    }
    // solo centurion: the support move is always FURY, never DEFEND
    for (const moves of moveSequences(["CENTURION"], 0, { turns: 12 })) {
      expect(moves.includes("CENTURION_DEFEND")).toBe(false);
      expect(moves.includes("CENTURION_FURY")).toBe(true);
    }
    expectMoveDamage("CENTURION", "CENTURION_FURY", 6, 3);
    expectMoveDamage("CENTURION", "CENTURION_FURY", 7, 3, { asc: 2 });
  });

  test("Centurion Slash 12 (A2: 14); history: no move 3x in a row", () => {
    expectMoveDamage("CENTURION", "CENTURION_SLASH", 12);
    expectMoveDamage("CENTURION", "CENTURION_SLASH", 14, 1, { asc: 2 });
    for (const moves of moveSequences(["CENTURION"], 0)) {
      expect(maxRunLength(moves, "CENTURION_SLASH")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "CENTURION_FURY")).toBeLessThanOrEqual(2);
    }
  });

  test("Mystic heals the pair when either is missing >= 16 HP (heals 16; capped at max)", () => {
    let s = fight(["CENTURION", "MYSTIC"], { seed: "HEALME", deck: strikeDeck });
    while (canPlay(s, "STRIKE_RED")) s = play(s, "STRIKE_RED", 0); // 18 damage on the Centurion
    expect(mon(s, 0).maxHp - mon(s, 0).hp).toBeGreaterThanOrEqual(16);
    s = endTurn(s);
    expect(mon(s, 1).move).toBe("MYSTIC_HEAL");
    const cHp = mon(s, 0).hp;
    s = endTurn(s);
    expect(mon(s, 0).hp - cHp).toBe(16);
    expect(mon(s, 1).hp).toBe(mon(s, 1).maxHp); // self-heal capped
  });

  test("Mystic Buff Strength 2 (A2: 3, A17: 4); Attack/Debuff 8 + Frail 2 (A2: 9)", () => {
    for (const [asc, str] of [
      [0, 2],
      [2, 3],
      [17, 4],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["MYSTIC"], { seed, asc });
        for (let t = 0; t < 8; t++) {
          if (mon(s).move === "MYSTIC_BUFF" && !monPower(s, 0, "STRENGTH")) {
            s = endTurn(s);
            expect(monPower(s, 0, "STRENGTH")?.amount).toBe(str);
            found = true;
            break;
          }
          s = endTurn(s);
        }
        if (found) break;
      }
      expect(found).toBe(true);
    }
    expectMoveDamage("MYSTIC", "MYSTIC_ATTACK_DEBUFF", 8);
    expectMoveDamage("MYSTIC", "MYSTIC_ATTACK_DEBUFF", 9, 1, { asc: 2 });
    for (const seed of SEEDS) {
      let s = fight(["MYSTIC"], { seed });
      if (mon(s).move === "MYSTIC_ATTACK_DEBUFF") {
        s = endTurn(s);
        expect(playerPower(s, "FRAIL")?.amount).toBe(2);
        return;
      }
    }
    throw new Error("attack/debuff never first");
  });

  test("Mystic history: Attack/Debuff never 3x (A17: never 2x); Buff never 3x", () => {
    for (const moves of moveSequences(["MYSTIC"], 0)) {
      expect(maxRunLength(moves, "MYSTIC_ATTACK_DEBUFF")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "MYSTIC_BUFF")).toBeLessThanOrEqual(2);
    }
    for (const moves of moveSequences(["MYSTIC"], 0, { asc: 17 })) {
      expect(maxRunLength(moves, "MYSTIC_ATTACK_DEBUFF")).toBeLessThanOrEqual(1);
    }
  });
});

// ------------------------------------------------------------------------------
// Snake Plant
// ------------------------------------------------------------------------------

describe("Snake Plant", () => {
  test("HP: [75,79] A0, [78,82] A7; Malleable 3 prebattle", () => {
    expectHpRange("SNAKE_PLANT", 0, 75, 79);
    expectHpRange("SNAKE_PLANT", 7, 78, 82);
    expect(monPower(fight(["SNAKE_PLANT"]), 0, "MALLEABLE")?.amount).toBe(3);
  });

  test("Malleable: block 3 then 4 then 5 per unblocked hit, +1 growth, reset to 3 at end of round", () => {
    let s = fight(["SNAKE_PLANT"], { seed: "MALL", deck: strikeDeck });
    s = play(s, "STRIKE_RED", 0); // 6 unblocked -> +3 block, malleable 4
    expect(mon(s).block).toBe(3);
    expect(monPower(s, 0, "MALLEABLE")?.amount).toBe(4);
    s = play(s, "STRIKE_RED", 0); // 3 blocked, 3 unblocked -> +4, malleable 5
    expect(mon(s).block).toBe(4);
    expect(monPower(s, 0, "MALLEABLE")?.amount).toBe(5);
    s = play(s, "STRIKE_RED", 0); // 4 blocked, 2 unblocked -> +5, malleable 6
    expect(mon(s).block).toBe(5);
    expect(monPower(s, 0, "MALLEABLE")?.amount).toBe(6);
    s = endTurn(s);
    expect(monPower(s, 0, "MALLEABLE")?.amount).toBe(3); // reset
  });

  test("Chomp 7x3 (A2: 8x3); Enfeebling Spores Frail 2 + Weak 2", () => {
    expectMoveDamage("SNAKE_PLANT", "SNAKE_PLANT_CHOMP", 7, 3);
    expectMoveDamage("SNAKE_PLANT", "SNAKE_PLANT_CHOMP", 8, 3, { asc: 2 });
    for (const seed of SEEDS) {
      let s = fight(["SNAKE_PLANT"], { seed });
      if (mon(s).move === "SNAKE_PLANT_ENFEEBLING_SPORES") {
        s = endTurn(s);
        expect(playerPower(s, "FRAIL")?.amount).toBe(2);
        expect(playerPower(s, "WEAK")?.amount).toBe(2);
        return;
      }
    }
    throw new Error("spores never first");
  });

  test("history: Chomp never 3x; Spores never 2x (A0), never 3x (A17, adjudicated)", () => {
    for (const moves of moveSequences(["SNAKE_PLANT"], 0)) {
      expect(maxRunLength(moves, "SNAKE_PLANT_CHOMP")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "SNAKE_PLANT_ENFEEBLING_SPORES")).toBeLessThanOrEqual(1);
    }
    let sporesRepeated = false;
    for (const moves of moveSequences(["SNAKE_PLANT"], 0, { asc: 17 })) {
      expect(maxRunLength(moves, "SNAKE_PLANT_CHOMP")).toBeLessThanOrEqual(2);
      const run = maxRunLength(moves, "SNAKE_PLANT_ENFEEBLING_SPORES");
      expect(run).toBeLessThanOrEqual(2);
      if (run === 2) sporesRepeated = true;
    }
    expect(sporesRepeated).toBe(true); // A17 CAN repeat spores once
  });
});

// ------------------------------------------------------------------------------
// Snecko
// ------------------------------------------------------------------------------

describe("Snecko", () => {
  test("HP: [114,120] A0, [120,125] A7", () => {
    expectHpRange("SNECKO", 0, 114, 120);
    expectHpRange("SNECKO", 7, 120, 125);
  });

  test("turn 1 always Perplexing Glare -> Confused randomizes drawn costs 0-3", () => {
    let anyChanged = false;
    for (const seed of SEEDS.slice(0, 8)) {
      let s = fight(["SNECKO"], { seed, deck: strikeDeck });
      expect(mon(s).move).toBe("SNECKO_PERPLEXING_GLARE");
      s = endTurn(s);
      expect(playerPower(s, "CONFUSED")).toBeDefined();
      for (const iid of s.combat!.player.piles.hand) {
        const c = s.combat!.cards[iid]!;
        expect(c.cost).toBeGreaterThanOrEqual(0);
        expect(c.cost).toBeLessThanOrEqual(3);
        if (c.cost !== 1) anyChanged = true;
      }
    }
    expect(anyChanged).toBe(true);
  });

  test("damage: Bite 15 (A2: 18); Tail Whip 8 + Vulnerable 2 (A2: 10; A17 adds Weak 2)", () => {
    expectMoveDamage("SNECKO", "SNECKO_BITE", 15);
    expectMoveDamage("SNECKO", "SNECKO_BITE", 18, 1, { asc: 2 });
    expectMoveDamage("SNECKO", "SNECKO_TAIL_WHIP", 8);
    expectMoveDamage("SNECKO", "SNECKO_TAIL_WHIP", 10, 1, { asc: 2 });
    for (const [asc, wantWeak] of [
      [0, undefined],
      [17, 2],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["SNECKO"], { seed, asc });
        for (let t = 0; t < 8; t++) {
          if (mon(s).move === "SNECKO_TAIL_WHIP" && !playerPower(s, "WEAK")) {
            s = endTurn(s);
            expect(playerPower(s, "VULNERABLE")?.amount).toBeGreaterThanOrEqual(2);
            expect(playerPower(s, "WEAK")?.amount).toBe(wantWeak);
            found = true;
            break;
          }
          s = endTurn(s);
        }
        if (found) break;
      }
      expect(found).toBe(true);
    }
  });

  test("history: Glare only on turn 1; Bite never 3x", () => {
    for (const moves of moveSequences(["SNECKO"], 0)) {
      expect(moves[0]).toBe("SNECKO_PERPLEXING_GLARE");
      expect(moves.slice(1).includes("SNECKO_PERPLEXING_GLARE")).toBe(false);
      expect(maxRunLength(moves, "SNECKO_BITE")).toBeLessThanOrEqual(2);
    }
  });
});

// ------------------------------------------------------------------------------
// Book of Stabbing (elite)
// ------------------------------------------------------------------------------

describe("Book of Stabbing", () => {
  test("HP: [160,164] A0, [168,172] A8", () => {
    expectHpRange("BOOK_OF_STABBING", 0, 160, 164);
    expectHpRange("BOOK_OF_STABBING", 8, 168, 172);
  });

  test("Multi Stab hits = stabCount (Nth use hits N+1); Painful Stabs adds a Wound per hit", () => {
    let s = fight(["BOOK_OF_STABBING"], { seed: "STAB" });
    expect(monPower(s, 0, "PAINFUL_STABS")).toBeDefined();
    let multisSeen = 0;
    for (let t = 0; t < 12; t++) {
      const move = mon(s).move!;
      const stabCount = mon(s).data.stabCount as number;
      const hp0 = s.run.hp;
      const wounds0 = countCards(s, "WOUND");
      s = endTurn(s);
      if (move === "BOOK_OF_STABBING_MULTI_STAB") {
        multisSeen++;
        expect(stabCount).toBe(multisSeen + 1); // Nth multi stab hits N+1 times
        expect(hp0 - s.run.hp).toBe(6 * stabCount);
        expect(countCards(s, "WOUND") - wounds0).toBe(stabCount);
        // Painful Stabs makes them in the discard pile during the monster's
        // turn, so by the time the player draws they may already have been
        // shuffled back into draw (or drawn into hand) - never exhausted.
        expect(countInPile(s, "exhaust", "WOUND")).toBe(0);
      } else {
        expect(hp0 - s.run.hp).toBe(21);
        expect(countCards(s, "WOUND") - wounds0).toBe(1);
      }
      if (multisSeen >= 3) return;
    }
    expect(multisSeen).toBeGreaterThanOrEqual(3);
  });

  test("A3 damage tier: Multi Stab 7 per hit, Single Stab 24", () => {
    expectMoveDamage("BOOK_OF_STABBING", "BOOK_OF_STABBING_SINGLE_STAB", 24, 1, { asc: 3 });
    let s = fight(["BOOK_OF_STABBING"], { seed: "STAB3", asc: 3 });
    for (let t = 0; t < 8; t++) {
      if (mon(s).move === "BOOK_OF_STABBING_MULTI_STAB") {
        const stabCount = mon(s).data.stabCount as number;
        const hp0 = s.run.hp;
        s = endTurn(s);
        expect(hp0 - s.run.hp).toBe(7 * stabCount);
        return;
      }
      s = endTurn(s);
    }
    throw new Error("multi stab never observed");
  });

  test("A18 (adjudicated): stabCount grows every turn - a Multi Stab on turn T hits T+1 times", () => {
    for (const seed of SEEDS.slice(0, 5)) {
      let s = fight(["BOOK_OF_STABBING"], { seed, asc: 18 });
      for (let turn = 1; turn <= 6; turn++) {
        expect(mon(s).data.stabCount).toBe(turn + 1);
        const move = mon(s).move!;
        const hp0 = s.run.hp;
        s = endTurn(s);
        if (move === "BOOK_OF_STABBING_MULTI_STAB") {
          expect(hp0 - s.run.hp).toBe(7 * (turn + 1));
        }
      }
    }
  });

  test("history: Multi Stab never 3x, Single Stab never 2x", () => {
    for (const moves of moveSequences(["BOOK_OF_STABBING"], 0)) {
      expect(maxRunLength(moves, "BOOK_OF_STABBING_MULTI_STAB")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "BOOK_OF_STABBING_SINGLE_STAB")).toBeLessThanOrEqual(1);
    }
  });
});

// ------------------------------------------------------------------------------
// Gremlin Leader (elite)
// ------------------------------------------------------------------------------

const GREMLIN_IDS = ["MAD_GREMLIN", "SNEAKY_GREMLIN", "FAT_GREMLIN", "SHIELD_GREMLIN", "GREMLIN_WIZARD"];

describe("Gremlin Leader", () => {
  test("HP: [140,148] A0, [145,155] A8; marks fellow slot-0..2 monsters as Minions", () => {
    expectHpRange("GREMLIN_LEADER", 0, 140, 148);
    expectHpRange("GREMLIN_LEADER", 8, 145, 155);
    const s = fight(["MAD_GREMLIN", "SNEAKY_GREMLIN", "GREMLIN_LEADER"]);
    expect(monPower(s, 2, "MINION_LEADER")).toBeDefined();
    expect(monPower(s, 0, "MINION")).toBeDefined();
    expect(monPower(s, 1, "MINION")).toBeDefined();
  });

  test("Encourage: self Str 3, minions Str 3 + 6 block (A3: 4/6; A18: 5/10 - adjudicated)", () => {
    for (const [asc, str, block] of [
      [0, 3, 6],
      [3, 4, 6],
      [18, 5, 10],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["MAD_GREMLIN", "SNEAKY_GREMLIN", "FAT_GREMLIN", "GREMLIN_LEADER"], { seed, asc });
        if (mon(s, 3).move !== "GREMLIN_LEADER_ENCOURAGE") continue;
        s = endTurn(s);
        expect(monPower(s, 3, "STRENGTH")?.amount).toBe(str);
        for (const idx of [0, 1, 2]) {
          expect(monPower(s, idx, "STRENGTH")?.amount).toBe(str);
          expect(mon(s, idx).block).toBe(block);
        }
        expect(mon(s, 3).block).toBe(0); // leader gets no block from Encourage
        found = true;
        break;
      }
      expect(found).toBe(true);
    }
  });

  test("Stab deals 6x3", () => {
    for (const seed of SEEDS) {
      let s = fight(["GREMLIN_LEADER"], { seed });
      for (let t = 0; t < 6; t++) {
        if (mon(s).move === "GREMLIN_LEADER_STAB") {
          const alive = s.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped && m.idx !== 0);
          if (alive.length === 0) {
            const hp0 = s.run.hp;
            s = endTurn(s);
            expect(hp0 - s.run.hp).toBe(18);
            return;
          }
        }
        s = endTurn(s);
      }
    }
    throw new Error("solo stab never observed");
  });

  test("Rally (solo leader): summons 2 pool gremlins into slots 1 and 2 with Minion + first moves", () => {
    for (const seed of SEEDS) {
      let s = fight(["GREMLIN_LEADER"], { seed });
      if (mon(s).move !== "GREMLIN_LEADER_RALLY") continue;
      s = endTurn(s);
      expect(s.combat!.monsters.length).toBe(3);
      for (const idx of [1, 2]) {
        const g = mon(s, idx);
        expect(g.isDead).toBe(false);
        expect(g.isEscaped).toBe(false);
        expect(GREMLIN_IDS).toContain(g.id);
        expect(g.powers.some((p) => p.id === "MINION")).toBe(true);
        expect(g.move).not.toBeNull();
      }
      return;
    }
    throw new Error("rally never rolled on turn 1 across seeds");
  });

  test("Rally refills the open slots in order 1, 2, 0 (kept gremlin's slot is skipped)", () => {
    // 4-slot corpus layout; kill the gremlins at slots 1 and 2, keep slot 0
    outer: for (const seed of SEEDS) {
      let s = fight(["MAD_GREMLIN", "SNEAKY_GREMLIN", "FAT_GREMLIN", "GREMLIN_LEADER"], {
        seed,
        deck: strikeDeck,
      });
      for (let t = 0; t < 20; t++) {
        for (const target of [1, 2]) {
          while (!mon(s, target).isDead && canPlay(s, "STRIKE_RED")) {
            s = play(s, "STRIKE_RED", target);
          }
        }
        if (mon(s, 1).isDead && mon(s, 2).isDead && mon(s, 3).move === "GREMLIN_LEADER_RALLY") {
          const survivor = mon(s, 0).id;
          s = endTurn(s);
          expect(mon(s, 0).id).toBe(survivor); // untouched
          expect(mon(s, 1).isDead).toBe(false);
          expect(mon(s, 2).isDead).toBe(false);
          expect(GREMLIN_IDS).toContain(mon(s, 1).id);
          expect(GREMLIN_IDS).toContain(mon(s, 2).id);
          return;
        }
        s = endTurn(s);
        if (s.outcome || !s.combat) continue outer;
      }
    }
    throw new Error("rally-with-survivor never observed");
  });

  test("killing the leader makes all Minions abandon combat (victory)", () => {
    outer: for (const seed of SEEDS) {
      let s = fight(["GREMLIN_LEADER"], { seed, deck: strikeDeck });
      for (let t = 0; t < 30; t++) {
        let sawRally = s.combat!.monsters.length > 1;
        while (!mon(s, 0).isDead && canPlay(s, "STRIKE_RED")) {
          s = play(s, "STRIKE_RED", 0);
          if (mon(s, 0).isDead) {
            if (!sawRally) continue outer; // want minions alive at the kill
            expect(s.eventLog.some((e) => e.event === "combatEnded")).toBe(true);
            for (const m of s.combat!.monsters.slice(1)) {
              expect(m.isDead || m.isEscaped).toBe(true);
            }
            return;
          }
        }
        s = endTurn(s);
        if (s.outcome || !s.combat) continue outer;
      }
    }
    throw new Error("leader kill with living minions never observed");
  });

  test("history: Rally, Encourage and Stab never twice in a row", () => {
    for (const moves of moveSequences(["GREMLIN_LEADER"], 0, { turns: 15 })) {
      expect(maxRunLength(moves, "GREMLIN_LEADER_RALLY")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "GREMLIN_LEADER_ENCOURAGE")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "GREMLIN_LEADER_STAB")).toBeLessThanOrEqual(1);
    }
  });
});

// ------------------------------------------------------------------------------
// Taskmaster (elite)
// ------------------------------------------------------------------------------

describe("Taskmaster", () => {
  test("HP: [54,60] A0, [57,64] A8", () => {
    expectHpRange("TASKMASTER", 0, 54, 60);
    expectHpRange("TASKMASTER", 8, 57, 64);
  });

  test("Scouring Whip every turn: 7 dmg + 1 Wound to discard (A3: 2 Wounds; A18: 3 + Str 1)", () => {
    for (const moves of moveSequences(["TASKMASTER"], 0, { turns: 12 })) {
      expect(moves.every((m) => m === "TASKMASTER_SCOURING_WHIP")).toBe(true);
    }
    let s = fight(["TASKMASTER"], { seed: "TASK" });
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(7);
    expect(countInPile(s, "discard", "WOUND")).toBe(1);
    const s3 = endTurn(fight(["TASKMASTER"], { asc: 3 }));
    expect(countInPile(s3, "discard", "WOUND")).toBe(2);
    let s18 = fight(["TASKMASTER"], { asc: 18 });
    const hpA = s18.run.hp;
    s18 = endTurn(s18);
    expect(hpA - s18.run.hp).toBe(7); // Str lands after this turn's hit
    expect(countInPile(s18, "discard", "WOUND")).toBe(3);
    expect(monPower(s18, 0, "STRENGTH")?.amount).toBe(1);
    const hpB = s18.run.hp;
    s18 = endTurn(s18);
    expect(hpB - s18.run.hp).toBe(8); // 7 + 1 Strength
    expect(monPower(s18, 0, "STRENGTH")?.amount).toBe(2);
  });
});

// ------------------------------------------------------------------------------
// Bronze Automaton + Bronze Orbs (boss)
// ------------------------------------------------------------------------------

/** Expected player HP loss this turn from all live intents (no Vuln/Weak in play). */
function expectedTurnDamage(s: GameState, asc: number): number {
  let sum = 0;
  for (const m of s.combat!.monsters) {
    if (m.isDead || m.isEscaped) continue;
    const str = m.powers.find((p) => p.id === "STRENGTH")?.amount ?? 0;
    switch (m.move) {
      case "BRONZE_AUTOMATON_FLAIL":
        sum += ((asc >= 4 ? 8 : 7) + str) * 2;
        break;
      case "BRONZE_AUTOMATON_HYPER_BEAM":
        sum += (asc >= 4 ? 50 : 45) + str;
        break;
      case "BRONZE_ORB_BEAM":
        sum += 8 + str;
        break;
    }
  }
  return sum;
}

describe("Bronze Automaton", () => {
  test("HP: 300 A0, 320 A9; prebattle Artifact 3 + Minion Leader", () => {
    expectHpRange("BRONZE_AUTOMATON", 0, 300, 300);
    expectHpRange("BRONZE_AUTOMATON", 9, 320, 320);
    const s = fight(["BRONZE_AUTOMATON"]);
    expect(monPower(s, 0, "ARTIFACT")?.amount).toBe(3);
    expect(monPower(s, 0, "MINION_LEADER")).toBeDefined();
  });

  test("turn 1 spawns 2 Bronze Orbs (Minions, HP [52,58], first moves set, act next round)", () => {
    let s = fight(["BRONZE_AUTOMATON"], { seed: "AUTO" });
    expect(mon(s).move).toBe("BRONZE_AUTOMATON_SPAWN_ORBS");
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(s.run.hp).toBe(hp0); // nobody attacks on the spawn turn
    expect(s.combat!.monsters.length).toBe(3);
    for (const idx of [1, 2]) {
      const orb = mon(s, idx);
      expect(orb.id).toBe("BRONZE_ORB");
      expect(orb.isDead).toBe(false);
      expect(orb.maxHp).toBeGreaterThanOrEqual(52);
      expect(orb.maxHp).toBeLessThanOrEqual(58);
      expect(orb.powers.some((p) => p.id === "MINION")).toBe(true);
      expect(["BRONZE_ORB_STASIS", "BRONZE_ORB_BEAM", "BRONZE_ORB_SUPPORT_BEAM"]).toContain(orb.move!);
    }
  });

  test("script below A19: SPAWN then [FLAIL, BOOST, FLAIL, BOOST, HYPER_BEAM, STUNNED] repeating", () => {
    const loop = [
      "BRONZE_AUTOMATON_FLAIL",
      "BRONZE_AUTOMATON_BOOST",
      "BRONZE_AUTOMATON_FLAIL",
      "BRONZE_AUTOMATON_BOOST",
      "BRONZE_AUTOMATON_HYPER_BEAM",
      "BRONZE_AUTOMATON_STUNNED",
    ];
    for (const moves of moveSequences(["BRONZE_AUTOMATON"], 0, { turns: 14 }).slice(0, 6)) {
      expect(moves[0]).toBe("BRONZE_AUTOMATON_SPAWN_ORBS");
      for (let i = 1; i < moves.length; i++) expect(moves[i]).toBe(loop[(i - 1) % 6]!);
    }
  });

  test("A19: Boost replaces the post-beam Stunned turn ([BOOST, FLAIL, BOOST, HYPER_BEAM] loop)", () => {
    const want = [
      "BRONZE_AUTOMATON_SPAWN_ORBS",
      "BRONZE_AUTOMATON_FLAIL",
      "BRONZE_AUTOMATON_BOOST",
      "BRONZE_AUTOMATON_FLAIL",
      "BRONZE_AUTOMATON_BOOST",
      "BRONZE_AUTOMATON_HYPER_BEAM",
      "BRONZE_AUTOMATON_BOOST",
      "BRONZE_AUTOMATON_FLAIL",
      "BRONZE_AUTOMATON_BOOST",
      "BRONZE_AUTOMATON_HYPER_BEAM",
      "BRONZE_AUTOMATON_BOOST",
    ];
    for (const moves of moveSequences(["BRONZE_AUTOMATON"], 0, { asc: 19, turns: 11 }).slice(0, 4)) {
      expect(moves).toEqual(want.slice(0, moves.length));
    }
  });

  test("exact damage each turn (Flail 7x2 +Str, Hyper Beam 45 +Str, orb Beam 8); Boost +3 Str/+9 block", () => {
    let s = fight(["BRONZE_AUTOMATON"], { seed: "AUTODMG" });
    for (let t = 0; t < 8; t++) {
      const move = mon(s).move!;
      const strBefore = monPower(s, 0, "STRENGTH")?.amount ?? 0;
      const expected = expectedTurnDamage(s, 0);
      const supporting = s.combat!.monsters.filter(
        (m) => !m.isDead && !m.isEscaped && m.move === "BRONZE_ORB_SUPPORT_BEAM",
      ).length;
      const hp0 = s.run.hp;
      s = endTurn(s);
      expect(hp0 - s.run.hp).toBe(expected);
      if (move === "BRONZE_AUTOMATON_BOOST") {
        expect(monPower(s, 0, "STRENGTH")?.amount).toBe(strBefore + 3);
        expect(mon(s).block).toBe(9 + 12 * supporting);
      } else {
        expect(mon(s).block).toBe(12 * supporting); // Support Beam gives the Automaton 12
      }
    }
  });

  test("A4/A9 tiers: Flail 8x2, Hyper Beam 50, Boost +4 Str/+12 block", () => {
    let s = fight(["BRONZE_AUTOMATON"], { seed: "AUTO9", asc: 9 });
    for (let t = 0; t < 6; t++) {
      const move = mon(s).move!;
      const strBefore = monPower(s, 0, "STRENGTH")?.amount ?? 0;
      const expected = expectedTurnDamage(s, 9);
      const hp0 = s.run.hp;
      s = endTurn(s);
      expect(hp0 - s.run.hp).toBe(expected);
      if (move === "BRONZE_AUTOMATON_BOOST") {
        expect(monPower(s, 0, "STRENGTH")?.amount).toBe(strBefore + 4);
        expect(mon(s).block).toBeGreaterThanOrEqual(12);
      }
    }
  });

  test("orb Stasis steals the highest-rarity draw-pile card; killing the orb returns it to hand", () => {
    const deck = [
      ...Array(5).fill({ defId: "STRIKE_RED" }),
      ...Array(4).fill({ defId: "DEFEND_RED" }),
      { defId: "BLUDGEON" },
    ];
    for (const seed of SEEDS) {
      let s = fight(["BRONZE_AUTOMATON"], { seed, deck });
      s = endTurn(s); // orbs spawn
      for (let t = 0; t < 4; t++) {
        const stasisOrb = [1, 2].find(
          (i) => s.combat!.monsters[i] && !mon(s, i).isDead && mon(s, i).move === "BRONZE_ORB_STASIS",
        );
        const bludgeonInDraw = countInPile(s, "draw", "BLUDGEON") === 1;
        if (stasisOrb === undefined || !bludgeonInDraw) {
          s = endTurn(s);
          continue;
        }
        s = endTurn(s);
        const orb = mon(s, stasisOrb);
        const iid = orb.data.stasisCardIid as number;
        expect(iid).toBeDefined();
        expect(s.combat!.cards[iid]!.defId).toBe("BLUDGEON"); // rare beats basic
        expect(orb.powers.some((p) => p.id === "STASIS")).toBe(true);
        expect(countCards(s, "BLUDGEON")).toBe(1);
        for (const pile of ["draw", "hand", "discard", "exhaust"] as const) {
          expect(countInPile(s, pile, "BLUDGEON")).toBe(0); // out of the piles
        }
        // kill the orb -> the card returns to the hand
        for (let k = 0; k < 12 && !mon(s, stasisOrb).isDead; k++) {
          while (!mon(s, stasisOrb).isDead && canPlay(s, "STRIKE_RED")) {
            s = play(s, "STRIKE_RED", stasisOrb);
          }
          if (!mon(s, stasisOrb).isDead) s = endTurn(s);
        }
        expect(mon(s, stasisOrb).isDead).toBe(true);
        expect(s.combat!.player.piles.hand.includes(iid)).toBe(true);
        return;
      }
    }
    throw new Error("stasis-with-Bludgeon-in-draw never observed");
  });

  test("orb AI: Stasis at most once per orb; Beam/Support Beam never 3x in a row", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      let s = fight(["BRONZE_AUTOMATON"], { seed });
      s = endTurn(s);
      const seen: Record<number, string[]> = { 1: [], 2: [] };
      for (let t = 0; t < 14; t++) {
        for (const idx of [1, 2]) {
          const orb = s.combat!.monsters[idx];
          if (orb && !orb.isDead && !orb.isEscaped && orb.move) seen[idx]!.push(orb.move);
        }
        s = endTurn(s);
      }
      for (const idx of [1, 2]) {
        const moves = seen[idx]!;
        expect(moves.filter((m) => m === "BRONZE_ORB_STASIS").length).toBeLessThanOrEqual(1);
        expect(maxRunLength(moves, "BRONZE_ORB_BEAM")).toBeLessThanOrEqual(2);
        expect(maxRunLength(moves, "BRONZE_ORB_SUPPORT_BEAM")).toBeLessThanOrEqual(2);
      }
    }
  });

  test("orb HP bands: [52,58] A0, [54,60] A9; Torch Head [38,40] A0, [40,45] A9", () => {
    expectHpRange("BRONZE_ORB", 0, 52, 58);
    expectHpRange("BRONZE_ORB", 9, 54, 60);
    expectHpRange("TORCH_HEAD", 0, 38, 40);
    expectHpRange("TORCH_HEAD", 9, 40, 45);
  });

  test("killing the Automaton ends the fight (orbs flee as Minions)", () => {
    outer: for (const seed of SEEDS.slice(0, 4)) {
      let s = fight(["BRONZE_AUTOMATON"], { seed, deck: strikeDeck });
      for (let t = 0; t < 40; t++) {
        while (!mon(s, 0).isDead && canPlay(s, "STRIKE_RED")) {
          s = play(s, "STRIKE_RED", 0);
          if (mon(s, 0).isDead) {
            expect(s.eventLog.some((e) => e.event === "combatEnded")).toBe(true);
            for (const m of s.combat!.monsters.slice(1)) {
              expect(m.isDead || m.isEscaped).toBe(true);
            }
            return;
          }
        }
        s = endTurn(s);
        if (s.outcome || !s.combat) continue outer;
      }
    }
    throw new Error("automaton never killed");
  });
});

// ------------------------------------------------------------------------------
// The Collector + Torch Heads (boss)
// ------------------------------------------------------------------------------

describe("The Collector", () => {
  // Reference layout: heads take slots 0-1, the Collector slot 2 (she acts last).
  const COL = 2;
  const HEADS = [0, 1];
  test("HP: 282 A0, 300 A9; turn 1 spawns 2 Torch Heads with preset Tackle", () => {
    expectHpRange("THE_COLLECTOR", 0, 282, 282);
    expectHpRange("THE_COLLECTOR", 9, 300, 300);
    let s = fight(["THE_COLLECTOR"], { seed: "COLL" });
    expect(mon(s, COL).move).toBe("THE_COLLECTOR_SPAWN");
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(s.run.hp).toBe(hp0); // fresh heads act the round after spawning
    expect(s.combat!.monsters.length).toBe(3);
    for (const idx of HEADS) {
      const head = mon(s, idx);
      expect(head.id).toBe("TORCH_HEAD");
      expect(head.move).toBe("TORCH_HEAD_TACKLE");
      expect(head.powers.some((p) => p.id === "MINION")).toBe(true);
      expect(head.maxHp).toBeGreaterThanOrEqual(38);
      expect(head.maxHp).toBeLessThanOrEqual(40);
    }
  });

  test("turn 4 is always Mega Debuff: Weak/Vulnerable/Frail 3 (A19: 5 - adjudicated)", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      let s = fight(["THE_COLLECTOR"], { seed });
      for (let t = 1; t < 4; t++) s = endTurn(s);
      expect(mon(s, COL).move).toBe("THE_COLLECTOR_MEGA_DEBUFF");
      const weak0 = playerPower(s, "WEAK")?.amount ?? 0;
      const frail0 = playerPower(s, "FRAIL")?.amount ?? 0;
      s = endTurn(s);
      expect((playerPower(s, "WEAK")?.amount ?? 0)).toBeGreaterThanOrEqual(weak0 + 2);
      expect((playerPower(s, "FRAIL")?.amount ?? 0)).toBeGreaterThanOrEqual(frail0 + 2);
      expect(playerPower(s, "VULNERABLE")).toBeDefined();
    }
    let s19 = fight(["THE_COLLECTOR"], { asc: 19, seed: "C19" });
    for (let t = 1; t < 4; t++) s19 = endTurn(s19);
    const weakBefore = playerPower(s19, "WEAK")?.amount ?? 0;
    s19 = endTurn(s19);
    expect((playerPower(s19, "WEAK")?.amount ?? 0) - weakBefore).toBeGreaterThanOrEqual(4);
  });

  test("Fireball + Tackles exact damage on turns 2-3; Buff: Str 3 + 15 block to self, Str 3 to heads", () => {
    let sawFireball = false;
    let sawBuff = false;
    for (const seed of SEEDS) {
      let s = fight(["THE_COLLECTOR"], { seed });
      s = endTurn(s); // spawn
      for (let turn = 2; turn <= 3; turn++) {
        const move = mon(s, COL).move!;
        const colStr = monPower(s, COL, "STRENGTH")?.amount ?? 0;
        const heads = s.combat!.monsters.filter((m) => m.id === "TORCH_HEAD" && !m.isDead && !m.isEscaped);
        const headDmg = heads.reduce(
          (sum, h) => sum + 7 + (h.powers.find((p) => p.id === "STRENGTH")?.amount ?? 0),
          0,
        );
        const hp0 = s.run.hp;
        s = endTurn(s);
        if (move === "THE_COLLECTOR_FIREBALL" && !sawFireball) {
          expect(hp0 - s.run.hp).toBe(18 + colStr + headDmg);
          sawFireball = true;
        }
        if (move === "THE_COLLECTOR_BUFF" && !sawBuff) {
          expect(hp0 - s.run.hp).toBe(headDmg);
          expect(monPower(s, COL, "STRENGTH")?.amount).toBe(colStr + 3);
          expect(mon(s, COL).block).toBe(15);
          for (const h of HEADS) expect(monPower(s, h, "STRENGTH")?.amount).toBe(3);
          sawBuff = true;
        }
      }
      if (sawFireball && sawBuff) break;
    }
    expect(sawFireball).toBe(true);
    expect(sawBuff).toBe(true);
  });

  test("re-summons a Torch Head after one dies; never spawns with both alive; Spawn never 2x", () => {
    outer: for (const seed of SEEDS) {
      let s = fight(["THE_COLLECTOR"], { seed, deck: strikeDeck });
      s = endTurn(s); // spawn
      // kill the head in slot 1
      for (let t = 0; t < 8 && !mon(s, 1).isDead; t++) {
        while (!mon(s, 1).isDead && canPlay(s, "STRIKE_RED")) s = play(s, "STRIKE_RED", 1);
        if (!mon(s, 1).isDead) s = endTurn(s);
      }
      if (!mon(s, 1).isDead) continue;
      let prevMove: string | null = null;
      for (let t = 0; t < 15; t++) {
        const move = mon(s, COL).move!;
        if (move === "THE_COLLECTOR_SPAWN") {
          expect(prevMove).not.toBe("THE_COLLECTOR_SPAWN");
          const aliveBefore = s.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped).length;
          expect(aliveBefore).toBeLessThan(3);
          s = endTurn(s);
          const heads = s.combat!.monsters.filter((m) => m.id === "TORCH_HEAD" && !m.isDead && !m.isEscaped);
          expect(heads.length).toBe(2);
          return;
        }
        prevMove = move;
        s = endTurn(s);
        if (s.outcome || !s.combat) continue outer;
      }
    }
    throw new Error("re-summon never observed");
  });

  test("history: Fireball never 3x, Buff never 2x", () => {
    for (const moves of moveSequences(["THE_COLLECTOR"], 0, { turns: 16 }).slice(0, 10)) {
      expect(maxRunLength(moves, "THE_COLLECTOR_FIREBALL")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "THE_COLLECTOR_BUFF")).toBeLessThanOrEqual(1);
    }
  });
});

// ------------------------------------------------------------------------------
// The Champ (boss)
// ------------------------------------------------------------------------------

describe("The Champ", () => {
  test("HP: 420 A0, 440 A9", () => {
    expectHpRange("THE_CHAMP", 0, 420, 420);
    expectHpRange("THE_CHAMP", 9, 440, 440);
  });

  test("phase 1: Taunt forced on turns 4, 8, 12 and nowhere else", () => {
    for (const moves of moveSequences(["THE_CHAMP"], 0, { turns: 13 })) {
      for (let i = 0; i < moves.length; i++) {
        if ((i + 1) % 4 === 0) expect(moves[i]).toBe("THE_CHAMP_TAUNT");
        else expect(moves[i]).not.toBe("THE_CHAMP_TAUNT");
      }
      expect(moves.includes("THE_CHAMP_ANGER")).toBe(false); // never below 50% with a defend deck
      expect(moves.includes("THE_CHAMP_EXECUTE")).toBe(false);
    }
  });

  test("Taunt applies Weak 2 + Vulnerable 2 immediately", () => {
    for (const seed of SEEDS) {
      let s = fight(["THE_CHAMP"], { seed });
      for (let t = 1; t < 4; t++) s = endTurn(s);
      if (playerPower(s, "WEAK") || playerPower(s, "VULNERABLE")) continue;
      expect(mon(s).move).toBe("THE_CHAMP_TAUNT");
      s = endTurn(s);
      expect(playerPower(s, "WEAK")?.amount).toBe(2);
      expect(playerPower(s, "VULNERABLE")?.amount).toBe(2);
      return;
    }
    throw new Error("clean taunt turn never observed");
  });

  test("Defensive Stance: 15 block + Metallicize 5 (A9: 18/6, A19: 20/7); at most 2 uses, never 2x", () => {
    for (const [asc, block, met] of [
      [0, 15, 5],
      [9, 18, 6],
      [19, 20, 7],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["THE_CHAMP"], { seed, asc });
        for (let t = 0; t < 8; t++) {
          if (mon(s).move === "THE_CHAMP_DEFENSIVE_STANCE" && !monPower(s, 0, "METALLICIZE")) {
            s = endTurn(s);
            expect(monPower(s, 0, "METALLICIZE")?.amount).toBe(met);
            expect(mon(s).block).toBe(block + met); // stance block + end-of-turn metallicize
            found = true;
            break;
          }
          s = endTurn(s);
        }
        if (found) break;
      }
      expect(found).toBe(true);
    }
    for (const moves of moveSequences(["THE_CHAMP"], 0, { turns: 18 })) {
      expect(moves.filter((m) => m === "THE_CHAMP_DEFENSIVE_STANCE").length).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "THE_CHAMP_DEFENSIVE_STANCE")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "THE_CHAMP_FACE_SLAP")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "THE_CHAMP_HEAVY_SLASH")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "THE_CHAMP_GLOAT")).toBeLessThanOrEqual(1);
      for (let i = 1; i < moves.length; i++) {
        if (moves[i] === "THE_CHAMP_GLOAT") {
          expect(moves[i - 1]).not.toBe("THE_CHAMP_DEFENSIVE_STANCE"); // gloat never after stance
        }
      }
    }
  });

  test("Gloat gives Strength 2 (A4: 3, A19: 4 - adjudicated)", () => {
    for (const [asc, str] of [
      [0, 2],
      [4, 3],
      [19, 4],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["THE_CHAMP"], { seed, asc });
        for (let t = 0; t < 8; t++) {
          if (mon(s).move === "THE_CHAMP_GLOAT") {
            const before = monPower(s, 0, "STRENGTH")?.amount ?? 0;
            s = endTurn(s);
            expect(monPower(s, 0, "STRENGTH")?.amount).toBe(before + str);
            found = true;
            break;
          }
          s = endTurn(s);
        }
        if (found) break;
      }
      expect(found).toBe(true);
    }
  });

  test("damage: Heavy Slash 16, Face Slap 12 + Frail 2 + Vuln 2; A4: 18/14", () => {
    expectMoveDamage("THE_CHAMP", "THE_CHAMP_HEAVY_SLASH", 16);
    expectMoveDamage("THE_CHAMP", "THE_CHAMP_HEAVY_SLASH", 18, 1, { asc: 4 });
    expectMoveDamage("THE_CHAMP", "THE_CHAMP_FACE_SLAP", 12);
    expectMoveDamage("THE_CHAMP", "THE_CHAMP_FACE_SLAP", 14, 1, { asc: 4 });
    for (const seed of SEEDS) {
      let s = fight(["THE_CHAMP"], { seed });
      if (mon(s).move === "THE_CHAMP_FACE_SLAP") {
        s = endTurn(s);
        expect(playerPower(s, "FRAIL")?.amount).toBe(2);
        expect(playerPower(s, "VULNERABLE")?.amount).toBe(2);
        return;
      }
    }
    throw new Error("face slap never first");
  });

  test("phase 2 at <50%: Anger removes debuffs + Str 6, then Execute (10x2) every 3rd turn", () => {
    const deck = [...Array(8).fill({ defId: "STRIKE_RED" }), { defId: "BASH" }, { defId: "BASH" }];
    let s = fight(["THE_CHAMP"], { seed: "PHASE2", deck });
    const half = mon(s).maxHp / 2;
    // grind phase 1 without crossing the threshold mid-check
    for (let t = 0; t < 40 && mon(s).hp >= half; t++) {
      while (mon(s).hp >= half && canPlay(s, "STRIKE_RED")) s = play(s, "STRIKE_RED", 0);
      if (mon(s).hp >= half && s.combat!.player.energy >= 2 && canPlay(s, "BASH")) s = play(s, "BASH", 0);
      if (mon(s).hp >= half) s = endTurn(s);
    }
    expect(mon(s).hp).toBeLessThan(half);
    expect(mon(s).move).not.toBe("THE_CHAMP_ANGER"); // no mid-turn interrupt
    s = endTurn(s); // the roll after this turn selects ANGER
    expect(mon(s).move).toBe("THE_CHAMP_ANGER");
    // give him a debuff so Anger has something to cleanse
    if (s.combat!.player.energy >= 2 && canPlay(s, "BASH")) s = play(s, "BASH", 0);
    const hadVuln = monPower(s, 0, "VULNERABLE") !== undefined;
    const strBefore = Math.max(0, monPower(s, 0, "STRENGTH")?.amount ?? 0);
    s = endTurn(s); // ANGER executes
    if (hadVuln) expect(monPower(s, 0, "VULNERABLE")).toBeUndefined();
    expect(monPower(s, 0, "STRENGTH")?.amount).toBe(strBefore + 6);
    // Execute cadence: every 3rd move from here
    const phase2: string[] = [];
    for (let t = 0; t < 9; t++) {
      phase2.push(mon(s).move!);
      s = endTurn(s);
      if (s.outcome || !s.combat) break;
    }
    for (let i = 0; i < phase2.length; i++) {
      if (i % 3 === 0) expect(phase2[i]).toBe("THE_CHAMP_EXECUTE");
      else expect(phase2[i]).not.toBe("THE_CHAMP_EXECUTE");
      expect(phase2[i]).not.toBe("THE_CHAMP_TAUNT");
      expect(phase2[i]).not.toBe("THE_CHAMP_ANGER");
    }
  });
});

// ------------------------------------------------------------------------------
// Masked Bandits (event fight): Pointy, Romeo, Bear
// ------------------------------------------------------------------------------

describe("Masked Bandits", () => {
  test("HP bands: Bear [38,42]/[40,44] (adjudicated), Romeo [35,39]/[37,41], Pointy 30/34", () => {
    expectHpRange("BEAR", 0, 38, 42);
    expectHpRange("BEAR", 7, 40, 44);
    expectHpRange("ROMEO", 0, 35, 39);
    expectHpRange("ROMEO", 7, 37, 41);
    expectHpRange("POINTY", 0, 30, 30);
    expectHpRange("POINTY", 7, 34, 34);
  });

  test("encounter turn 1: Pointy attacks (5x2), Romeo mocks, Bear hugs (Dex -2; A17: -4)", () => {
    let s = fight(["POINTY", "ROMEO", "BEAR"], { seed: "BANDITS" });
    expect(mon(s, 0).move).toBe("POINTY_ATTACK");
    expect(mon(s, 1).move).toBe("ROMEO_MOCK");
    expect(mon(s, 2).move).toBe("BEAR_BEAR_HUG");
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(10); // only Pointy deals damage on turn 1
    expect(playerPower(s, "DEXTERITY")?.amount).toBe(-2);
    const s17 = endTurn(fight(["POINTY", "ROMEO", "BEAR"], { asc: 17 }));
    expect(playerPower(s17, "DEXTERITY")?.amount).toBe(-4);
  });

  test("Bear: fixed Hug, Lunge (9 + 9 block), Maul (18) alternation; A2: 10/20", () => {
    for (const moves of moveSequences(["BEAR"], 0, { turns: 9 })) {
      expect(moves[0]).toBe("BEAR_BEAR_HUG");
      for (let i = 1; i < moves.length; i++) {
        expect(moves[i]).toBe(i % 2 === 1 ? "BEAR_LUNGE" : "BEAR_MAUL");
      }
    }
    let s = fight(["BEAR"], { seed: "BEAR" });
    s = endTurn(s); // hug
    const hp1 = s.run.hp;
    s = endTurn(s); // lunge
    expect(hp1 - s.run.hp).toBe(9);
    expect(mon(s).block).toBe(9);
    const hp2 = s.run.hp;
    s = endTurn(s); // maul
    expect(hp2 - s.run.hp).toBe(18);
    let s2 = fight(["BEAR"], { asc: 2 });
    s2 = endTurn(s2);
    const hpA = s2.run.hp;
    s2 = endTurn(s2);
    expect(hpA - s2.run.hp).toBe(10);
    const hpB = s2.run.hp;
    s2 = endTurn(s2);
    expect(hpB - s2.run.hp).toBe(20);
  });

  test("Romeo: Mock then Agonizing Slash (10 + Weak 2) / Cross Slash (15) alternating; A2: 12/17; A17 Weak 3", () => {
    for (const moves of moveSequences(["ROMEO"], 0, { turns: 9 })) {
      expect(moves[0]).toBe("ROMEO_MOCK");
      for (let i = 1; i < moves.length; i++) {
        expect(moves[i]).toBe(i % 2 === 1 ? "ROMEO_AGONIZING_SLASH" : "ROMEO_CROSS_SLASH");
      }
    }
    let s = fight(["ROMEO"], { seed: "ROMEO" });
    s = endTurn(s); // mock: nothing
    const hp1 = s.run.hp;
    s = endTurn(s); // agonizing slash
    expect(hp1 - s.run.hp).toBe(10);
    expect(playerPower(s, "WEAK")?.amount).toBe(2);
    const hp2 = s.run.hp;
    s = endTurn(s); // cross slash
    expect(hp2 - s.run.hp).toBe(15);
    let s17 = fight(["ROMEO"], { asc: 17 });
    s17 = endTurn(s17);
    const hpA = s17.run.hp;
    s17 = endTurn(s17);
    expect(hpA - s17.run.hp).toBe(12); // A17 implies the A2 damage tier
    expect(playerPower(s17, "WEAK")?.amount).toBe(3);
  });

  test("Pointy: 5x2 every turn (A2: 6x2)", () => {
    for (const moves of moveSequences(["POINTY"], 0, { turns: 10 })) {
      expect(moves.every((m) => m === "POINTY_ATTACK")).toBe(true);
    }
    expectMoveDamage("POINTY", "POINTY_ATTACK", 5, 2);
    expectMoveDamage("POINTY", "POINTY_ATTACK", 6, 2, { asc: 2 });
  });
});
