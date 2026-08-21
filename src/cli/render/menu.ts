// Main menu: SLAY in 5x5 block letters over four hero boxes (selected hero
// gets `=` borders + accent, the focus cursor overrides in highlight color),
// then ascension / seed rows and the NEW RUN / CONTINUE actions. Degrades to
// the one-line banner + hero list when the terminal is too tight.

import type { MenuView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center, wrapPlain } from "./widgets";
import { CHARACTER_COLORS } from "../text/runlogic";
import { bigWord, bigWordWidth, BIG_ROWS } from "./bigfont";
import { clamp, joinBlocks, rowWidth } from "./layout";
import { ART_SPIRE, ART_HEROES } from "./art";

const CAPTION = "a mechanically exact spire";

/** The cursor and the character highlight are ONE: pointing at a hero selects
 *  it, so the selected hero carries both the '=' border + accent highlight
 *  and (while the cursor sits on it) the '>' mark. */
function heroBox(
  ch: MenuView["characters"][number],
  w: number,
  h: number,
  focused: boolean,
  theme: Theme,
): string[] {
  const iw = w - 4;
  const edge = ch.selected ? "=" : "-";
  const keySeg = `[${ch.key}]`;
  const top = `+${edge}${keySeg}${edge.repeat(Math.max(0, w - 3 - keySeg.length))}+`;
  const bottom = `+${edge.repeat(w - 2)}+`;
  const line = (s: string): string => `| ${padClip(s, iw)} |`;
  const relicLines = wrapPlain(ch.relic, iw).slice(0, 2);
  const rows = [top, line(`${focused ? "> " : ""}${ch.name}`), line(`${ch.maxHp} HP`)];
  for (let i = 0; i < h - 4; i++) rows.push(line(relicLines[i] ?? ""));
  rows.push(bottom);
  const accent = CHARACTER_COLORS[ch.id] ?? "#54689a";
  if (ch.selected) return rows.map((r) => theme.bold(theme.fg(accent, r)));
  return rows.map((r) => theme.dim(r));
}

export function renderMenu(screen: MenuView, width: number, height: number, theme: Theme): string[] {
  const letters = bigWord("SLAY");

  // the selected hero's portrait joins the block on wide terminals; the
  // hero boxes shrink (never below their minimum) to make room for it
  const selected = screen.characters.find((ch) => ch.selected) ?? screen.characters[0];
  const portrait = selected !== undefined ? ART_HEROES[selected.id] : undefined;
  const portraitGap = 4;
  const wantPortrait = portrait !== undefined && width >= 108;
  const boxSpace = wantPortrait ? width - 2 - portrait!.w - portraitGap : width - 2;
  const boxW = clamp(Math.floor(boxSpace / 4), 19, 26);
  const boxRowW = rowWidth(4, boxW, 1);
  // box height: relic names may wrap onto a second line on narrow boxes
  const relicRows = Math.max(
    1,
    ...screen.characters.map((ch) => Math.min(2, wrapPlain(ch.relic, boxW - 4).length)),
  );
  const boxH = 4 + relicRows;

  // vertical budget: letters(5)+caption+blank+block; the block is the boxes
  // + controls column, stretched to the portrait's height when shown
  const leftBlockH = boxH + 1 + 2 + 1 + 1 + (screen.continueDesc !== null ? 1 : 0);
  const blockH = wantPortrait ? Math.max(leftBlockH, portrait!.h + 1) : leftBlockH;
  const needBig = BIG_ROWS + 1 + 1 + blockH;
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

  // left column: hero boxes + controls (built at boxRowW, then joined with
  // the portrait column and centered as one block)
  const left: string[] = [];
  const blocks = screen.characters.map((ch, i) => heroBox(ch, boxW, boxH, screen.focusIdx === i, theme));
  left.push(...joinBlocks(blocks, blocks.map(() => boxW), 1, 0));
  left.push("");
  const margin = " ";
  const ascTag = `Ascension ${screen.ascension}`;
  left.push(
    `${margin}${screen.ascension > 0 ? theme.fg(C.gold, ascTag) : ascTag} - ${theme.dim(screen.ascensionLabel)}   ${theme.dim("[a] up / [A] down")}`,
  );
  if (screen.seedEdit !== null) {
    left.push(`${margin}Seed: ${theme.bold(`${screen.seedEdit}_`)}   ${theme.dim("typing... [Enter] confirm  [Esc] cancel")}`);
  } else {
    left.push(`${margin}Seed: ${theme.bold(screen.seed)}   ${theme.dim("[s] edit")}`);
  }
  left.push("");
  const newRun = `${screen.focusIdx === 4 ? ">" : " "} [n] NEW RUN`;
  left.push(
    screen.focusIdx === 4
      ? `${margin}${theme.bold(theme.fg(C.current, newRun))}`
      : `${margin} ${theme.bold(theme.fg(C.good, newRun.slice(2)))}`,
  );
  if (screen.continueDesc !== null) {
    const cont = `${screen.focusIdx === 5 ? ">" : " "} [c] CONTINUE - ${screen.continueDesc}`;
    left.push(
      screen.focusIdx === 5
        ? `${margin}${theme.bold(theme.fg(C.current, cont))}`
        : `${margin} ${theme.fg(C.text, cont.slice(2))}`,
    );
  }

  if (wantPortrait && portrait !== undefined && selected !== undefined) {
    const accent = CHARACTER_COLORS[selected.id] ?? "#54689a";
    const right = [
      ...portrait.rows.map((r) => theme.fg(accent, r)),
      center(theme.bold(theme.fg(accent, selected.name)), portrait.w),
    ];
    const assemblyW = boxRowW + portraitGap + portrait.w;
    const leftPad = Math.max(0, Math.floor((width - assemblyW) / 2));
    out.push(...joinBlocks([left, right], [boxRowW, portrait.w], portraitGap, leftPad));
  } else {
    const leftPad = Math.max(0, Math.floor((width - boxRowW) / 2));
    for (const line of left) out.push(" ".repeat(leftPad) + line);
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
    // cursor and character highlight are one: '>' rides the selected row
    const cursor = screen.focusIdx === i ? ">" : " ";
    const mark = ch.selected ? "*" : " ";
    const line = `${cursor} ${mark} [${ch.key}] ${ch.name.padEnd(10)} ${String(ch.maxHp).padStart(3)} HP   ${ch.relic}`;
    out.push(ch.selected ? theme.bold(theme.fg(accent, line)) : line);
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
