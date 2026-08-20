// Main-menu renderer: character select, ascension stepper, seed line,
// new-run / continue actions.

import type { MenuView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, center } from "./widgets";
import { CHARACTER_COLORS } from "../text/runlogic";

export function renderMenu(screen: MenuView, width: number, height: number, theme: Theme): string[] {
  const out: string[] = [];
  out.push("");
  out.push(center(theme.bold("S L A Y"), width));
  out.push(center(theme.dim("a mechanically exact spire"), width));
  out.push("");
  out.push(`  ${theme.fg(C.text, "Choose your hero:")}`);
  screen.characters.forEach((ch, i) => {
    const accent = CHARACTER_COLORS[ch.id] ?? "#54689a";
    const focused = screen.focusIdx === i;
    const cursor = focused ? ">" : " ";
    const mark = ch.selected ? "*" : " ";
    const name = ch.name.padEnd(10);
    const line = `${cursor} ${mark} [${ch.key}] ${name} ${String(ch.maxHp).padStart(3)} HP   ${ch.relic}`;
    out.push(
      focused
        ? theme.bold(theme.fg(C.current, line))
        : ch.selected
          ? theme.bold(theme.fg(accent, line))
          : line,
    );
  });
  out.push("");
  const ascTag = `Ascension ${screen.ascension}`;
  out.push(
    `      ${screen.ascension > 0 ? theme.fg(C.gold, ascTag) : ascTag} - ${theme.dim(screen.ascensionLabel)}   ${theme.dim("[a] up / [A] down")}`,
  );
  if (screen.seedEdit !== null) {
    out.push(`      Seed: ${theme.bold(`${screen.seedEdit}_`)}   ${theme.dim("typing... [Enter] confirm  [Esc] cancel")}`);
  } else {
    out.push(`      Seed: ${theme.bold(screen.seed)}   ${theme.dim("[s] edit")}`);
  }
  out.push("");
  const newRunLine = `${screen.focusIdx === 4 ? ">" : " "} [n] NEW RUN`;
  out.push(screen.focusIdx === 4 ? theme.bold(theme.fg(C.current, newRunLine)) : ` ${theme.fg(C.good, newRunLine.slice(1))}`);
  if (screen.continueDesc !== null) {
    const contLine = `${screen.focusIdx === 5 ? ">" : " "} [c] CONTINUE - ${screen.continueDesc}`;
    out.push(screen.focusIdx === 5 ? theme.bold(theme.fg(C.current, contLine)) : ` ${theme.fg(C.text, contLine.slice(1))}`);
  }
  return out.slice(0, height).map((l) => padClip(l, width));
}
