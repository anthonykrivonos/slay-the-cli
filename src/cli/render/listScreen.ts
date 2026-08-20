// Shared renderer for every numbered-list screen (Neow, event, shop, rest,
// treasure, rewards, game over): intro paragraph(s) then a paged listLines.

import type { ListView } from "../state/view";
import type { Theme } from "./theme";
import { listLines, wrapPlain, padClip, center } from "./widgets";

export function renderListScreen(
  screen: { title: string; intro: string[]; list: ListView },
  width: number,
  height: number,
  theme: Theme,
  opts: { bigTitle?: string } = {},
): string[] {
  const out: string[] = [];
  if (opts.bigTitle !== undefined) {
    out.push("");
    out.push(center(theme.bold(opts.bigTitle), width));
  }
  if (screen.intro.length > 0) {
    out.push("");
    for (const para of screen.intro) {
      if (para.length === 0) {
        out.push("");
        continue;
      }
      for (const line of wrapPlain(para, Math.min(width - 4, 76))) {
        out.push(`  ${line}`);
      }
    }
  }
  out.push("");
  const listMax = Math.max(1, height - out.length);
  out.push(...listLines(screen.list, width, theme, listMax));
  return out.slice(0, height).map((l) => padClip(l, width));
}
