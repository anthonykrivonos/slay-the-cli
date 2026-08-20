// Power (buff/debuff) description text from the corpus
// (data/corpus/powers.json), imported at build time (UI-only privilege; the
// engine never touches the corpus). Same markup resolution as cardtext.ts.
// The corpus uses a bare "X" for the stack amount; substitute when asked.

import powersCorpus from "../../../data/corpus/powers.json";
import { toAscii } from "./ascii";
import { resolveMarkup } from "./markup";

const textById = new Map<string, string>();
for (const p of powersCorpus) {
  if (typeof p.text === "string" && p.text.length > 0 && !textById.has(p.id)) {
    textById.set(p.id, p.text);
  }
}

/** Display description for a power def ("" if unknown id). When `amount` is
 *  given, the corpus's standalone X placeholder becomes that number. */
export function powerText(defId: string, amount?: number): string {
  const raw = textById.get(defId);
  if (raw === undefined) return "";
  let s = toAscii(resolveMarkup(raw, false));
  if (amount !== undefined) s = s.replace(/\bX\b/g, String(amount));
  return s;
}
