// ASCII sanitizer: every string that reaches a frame goes through toAscii()
// so the renderer's hard invariant (all output chars < 0x80) holds even for
// corpus text, engine error messages, and salvaged labels that use typographic
// punctuation. Pure — no Bun/node APIs.

const MAP: Record<string, string> = {
  "–": "-", // – en dash
  "—": "-", // — em dash
  "―": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "…": "...",
  "·": "-", // · midpoint
  "•": "*",
  "×": "x", // ×
  "→": "->",
  "←": "<-",
  " ": " ",
  "≠": "!=",
  "≤": "<=",
  "≥": ">=",
  "é": "e",
  "è": "e",
  "ü": "u",
  "ö": "o",
  "ä": "a",
  "⚠": "!", // ⚠
  "✓": "*", // ✓
  "▸": ">",
  "◀": "<",
  "▶": ">",
};

/** Replace typographic characters with ASCII stand-ins; any other char at or
 *  above 0x7f becomes "?". Control chars (including tabs) become spaces —
 *  except \n, which callers split on before rendering. */
export function toAscii(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code === 0x0a) {
      out += "\n";
    } else if (code < 0x20 || code === 0x7f) {
      out += " ";
    } else if (code < 0x7f) {
      out += ch;
    } else {
      out += MAP[ch] ?? "?";
    }
  }
  return out;
}
