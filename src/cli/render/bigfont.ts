// Original 5x5 block-letter font ('#' pixels) for the big titles: SLAY,
// VICTORY, DEFEAT, THE HEART FALLS. Extensible: add glyphs to GLYPHS.
// Word width = 6*len - 1 (5 columns per glyph + 1 gap, space included).

const GLYPHS: Record<string, [string, string, string, string, string]> = {
  A: [" ### ", "#   #", "#####", "#   #", "#   #"],
  C: [" ####", "#    ", "#    ", "#    ", " ####"],
  D: ["#### ", "#   #", "#   #", "#   #", "#### "],
  E: ["#####", "#    ", "#### ", "#    ", "#####"],
  F: ["#####", "#    ", "#### ", "#    ", "#    "],
  H: ["#   #", "#   #", "#####", "#   #", "#   #"],
  I: ["#####", "  #  ", "  #  ", "  #  ", "#####"],
  L: ["#    ", "#    ", "#    ", "#    ", "#####"],
  N: ["#   #", "##  #", "# # #", "#  ##", "#   #"],
  O: [" ### ", "#   #", "#   #", "#   #", " ### "],
  R: ["#### ", "#   #", "#### ", "#  # ", "#   #"],
  S: [" ####", "#    ", " ### ", "    #", "#### "],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  "],
  U: ["#   #", "#   #", "#   #", "#   #", " ### "],
  V: ["#   #", "#   #", "#   #", " # # ", "  #  "],
  W: ["#   #", "#   #", "# # #", "# # #", " # # "],
  Y: ["#   #", " # # ", "  #  ", "  #  ", "  #  "],
  " ": ["     ", "     ", "     ", "     ", "     "],
};

export const BIG_ROWS = 5;

/** Rendered width of a word in this font (6 per glyph minus the last gap). */
export function bigWordWidth(word: string): number {
  return word.length === 0 ? 0 : 6 * word.length - 1;
}

/** True when every character of the word has a glyph. */
export function canBigWord(word: string): boolean {
  return word.length > 0 && [...word.toUpperCase()].every((ch) => GLYPHS[ch] !== undefined);
}

/** The word as 5 rows of '#' pixels, or null when a glyph is missing. */
export function bigWord(word: string): string[] | null {
  const up = word.toUpperCase();
  if (!canBigWord(up)) return null;
  const rows: string[] = [];
  for (let r = 0; r < BIG_ROWS; r++) {
    rows.push([...up].map((ch) => GLYPHS[ch]![r]).join(" "));
  }
  return rows;
}
