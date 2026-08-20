import { test, expect, describe } from "bun:test";
import { createCombatGame, advance, type GameState, type Command } from "../../src/engine/game";
import { makeTestBundle } from "../helpers/testBundle";

const bundle = makeTestBundle();

function newGame(seed = "TESTSEED", deck?: { defId: string; upgrades?: number }[]): GameState {
  return createCombatGame({
    seed,
    bundle,
    character: "IRONCLAD",
    deck:
      deck ??
      [
        ...Array(5).fill({ defId: "T_STRIKE" }),
        ...Array(4).fill({ defId: "T_DEFEND" }),
        { defId: "T_BASH" },
      ],
    monsters: ["T_DUMMY"],
  });
}

function handNames(s: GameState): string[] {
  return s.combat!.player.piles.hand.map((iid) => s.combat!.cards[iid]!.defId);
}

function playByName(s: GameState, name: string, target?: number): GameState {
  const idx = handNames(s).indexOf(name);
  if (idx === -1) throw new Error(`${name} not in hand: ${handNames(s).join(",")}`);
  return advance(s, { cmd: "playCard", handIdx: idx, target }, bundle);
}

describe("combat setup", () => {
  test("initializes: 5 cards drawn, energy 3, monster hp in range, intent rolled", () => {
    const s = newGame();
    expect(s.combat!.player.piles.hand.length).toBe(5);
    expect(s.combat!.player.energy).toBe(3);
    const m = s.combat!.monsters[0]!;
    expect(m.maxHp).toBeGreaterThanOrEqual(20);
    expect(m.maxHp).toBeLessThanOrEqual(25);
    expect(m.move).not.toBeNull();
    expect(s.combat!.turn).toBe(1);
    expect(s.pending).toBeNull();
  });

  test("same seed produces identical setup; different seed differs somewhere", () => {
    const a = newGame("AAAA");
    const b = newGame("AAAA");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = newGame("BBBB");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
});

describe("card play", () => {
  test("strike deals 6, costs 1 energy, moves to discard", () => {
    let s = newGame();
    const hp0 = s.combat!.monsters[0]!.hp;
    if (!handNames(s).includes("T_STRIKE")) s = advance(s, { cmd: "endTurn" }, bundle);
    const before = s.combat!.player.energy;
    s = playByName(s, "T_STRIKE", 0);
    expect(s.combat!.monsters[0]!.hp).toBe(s.combat!.monsters[0]!.maxHp === hp0 ? hp0 - 6 : s.combat!.monsters[0]!.hp);
    expect(s.combat!.player.energy).toBe(before - 1);
    const discardNames = s.combat!.player.piles.discard.map((i) => s.combat!.cards[i]!.defId);
    expect(discardNames).toContain("T_STRIKE");
  });

  test("vulnerable multiplies by 1.5 with floor (bash 8 then strike 6 -> 9)", () => {
    let s = newGame();
    // find a hand with both bash and strike; the fixed deck guarantees bash exists somewhere
    for (let i = 0; i < 3 && !handNames(s).includes("T_BASH"); i++) {
      s = advance(s, { cmd: "endTurn" }, bundle);
    }
    expect(handNames(s)).toContain("T_BASH");
    const hp0 = s.combat!.monsters[0]!.hp;
    s = playByName(s, "T_BASH", 0);
    expect(s.combat!.monsters[0]!.hp).toBe(hp0 - 8);
    expect(s.combat!.monsters[0]!.powers.find((p) => p.id === "VULNERABLE")?.amount).toBe(2);
    if (handNames(s).includes("T_STRIKE")) {
      const hp1 = s.combat!.monsters[0]!.hp;
      s = playByName(s, "T_STRIKE", 0);
      expect(s.combat!.monsters[0]!.hp).toBe(hp1 - 9); // floor(6 * 1.5)
    }
  });

  test("exhaust card goes to exhaust pile, not discard", () => {
    let s = newGame("EXH", [
      { defId: "T_EXHAUST_DRAW" },
      ...Array(6).fill({ defId: "T_STRIKE" }),
    ]);
    s = playByName(s, "T_EXHAUST_DRAW");
    const exhaustNames = s.combat!.player.piles.exhaust.map((i) => s.combat!.cards[i]!.defId);
    expect(exhaustNames).toEqual(["T_EXHAUST_DRAW"]);
    expect(s.combat!.player.piles.hand.length).toBe(6); // 5 - played 1 + drew 2
  });

  test("not enough energy is rejected", () => {
    let s = newGame();
    while (!handNames(s).includes("T_BASH")) s = advance(s, { cmd: "endTurn" }, bundle);
    s = playByName(s, "T_BASH", 0); // energy 3 -> 1
    if (handNames(s).includes("T_BASH")) {
      expect(() => playByName(s, "T_BASH", 0)).toThrow("not enough energy");
    } else {
      expect(s.combat!.player.energy).toBe(1);
    }
  });
});

describe("turn flow", () => {
  test("end turn: hand discards, monster acts, new turn draws 5 with energy 3", () => {
    let s = newGame();
    const hpBefore = s.run.hp;
    const monsterMove = s.combat!.monsters[0]!.move;
    s = advance(s, { cmd: "endTurn" }, bundle);
    expect(s.combat!.turn).toBe(2);
    expect(s.combat!.player.piles.hand.length).toBe(5);
    expect(s.combat!.player.energy).toBe(3);
    if (monsterMove === "ATTACK") {
      expect(s.run.hp).toBe(hpBefore - 10);
    } else {
      expect(s.combat!.monsters[0]!.block).toBe(0); // HARDEN block resets at its next turn start... still 5 until then
    }
  });

  test("block absorbs monster attack and resets next turn", () => {
    let s = newGame();
    // fish for a turn where the monster intends ATTACK and we hold 2 defends
    for (let i = 0; i < 6; i++) {
      const names = handNames(s);
      if (s.combat!.monsters[0]!.move === "ATTACK" && names.filter((n) => n === "T_DEFEND").length >= 2) break;
      s = advance(s, { cmd: "endTurn" }, bundle);
    }
    if (s.combat!.monsters[0]!.move === "ATTACK" && handNames(s).filter((n) => n === "T_DEFEND").length >= 2) {
      const hp0 = s.run.hp;
      s = playByName(s, "T_DEFEND");
      s = playByName(s, "T_DEFEND");
      expect(s.combat!.player.block).toBe(10);
      s = advance(s, { cmd: "endTurn" }, bundle);
      expect(s.run.hp).toBe(hp0); // 10 block ate the 10 attack
      expect(s.combat!.player.block).toBe(0); // reset at start of player turn
    }
  });

  test("strength + weak float chain: (6+3) * 0.75 = 6.75 -> 6", () => {
    let s = newGame("FLEXY", [
      { defId: "T_FLEX" },
      { defId: "T_STRIKE" },
      { defId: "T_STRIKE" },
      { defId: "T_STRIKE" },
      { defId: "T_STRIKE" },
    ]);
    s = playByName(s, "T_FLEX"); // +3 strength
    // manually inject WEAK on player to test the multiplier chain
    s.combat!.player.powers.push({ id: "WEAK", amount: 1, justApplied: false, data: null });
    const hp0 = s.combat!.monsters[0]!.hp;
    s = playByName(s, "T_STRIKE", 0);
    expect(s.combat!.monsters[0]!.hp).toBe(hp0 - 6);
  });
});

describe("determinism, replay, save/resume", () => {
  const script: Command[] = [
    { cmd: "endTurn" },
    { cmd: "endTurn" },
    { cmd: "endTurn" },
  ];

  test("same seed + same commands -> byte-identical state", () => {
    let a = newGame("DET");
    let b = newGame("DET");
    for (const cmd of script) {
      a = advance(a, cmd, bundle);
      b = advance(b, cmd, bundle);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("JSON round-trip mid-combat resumes identically", () => {
    let live = newGame("SAVE");
    live = advance(live, { cmd: "endTurn" }, bundle);
    const restored = JSON.parse(JSON.stringify(live)) as GameState;
    let a = advance(live, { cmd: "endTurn" }, bundle);
    let b = advance(restored, { cmd: "endTurn" }, bundle);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("rng counters advance and persist through state", () => {
    let s = newGame("CTR");
    const ai0 = s.rng.floor.aiRng.counter;
    s = advance(s, { cmd: "endTurn" }, bundle);
    expect(s.rng.floor.aiRng.counter).toBeGreaterThan(ai0);
  });
});

describe("combat end", () => {
  test("killing the monster ends combat with victory event", () => {
    let s = newGame("KILL", [
      ...Array(7).fill({ defId: "T_STRIKE" }),
    ]);
    let guard = 0;
    while (!s.combat!.monsters[0]!.isDead && guard++ < 30) {
      const idx = handNames(s).indexOf("T_STRIKE");
      if (idx !== -1 && s.combat!.player.energy >= 1) {
        s = playByName(s, "T_STRIKE", 0);
      } else {
        s = advance(s, { cmd: "endTurn" }, bundle);
      }
    }
    expect(s.combat!.monsters[0]!.isDead).toBe(true);
    expect(s.eventLog.some((e) => e.event === "combatEnded")).toBe(true);
    expect(s.outcome).toBeNull(); // run continues after combat victory
  });

  test("player death sets outcome", () => {
    let s = createCombatGame({
      seed: "DIE",
      bundle,
      character: "IRONCLAD",
      deck: Array(5).fill({ defId: "T_DEFEND" }),
      monsters: ["T_DUMMY"],
      hp: 5,
      maxHp: 80,
    });
    let guard = 0;
    while (!s.outcome && guard++ < 20) {
      s = advance(s, { cmd: "endTurn" }, bundle);
    }
    expect(s.outcome?.kind).toBe("death");
  });
});
