// Corpus text modules: markup resolution shared by card/relic/potion/power
// text, with real corpus entries spot-checked.

import { test, expect, describe } from "bun:test";
import { resolveMarkup } from "../../src/cli/text/markup";
import { relicText } from "../../src/cli/text/relictext";
import { potionText } from "../../src/cli/text/potiontext";
import { powerText } from "../../src/cli/text/powertext";
import { cardRulesText } from "../../src/cli/text/cardtext";

describe("resolveMarkup", () => {
  test("upgrade branches, links, keywords, energy glyphs", () => {
    expect(resolveMarkup("Deal [6|9] damage.", false)).toBe("Deal 6 damage.");
    expect(resolveMarkup("Deal [6|9] damage.", true)).toBe("Deal 9 damage.");
    expect(resolveMarkup("{{QueryLink|Cards|type:Attack|Attack}}", false)).toBe("Attack");
    expect(resolveMarkup("Enter $Calm.", false)).toBe("Enter Calm.");
    expect(resolveMarkup("Gain @GE.", false)).toBe("Gain [E].");
    expect(resolveMarkup("a<br>b", false)).toBe("a\nb");
    expect(resolveMarkup("gain 2 [[Potions|Potion]] slots", false)).toBe("gain 2 Potion slots");
    expect(resolveMarkup("Gain [[Gold]].", true)).toBe("Gain Gold.");
  });
});

describe("relicText", () => {
  test("resolves a real relic and is pure ASCII", () => {
    const t = relicText("AKABEKO");
    expect(t).toContain("Attack");
    expect(t).toContain("8 additional damage");
    for (let i = 0; i < t.length; i++) expect(t.charCodeAt(i)).toBeLessThan(0x80);
  });
  test("unknown id -> empty string", () => {
    expect(relicText("NOT_A_RELIC")).toBe("");
  });
});

describe("potionText", () => {
  test("resolves a real potion", () => {
    expect(potionText("AMBROSIA")).toBe("Enter Divinity.");
    expect(potionText("NOT_A_POTION")).toBe("");
  });
});

describe("powerText", () => {
  test("resolves a real power and substitutes the amount for X", () => {
    const t = powerText("ACCURACY", 4);
    expect(t).toBe("Shivs deal 4 additional damage.");
    expect(powerText("ACCURACY")).toContain("X");
    expect(powerText("NOT_A_POWER")).toBe("");
  });
});

describe("cardRulesText still resolves through the shared module", () => {
  test("strike", () => {
    expect(cardRulesText("STRIKE_RED", 0)).toBe("Deal 6 damage.");
    expect(cardRulesText("STRIKE_RED", 1)).toBe("Deal 9 damage.");
  });
});
