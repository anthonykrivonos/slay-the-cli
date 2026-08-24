// Potion effect text from the corpus (data/corpus/potions.json), imported at
// build time (UI-only privilege; the engine never touches the corpus). Same
// markup resolution as cardtext.ts.
//
// 35 of the 42 potions write their potency as [base|doubled], and the doubled
// branch is the one that is true while the player holds Sacred Bark
// (src/content/potions/index.ts effectivePotency). So `doubled` here is the
// Sacred Bark flag, and callers in the view layer must pass it - otherwise the
// text says 12 Block while the potion grants 24. Newline-free for the same
// reason as relicText.

import potionsCorpus from "../../../data/corpus/potions.json";
import { toAscii } from "./ascii";
import { resolveMarkup, pickUpgrade } from "./markup";
import { glossary, type Keyword } from "./keywords";

const textById = new Map<string, string>();
for (const p of potionsCorpus) {
  if (typeof p.text === "string" && p.text.length > 0) textById.set(p.id, p.text);
}

/** Display effect text as separate lines ([] if unknown id). */
export function potionLines(defId: string, doubled = false): string[] {
  const raw = textById.get(defId);
  if (raw === undefined) return [];
  return toAscii(resolveMarkup(raw, doubled))
    .split("\n")
    .filter((l) => l.length > 0);
}

/** Display effect text on one line, never with a newline in it ("" if
 *  unknown id). `doubled` = the player holds Sacred Bark. */
export function potionText(defId: string, doubled = false): string {
  return potionLines(defId, doubled).join(" ");
}

/** Keyword definitions for the words this potion's text names. */
export function potionGlossary(defId: string, doubled = false): Keyword[] {
  const raw = textById.get(defId);
  if (raw === undefined) return [];
  return glossary([pickUpgrade(raw, doubled)]);
}
