// logfmt: engine events become readable ASCII sentences; unknown events keep
// the web UI's raw `event + clipped payload JSON` fallback.

import { test, expect, describe } from "bun:test";
import { buildBaseContentBundle } from "../../src/content";
import { formatEvent } from "../../src/cli/text/logfmt";

const bundle = buildBaseContentBundle();

describe("formatEvent", () => {
  test("known engine events become sentences", () => {
    expect(formatEvent({ event: "turnStarted", payload: { turn: 3 } }, bundle)).toBe("-- Turn 3 --");
    expect(formatEvent({ event: "damaged", payload: { target: { kind: "player" }, amount: 7 } }, bundle)).toBe(
      "You take 7 damage",
    );
    expect(
      formatEvent({ event: "damaged", payload: { target: { kind: "monster", idx: 1 }, amount: 12 } }, bundle),
    ).toBe("Enemy 2 takes 12 damage");
    expect(
      formatEvent({ event: "powerApplied", payload: { target: { kind: "monster", idx: 0 }, powerId: "VULNERABLE", amount: 2 } }, bundle),
    ).toBe("Vulnerable 2 on Enemy 1");
    expect(formatEvent({ event: "stanceChanged", payload: { from: "NEUTRAL", to: "WRATH" } }, bundle)).toBe(
      "Stance: Neutral -> Wrath",
    );
    expect(formatEvent({ event: "orbChanneled", payload: { orbId: "LIGHTNING" } }, bundle)).toBe(
      "Channeled Lightning",
    );
    expect(formatEvent({ event: "shuffle" }, bundle)).toBe("Discard pile shuffled into draw");
    expect(formatEvent({ event: "combatEnded", payload: "victory" }, bundle)).toBe("Combat won");
    expect(formatEvent({ event: "goldStolen", payload: { idx: 0, amount: 15 } }, bundle)).toBe(
      "Enemy 1 stole 15 gold",
    );
    expect(formatEvent({ event: "monsterSpawned", payload: { idx: 2, monsterId: "JAW_WORM" } }, bundle)).toBe(
      "Jaw Worm appears",
    );
  });

  test("unknown events fall back to event + clipped payload JSON", () => {
    expect(formatEvent({ event: "somethingNew" }, bundle)).toBe("somethingNew");
    expect(formatEvent({ event: "somethingNew", payload: { a: 1 } }, bundle)).toBe('somethingNew {"a":1}');
    const long = { text: "x".repeat(100) };
    const out = formatEvent({ event: "big", payload: long }, bundle);
    expect(out.length).toBeLessThanOrEqual(4 + 44 + 1);
    expect(out.endsWith("...")).toBe(true);
  });

  test("output is always pure ASCII", () => {
    const out = formatEvent({ event: "weird", payload: { s: "café — ‘quotes’ …" } }, bundle);
    for (let i = 0; i < out.length; i++) expect(out.charCodeAt(i)).toBeLessThan(0x80);
  });
});
