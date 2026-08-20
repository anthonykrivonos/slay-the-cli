// Card rules text from the corpus (data/corpus/cards.json), imported at build
// time (UI-only privilege; the engine never touches the corpus). Resolves the
// corpus wiki markup into plain display text:
//   <br>              line break
//   [base|upgraded]   picked by upgrade level
//   {{C|Id|Display}}  keyword/card link -> last segment
//   $Keyword          keyword highlight -> plain word
//   @GE/@RE/@BE/@PE.. energy glyphs -> [E]

import cardsCorpus from "../../data/corpus/cards.json";

const textById = new Map<string, string>();
for (const c of cardsCorpus) {
  if (typeof c.text === "string" && c.text.length > 0) textById.set(c.id, c.text);
}

function resolveMarkup(text: string, upgraded: boolean): string {
  let s = text.replace(/<br\s*\/?>/gi, "\n");
  // [base|upgraded] — no nesting of square brackets inside either side
  s = s.replace(/\[([^[\]|]*)\|([^[\]]*)\]/g, (_m, base: string, up: string) =>
    upgraded ? up : base,
  );
  // {{A|B|C}} -> last segment; {{A}} -> A
  s = s.replace(/\{\{([^{}]*)\}\}/g, (_m, inner: string) => {
    const parts = inner.split("|");
    return parts[parts.length - 1] ?? inner;
  });
  // $Keyword -> Keyword
  s = s.replace(/\$([A-Za-z-]+)/g, "$1");
  // energy glyphs
  s = s.replace(/@[A-Z]+/g, "[E]");
  // tidy whitespace inside lines (keep \n)
  s = s
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();
  return s;
}

/** Display rules text for a card def at an upgrade level ("" if unknown id). */
export function cardRulesText(defId: string, upgrades: number): string {
  const raw = textById.get(defId);
  if (raw === undefined) return "";
  return resolveMarkup(raw, upgrades > 0);
}
