// The Merchant: his stall (art on wide terminals) over a CARDS section of
// card boxes with prices underneath, RELICS / POTIONS one-liners with corpus
// text, a SERVICES card-removal button, and the leave line. Hotkeys always
// mirror the paged list (off-page items show a dim [.]). Falls back to the
// plain numbered list on tight terminals.

import type { ShopView, ShopRowView, ListItemView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center, rule } from "./widgets";
import { renderListScreen } from "./listScreen";
import { clamp, joinBlocks, rowWidth } from "./layout";
import { cardBox, cardBoxHeight, buttonBox, buttonBoxHeight, tintFocus, type CardBoxData } from "./cardbox";
import { CARD_COLOR_ACCENTS } from "../text/runlogic";
import { ART_MERCHANT } from "./art";

const QUOTE = '"Coins for goods. Goods for coins."';

function keyOf(items: ListItemView[], i: number): string {
  return items.find((it) => it.i === i)?.key ?? ".";
}

function priceLabel(row: { price: number; sold: boolean; affordable: boolean }, theme: Theme): string {
  if (row.sold) return theme.dim("SOLD");
  if (!row.affordable) return theme.dim(`need ${row.price}G`);
  return theme.fg(C.gold, `${row.price}G`);
}

function priceLen(row: { price: number; sold: boolean; affordable: boolean }): number {
  if (row.sold) return 4;
  if (!row.affordable) return 6 + String(row.price).length;
  return 1 + String(row.price).length;
}

function shopRowLine(row: ShopRowView, screen: ShopView, width: number, theme: Theme, accent: string): string {
  const focused = screen.list.focusI === row.i;
  const cursor = focused ? "> " : "  ";
  const key = `[${keyOf(screen.list.items, row.i)}]`;
  const name = row.name.padEnd(20);
  const tier = row.tier.padEnd(9);
  const price = (row.affordable ? `${row.price}G` : `need ${row.price}G`).padStart(10);
  const plain = `${cursor}${key} ${name} ${tier} ${price}  ${row.text}`;
  if (row.sold) return theme.dim(`${cursor}${key} ${name} ${tier}       SOLD`);
  if (focused) return theme.bold(theme.fg(accent, padClip(plain, width)));
  if (!row.affordable) return theme.dim(plain);
  return `${cursor}${theme.bold(key)} ${name} ${theme.dim(tier)} ${theme.fg(C.gold, price)}  ${theme.dim(row.text)}`;
}

export function renderShop(
  screen: ShopView,
  width: number,
  height: number,
  theme: Theme,
  accent: string = C.current,
): string[] {
  const nCards = screen.cards.length;
  const cardH = cardBoxHeight(height);
  const boxesOk = nCards > 0 && Math.floor((width - 2) / nCards) >= 12;
  const removalData = {
    key: keyOf(screen.list.items, screen.removal.i),
    label: `CARD REMOVAL  ${screen.removal.price}G`,
    subs: ["Remove a card from your deck"],
    enabled: !screen.removal.used && screen.removal.affordable,
    note: screen.removal.used ? "already used" : !screen.removal.affordable ? `need ${screen.removal.price}G` : null,
  };
  const removalH = buttonBoxHeight([removalData]);
  const rowsNeeded =
    1 + cardH + 1 + // cards rule + boxes + price row
    1 + screen.relics.length + screen.potions.length + // relics/potions rule + rows
    1 + removalH + // services rule + removal button
    1 + // leave
    (screen.list.pages > 1 ? 1 : 0);
  if (!boxesOk || rowsNeeded > height) {
    // ladder floor: the plain numbered list
    return renderListScreen({ title: screen.title, intro: [], list: screen.list }, width, height, theme, { accent });
  }

  const out: string[] = [];
  const spare = height - rowsNeeded;

  // merchant art: beside the quote on wide terminals, dropped otherwise
  if (width >= 108 && spare >= ART_MERCHANT.h) {
    // the title rule already carries the gold, so the merchant just talks
    const text = ["", "", theme.dim(QUOTE)];
    out.push(...joinBlocks([ART_MERCHANT.rows.map((r) => theme.dim(r)), text], [ART_MERCHANT.w, width - ART_MERCHANT.w - 6], 2, 2));
  } else if (spare >= 2) {
    out.push("");
    out.push(center(theme.dim(QUOTE), width));
  }

  // -- CARDS --
  out.push(theme.dim(rule("CARDS", width)));
  const w = clamp(Math.floor((width - 2) / nCards), 12, 22);
  const gap = rowWidth(nCards, w, 1) <= width ? 1 : 0;
  const rowW = rowWidth(nCards, w, gap);
  const leftPad = Math.max(0, Math.floor((width - rowW) / 2));
  const blocks = screen.cards.map((c) => {
    const data: CardBoxData = {
      key: keyOf(screen.list.items, c.i),
      cost: c.cost,
      name: c.name,
      color: CARD_COLOR_ACCENTS[c.color] ?? null,
      type: "",
      targeted: false,
      rules: c.rules,
      dim: c.sold || !c.affordable,
    };
    const box = cardBox(data, w, cardH, theme);
    return screen.list.focusI === c.i ? tintFocus(box, theme, accent) : box;
  });
  out.push(...joinBlocks(blocks, blocks.map(() => w), gap, leftPad));
  // prices under each box
  let priceRow = " ".repeat(leftPad);
  screen.cards.forEach((c, k) => {
    const len = priceLen(c);
    const inner = Math.max(0, Math.floor((w - len) / 2));
    priceRow += " ".repeat(inner) + priceLabel(c, theme) + " ".repeat(Math.max(0, w - inner - len));
    if (k < nCards - 1) priceRow += " ".repeat(gap);
  });
  out.push(priceRow);

  // -- RELICS / POTIONS --
  out.push(theme.dim(rule("RELICS / POTIONS", width)));
  for (const r of screen.relics) out.push(shopRowLine(r, screen, width, theme, accent));
  for (const p of screen.potions) out.push(shopRowLine(p, screen, width, theme, accent));

  // -- SERVICES --
  out.push(theme.dim(rule("SERVICES", width)));
  const removalFocused = screen.list.focusI === screen.removal.i;
  const bw = Math.min(width - 4, 44);
  const removalBox = buttonBox(removalData, bw, removalH, theme);
  for (const r of removalFocused ? tintFocus(removalBox, theme, accent) : removalBox) out.push(`  ${r}`);

  const leaveFocused = screen.list.focusI === screen.leave.i;
  const leave = `${leaveFocused ? "> " : "  "}[Enter] Leave the shop`;
  out.push(leaveFocused ? theme.bold(theme.fg(accent, leave)) : `  ${theme.bold("[Enter]")} Leave the shop`);
  if (screen.list.pages > 1) {
    out.push(theme.dim(`  page ${screen.list.page + 1}/${screen.list.pages} - [n] next [p] prev - hotkeys act on this page`));
  }

  return out.slice(0, height).map((l) => padClip(l, width));
}
