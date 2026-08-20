// Overlay rendering. An open overlay replaces the screen body (header + hint
// bar stay), drawn as a +---+ box: pending-choice picker, deck / relics /
// pile / potion lists, the potion use/discard menu, card inspection, and the
// quit confirmation.

import type { OverlayView, ListView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, boxLines, wrapPlain } from "./widgets";

function plainListBody(list: ListView, theme: Theme, maxLines: number): string[] {
  const out: string[] = [];
  for (const item of list.items) {
    const focused = list.focusI !== null && item.i === list.focusI;
    const cursor = focused ? "> " : "  ";
    const keyPart = item.key !== null && item.action !== null ? `[${item.key}] ` : item.key !== null ? `    ` : "    ";
    const notePart = item.note !== null ? `  (${item.note})` : "";
    let line = `${cursor}${keyPart}${item.label}${notePart}`;
    if (item.sub !== null) line += `  - ${item.sub}`;
    if (!item.enabled) out.push(theme.dim(line));
    else out.push(focused ? theme.bold(theme.fg(C.current, line)) : line);
  }
  if (list.pages > 1) out.push(theme.dim(`page ${list.page + 1}/${list.pages} - [n] next [p] prev`));
  return out.slice(0, maxLines);
}

function choiceBody(o: Extract<OverlayView, { kind: "choice" }>, theme: Theme, maxLines: number): string[] {
  const out: string[] = [];
  out.push(theme.dim(`choose ${o.constraint}${o.canCancel ? "  (Esc cancels)" : ""}`));
  out.push("");
  for (const item of o.list.items) {
    const focused = o.list.focusI !== null && item.i === o.list.focusI;
    const cursor = focused ? "> " : "  ";
    const mark = o.single ? "" : o.selected.includes(item.i) ? "[x] " : "[ ] ";
    const line = `${cursor}[${item.key ?? " "}] ${mark}${item.label}`;
    if (o.selected.includes(item.i)) out.push(theme.bold(theme.fg(C.gold, line)));
    else out.push(focused ? theme.bold(theme.fg(C.current, line)) : line);
  }
  if (o.list.pages > 1) out.push(theme.dim(`page ${o.list.page + 1}/${o.list.pages} - [n] next [p] prev`));
  if (!o.single) {
    out.push("");
    out.push(theme.dim(`selected ${o.selected.length} - [Enter] confirm`));
  }
  return out.slice(0, maxLines);
}

export function renderOverlay(overlay: OverlayView, width: number, height: number, theme: Theme): string[] {
  const boxW = Math.min(width - 2, 76);
  const bodyMax = Math.max(1, height - 4); // box chrome eats 4 lines
  let title: string;
  let body: string[];
  switch (overlay.kind) {
    case "confirmQuit":
      title = "Quit?";
      body = [
        "Leave the Spire and return to the terminal?",
        theme.dim("Your run is saved after every action - continue any time."),
        "",
        `${theme.bold("[y]")} quit    ${theme.bold("[n]")} keep playing`,
      ];
      break;
    case "potionMenu":
      title = overlay.name;
      body = [
        overlay.targeted ? theme.dim("Throws at a target (needs combat).") : theme.dim("Drink at any time."),
        "",
        `${theme.bold("[u]")} use    ${theme.bold("[d]")} discard    ${theme.bold("[Esc]")} cancel`,
      ];
      break;
    case "inspect": {
      title = `${overlay.title}   ${overlay.count > 1 ? `(${overlay.index + 1}/${overlay.count})` : ""}`;
      body = [];
      for (const line of overlay.lines) {
        if (line.length === 0) body.push("");
        else body.push(...wrapPlain(line, boxW - 4));
      }
      body.push("");
      body.push(theme.dim("[j/k] next/prev  [Esc] close"));
      break;
    }
    case "choice":
      title = overlay.title;
      body = choiceBody(overlay, theme, bodyMax);
      break;
    case "list":
      title = overlay.title;
      body = plainListBody(overlay.list, theme, bodyMax);
      break;
  }
  const box = boxLines(title, body.slice(0, bodyMax), boxW, theme);
  // center the box horizontally
  const pad = " ".repeat(Math.max(0, Math.floor((width - boxW) / 2)));
  const out = box.map((l) => pad + l);
  return out.slice(0, height).map((l) => padClip(l, width));
}
