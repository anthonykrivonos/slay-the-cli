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
  /** e.g. "/! 11x2", "/! 9 [+5]", "[+5]", "^^", "zz", "??" */
  intentGlyph: string;
  intentKind: "attack" | "block" | "other";
  /** dim move name shown next to the glyph when it fits */
  move: string | null;
  powers: PowerChipData[];
  gone: "dead" | "escaped" | null;
}

export const ENEMY_PANEL_H = 6;

/** Panel width for m enemies across `cols`. <18 = panels don't fit. */
export function enemyPanelWidth(cols: number, m: number): number {
  return clamp(Math.floor((cols - 2) / Math.max(1, m)) - 1, 18, 30);
}

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

/** Render one enemy panel: exactly ENEMY_PANEL_H rows of w visible columns. */
export function enemyPanel(e: EnemyPanelData, w: number, theme: Theme): string[] {
  const iw = w - 4;
  const border = `+${"-".repeat(w - 2)}+`;
  const line = (s: string): string => `| ${padClip(s, iw)} |`;

  if (e.gone !== null) {
    const rows = [border, line(""), line(e.name), line(`x ${e.gone} x`), line(""), border];
    return rows.map((r) => theme.dim(padClip(r, w)));
  }

  // intent + target key
  const key = e.key !== null ? `[${e.key}]` : "";
  const glyph =
    e.intentKind === "attack"
      ? theme.bold(theme.fg(C.intent, e.intentGlyph))
      : e.intentKind === "block"
        ? theme.fg(C.block, e.intentGlyph)
        : theme.fg(C.gold, e.intentGlyph);
  let leftLen = e.intentGlyph.length;
  let move = "";
  if (e.move !== null && leftLen + 1 + e.move.length + key.length + 1 <= iw) {
    move = ` ${theme.dim(e.move)}`;
    leftLen += 1 + e.move.length;
  }
  const gap = Math.max(1, iw - leftLen - key.length);
  const intentRow = `${glyph}${move}${" ".repeat(gap)}${theme.bold(key)}`;

  const rows = [
    border,
    line(intentRow),
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
}

export function playerPanelWidth(cols: number): number {
  return clamp(Math.floor(cols * 0.45), 34, 52);
}

/** Panel height for this data: 4 (borders+name+hp) +1 orbs/mantra +1 powers. */
export function playerPanelHeight(p: PlayerPanelData): number {
  return 4 + (p.orbs !== null || p.mantra !== null ? 1 : 0) + (p.powers.length > 0 ? 1 : 0);
}

/** Render the player panel: exactly playerPanelHeight(p) rows, w visible cols. */
export function playerPanel(p: PlayerPanelData, w: number, theme: Theme): string[] {
  const iw = w - 4;
  const line = (s: string): string => `| ${padClip(s, iw)} |`;

  // energy orb lives in the top border: +==( 3/3 )======+
  const orb = `( ${p.energy}/${p.energyMax} )`;
  const rest = Math.max(0, w - 4 - orb.length);
  const top = `+==${theme.bold(theme.fg(C.energy, orb))}${"=".repeat(rest)}+`;
  const bottom = `+${"=".repeat(w - 2)}+`;

  const badge =
    p.stance !== null
      ? theme.bold(p.stanceColor !== null ? theme.fg(p.stanceColor, `[${p.stance}]`) : `[${p.stance}]`)
      : "";
  const badgeLen = p.stance !== null ? p.stance.length + 2 : 0;
  const nameRow = `${theme.bold(padClip(p.name, iw - badgeLen - (badgeLen > 0 ? 1 : 0)))}${badgeLen > 0 ? " " + badge : ""}`;

  const rows: string[] = [top, line(nameRow), line(hpRow(p.hp, p.maxHp, p.block, iw, "HP ", theme, clamp(w - 32, 10, 24)))];

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
    rows.push(line(parts.join("  ")));
  }
  if (p.powers.length > 0) {
    rows.push(line(powersRow(p.powers, iw, theme, 3)));
  }
  rows.push(bottom);
  return rows.map((r) => padClip(r, w));
}
