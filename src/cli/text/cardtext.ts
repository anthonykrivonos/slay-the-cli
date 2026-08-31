// Card rules text from the corpus (data/corpus/cards.json), imported at build
// time (UI-only privilege; the engine never touches the corpus). The wiki
// markup is resolved by text/markup.ts (shared with relic/potion/power text).

import cardsCorpus from "../../../data/corpus/cards.json";
import { resolveMarkup, pickUpgrade } from "./markup";
import { glossary, type Keyword } from "./keywords";

const textById = new Map<string, string>();
for (const c of cardsCorpus) {
  if (typeof c.text === "string" && c.text.length > 0) textById.set(c.id, c.text);
}

/** Display rules text for a card def at an upgrade level ("" if unknown id).
 *  TEXT-GAP: the corpus writes every card as [base|upgraded], so a card past
 *  +1 reads as its +1 text. Searing Blow is the only one (multiUpgrade): the
 *  engine deals n*(n+7)/2+12, the box still says 16. */
export function cardRulesText(defId: string, upgrades: number): string {
  const raw = textById.get(defId);
  if (raw === undefined) return "";
  return resolveMarkup(raw, upgrades > 0);
}

/** Keyword definitions for the words this card's text names at this upgrade
 *  level (a keyword can be upgrade-only, e.g. After Image gaining Innate). */
export function cardGlossary(defId: string, upgrades: number): Keyword[] {
  const raw = textById.get(defId);
  if (raw === undefined) return [];
  return glossary([pickUpgrade(raw, upgrades > 0)]);
}
