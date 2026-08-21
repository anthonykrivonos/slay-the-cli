// Treasure room: the chest gleams over the intro line (chest text or the
// loot summary) and the option buttons. Ladder: buttons -> plain list.

import type { SimpleListScreen } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center } from "./widgets";
import { renderListScreen } from "./listScreen";
import { joinBlocks, rowWidth, clamp } from "./layout";
import { buttonBox, buttonBoxHeight, itemButton, tintFocus } from "./cardbox";
import { ART_CHEST } from "./art";

export function renderTreasure(
  screen: SimpleListScreen,
  width: number,
  height: number,
  theme: Theme,
  accent: string = C.current,
): string[] {
  const items = screen.list.items;
  const k = items.length;
  const bW = clamp(Math.floor((width - 2) / Math.max(1, k)), 18, 40);
  const sideBySide = k > 0 && rowWidth(k, bW, 2) <= width - 2;
  const buttons = items.map((it) => itemButton(it, bW - 4));
  const bH = buttonBoxHeight(buttons);
  const introRows = screen.intro.length + 1;
  const need = bH + introRows + 1;
  if (!sideBySide || need > height) {
    return renderListScreen(screen, width, height, theme, { accent });
  }

  const out: string[] = [];
  const spare = height - need;
  if (spare >= ART_CHEST.h + 2) {
    const topPad = Math.min(2, Math.max(0, Math.floor((spare - ART_CHEST.h - 1) / 3)));
    for (let i = 0; i < topPad; i++) out.push("");
    for (const r of ART_CHEST.rows) out.push(center(theme.fg(C.gold, r), width));
    out.push("");
  }
  for (const para of screen.intro) out.push(center(theme.dim(para), width));
  out.push("");

  const blocks = items.map((it, i) => {
    const box = buttonBox(buttons[i]!, bW, bH, theme);
    return screen.list.focusI === it.i ? tintFocus(box, theme, accent) : box;
  });
  const leftPad = Math.max(0, Math.floor((width - rowWidth(k, bW, 2)) / 2));
  out.push(...joinBlocks(blocks, blocks.map(() => bW), 2, leftPad));

  return out.slice(0, height).map((l) => padClip(l, width));
}
