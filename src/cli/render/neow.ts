// Neow's blessing: the great whale regards you beside (>=108 cols) or above
// the stacked blessing buttons, each carrying its "!" drawback line inside.
// Ladder: art beside -> art above -> buttons only -> plain list.

import type { SimpleListScreen } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center } from "./widgets";
import { renderListScreen } from "./listScreen";
import { joinBlocks, clamp } from "./layout";
import { buttonBox, buttonBoxHeight, itemButton, tintFocus } from "./cardbox";
import { ART_WHALE } from "./art";

export function renderNeow(screen: SimpleListScreen, width: number, height: number, theme: Theme): string[] {
  const items = screen.list.items;
  const k = items.length;
  if (k === 0) return renderListScreen(screen, width, height, theme);

  const sideArt = width >= 108;
  const bW = sideArt ? clamp(width - ART_WHALE.w - 9, 40, 76) : clamp(width - 8, 40, 76);
  const buttons = items.map((it) => itemButton(it, bW - 4));
  // uniform height per button keeps the stack rhythmic
  const bH = buttonBoxHeight(buttons);
  const stackH = k * bH;
  if (stackH + 1 > height) return renderListScreen(screen, width, height, theme);

  const stack: string[] = [];
  items.forEach((it, i) => {
    const box = buttonBox(buttons[i]!, bW, bH, theme);
    stack.push(...(screen.list.focusI === it.i ? tintFocus(box, theme) : box));
  });

  const out: string[] = [];
  if (sideArt) {
    const artBlock = [
      "",
      ...ART_WHALE.rows.map((r) => theme.fg(C.block, r)),
      "",
      center(theme.dim("the Whale"), ART_WHALE.w),
    ];
    out.push(...joinBlocks([artBlock, stack], [ART_WHALE.w, bW], 3, 2));
  } else {
    const spare = height - stackH - 1;
    if (spare >= ART_WHALE.h + 1) {
      for (const r of ART_WHALE.rows) out.push(center(theme.fg(C.block, r), width));
      out.push("");
    }
    const leftPad = Math.max(0, Math.floor((width - bW) / 2));
    for (const line of stack) out.push(" ".repeat(leftPad) + line);
  }

  return out.slice(0, height).map((l) => padClip(l, width));
}
