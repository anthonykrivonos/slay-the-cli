import { test, expect, describe } from "bun:test";
import { createCombatGame, advance, type GameState } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content/index";

// Vertical-slice checks with REAL content: Ironclad starter deck vs Jaw Worm,
// asserting exact corpus numbers.

const bundle = buildBaseContentBundle();

const starterDeck = [
  ...Array(5).fill({ defId: "STRIKE_RED" }),
  ...Array(4).fill({ defId: "DEFEND_RED" }),
  { defId: "BASH" },
];

function game(seed = "SLICE", deck = starterDeck): GameState {
  return createCombatGame({ seed, bundle, character: "IRONCLAD", deck, monsters: ["JAW_WORM"] });
}

const handNames = (s: GameState) => s.combat!.player.piles.hand.map((i) => s.combat!.cards[i]!.defId);
const play = (s: GameState, name: string, target?: number) => {
  const idx = handNames(s).indexOf(name);
  if (idx === -1) throw new Error(`${name} not in hand: ${handNames(s)}`);
  return advance(s, { cmd: "playCard", handIdx: idx, target }, bundle);
};

describe("Ironclad vs Jaw Worm (corpus-exact)", () => {
  test("Jaw Worm: HP in [40,44] at A0, first move always Chomp", () => {
    for (const seed of ["A", "B", "C", "D"]) {
      const s = game(seed);
      const m = s.combat!.monsters[0]!;
      expect(m.maxHp).toBeGreaterThanOrEqual(40);
      expect(m.maxHp).toBeLessThanOrEqual(44);
      expect(m.move).toBe("JAW_WORM_CHOMP");
    }
  });

  test("A7+: HP in [42,46]", () => {
    const s = createCombatGame({
      seed: "ASC",
      bundle,
      character: "IRONCLAD",
      ascension: 7,
      deck: starterDeck,
      monsters: ["JAW_WORM"],
    });
    const m = s.combat!.monsters[0]!;
    expect(m.maxHp).toBeGreaterThanOrEqual(42);
    expect(m.maxHp).toBeLessThanOrEqual(46);
  });

  test("Bash: 8 damage + Vulnerable 2; Strike into Vulnerable: 9", () => {
    let s = game();
    while (!(handNames(s).includes("BASH") && handNames(s).includes("STRIKE_RED"))) {
      s = advance(s, { cmd: "endTurn" }, bundle);
    }
    const m0 = s.combat!.monsters[0]!.hp;
    s = play(s, "BASH", 0);
    expect(s.combat!.monsters[0]!.hp).toBe(m0 - 8);
    expect(s.combat!.monsters[0]!.powers.find((p) => p.id === "VULNERABLE")?.amount).toBe(2);
    const m1 = s.combat!.monsters[0]!.hp;
    s = play(s, "STRIKE_RED", 0);
    expect(s.combat!.monsters[0]!.hp).toBe(m1 - 9); // floor(6 * 1.5)
  });

  test("turn 1 Chomp deals exactly 11 at A0 (through block math)", () => {
    let s = game("CHOMP1");
    const names = handNames(s);
    const defends = names.filter((n) => n === "DEFEND_RED").length;
    const hp0 = s.run.hp;
    const toBlock = Math.min(defends, 2);
    for (let i = 0; i < toBlock; i++) s = play(s, "DEFEND_RED");
    const block = s.combat!.player.block;
    expect(block).toBe(toBlock * 5);
    s = advance(s, { cmd: "endTurn" }, bundle);
    expect(s.run.hp).toBe(hp0 - Math.max(0, 11 - block));
  });

  test("Bellow gives Strength that raises Chomp by the exact amount", () => {
    // find a run where the worm eventually bellows, then verify next chomp = 11 + 3
    let s = game("BELLOW");
    let sawBellow = false;
    for (let i = 0; i < 12 && !s.outcome; i++) {
      if (s.combat!.monsters[0]!.move === "JAW_WORM_BELLOW") {
        sawBellow = true;
        s = advance(s, { cmd: "endTurn" }, bundle);
        const str = s.combat!.monsters[0]!.powers.find((p) => p.id === "STRENGTH")?.amount ?? 0;
        expect(str).toBeGreaterThanOrEqual(3);
        const nextMove: string | null = s.combat!.monsters[0]!.move;
        if (nextMove === "JAW_WORM_CHOMP") {
          const hp0 = s.run.hp;
          const block0 = s.combat!.player.block; // 0 at turn start
          s = advance(s, { cmd: "endTurn" }, bundle);
          expect(s.run.hp).toBe(hp0 - (11 + str) + block0);
        }
        break;
      }
      s = advance(s, { cmd: "endTurn" }, bundle);
    }
    expect(sawBellow).toBe(true);
  });
});

describe("exemplar card patterns", () => {
  test("Body Slam deals damage equal to current block", () => {
    let s = game("BS", [
      { defId: "DEFEND_RED" },
      { defId: "DEFEND_RED" },
      { defId: "BODY_SLAM" },
      { defId: "STRIKE_RED" },
      { defId: "STRIKE_RED" },
    ]);
    s = play(s, "DEFEND_RED");
    s = play(s, "DEFEND_RED");
    expect(s.combat!.player.block).toBe(10);
    const hp0 = s.combat!.monsters[0]!.hp;
    s = play(s, "BODY_SLAM", 0);
    expect(s.combat!.monsters[0]!.hp).toBe(hp0 - 10);
  });

  test("Anger adds a copy of itself to the discard pile", () => {
    let s = game("ANGERS", [
      { defId: "ANGER" },
      { defId: "STRIKE_RED" },
      { defId: "STRIKE_RED" },
      { defId: "STRIKE_RED" },
      { defId: "STRIKE_RED" },
    ]);
    const hp0 = s.combat!.monsters[0]!.hp;
    s = play(s, "ANGER", 0);
    expect(s.combat!.monsters[0]!.hp).toBe(hp0 - 6);
    const discardNames = s.combat!.player.piles.discard.map((i) => s.combat!.cards[i]!.defId);
    expect(discardNames.filter((n) => n === "ANGER").length).toBe(2); // played + copy
  });

  test("Whirlwind X-cost: spends all energy, hits once per energy", () => {
    let s = game("WW", [
      { defId: "WHIRLWIND" },
      { defId: "STRIKE_RED" },
      { defId: "STRIKE_RED" },
      { defId: "STRIKE_RED" },
      { defId: "STRIKE_RED" },
    ]);
    const hp0 = s.combat!.monsters[0]!.hp;
    s = play(s, "WHIRLWIND");
    expect(s.combat!.player.energy).toBe(0);
    expect(s.combat!.monsters[0]!.hp).toBe(hp0 - 3 * 5);
  });
});
