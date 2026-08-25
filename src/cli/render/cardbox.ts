// Card-shaped boxes for the hand / shop / rewards / inspect screens:
//
//   +(1)------------+        h7: cost / name / type / 3 rules / key
//   | Sword Boomerang|        h6: cost / name / type / 2 rules / key
//   | Attack       > |        h5: cost / name+>    / 2 rules / key
//   | Deal 3 damage  |
//   | to a random    |
//   | enemy 3 times. |
//   +-----[1]--------+
//
// Pure: consumes plain data, returns exactly h rows of exactly w visible
// columns. The renderers map View shapes onto CardBoxData.

import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, wrapPlain } from "./widgets";
import { clamp } from "./layout";
import type { ListItemView } from "../state/view";

export interface CardBoxData {
  /** hotkey shown in the bottom border; null = no key (not selectable) */
  key: string | null;
  /** printed cost shown in the top border; null = no cost corner */
  cost: string | null;
  name: string;
  /** hex accent for the name; null = plain */
  color: string | null;
  /** display type row ("Attack", "Skill"...); "" = none */
  type: string;
  targeted: boolean;
  /** rules text lines (unwrapped; wrapped to fit here) */
  rules: string[];
  /** the card's live numbers, right-aligned on the last inner row: "9 dmg".
   *  tone says whether a power raised it (up) or Weak/Frail cut it (down). */
  preview?: { text: string; tone: "up" | "down" | "flat" } | null;
  /** whole box dim (unplayable / unaffordable / sold / taken) */
  dim: boolean;
}

/** Box width for n cards across `cols` columns. <12 = boxes don't fit. */
export function cardBoxWidth(cols: number, n: number): number {
  return clamp(Math.floor((cols - 2) / Math.max(1, n)), 12, 22);
}

/** Box height from the screen rows available to the body. */
export function cardBoxHeight(bodyH: number): number {
  return bodyH >= 30 ? 7 : bodyH >= 24 ? 6 : 5;
}

function topBorder(cost: string | null, w: number, theme: Theme, dim: boolean): string {
  if (cost === null) return `+${"-".repeat(w - 2)}+`;
  const seg = `(${cost})`;
  const rest = Math.max(0, w - 2 - seg.length);
  if (dim) return `+${seg}${"-".repeat(rest)}+`;
  return `+${theme.fg(C.energy, seg)}${"-".repeat(rest)}+`;
}

function bottomBorder(key: string | null, w: number, theme: Theme, dim: boolean): string {
  if (key === null) return `+${"-".repeat(w - 2)}+`;
  const seg = `[${key}]`;
  const inner = w - 2;
  const left = Math.max(0, Math.floor((inner - seg.length) / 2));
  const right = Math.max(0, inner - seg.length - left);
  const mid = dim ? seg : theme.bold(seg);
  return `+${"-".repeat(left)}${mid}${"-".repeat(right)}+`;
}

function inner(content: string, w: number): string {
  return `| ${padClip(content, w - 4)} |`;
}

/** Right-aligned live numbers: green when a power raised them, red when Weak or
 *  Frail cut them, dim when the card is doing exactly what it says. */
function previewRow(
  preview: NonNullable<CardBoxData["preview"]>,
  iw: number,
  theme: Theme,
  dim: boolean,
): string {
  const text = preview.text.length >= iw ? preview.text.slice(0, iw) : preview.text.padStart(iw);
  if (dim) return text;
  if (preview.tone === "up") return theme.bold(theme.fg(C.good, text));
  if (preview.tone === "down") return theme.bold(theme.fg(C.bad, text));
  return theme.dim(text);
}

/** Render one card box: exactly h rows of exactly w visible columns. */
export function cardBox(card: CardBoxData, w: number, h: number, theme: Theme): string[] {
  const iw = w - 4;
  const hasTypeRow = h >= 6 && card.type.length > 0;
  // the live numbers own the last inner row, so the rules wrap one row shorter
  // (the truncation marker below already says when text was cut). A box too
  // short to hold both keeps the rules.
  const previewFits = h >= (hasTypeRow ? 5 : 4);
  const preview = (previewFits ? card.preview : null) ?? null;
  const rulesRows = Math.max(0, h - (hasTypeRow ? 4 : 3) - (preview !== null ? 1 : 0));
  const mark = card.targeted ? ">" : "";

  // name row ('>' joins the name when the type row is dropped)
  let nameRow: string;
  const rawName = padClip(card.name, hasTypeRow || mark.length === 0 ? iw : iw - 2);
  if (card.dim) {
    nameRow = inner(hasTypeRow || mark.length === 0 ? rawName : `${rawName} ${mark}`, w);
  } else {
    const styled = theme.bold(card.color !== null ? theme.fg(card.color, rawName) : rawName);
    nameRow = inner(hasTypeRow || mark.length === 0 ? styled : `${styled} ${mark}`, w);
  }

  // type row with a right-aligned target mark
  let typeRow: string | null = null;
  if (hasTypeRow) {
    const t = padClip(card.type, iw - (mark.length > 0 ? 2 : 0));
    const content = mark.length > 0 ? `${t} ${mark}` : t;
    typeRow = inner(card.dim ? content : theme.dim(content), w);
  }

  // rules rows: wrap everything, keep the first rulesRows lines. An interior
  // blank line is kept (the inspector uses one to separate the rules from the
  // keyword glossary); leading blanks are not.
  const wrapped: string[] = [];
  for (const line of card.rules) {
    if (line.length === 0) {
      if (wrapped.length > 0) wrapped.push("");
      continue;
    }
    wrapped.push(...wrapPlain(line, iw));
  }
  const shown = wrapped.slice(0, rulesRows);
  // Say when there is more text than the box can hold, rather than stopping
  // dead and reading like the whole rule. A cut inside a sentence trails off;
  // a whole sentence with more sentences after it gets a "+". Either way, the
  // full card is one [i] away.
  if (wrapped.length > rulesRows && shown.length > 0) {
    const last = shown[shown.length - 1]!;
    if (last.length === 0) {
      shown[shown.length - 1] = "...";
    } else if (/[.!?]$/.test(last)) {
      shown[shown.length - 1] = last.length + 2 <= iw ? `${last} +` : `${last.slice(0, iw - 2)} +`;
    } else if (last.length + 3 <= iw) {
      shown[shown.length - 1] = `${last}...`;
    } else {
      // trim back to a word boundary so the tail is not a chopped word
      const cut = last.slice(0, Math.max(0, iw - 3));
      const space = cut.lastIndexOf(" ");
      shown[shown.length - 1] = `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}...`;
    }
  }
  while (shown.length < rulesRows) shown.push("");

  const rows: string[] = [];
  rows.push(topBorder(card.cost, w, theme, card.dim));
  rows.push(nameRow);
  if (typeRow !== null) rows.push(typeRow);
  for (const r of shown) rows.push(inner(card.dim ? r : theme.dim(r), w));
  if (preview !== null) rows.push(inner(previewRow(preview, iw, theme, card.dim), w));
  rows.push(bottomBorder(card.key, w, theme, card.dim));

  const out = rows.slice(0, h).map((r) => padClip(r, w));
  if (card.dim) return out.map((r) => theme.dim(r));
  return out;
}

// --- button boxes (rest / neow / treasure / event options) -----------------------
//
//   +-[1]------------+
//   | REST           |
//   | heal 24 HP     |
//   +----------------+

export interface ButtonBoxData {
  key: string | null;
  label: string;
  /** dim detail lines under the label */
  subs: string[];
  enabled: boolean;
  /** why it's disabled (rendered as the last sub) */
  note: string | null;
}

/** Side-by-side button width for k buttons. <18 = side-by-side doesn't fit. */
export function buttonBoxWidth(cols: number, k: number): number {
  return clamp(Math.floor((cols - 2) / Math.max(1, k)), 18, 30);
}

/** Uniform height for a row of buttons: borders + label + tallest sub stack. */
export function buttonBoxHeight(buttons: ButtonBoxData[]): number {
  const subs = buttons.reduce(
    (m, b) => Math.max(m, b.subs.length + (b.enabled || b.note === null ? 0 : 1)),
    0,
  );
  return 3 + subs;
}

/** Render one button box: exactly h rows of exactly w visible columns. */
export function buttonBox(b: ButtonBoxData, w: number, h: number, theme: Theme): string[] {
  const iw = w - 4;
  const keySeg = b.key !== null ? `[${b.key}]` : "";
  const top =
    keySeg.length > 0
      ? `+-${b.enabled ? theme.bold(keySeg) : keySeg}${"-".repeat(Math.max(0, w - 3 - keySeg.length))}+`
      : `+${"-".repeat(w - 2)}+`;
  const bottom = `+${"-".repeat(w - 2)}+`;
  const line = (s: string): string => `| ${padClip(s, iw)} |`;

  const subs = [...b.subs];
  if (!b.enabled && b.note !== null) subs.push(`(${b.note})`);
  const rows: string[] = [top, line(b.enabled ? theme.bold(padClip(b.label, iw)) : b.label)];
  for (let i = 0; i < h - 3; i++) {
    const s = subs[i] ?? "";
    rows.push(line(b.enabled ? theme.dim(s) : s));
  }
  rows.push(bottom);
  const out = rows.slice(0, h).map((r) => padClip(r, w));
  return b.enabled ? out : out.map((r) => theme.dim(r));
}

/** Map a numbered list item onto button-box data: the part before " - "
 *  becomes the label (upper-cased when short), the rest + the sub wrap into
 *  detail lines. Keys/enabled/notes carry over, so hotkeys stay mirrored. */
export function itemButton(item: ListItemView, iw: number): ButtonBoxData {
  const dash = item.label.indexOf(" - ");
  let title = dash > 0 ? item.label.slice(0, dash) : item.label;
  const rest = (dash > 0 ? item.label.slice(dash + 3) : "").replace(/\s+/g, " ");
  const subs: string[] = [];
  const titleWrap = wrapPlain(title, iw);
  if (titleWrap.length > 1) {
    title = titleWrap[0]!;
    subs.push(...titleWrap.slice(1, 3));
  } else if (title.length <= 12) {
    title = title.toUpperCase();
  }
  if (rest.length > 0) subs.push(...wrapPlain(rest, iw).slice(0, 2));
  if (item.sub !== null) subs.push(...wrapPlain(item.sub, iw).slice(0, 2));
  return { key: item.key, label: title, subs, enabled: item.enabled, note: item.note };
}

/** Re-tint a box's top/bottom borders to mark the hover/selection focus, in
 *  the current character's accent (falls back to the generic highlight). */
export function tintFocus(rows: string[], theme: Theme, accent: string = C.current): string[] {
  return rows.map((r, i) =>
    i === 0 || i === rows.length - 1 ? theme.bold(theme.fg(accent, r.replace(/\x1b\[[0-9;]*m/g, ""))) : r,
  );
}
