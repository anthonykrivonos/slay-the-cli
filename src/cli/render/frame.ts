// renderFrame: (View, cols x rows, Theme) -> string[]. PURE and total: the
// result always has exactly `rows` lines, each exactly `cols` visible columns
// (padded/hard-clipped), pure ASCII plus SGR codes. Snapshot- and
// invariant-tested in tests/cli/frame.test.ts.

import type { View } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center, rule } from "./widgets";
import { tipHeight } from "./layout";
import { renderTooltip } from "./tooltip";
import { renderMenu } from "./menu";
import { renderMap } from "./map";
import { renderCombat } from "./combat";
import { renderNeow } from "./neow";
import { renderEvent } from "./event";
import { renderShop } from "./shop";
import { renderRest } from "./rest";
import { renderRewards } from "./rewards";
import { renderTreasure } from "./treasure";
import { renderGameOver } from "./gameOver";
import { renderOverlay } from "./overlays";

export interface FrameSize {
  cols: number;
  rows: number;
}

export const MIN_COLS = 80;
export const MIN_ROWS = 24;

function tooSmall(size: FrameSize): string[] {
  const { cols, rows } = size;
  const lines: string[] = new Array<string>(rows).fill("");
  const mid = Math.floor(rows / 2);
  const msg1 = "Terminal too small";
  const msg2 = `need at least ${MIN_COLS}x${MIN_ROWS} (now ${cols}x${rows})`;
  if (mid - 1 >= 0) lines[mid - 1] = center(msg1, cols);
  if (mid + 1 < rows) lines[mid + 1] = center(msg2, cols);
  return lines.map((l) => padClip(l, cols));
}

function headerLine(view: View, cols: number, theme: Theme): string {
  const h = view.header;
  if (!h) return ""; // the menu body carries its own banner
  const keys = `${h.keys.emerald ? "E" : "-"}${h.keys.ruby ? "R" : "-"}${h.keys.sapphire ? "S" : "-"}`;
  const parts = [
    theme.fg(C.hp, `HP ${h.hp}/${h.maxHp}`),
    theme.fg(C.gold, `G ${h.gold}`),
    `F${h.floor} A${h.act}`,
    `ASC${h.ascension}`,
    `K:${keys}`,
    `POT ${h.potionCount}/${h.potionSlots}`,
    `DECK ${h.deckCount}`,
    `REL ${h.relicCount}`,
    theme.fg(h.accent, h.name),
    theme.dim(h.seed),
  ];
  return ` ${parts.join(" | ")}`;
}

function screenLabel(view: View): string {
  const s = view.screen;
  switch (s.kind) {
    case "menu":
      return "MENU";
    case "map":
      return `MAP - act ${s.act}`;
    case "combat":
      return `COMBAT - turn ${s.turn}`;
    default:
      return s.title;
  }
}

function renderBody(view: View, cols: number, bodyH: number, theme: Theme): string[] {
  if (view.overlay) return renderOverlay(view.overlay, cols, bodyH, theme);
  const s = view.screen;
  switch (s.kind) {
    case "menu":
      return renderMenu(s, cols, bodyH, theme);
    case "map":
      return renderMap(s, cols, bodyH, theme);
    case "combat":
      return renderCombat(s, view.targeting, cols, bodyH, theme);
    case "neow":
      return renderNeow(s, cols, bodyH, theme);
    case "event":
      return renderEvent(s, cols, bodyH, theme);
    case "shop":
      return renderShop(s, cols, bodyH, theme);
    case "rest":
      return renderRest(s, cols, bodyH, theme);
    case "rewards":
      return renderRewards(s, cols, bodyH, theme);
    case "treasure":
      return renderTreasure(s, cols, bodyH, theme);
    case "gameOver":
      return renderGameOver(s, cols, bodyH, theme);
  }
}

export function renderFrame(view: View, size: FrameSize, theme: Theme): string[] {
  const cols = Math.max(1, size.cols);
  const rows = Math.max(1, size.rows);
  if (cols < MIN_COLS || rows < MIN_ROWS) return tooSmall({ cols, rows });

  const lines: string[] = [];
  lines.push(headerLine(view, cols, theme));
  lines.push(theme.dim(rule(screenLabel(view), cols)));

  // the info panel is shared chrome at the bottom of the body: screens are
  // rendered into the remaining rows so their ladders absorb it automatically
  const bodyH = rows - 3;
  const tip = tipHeight(bodyH);
  const screenH = bodyH - tip;
  const body = renderBody(view, cols, screenH, theme);
  for (let i = 0; i < screenH; i++) lines.push(body[i] ?? "");
  if (tip > 0) lines.push(...renderTooltip(view.tooltip, cols, tip, theme));

  const bottom =
    view.toast !== null ? theme.inverse(padClip(` ${view.toast}`, cols)) : theme.dim(padClip(view.hint, cols));
  lines.push(bottom);

  return lines.map((l) => padClip(l, cols));
}
