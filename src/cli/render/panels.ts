// Combat actor panels - one bordered box per enemy (intent overhead, HP bar,
// power chips) and the player's status panel (energy orb in the border,
// stance badge, orbs/mantra, power chips). Pure: plain data in, exact-width
// rows out. The combat renderer maps View shapes onto these.

import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, bar } from "./widgets";
import { clamp } from "./layout";

// --- enemy panels ---------------------------------------------------------------

export interface PowerChipData {
  name: string;
  amount: number;
  kind: "buff" | "debuff";
}

export interface EnemyPanelData {
  key: string | null;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  /** e.g. "/! 11 x2", "/! 9 [+5]", "[+5]", "v Weak 2", "zz", "??" */
  intentGlyph: string;
  intentKind: "attack" | "block" | "buff" | "debuff" | "other";
  /** total damage across the hits, when there are several */
  intentTotal: number | null;
  /** what the move does beyond its glyph: the buff, the debuff, the statuses */
  intentParts: { text: string; kind: "attack" | "block" | "buff" | "debuff" | "cards" | "other" }[];
  /** dim move name shown next to the glyph when it fits */
  move: string | null;
  powers: PowerChipData[];
  gone: "dead" | "escaped" | null;
  /** the creature's ASCII portrait, already padded to the row's height */
  art: string[];
  /** the creature's own color, for its portrait */
  tint: string;
}

/** Rows of chrome around the portrait: borders, intent, name, HP, powers. */
export const ENEMY_PANEL_H = 6;

/** Panel width for m enemies across `cols`. <18 = panels don't fit. */
export function enemyPanelWidth(cols: number, m: number, withArt = false): number {
  // portraits earn the panel more room: creatures need columns to read as
  // themselves, and a lone enemy should loom
  return clamp(Math.floor((cols - 2) / Math.max(1, m)) - 1, 18, withArt ? 46 : 30);
}

/** Total panel height once a portrait of artH rows sits inside it. */
export function enemyPanelHeight(artH: number): number {
  return ENEMY_PANEL_H + artH;
}

/** What each kind of intent is worth worrying about, in color. */
export const INTENT_COLORS: Record<"attack" | "block" | "buff" | "debuff" | "other", string> = {
  attack: C.intent,
  block: C.block,
  buff: C.good,
  debuff: C.bad,
  other: C.gold,
};

function chipText(p: PowerChipData): string {
  return `${p.kind === "buff" ? "^" : "v"} ${p.name} ${p.amount}`;
}

/** Power chips row: as many whole chips as fit (at most `maxChips`),
 *  then a dim "+k" overflow counter. */
export function powersRow(powers: PowerChipData[], iw: number, theme: Theme, maxChips = 2): string {
  if (powers.length === 0) return "";
  const parts: string[] = [];
  let used = 0;
  let shown = 0;
  for (const p of powers) {
    if (shown >= maxChips) break;
    const txt = chipText(p);
    const need = (shown > 0 ? 2 : 0) + txt.length;
    const overflowNeed = powers.length > shown + 1 ? 4 : 0; // room for "  +k"
    if (used + need + overflowNeed > iw) break;
    parts.push(theme.fg(p.kind === "buff" ? C.good : C.bad, txt));
    used += need;
    shown += 1;
  }
  const rest = powers.length - shown;
  if (rest > 0) parts.push(theme.dim(`+${rest}`));
  return parts.join("  ");
}

function hpRow(hp: number, maxHp: number, block: number, iw: number, prefix: string, theme: Theme, wantInner: number): string {
  const txt = `${prefix}${hp}/${maxHp}`;
  const blk = block > 0 ? ` B${block}` : "";
  const barInner = clamp(Math.min(wantInner, iw - txt.length - 3 - blk.length), 4, 24);
  return `${txt} ${theme.fg(C.hp, bar(hp, maxHp, barInner))}${block > 0 ? theme.fg(C.block, blk) : ""}`;
}

/** Render one enemy panel: exactly enemyPanelHeight(art) rows of w columns. */
export function enemyPanel(e: EnemyPanelData, w: number, theme: Theme): string[] {
  const iw = w - 4;
  const border = `+${"-".repeat(w - 2)}+`;
  const line = (s: string): string => `| ${padClip(s, iw)} |`;
  const centered = (s: string): string => {
    const pad = Math.max(0, Math.floor((iw - s.length) / 2));
    return " ".repeat(pad) + s;
  };
  // the portrait in the creature's own color; a corpse keeps the shape but
  // loses the color, like the game greying out a dead monster
  const artRows = e.art.map((r) => line(e.gone !== null ? theme.dim(centered(r)) : theme.fg(e.tint, centered(r))));

  if (e.gone !== null) {
    const rows = [border, line(""), ...artRows, line(e.name), line(`x ${e.gone} x`), line(""), border];
    return rows.map((r) => theme.dim(padClip(r, w)));
  }

  // Intent row, filled in the order that matters: the glyph and its numbers,
  // the total for a multi-hit, then what else the move does, then the move's
  // name if there is still room. The target key is always right-aligned.
  const key = e.key !== null ? `[${e.key}]` : "";
  const glyph = theme.bold(theme.fg(INTENT_COLORS[e.intentKind], e.intentGlyph));
  const partColor = (kind: EnemyPanelData["intentParts"][number]["kind"]): string =>
    kind === "debuff" || kind === "cards" ? C.bad : kind === "buff" ? C.good : kind === "block" ? C.block : C.gold;

  let leftLen = e.intentGlyph.length;
  let extras = "";
  const room = (n: number): boolean => leftLen + n + key.length + 1 <= iw;
  if (e.intentTotal !== null && room(3 + String(e.intentTotal).length)) {
    const txt = ` = ${e.intentTotal}`;
    extras += theme.bold(theme.fg(C.intent, txt));
    leftLen += txt.length;
  }
  for (const p of e.intentParts) {
    if (!room(2 + p.text.length)) break;
    extras += `  ${theme.fg(partColor(p.kind), p.text)}`;
    leftLen += 2 + p.text.length;
  }
  if (e.move !== null && room(2 + e.move.length)) {
    extras += `  ${theme.dim(e.move)}`;
    leftLen += 2 + e.move.length;
  }
  const gap = Math.max(1, iw - leftLen - key.length);
  const intentRow = `${glyph}${extras}${" ".repeat(gap)}${theme.bold(key)}`;

  const rows = [
    border,
    line(intentRow),
    ...artRows,
    line(theme.bold(padClip(e.name, iw))),
    line(hpRow(e.hp, e.maxHp, e.block, iw, "", theme, clamp(w - 20, 6, 14))),
    line(powersRow(e.powers, iw, theme)),
    border,
  ];
  return rows.map((r) => padClip(r, w));
}

// --- player panel ---------------------------------------------------------------

export interface OrbChipData {
  /** "(L:3)" / "(F:2)" / "( - )" */
  text: string;
  empty: boolean;
  color: string | null;
}

export interface PlayerPanelData {
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  energyMax: number;
  stance: string | null;
  stanceColor: string | null;
  /** "6/10" */
  mantra: string | null;
  orbs: OrbChipData[] | null;
  powers: PowerChipData[];
  /** the hero's ASCII portrait, drawn to the left of the stats (empty = none) */
  art: string[];
  /** the hero's accent, for the portrait */
  tint: string;
}

export function playerPanelWidth(cols: number): number {
  return clamp(Math.floor(cols * 0.45), 34, 52);
}

/** Width the portrait column takes inside the panel (0 when there is none). */
function artColumn(p: PlayerPanelData): number {
  return p.art.length === 0 ? 0 : p.art.reduce((m, r) => Math.max(m, r.length), 0) + 2;
}

/** Panel height: 4 (borders+name+hp) +1 orbs/mantra +1 powers, or the portrait
 *  if it is taller than the stats stack. */
export function playerPanelHeight(p: PlayerPanelData): number {
  const stats = 4 + (p.orbs !== null || p.mantra !== null ? 1 : 0) + (p.powers.length > 0 ? 1 : 0);
  return Math.max(stats, p.art.length + 2);
}

/** Render the player panel: exactly playerPanelHeight(p) rows, w visible cols. */
export function playerPanel(p: PlayerPanelData, w: number, theme: Theme): string[] {
  const aw = artColumn(p);
  const iw = w - 4 - aw;

  // energy orb lives in the top border: +==( E 3/3 )======+ - the E label
  // keeps it from reading as the orb row that sits directly underneath
  const orb = `( E ${p.energy}/${p.energyMax} )`;
  const rest = Math.max(0, w - 4 - orb.length);
  const top = `+==${theme.bold(theme.fg(C.energy, orb))}${"=".repeat(rest)}+`;
  const bottom = `+${"=".repeat(w - 2)}+`;

  const badge =
    p.stance !== null
      ? theme.bold(p.stanceColor !== null ? theme.fg(p.stanceColor, `[${p.stance}]`) : `[${p.stance}]`)
      : "";
  const badgeLen = p.stance !== null ? p.stance.length + 2 : 0;
  const nameRow = `${theme.bold(padClip(p.name, iw - badgeLen - (badgeLen > 0 ? 1 : 0)))}${badgeLen > 0 ? " " + badge : ""}`;

  // the stats stack, top-aligned inside the panel
  const stats: string[] = [nameRow, hpRow(p.hp, p.maxHp, p.block, iw, "HP ", theme, clamp(w - 32, 10, 24))];
  if (p.orbs !== null || p.mantra !== null) {
    const parts: string[] = [];
    if (p.mantra !== null) parts.push(theme.fg(C.gold, `Mantra ${p.mantra}`));
    if (p.orbs !== null) {
      parts.push(
        p.orbs
          .map((o) => (o.empty ? theme.dim(o.text) : o.color !== null ? theme.fg(o.color, o.text) : o.text))
          .join(""),
      );
    }
    stats.push(parts.join("  "));
  }
  if (p.powers.length > 0) stats.push(powersRow(p.powers, iw, theme, 3));

  // the hero stands at the left, on the panel floor, with the stats beside him
  const contentH = playerPanelHeight(p) - 2;
  const artTop = contentH - p.art.length;
  const rows: string[] = [top];
  for (let i = 0; i < contentH; i++) {
    const art = i >= artTop ? (p.art[i - artTop] ?? "") : "";
    const artCell = aw === 0 ? "" : `${padClip(art === "" ? "" : theme.fg(p.tint, art), aw - 2)}  `;
    rows.push(`| ${artCell}${padClip(stats[i] ?? "", iw)} |`);
  }
  rows.push(bottom);
  return rows.map((r) => padClip(r, w));
}
