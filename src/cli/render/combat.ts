// Combat screen, game-shaped: a relic/potion strip, enemy panels holding each
// creature's ASCII portrait under its intent (right-aligned), the player status
// panel with the hero's portrait (bottom-left), inline log tail, and the hand
// as a row of card boxes over a DRAW/END TURN/DISCARD bar.
//
// Vertical budget (degrade in order: portraits -> log -> enemy panels ->
// player panel -> card boxes):
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
  enemyPanelHeight,
  playerPanel,
  playerPanelHeight,
  playerPanelWidth,
  ENEMY_PANEL_H,
  INTENT_COLORS,
  type EnemyPanelData,
  type PlayerPanelData,
} from "./panels";
import { monsterPortrait, monsterTint, sharedMonsterTier, pickPortrait } from "./art";
import { CARD_TYPE_ACCENTS, CHARACTER_COLORS } from "../text/runlogic";
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

function enemyData(e: CombatView["enemies"][number], art: string[]): EnemyPanelData {
  return {
    key: e.key,
    name: e.name,
    hp: e.hp,
    maxHp: e.maxHp,
    block: e.block,
    intentGlyph: e.intent?.glyph ?? "??",
    intentKind: e.intent?.color ?? "other",
    intentTotal: e.intent?.total ?? null,
    intentParts: e.intent?.parts ?? [],
    move: e.move,
    powers: e.powers,
    gone: e.gone,
    art,
    tint: monsterTint(e.id),
  };
}

/**
 * The portraits for one row of enemies: a shared tier so the panels line up,
 * each padded on TOP to the tallest of them so the creatures stand on a common
 * ground line. Empty arrays when no tier fits the space.
 */
function enemyArt(ids: string[], maxW: number, maxH: number): string[][] {
  const tier = maxH <= 0 ? -1 : sharedMonsterTier(ids, maxW, maxH);
  if (tier < 0) return ids.map(() => []);
  const arts = ids.map((id) => monsterPortrait(id, tier)!.rows);
  const tallest = arts.reduce((m, a) => Math.max(m, a.length), 0);
  return arts.map((a) => [...Array<string>(tallest - a.length).fill(""), ...a]);
}

function playerData(v: CombatView, art: string[]): PlayerPanelData {
  return {
    art,
    tint: CHARACTER_COLORS[v.you.id] ?? C.text,
    name: v.you.name,
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
    color: CARD_TYPE_ACCENTS[h.type] ?? null,
    type: typeRow ? (TYPE_WORD[h.type] ?? "?") : "",
    targeted: h.targeted,
    rules: h.rules,
    preview: h.preview,
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
  const intentColored = theme.fg(INTENT_COLORS[e.intent?.color ?? "other"], glyph);
  const intentPad = " ".repeat(Math.max(0, (compact ? 10 : 12) - glyph.length));
  // even on one line, say what the move actually does: the first chip fits
  const first = e.intent?.parts[0];
  const detail =
    first !== undefined
      ? theme.fg(first.kind === "buff" ? C.good : first.kind === "other" ? C.gold : C.bad, `${first.text}  `)
      : "";
  const move = e.move !== null && !compact && first === undefined ? theme.dim(`~${e.move}  `) : "";
  const powers =
    e.powers.length > 0
      ? theme.dim(e.powers.map((p) => `${p.kind === "buff" ? "^" : "v"}${p.name} ${p.amount}`).join(", "))
      : "";
  return `${key} ${name} ${hp} ${hpBar}  ${blk} ${intentColored}${intentPad} ${detail}${move}${powers}`;
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
  const num = (h.preview?.text ?? "").padEnd(12); // fixed column so rows line up
  const rules = h.rules[0] ?? "";
  const line = `${cursor}${key} ${name} ${cost}${t} ${num}${rules}`;
  if (!h.playable) return theme.dim(line);
  const numShown =
    h.preview === null
      ? num
      : h.preview.tone === "up"
        ? theme.bold(theme.fg(C.good, num))
        : h.preview.tone === "down"
          ? theme.bold(theme.fg(C.bad, num))
          : theme.dim(num);
  if (focused) return `${theme.bold(theme.fg(accent, `${cursor}${key}`))} ${name} ${theme.fg(C.energy, cost)}${t} ${numShown}${theme.dim(rules)}`;
  return `${cursor}${theme.bold(theme.fg(C.text, key))} ${name} ${theme.fg(C.energy, cost)}${t} ${numShown}${theme.dim(rules)}`;
}

/**
 * INCOMING vs BLOCK, centered between the enemy row and your panel: the two
 * numbers a turn is decided by, printed next to each other rather than at
 * opposite ends of the screen.
 */
function threatLine(v: CombatView, width: number, theme: Theme): string {
  const { incoming, block } = v.threat;
  // Runic Dome: the total is a read of the intents, so it is hidden with them.
  // Block still shows - that is yours to know - and there is no net to compute.
  if (incoming === null) {
    const hidden = [
      `${theme.dim("INCOMING")} ${theme.bold(theme.dim("??"))}`,
      `${theme.dim("BLOCK")} ${theme.bold(theme.fg(block > 0 ? C.block : C.dim, String(block)))}`,
    ];
    const plainHidden = `INCOMING ??    BLOCK ${block}`;
    const padHidden = Math.max(0, Math.floor((width - plainHidden.length) / 2));
    return padClip(" ".repeat(padHidden) + hidden.join("    "), width);
  }
  const net = block - incoming;
  const parts = [
    `${theme.dim("INCOMING")} ${theme.bold(theme.fg(incoming > 0 ? C.bad : C.dim, String(incoming)))}`,
    `${theme.dim("BLOCK")} ${theme.bold(theme.fg(block > 0 ? C.block : C.dim, String(block)))}`,
    `${theme.dim("NET")} ${theme.bold(theme.fg(net < 0 ? C.bad : C.good, net > 0 ? `+${net}` : String(net)))}`,
  ];
  const plain = `INCOMING ${incoming}    BLOCK ${block}    NET ${net > 0 ? `+${net}` : net}`;
  const pad = Math.max(0, Math.floor((width - plain.length) / 2));
  return padClip(" ".repeat(pad) + parts.join("    "), width);
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

  // Portraits: sized from the rows left once everything else has its own, so
  // they are what a tight terminal gives up first. The enemy row shares one
  // tier; the hero takes whatever fits beside his stats.
  let art = screen.enemies.map(() => [] as string[]);
  let heroArt: string[] = [];
  const pDataOf = (hero: string[]): PlayerPanelData => playerData(screen, hero);
  const bareNeed =
    1 + 1 + (panelsOk ? ENEMY_PANEL_H : m) + 1 + playerPanelHeight(pDataOf([])) + logL + targRow + 1 +
    (n === 0 ? 1 : boxesOk ? cardH * (twoRows ? 2 : 1) : n) + 1;
  if (panelsOk) {
    const spare = height - bareNeed;
    // The hero goes first, but cheaply: his panel is already several rows tall,
    // so a portrait that short costs nothing, and beyond that he takes a third
    // of the spare rows. The enemies get everything left.
    const statsH = playerPanelHeight(pDataOf([]));
    const heroCap = Math.min(10, statsH - 2 + Math.max(0, Math.floor(spare / 3)));
    const hero = heroCap >= 3 ? pickPortrait(screen.you.id, playerPanelWidth(width) - 26, heroCap) : null;
    heroArt = hero !== null ? hero.rows : [];
    const heroCost = Math.max(0, heroArt.length + 2 - statsH);
    const eW = enemyPanelWidth(width, m, true);
    art = enemyArt(screen.enemies.map((e) => e.id), eW - 4, Math.min(spare - heroCost, 18));
  }
  let pData = pDataOf(heroArt);

  const artH = (): number => art[0]?.length ?? 0;
  const enemyRows = (): number => (panelsOk ? enemyPanelHeight(artH()) : m);
  const playerRows = (): number => (playerPanelOk ? playerPanelHeight(pData) : youLines(screen, width, theme).length);
  const cardRows = (): number => (n === 0 ? 1 : boxesOk ? cardH * (twoRows ? 2 : 1) : n);
  const need = (): number => 1 + 1 + enemyRows() + 1 + playerRows() + logL + targRow + 1 + cardRows() + 1;

  // degrade: portraits -> log -> enemy panels -> player panel -> card boxes
  if (need() > height && artH() > 0) art = screen.enemies.map(() => []);
  if (need() > height && heroArt.length > 0) {
    heroArt = [];
    pData = pDataOf(heroArt);
  }
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
    const eW = enemyPanelWidth(width, m, artH() > 0);
    const blocks = screen.enemies.map((e, i) => {
      const p = enemyPanel(enemyData(e, art[i] ?? []), eW, theme);
      return screen.focusEnemy === i ? tintFocus(p, theme, accent) : p;
    });
    const rowW = rowWidth(m, eW, 1);
    const leftPad = Math.max(0, width - rowW - 1);
    out.push(...joinBlocks(blocks, blocks.map(() => eW), 1, leftPad));
  } else {
    for (const e of screen.enemies) out.push(enemyLine(e, width, theme));
  }

  // 3. flex gap (weight 3), then the turn in two numbers: the threat line takes
  // the fixed blank row that always sits above the player panel, so it costs
  // nothing and lands mid-screen where both numbers are read together
  for (let i = 0; i < gaps[0]!; i++) out.push("");
  out.push(threatLine(screen, width, theme));

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

  // 7. targeting strip (directly above the HAND rule). The layout budget is
  // exactly one row, so a crowded room (five slimes) drops detail rather than
  // letting the last target fall off the end: every candidate must stay
  // readable, because its key is the only way to aim.
  if (targeting !== null) {
    const t = targeting;
    const cur = (k: number) => (k === t.focusIdx ? ">" : "");
    const dmg = (d: number | null) => (d !== null ? ` (${d})` : "");
    const join = (parts: string[], gap: string) => parts.join(gap);
    const forms: (() => string)[] = [
      () => `${t.prompt}: ${join(t.targets.map((x, k) => `${cur(k)}[${x.key}] ${x.name}${dmg(x.damage)}`), "  ")}`,
      () => `${t.prompt}: ${join(t.targets.map((x, k) => `${cur(k)}[${x.key}] ${x.name}${dmg(x.damage)}`), " ")}`,
      () => `Target: ${join(t.targets.map((x, k) => `${cur(k)}[${x.key}] ${x.name}${dmg(x.damage)}`), " ")}`,
      () => `Target: ${join(t.targets.map((x, k) => `${cur(k)}[${x.key}]${dmg(x.damage)}`), " ")}`,
      () => `Target: ${join(t.targets.map((x, k) => `${cur(k)}[${x.key}]`), "")}`,
    ];
    const budget = Math.max(0, width - 2); // one pad column each side
    const line = forms.map((f) => f()).find((s) => s.length <= budget) ?? forms[forms.length - 1]!();
    out.push(theme.inverse(padClip(` ${line} `, width)));
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
