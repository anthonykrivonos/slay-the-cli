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
  for (const ch of screen.characters) {
    const accent = CHARACTER_COLORS[ch.id] ?? "#54689a";
    const mark = ch.selected ? ">" : " ";
    const name = ch.name.padEnd(10);
    const line = ` ${mark} [${ch.key}] ${name} ${String(ch.maxHp).padStart(3)} HP   ${ch.relic}`;
    out.push(ch.selected ? theme.bold(theme.fg(accent, line)) : line);
  }
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
  out.push(`  ${theme.fg(C.good, "[n] NEW RUN")}`);
  if (screen.continueDesc !== null) {
    out.push(`  ${theme.fg(C.text, `[c] CONTINUE - ${screen.continueDesc}`)}`);
  }
  return out.slice(0, height).map((l) => padClip(l, width));
}
