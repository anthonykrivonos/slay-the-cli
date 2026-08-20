// Combat screen: enemy intent lines, the YOU line (HP/block/energy/stance/
// mantra/orbs), one-line hand entries, and the event-log tail. One line per
// card keeps a full fight on one screen (details via the [i]nspect overlay).

import type { CombatView, TargetingView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, bar, rule } from "./widgets";

const TYPE_LETTER: Record<string, string> = {
  attack: "A",
  skill: "S",
  power: "P",
  status: "T",
  curse: "C",
};

function enemyLine(e: CombatView["enemies"][number], width: number, theme: Theme): string {
  if (e.gone) {
    return theme.dim(`[x] ${e.name}  (${e.gone})`);
  }
  const compact = width < 100;
  const key = theme.bold(`[${e.key ?? "?"}]`);
  const name = e.name.slice(0, compact ? 14 : 16).padEnd(compact ? 14 : 16);
  const hp = `HP ${String(e.hp).padStart(3)}/${String(e.maxHp).padEnd(3)}`;
  const hpBar = theme.fg(C.hp, bar(e.hp, e.maxHp, compact ? 6 : 10));
  const blk = e.block > 0 ? theme.fg(C.block, `B${e.block}`.padEnd(4)) : "    ";
  const intentColored = e.intent.startsWith("ATK")
    ? theme.fg(C.intent, e.intent)
    : e.intent.startsWith("BLK")
      ? theme.fg(C.block, e.intent)
      : theme.fg(C.gold, e.intent);
  const intentPad = " ".repeat(Math.max(0, (compact ? 12 : 14) - e.intent.length));
  const move = e.move !== null && !compact ? theme.dim(`~${e.move}  `) : "";
  const powers = e.powers !== null ? theme.dim(e.powers) : "";
  return `${key} ${name} ${hp} ${hpBar}  ${blk} ${intentColored}${intentPad} ${move}${powers}`;
}

function youLines(v: CombatView, width: number, theme: Theme): string[] {
  const compact = width < 100;
  const you = v.you;
  const name = `YOU ${you.name}`.slice(0, 21).padEnd(21);
  const hp = `HP ${String(you.hp).padStart(3)}/${String(you.maxHp).padEnd(3)}`;
  const hpBar = theme.fg(C.hp, bar(you.hp, you.maxHp, compact ? 6 : 10));
  const blk = you.block > 0 ? theme.fg(C.block, `B${you.block}`.padEnd(4)) : "    ";
  const en = theme.fg(C.energy, `E ${you.energy}/${you.energyMax}`);
  const stance = you.stance !== null ? ` ${theme.bold(theme.fg(C.purple, `[${you.stance}]`))}` : "";
  const mantra = you.mantra !== null ? ` ${theme.fg(C.gold, `Mantra ${you.mantra}`)}` : "";
  const lines = [`${theme.bold(name)} ${hp} ${hpBar}  ${blk} ${en}${stance}${mantra}`];
  if (you.orbs !== null) {
    lines.push(`    ORBS ${you.orbs.join(" ")}`);
  }
  if (you.powers !== null) {
    lines.push(theme.dim(`    ${you.powers}`));
  }
  return lines;
}

function handLine(h: CombatView["hand"][number], width: number, theme: Theme): string {
  const key = `[${h.key ?? " "}]`;
  const name = h.name.slice(0, 18).padEnd(18);
  const cost = `(${h.cost})`.padEnd(4);
  const t = `${TYPE_LETTER[h.type] ?? "?"}${h.targeted ? ">" : " "}`;
  const rules = h.rules;
  const line = `${key} ${name} ${cost}${t} ${rules}`;
  return h.playable ? `${theme.bold(theme.fg(C.text, key))} ${name} ${theme.fg(C.energy, cost)}${t} ${theme.dim(rules)}` : theme.dim(line);
}

export function renderCombat(
  screen: CombatView,
  targeting: TargetingView | null,
  width: number,
  height: number,
  theme: Theme,
): string[] {
  const out: string[] = [];
  for (const e of screen.enemies) out.push(enemyLine(e, width, theme));
  out.push("");
  out.push(...youLines(screen, width, theme));
  if (targeting !== null) {
    const targets = targeting.targets.map((t) => `[${t.key}] ${t.name}`).join("  ");
    out.push(theme.inverse(padClip(` ${targeting.prompt}: ${targets} `, width)));
  }
  out.push(rule(`HAND  (draw ${screen.piles.draw} / discard ${screen.piles.discard} / exhaust ${screen.piles.exhaust})`, width));
  if (screen.hand.length === 0) {
    out.push(theme.dim("    (no cards in hand)"));
  } else {
    for (const h of screen.hand) out.push(handLine(h, width, theme));
  }
  // log fills whatever room is left (up to 4 lines + rule)
  const remaining = height - out.length;
  if (remaining >= 2) {
    out.push(rule("LOG", width));
    const n = Math.min(remaining - 1, 4);
    const tail = screen.log.slice(-n);
    for (const line of tail) out.push(theme.dim(`  ${line}`));
  }
  return out.slice(0, height).map((l) => padClip(l, width));
}
