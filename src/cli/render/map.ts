// Map screen - StS orientation, boss on top, the whole block centered in the
// terminal. Node columns sit at 5+6x with
// glyphs M E $ R T ? B ("E*" burning elite, "@" you); the edge rows between
// node rows use | / \ with X on crossings. Legal picks render as "n:G" and
// echo on a "Next:" line, and the highlighted one reads "1>M" on the map
// itself. The full act is ~31 lines, so a vertical viewport follows the
// frontier and scrolls (up/down, j/k) with a scrollbar in the map area last
// column. A legend panel appears beside the map at >= 96 cols.

import type { MapView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, bar } from "./widgets";
import { MAP_NODE_ACCENTS } from "../text/runlogic";
import { visibleWidth } from "../term/ansi";

export const NODE_COL = (x: number): number => 5 + 6 * x;
const BOSS_COL = NODE_COL(3);
const MAP_AREA_W = 48;

type Style = ((s: string, theme: Theme) => string) | null;

class CharRow {
  cells: string[];
  styles: Style[];
  constructor(width: number) {
    this.cells = new Array<string>(width).fill(" ");
    this.styles = new Array<Style>(width).fill(null);
  }
  put(col: number, text: string, style: Style = null): void {
    for (let i = 0; i < text.length; i++) {
      const c = col + i;
      if (c < 0 || c >= this.cells.length) continue;
      this.cells[c] = text[i]!;
      this.styles[c] = style;
    }
  }
  /** place an edge glyph, upgrading crossing slashes to X */
  putEdge(col: number, ch: string): void {
    if (col < 0 || col >= this.cells.length) return;
    const cur = this.cells[col];
    if (cur === " " || cur === ch) {
      this.cells[col] = ch;
    } else {
      this.cells[col] = "X";
    }
    this.styles[col] = dimStyle;
  }
  render(theme: Theme): string {
    let out = "";
    let i = 0;
    while (i < this.cells.length) {
      const st = this.styles[i];
      let j = i;
      let run = "";
      while (j < this.cells.length && this.styles[j] === st) {
        run += this.cells[j];
        j++;
      }
      out += st ? st(run, theme) : run;
      i = j;
    }
    return out.replace(/\s+$/, "");
  }
}

const dimStyle: Style = (s, t) => t.dim(s);
/** "@ you" wears the character accent, so the style is built per render. */
const currentStyleFor = (accent: string): Style => (s, t) => t.bold(t.fg(accent, s));
const burningStyle: Style = (s, t) => t.fg(C.burning, s);

/** Room-kind color; bold when you can walk there from here, dim when you cannot. */
const kindStyle = (glyph: string, reachable: boolean): Style => {
  const hex = MAP_NODE_ACCENTS[glyph] ?? C.text;
  return (s, t) => (reachable ? t.bold(t.fg(hex, s)) : t.dim(t.fg(hex, s)));
};

/** Every line of the full map, top (boss) first. Exported for unit tests. */
export function buildMapLines(
  screen: MapView,
  theme: Theme,
  accent: string = C.current,
): { lines: string[]; nodeRowLine: (y: number) => number } {
  const currentStyle = currentStyleFor(accent);
  // the highlighted path, so the map itself can show which way you are going
  const focus = screen.focusPick !== null ? (screen.picks[screen.focusPick] ?? null) : null;
  const rows = screen.nodeRows;
  const maxY = screen.maxY;
  const out: CharRow[] = [];

  if (screen.hasBossDoor) {
    const bossRow = new CharRow(MAP_AREA_W);
    const bossFocused = focus !== null && focus.y > maxY;
    const label = `${screen.bossPickKey !== null ? `${screen.bossPickKey}${bossFocused ? ">" : ":"}` : ""}B ${screen.bossName}`;
    bossRow.put(
      screen.bossPickKey !== null ? BOSS_COL - 2 : BOSS_COL,
      label,
      bossFocused && screen.bossPickKey !== null ? currentStyle : kindStyle("B", screen.bossPickKey !== null),
    );
    out.push(bossRow);
    // edge row: every top-row node climbs to the boss door
    const edge = new CharRow(MAP_AREA_W);
    for (const node of rows[maxY] ?? []) {
      if (!node) continue;
      const from = NODE_COL(node.x);
      if (from === BOSS_COL) edge.putEdge(from, "|");
      else edge.putEdge(Math.round((from + BOSS_COL) / 2), BOSS_COL > from ? "/" : "\\");
    }
    out.push(edge);
  }

  for (let y = maxY; y >= 0; y--) {
    const nodeRow = new CharRow(MAP_AREA_W);
    for (const node of rows[y] ?? []) {
      if (!node) continue;
      const col = NODE_COL(node.x);
      const glyph = node.current ? "@" : node.glyph + (node.burning ? "*" : "");
      const focused = focus !== null && focus.x === node.x && focus.y === y;
      const reachable = node.pickKey !== null;
      const style: Style = focused || node.current
        ? currentStyle
        : node.burning
          ? burningStyle
          : kindStyle(node.glyph, reachable);
      if (reachable) {
        // the highlighted path points at itself: "1>M" rather than "1:M"
        nodeRow.put(col - 2, `${node.pickKey}${focused ? ">" : ":"}`, focused ? currentStyle : kindStyle(node.glyph, true));
      }
      nodeRow.put(col, glyph, style);
    }
    out.push(nodeRow);
    if (y > 0) {
      // edges from row y-1 up to row y
      const edge = new CharRow(MAP_AREA_W);
      for (const node of rows[y - 1] ?? []) {
        if (!node) continue;
        const from = NODE_COL(node.x);
        for (const ex of node.edges) {
          const to = NODE_COL(ex);
          if (to === from) edge.putEdge(from, "|");
          else edge.putEdge(Math.round((from + to) / 2), to > from ? "/" : "\\");
        }
      }
      out.push(edge);
    }
  }

  const bossLines = screen.hasBossDoor ? 2 : 0;
  return {
    lines: out.map((r) => r.render(theme)),
    nodeRowLine: (y: number) => bossLines + (maxY - y) * 2,
  };
}

/** In-act progress for the FLOOR gauge: current row / rows + boss door. */
function actProgress(screen: MapView): { at: number; of: number } {
  const of = screen.maxY + 2; // node rows + the boss door
  const at = screen.position !== null ? screen.position[1] + 1 : 0;
  return { at: Math.min(at, of), of };
}

function legendPanel(screen: MapView, theme: Theme, accent: string): string[] {
  const { at, of } = actProgress(screen);
  // the legend wears the same colors as the nodes, so the key teaches the map
  const g = (glyph: string, label: string): string =>
    `${theme.fg(MAP_NODE_ACCENTS[glyph] ?? C.text, glyph)} ${theme.dim(label)}`;
  return [
    theme.bold("LEGEND"),
    `${g("M", "enemy")}      ${g("E", "elite")}`,
    `${g("$", "merchant")}   ${g("R", "rest")}`,
    `${g("T", "treasure")}   ${g("?", "unknown")}`,
    `${theme.fg(C.burning, "E*")} ${theme.dim("burning elite (+key)")}`,
    `${theme.fg(accent, "@")} ${theme.dim("you")}        ${g("B", "boss")}`,
    "",
    `BOSS  ${theme.fg(C.bad, screen.bossName)}`,
    `FLOOR ${screen.floor}  ${theme.fg(accent, bar(at, of, 8))} ${theme.dim(`${at}/${of}`)}`,
    `KEYS  ${screen.keysOwned}`,
    `DECK  ${screen.deckCount}   RELICS ${screen.relicCount}`,
    theme.dim(`seed ${screen.seed}`),
  ];
}

/** `====[ BOSS: NAME ]====` across the map area - always visible. */
function bossBanner(screen: MapView, theme: Theme): string {
  const label = `[ BOSS: ${screen.bossName.toUpperCase()} ]`;
  const total = Math.max(0, MAP_AREA_W - label.length);
  const left = Math.floor(total / 2);
  return `${"=".repeat(left)}${theme.bold(theme.fg(C.bad, label))}${"=".repeat(total - left)}`;
}

export function renderMap(
  screen: MapView,
  width: number,
  height: number,
  theme: Theme,
  accent: string = C.current,
): string[] {
  const { lines: full, nodeRowLine } = buildMapLines(screen, theme, accent);
  const mapH = Math.max(1, height - 2); // row 0 = boss banner, last = "Next:" echo

  // auto-follow the frontier: center the window on the pick row (or position)
  const anchorPick = screen.picks[0];
  const anchorY = anchorPick !== undefined ? Math.min(anchorPick.y, screen.maxY) : (screen.position?.[1] ?? 0);
  const anchorLine = anchorPick !== undefined && anchorPick.y > screen.maxY ? 0 : nodeRowLine(anchorY);
  let start = anchorLine - Math.floor(mapH / 2) + screen.scroll * 2;
  start = Math.max(0, Math.min(start, full.length - mapH));
  const windowLines = full.length <= mapH ? full : full.slice(start, start + mapH);

  // A clipped map gets a scrollbar in the map area's last column, so it is
  // obvious there is more of the act above or below.
  const clipped = full.length > mapH;
  const thumbH = clipped ? Math.max(1, Math.round((mapH * mapH) / full.length)) : 0;
  const thumbTop = clipped ? Math.round((start / (full.length - mapH)) * (mapH - thumbH)) : 0;
  const scrollCell = (i: number): string =>
    !clipped ? "" : theme.dim(i >= thumbTop && i < thumbTop + thumbH ? "#" : ":");

  // The whole thing is centered as one block: map area, then the legend beside
  // it when the terminal is wide enough to hold both.
  const panel = width >= 96 ? legendPanel(screen, theme, accent) : [];
  const panelW = panel.reduce((m, l) => Math.max(m, visibleWidth(l)), 0);
  const blockW = MAP_AREA_W + (panelW > 0 ? 2 + panelW : 0);
  const pad = " ".repeat(Math.max(0, Math.floor((width - blockW) / 2)));

  const out: string[] = [pad + bossBanner(screen, theme)];
  for (let i = 0; i < Math.min(mapH, Math.max(windowLines.length, panel.length)); i++) {
    const mapCol = padClip(windowLines[i] ?? "", MAP_AREA_W - 1) + scrollCell(i);
    out.push(pad + (panel.length > 0 ? `${padClip(mapCol, MAP_AREA_W)}  ${panel[i] ?? ""}` : mapCol));
  }
  while (out.length < mapH + 1) out.push("");

  const nextParts = screen.picks.map((p, k) => {
    const cursor = screen.focusPick === k ? ">" : "";
    const label = p.y > screen.maxY ? `${cursor}${p.key}:BOSS` : `${cursor}${p.key}:${p.glyph}`;
    if (screen.focusPick === k) return theme.bold(theme.fg(accent, label));
    return theme.bold(theme.fg(MAP_NODE_ACCENTS[p.y > screen.maxY ? "B" : p.glyph] ?? C.pick, label));
  });
  const scrollNote = clipped ? theme.dim("   [up/down] scroll") : "";
  out.push(`${pad}Next: ${nextParts.join("  ")}${scrollNote}`);
  return out.slice(0, height).map((l) => padClip(l, width));
}
