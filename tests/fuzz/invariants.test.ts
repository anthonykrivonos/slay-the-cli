import { test, expect, describe } from "bun:test";
import { createCombatGame } from "../../src/engine/game";
import { makeTestBundle } from "../helpers/testBundle";
import { buildBaseContentBundle } from "../../src/content/index";
import { fuzzOne, replayMatches } from "./helpers";

// CI-sized fuzz: random agents play combats; invariants asserted every step;
// full command-log replays must be byte-identical. Long runs: bun tools/fuzz.ts

describe("fuzz: stub bundle", () => {
  const bundle = makeTestBundle();
  const deck = [
    ...Array(4).fill({ defId: "T_STRIKE" }),
    ...Array(3).fill({ defId: "T_DEFEND" }),
    { defId: "T_BASH" },
    { defId: "T_FLEX" },
    { defId: "T_EXHAUST_DRAW" },
  ];

  for (let i = 0; i < 12; i++) {
    test(`seed ${i}: invariants + replay determinism`, () => {
      const initial = createCombatGame({
        seed: `FUZZ${i}`,
        bundle,
        character: "IRONCLAD",
        deck,
        monsters: i % 2 === 0 ? ["T_DUMMY"] : ["T_DUMMY", "T_DUMMY"],
      });
      const result = fuzzOne(initial, bundle, 1000 + i);
      expect(result.steps).toBeGreaterThan(0);
      const fresh = createCombatGame({
        seed: `FUZZ${i}`,
        bundle,
        character: "IRONCLAD",
        deck,
        monsters: i % 2 === 0 ? ["T_DUMMY"] : ["T_DUMMY", "T_DUMMY"],
      });
      expect(replayMatches(fresh, result.commands, bundle, result.finalState)).toBe(true);
    });
  }
});

describe("fuzz: real bundle (Ironclad starter vs Jaw Worm)", () => {
  const bundle = buildBaseContentBundle();
  const deck = [
    ...Array(5).fill({ defId: "STRIKE_RED" }),
    ...Array(4).fill({ defId: "DEFEND_RED" }),
    { defId: "BASH" },
  ];

  for (let i = 0; i < 8; i++) {
    test(`seed R${i}`, () => {
      const initial = createCombatGame({
        seed: `RFUZZ${i}`,
        bundle,
        character: "IRONCLAD",
        deck,
        monsters: ["JAW_WORM"],
      });
      const result = fuzzOne(initial, bundle, 2000 + i);
      const fresh = createCombatGame({
        seed: `RFUZZ${i}`,
        bundle,
        character: "IRONCLAD",
        deck,
        monsters: ["JAW_WORM"],
      });
      expect(replayMatches(fresh, result.commands, bundle, result.finalState)).toBe(true);
    });
  }
});
