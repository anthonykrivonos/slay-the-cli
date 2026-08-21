import { test, expect, describe } from "bun:test";
import { createRun, advance, type Command, type GameState } from "../../src/engine/game";
import { generateMap } from "../../src/engine/run/mapGen";
import { seedFromString } from "../../src/engine/core/rng";
import { makeRunTestBundle } from "../run/runTestBundle";
import { buildBaseContentBundle } from "../../src/content/index";

// Run-level ascension effects in one gate (monster-side A2-4/7-9/17-19 live in
// the per-monster suites; A12/A13/A16 in the rewards/shop suites).

const stub = makeRunTestBundle();
const real = buildBaseContentBundle();

const adv = (b: typeof stub) => (s: GameState, cmd: Command) => advance(s, cmd, b);

function throughNeow(b: typeof stub, s: GameState): GameState {
  s = advance(s, { cmd: "neowPick", i: 0 }, b);
  let guard = 5;
  while (s.pending && guard-- > 0) s = advance(s, { cmd: "choose", indices: [0] }, b);
  return s;
}

function winCombat(b: typeof stub, s: GameState, guard = 300): GameState {
  while (s.combat && s.run.room?.kind === "combat" && guard-- > 0) {
    const c = s.combat;
    const alive = c.monsters.find((m) => !m.isDead && !m.isEscaped);
    const handIdx = c.player.piles.hand.findIndex((iid) => {
      const card = c.cards[iid]!;
      return b.cards.get(card.defId)!.type === "attack" && c.player.energy >= card.costForTurn;
    });
    if (alive && handIdx !== -1) s = advance(s, { cmd: "playCard", handIdx, target: alive.idx }, b);
    else s = advance(s, { cmd: "endTurn" }, b);
  }
  return s;
}

function atBossDoor(b: typeof stub, ascension: number, act: number): GameState {
  let s = createRun({ seed: "ASCAUDIT", bundle: b, character: "IRONCLAD", ascension });
  s = throughNeow(b, s);
  s.run.act = act;
  s.run.map!.act = act;
  const row14 = s.run.map!.rows[14]!;
  s.run.position = [row14.findIndex((n) => n !== null), 14];
  s.run.room = { kind: "map" };
  return s;
}

describe("A1: elites spawn more often (0.08 -> 0.128)", () => {
  test("elite counts rise across seeds", () => {
    let a0 = 0;
    let a1 = 0;
    for (let i = 0; i < 30; i++) {
      const seed = seedFromString(`A1CHECK${i}`);
      for (const [asc, tally] of [[0, () => a0++], [1, () => a1++]] as const) {
        const m = generateMap(seed, asc, 1, false);
        for (const row of m.nodes) for (const n of row) if (n.room === "elite" && n.edges.length > 0) tally();
      }
    }
    expect(a1).toBeGreaterThan(a0 * 1.25);
  });
});

describe("A5: post-boss heal is 75% of missing HP", () => {
  test("act transition heal", () => {
    let s = atBossDoor(stub, 5, 1);
    s.run.hp = 20;
    const maxHp = s.run.maxHp;
    s = adv(stub)(s, { cmd: "mapPick", x: 3, y: 15 });
    s = winCombat(stub, s);
    expect(s.run.room?.kind).toBe("rewards");
    s = adv(stub)(s, { cmd: "skipRewards" });
    // actTransition ran: heal = round((maxHp - hpAtBossKill) * 0.75)
    expect(s.run.act).toBe(2);
    const hpAfterBoss = s.run.hp;
    expect(hpAfterBoss).toBeGreaterThan(20);
    expect(hpAfterBoss).toBeLessThanOrEqual(maxHp);
  });

  test("below A5: full heal on act transition", () => {
    let s = atBossDoor(stub, 0, 1);
    s.run.hp = 15;
    s = adv(stub)(s, { cmd: "mapPick", x: 3, y: 15 });
    s = winCombat(stub, s);
    s = adv(stub)(s, { cmd: "skipRewards" });
    expect(s.run.act).toBe(2);
    expect(s.run.hp).toBe(s.run.maxHp);
  });
});

describe("A6 / A10 / A11 / A14 / A15: run-start modifiers", () => {
  test("A6: start with 90% HP (rounded)", () => {
    const s = createRun({ seed: "A6", bundle: real, character: "IRONCLAD", ascension: 6 });
    expect(s.run.hp).toBe(Math.round(s.run.maxHp * 0.9));
  });

  test("A10: Ascender's Bane in the starting deck", () => {
    const s = createRun({ seed: "A10", bundle: real, character: "IRONCLAD", ascension: 10 });
    expect(s.run.deck.some((c) => c.defId === "ASCENDERS_BANE")).toBe(true);
    const s9 = createRun({ seed: "A10", bundle: real, character: "IRONCLAD", ascension: 9 });
    expect(s9.run.deck.some((c) => c.defId === "ASCENDERS_BANE")).toBe(false);
  });

  test("A11: potion slots drop to 2", () => {
    expect(createRun({ seed: "A11", bundle: real, character: "IRONCLAD", ascension: 11 }).run.potionSlots).toBe(2);
    expect(createRun({ seed: "A11", bundle: real, character: "IRONCLAD", ascension: 10 }).run.potionSlots).toBe(3);
  });

  test("A14: max HP loss (Ironclad -5)", () => {
    expect(createRun({ seed: "A14", bundle: real, character: "IRONCLAD", ascension: 14 }).run.maxHp).toBe(75);
    expect(createRun({ seed: "A14", bundle: real, character: "IRONCLAD", ascension: 13 }).run.maxHp).toBe(80);
  });

  test("A15: NOTE_FOR_YOURSELF leaves the one-time pool", () => {
    const s15 = createRun({ seed: "A15", bundle: real, character: "IRONCLAD", ascension: 15 });
    expect(s15.run.pools.oneTimeEventList).not.toContain("NOTE_FOR_YOURSELF");
    const s14 = createRun({ seed: "A15", bundle: real, character: "IRONCLAD", ascension: 14 });
    expect(s14.run.pools.oneTimeEventList).toContain("NOTE_FOR_YOURSELF");
  });
});

describe("A20: double act-3 boss", () => {
  test("second, different boss follows immediately on the next floor; then normal gating", () => {
    let s = atBossDoor(stub, 20, 3);
    const bossList = [...s.run.pools.bossList];
    const floorBefore = s.run.floor;
    s = adv(stub)(s, { cmd: "mapPick", x: 3, y: 15 });
    expect(s.run.room?.kind).toBe("combat");
    const firstBoss = s.run.room?.kind === "combat" ? s.run.room.encounterId : "";
    expect(firstBoss).toBe(bossList[0]!);

    // winCombat chews through BOTH bosses (the second starts immediately,
    // with no reward screen between) - verify via post-conditions + a
    // transition trace collected during the fight loop.
    const seenEncounters: string[] = [firstBoss];
    let guard = 400;
    while (s.combat && s.run.room?.kind === "combat" && guard-- > 0) {
      const c = s.combat;
      const alive = c.monsters.find((m) => !m.isDead && !m.isEscaped);
      const handIdx = c.player.piles.hand.findIndex((iid) => {
        const card = c.cards[iid]!;
        return stub.cards.get(card.defId)!.type === "attack" && c.player.energy >= card.costForTurn;
      });
      if (alive && handIdx !== -1) s = adv(stub)(s, { cmd: "playCard", handIdx, target: alive.idx });
      else s = adv(stub)(s, { cmd: "endTurn" });
      if (s.run.room?.kind === "combat" && s.run.room.encounterId !== seenEncounters[seenEncounters.length - 1]) {
        seenEncounters.push(s.run.room.encounterId);
      }
    }
    expect(seenEncounters).toEqual([bossList[0]!, bossList[1]!]); // two DIFFERENT bosses, in shuffle order
    expect(s.run.history.a20SecondBoss).toBe(true);
    expect(s.run.floor).toBe(floorBefore + 2); // boss floor + second-boss floor
    expect(s.outcome?.kind).toBe("victory"); // no keys -> the climb ends after boss 2
  });

  test("below A20: single boss only", () => {
    let s = atBossDoor(stub, 19, 3);
    s = adv(stub)(s, { cmd: "mapPick", x: 3, y: 15 });
    s = winCombat(stub, s);
    expect(s.outcome?.kind).toBe("victory"); // straight to gameOver, no second fight
  });
});
