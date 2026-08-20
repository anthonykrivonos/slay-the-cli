// Card rules text from the corpus (data/corpus/cards.json), imported at build
// time (UI-only privilege; the engine never touches the corpus). The wiki
// markup is resolved by text/markup.ts (shared with relic/potion/power text).

import cardsCorpus from "../../../data/corpus/cards.json";
import { resolveMarkup } from "./markup";

const textById = new Map<string, string>();
for (const c of cardsCorpus) {
  if (typeof c.text === "string" && c.text.length > 0) textById.set(c.id, c.text);
}

/** Display rules text for a card def at an upgrade level ("" if unknown id). */
export function cardRulesText(defId: string, upgrades: number): string {
  const raw = textById.get(defId);
  if (raw === undefined) return "";
  return resolveMarkup(raw, upgrades > 0);
}
