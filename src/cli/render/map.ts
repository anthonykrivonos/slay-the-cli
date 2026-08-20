// Map screen — StS orientation, boss on top. Node columns sit at 5+6x with
// glyphs M E $ R T ? B ("E*" burning elite, "@" you); the edge rows between
// node rows use | / \ with X on crossings. Legal picks render as "n:G" and
// echo on a "Next:" line. The full act is ~31 lines, so a vertical viewport
// follows the frontier (j/k scrolls). A legend panel appears at >= 96 cols.

import type { MapView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip } from "./widgets";

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
const pickStyle: Style = (s, t) => t.bold(t.fg(C.pick, s));
const currentStyle: Style = (s, t) => t.bold(t.fg(C.current, s));
const burningStyle: Style = (s, t) => t.fg(C.burning, s);
const bossStyle: Style = (s, t) => t.fg(C.bad, s);

/** Every line of the full map, top (boss) first. Exported for unit tests. */
export function buildMapLines(screen: MapView, theme: Theme): { lines: string[]; nodeRowLine: (y: number) => number } {
  const rows = screen.nodeRows;
  const maxY = screen.maxY;
  const out: CharRow[] = [];

  if (screen.hasBossDoor) {
    const bossRow = new CharRow(MAP_AREA_W);
    const label = `${screen.bossPickKey !== null ? `${screen.bossPickKey}:` : ""}B ${screen.bossName}`;
    bossRow.put(screen.bossPickKey !== null ? BOSS_COL - 2 : BOSS_COL, label, screen.bossPickKey !== null ? pickStyle : bossStyle);
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
      const style: Style = node.current ? currentStyle : node.pickKey !== null ? pickStyle : node.burning ? burningStyle : node.glyph === "B" ? bossStyle : dimStyle;
      if (node.pickKey !== null) {
        nodeRow.put(col - 2, `${node.pickKey}:`, pickStyle);
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

function legendPanel(screen: MapView, theme: Theme): string[] {
  return [
    theme.bold("LEGEND"),
    theme.dim("M monster    E elite"),
    theme.dim("$ shop       R rest"),
    theme.dim("T treasure   ? unknown"),
    theme.dim("E* burning elite (+key)"),
    theme.dim("@ you        B boss"),
    "",
    `BOSS  ${theme.fg(C.bad, screen.bossName)}`,
    `KEYS  ${screen.keysOwned}`,
    `DECK  ${screen.deckCount}   RELICS ${screen.relicCount}`,
    theme.dim(`seed ${screen.seed}`),
  ];
}

export function renderMap(screen: MapView, width: number, height: number, theme: Theme): string[] {
  const { lines: full, nodeRowLine } = buildMapLines(screen, theme);
  const mapH = Math.max(1, height - 1); // last body line = "Next:" echo

  // auto-follow the frontier: center the window on the pick row (or position)
  const anchorPick = screen.picks[0];
  const anchorY = anchorPick !== undefined ? Math.min(anchorPick.y, screen.maxY) : (screen.position?.[1] ?? 0);
  const anchorLine = anchorPick !== undefined && anchorPick.y > screen.maxY ? 0 : nodeRowLine(anchorY);
  let start = anchorLine - Math.floor(mapH / 2) + screen.scroll * 2;
  start = Math.max(0, Math.min(start, full.length - mapH));
  const windowLines = full.length <= mapH ? full : full.slice(start, start + mapH);

  const panel = width >= 96 ? legendPanel(screen, theme) : [];
  const out: string[] = [];
  for (let i = 0; i < Math.min(mapH, Math.max(windowLines.length, panel.length)); i++) {
    const mapLine = windowLines[i] ?? "";
    if (panel.length > 0) {
      out.push(padClip(mapLine, 50) + (panel[i] ?? ""));
    } else {
      out.push(mapLine);
    }
  }
  while (out.length < mapH) out.push("");

  const nextParts = screen.picks.map((p) =>
    p.y > screen.maxY ? theme.bold(theme.fg(C.pick, `${p.key}:BOSS`)) : theme.bold(theme.fg(C.pick, `${p.key}:${p.glyph}`)),
  );
  const scrollNote = full.length > mapH ? theme.dim("   [j/k] scroll") : "";
  out.push(`Next: ${nextParts.join("  ")}${scrollNote}`);
  return out.slice(0, height).map((l) => padClip(l, width));
}
