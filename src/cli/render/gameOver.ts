// Game-over screen: VICTORY / DEFEAT / THE HEART FALLS in 5x5 block letters,
// the subtitle, a bordered stats box, and the numbered actions. Falls back to
// a one-line banner when the letters don't fit.

import type { GameOverView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center, listLines } from "./widgets";
import { bigWord, bigWordWidth, BIG_ROWS } from "./bigfont";

export function renderGameOver(screen: GameOverView, width: number, height: number, theme: Theme): string[] {
  const color = screen.victory ? C.gold : C.bad;
  const letters = bigWord(screen.title);
  const useBig = letters !== null && bigWordWidth(screen.title) <= width - 4;

  // vertical shape: pad / title / blank / subtitle / blank / stats box / blank / list
  const titleRows = useBig ? BIG_ROWS : 1;
  const statsH = screen.stats.length + 2;
  const listH = screen.list.items.length;
  const need = titleRows + 1 + 1 + 1 + statsH + 1 + listH;
  const padTop = Math.max(0, Math.min(2, Math.floor((height - need) / 3)));

  const out: string[] = [];
  for (let i = 0; i < padTop; i++) out.push("");
  if (useBig && height - padTop >= need) {
    for (const r of letters!) out.push(center(theme.bold(theme.fg(color, r)), width));
  } else {
    out.push(center(theme.bold(theme.fg(color, `===  ${screen.title}  ===`)), width));
  }
  out.push("");
  out.push(center(theme.dim(screen.subtitle), width));
  out.push("");

  // stats box, centered
  const statsW = Math.min(width - 4, Math.max(24, screen.stats.reduce((m, s) => Math.max(m, s.length), 0) + 4));
  const pad = " ".repeat(Math.max(0, Math.floor((width - statsW) / 2)));
  out.push(`${pad}+${"-".repeat(statsW - 2)}+`);
  for (const s of screen.stats) out.push(`${pad}| ${padClip(s, statsW - 4)} |`);
  out.push(`${pad}+${"-".repeat(statsW - 2)}+`);
  out.push("");

  // actions, aligned under the stats box
  const remaining = Math.max(1, height - out.length);
  const list = listLines(screen.list, Math.max(20, width - pad.length), theme, remaining);
  for (const l of list) out.push(pad + l);

  return out.slice(0, height).map((l) => padClip(l, width));
}
