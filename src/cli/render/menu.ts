// Main menu: SLAY THE CLI in block letters, a row of hero cards (EVERY hero in its
// own accent color - the selected one bold with '=' borders and a '>' mark),
// ascension / seed controls, the run actions, and the selected hero's
// portrait centered underneath its name rule.
//
// Fluid: the portrait tier grows with the leftover rows and is dropped
// entirely when the functional block needs the space; below that the whole
// screen degrades to a compact banner + hero list.

import type { MenuView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center, wrapPlain } from "./widgets";
import { CHARACTER_COLORS } from "../text/runlogic";
import { bigWord, bigWordWidth, BIG_ROWS } from "./bigfont";
import { clamp, joinBlocks, rowWidth } from "./layout";
import { ART_SPIRE, pickPortrait } from "./art";
import { visibleWidth } from "../term/ansi";
import { VERSION_LABEL } from "../version";

const TITLE = "SLAY THE CLI";

function accentOf(id: string): string {
  return CHARACTER_COLORS[id] ?? "#54689a";
}

/** A hero card. Every hero wears its own accent; the selected one is bold
 *  with '=' borders, and the focus cursor (which selects) adds the '>' mark.
 *  Cursor and selection are one on this screen. */
function heroCard(
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
  const accent = accentOf(ch.id);
  const line = (s: string): string => `| ${padClip(s, iw)} |`;

  const relicLines = wrapPlain(ch.relic, iw).slice(0, 2);
  const rows: string[] = [];
  if (ch.selected) {
    rows.push(theme.bold(theme.fg(accent, top)));
    rows.push(theme.bold(theme.fg(accent, line(`${focused ? "> " : ""}${ch.name.toUpperCase()}`))));
    rows.push(theme.fg(accent, line(`${ch.maxHp} HP`)));
    for (let i = 0; i < h - 4; i++) rows.push(theme.dim(line(relicLines[i] ?? "")));
    rows.push(theme.bold(theme.fg(accent, bottom)));
    return rows;
  }
  // unselected heroes keep their identity color (dimmer, not colorless)
  rows.push(theme.fg(accent, top));
  rows.push(theme.fg(accent, line(ch.name)));
  rows.push(theme.dim(line(`${ch.maxHp} HP`)));
  for (let i = 0; i < h - 4; i++) rows.push(theme.dim(line(relicLines[i] ?? "")));
  rows.push(theme.fg(accent, bottom));
  return rows;
}

/** `---- IRONCLAD ----` rule introducing the portrait. */
function nameRule(name: string, accent: string, width: number, theme: Theme): string {
  const label = ` ${name.toUpperCase()} `;
  const dashes = Math.max(0, width - label.length);
  const left = Math.floor(dashes / 2);
  return `${theme.dim("-".repeat(left))}${theme.bold(theme.fg(accent, label))}${theme.dim("-".repeat(dashes - left))}`;
}

export function renderMenu(screen: MenuView, width: number, height: number, theme: Theme): string[] {
  const letters = bigWord(TITLE);
  const boxW = clamp(Math.floor((width - 2) / 4), 19, 26);
  const boxRowW = rowWidth(4, boxW, 1);
  // hero cards grow a row when a starting-relic name has to wrap
  const relicRows = Math.max(
    1,
    ...screen.characters.map((ch) => Math.min(2, wrapPlain(ch.relic, boxW - 4).length)),
  );
  const cardH = 4 + relicRows;

  const selected = screen.characters.find((ch) => ch.selected) ?? screen.characters[0];
  const accent = selected !== undefined ? accentOf(selected.id) : C.text;

  // --- functional block (everything except the title and the portrait) ---
  const block: string[] = [];
  const cards = screen.characters.map((ch, i) => heroCard(ch, boxW, cardH, screen.focusIdx === i, theme));
  block.push(...joinBlocks(cards, cards.map(() => boxW), 1, 0));
  block.push("");

  // controls live in a tighter column, centered under the card row, so the
  // key hints sit a readable distance from their labels
  const contTxt = screen.continueDesc !== null ? `[c] CONTINUE - ${screen.continueDesc}` : null;
  const ctrlW = clamp(Math.max(46, (contTxt?.length ?? 0) + 22), 40, Math.min(boxRowW, 72));
  const ctrlPad = " ".repeat(Math.max(0, Math.floor((boxRowW - ctrlW) / 2)));
  const ctrlRow = (left: string, hint: string): string => {
    const gap = Math.max(2, ctrlW - visibleWidth(left) - hint.length);
    return `${ctrlPad}${left}${" ".repeat(gap)}${theme.dim(hint)}`;
  };

  const ascTag = `Ascension ${screen.ascension}`;
  block.push(
    ctrlRow(
      `${screen.ascension > 0 ? theme.bold(theme.fg(C.gold, ascTag)) : ascTag} ${theme.dim(`- ${screen.ascensionLabel}`)}`,
      "[a] up / [A] down",
    ),
  );
  block.push(
    screen.seedEdit !== null
      ? `${ctrlPad}${theme.dim("Seed:")} ${theme.bold(theme.fg(C.bright, `${screen.seedEdit}_`))}   ${theme.dim("typing... [Enter] confirm  [Esc] cancel")}`
      : ctrlRow(`${theme.dim("Seed:")} ${theme.bold(theme.fg(C.bright, screen.seed))}`, "[s] edit"),
  );
  block.push("");

  // actions share one row when they fit, else stack
  const newRunTxt = `[n] NEW RUN`;
  const styleAction = (txt: string, focusedIdx: number, color: string): string => {
    const cursor = screen.focusIdx === focusedIdx ? "> " : "  ";
    // the focus highlight wears the selected hero's color
    return screen.focusIdx === focusedIdx
      ? theme.bold(theme.fg(accent, `${cursor}${txt}`))
      : `${cursor}${theme.bold(theme.fg(color, txt))}`;
  };
  const newRunStyled = styleAction(newRunTxt, 4, C.good);
  if (contTxt !== null) {
    const contStyled = styleAction(contTxt, 5, C.text);
    const oneRow = 2 + newRunTxt.length + 3 + 2 + contTxt.length;
    if (oneRow <= ctrlW) {
      block.push(`${ctrlPad}${newRunStyled}${" ".repeat(3)}${contStyled}`);
    } else {
      block.push(`${ctrlPad}${newRunStyled}`);
      block.push(`${ctrlPad}${contStyled}`);
    }
  } else {
    block.push(`${ctrlPad}${newRunStyled}`);
  }
  // subordinate to the two run actions, so it reads as a side door
  block.push(`${ctrlPad}${styleAction("[S] SETTINGS", screen.settingsIdx, C.dim)}`);

  if (screen.updateNotice !== null) {
    block.push("");
    block.push(`${ctrlPad}${theme.fg(C.current, screen.updateNotice)}`);
  }

  // --- title ---
  const head: string[] = [];
  const useBig = letters !== null && bigWordWidth(TITLE) <= width - 4;
  if (useBig) {
    for (const r of letters!) head.push(center(theme.bold(theme.fg(C.bright, r)), width));
  } else {
    head.push(center(theme.bold(theme.fg(C.bright, TITLE)), width));
  }
  head.push(center(theme.dim(VERSION_LABEL), width));
  head.push("");

  if (boxRowW > width || head.length + block.length > height) {
    return renderMenuFallback(screen, width, height, theme);
  }

  // --- portrait underneath, sized to whatever rows are left ---
  const leftPad = Math.max(0, Math.floor((width - boxRowW) / 2));
  const out: string[] = [];
  let spare = height - head.length - block.length;
  const portrait =
    selected !== undefined && spare >= 4 ? pickPortrait(selected.id, width - 4, spare - 2) : null;

  // a tall terminal with no portrait room gets the spire flourish instead
  if (portrait === null && spare >= ART_SPIRE.h + 2) {
    for (const r of ART_SPIRE.rows) out.push(center(theme.dim(r), width));
    out.push("");
    spare -= ART_SPIRE.h + 1;
  }

  out.push(...head);
  for (const line of block) out.push(" ".repeat(leftPad) + line);

  if (portrait !== null && selected !== undefined) {
    const gap = Math.max(0, Math.min(1, spare - portrait.h - 1));
    for (let i = 0; i < gap; i++) out.push("");
    out.push(center(nameRule(selected.name, accent, Math.min(width - 4, Math.max(portrait.w + 8, 28)), theme), width));
    for (const r of portrait.rows) out.push(center(theme.fg(accent, r), width));
  }

  return out.slice(0, height).map((l) => padClip(l, width));
}

/** Ladder floor: compact banner + one hero row each (still color-coded). */
function renderMenuFallback(screen: MenuView, width: number, height: number, theme: Theme): string[] {
  const out: string[] = [];
  out.push("");
  out.push(center(theme.bold(theme.fg(C.bright, TITLE)), width));
  out.push(center(theme.dim(VERSION_LABEL), width));
  out.push("");
  screen.characters.forEach((ch, i) => {
    const accent = accentOf(ch.id);
    const cursor = screen.focusIdx === i ? ">" : " ";
    const mark = ch.selected ? "*" : " ";
    const line = `${cursor} ${mark} [${ch.key}] ${ch.name.padEnd(10)} ${String(ch.maxHp).padStart(3)} HP   ${ch.relic}`;
    out.push(ch.selected ? theme.bold(theme.fg(accent, line)) : theme.fg(accent, line));
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
  const selectedFb = screen.characters.find((ch) => ch.selected) ?? screen.characters[0];
  const accentFb = selectedFb !== undefined ? accentOf(selectedFb.id) : C.good;
  const newRun = `${screen.focusIdx === 4 ? ">" : " "} [n] NEW RUN`;
  out.push(screen.focusIdx === 4 ? ` ${theme.bold(theme.fg(accentFb, newRun))}` : `  ${theme.bold(theme.fg(C.good, newRun.slice(2)))}`);
  if (screen.continueDesc !== null) {
    const cont = `${screen.focusIdx === 5 ? ">" : " "} [c] CONTINUE - ${screen.continueDesc}`;
    out.push(screen.focusIdx === 5 ? ` ${theme.bold(theme.fg(accentFb, cont))}` : `  ${theme.fg(C.text, cont.slice(2))}`);
  }
  const settings = `${screen.focusIdx === screen.settingsIdx ? ">" : " "} [S] SETTINGS`;
  out.push(
    screen.focusIdx === screen.settingsIdx
      ? ` ${theme.bold(theme.fg(accentFb, settings))}`
      : `  ${theme.fg(C.dim, settings.slice(2))}`,
  );
  if (screen.updateNotice !== null) {
    out.push(`  ${theme.fg(C.current, screen.updateNotice)}`);
  }
  return out.slice(0, height).map((l) => padClip(l, width));
}
