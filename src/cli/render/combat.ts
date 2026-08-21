// Combat screen, game-shaped: a relic/potion strip, enemy intent panels
// (right-aligned), the player status panel (bottom-left), inline log tail,
// and the hand as a row of card boxes over a DRAW/END TURN/DISCARD bar.
//
// Vertical budget (degrade in order: log -> enemy panels -> player panel ->
// card boxes):
//   need = 1(strip) + 1 + eH + 1 + pH + logL [+1 targeting] + 1(HAND) + cardH + 1(bar)
// Leftover rows flex into the gap after the enemies (weight 3) and after the
// player panel (weight 1). Every fancy block keeps the original one-line
// rendering as its ladder floor.

import type { CombatView, TargetingView } from "../state/view";
import type { Theme } from "./theme";
import { C } from "./theme";
import { padClip, bar, rule } from "./widgets";
import { clamp, joinBlocks, flexFill, rowWidth } from "./layout";
import { cardBox, cardBoxWidth, cardBoxHeight, tintFocus, type CardBoxData } from "./cardbox";
import {
  enemyPanel,
  enemyPanelWidth,
  playerPanel,
  playerPanelHeight,
  playerPanelWidth,
  ENEMY_PANEL_H,
  type EnemyPanelData,
  type PlayerPanelData,
} from "./panels";
import { CARD_COLOR_ACCENTS } from "../text/runlogic";
import { visibleWidth } from "../term/ansi";

const TYPE_LETTER: Record<string, string> = {
  attack: "A",
  skill: "S",
  power: "P",
  status: "T",
  curse: "C",
};

const TYPE_WORD: Record<string, string> = {
  attack: "Attack",
  skill: "Skill",
  power: "Power",
  status: "Status",
  curse: "Curse",
};

// --- data mapping -----------------------------------------------------------------

function enemyData(e: CombatView["enemies"][number]): EnemyPanelData {
  return {
    key: e.key,
    name: e.name,
    hp: e.hp,
    maxHp: e.maxHp,
    block: e.block,
    intentGlyph: e.intent?.glyph ?? "??",
    intentKind: e.intent?.color ?? "other",
    move: e.move,
    powers: e.powers,
    gone: e.gone,
  };
}

function playerData(v: CombatView): PlayerPanelData {
  return {
    name: `YOU  ${v.you.name}`,
    hp: v.you.hp,
    maxHp: v.you.maxHp,
    block: v.you.block,
    energy: v.you.energy,
    energyMax: v.you.energyMax,
    stance: v.you.stance,
    stanceColor: v.you.stanceColor,
    mantra: v.you.mantra !== null ? `${v.you.mantra}/10` : null,
    orbs:
      v.you.orbs !== null
        ? v.you.orbs.map((o) => ({
            text: o.empty ? "( - )" : `(${o.letter}:${o.value === null ? "?" : o.value})`,
            empty: o.empty,
            color: o.empty ? null : C.gold,
          }))
        : null,
    powers: v.you.powers,
  };
}

function cardData(h: CombatView["hand"][number], typeRow: boolean): CardBoxData {
  return {
    key: h.key,
    cost: h.cost,
    name: h.name,
    color: CARD_COLOR_ACCENTS[h.color] ?? null,
    type: typeRow ? (TYPE_WORD[h.type] ?? "?") : "",
    targeted: h.targeted,
    rules: h.rules,
    dim: !h.playable,
  };
}

// --- one-line ladder floors ---------------------------------------------------------

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
  const glyph = e.intent?.glyph ?? "??";
  const intentColored =
    e.intent?.color === "attack"
      ? theme.fg(C.intent, glyph)
      : e.intent?.color === "block"
        ? theme.fg(C.block, glyph)
        : theme.fg(C.gold, glyph);
  const intentPad = " ".repeat(Math.max(0, (compact ? 10 : 12) - glyph.length));
  const move = e.move !== null && !compact ? theme.dim(`~${e.move}  `) : "";
  const powers =
    e.powers.length > 0
      ? theme.dim(e.powers.map((p) => `${p.kind === "buff" ? "^" : "v"}${p.name} ${p.amount}`).join(", "))
      : "";
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
  const stance =
    you.stance !== null
      ? ` ${theme.bold(theme.fg(you.stanceColor ?? C.purple, `[${you.stance}]`))}`
      : "";
  const mantra = you.mantra !== null ? ` ${theme.fg(C.gold, `Mantra ${you.mantra}/10`)}` : "";
  const lines = [`${theme.bold(name)} ${hp} ${hpBar}  ${blk} ${en}${stance}${mantra}`];
  if (you.orbs !== null) {
    lines.push(`    ORBS ${you.orbs.map((o) => (o.empty ? "( - )" : `(${o.letter}:${o.value === null ? "?" : o.value})`)).join(" ")}`);
  }
  if (you.powers.length > 0) {
    lines.push(theme.dim(`    ${you.powers.map((p) => `${p.name} ${p.amount}`).join(", ")}`));
  }
  return lines;
}

function handLine(h: CombatView["hand"][number], focused: boolean, theme: Theme, accent: string): string {
  const cursor = focused ? ">" : " ";
  const key = `[${h.key ?? " "}]`;
  const name = h.name.slice(0, 18).padEnd(18);
  const cost = `(${h.cost})`.padEnd(4);
  const t = `${TYPE_LETTER[h.type] ?? "?"}${h.targeted ? ">" : " "}`;
  const rules = h.rules[0] ?? "";
  const line = `${cursor}${key} ${name} ${cost}${t} ${rules}`;
  if (!h.playable) return theme.dim(line);
  if (focused) return `${theme.bold(theme.fg(accent, `${cursor}${key}`))} ${name} ${theme.fg(C.energy, cost)}${t} ${theme.dim(rules)}`;
  return `${cursor}${theme.bold(theme.fg(C.text, key))} ${name} ${theme.fg(C.energy, cost)}${t} ${theme.dim(rules)}`;
}

// --- strip + bottom bar ---------------------------------------------------------------

function stripLine(v: CombatView, width: number, theme: Theme): string {
  const parts: string[] = [theme.dim("RELICS")];
  let used = 7;
  const right = "  [l] log";
  const budget = width - 1 - right.length - 12; // reserve room for POTIONS
  let shown = 0;
  for (const r of v.relics) {
    const tag = r.counter > 0 ? `${r.abbrev}${r.counter}` : r.abbrev;
    if (used + tag.length + 1 > budget) break;
    parts.push(theme.fg(C.gold, tag));
    used += tag.length + 1;
    shown += 1;
  }
  if (shown < v.relics.length) {
    parts.push(theme.dim(`+${v.relics.length - shown}`));
    used += String(v.relics.length - shown).length + 2;
  }
  parts.push(theme.dim(" POTIONS"));
  used += 9;
  for (const p of v.potions) {
    parts.push(p === null ? theme.dim("[.]") : theme.fg(C.good, `[${p.letter}]`));
    used += 3;
  }
  const line = ` ${parts.join(" ")}`;
  const pad = Math.max(0, width - visibleWidth(line) - right.length);
  return `${line}${" ".repeat(pad)}${theme.dim(right)}`;
}

function bottomBar(v: CombatView, width: number, theme: Theme): string {
  const left = ` DRAW ${v.piles.draw}`;
  const mid = "[e] END TURN";
  const right = `DISCARD ${v.piles.discard}  EXHAUST ${v.piles.exhaust} `;
  const midStart = Math.max(left.length + 2, Math.floor((width - mid.length) / 2));
  const rightStart = Math.max(midStart + mid.length + 2, width - right.length);
  let line = left;
  line += " ".repeat(Math.max(0, midStart - left.length));
  line += mid;
  line += " ".repeat(Math.max(0, rightStart - midStart - mid.length));
  line += right;
  // style after composing so the column math stays honest
  return padClip(line, width)
    .replace(left, theme.fg(C.text, left))
    .replace(mid, theme.bold(mid))
    .replace(right, theme.dim(right));
}

// --- entry ------------------------------------------------------------------------------

export function renderCombat(
  screen: CombatView,
  targeting: TargetingView | null,
  width: number,
  height: number,
  theme: Theme,
  accent: string = C.current,
): string[] {
  const m = screen.enemies.length;
  const n = screen.hand.length;
  const targRow = targeting !== null ? 1 : 0;

  // ladder state
  let logL = height >= 32 ? 3 : height >= 27 ? 2 : 0;
  let panelsOk = m > 0 && Math.floor((width - 2) / m) - 1 >= 18;
  let playerPanelOk = true;
  let boxesOk = n > 0 && Math.floor((width - 2) / n) >= 12;
  let twoRows = false;
  if (n > 0 && !boxesOk && height >= 30 && Math.floor((width - 2) / Math.ceil(n / 2)) >= 12) {
    boxesOk = true;
    twoRows = true;
  }
  const cardH = cardBoxHeight(height);
  const pData = playerData(screen);

  const enemyRows = (): number => (panelsOk ? ENEMY_PANEL_H : m);
  const playerRows = (): number => (playerPanelOk ? playerPanelHeight(pData) : youLines(screen, width, theme).length);
  const cardRows = (): number => (n === 0 ? 1 : boxesOk ? cardH * (twoRows ? 2 : 1) : n);
  const need = (): number => 1 + 1 + enemyRows() + 1 + playerRows() + logL + targRow + 1 + cardRows() + 1;

  // degrade: log -> enemy panels -> player panel -> card boxes
  if (need() > height && logL > 0) logL = 0;
  if (need() > height && panelsOk) panelsOk = false;
  if (need() > height && playerPanelOk) playerPanelOk = false;
  if (need() > height && boxesOk) {
    boxesOk = false;
    twoRows = false;
  }

  const gaps = flexFill(height, need(), [3, 1]);
  const out: string[] = [];

  // 1. relic/potion strip
  out.push(stripLine(screen, width, theme));
  out.push("");

  // 2. enemies (right-aligned panels, or the one-line ladder floor)
  if (panelsOk) {
    const eW = enemyPanelWidth(width, m);
    const blocks = screen.enemies.map((e, i) => {
      const p = enemyPanel(enemyData(e), eW, theme);
      return screen.focusEnemy === i ? tintFocus(p, theme, accent) : p;
    });
    const rowW = rowWidth(m, eW, 1);
    const leftPad = Math.max(0, width - rowW - 1);
    out.push(...joinBlocks(blocks, blocks.map(() => eW), 1, leftPad));
  } else {
    for (const e of screen.enemies) out.push(enemyLine(e, width, theme));
  }

  // 3. flex gap (weight 3) + one fixed blank
  for (let i = 0; i < 1 + gaps[0]!; i++) out.push("");

  // 4. player panel at column 1 (or the one-line floor)
  if (playerPanelOk) {
    const pW = playerPanelWidth(width);
    for (const r of playerPanel(pData, pW, theme)) out.push(` ${r}`);
  } else {
    out.push(...youLines(screen, width, theme));
  }

  // 5. flex gap (weight 1)
  for (let i = 0; i < gaps[1]!; i++) out.push("");

  // 6. inline log tail
  if (logL > 0) {
    const tail = screen.log.slice(-logL);
    for (let i = 0; i < logL; i++) {
      const msg = tail[i];
      out.push(msg !== undefined ? theme.dim(` > ${msg}`) : "");
    }
  }

  // 7. targeting strip (directly above the HAND rule)
  if (targeting !== null) {
    const targets = targeting.targets
      .map((t, k) => `${k === targeting.focusIdx ? ">" : ""}[${t.key}] ${t.name}`)
      .join("  ");
    out.push(theme.inverse(padClip(` ${targeting.prompt}: ${targets} `, width)));
  }

  // 8. HAND rule + cards
  out.push(theme.dim(rule(`HAND ${n}`, width)));
  if (n === 0) {
    out.push(theme.dim("    (no cards in hand)"));
  } else if (boxesOk) {
    const perRow = twoRows ? Math.ceil(n / 2) : n;
    const w = cardBoxWidth(width, perRow);
    const typeRow = cardH >= 6;
    const renderRow = (cards: CombatView["hand"], baseIdx: number): void => {
      const blocks = cards.map((h, k) => {
        const b = cardBox(cardData(h, typeRow), w, cardH, theme);
        return screen.focusHand === baseIdx + k ? tintFocus(b, theme, accent) : b;
      });
      const gap = rowWidth(cards.length, w, 1) <= width ? 1 : 0;
      const rowW = rowWidth(cards.length, w, gap);
      const leftPad = Math.max(0, Math.floor((width - rowW) / 2));
      out.push(...joinBlocks(blocks, blocks.map(() => w), gap, leftPad));
    };
    if (twoRows) {
      renderRow(screen.hand.slice(0, perRow), 0);
      renderRow(screen.hand.slice(perRow), perRow);
    } else {
      renderRow(screen.hand, 0);
    }
  } else {
    screen.hand.forEach((h, i) => out.push(handLine(h, screen.focusHand === i, theme, accent)));
  }

  // 9. bottom bar pinned to the last row
  while (out.length < height - 1) out.push("");
  out[height - 1] = bottomBar(screen, width, theme);

  return out.slice(0, height).map((l) => padClip(l, width));
}
