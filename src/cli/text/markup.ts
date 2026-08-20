// Corpus wiki-markup resolver shared by cardtext/relictext/potiontext/
// powertext. Turns the corpus "text" markup into plain display text:
//   <br>              line break
//   [base|upgraded]   picked by upgrade level
//   {{C|Id|Display}}  keyword/card link -> last segment
//   $Keyword          keyword highlight -> plain word
//   @GE/@RE/@BE/@PE.. energy glyphs -> [E]

export function resolveMarkup(text: string, upgraded: boolean): string {
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
