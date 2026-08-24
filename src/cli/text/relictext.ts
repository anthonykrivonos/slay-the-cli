// Relic effect text from the corpus (data/corpus/relics.json), imported at
// build time (UI-only privilege; the engine never touches the corpus). Same
// markup resolution as cardtext.ts.
//
// relicText is newline-FREE on purpose. Five relics use <br> (the three
// Bottled ones, Blue Candle, Tiny House), and callers that splice the text
// into a composed row (the shop's relic line, the relics overlay's sub) would
// emit a literal newline into a frame that must be exactly rows x cols.
// Contexts that want the break use relicLines.

import relicsCorpus from "../../../data/corpus/relics.json";
import { toAscii } from "./ascii";
import { resolveMarkup, pickUpgrade } from "./markup";
import { glossary, type Keyword } from "./keywords";

const textById = new Map<string, string>();
for (const r of relicsCorpus) {
  if (typeof r.text === "string" && r.text.length > 0) textById.set(r.id, r.text);
}

/** Display effect text as separate lines ([] if unknown id). */
export function relicLines(defId: string): string[] {
  const raw = textById.get(defId);
  if (raw === undefined) return [];
  return toAscii(resolveMarkup(raw, false))
    .split("\n")
    .filter((l) => l.length > 0);
}

/** Display effect text on one line, never with a newline in it ("" if
 *  unknown id). */
export function relicText(defId: string): string {
  return relicLines(defId).join(" ");
}

/** Keyword definitions for the words this relic's text names. */
export function relicGlossary(defId: string): Keyword[] {
  const raw = textById.get(defId);
  if (raw === undefined) return [];
  return glossary([pickUpgrade(raw, false)]);
}
