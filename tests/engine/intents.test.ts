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

  test("Bellow previews the buff it grants, not just the block", () => {
    let s = game("INTB");
    for (let i = 0; i < 14 && !s.outcome; i++) {
      const [intent] = getIntents(s, bundle);
      if (intent?.moveId === "JAW_WORM_BELLOW") {
        expect(intent.block).toBe(6);
        expect(intent.powers).toEqual([{ powerId: "STRENGTH", amount: 3, target: "self" }]);
        expect(intent.partial).toBe(false);
        return;
      }
      s = advance(s, { cmd: "endTurn" }, bundle);
    }
    throw new Error("never saw Bellow in 14 turns");
  });

  test("debuffs aimed at the player show up, with their size", () => {
    // powers are applied straight to the target rather than queued, so this is
    // the case that only the state diff catches
    const s = createCombatGame({ seed: "INTD", bundle, character: "IRONCLAD", deck: starter, monsters: ["ACID_SLIME_M"] });
    let g = s;
    for (let i = 0; i < 14 && !g.outcome; i++) {
      const [intent] = getIntents(g, bundle);
      if (intent?.moveId === "ACID_SLIME_M_LICK") {
        expect(intent.damage).toBeNull();
        expect(intent.powers).toEqual([{ powerId: "WEAK", amount: 1, target: "you" }]);
        return;
      }
      g = advance(g, { cmd: "endTurn" }, bundle);
    }
    throw new Error("never saw Lick in 14 turns");
  });

  test("status cards the move adds are previewed", () => {
    let g = createCombatGame({ seed: "INTS", bundle, character: "IRONCLAD", deck: starter, monsters: ["SENTRY"] });
    for (let i = 0; i < 8 && !g.outcome; i++) {
      const [intent] = getIntents(g, bundle);
      if (intent?.moveId === "SENTRY_BOLT") {
        expect(intent.cards).toEqual([{ defId: "DAZED", n: 2, dest: "discard" }]);
        return;
      }
      g = advance(g, { cmd: "endTurn" }, bundle);
    }
    throw new Error("never saw Bolt in 8 turns");
  });

  test("a preview that stops early keeps what it learned and says it is partial", () => {
    // Debilitate applies its three debuffs, then starts shuffling statuses in,
    // which needs the RNG the dry-run withholds
    const g = createCombatGame({ seed: "INTP", bundle, character: "IRONCLAD", deck: starter, monsters: ["CORRUPT_HEART"] });
    const [intent] = getIntents(g, bundle);
    expect(intent?.moveId).toBe("CORRUPT_HEART_DEBILITATE");
    expect(intent?.partial).toBe(true);
    const applied = (intent?.powers ?? []).filter((p) => p.target === "you").map((p) => p.powerId).sort();
    expect(applied).toEqual(["FRAIL", "VULNERABLE", "WEAK"]);
  });

  test("Artifact eating a debuff is reflected in the preview", () => {
    const g = createCombatGame({ seed: "INTA", bundle, character: "IRONCLAD", deck: starter, monsters: ["ACID_SLIME_M"] });
    let s2 = g;
    for (let i = 0; i < 14 && !s2.outcome; i++) {
      if (getIntents(s2, bundle)[0]?.moveId === "ACID_SLIME_M_LICK") {
        s2.combat!.player.powers.push({ id: "ARTIFACT", amount: 1, justApplied: false, data: null });
        const [after] = getIntents(s2, bundle);
        // the Weak never lands, so the preview does not promise it
        expect(after?.powers.some((p) => p.powerId === "WEAK")).toBe(false);
        return;
      }
      s2 = advance(s2, { cmd: "endTurn" }, bundle);
    }
    throw new Error("never saw Lick in 14 turns");
  });

  test("dry-run never mutates the real state", () => {
    const s = game("INT5");
    const before = JSON.stringify(s);
    getIntents(s, bundle);
    getIntents(s, bundle);
    expect(JSON.stringify(s)).toBe(before);
  });
});
