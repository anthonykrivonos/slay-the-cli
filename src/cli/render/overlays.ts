// Overlay rendering. An open overlay replaces the screen body (header + hint
// bar stay), drawn as a +---+ box: pending-choice picker, deck / relics /
// pile / potion lists, the potion use/discard menu, card inspection, and the
// quit confirmation.

import type { OverlayView, ListView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center, boxLines, wrapPlain } from "./widgets";
import { cardBox, type CardBoxData } from "./cardbox";
import { renderMap } from "./map";

function plainListBody(
  list: ListView,
  theme: Theme,
  maxLines: number,
  accent: string,
  width: number,
): string[] {
  const out: string[] = [];
  const push = (line: string, enabled: boolean, focused: boolean) => {
    if (!enabled) out.push(theme.dim(line));
    else out.push(focused ? theme.bold(theme.fg(accent, line)) : line);
  };
  for (const item of list.items) {
    const focused = list.focusI !== null && item.i === list.focusI;
    const cursor = focused ? "> " : "  ";
    const keyPart = item.key !== null && item.action !== null ? `[${item.key}] ` : item.key !== null ? `    ` : "    ";
    const notePart = item.note !== null ? `  (${item.note})` : "";
    const head = `${cursor}${keyPart}${item.label}${notePart}`;
    if (item.sub === null) {
      push(head, item.enabled, focused);
      continue;
    }
    // one line while it fits, otherwise the detail wraps underneath instead of
    // being clipped mid-sentence by the box
    const oneLine = `${head}  - ${item.sub}`;
    if (oneLine.length <= width) {
      push(oneLine, item.enabled, focused);
      continue;
    }
    push(head, item.enabled, focused);
    for (const line of wrapPlain(item.sub, Math.max(10, width - 8))) {
      out.push(theme.dim(`        ${line}`));
    }
  }
  if (list.pages > 1) out.push(theme.dim(`page ${list.page + 1}/${list.pages} - [n] next [p] prev`));
  return out.slice(0, maxLines);
}

function choiceBody(o: Extract<OverlayView, { kind: "choice" }>, theme: Theme, maxLines: number, accent: string): string[] {
  const out: string[] = [];
  out.push(theme.dim(`choose ${o.constraint}${o.canCancel ? "  (Esc cancels)" : ""}`));
  out.push("");
  for (const item of o.list.items) {
    const focused = o.list.focusI !== null && item.i === o.list.focusI;
    const cursor = focused ? "> " : "  ";
    const mark = o.single ? "" : o.selected.includes(item.i) ? "[x] " : "[ ] ";
    const line = `${cursor}[${item.key ?? " "}] ${mark}${item.label}`;
    if (o.selected.includes(item.i)) out.push(theme.bold(theme.fg(C.gold, line)));
    else out.push(focused ? theme.bold(theme.fg(accent, line)) : line);
  }
  if (o.list.pages > 1) out.push(theme.dim(`page ${o.list.page + 1}/${o.list.pages} - [n] next [p] prev`));
  if (!o.single) {
    out.push("");
    out.push(theme.dim(`selected ${o.selected.length} - [Enter] confirm`));
  }
  return out.slice(0, maxLines);
}

// --- inspect ------------------------------------------------------------------
//
// A big box, centered, with the pager underneath. Cards, relics and potions
// all draw as one shape - a relic just has no cost corner. A card that has a
// second printed state draws BOTH, base on the left and upgraded on the
// right, the one you are holding in full color and the other dim:
//
//        current                   upgraded
//   +(1)------------+         +(1)------------+
//   | Strike        |         | Strike+       |
//
// The captions are what survives --no-color, where dim is a no-op.

const INSPECT_MAX_W = 38;
/** Narrower than this and the pair is unreadable, so only the current card
 *  is drawn. Two of these plus the gap fit the 80-column minimum. */
const INSPECT_MIN_PAIR_W = 24;
const INSPECT_GAP = 2;

interface InspectColumn {
  data: CardBoxData;
  caption: string;
}

/** Rules plus the keyword glossary, the blank line between them included. */
function inspectBody(rules: string[], keywords: { name: string; text: string }[]): string[] {
  const body = [...rules];
  if (keywords.length > 0) {
    body.push("");
    for (const k of keywords) body.push(`${k.name}: ${k.text}`);
  }
  return body;
}

function inspectRows(
  overlay: Extract<OverlayView, { kind: "inspect" }>,
  width: number,
  height: number,
  theme: Theme,
): string[] {
  const alt = overlay.alt;
  const pairW = Math.min(INSPECT_MAX_W, Math.floor((width - 4 - INSPECT_GAP) / 2));
  const paired = alt !== null && pairW >= INSPECT_MIN_PAIR_W;
  const w = paired ? pairW : Math.min(INSPECT_MAX_W, width - 4);

  const current: InspectColumn = {
    caption: "current",
    data: {
      key: null,
      cost: overlay.cost,
      name: overlay.name,
      color: overlay.color,
      type: overlay.type,
      targeted: overlay.targeted,
      rules: inspectBody(overlay.rules, overlay.keywords),
      dim: false,
    },
  };
  const cols: InspectColumn[] = [current];
  if (paired && alt !== null) {
    const other: InspectColumn = {
      caption: alt.side === "right" ? "upgraded" : "unupgraded",
      data: {
        ...current.data,
        cost: alt.cost,
        name: alt.name,
        rules: inspectBody(alt.rules, alt.keywords),
        dim: true,
      },
    };
    cols.splice(alt.side === "right" ? 1 : 0, 0, other);
  }

  // the whole point of this overlay is that nothing is cut, so the boxes grow
  // to whatever the tallest column needs and only the terminal clamps them
  const tallest = cols.reduce(
    (m, c) => Math.max(m, c.data.rules.flatMap((l) => (l.length === 0 ? [""] : wrapPlain(l, w - 4))).length),
    0,
  );
  // keep the type row (h >= 6): borders + name + type + body
  const h = Math.max(6, Math.min(4 + Math.max(1, tallest), height - (paired ? 4 : 3)));

  const boxes = cols.map((c) => cardBox(c.data, w, h, theme));
  const total = w * cols.length + INSPECT_GAP * (cols.length - 1);
  const pad = " ".repeat(Math.max(0, Math.floor((width - total) / 2)));
  const gap = " ".repeat(INSPECT_GAP);

  const out: string[] = [""];
  // padded to the full box width: center() only pads on the left, and the
  // second caption has to keep its column
  if (paired) out.push(pad + cols.map((c) => theme.dim(padClip(center(c.caption, w), w))).join(gap));
  for (let r = 0; r < h; r++) out.push(pad + boxes.map((b) => b[r] ?? "").join(gap));
  out.push("");
  const what = overlay.chip.toLowerCase();
  out.push(
    center(
      theme.dim(`${overlay.count > 1 ? `${what} ${overlay.index + 1}/${overlay.count} - ` : ""}[j/k] next/prev  [Esc] close`),
      width,
    ),
  );
  return out.slice(0, height).map((l) => padClip(l, width));
}

export function renderOverlay(
  overlay: OverlayView,
  width: number,
  height: number,
  theme: Theme,
  accent: string = C.current,
): string[] {
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
    case "potionMenu": {
      title = overlay.name;
      const w = Math.min(width - 2, 76) - 4;
      body = [
        // what it does, not just when it can be drunk
        ...(overlay.text !== null ? wrapPlain(overlay.text, w) : []),
        overlay.targeted ? theme.dim("Throws at a target (needs combat).") : theme.dim("Drink at any time."),
        ...(overlay.blocked !== null ? [theme.dim(`(${overlay.blocked})`)] : []),
        "",
        `${theme.bold("[u]")} use    ${theme.bold("[d]")} discard    ${theme.bold("[Esc]")} cancel`,
      ];
      break;
    }
    case "inspect":
      return inspectRows(overlay, width, height, theme);
    case "map": {
      // the whole map, exactly as the map screen draws it, minus the ability
      // to go anywhere. The frame's own hint row says how to get back, so the
      // overlay spends every line it has on the map.
      const out = renderMap(overlay.map, width, height, theme, accent);
      return out.slice(0, height).map((l) => padClip(l, width));
    }
    case "log": {
      title = overlay.title;
      // show the TAIL of the log (most recent events at the bottom). Lines from
      // earlier fights read dimmer than the one you are in.
      const from = overlay.lines.length - Math.min(bodyMax, overlay.lines.length);
      body = overlay.lines.slice(from).map((l, i) => (from + i >= overlay.currentFrom ? theme.fg(C.text, l) : theme.dim(l)));
      if (body.length === 0) body = [theme.dim("(nothing has happened yet)")];
      break;
    }
    case "choice":
      title = overlay.title;
      body = choiceBody(overlay, theme, bodyMax, accent);
      break;
    case "list":
      title = overlay.title;
      body = plainListBody(overlay.list, theme, bodyMax, accent, boxW - 4);
      break;
  }
  const box = boxLines(title, body.slice(0, bodyMax), boxW, theme);
  // center the box horizontally
  const pad = " ".repeat(Math.max(0, Math.floor((width - boxW) / 2)));
  const out = box.map((l) => pad + l);
  return out.slice(0, height).map((l) => padClip(l, width));
}
