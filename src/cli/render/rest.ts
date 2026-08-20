// Rest site: the campfire crackles over a row of side-by-side option
// buttons (REST / SMITH / RECALL / LEAVE), keys mirrored from the list.
// Ladder: side-by-side buttons -> plain numbered list.

import type { SimpleListScreen } from "../state/view";
import type { Theme } from "./theme";
import { padClip, center } from "./widgets";
import { renderListScreen } from "./listScreen";
import { joinBlocks, rowWidth } from "./layout";
import { buttonBox, buttonBoxWidth, buttonBoxHeight, itemButton, tintFocus } from "./cardbox";
import { ART_CAMPFIRE } from "./art";

export function renderRest(screen: SimpleListScreen, width: number, height: number, theme: Theme): string[] {
  const items = screen.list.items;
  const k = items.length;
  const bW = buttonBoxWidth(width, k);
  const sideBySide = k > 0 && rowWidth(k, bW, 1) <= width;
  const buttons = items.map((it) => itemButton(it, bW - 4));
  const bH = buttonBoxHeight(buttons);
  const introRows = screen.intro.length > 0 ? screen.intro.length + 1 : 0;
  const need = bH + introRows + 1;
  if (!sideBySide || need > height) {
    return renderListScreen(screen, width, height, theme);
  }

  const out: string[] = [];
  const spare = height - need;
  // campfire first (dropped first when the budget is tight)
  if (spare >= ART_CAMPFIRE.h + 2) {
    const topPad = Math.min(2, Math.max(0, Math.floor((spare - ART_CAMPFIRE.h - 1) / 3)));
    for (let i = 0; i < topPad; i++) out.push("");
    for (const r of ART_CAMPFIRE.rows) out.push(center(theme.fg("#ff8c3a", r), width));
    out.push("");
  }
  for (const para of screen.intro) {
    out.push(center(theme.dim(para), width));
  }
  if (screen.intro.length > 0) out.push("");

  const blocks = items.map((it, i) => {
    const box = buttonBox(buttons[i]!, bW, bH, theme);
    return screen.list.focusI === it.i ? tintFocus(box, theme) : box;
  });
  const leftPad = Math.max(0, Math.floor((width - rowWidth(k, bW, 1)) / 2));
  out.push(...joinBlocks(blocks, blocks.map(() => bW), 1, leftPad));

  return out.slice(0, height).map((l) => padClip(l, width));
}
