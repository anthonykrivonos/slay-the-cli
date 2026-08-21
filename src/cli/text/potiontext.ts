// Potion effect text from the corpus (data/corpus/potions.json), imported at
// build time (UI-only privilege; the engine never touches the corpus). Same
// markup resolution as cardtext.ts.

import potionsCorpus from "../../../data/corpus/potions.json";
import { toAscii } from "./ascii";
import { resolveMarkup } from "./markup";

const textById = new Map<string, string>();
for (const p of potionsCorpus) {
  if (typeof p.text === "string" && p.text.length > 0) textById.set(p.id, p.text);
}

/** Display effect text for a potion def ("" if unknown id). */
export function potionText(defId: string): string {
  const raw = textById.get(defId);
  if (raw === undefined) return "";
  return toAscii(resolveMarkup(raw, false));
}
