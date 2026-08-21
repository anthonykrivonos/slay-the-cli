// Relic effect text from the corpus (data/corpus/relics.json), imported at
// build time (UI-only privilege; the engine never touches the corpus). Same
// markup resolution as cardtext.ts.

import relicsCorpus from "../../../data/corpus/relics.json";
import { toAscii } from "./ascii";
import { resolveMarkup } from "./markup";

const textById = new Map<string, string>();
for (const r of relicsCorpus) {
  if (typeof r.text === "string" && r.text.length > 0) textById.set(r.id, r.text);
}

/** Display effect text for a relic def ("" if unknown id). */
export function relicText(defId: string): string {
  const raw = textById.get(defId);
  if (raw === undefined) return "";
  return toAscii(resolveMarkup(raw, false));
}
