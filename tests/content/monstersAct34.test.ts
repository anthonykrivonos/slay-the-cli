// Act-3/4 monster content tests — every corpus entity in
// data/corpus/monsters-act34.json: HP bands (A0 + A7/8/9), exact move damage
// through real combats (ascension tiers included), seed-swept history rules,
// and the boss mechanics: Darkling revive/true-death, Awakened One phase
// flip + rebirth, Time Eater 12-card forced turn end + one-shot Haste,
// Corrupt Heart Invincible / Beat of Death / Debilitate / buff cycle,
// Reptomancer dagger cap, Donu & Deca alternation, Spire elite back attack.

import { test, expect, describe } from "bun:test";
import { createCombatGame, advance, type GameState } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content/index";
import { act34Monsters, act34Powers } from "../../src/content/monsters/act34/index";
import type { CardDef, ContentBundle } from "../../src/engine/content/defs";

// ------------------------------------------------------------------------------
// bundle: base content + act-3/4 monsters/powers + test-only utility cards
// ------------------------------------------------------------------------------

function testAttack(id: string, damage: number): CardDef {
  return {
    id,
    name: id,
    color: "red",
    type: "attack",
    rarity: "special",
    cost: 0,
    target: "enemy",
    values: { damage },
    upgradeValues: {},
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
  };
}

function makeBundle(): ContentBundle {
  const b = buildBaseContentBundle();
  for (const m of act34Monsters) b.monsters.set(m.id, m);
  for (const p of act34Powers) if (!b.powers.has(p.id)) b.powers.set(p.id, p);
  b.cards.set("T_NUKE", testAttack("T_NUKE", 500));
  b.cards.set("T_BLAST", testAttack("T_BLAST", 250));
  b.cards.set("T_FREE", {
    id: "T_FREE",
    name: "T_FREE",
    color: "red",
    type: "skill",
    rarity: "special",
    cost: 0,
    target: "self",
    values: { magic: 1 },
    upgradeValues: {},
    keywords: [],
    primitives: [{ do: "draw", n: "magic" }],
  });
  return b;
}

const bundle = makeBundle();
const SEEDS = Array.from({ length: 20 }, (_, i) => `A34S${i}`);
const defendDeck = Array(10).fill({ defId: "DEFEND_RED" });
const strikeDeck = Array(10).fill({ defId: "STRIKE_RED" });
const nukeDeck = Array(10).fill({ defId: "T_NUKE" });

interface FightOpts {
  seed?: string;
  asc?: number;
  deck?: { defId: string }[];
  relics?: string[];
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
    relics: opts.relics,
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
const countCards = (s: GameState, defId: string) =>
  Object.values(s.combat!.cards).filter((c) => c.defId === defId).length;
const won = (s: GameState) => s.eventLog.some((e) => e.event === "combatEnded");

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

/** End-of-turn self-damage the player takes regardless of the monster's move
 *  (Burns held in hand + the Constricted tick). */
function extraSelfDamage(s: GameState): number {
  const burns = s.combat!.player.piles.hand.reduce((sum: number, iid: number) => {
    const c = s.combat!.cards[iid]!;
    return c.defId === "BURN" ? sum + (c.upgrades > 0 ? 4 : 2) : sum;
  }, 0);
  return burns + (playerPower(s, "CONSTRICTED")?.amount ?? 0);
}

/** Find `moveId` as intent (no player Vulnerable/Intangible, no block) and
 *  assert the exact HP delta: (base + Strength) x hits + burn/constrict ticks. */
function expectMoveDamage(monsterId: string, moveId: string, base: number, hits = 1, opts: FightOpts = {}): void {
  for (const seed of SEEDS) {
    let s = fight([monsterId], { ...opts, seed });
    for (let t = 0; t < 25; t++) {
      const m = mon(s);
      if (m.isDead || m.isEscaped || !m.move) break;
      if (m.move === moveId && !playerPower(s, "VULNERABLE") && !playerPower(s, "INTANGIBLE")) {
        const str = monPower(s, 0, "STRENGTH")?.amount ?? 0;
        const extra = extraSelfDamage(s);
        const before = s.run.hp;
        expect(s.combat!.player.block).toBe(0);
        s = endTurn(s);
        expect(before - s.run.hp).toBe((base + str) * hits + extra);
        return;
      }
      s = endTurn(s);
      if (s.outcome || !s.combat) break;
    }
  }
  throw new Error(`${moveId} never observed for ${monsterId}`);
}

// ------------------------------------------------------------------------------
// Darkling
// ------------------------------------------------------------------------------

describe("Darkling", () => {
  test("HP: [48,56] A0, [50,59] A7", () => {
    expectHpRange("DARKLING", 0, 48, 56);
    expectHpRange("DARKLING", 7, 50, 59);
  });

  test("Nip damage rolled at spawn: [7,11] A0, [9,13]+2 A2; Nip deals exactly it", () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const d0 = mon(fight(["DARKLING"], { seed })).data.nipDamage as number;
      expect(d0).toBeGreaterThanOrEqual(7);
      expect(d0).toBeLessThanOrEqual(11);
      const d2 = mon(fight(["DARKLING"], { seed, asc: 2 })).data.nipDamage as number;
      expect(d2).toBeGreaterThanOrEqual(9);
      expect(d2).toBeLessThanOrEqual(13);
    }
    for (const [asc, bonus] of [
      [0, 0],
      [2, 2],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["DARKLING"], { seed, asc });
        const nip = mon(s).data.nipDamage as number;
        for (let t = 0; t < 8 && !found; t++) {
          if (mon(s).move === "DARKLING_NIP") {
            const str = monPower(s, 0, "STRENGTH")?.amount ?? 0;
            const before = s.run.hp;
            s = endTurn(s);
            expect(before - s.run.hp).toBe(nip + bonus + str);
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

  test("Chomp 8x2 (adjudicated two hits), 9x2 at A2; Harden 12 block (+2 Str A17)", () => {
    expectMoveDamage("DARKLING", "DARKLING_CHOMP", 8, 2);
    expectMoveDamage("DARKLING", "DARKLING_CHOMP", 9, 2, { asc: 2 });
    for (const [asc, str] of [
      [0, 0],
      [17, 2],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["DARKLING"], { seed, asc });
        if (mon(s).move === "DARKLING_HARDEN") {
          s = endTurn(s);
          expect(mon(s).block).toBe(12);
          expect(monPower(s, 0, "STRENGTH")?.amount ?? 0).toBe(str);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }
  });

  test("history: first turn Harden/Nip only; Chomp <2x, Harden <2x, Nip <3x", () => {
    const firsts = new Set<string>();
    for (const moves of moveSequences("DARKLING")) {
      firsts.add(moves[0]!);
      expect(["DARKLING_HARDEN", "DARKLING_NIP"]).toContain(moves[0]!);
      expect(maxRunLength(moves, "DARKLING_CHOMP")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "DARKLING_HARDEN")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "DARKLING_NIP")).toBeLessThanOrEqual(2);
    }
    expect(firsts.size).toBe(2);
  });

  test("the middle Darkling (idx 1) never Chomps", () => {
    let sawSideChomp = false;
    for (const seed of SEEDS.slice(0, 10)) {
      let s = fight(["DARKLING", "DARKLING", "DARKLING"], { seed });
      for (let t = 0; t < 12; t++) {
        expect(mon(s, 1).move).not.toBe("DARKLING_CHOMP");
        if (mon(s, 0).move === "DARKLING_CHOMP" || mon(s, 2).move === "DARKLING_CHOMP") sawSideChomp = true;
        s = endTurn(s);
      }
    }
    expect(sawSideChomp).toBe(true);
  });

  test("revive cycle: killed Darkling is a half-dead corpse, Regrow -> Reincarnate -> back at 50% max HP", () => {
    let s = fight(["DARKLING", "DARKLING", "DARKLING"], { seed: "REGROW", deck: nukeDeck });
    const maxHp = mon(s, 0).maxHp;
    s = play(s, "T_NUKE", 0);
    expect(won(s)).toBe(false);
    expect(mon(s, 0).isDead).toBe(false);
    expect(mon(s, 0).halfDead).toBe(true);
    expect(mon(s, 0).hp).toBe(0);
    expect(mon(s, 0).move).toBe("DARKLING_REGROW");
    expect(mon(s, 0).powers.map((p) => p.id)).toEqual(["REGROW"]); // statuses/strength wiped
    s = endTurn(s); // its Regrow turn passes
    expect(mon(s, 0).halfDead).toBe(true);
    expect(mon(s, 0).move).toBe("DARKLING_REINCARNATE");
    s = endTurn(s); // Reincarnate: revives
    expect(mon(s, 0).halfDead).toBe(false);
    expect(mon(s, 0).isDead).toBe(false);
    expect(mon(s, 0).hp).toBe(Math.floor(maxHp / 2));
    expect(["DARKLING_NIP", "DARKLING_CHOMP", "DARKLING_HARDEN"]).toContain(mon(s, 0).move!);
  });

  test("true death: killing the last living Darkling wins even while others regrow", () => {
    let s = fight(["DARKLING", "DARKLING", "DARKLING"], { seed: "REGROW2", deck: nukeDeck });
    s = play(s, "T_NUKE", 0);
    s = endTurn(s); // darkling 0 now shows Reincarnate next turn
    s = play(s, "T_NUKE", 1);
    expect(mon(s, 1).halfDead).toBe(true); // darkling 2 still alive: regrows
    s = play(s, "T_NUKE", 2); // last living one: everyone dies for real
    expect(won(s)).toBe(true);
    for (const idx of [0, 1, 2]) {
      expect(mon(s, idx).isDead).toBe(true);
      expect(mon(s, idx).halfDead).toBe(false);
    }
  });
});

// ------------------------------------------------------------------------------
// Orb Walker
// ------------------------------------------------------------------------------

describe("Orb Walker", () => {
  test("HP: [90,96] A0, [92,102] A7", () => {
    expectHpRange("ORB_WALKER", 0, 90, 96);
    expectHpRange("ORB_WALKER", 7, 92, 102);
  });

  test("Laser 10 (A2 11) + 1 Burn to draw + 1 to discard; Claw 15 (A2 16)", () => {
    expectMoveDamage("ORB_WALKER", "ORB_WALKER_LASER", 10);
    expectMoveDamage("ORB_WALKER", "ORB_WALKER_CLAW", 15);
    expectMoveDamage("ORB_WALKER", "ORB_WALKER_LASER", 11, 1, { asc: 2 });
    expectMoveDamage("ORB_WALKER", "ORB_WALKER_CLAW", 16, 1, { asc: 2 });
    let found = false;
    for (const seed of SEEDS) {
      let s = fight(["ORB_WALKER"], { seed });
      if (mon(s).move === "ORB_WALKER_LASER") {
        s = endTurn(s);
        expect(countCards(s, "BURN")).toBe(2);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("Strength Up 3 (A17: 5) at the end of every turn", () => {
    let s = fight(["ORB_WALKER"], { seed: "ORB" });
    expect(monPower(s, 0, "STRENGTH_UP")?.amount).toBe(3);
    s = endTurn(s);
    expect(monPower(s, 0, "STRENGTH")?.amount).toBe(3);
    expect(monPower(s, 0, "STRENGTH_UP")?.amount).toBe(3); // persistent, unlike Dark Shackles' one-shot
    s = endTurn(s);
    expect(monPower(s, 0, "STRENGTH")?.amount).toBe(6);
    expect(monPower(fight(["ORB_WALKER"], { asc: 17 }), 0, "STRENGTH_UP")?.amount).toBe(5);
  });

  test("history: Claw never 3x, Laser never 3x", () => {
    for (const moves of moveSequences("ORB_WALKER", { turns: 14 })) {
      expect(maxRunLength(moves, "ORB_WALKER_CLAW")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "ORB_WALKER_LASER")).toBeLessThanOrEqual(2);
    }
  });
});

// ------------------------------------------------------------------------------
// Shapes
// ------------------------------------------------------------------------------

describe("Spiker", () => {
  test("HP [42,56]/[44,60] A7; Thorns 3/4(A2)/7(A17); Cut 7/9(A2)", () => {
    expectHpRange("SPIKER", 0, 42, 56);
    expectHpRange("SPIKER", 7, 44, 60);
    expect(monPower(fight(["SPIKER"]), 0, "THORNS")?.amount).toBe(3);
    expect(monPower(fight(["SPIKER"], { asc: 2 }), 0, "THORNS")?.amount).toBe(4);
    expect(monPower(fight(["SPIKER"], { asc: 17 }), 0, "THORNS")?.amount).toBe(7);
    expectMoveDamage("SPIKER", "SPIKER_CUT", 7);
    expectMoveDamage("SPIKER", "SPIKER_CUT", 9, 1, { asc: 2 });
  });

  test("Spike +2 Thorns, at most 6 times; Cut never 2x while Spike available; thorns retaliate", () => {
    for (const moves of moveSequences("SPIKER", { turns: 18 })) {
      const spikes = moves.filter((m) => m === "SPIKER_SPIKE").length;
      expect(spikes).toBeLessThanOrEqual(6);
      for (let i = 1; i < moves.length; i++) {
        if (moves[i] === "SPIKER_CUT" && moves[i - 1] === "SPIKER_CUT") {
          // consecutive Cuts only once Spike is exhausted
          expect(moves.slice(0, i).filter((m) => m === "SPIKER_SPIKE").length).toBe(6);
        }
      }
    }
    let s = fight(["SPIKER"], { seed: "SPK", deck: strikeDeck });
    const before = s.run.hp;
    s = play(s, "STRIKE_RED", 0);
    expect(before - s.run.hp).toBe(3); // thorns 3
  });
});

describe("Repulsor", () => {
  test("HP [29,35]/[31,38] A7; Bash 11/13(A2), never 2x; Repulse shuffles 2 Dazed", () => {
    expectHpRange("REPULSOR", 0, 29, 35);
    expectHpRange("REPULSOR", 7, 31, 38);
    expectMoveDamage("REPULSOR", "REPULSOR_BASH", 11);
    expectMoveDamage("REPULSOR", "REPULSOR_BASH", 13, 1, { asc: 2 });
    for (const moves of moveSequences("REPULSOR", { turns: 14 })) {
      expect(maxRunLength(moves, "REPULSOR_BASH")).toBeLessThanOrEqual(1);
    }
    let s = fight(["REPULSOR"], { seed: "REP" });
    let expected = 0;
    for (let t = 0; t < 4; t++) {
      if (mon(s).move === "REPULSOR_REPULSE") expected += 2;
      s = endTurn(s);
      expect(countCards(s, "DAZED")).toBe(expected);
    }
    expect(expected).toBeGreaterThan(0);
  });
});

describe("Exploder", () => {
  test("HP 30 flat A0, [30,35] A7; fixed Slam, Slam, Explode(30) suicide", () => {
    expectHpRange("EXPLODER", 0, 30, 30);
    expectHpRange("EXPLODER", 7, 30, 35);
    expectMoveDamage("EXPLODER", "EXPLODER_SLAM", 9);
    expectMoveDamage("EXPLODER", "EXPLODER_SLAM", 11, 1, { asc: 2 });
    for (const seed of SEEDS.slice(0, 6)) {
      let s = fight(["EXPLODER"], { seed });
      expect(monPower(s, 0, "EXPLOSIVE")?.amount).toBe(3);
      expect(mon(s).move).toBe("EXPLODER_SLAM");
      s = endTurn(s);
      expect(mon(s).move).toBe("EXPLODER_SLAM");
      s = endTurn(s);
      expect(mon(s).move).toBe("EXPLODER_EXPLODE");
      const before = s.run.hp;
      s = endTurn(s);
      expect(before - s.run.hp).toBe(30); // non-attack: no strength/vuln mods
      expect(mon(s).isDead).toBe(true);
      expect(won(s)).toBe(true);
    }
  });
});

// ------------------------------------------------------------------------------
// Transient
// ------------------------------------------------------------------------------

describe("Transient", () => {
  test("HP fixed 999; attack 30 +10/turn (A2: 40 base)", () => {
    expectHpRange("TRANSIENT", 0, 999, 999);
    expectHpRange("TRANSIENT", 7, 999, 999);
    let s = fight(["TRANSIENT"], { seed: "TR" });
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(30);
    const hp1 = s.run.hp;
    s = endTurn(s);
    expect(hp1 - s.run.hp).toBe(40);
    const hp2 = s.run.hp;
    s = endTurn(s);
    expect(hp2 - s.run.hp).toBe(50);
    let s2 = fight(["TRANSIENT"], { asc: 2 });
    const hp3 = s2.run.hp;
    s2 = endTurn(s2);
    expect(hp3 - s2.run.hp).toBe(40);
  });

  test("Fading 5 (A17: 6): attacks that many turns then fades away — player wins", () => {
    for (const [asc, turns] of [
      [0, 5],
      [17, 6],
    ] as const) {
      let s = fight(["TRANSIENT"], { asc });
      expect(monPower(s, 0, "FADING")?.amount).toBe(turns);
      for (let t = 0; t < turns - 1; t++) {
        s = endTurn(s);
        expect(mon(s).isEscaped).toBe(false);
      }
      s = endTurn(s);
      expect(mon(s).isEscaped).toBe(true);
      expect(won(s)).toBe(true);
    }
  });

  test("Shifting: unblocked HP loss = -Strength + Shackled; restored after its turn", () => {
    let s = fight(["TRANSIENT"], { seed: "SHIFT", deck: strikeDeck });
    s = play(s, "STRIKE_RED", 0);
    expect(monPower(s, 0, "STRENGTH")?.amount).toBe(-6);
    expect(monPower(s, 0, "SHACKLED")?.amount).toBe(6);
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(24); // 30 - 6
    expect(monPower(s, 0, "STRENGTH")?.amount ?? 0).toBe(0); // restored
    expect(monPower(s, 0, "SHACKLED")).toBeUndefined();
    const hp1 = s.run.hp;
    s = endTurn(s);
    expect(hp1 - s.run.hp).toBe(40); // turn 2 at full strength
  });
});

// ------------------------------------------------------------------------------
// The Maw
// ------------------------------------------------------------------------------

describe("The Maw", () => {
  test("HP fixed 300; turn 1 always Roar: Weak+Frail 3 (A17: 5)", () => {
    expectHpRange("THE_MAW", 0, 300, 300);
    expectHpRange("THE_MAW", 7, 300, 300);
    for (const [asc, n] of [
      [0, 3],
      [17, 5],
    ] as const) {
      let s = fight(["THE_MAW"], { asc });
      expect(mon(s).move).toBe("THE_MAW_ROAR");
      s = endTurn(s);
      expect(playerPower(s, "WEAK")?.amount).toBe(n);
      expect(playerPower(s, "FRAIL")?.amount).toBe(n);
    }
  });

  test("Slam 25 (A2 30) never 2x; Nom always followed by Drool (+3/+5 Str)", () => {
    expectMoveDamage("THE_MAW", "THE_MAW_SLAM", 25);
    expectMoveDamage("THE_MAW", "THE_MAW_SLAM", 30, 1, { asc: 2 });
    for (const moves of moveSequences("THE_MAW", { turns: 16 })) {
      expect(moves[0]).toBe("THE_MAW_ROAR");
      expect(maxRunLength(moves, "THE_MAW_SLAM")).toBeLessThanOrEqual(1);
      for (let i = 0; i < moves.length - 1; i++) {
        if (moves[i] === "THE_MAW_NOM") expect(moves[i + 1]).toBe("THE_MAW_DROOL");
      }
    }
  });

  test("Nom hit count = ceil(turn/2) at 5 per hit (+Str)", () => {
    let found = false;
    for (const seed of SEEDS) {
      let s = fight(["THE_MAW"], { seed });
      for (let t = 1; t <= 12; t++) {
        if (mon(s).move === "THE_MAW_NOM" && !playerPower(s, "VULNERABLE")) {
          const str = monPower(s, 0, "STRENGTH")?.amount ?? 0;
          const hits = Math.floor((t + 1) / 2);
          const before = s.run.hp;
          s = endTurn(s);
          expect(before - s.run.hp).toBe((5 + str) * hits);
          found = true;
          break;
        }
        s = endTurn(s);
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });
});

// ------------------------------------------------------------------------------
// Spire Growth
// ------------------------------------------------------------------------------

describe("Spire Growth", () => {
  test("HP 170 A0, 190 A7; Quick Tackle 16/18(A2), Smash 22/25(A2)", () => {
    expectHpRange("SPIRE_GROWTH", 0, 170, 170);
    expectHpRange("SPIRE_GROWTH", 7, 190, 190);
    expectMoveDamage("SPIRE_GROWTH", "SPIRE_GROWTH_QUICK_TACKLE", 16);
    expectMoveDamage("SPIRE_GROWTH", "SPIRE_GROWTH_SMASH", 22);
    expectMoveDamage("SPIRE_GROWTH", "SPIRE_GROWTH_QUICK_TACKLE", 18, 1, { asc: 2 });
    expectMoveDamage("SPIRE_GROWTH", "SPIRE_GROWTH_SMASH", 25, 1, { asc: 2 });
  });

  test("A17: Constrict whenever legal (turn 1); Constricted 12 damages at end of player turn", () => {
    let s = fight(["SPIRE_GROWTH"], { asc: 17 });
    expect(mon(s).move).toBe("SPIRE_GROWTH_CONSTRICT");
    s = endTurn(s);
    expect(playerPower(s, "CONSTRICTED")?.amount).toBe(12);
    const move = mon(s).move!;
    const moveDmg = move === "SPIRE_GROWTH_QUICK_TACKLE" ? 18 : 25;
    const before = s.run.hp;
    s = endTurn(s);
    expect(before - s.run.hp).toBe(moveDmg + 12);
  });

  test("Constrict never re-used while the player is Constricted; attacks never 3x", () => {
    for (const asc of [0, 17]) {
      for (const moves of moveSequences("SPIRE_GROWTH", { asc, turns: 16 })) {
        const constricts = moves.filter((m) => m === "SPIRE_GROWTH_CONSTRICT").length;
        expect(constricts).toBeLessThanOrEqual(1); // the debuff never expires
        expect(maxRunLength(moves, "SPIRE_GROWTH_QUICK_TACKLE")).toBeLessThanOrEqual(2);
        expect(maxRunLength(moves, "SPIRE_GROWTH_SMASH")).toBeLessThanOrEqual(2);
      }
    }
  });
});

// ------------------------------------------------------------------------------
// Writhing Mass
// ------------------------------------------------------------------------------

describe("Writhing Mass", () => {
  test("HP 160 A0, 175 A7; damage numbers incl. A2 tier", () => {
    expectHpRange("WRITHING_MASS", 0, 160, 160);
    expectHpRange("WRITHING_MASS", 7, 175, 175);
    expectMoveDamage("WRITHING_MASS", "WRITHING_MASS_STRONG_STRIKE", 32);
    expectMoveDamage("WRITHING_MASS", "WRITHING_MASS_MULTI_STRIKE", 7, 3);
    expectMoveDamage("WRITHING_MASS", "WRITHING_MASS_STRONG_STRIKE", 38, 1, { asc: 2 });
    expectMoveDamage("WRITHING_MASS", "WRITHING_MASS_MULTI_STRIKE", 9, 3, { asc: 2 });
  });

  test("first turn is MultiStrike/Flail/Wither (~1/3 each); no move ever twice in a row; Implant once", () => {
    const firsts = new Set<string>();
    for (const moves of moveSequences("WRITHING_MASS", { turns: 18 })) {
      firsts.add(moves[0]!);
      expect(["WRITHING_MASS_MULTI_STRIKE", "WRITHING_MASS_FLAIL", "WRITHING_MASS_WITHER"]).toContain(moves[0]!);
      for (let i = 1; i < moves.length; i++) expect(moves[i]).not.toBe(moves[i - 1]);
      expect(moves.filter((m) => m === "WRITHING_MASS_IMPLANT").length).toBeLessThanOrEqual(1);
    }
    expect(firsts.size).toBe(3);
  });

  test("Malleable (adjudicated 4): block 4 then 5 per hit taken, escalating; resets to 4", () => {
    let s = fight(["WRITHING_MASS"], { seed: "MALL", deck: strikeDeck });
    expect(monPower(s, 0, "MALLEABLE")?.amount).toBe(4);
    s = play(s, "STRIKE_RED", 0);
    expect(mon(s).block).toBe(4);
    expect(monPower(s, 0, "MALLEABLE")?.amount).toBe(5);
    s = play(s, "STRIKE_RED", 0); // 4 blocked, 2 unblocked
    expect(mon(s).block).toBe(5);
    expect(monPower(s, 0, "MALLEABLE")?.amount).toBe(6);
    s = endTurn(s);
    expect(monPower(s, 0, "MALLEABLE")?.amount).toBe(4); // reset
  });

  test("Reactive: an unblocked hit rerolls the intent (never into the same move)", () => {
    for (const seed of SEEDS.slice(0, 5)) {
      let s = fight(["WRITHING_MASS"], { seed, deck: strikeDeck });
      const before = mon(s).move;
      s = play(s, "STRIKE_RED", 0);
      expect(mon(s).move).not.toBe(before);
    }
  });

  test("Implant puts a PARASITE into the MASTER deck (Darkstone Periapt +6 max HP)", () => {
    let found = false;
    for (const seed of SEEDS) {
      let s = fight(["WRITHING_MASS"], { seed, relics: ["DARKSTONE_PERIAPT"] });
      for (let t = 0; t < 18; t++) {
        if (mon(s).move === "WRITHING_MASS_IMPLANT") {
          expect(s.run.deck.some((c) => c.defId === "PARASITE")).toBe(false);
          s = endTurn(s);
          expect(s.run.deck.filter((c) => c.defId === "PARASITE").length).toBe(1);
          expect(s.run.maxHp).toBe(5006);
          expect(mon(s).data.usedImplant).toBe(true);
          found = true;
          break;
        }
        s = endTurn(s);
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });
});

// ------------------------------------------------------------------------------
// Giant Head (elite)
// ------------------------------------------------------------------------------

describe("Giant Head", () => {
  test("HP 500 A0, 520 A8; Count 13; Glare Weak 1", () => {
    expectHpRange("GIANT_HEAD", 0, 500, 500);
    expectHpRange("GIANT_HEAD", 8, 520, 520);
    expectMoveDamage("GIANT_HEAD", "GIANT_HEAD_COUNT", 13);
    let found = false;
    for (const seed of SEEDS) {
      let s = fight(["GIANT_HEAD"], { seed });
      if (mon(s).move === "GIANT_HEAD_GLARE") {
        s = endTurn(s);
        expect(playerPower(s, "WEAK")?.amount).toBe(1);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("Count/Glare (never 3x) turns 1-4, It Is Time forever from turn 5; 30 +5/turn capped +30", () => {
    for (const moves of moveSequences("GIANT_HEAD", { turns: 14 })) {
      for (let i = 0; i < Math.min(4, moves.length); i++) {
        expect(["GIANT_HEAD_COUNT", "GIANT_HEAD_GLARE"]).toContain(moves[i]!);
      }
      for (let i = 4; i < moves.length; i++) expect(moves[i]).toBe("GIANT_HEAD_IT_IS_TIME");
      expect(maxRunLength(moves.slice(0, 4), "GIANT_HEAD_COUNT")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves.slice(0, 4), "GIANT_HEAD_GLARE")).toBeLessThanOrEqual(2);
    }
    let s = fight(["GIANT_HEAD"], { seed: "GH" });
    for (let t = 0; t < 4; t++) s = endTurn(s);
    // turns 5..12: 30, 35, 40, 45, 50, 55, 60, 60 (cap)
    const want = [30, 35, 40, 45, 50, 55, 60, 60];
    for (const dmg of want) {
      expect(mon(s).move).toBe("GIANT_HEAD_IT_IS_TIME");
      const before = s.run.hp;
      s = endTurn(s);
      expect(before - s.run.hp).toBe(dmg);
    }
  });

  test("A18 (adjudicated per wiki): It Is Time starts turn 4 at 40 (+5/turn)", () => {
    let s = fight(["GIANT_HEAD"], { asc: 18, seed: "GH18" });
    for (let t = 0; t < 3; t++) {
      expect(mon(s).move).not.toBe("GIANT_HEAD_IT_IS_TIME");
      s = endTurn(s);
    }
    expect(mon(s).move).toBe("GIANT_HEAD_IT_IS_TIME");
    const before = s.run.hp;
    s = endTurn(s);
    expect(before - s.run.hp).toBe(40);
    const before2 = s.run.hp;
    s = endTurn(s);
    expect(before2 - s.run.hp).toBe(45);
  });

  test("Slow: +1 per card, +10% damage taken each, resets each round", () => {
    let s = fight(["GIANT_HEAD"], { seed: "SLOW", deck: strikeDeck });
    expect(monPower(s, 0, "SLOW")?.amount).toBe(0);
    const hp0 = mon(s).hp;
    s = play(s, "STRIKE_RED", 0);
    expect(hp0 - mon(s).hp).toBe(6); // slow 0
    const hp1 = mon(s).hp;
    s = play(s, "STRIKE_RED", 0);
    expect(hp1 - mon(s).hp).toBe(6); // floor(6 * 1.1) = 6
    const hp2 = mon(s).hp;
    s = play(s, "STRIKE_RED", 0);
    expect(hp2 - mon(s).hp).toBe(7); // floor(6 * 1.2) = 7
    expect(monPower(s, 0, "SLOW")?.amount).toBe(3);
    s = endTurn(s);
    expect(monPower(s, 0, "SLOW")?.amount).toBe(0);
  });
});

// ------------------------------------------------------------------------------
// Nemesis (elite)
// ------------------------------------------------------------------------------

describe("Nemesis", () => {
  test("HP 185 A0, 200 A8; Attack 6x3 (A3 7x3), Scythe 45", () => {
    expectHpRange("NEMESIS", 0, 185, 185);
    expectHpRange("NEMESIS", 8, 200, 200);
    expectMoveDamage("NEMESIS", "NEMESIS_ATTACK", 6, 3);
    expectMoveDamage("NEMESIS", "NEMESIS_ATTACK", 7, 3, { asc: 3 });
    expectMoveDamage("NEMESIS", "NEMESIS_SCYTHE", 45);
  });

  test("Intangible every other turn: damage capped at 1 on even turns", () => {
    let s = fight(["NEMESIS"], { seed: "NEM", deck: strikeDeck });
    expect(monPower(s, 0, "INTANGIBLE")).toBeUndefined();
    const hp0 = mon(s).hp;
    s = play(s, "STRIKE_RED", 0);
    expect(hp0 - mon(s).hp).toBe(6);
    s = endTurn(s); // acts, gains Intangible 2, end-of-round tick -> 1
    expect(monPower(s, 0, "INTANGIBLE")?.amount).toBe(1);
    const hp1 = mon(s).hp;
    s = play(s, "STRIKE_RED", 0);
    expect(hp1 - mon(s).hp).toBe(1); // capped
    s = endTurn(s); // still intangible during its turn 2: no re-gain; tick -> gone
    expect(monPower(s, 0, "INTANGIBLE")).toBeUndefined();
    const hp2 = mon(s).hp;
    s = play(s, "STRIKE_RED", 0);
    expect(hp2 - mon(s).hp).toBe(6);
  });

  test("Debuff: 3 Burns to discard (A18 5, adjudicated per wiki); never Scythe turn 1", () => {
    for (const [asc, burns] of [
      [0, 3],
      [18, 5],
    ] as const) {
      let found = false;
      for (const seed of SEEDS) {
        let s = fight(["NEMESIS"], { seed, asc });
        expect(mon(s).move).not.toBe("NEMESIS_SCYTHE");
        if (mon(s).move === "NEMESIS_DEBUFF") {
          s = endTurn(s);
          expect(countCards(s, "BURN")).toBe(burns);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }
  });

  test("history: Scythe not within 2 moves of itself; Debuff never 2x; Attack never 3x", () => {
    for (const moves of moveSequences("NEMESIS", { turns: 16 })) {
      for (let i = 0; i < moves.length; i++) {
        if (moves[i] === "NEMESIS_SCYTHE") {
          expect(moves[i + 1]).not.toBe("NEMESIS_SCYTHE");
          expect(moves[i + 2]).not.toBe("NEMESIS_SCYTHE");
        }
      }
      expect(maxRunLength(moves, "NEMESIS_DEBUFF")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "NEMESIS_ATTACK")).toBeLessThanOrEqual(2);
    }
  });
});

// ------------------------------------------------------------------------------
// Reptomancer (elite) + Snake Daggers
// ------------------------------------------------------------------------------

describe("Reptomancer", () => {
  test("HP: repto [180,190]/[190,200] A8; dagger [20,25]", () => {
    expectHpRange("REPTOMANCER", 0, 180, 190);
    expectHpRange("REPTOMANCER", 8, 190, 200);
    expectHpRange("DAGGER", 0, 20, 25);
  });

  test("turn 1 always Summon; new dagger has Stab preset and skips the summon round", () => {
    for (const seed of SEEDS.slice(0, 5)) {
      let s = fight(["DAGGER", "REPTOMANCER", "DAGGER"], { seed });
      expect(mon(s, 1).move).toBe("REPTOMANCER_SUMMON");
      const hp0 = s.run.hp;
      s = endTurn(s);
      expect(hp0 - s.run.hp).toBe(18); // only the two initial daggers stab (9x2)
      expect(countCards(s, "WOUND")).toBe(2);
      expect(s.combat!.monsters.length).toBe(5); // padded to the 5-slot layout
      const alive = s.combat!.monsters.filter((m) => m.id === "DAGGER" && !m.isDead && !m.isEscaped);
      expect(alive.length).toBe(3); // one new dagger (A0 summons 1)
      expect(mon(s, 4).id).toBe("DAGGER"); // search order [4,1,3,0]
      expect(mon(s, 4).move).toBe("DAGGER_STAB");
    }
  });

  test("dagger cycle: Stab (9 + Wound) then Explode (25) then real death", () => {
    let s = fight(["DAGGER"], { seed: "DAG" });
    expect(mon(s).move).toBe("DAGGER_STAB");
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(9);
    expect(countCards(s, "WOUND")).toBe(1);
    expect(mon(s).move).toBe("DAGGER_EXPLODE");
    const hp1 = s.run.hp;
    s = endTurn(s);
    expect(hp1 - s.run.hp).toBe(25);
    expect(mon(s).isDead).toBe(true);
    expect(won(s)).toBe(true);
  });

  test("A18: turn-1 double summon -> 4 daggers; Summon never offered at the 4-dagger cap", () => {
    let s = fight(["DAGGER", "REPTOMANCER", "DAGGER"], { seed: "R18", asc: 18 });
    s = endTurn(s);
    const daggersAlive = () =>
      s.combat!.monsters.filter((m) => m.id === "DAGGER" && !m.isDead && !m.isEscaped).length;
    expect(daggersAlive()).toBe(4);
    for (let t = 0; t < 10; t++) {
      if (daggersAlive() >= 4) expect(mon(s, 1).move).not.toBe("REPTOMANCER_SUMMON");
      expect(daggersAlive()).toBeLessThanOrEqual(4);
      s = endTurn(s);
      if (s.outcome || mon(s, 1).isDead) break;
    }
  });

  test("solo damage: Snake Strike 13x2 / Big Bite 30, plus dagger stabs 9 / explodes 25", () => {
    let s = fight(["REPTOMANCER"], { seed: "RSOLO" });
    expect(mon(s, 0).move).toBe("REPTOMANCER_SUMMON");
    const dmgOf = (m: string) =>
      m === "REPTOMANCER_SNAKE_STRIKE" ? 26 : m === "REPTOMANCER_BIG_BITE" ? 30 : m === "DAGGER_STAB" ? 9 : m === "DAGGER_EXPLODE" ? 25 : 0;
    let sawAttack = false;
    for (let t = 0; t < 8; t++) {
      const acting = s.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped && !m.halfDead);
      const expected = acting.reduce((a, m) => a + dmgOf(m.move!), 0);
      const reptoMove = mon(s, 0).move!;
      const before = s.run.hp;
      s = endTurn(s);
      expect(before - s.run.hp).toBe(expected); // freshly summoned daggers never act this round
      if (reptoMove === "REPTOMANCER_SNAKE_STRIKE") {
        expect(playerPower(s, "WEAK")).toBeDefined(); // Snake Strike applies Weak 1
        sawAttack = true;
      } else if (reptoMove === "REPTOMANCER_BIG_BITE") {
        sawAttack = true;
      }
    }
    expect(sawAttack).toBe(true);
  });

  test("killing the Reptomancer ends the fight — daggers flee", () => {
    let s = fight(["DAGGER", "REPTOMANCER", "DAGGER"], { seed: "RKILL", deck: nukeDeck });
    s = play(s, "T_NUKE", 1);
    expect(won(s)).toBe(true);
    expect(mon(s, 1).isDead).toBe(true);
    expect(mon(s, 0).isEscaped).toBe(true);
    expect(mon(s, 2).isEscaped).toBe(true);
  });

  test("history: Snake Strike never 2x, Big Bite never 2x, Summon never 3x", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      let s = fight(["DAGGER", "REPTOMANCER", "DAGGER"], { seed });
      const moves: string[] = [];
      for (let t = 0; t < 14; t++) {
        moves.push(mon(s, 1).move!);
        s = endTurn(s);
        if (s.outcome) break;
      }
      expect(maxRunLength(moves, "REPTOMANCER_SNAKE_STRIKE")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "REPTOMANCER_BIG_BITE")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "REPTOMANCER_SUMMON")).toBeLessThanOrEqual(2);
    }
  });
});

// ------------------------------------------------------------------------------
// Awakened One (boss)
// ------------------------------------------------------------------------------

const AO_FIGHT = ["CULTIST", "CULTIST", "AWAKENED_ONE"];

describe("Awakened One", () => {
  test("HP: 300 flat A0; [300,320] rolled A9; prebattle Str 0/2(A4), Curiosity 1/2(A19), Regenerate 10/15(A19)", () => {
    expectHpRange("AWAKENED_ONE", 0, 300, 300);
    expectHpRange("AWAKENED_ONE", 9, 300, 320);
    const s = fight(AO_FIGHT);
    expect(monPower(s, 2, "STRENGTH")?.amount).toBe(0);
    expect(monPower(s, 2, "CURIOSITY")?.amount).toBe(1);
    expect(monPower(s, 2, "REGENERATE")?.amount).toBe(10);
    const s4 = fight(AO_FIGHT, { asc: 4 });
    expect(monPower(s4, 2, "STRENGTH")?.amount).toBe(2);
    const s19 = fight(AO_FIGHT, { asc: 19 });
    expect(monPower(s19, 2, "CURIOSITY")?.amount).toBe(2);
    expect(monPower(s19, 2, "REGENERATE")?.amount).toBe(15);
  });

  test("boss-alone fallback spawns the two Cultists", () => {
    const s = fight(["AWAKENED_ONE"]);
    expect(s.combat!.monsters.length).toBe(3);
    expect(mon(s, 1).id).toBe("CULTIST");
    expect(mon(s, 2).id).toBe("CULTIST");
    expect(mon(s, 1).maxHp).toBeGreaterThanOrEqual(48);
    expect(mon(s, 1).move).not.toBeNull();
  });

  test("phase 1 opens with Slash (20; 22 at A4 via Str 2); Regenerate heals 10 at end of its turn", () => {
    let s = fight(AO_FIGHT, { seed: "AO" });
    expect(mon(s, 2).move).toBe("AWAKENED_ONE_SLASH");
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(20); // cultists only Incantate on turn 1
    let s4 = fight(AO_FIGHT, { seed: "AO", asc: 4 });
    const hp1 = s4.run.hp;
    s4 = endTurn(s4);
    expect(hp1 - s4.run.hp).toBe(22);
    // regen: damage it, end turn, +10
    let s2 = fight(AO_FIGHT, { seed: "AOREG", deck: Array(10).fill({ defId: "T_BLAST" }) });
    s2 = play(s2, "T_BLAST", 2);
    expect(mon(s2, 2).hp).toBe(50);
    s2 = endTurn(s2);
    expect(mon(s2, 2).hp).toBe(60);
  });

  test("Curiosity: playing a Power card grants +1 Strength (phase 1)", () => {
    let s = fight(AO_FIGHT, { seed: "CUR", deck: Array(10).fill({ defId: "INFLAME" }) });
    s = play(s, "INFLAME");
    expect(monPower(s, 2, "STRENGTH")?.amount).toBe(1);
  });

  test("phase flip: half-death keeps combat open, wipes Curiosity; Rebirth full-heals to phase 2", () => {
    let s = fight(AO_FIGHT, { seed: "FLIP", deck: nukeDeck });
    s = play(s, "T_NUKE", 2);
    expect(won(s)).toBe(false);
    const ao = mon(s, 2);
    expect(ao.isDead).toBe(false);
    expect(ao.halfDead).toBe(true);
    expect(ao.hp).toBe(0);
    expect(ao.block).toBe(0);
    expect(ao.move).toBe("AWAKENED_ONE_REBIRTH");
    expect(monPower(s, 2, "CURIOSITY")).toBeUndefined();
    expect(monPower(s, 2, "REGENERATE")).toBeDefined(); // buff persists
    // hitting the corpse again is harmless
    s = play(s, "T_NUKE", 2);
    expect(mon(s, 2).halfDead).toBe(true);
    expect(won(s)).toBe(false);
    s = endTurn(s); // its Rebirth turn passes -> revived
    expect(mon(s, 2).halfDead).toBe(false);
    expect(mon(s, 2).hp).toBe(300);
    expect(mon(s, 2).maxHp).toBe(300);
    expect(mon(s, 2).data.phase2).toBe(true);
    expect(monPower(s, 2, "MINION_LEADER")).toBeDefined();
    expect(mon(s, 2).move).toBe("AWAKENED_ONE_DARK_ECHO");
    // Dark Echo 40 + two Cultist Dark Strikes at 6
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(40 + 12);
    expect(["AWAKENED_ONE_SLUDGE", "AWAKENED_ONE_TACKLE"]).toContain(mon(s, 2).move!);
    // killing it in phase 2 ends the fight — the Cultists flee
    s = play(s, "T_NUKE", 2);
    expect(won(s)).toBe(true);
    expect(mon(s, 2).isDead).toBe(true);
    expect(mon(s, 0).isEscaped).toBe(true);
    expect(mon(s, 1).isEscaped).toBe(true);
  });

  test("A9: Rebirth overwrites the rolled max HP with a flat 320", () => {
    let s = fight(AO_FIGHT, { seed: "FLIP9", asc: 9, deck: nukeDeck });
    s = play(s, "T_NUKE", 2);
    s = endTurn(s);
    expect(mon(s, 2).maxHp).toBe(320);
    expect(mon(s, 2).hp).toBe(320);
  });

  test("phase 1 history: Slash never 3x, Soul Strike never 2x", () => {
    for (const seed of SEEDS.slice(0, 8)) {
      let s = fight(AO_FIGHT, { seed });
      const moves: string[] = [];
      for (let t = 0; t < 12; t++) {
        moves.push(mon(s, 2).move!);
        s = endTurn(s);
      }
      expect(moves[0]).toBe("AWAKENED_ONE_SLASH");
      expect(maxRunLength(moves, "AWAKENED_ONE_SLASH")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "AWAKENED_ONE_SOUL_STRIKE")).toBeLessThanOrEqual(1);
    }
  });

  test("phase 2 moves pool: Sludge (18 + Void into draw) / Tackle 10x3, never 3x", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      let s = fight(AO_FIGHT, { seed, deck: nukeDeck });
      s = play(s, "T_NUKE", 2);
      s = endTurn(s); // rebirth
      s = endTurn(s); // Dark Echo
      const moves: string[] = [];
      for (let t = 0; t < 8; t++) {
        moves.push(mon(s, 2).move!);
        if (mon(s, 2).move === "AWAKENED_ONE_SLUDGE" && countCards(s, "VOID") === 0) {
          s = endTurn(s);
          expect(countCards(s, "VOID")).toBe(1);
        } else {
          s = endTurn(s);
        }
      }
      for (const m of moves) expect(["AWAKENED_ONE_SLUDGE", "AWAKENED_ONE_TACKLE"]).toContain(m);
      expect(maxRunLength(moves, "AWAKENED_ONE_SLUDGE")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "AWAKENED_ONE_TACKLE")).toBeLessThanOrEqual(2);
    }
  });
});

// ------------------------------------------------------------------------------
// Time Eater (boss)
// ------------------------------------------------------------------------------

describe("Time Eater", () => {
  test("HP 456 A0, 480 A9; Reverberate 7x3 (A4 8x3), Head Slam 26 (A4 32)", () => {
    expectHpRange("TIME_EATER", 0, 456, 456);
    expectHpRange("TIME_EATER", 9, 480, 480);
    expectMoveDamage("TIME_EATER", "TIME_EATER_REVERBERATE", 7, 3);
    expectMoveDamage("TIME_EATER", "TIME_EATER_REVERBERATE", 8, 3, { asc: 4 });
    expectMoveDamage("TIME_EATER", "TIME_EATER_HEAD_SLAM", 26);
    expectMoveDamage("TIME_EATER", "TIME_EATER_HEAD_SLAM", 32, 1, { asc: 4 });
  });

  test("Head Slam: draw 1 fewer next turn (A19 also 2 Slimed); Ripple: 20 block + Weak/Vuln 1 (A19 +Frail)", () => {
    for (const asc of [0, 19]) {
      let slam = false;
      let ripple = false;
      for (const seed of SEEDS) {
        let s = fight(["TIME_EATER"], { seed, asc });
        for (let t = 0; t < 10 && (!slam || !ripple); t++) {
          const move = mon(s).move;
          if (move === "TIME_EATER_HEAD_SLAM" && !slam) {
            s = endTurn(s);
            expect(playerPower(s, "DRAW_REDUCTION")?.amount).toBe(1);
            expect(s.combat!.player.piles.hand.length).toBe(4);
            if (asc === 19) expect(countCards(s, "SLIMED")).toBe(2);
            slam = true;
          } else if (move === "TIME_EATER_RIPPLE" && !ripple) {
            const weak0 = playerPower(s, "WEAK")?.amount ?? 0;
            const vuln0 = playerPower(s, "VULNERABLE")?.amount ?? 0;
            s = endTurn(s);
            expect(mon(s).block).toBe(20);
            expect((playerPower(s, "WEAK")?.amount ?? 0) - weak0).toBe(1);
            expect((playerPower(s, "VULNERABLE")?.amount ?? 0) - vuln0).toBe(1);
            if (asc === 19) expect(playerPower(s, "FRAIL")?.amount).toBeGreaterThanOrEqual(1);
            ripple = true;
          } else {
            s = endTurn(s);
          }
        }
        if (slam && ripple) break;
      }
      expect(slam).toBe(true);
      expect(ripple).toBe(true);
    }
  });

  test("Time Warp: counts 12 player cards, then +2 Strength and the turn ends immediately", () => {
    let s = fight(["TIME_EATER"], { seed: "WARP", deck: Array(15).fill({ defId: "T_FREE" }) });
    expect(monPower(s, 0, "TIME_WARP")?.amount).toBe(0);
    for (let i = 1; i <= 11; i++) {
      s = play(s, "T_FREE");
      expect(monPower(s, 0, "TIME_WARP")?.amount).toBe(i);
      expect(s.combat!.turn).toBe(1);
    }
    s = play(s, "T_FREE"); // the 12th card
    expect(monPower(s, 0, "TIME_WARP")?.amount).toBe(0);
    expect(monPower(s, 0, "STRENGTH")?.amount).toBe(2);
    expect(s.combat!.turn).toBe(2); // turn ended by the monster, not the player
    expect(s.combat!.player.piles.hand.length).toBe(5); // fresh turn drew 5
  });

  test("Haste: exactly once, heals UP to exactly floor(maxHp/2) and clears its debuffs", () => {
    let s = fight(["TIME_EATER"], { seed: "HASTE", deck: [...Array(5).fill({ defId: "T_BLAST" }), ...Array(5).fill({ defId: "STRIKE_RED" })] });
    const half = Math.floor(mon(s).maxHp / 2); // 228
    // get a T_BLAST played (draw luck-proof: end turns until one is in hand)
    for (let t = 0; t < 6; t++) {
      if (s.combat!.player.piles.hand.some((iid) => s.combat!.cards[iid]!.defId === "T_BLAST")) break;
      s = endTurn(s);
    }
    s = play(s, "T_BLAST", 0);
    expect(mon(s).hp).toBeLessThan(half);
    s = endTurn(s); // executes current move; the next roll is Haste
    expect(mon(s).move).toBe("TIME_EATER_HASTE");
    s = endTurn(s);
    expect(mon(s).hp).toBe(half); // healed UP to exactly half
    expect(mon(s).data.usedHaste).toBe(true);
    // drop below half again: Haste never re-fires
    for (let t = 0; t < 6; t++) {
      if (s.combat!.player.piles.hand.some((iid) => s.combat!.cards[iid]!.defId === "STRIKE_RED")) break;
      s = endTurn(s);
    }
    s = play(s, "STRIKE_RED", 0);
    expect(mon(s).hp).toBeLessThan(half);
    for (let t = 0; t < 6; t++) {
      expect(mon(s).move).not.toBe("TIME_EATER_HASTE");
      s = endTurn(s);
    }
  });

  test("A19 Haste also gains 32 block; history: Reverberate <3x, Head Slam <2x, Ripple <2x", () => {
    let s = fight(["TIME_EATER"], { seed: "H19", asc: 19, deck: Array(10).fill({ defId: "T_BLAST" }) });
    const half = Math.floor(mon(s).maxHp / 2); // 240
    s = play(s, "T_BLAST", 0);
    s = endTurn(s);
    expect(mon(s).move).toBe("TIME_EATER_HASTE");
    s = endTurn(s);
    expect(mon(s).hp).toBe(half);
    expect(mon(s).block).toBe(32);
    for (const moves of moveSequences("TIME_EATER", { turns: 16 })) {
      expect(maxRunLength(moves, "TIME_EATER_REVERBERATE")).toBeLessThanOrEqual(2);
      expect(maxRunLength(moves, "TIME_EATER_HEAD_SLAM")).toBeLessThanOrEqual(1);
      expect(maxRunLength(moves, "TIME_EATER_RIPPLE")).toBeLessThanOrEqual(1);
    }
  });
});

// ------------------------------------------------------------------------------
// Donu & Deca (boss pair)
// ------------------------------------------------------------------------------

describe("Donu & Deca", () => {
  test("HP 250 each (265 A9); Artifact 2 (A19 3)", () => {
    expectHpRange("DONU", 0, 250, 250);
    expectHpRange("DECA", 0, 250, 250);
    expectHpRange("DONU", 9, 265, 265);
    expectHpRange("DECA", 9, 265, 265);
    const s = fight(["DECA", "DONU"]);
    expect(monPower(s, 0, "ARTIFACT")?.amount).toBe(2);
    expect(monPower(s, 1, "ARTIFACT")?.amount).toBe(2);
    const s19 = fight(["DECA", "DONU"], { asc: 19 });
    expect(monPower(s19, 0, "ARTIFACT")?.amount).toBe(3);
  });

  test("out-of-phase alternation: turn 1 Deca Beam + Donu Circle; turn 2 Deca Square + Donu Beam; forever", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      let s = fight(["DECA", "DONU"], { seed });
      for (let t = 1; t <= 12; t++) {
        const odd = t % 2 === 1;
        expect(mon(s, 0).move).toBe(odd ? "DECA_BEAM" : "DECA_SQUARE_OF_PROTECTION");
        expect(mon(s, 1).move).toBe(odd ? "DONU_CIRCLE_OF_POWER" : "DONU_BEAM");
        s = endTurn(s);
      }
    }
  });

  test("exact effects: Deca Beam 10x2 + 2 Dazed; Circle +3 Str BOTH; Square 16 block BOTH; Donu Beam 13x2 (with Str 3)", () => {
    let s = fight(["DECA", "DONU"], { seed: "DD" });
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(20); // Deca Beam 10x2 (Circle strength lands after)
    expect(countCards(s, "DAZED")).toBe(2);
    expect(monPower(s, 0, "STRENGTH")?.amount).toBe(3);
    expect(monPower(s, 1, "STRENGTH")?.amount).toBe(3);
    const hp1 = s.run.hp;
    s = endTurn(s);
    expect(hp1 - s.run.hp).toBe(26); // Donu Beam (10+3)x2
    expect(mon(s, 0).block).toBe(16); // Square of Protection: both
    expect(mon(s, 1).block).toBe(16);
  });

  test("A4 Beam 12x2 base; A19 Square also grants Plated Armor 3 to both", () => {
    let s = fight(["DECA", "DONU"], { seed: "DD4", asc: 4 });
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(hp0 - s.run.hp).toBe(24);
    let s19 = fight(["DECA", "DONU"], { seed: "DD19", asc: 19 });
    s19 = endTurn(s19);
    s19 = endTurn(s19); // Square turn
    expect(monPower(s19, 0, "PLATED_ARMOR")?.amount).toBe(3);
    expect(monPower(s19, 1, "PLATED_ARMOR")?.amount).toBe(3);
  });
});

// ------------------------------------------------------------------------------
// Spire Shield & Spire Spear (act 4 elite pair)
// ------------------------------------------------------------------------------

const SPIRE = ["SPIRE_SHIELD", "SPIRE_SPEAR"];

describe("Spire Shield & Spear", () => {
  test("HP: Shield 110/125 A8, Spear 160/180 A8; player Surrounded; Artifact 1 (A18 2)", () => {
    expectHpRange("SPIRE_SHIELD", 0, 110, 110);
    expectHpRange("SPIRE_SHIELD", 8, 125, 125);
    expectHpRange("SPIRE_SPEAR", 0, 160, 160);
    expectHpRange("SPIRE_SPEAR", 8, 180, 180);
    const s = fight(SPIRE);
    expect(playerPower(s, "SURROUNDED")).toBeDefined();
    expect(monPower(s, 0, "ARTIFACT")?.amount).toBe(1);
    expect(monPower(s, 1, "ARTIFACT")?.amount).toBe(1);
    expect(monPower(fight(SPIRE, { asc: 18 }), 0, "ARTIFACT")?.amount).toBe(2);
  });

  test("cadence: Shield SMASH on turns 3/6/9, Spear turn 1 BURN_STRIKE and SKEWER on 2/5/8; 50/50 fillers", () => {
    for (const seed of SEEDS.slice(0, 8)) {
      let s = fight(SPIRE, { seed });
      const shield: string[] = [];
      const spear: string[] = [];
      for (let t = 1; t <= 9; t++) {
        shield.push(mon(s, 0).move!);
        spear.push(mon(s, 1).move!);
        s = endTurn(s);
      }
      expect(spear[0]).toBe("SPIRE_SPEAR_BURN_STRIKE");
      for (const i of [1, 4, 7]) expect(spear[i]).toBe("SPIRE_SPEAR_SKEWER");
      for (const i of [2, 5, 8]) expect(shield[i]).toBe("SPIRE_SHIELD_SMASH");
      // between Smashes / Skewers: the two other moves once each
      expect([shield[0], shield[1]].sort()).toEqual(["SPIRE_SHIELD_BASH", "SPIRE_SHIELD_FORTIFY"]);
      expect([shield[3], shield[4]].sort()).toEqual(["SPIRE_SHIELD_BASH", "SPIRE_SHIELD_FORTIFY"]);
      expect([spear[2], spear[3]].sort()).toEqual(["SPIRE_SPEAR_BURN_STRIKE", "SPIRE_SPEAR_PIERCER"]);
    }
  });

  test("back attack: x1.5 only from the un-faced side; targeting flips facing", () => {
    // find a seed where the Shield opens with Bash
    let s: GameState | null = null;
    for (const seed of SEEDS) {
      const c = fight(SPIRE, { seed, deck: strikeDeck });
      if (mon(c, 0).move === "SPIRE_SHIELD_BASH") {
        s = c;
        break;
      }
    }
    expect(s).not.toBeNull();
    let st = s!;
    // initially facing the Spear (slot 1): Bash 12 -> 18; Burn Strike 5x2 unmodified
    const hp0 = st.run.hp;
    const extra0 = extraSelfDamage(st);
    st = endTurn(st);
    expect(hp0 - st.run.hp).toBe(18 + 10 + extra0);
    expect(playerPower(st, "STRENGTH")?.amount).toBe(-1); // Bash debuff (no orb slots)
    expect(countCards(st, "BURN")).toBe(2); // Burn Strike -> discard at A0
    // turn 2: Shield is forced to FORTIFY; target the Shield to face it
    expect(mon(st, 0).move).toBe("SPIRE_SHIELD_FORTIFY");
    expect(mon(st, 1).move).toBe("SPIRE_SPEAR_SKEWER");
    st = play(st, "STRIKE_RED", 0); // facing = Shield now
    const hp1 = st.run.hp;
    const extra1 = extraSelfDamage(st);
    st = endTurn(st);
    // Fortify: both gain 30 block; Skewer from behind: floor(10*1.5)=15 x3
    expect(hp1 - st.run.hp).toBe(45 + extra1);
    expect(mon(st, 0).block).toBeGreaterThanOrEqual(30);
    expect(mon(st, 1).block).toBe(30);
    // turn 3 SMASH while faced: unmultiplied 34, and Shield gains block = damage dealt
    expect(mon(st, 0).move).toBe("SPIRE_SHIELD_SMASH");
    const spearMove = mon(st, 1).move!;
    const hp2 = st.run.hp;
    const extra2 = extraSelfDamage(st);
    st = endTurn(st);
    const spearDmg = spearMove === "SPIRE_SPEAR_BURN_STRIKE" ? 14 : 0; // 5x2 from behind: 7x2
    expect(hp2 - st.run.hp).toBe(34 + spearDmg + extra2);
    expect(mon(st, 0).block).toBe(34); // Smash block = its own damage output
    if (spearMove === "SPIRE_SPEAR_PIERCER") {
      expect(monPower(st, 0, "STRENGTH")?.amount).toBe(2); // Piercer buffs both
      expect(monPower(st, 1, "STRENGTH")?.amount).toBe(2);
    }
  });

  test("A18: Burn Strike puts 2 Burns on TOP of the draw pile; Smash block is a flat 99", () => {
    let s = fight(SPIRE, { seed: "SP18", asc: 18 });
    s = endTurn(s);
    // the 2 Burns landed on TOP of the draw pile — the next turn drew them
    const burnsInHand = s.combat!.player.piles.hand.filter(
      (iid) => s.combat!.cards[iid]!.defId === "BURN",
    ).length;
    expect(countCards(s, "BURN")).toBe(2);
    expect(burnsInHand).toBe(2);
    s = endTurn(s); // turn 2 (spear Skewer)
    expect(mon(s, 0).move).toBe("SPIRE_SHIELD_SMASH");
    s = endTurn(s);
    expect(mon(s, 0).block).toBe(99);
  });
});

// ------------------------------------------------------------------------------
// Corrupt Heart (act 4 boss)
// ------------------------------------------------------------------------------

describe("Corrupt Heart", () => {
  test("HP 750 A0, 800 A9; prebattle Beat of Death 1 (A19 2) + Invincible 300 (A19 200)", () => {
    expectHpRange("CORRUPT_HEART", 0, 750, 750);
    expectHpRange("CORRUPT_HEART", 9, 800, 800);
    const s = fight(["CORRUPT_HEART"]);
    expect(monPower(s, 0, "BEAT_OF_DEATH")?.amount).toBe(1);
    expect(monPower(s, 0, "INVINCIBLE")?.amount).toBe(300);
    const s19 = fight(["CORRUPT_HEART"], { asc: 19 });
    expect(monPower(s19, 0, "BEAT_OF_DEATH")?.amount).toBe(2);
    expect(monPower(s19, 0, "INVINCIBLE")?.amount).toBe(200);
  });

  test("turn 1 Debilitate: Vuln/Weak/Frail 2 + exactly 1 EACH of Dazed/Slimed/Wound/Burn/Void into draw", () => {
    let s = fight(["CORRUPT_HEART"], { seed: "HEART" });
    expect(mon(s).move).toBe("CORRUPT_HEART_DEBILITATE");
    s = endTurn(s);
    expect(playerPower(s, "VULNERABLE")?.amount).toBe(2);
    expect(playerPower(s, "WEAK")?.amount).toBe(2);
    expect(playerPower(s, "FRAIL")?.amount).toBe(2);
    for (const status of ["DAZED", "SLIMED", "WOUND", "BURN", "VOID"]) {
      expect(countCards(s, status)).toBe(1);
    }
  });

  test("Beat of Death: 1 damage after EVERY card played (A19: 2)", () => {
    for (const [asc, dmg] of [
      [0, 1],
      [19, 2],
    ] as const) {
      let s = fight(["CORRUPT_HEART"], { asc, deck: strikeDeck });
      const hp0 = s.run.hp;
      s = play(s, "STRIKE_RED", 0);
      expect(hp0 - s.run.hp).toBe(dmg);
      s = play(s, "STRIKE_RED", 0);
      expect(hp0 - s.run.hp).toBe(2 * dmg);
    }
  });

  test("Invincible caps HP loss at exactly 300 per turn; allowance resets at its turn start", () => {
    let s = fight(["CORRUPT_HEART"], { seed: "INV", deck: nukeDeck });
    const maxHp = mon(s).maxHp;
    s = play(s, "T_NUKE", 0); // 500 -> capped at 300
    expect(mon(s).hp).toBe(maxHp - 300);
    expect(monPower(s, 0, "INVINCIBLE")?.amount).toBe(0);
    s = play(s, "T_NUKE", 0); // allowance exhausted
    expect(mon(s).hp).toBe(maxHp - 300);
    s = endTurn(s); // its turn: allowance resets
    expect(monPower(s, 0, "INVINCIBLE")?.amount).toBe(300);
    s = play(s, "T_NUKE", 0);
    expect(mon(s).hp).toBe(maxHp - 600);
  });

  test("attacks: Blood Shots 2x12 / Echo 40 under Debilitate's Vulnerable (A4: 2x15 / 45)", () => {
    for (const [asc, hits, echo] of [
      [0, 12, 60], // floor(2*1.5)=3 per hit; floor(40*1.5)=60
      [4, 15, 67], // floor(45*1.5)=67
    ] as const) {
      let s = fight(["CORRUPT_HEART"], { asc, seed: "ATK" });
      s = endTurn(s); // Debilitate (Vulnerable 2)
      const move = mon(s).move!;
      expect(["CORRUPT_HEART_BLOOD_SHOTS", "CORRUPT_HEART_ECHO"]).toContain(move);
      const hp0 = s.run.hp;
      const extra = extraSelfDamage(s); // a Debilitate Burn may be in hand
      s = endTurn(s);
      expect(hp0 - s.run.hp).toBe((move === "CORRUPT_HEART_BLOOD_SHOTS" ? 3 * hits : echo) + extra);
      // the other attack follows on turn 3
      const other =
        move === "CORRUPT_HEART_BLOOD_SHOTS" ? "CORRUPT_HEART_ECHO" : "CORRUPT_HEART_BLOOD_SHOTS";
      expect(mon(s).move).toBe(other);
    }
  });

  test("buff cycle every 3rd turn from turn 4: Artifact 2, BoD +1, Painful Stabs, +10 Str, +50 Str", () => {
    let s = fight(["CORRUPT_HEART"], { seed: "BUFF" });
    const buffTurns: Record<number, () => void> = {
      4: () => {
        expect(monPower(s, 0, "STRENGTH")?.amount).toBe(2);
        expect(monPower(s, 0, "ARTIFACT")?.amount).toBe(2);
      },
      7: () => {
        expect(monPower(s, 0, "STRENGTH")?.amount).toBe(4);
        expect(monPower(s, 0, "BEAT_OF_DEATH")?.amount).toBe(2);
      },
      10: () => {
        expect(monPower(s, 0, "STRENGTH")?.amount).toBe(6);
        expect(monPower(s, 0, "PAINFUL_STABS")?.amount).toBe(1);
      },
      13: () => expect(monPower(s, 0, "STRENGTH")?.amount).toBe(18),
      16: () => expect(monPower(s, 0, "STRENGTH")?.amount).toBe(70),
    };
    for (let turn = 1; turn <= 16; turn++) {
      if ([4, 7, 10, 13, 16].includes(turn)) {
        expect(mon(s).move).toBe("CORRUPT_HEART_BUFF");
      } else if (turn > 1) {
        expect(["CORRUPT_HEART_BLOOD_SHOTS", "CORRUPT_HEART_ECHO"]).toContain(mon(s).move!);
      }
      s = endTurn(s);
      buffTurns[turn]?.();
    }
  });

  test("Painful Stabs: every HP-losing hit adds a Wound to the discard pile", () => {
    let s = fight(["CORRUPT_HEART"], { seed: "STABS" });
    for (let t = 0; t < 10; t++) s = endTurn(s); // through turn 10's buff (Painful Stabs)
    expect(monPower(s, 0, "PAINFUL_STABS")?.amount).toBe(1);
    const move = mon(s).move!;
    const before = countCards(s, "WOUND");
    s = endTurn(s);
    const hits = move === "CORRUPT_HEART_BLOOD_SHOTS" ? 12 : 1;
    expect(countCards(s, "WOUND") - before).toBe(hits);
  });
});
