import { test, expect } from "bun:test";
import { cardRulesText } from "../../src/ui/cardtext";

test("resolves [base|upgraded] by upgrade level", () => {
  expect(cardRulesText("STRIKE_RED", 0)).toBe("Deal 6 damage.");
  expect(cardRulesText("STRIKE_RED", 1)).toBe("Deal 9 damage.");
  expect(cardRulesText("BASH", 0)).toBe("Deal 8 damage.\nApply 2 Vulnerable.");
  expect(cardRulesText("BASH", 1)).toBe("Deal 10 damage.\nApply 3 Vulnerable.");
});

test("strips wiki markup: keywords, links, energy glyphs, <br>", () => {
  // $Block keyword
  expect(cardRulesText("DEFEND_RED", 0)).toBe("Gain 5 Block.");
  // @GE energy glyph + $Exhaust keyword + <br> breaks
  expect(cardRulesText("ADRENALINE", 0)).toBe("Gain [E].\nDraw 2 cards.\nExhaust.");
  // {{C|Shiv|Shivs}} card link -> display segment
  expect(cardRulesText("ACCURACY", 0)).toBe("Shivs deal 4 additional damage.");
});

test("handles empty-base upgrade segments spanning line breaks", () => {
  // AFTER_IMAGE text: "[|$Innate. <br>]Whenever you play a card, gain 1 $Block."
  expect(cardRulesText("AFTER_IMAGE", 0)).toBe("Whenever you play a card, gain 1 Block.");
  expect(cardRulesText("AFTER_IMAGE", 1)).toBe("Innate.\nWhenever you play a card, gain 1 Block.");
});

test("unknown ids fall back to empty string", () => {
  expect(cardRulesText("NOT_A_CARD", 0)).toBe("");
});
