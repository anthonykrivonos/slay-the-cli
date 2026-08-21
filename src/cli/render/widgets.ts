// Pure text widgets shared by the per-screen renderers. Width math assumes
// pure-ASCII content + SGR color codes (the frame-invariants test enforces
// the charset), so no wide-character tables are needed.

import { stripAnsi, visibleWidth } from "../term/ansi";
import type { Theme } from "./theme";
import { C } from "./theme";
import type { ListView } from "../state/view";

/** Hard-clip to `width` visible columns and pad with spaces. Lines that
 *  overflow lose their color codes (clipping mid-SGR would shear sequences). */
export function padClip(s: string, width: number): string {
  const w = visibleWidth(s);
  if (w === width) return s;
  if (w < width) return s + " ".repeat(width - w);
  return stripAnsi(s).slice(0, width);
}

export function center(s: string, width: number): string {
  const w = visibleWidth(s);
  if (w >= width) return padClip(s, width);
  const left = Math.floor((width - w) / 2);
  return " ".repeat(left) + s;
}

/** `[####......]` - never divides by zero, clamps ratio to 0..1. */
export function bar(cur: number, max: number, inner: number): string {
  const ratio = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
  const filled = Math.round(ratio * inner);
  return `[${"#".repeat(filled)}${".".repeat(inner - filled)}]`;
}

/** `-- LABEL ------` section rule. */
export function rule(label: string, width: number): string {
  const body = label.length > 0 ? `-- ${label} ` : "";
  if (body.length >= width) return body.slice(0, width);
  return body + "-".repeat(width - body.length);
}

/** Greedy word-wrap over plain (uncolored) text. */
export function wrapPlain(s: string, width: number): string[] {
  const out: string[] = [];
  for (const para of s.split("\n")) {
    if (para.length <= width) {
      out.push(para);
      continue;
    }
    let line = "";
    for (const word of para.split(" ")) {
      if (line.length === 0) {
        line = word;
      } else if (line.length + 1 + word.length <= width) {
        line += ` ${word}`;
      } else {
        out.push(line);
        line = word;
      }
      while (line.length > width) {
        out.push(line.slice(0, width));
        line = line.slice(width);
      }
    }
    out.push(line);
  }
  return out;
}

/** Render a ListView as numbered lines: `[1] label  (note)` + optional
 *  indented sub line, with a `>` cursor on the focused item. Subs are
 *  dropped first when space is tight. */
export function listLines(
  list: ListView,
  width: number,
  theme: Theme,
  maxLines: number,
  accent: string = C.current,
): string[] {
  const withSubs: string[] = [];
  const noSubs: string[] = [];
  for (const item of list.items) {
    const focused = list.focusI !== null && item.i === list.focusI;
    const cursor = focused ? "> " : "  ";
    const keyPart = item.key !== null ? `[${item.key}] ` : "    ";
    const notePart = item.note !== null ? `  (${item.note})` : "";
    let main: string;
    if (!item.enabled) {
      main = theme.dim(`${cursor}${keyPart}${item.label}${notePart}`);
    } else if (focused) {
      main = theme.bold(theme.fg(accent, `${cursor}${keyPart}${item.label}`)) + theme.dim(notePart);
    } else {
      main = `${cursor}${theme.bold(theme.fg(C.text, keyPart))}${item.label}${theme.dim(notePart)}`;
    }
    withSubs.push(main);
    noSubs.push(main);
    if (item.sub !== null) {
      const sub = theme.dim(`        ${item.sub}`);
      withSubs.push(sub);
    }
  }
  const pageLine =
    list.pages > 1 ? [theme.dim(`page ${list.page + 1}/${list.pages} - [n] next [p] prev`)] : [];
  const chosen = withSubs.length + pageLine.length <= maxLines ? withSubs : noSubs;
  const lines = [...chosen, ...pageLine];
  return lines.slice(0, maxLines).map((l) => padClip(l, width));
}

/** Compose a boxed overlay region: title bar + body inside +---+ borders. */
export function boxLines(title: string, body: string[], width: number, theme: Theme): string[] {
  const inner = Math.max(10, width - 4);
  const top = `+${"-".repeat(width - 2)}+`;
  const out: string[] = [top];
  out.push(`| ${padClip(theme.bold(title), inner)} |`);
  out.push(`|${"-".repeat(width - 2)}|`);
  for (const line of body) {
    out.push(`| ${padClip(line, inner)} |`);
  }
  out.push(top);
  return out;
}
