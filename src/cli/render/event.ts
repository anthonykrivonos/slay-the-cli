// Event screen: the narrative in a bordered panel, then the option buttons
// stacked underneath (disabled options dim with their reason). Ladder:
// panel + buttons -> plain numbered list.

import type { SimpleListScreen } from "../state/view";
import type { Theme } from "./theme";
import { padClip, wrapPlain } from "./widgets";
import { renderListScreen } from "./listScreen";
import { clamp } from "./layout";
import { buttonBox, buttonBoxHeight, itemButton, tintFocus } from "./cardbox";

export function renderEvent(screen: SimpleListScreen, width: number, height: number, theme: Theme): string[] {
  const items = screen.list.items;
  const k = items.length;
  const panelW = clamp(width - 8, 40, 78);
  const inner = panelW - 4;

  // narrative panel body
  const story: string[] = [];
  for (const para of screen.intro) {
    if (para.length === 0) story.push("");
    else story.push(...wrapPlain(para, inner));
  }
  const panelH = story.length + 2;

  const buttons = items.map((it) => itemButton(it, panelW - 4));
  const bH = buttonBoxHeight(buttons);
  if (k === 0 || panelH + 1 + k * bH > height) {
    return renderListScreen(screen, width, height, theme);
  }

  const pad = " ".repeat(Math.max(0, Math.floor((width - panelW) / 2)));
  const out: string[] = [];
  out.push(`${pad}+${"-".repeat(panelW - 2)}+`);
  for (const line of story) out.push(`${pad}| ${padClip(line, inner)} |`);
  out.push(`${pad}+${"-".repeat(panelW - 2)}+`);
  out.push("");
  items.forEach((it, i) => {
    const box = buttonBox(buttons[i]!, panelW, bH, theme);
    for (const r of screen.list.focusI === it.i ? tintFocus(box, theme) : box) out.push(pad + r);
  });

  return out.slice(0, height).map((l) => padClip(l, width));
}
