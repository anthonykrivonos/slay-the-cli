import { test, expect, describe } from "bun:test";
import { createCombatGame, advance } from "../../src/engine/game";
import { getIntents } from "../../src/engine/combat/intents";
import { buildBaseContentBundle } from "../../src/content/index";

const bundle = buildBaseContentBundle();

const starter = [
  ...Array(5).fill({ defId: "STRIKE_RED" }),
  ...Array(4).fill({ defId: "DEFEND_RED" }),
  { defId: "BASH" },
];

function game(seed: string) {
  return createCombatGame({ seed, bundle, character: "IRONCLAD", deck: starter, monsters: ["JAW_WORM"] });
}

describe("intent numbers (dry-run)", () => {
  test("turn-1 Chomp shows exactly 11x1 at A0", () => {
    const s = game("INT1");
    const [intent] = getIntents(s, bundle);
    expect(intent?.moveId).toBe("JAW_WORM_CHOMP");
    expect(intent?.damage).toBe(11);
    expect(intent?.hits).toBe(1);
    expect(intent?.block).toBe(0);
  });

  test("Thrash previews 7 damage + 5 self-block; Bellow previews block only", () => {
    let s = game("INT2");
    for (let i = 0; i < 14 && !s.outcome; i++) {
      const [intent] = getIntents(s, bundle);
      if (intent?.moveId === "JAW_WORM_THRASH") {
        const str = s.combat!.monsters[0]!.powers.find((p) => p.id === "STRENGTH")?.amount ?? 0;
        expect(intent.damage).toBe(7 + str);
        expect(intent.hits).toBe(1);
        expect(intent.block).toBe(5);
        return;
      }
      if (intent?.moveId === "JAW_WORM_BELLOW") {
        expect(intent.damage).toBeNull();
        expect(intent.block).toBe(6);
      }
      s = advance(s, { cmd: "endTurn" }, bundle);
    }
    throw new Error("never saw Thrash in 14 turns");
  });

  test("intent damage reflects monster Strength (post-Bellow Chomp = 11 + str)", () => {
    let s = game("INT3");
    for (let i = 0; i < 14 && !s.outcome; i++) {
      const str = s.combat!.monsters[0]!.powers.find((p) => p.id === "STRENGTH")?.amount ?? 0;
      const [intent] = getIntents(s, bundle);
      if (intent?.moveId === "JAW_WORM_CHOMP" && str > 0) {
        expect(intent.damage).toBe(11 + str);
        return;
      }
      s = advance(s, { cmd: "endTurn" }, bundle);
    }
    throw new Error("never saw a post-Bellow Chomp in 14 turns");
  });

  test("intent damage reflects Weak on the monster (floor(11 * 0.75) = 8)", () => {
    const s = game("INT4");
    expect(getIntents(s, bundle)[0]?.damage).toBe(11);
    // inject Weak directly (state is plain data)
    s.combat!.monsters[0]!.powers.push({ id: "WEAK", amount: 1, justApplied: false, data: null });
    expect(getIntents(s, bundle)[0]?.damage).toBe(8);
  });

  test("dry-run never mutates the real state", () => {
    const s = game("INT5");
    const before = JSON.stringify(s);
    getIntents(s, bundle);
    getIntents(s, bundle);
    expect(JSON.stringify(s)).toBe(before);
  });
});
