// logfmt: engine events become readable ASCII sentences; unknown events keep
// the web UI's raw `event + clipped payload JSON` fallback.

import { test, expect, describe } from "bun:test";
import { buildBaseContentBundle } from "../../src/content";
import { formatEvent } from "../../src/cli/text/logfmt";
import { initialUiState, pushLog, pushLogLines, currentEraStart, LOG_LIMIT } from "../../src/cli/state/uiState";

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

  test("card plays name the card, and an autoplay names what forced it", () => {
    expect(
      formatEvent({ event: "cardPlayed", payload: { defId: "STRIKE_RED", upgrades: 0, target: 0, autoplayed: false } }, bundle),
    ).toBe("You play Strike at Enemy 1");
    expect(
      formatEvent({ event: "cardPlayed", payload: { defId: "INFLAME", upgrades: 1, target: null, autoplayed: false } }, bundle),
    ).toBe("You play Inflame+");
    expect(
      formatEvent({ event: "cardPlayed", payload: { defId: "IMMOLATE", upgrades: 0, target: 1, autoplayed: true, via: "HAVOC" } }, bundle),
    ).toBe("Havoc plays Immolate");
    // an autoplay rolls a target even for an untargeted card: do not print it
    expect(
      formatEvent({ event: "cardPlayed", payload: { defId: "INFLAME", upgrades: 0, target: 2, autoplayed: true, via: "MAYHEM" } }, bundle),
    ).toBe("Mayhem plays Inflame");
  });

  test("a combat opens with a banner, and silent deck additions are named", () => {
    expect(
      formatEvent({ event: "combatStarted", payload: { encounterId: "TWO_LOUSE", monsters: ["RED_LOUSE", "GREEN_LOUSE"] } }, bundle),
    ).toBe("== Red Louse, Green Louse ==");
    expect(formatEvent({ event: "deckCardObtained", payload: { defId: "BLUDGEON", upgrades: 0 } }, bundle)).toBe(
      "Bludgeon joins your deck",
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

describe("log eras", () => {
  const ev = (event: string, payload?: unknown) => ({ event, payload });

  test("combatStarted opens a new era; the current one is what the fight shows", () => {
    let ui = initialUiState({ seed: "LOG" });
    ui = pushLog(ui, [ev("deckCardObtained", { defId: "BLUDGEON", upgrades: 0 })], bundle);
    expect(ui.logEra).toBe(0);
    expect(currentEraStart(ui)).toBe(0);

    ui = pushLog(ui, [ev("combatStarted", { encounterId: "E", monsters: ["JAW_WORM"] }), ev("turnStarted", { turn: 1 })], bundle);
    expect(ui.logEra).toBe(1);
    expect(currentEraStart(ui)).toBe(1); // the banner opens the current era
    expect(ui.log.filter((l) => l.era === ui.logEra).map((l) => l.text)).toEqual(["== Jaw Worm ==", "-- Turn 1 --"]);

    ui = pushLog(ui, [ev("combatEnded", "victory")], bundle);
    ui = pushLog(ui, [ev("combatStarted", { encounterId: "E2", monsters: ["CULTIST"] })], bundle);
    expect(ui.logEra).toBe(2);
    expect(ui.log.filter((l) => l.era === 2).map((l) => l.text)).toEqual(["== Cultist =="]);
  });

  test("synthetic lines join the current era, and the ring is capped", () => {
    let ui = initialUiState({ seed: "LOG" });
    ui = pushLog(ui, [ev("combatStarted", { encounterId: "E", monsters: ["JAW_WORM"] })], bundle);
    ui = pushLogLines(ui, ["(restored saved run)"]);
    expect(ui.log[ui.log.length - 1]).toEqual({ text: "(restored saved run)", era: 1 });
    ui = pushLogLines(ui, Array(LOG_LIMIT + 50).fill("x"));
    expect(ui.log.length).toBe(LOG_LIMIT);
  });
});
