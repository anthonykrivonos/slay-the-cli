// Neow's blessing: Neow himself regards you beside (>=108 cols) or above the
// stacked blessing buttons, each carrying its "!" drawback line inside.
// Ladder: art beside -> art above -> buttons only -> plain list. The art is
// tinted per character (see tintNeow) so his mouth, glowing eyes and teeth
// keep their own colors.

import type { SimpleListScreen } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center } from "./widgets";
import { renderListScreen } from "./listScreen";
import { joinBlocks, clamp } from "./layout";
import { buttonBox, buttonBoxHeight, itemButton, tintFocus } from "./cardbox";
import { pickNeow, type Art } from "./art";

// Which feature each glyph of the Neow art belongs to; everything unlisted is
// his blue-grey hide. His eyes read as dark hollows, which on a dark terminal
// means dim rather than a hue.
type NeowInk = "mouth" | "glow" | "teeth" | "eye" | "hide";
const NEOW_INK: Record<string, NeowInk> = {
  "=": "mouth", // the wide dark mouth
  "*": "glow", //  the row of small glowing eyes
  "^": "teeth", // the pale jagged tooth edge
  "@": "eye", //   the big eye
  o: "eye", //     the smaller ones
};

function inkStyle(ink: NeowInk, run: string, theme: Theme): string {
  switch (ink) {
    case "mouth": return theme.fg(C.purple, run);
    case "glow": return theme.fg(C.gold, run);
    case "teeth": return theme.fg(C.bright, run);
    case "eye": return theme.dim(run);
    case "hide": return theme.fg(C.block, run);
  }
}

/**
 * Color one row of Neow feature by feature, in runs so a row costs a handful of
 * escapes rather than one per column. Visible width is untouched.
 */
export function tintNeow(row: string, theme: Theme): string {
  const ink = (i: number): NeowInk => NEOW_INK[row[i]!] ?? "hide";
  let out = "";
  let i = 0;
  while (i < row.length) {
    const k = ink(i);
    let j = i + 1;
    while (j < row.length && ink(j) === k) j++;
    out += inkStyle(k, row.slice(i, j), theme);
    i = j;
  }
  return out;
}

export function renderNeow(
  screen: SimpleListScreen,
  width: number,
  height: number,
  theme: Theme,
  accent: string = C.current,
): string[] {
  const items = screen.list.items;
  const k = items.length;
  if (k === 0) return renderListScreen(screen, width, height, theme, { accent });

  // Beside the buttons Neow takes whatever is left once they have their 40
  // columns, plus a row each for the gap and his name; above them he takes the
  // full width and whatever rows the stack leaves. Sizing him first in the side
  // case (and last in the stacked one) keeps the two budgets non-circular.
  const sideNeow: Art | null = width >= 108 ? pickNeow(width - 45, height - 3) : null;
  const bW = sideNeow ? clamp(width - sideNeow.w - 9, 40, 76) : clamp(width - 8, 40, 76);
  const buttons = items.map((it) => itemButton(it, bW - 4));
  // uniform height per button keeps the stack rhythmic
  const bH = buttonBoxHeight(buttons);
  const stackH = k * bH;
  if (stackH + 1 > height) return renderListScreen(screen, width, height, theme, { accent });

  const stack: string[] = [];
  items.forEach((it, i) => {
    const box = buttonBox(buttons[i]!, bW, bH, theme);
    stack.push(...(screen.list.focusI === it.i ? tintFocus(box, theme, accent) : box));
  });

  const out: string[] = [];
  if (sideNeow) {
    const artBlock = [
      "",
      ...sideNeow.rows.map((r) => tintNeow(r, theme)),
      "",
      center(theme.dim("Neow"), sideNeow.w),
    ];
    out.push(...joinBlocks([artBlock, stack], [sideNeow.w, bW], 3, 2));
  } else {
    const art = pickNeow(width, height - stackH - 2);
    const spare = height - stackH - 1;
    if (spare >= art.h + 1) {
      for (const r of art.rows) out.push(center(tintNeow(r, theme), width));
      out.push("");
    }
    const leftPad = Math.max(0, Math.floor((width - bW) / 2));
    for (const line of stack) out.push(" ".repeat(leftPad) + line);
  }

  return out.slice(0, height).map((l) => padClip(l, width));
}
