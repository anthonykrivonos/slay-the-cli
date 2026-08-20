// Main menu: SLAY in 5x5 block letters over four hero boxes (selected hero
// gets `=` borders + accent, the focus cursor overrides in highlight color),
// then ascension / seed rows and the NEW RUN / CONTINUE actions. Degrades to
// the one-line banner + hero list when the terminal is too tight.

import type { MenuView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center } from "./widgets";
import { CHARACTER_COLORS } from "../text/runlogic";
import { bigWord, bigWordWidth, BIG_ROWS } from "./bigfont";
import { clamp, joinBlocks, rowWidth } from "./layout";
import { ART_SPIRE } from "./art";

const CAPTION = "a mechanically exact spire";

function heroBox(
  ch: MenuView["characters"][number],
  w: number,
  focused: boolean,
  theme: Theme,
): string[] {
  const iw = w - 4;
  const edge = ch.selected ? "=" : "-";
  const keySeg = `[${ch.key}]`;
  const top = `+${edge}${keySeg}${edge.repeat(Math.max(0, w - 3 - keySeg.length))}+`;
  const bottom = `+${edge.repeat(w - 2)}+`;
  const line = (s: string): string => `| ${padClip(s, iw)} |`;
  const rows = [top, line(ch.name), line(`${ch.maxHp} HP`), line(ch.relic), bottom];
  const accent = CHARACTER_COLORS[ch.id] ?? "#54689a";
  if (focused) return rows.map((r) => theme.bold(theme.fg(C.current, r)));
  if (ch.selected) return rows.map((r) => theme.bold(theme.fg(accent, r)));
  return rows.map((r) => theme.dim(r));
}

export function renderMenu(screen: MenuView, width: number, height: number, theme: Theme): string[] {
  const letters = bigWord("SLAY");
  const boxW = clamp(Math.floor((width - 2) / 4), 19, 26);
  const boxRowW = rowWidth(4, boxW, 1);

  // vertical budget: letters(5)+caption+blank+boxes(5)+blank+asc+seed+blank+actions(2)
  const needBig = BIG_ROWS + 1 + 1 + 5 + 1 + 2 + 1 + 2;
  const useBig = letters !== null && bigWordWidth("SLAY") <= width - 4 && height >= needBig;
  const useBoxes = boxRowW <= width && height >= (useBig ? needBig : needBig - BIG_ROWS);

  if (!useBoxes) return renderMenuFallback(screen, width, height, theme);

  const out: string[] = [];
  const spare = height - needBig + (useBig ? 0 : BIG_ROWS - 1);
  // spire flourish on tall terminals, then the title block
  if (useBig && spare >= ART_SPIRE.h + 2) {
    for (const r of ART_SPIRE.rows) out.push(center(theme.dim(r), width));
    out.push("");
  }
  if (useBig) {
    for (const r of letters!) out.push(center(theme.bold(theme.fg(C.bright, r)), width));
  } else {
    out.push(center(theme.bold("S L A Y"), width));
  }
  out.push(center(theme.dim(CAPTION), width));
  out.push("");

  // hero boxes
  const blocks = screen.characters.map((ch, i) => heroBox(ch, boxW, screen.focusIdx === i, theme));
  const leftPad = Math.max(0, Math.floor((width - boxRowW) / 2));
  out.push(...joinBlocks(blocks, blocks.map(() => boxW), 1, leftPad));
  out.push("");

  // ascension + seed, aligned with the box row
  const margin = " ".repeat(leftPad + 1);
  const ascTag = `Ascension ${screen.ascension}`;
  out.push(
    `${margin}${screen.ascension > 0 ? theme.fg(C.gold, ascTag) : ascTag} - ${theme.dim(screen.ascensionLabel)}   ${theme.dim("[a] up / [A] down")}`,
  );
  if (screen.seedEdit !== null) {
    out.push(`${margin}Seed: ${theme.bold(`${screen.seedEdit}_`)}   ${theme.dim("typing... [Enter] confirm  [Esc] cancel")}`);
  } else {
    out.push(`${margin}Seed: ${theme.bold(screen.seed)}   ${theme.dim("[s] edit")}`);
  }
  out.push("");

  // actions (focus cursor rows 4 and 5)
  const newRun = `${screen.focusIdx === 4 ? ">" : " "} [n] NEW RUN`;
  out.push(
    screen.focusIdx === 4
      ? `${margin}${theme.bold(theme.fg(C.current, newRun))}`
      : `${margin} ${theme.bold(theme.fg(C.good, newRun.slice(2)))}`,
  );
  if (screen.continueDesc !== null) {
    const cont = `${screen.focusIdx === 5 ? ">" : " "} [c] CONTINUE - ${screen.continueDesc}`;
    out.push(
      screen.focusIdx === 5
        ? `${margin}${theme.bold(theme.fg(C.current, cont))}`
        : `${margin} ${theme.fg(C.text, cont.slice(2))}`,
    );
  }
  return out.slice(0, height).map((l) => padClip(l, width));
}

/** Ladder floor: the pre-redesign one-line banner + hero rows. */
function renderMenuFallback(screen: MenuView, width: number, height: number, theme: Theme): string[] {
  const out: string[] = [];
  out.push("");
  out.push(center(theme.bold("S L A Y"), width));
  out.push(center(theme.dim(CAPTION), width));
  out.push("");
  screen.characters.forEach((ch, i) => {
    const accent = CHARACTER_COLORS[ch.id] ?? "#54689a";
    const focused = screen.focusIdx === i;
    const cursor = focused ? ">" : " ";
    const mark = ch.selected ? "*" : " ";
    const line = `${cursor} ${mark} [${ch.key}] ${ch.name.padEnd(10)} ${String(ch.maxHp).padStart(3)} HP   ${ch.relic}`;
    out.push(focused ? theme.bold(theme.fg(C.current, line)) : ch.selected ? theme.bold(theme.fg(accent, line)) : line);
  });
  out.push("");
  const ascTag = `Ascension ${screen.ascension}`;
  out.push(`   ${screen.ascension > 0 ? theme.fg(C.gold, ascTag) : ascTag} - ${theme.dim(screen.ascensionLabel)}   ${theme.dim("[a] up / [A] down")}`);
  if (screen.seedEdit !== null) {
    out.push(`   Seed: ${theme.bold(`${screen.seedEdit}_`)}   ${theme.dim("typing... [Enter] confirm  [Esc] cancel")}`);
  } else {
    out.push(`   Seed: ${theme.bold(screen.seed)}   ${theme.dim("[s] edit")}`);
  }
  out.push("");
  const newRun = `${screen.focusIdx === 4 ? ">" : " "} [n] NEW RUN`;
  out.push(screen.focusIdx === 4 ? ` ${theme.bold(theme.fg(C.current, newRun))}` : `  ${theme.bold(theme.fg(C.good, newRun.slice(2)))}`);
  if (screen.continueDesc !== null) {
    const cont = `${screen.focusIdx === 5 ? ">" : " "} [c] CONTINUE - ${screen.continueDesc}`;
    out.push(screen.focusIdx === 5 ? ` ${theme.bold(theme.fg(C.current, cont))}` : `  ${theme.fg(C.text, cont.slice(2))}`);
  }
  return out.slice(0, height).map((l) => padClip(l, width));
}
