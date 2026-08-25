// Rewards screen: a centered SPOILS OF BATTLE panel - single rewards as
// icon rows ([1] ($) 15 Gold), card / boss-relic picks as side-by-side card
// boxes inside the panel, then the Continue action. Collapses groups to
// one-liners (and finally the whole panel to the plain list) when tight.

import type { RewardsView, RewardRowView, ListItemView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, wrapPlain } from "./widgets";
import { renderListScreen } from "./listScreen";
import { clamp, joinBlocks, rowWidth } from "./layout";
import { cardBox, cardBoxHeight, tintFocus, type CardBoxData } from "./cardbox";
import { CARD_TYPE_ACCENTS } from "../text/runlogic";

function keyOf(items: ListItemView[], i: number): string {
  return items.find((it) => it.i === i)?.key ?? ".";
}

type GroupRow = Extract<RewardRowView, { type: "group" }>;
type SingleRow = Extract<RewardRowView, { type: "single" }>;

/** Dim effect lines under a relic or potion reward. Gold and keys have no
 *  text; a long relic gets two lines and the rest is one [i] away. */
function singleSubs(row: SingleRow, inner: number): string[] {
  if (row.text === null) return [];
  return wrapPlain(row.text, Math.max(10, inner - 6)).slice(0, 2);
}

export function renderRewards(
  screen: RewardsView,
  width: number,
  height: number,
  theme: Theme,
  accent: string = C.current,
): string[] {
  const panelW = Math.min(width - 4, 72);
  const inner = panelW - 4;
  /** row width available to a card-box group (1 leading pad column) */
  const avail = inner - 1;
  const cardH = cardBoxHeight(height);

  // group geometry: boxes inside the panel, or one-liners when too narrow
  const groupBoxes = (g: GroupRow): boolean =>
    g.items.length > 0 && clamp(Math.floor(avail / g.items.length), 0, 22) >= 12;
  let bodyRows = 0;
  for (const row of screen.rows) {
    if (row.type === "single") bodyRows += 1 + singleSubs(row, inner).length;
    else bodyRows += 1 + (groupBoxes(row) ? cardH : row.items.length);
  }
  bodyRows += 2; // blank + continue
  // no title inside the panel: the header rule above it already names the screen
  const panelH = bodyRows + 2; // borders
  if (panelH > height || panelW < 40) {
    return renderListScreen({ title: screen.title, intro: [], list: screen.list }, width, height, theme, { accent });
  }

  const body: string[] = [];
  const focusI = screen.list.focusI;
  for (const row of screen.rows) {
    if (row.type === "single") {
      const focused = focusI === row.i;
      const cursor = focused ? "> " : "  ";
      const key = `[${keyOf(screen.list.items, row.i)}]`;
      const note = row.note !== null ? `  (${row.note})` : "";
      const plain = `${cursor}${key} ${row.icon} ${row.label}${note}`;
      if (!row.enabled) body.push(theme.dim(plain));
      else if (focused) body.push(theme.bold(theme.fg(accent, plain)));
      else body.push(`${cursor}${theme.bold(key)} ${theme.fg(C.gold, row.icon)} ${row.label}${theme.dim(note)}`);
      for (const line of singleSubs(row, inner)) body.push(theme.dim(`      ${line}`));
    } else {
      body.push(theme.dim(row.title));
      if (groupBoxes(row)) {
        const w = clamp(Math.floor(avail / row.items.length), 12, 22);
        const gap = rowWidth(row.items.length, w, 1) <= avail ? 1 : 0;
        const blocks = row.items.map((it) => {
          const data: CardBoxData = {
            key: keyOf(screen.list.items, it.i),
            cost: it.cost.length > 0 ? it.cost : null,
            name: it.name,
            color: CARD_TYPE_ACCENTS[it.cardType] ?? null,
            type: "",
            targeted: false,
            rules: it.rules,
            dim: !it.enabled,
          };
          const box = cardBox(data, w, cardH, theme);
          return focusI === it.i ? tintFocus(box, theme, accent) : box;
        });
        body.push(...joinBlocks(blocks, blocks.map(() => w), gap, 1));
      } else {
        for (const it of row.items) {
          const focused = focusI === it.i;
          const cursor = focused ? "> " : "  ";
          const key = `[${keyOf(screen.list.items, it.i)}]`;
          const note = it.note !== null ? `  (${it.note})` : "";
          const plain = `${cursor}${key} ${it.name}${it.cost.length > 0 ? ` (${it.cost})` : ""}  ${it.rules[0] ?? ""}${note}`;
          if (!it.enabled) body.push(theme.dim(plain));
          else if (focused) body.push(theme.bold(theme.fg(accent, padClip(plain, inner))));
          else body.push(plain);
        }
      }
    }
  }
  body.push("");
  {
    const i = screen.continueI;
    const focused = focusI === i;
    const cursor = focused ? "> " : "  ";
    const key = `[${keyOf(screen.list.items, i)}]`;
    const label = screen.list.items.find((it) => it.i === i)?.label ?? "Continue";
    const plain = `${cursor}${key} ${label}`;
    body.push(focused ? theme.bold(theme.fg(accent, plain)) : `${cursor}${theme.bold(key)} ${label}`);
  }

  // compose the centered panel
  const pad = " ".repeat(Math.max(0, Math.floor((width - panelW) / 2)));
  const out: string[] = [];
  const top = Math.max(0, Math.min(2, Math.floor((height - panelH) / 3)));
  for (let i = 0; i < top; i++) out.push("");
  out.push(`${pad}+${"-".repeat(panelW - 2)}+`);
  for (const line of body) out.push(`${pad}| ${padClip(line, inner)} |`);
  out.push(`${pad}+${"-".repeat(panelW - 2)}+`);

  return out.slice(0, height).map((l) => padClip(l, width));
}
