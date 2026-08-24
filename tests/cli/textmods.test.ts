// Corpus text modules: markup resolution shared by card/relic/potion/power
// text, with real corpus entries spot-checked.

import { test, expect, describe } from "bun:test";
import { resolveMarkup } from "../../src/cli/text/markup";
import { relicText, relicLines, relicGlossary } from "../../src/cli/text/relictext";
import { potionText, potionLines } from "../../src/cli/text/potiontext";
import { powerText } from "../../src/cli/text/powertext";
import { cardRulesText, cardGlossary } from "../../src/cli/text/cardtext";
import { glossary, keywordsIn } from "../../src/cli/text/keywords";

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
    expect(relicLines("NOT_A_RELIC")).toEqual([]);
  });
  // A <br> relic spliced into a composed row (the shop's relic line, the
  // relics overlay sub) used to put a literal newline into a frame that has
  // to be exactly rows x cols.
  test("a <br> relic is one line for rows, two lines for boxes", () => {
    expect(relicText("BOTTLED_FLAME")).not.toContain("\n");
    expect(relicLines("BOTTLED_FLAME")).toEqual([
      "Upon pickup, choose an Attack card.",
      "At the start of each combat, this card will be in your hand.",
    ]);
    expect(relicText("BOTTLED_FLAME")).toBe(relicLines("BOTTLED_FLAME").join(" "));
    for (const id of ["BOTTLED_FLAME", "BOTTLED_LIGHTNING", "BOTTLED_TORNADO", "BLUE_CANDLE", "TINY_HOUSE"]) {
      expect(relicText(id)).not.toContain("\n");
    }
  });
});

describe("potionText", () => {
  test("resolves a real potion", () => {
    expect(potionText("AMBROSIA")).toBe("Enter Divinity.");
    expect(potionText("NOT_A_POTION")).toBe("");
  });
  // 35 of the 42 potions write potency as [base|doubled], and the doubled
  // branch is what is true while Sacred Bark is held.
  test("Sacred Bark picks the doubled branch", () => {
    expect(potionText("BLOCK_POTION")).toBe("Gain 12 Block.");
    expect(potionText("BLOCK_POTION", true)).toBe("Gain 24 Block.");
    expect(potionLines("FIRE_POTION", true).join(" ")).toContain("40");
  });
});

describe("keyword glossary", () => {
  test("reads $tokens off the raw markup, not the resolved prose", () => {
    expect(keywordsIn("Deal [8|10] damage.<br>Apply [2|3] $Vulnerable. $Exhaust.")).toEqual([
      "Vulnerable",
      "Exhaust",
    ]);
    // two-word keywords, inflections, and the words too basic to explain
    expect(keywordsIn("Gain [6|8] $Plated Armor.")).toEqual(["Plated Armor"]);
    expect(keywordsIn("Apply [2|3] $Lock On.")).toEqual(["Lock On"]);
    expect(keywordsIn("You can no longer become $Weakened.")).toEqual(["Weak"]);
    expect(keywordsIn("Gain [12|24] $Block. Gain @GE.")).toEqual([]);
  });
  test("numbers come from the corpus, never from here", () => {
    // powers.json, with the count the card itself wrote filled into its X
    expect(glossary(["Apply 2 $Vulnerable."])).toEqual([
      { name: "Vulnerable", text: "Receive 50% more damage from Attacks for 2 turns." },
    ]);
    // and left generic when the text names no count
    expect(glossary(["If the enemy has $Vulnerable, deal 3 damage."])).toEqual([
      { name: "Vulnerable", text: "Receive 50% more damage from Attacks for X turns." },
    ]);
    // a definition is always one line, whatever the corpus put in it
    expect(glossary(["Gain 5 $Regeneration."])[0]!.text).not.toContain("\n");
    // orbs.json
    expect(glossary(["$Channel 1 $Lightning."])[1]!.text).toContain("Deal 3 damage to a random enemy.");
    // stances.json
    expect(glossary(["Enter $Wrath."])).toEqual([
      { name: "Wrath", text: "A stance. Deal double damage. Receive double damage." },
    ]);
  });
  test("the upgrade branch decides which keywords a card names", () => {
    // After Image only gains Innate when upgraded
    expect(cardGlossary("AFTER_IMAGE", 0).map((k) => k.name)).toEqual([]);
    expect(cardGlossary("AFTER_IMAGE", 1).map((k) => k.name)).toEqual(["Innate"]);
    expect(relicGlossary("BLUE_CANDLE").map((k) => k.name)).toEqual(["Unplayable", "Exhaust"]);
  });
  test("every defined keyword is pure ASCII and says something", () => {
    for (const k of glossary(["$Exhaust $Ethereal $Innate $Retain $Scry $Evoke"])) {
      expect(k.text.length).toBeGreaterThan(0);
      for (let i = 0; i < k.text.length; i++) expect(k.text.charCodeAt(i)).toBeLessThan(0x80);
    }
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
