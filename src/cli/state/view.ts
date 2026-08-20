// buildView: GameState + UiState -> render-ready View. This is the ONLY layer
// that consults the ContentBundle (names, rules text, intents, event screens,
// legality). Renderers and the keymap consume the View exclusively, which
// keeps them pure, snapshot-testable, and ignorant of game internals.

import type { GameState, Command } from "../../engine/game";
import type { RoomState } from "../../engine/run/runState";
import type { CardInstance } from "../../engine/combat/combatState";
import type { ContentBundle } from "../../engine/content/defs";
import type { PendingChoice } from "../../engine/core/actions";
import { getIntents, type IntentInfo } from "../../engine/combat/intents";
import {
  titleCase,
  cardName,
  relicName,
  potionName,
  eventTitle,
  masterCardCost,
  costText,
  canSmithMaster,
  smithableDeckIndices,
  neowBonusText,
  neowDrawbackText,
  legalMapPicks,
  mapGlyph,
  restHealPreview,
  canRecall,
  rewardLabel,
  rewardBlocked,
  chestTitle,
  describeChoiceReason,
  characterSummary,
  CHARACTER_IDS,
  CHARACTER_COLORS,
  ascensionLabel,
  buildEventView,
  playerFocus,
  orbDisplayValue,
  orbName,
  gameOverTitle,
  gameOverSubtitle,
} from "../text/runlogic";
import { cardRulesText } from "../text/cardtext";
import { toAscii } from "../text/ascii";
import type { UiState, Overlay, PileName } from "./uiState";
import { cmd, ui as uiAct, type KeyAction } from "../input/actions";

// --- view types ----------------------------------------------------------------

export type ViewMode =
  | "menu"
  | "textInput"
  | "overlay"
  | "choice"
  | "targeting"
  | "neow"
  | "map"
  | "combat"
  | "rewards"
  | "shop"
  | "rest"
  | "treasure"
  | "event"
  | "gameOver";

export interface HeaderView {
  name: string;
  accent: string;
  hp: number;
  maxHp: number;
  gold: number;
  floor: number;
  act: number;
  ascension: number;
  keys: { emerald: boolean; ruby: boolean; sapphire: boolean };
  potionCount: number;
  potionSlots: number;
  deckCount: number;
  relicCount: number;
  seed: string;
}

export interface ListItemView {
  /** hotkey shown/used for this page ("1".."9","0"); null = not selectable */
  key: string | null;
  /** absolute index in the full list (pagination-independent) */
  i: number;
  label: string;
  sub: string | null;
  enabled: boolean;
  note: string | null;
  action: KeyAction | null;
}

export interface ListView {
  items: ListItemView[]; // current page only
  page: number;
  pages: number;
  total: number;
}

export interface MenuView {
  kind: "menu";
  seed: string;
  seedEdit: string | null;
  ascension: number;
  ascensionLabel: string;
  characters: { key: string; id: string; name: string; maxHp: number; relic: string; selected: boolean }[];
  continueDesc: string | null;
}

export interface MapNodeView {
  x: number;
  glyph: string;
  burning: boolean;
  current: boolean;
  pickKey: string | null;
  edges: number[];
}

export interface MapView {
  kind: "map";
  act: number;
  bossName: string;
  bossReachable: boolean;
  bossPickKey: string | null;
  hasBossDoor: boolean;
  /** rows[y][x]; y=0 is the bottom of the act */
  nodeRows: (MapNodeView | null)[][];
  maxY: number;
  position: [number, number] | null;
  picks: { x: number; y: number; key: string; glyph: string }[];
  scroll: number;
  keysOwned: string;
  deckCount: number;
  relicCount: number;
  seed: string;
}

export interface EnemyLineView {
  key: string | null; // targeting number for alive enemies
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  intent: string;
  move: string | null;
  powers: string | null;
  gone: "dead" | "escaped" | null;
}

export interface CombatView {
  kind: "combat";
  turn: number;
  enemies: EnemyLineView[];
  you: {
    name: string;
    hp: number;
    maxHp: number;
    block: number;
    energy: number;
    energyMax: number;
    stance: string | null;
    mantra: string | null;
    powers: string | null;
    orbs: string[] | null;
  };
  hand: {
    key: string | null;
    name: string;
    cost: string;
    type: string;
    targeted: boolean;
    playable: boolean;
    rules: string;
  }[];
  piles: { draw: number; discard: number; exhaust: number };
  log: string[];
}

export interface SimpleListScreen {
  kind: "neow" | "rewards" | "shop" | "rest" | "treasure" | "event" | "gameOver";
  title: string;
  /** body lines above the list (event summary, chest text, game-over stats...) */
  intro: string[];
  list: ListView;
}

export type ScreenView = MenuView | MapView | CombatView | SimpleListScreen;

export type OverlayView =
  | {
      kind: "choice";
      title: string;
      constraint: string;
      list: ListView;
      selected: number[];
      min: number;
      max: number;
      canCancel: boolean;
      single: boolean;
    }
  | { kind: "list"; id: "deck" | "relics" | "pile" | "potions"; title: string; list: ListView }
  | { kind: "potionMenu"; slot: number; name: string; targeted: boolean }
  | { kind: "inspect"; title: string; lines: string[]; index: number; count: number }
  | { kind: "confirmQuit" };

export interface TargetingView {
  prompt: string;
  targets: { key: string; name: string; action: KeyAction }[];
}

export interface View {
  mode: ViewMode;
  header: HeaderView | null;
  screen: ScreenView;
  overlay: OverlayView | null;
  targeting: TargetingView | null;
  toast: string | null;
  log: string[];
  hint: string;
}

// --- small helpers --------------------------------------------------------------

export function keyFor(k: number): string | null {
  if (k < 0 || k > 9) return null;
  return k === 9 ? "0" : String(k + 1);
}

interface RawItem {
  label: string;
  sub?: string | null;
  enabled?: boolean;
  note?: string | null;
  action?: KeyAction | null;
}

export const LIST_PAGE_SIZE = 10;

function makeList(all: RawItem[], page: number): ListView {
  const pages = Math.max(1, Math.ceil(all.length / LIST_PAGE_SIZE));
  const p = Math.max(0, Math.min(page, pages - 1));
  const items = all.slice(p * LIST_PAGE_SIZE, p * LIST_PAGE_SIZE + LIST_PAGE_SIZE).map((it, k) => ({
    key: keyFor(k),
    i: p * LIST_PAGE_SIZE + k,
    label: toAscii(it.label),
    sub: it.sub != null ? toAscii(it.sub) : null,
    enabled: it.enabled ?? true,
    note: it.note != null ? toAscii(it.note) : null,
    action: it.action ?? null,
  }));
  return { items, page: p, pages, total: all.length };
}

/** ASCII printed cost for a live card instance. */
function instCostLabel(card: CardInstance): string {
  if (card.cost === -1) return "X";
  if (card.cost === -2) return "-";
  return String(card.costForTurn);
}

function masterCostLabel(cost: number): string {
  const t = costText(cost);
  return t === "–" ? "-" : t;
}

function prettyMove(monsterId: string, moveId: string): string {
  const stripped = moveId.startsWith(`${monsterId}_`) ? moveId.slice(monsterId.length + 1) : moveId;
  return titleCase(stripped);
}

const INTENT_LABELS: Record<string, string> = {
  buff: "Buffing",
  debuff: "Debuffing you",
  strongDebuff: "Debuffing you hard",
  sleep: "Sleeping",
  stun: "Stunned",
  escape: "Escaping",
  magic: "Casting",
  unknown: "Unknown",
  defend: "Defending",
  defendBuff: "Defend + buff",
  defendDebuff: "Defend + debuff",
};

function intentText(info: IntentInfo | null): string {
  if (!info) return "?";
  if (info.damage !== null) {
    const atk = `ATK ${info.damage}${info.hits > 1 ? `x${info.hits}` : ""}`;
    return info.block > 0 ? `${atk} +B${info.block}` : atk;
  }
  if (info.block > 0) return `BLK ${info.block}`;
  return INTENT_LABELS[info.kind] ?? titleCase(info.kind);
}

/** Mirror of the engine's playability gate (web UI's isPlayable). */
function isPlayable(card: CardInstance, energy: number): boolean {
  if (card.cost === -2) return false;
  if (card.cost === -1) return true;
  if (card.freeToPlayOnce) return true;
  return energy >= card.costForTurn;
}

function firstRulesLine(defId: string, upgrades: number): string {
  const t = cardRulesText(defId, upgrades);
  const line = t.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line;
}

// --- header ---------------------------------------------------------------------

function buildHeader(g: GameState, bundle: ContentBundle): HeaderView {
  const run = g.run;
  return {
    name: bundle.characters.get(run.character)?.name ?? titleCase(run.character),
    accent: CHARACTER_COLORS[run.character] ?? "#54689a",
    hp: run.hp,
    maxHp: run.maxHp,
    gold: run.gold,
    floor: run.floor,
    act: run.act,
    ascension: run.ascension,
    keys: { ...run.keys },
    potionCount: run.potions.filter((p) => p !== null).length,
    potionSlots: run.potions.length,
    deckCount: run.deck.length,
    relicCount: run.relics.length,
    seed: g.seed,
  };
}

// --- per-screen view builders ------------------------------------------------------

function buildMenu(ui: UiState, bundle: ContentBundle): MenuView {
  return {
    kind: "menu",
    seed: ui.seed,
    seedEdit: ui.seedEdit ? ui.seedEdit.value : null,
    ascension: ui.ascension,
    ascensionLabel: ascensionLabel(ui.ascension),
    characters: CHARACTER_IDS.map((id, i) => {
      const s = characterSummary(bundle, id);
      return { key: String(i + 1), id, name: s.name, maxHp: s.maxHp, relic: toAscii(s.relic), selected: ui.character === id };
    }),
    continueDesc: ui.menuSave ? toAscii(ui.menuSave.desc) : null,
  };
}

function buildNeow(room: Extract<RoomState, { kind: "neow" }>, ui: UiState): SimpleListScreen {
  const items: RawItem[] = room.options.map((opt, i) => ({
    label: neowBonusText(opt.bonus),
    sub: opt.drawback !== "NONE" ? `! ${neowDrawbackText(opt.drawback)}` : null,
    action: cmd({ cmd: "neowPick", i }),
  }));
  return {
    kind: "neow",
    title: "NEOW'S BLESSING - choose one",
    intro: [],
    list: makeList(items, ui.page),
  };
}

function buildMap(g: GameState, ui: UiState, bundle: ContentBundle): MapView {
  const map = g.run.map;
  const picksRaw = legalMapPicks(g.run);
  const pos = g.run.position;
  const act4 = map?.act === 4;
  const bossName = map ? (bundle.monsters.get(map.bossId)?.name ?? titleCase(map.bossId)) : "?";
  const picks = picksRaw.map((p, i) => {
    const node = map?.rows[p.y]?.[p.x];
    return { x: p.x, y: p.y, key: keyFor(i) ?? "?", glyph: node ? mapGlyph(node.kind) : "B" };
  });
  const pickAt = new Map(picks.map((p) => [`${p.x},${p.y}`, p.key]));
  const bossPick = picks.find((p) => p.y >= (map?.rows.length ?? 15));

  const nodeRows: (MapNodeView | null)[][] = [];
  let maxY = 0;
  if (map) {
    map.rows.forEach((row, y) => {
      const outRow: (MapNodeView | null)[] = row.map((node) => {
        if (!node) return null;
        maxY = Math.max(maxY, y);
        return {
          x: node.x,
          glyph: mapGlyph(node.kind),
          burning: node.burningElite,
          current: pos !== null && pos[0] === node.x && pos[1] === y,
          pickKey: pickAt.get(`${node.x},${y}`) ?? null,
          edges: [...node.edges],
        };
      });
      nodeRows.push(outRow);
    });
  }
  const keysOwned = `${g.run.keys.emerald ? "E" : "-"}${g.run.keys.ruby ? "R" : "-"}${g.run.keys.sapphire ? "S" : "-"}`;
  return {
    kind: "map",
    act: g.run.act,
    bossName: toAscii(bossName),
    bossReachable: bossPick !== undefined,
    bossPickKey: bossPick?.key ?? null,
    hasBossDoor: !act4,
    nodeRows,
    maxY,
    position: pos ? [pos[0], pos[1]] : null,
    picks,
    scroll: ui.mapScroll,
    keysOwned,
    deckCount: g.run.deck.length,
    relicCount: g.run.relics.length,
    seed: g.seed,
  };
}

function buildCombat(g: GameState, ui: UiState, bundle: ContentBundle): CombatView {
  const c = g.combat!;
  const intents = getIntents(g, bundle);
  let targetNo = 0;
  const enemies: EnemyLineView[] = c.monsters.map((m, idx) => {
    const gone = m.isDead ? ("dead" as const) : m.isEscaped ? ("escaped" as const) : null;
    const info = intents[idx] ?? null;
    const powers = m.powers.map((p) => `${bundle.powers.get(p.id)?.name ?? titleCase(p.id)} ${p.amount}`).join(", ");
    return {
      key: gone ? null : (keyFor(targetNo++) ?? null),
      name: toAscii(bundle.monsters.get(m.id)?.name ?? titleCase(m.id)),
      hp: m.hp,
      maxHp: m.maxHp,
      block: m.block,
      intent: gone ? "" : toAscii(intentText(info)),
      move: gone || !info ? null : toAscii(prettyMove(m.id, info.moveId)),
      powers: gone || powers.length === 0 ? null : toAscii(powers),
      gone,
    };
  });

  const p = c.player;
  const focus = playerFocus(p.powers);
  let orbs: string[] | null = null;
  if (p.orbSlots > 0) {
    orbs = [];
    for (let i = 0; i < p.orbSlots; i++) {
      const orb = p.orbs[i];
      if (!orb) {
        orbs.push("( - )");
      } else {
        const val = orbDisplayValue(bundle, orb, focus);
        const short = orbName(bundle, orb.id).slice(0, 1).toUpperCase();
        orbs.push(`(${short}:${val === null ? "?" : val})`);
      }
    }
  }
  const powers = p.powers.map((pw) => `${bundle.powers.get(pw.id)?.name ?? titleCase(pw.id)} ${pw.amount}`).join(", ");
  const hand = c.player.piles.hand.map((iid, i) => {
    const card = c.cards[iid]!;
    const def = bundle.cards.get(card.defId);
    return {
      key: keyFor(i),
      name: toAscii((def?.name ?? titleCase(card.defId)) + (card.upgrades > 0 ? "+" : "")),
      cost: instCostLabel(card),
      type: def?.type ?? "?",
      targeted: def?.target === "enemy",
      playable: isPlayable(card, p.energy),
      rules: toAscii(firstRulesLine(card.defId, card.upgrades)),
    };
  });
  return {
    kind: "combat",
    turn: c.turn,
    enemies,
    you: {
      name: toAscii(bundle.characters.get(g.run.character)?.name ?? titleCase(g.run.character)),
      hp: g.run.hp,
      maxHp: g.run.maxHp,
      block: p.block,
      energy: p.energy,
      energyMax: p.energyPerTurn,
      stance: p.stance !== "NEUTRAL" ? toAscii((bundle.stances.get(p.stance)?.name ?? titleCase(p.stance)).toUpperCase()) : null,
      mantra: p.mantra > 0 ? `${p.mantra}/10` : null,
      powers: powers.length > 0 ? toAscii(powers) : null,
      orbs,
    },
    hand,
    piles: {
      draw: p.piles.draw.length,
      discard: p.piles.discard.length,
      exhaust: p.piles.exhaust.length,
    },
    log: ui.log.slice(-8).map(toAscii),
  };
}

function buildRewards(g: GameState, room: Extract<RoomState, { kind: "rewards" }>, ui: UiState, bundle: ContentBundle): SimpleListScreen {
  const items: RawItem[] = room.entries.map((e, i) => {
    const blocked = rewardBlocked(e, g.run);
    const isCard = e.kind === "card";
    return {
      label:
        (e.kind === "card" || e.kind === "bossRelic" ? (e.kind === "card" ? "Card - " : "Boss relic - ") : "") +
        rewardLabel(e, bundle),
      sub: isCard && !e.taken ? firstRulesLine(e.id, e.upgraded ? 1 : 0) : null,
      enabled: blocked === null,
      note: e.taken ? "taken" : blocked,
      action: cmd({ cmd: "takeReward", i }),
    };
  });
  items.push({
    label: room.source === "boss" ? "Continue - enter the next act" : "Continue",
    action: cmd({ cmd: "skipRewards" }),
  });
  return {
    kind: "rewards",
    title: `REWARDS - ${room.source}`,
    intro: [],
    list: makeList(items, ui.page),
  };
}

function buildShop(g: GameState, room: Extract<RoomState, { kind: "shop" }>, ui: UiState, bundle: ContentBundle): SimpleListScreen {
  const shop = room.shop;
  const gold = g.run.gold;
  const items: RawItem[] = [];
  shop.cards.forEach((slot, idx) => {
    const def = bundle.cards.get(slot.id);
    items.push({
      label: `Card   ${def?.name ?? titleCase(slot.id)} (${def ? masterCostLabel(def.cost) : "?"})  ${slot.price}G`,
      sub: null,
      enabled: !slot.sold,
      note: slot.sold ? "sold" : gold < slot.price ? `need ${slot.price}G` : null,
      action: cmd({ cmd: "shopBuy", kind: "card", idx }),
    });
  });
  shop.relics.forEach((slot, idx) => {
    items.push({
      label: `Relic  ${relicName(bundle, slot.id)} (${slot.tier})  ${slot.price}G`,
      enabled: !slot.sold,
      note: slot.sold ? "sold" : gold < slot.price ? `need ${slot.price}G` : null,
      action: cmd({ cmd: "shopBuy", kind: "relic", idx }),
    });
  });
  shop.potions.forEach((slot, idx) => {
    items.push({
      label: `Potion ${potionName(bundle, slot.id)}  ${slot.price}G`,
      enabled: !slot.sold,
      note: slot.sold ? "sold" : gold < slot.price ? `need ${slot.price}G` : null,
      action: cmd({ cmd: "shopBuy", kind: "potion", idx }),
    });
  });
  items.push({
    label: `Remove a card from your deck  ${shop.removalCost}G`,
    enabled: !shop.removalUsed,
    note: shop.removalUsed ? "used" : gold < shop.removalCost ? `need ${shop.removalCost}G` : null,
    action:
      gold >= shop.removalCost
        ? uiAct({ type: "openOverlay", overlay: { kind: "deck", mode: "remove", page: 0 } })
        : uiAct({ type: "toast", text: "Not enough gold for a removal" }),
  });
  items.push({ label: "Leave the shop", action: cmd({ cmd: "proceed" }) });
  return {
    kind: "shop",
    title: `THE MERCHANT - you have ${gold}G`,
    intro: [],
    list: makeList(items, ui.page),
  };
}

function buildRest(g: GameState, room: Extract<RoomState, { kind: "rest" }>, ui: UiState, bundle: ContentBundle): SimpleListScreen {
  const items: RawItem[] = [];
  const intro: string[] = [];
  if (room.used) {
    intro.push("You have already used this rest site.");
    items.push({ label: "Continue", action: cmd({ cmd: "proceed" }) });
  } else {
    const heal = restHealPreview(g.run);
    const smithable = smithableDeckIndices(g.run, bundle);
    items.push({
      label: `Rest - heal ${heal} HP  (${g.run.hp} -> ${Math.min(g.run.maxHp, g.run.hp + heal)})`,
      action: cmd({ cmd: "restOption", kind: "rest" }),
    });
    items.push({
      label: "Smith - upgrade a card",
      enabled: smithable.length > 0,
      note: smithable.length === 0 ? "nothing to upgrade" : null,
      action: uiAct({ type: "openOverlay", overlay: { kind: "deck", mode: "smith", page: 0 } }),
    });
    if (canRecall(g.run, room.used)) {
      items.push({
        label: "Recall - take the Ruby Key",
        sub: "Uses the rest site - one of three keys needed to reach Act 4",
        action: cmd({ cmd: "restOption", kind: "recall" }),
      });
    }
    items.push({ label: "Leave", action: cmd({ cmd: "proceed" }) });
  }
  return { kind: "rest", title: "REST SITE", intro, list: makeList(items, ui.page) };
}

function buildTreasure(room: Extract<RoomState, { kind: "treasure" }>, ui: UiState): SimpleListScreen {
  const chest = room.chest;
  const intro = [chest.opened ? (ui.lastLoot ?? "Chest opened.") : "Something glints inside..."];
  const items: RawItem[] = [];
  if (!chest.opened) {
    items.push({ label: "Open the chest", action: cmd({ cmd: "openChest" }) });
    if (chest.sapphireKeyAvailable) {
      items.push({
        label: "Take the Sapphire Key",
        sub: "Forfeits the relic inside",
        action: cmd({ cmd: "takeSapphireKey" }),
      });
    }
  } else {
    items.push({ label: "Continue", action: cmd({ cmd: "proceed" }) });
  }
  return { kind: "treasure", title: chestTitle(chest.size).toUpperCase(), intro: intro.map(toAscii), list: makeList(items, ui.page) };
}

function buildEvent(g: GameState, room: Extract<RoomState, { kind: "event" }>, ui: UiState, bundle: ContentBundle): SimpleListScreen {
  const title = eventTitle(bundle, room.eventId).toUpperCase();
  const view = buildEventView(g, bundle);
  if (!view) {
    return {
      kind: "event",
      title: toAscii(title),
      intro: ["The passage is empty. Nothing stirs."],
      list: makeList([{ label: "Leave", action: cmd({ cmd: "eventOption", i: 0 }) }], 0),
    };
  }
  const items: RawItem[] = view.options.map((opt, i) => ({
    label: opt.label,
    enabled: opt.enabled,
    note: opt.enabled ? null : "unavailable",
    action: cmd({ cmd: "eventOption", i }),
  }));
  return {
    kind: "event",
    title: toAscii(title),
    intro: [toAscii(view.summary)],
    list: makeList(items, ui.page),
  };
}

function buildGameOver(g: GameState, room: Extract<RoomState, { kind: "gameOver" }>, ui: UiState, bundle: ContentBundle): SimpleListScreen {
  const name = bundle.characters.get(g.run.character)?.name ?? titleCase(g.run.character);
  const intro = [
    toAscii(gameOverSubtitle(room.victory, g.run.act)),
    "",
    toAscii(`${name} - Ascension ${g.run.ascension}`),
    toAscii(`Floor ${g.run.floor} - Act ${g.run.act}`),
    toAscii(`seed ${g.seed}`),
  ];
  const items: RawItem[] = [
    { label: "New run - same hero, next seed", action: uiAct({ type: "rerun" }) },
    { label: "Back to the menu", action: uiAct({ type: "backToMenu" }) },
  ];
  return {
    kind: "gameOver",
    title: gameOverTitle(room.victory, g.run.act),
    intro,
    list: makeList(items, ui.page),
  };
}

// --- overlays -----------------------------------------------------------------------

function buildChoiceOverlay(g: GameState, pending: PendingChoice, ui: UiState, bundle: ContentBundle): OverlayView {
  const req = pending.request;
  const min = req.kind === "cards" ? req.min : req.kind === "option" ? 1 : 0;
  const max = req.kind === "cards" ? req.max : req.kind === "option" ? 1 : req.iids.length;
  const canCancel = req.kind === "cards" && req.canCancel;
  const title =
    req.kind === "cards"
      ? describeChoiceReason(req.reason)
      : req.kind === "option"
        ? req.reason
        : "Scry - choose cards to discard";
  const constraint = req.kind === "scry" ? "any number" : min === max ? `exactly ${min}` : `${min}-${max}`;
  const single = req.kind === "option" || (min === 1 && max === 1);

  let raw: RawItem[];
  if (req.kind === "option") {
    raw = req.options.map((opt) => ({ label: opt }));
  } else {
    // "custom" pile choices outside combat reference DECK indices (Neow flows);
    // everything else references combat card instance ids.
    const deckMode = !g.combat;
    raw = req.iids.map((iid, i) => {
      let label: string;
      if (deckMode) {
        const mc = g.run.deck[iid];
        const def = mc ? bundle.cards.get(mc.defId) : undefined;
        label = mc
          ? `${cardName(bundle, mc.defId, mc.upgrades)} (${def ? masterCostLabel(masterCardCost(def, mc.upgrades)) : "?"})`
          : `deck #${iid}`;
      } else {
        const card = g.combat?.cards[iid];
        label = card ? `${cardName(bundle, card.defId, card.upgrades)} (${instCostLabel(card)})` : `card #${iid}`;
      }
      if (req.kind === "scry" && i === 0) label += "  (top of draw)";
      return { label };
    });
  }
  return {
    kind: "choice",
    title: toAscii(title),
    constraint,
    list: makeList(raw, ui.choicePage),
    selected: [...ui.choiceSel],
    min,
    max,
    canCancel,
    single,
  };
}

function pileTitle(pile: PileName, count: number): string {
  const note = pile === "draw" ? " (order hidden - sorted)" : "";
  return `${titleCase(pile)} pile - ${count} card${count === 1 ? "" : "s"}${note}`;
}

function buildOverlay(g: GameState, top: Overlay, ui: UiState, bundle: ContentBundle): OverlayView {
  switch (top.kind) {
    case "confirmQuit":
      return { kind: "confirmQuit" };
    case "deck": {
      const deck = g.run.deck;
      const shopRoom = g.run.room?.kind === "shop" ? g.run.room : null;
      const title =
        top.mode === "view"
          ? `Deck - ${deck.length} card${deck.length === 1 ? "" : "s"}`
          : top.mode === "smith"
            ? "SMITH - choose a card to upgrade"
            : `REMOVE - choose a card (${shopRoom?.shop.removalCost ?? "?"} G)`;
      const items: RawItem[] = deck.map((mc, deckIdx) => {
        const def = bundle.cards.get(mc.defId);
        const smithOk = top.mode !== "smith" || canSmithMaster(bundle, mc);
        return {
          label: `${cardName(bundle, mc.defId, mc.upgrades)} (${def ? masterCostLabel(masterCardCost(def, mc.upgrades)) : "?"}) [${def?.type ?? "?"}]`,
          enabled: smithOk,
          note: smithOk ? null : "can't upgrade",
          action:
            top.mode === "smith"
              ? cmd({ cmd: "restOption", kind: "smith", deckIdx })
              : top.mode === "remove"
                ? cmd({ cmd: "shopRemove", deckIdx })
                : uiAct({ type: "openOverlay", overlay: { kind: "inspect", source: "deck", index: deckIdx } }),
        };
      });
      return { kind: "list", id: "deck", title, list: makeList(items, top.page) };
    }
    case "relics": {
      const items: RawItem[] = g.run.relics.map((r) => ({
        label: relicName(bundle, r.defId) + (r.counter > 0 ? `  (${r.counter})` : ""),
        action: null,
      }));
      if (items.length === 0) items.push({ label: "(none)", enabled: false, action: null });
      return { kind: "list", id: "relics", title: `Relics - ${g.run.relics.length}`, list: makeList(items, top.page) };
    }
    case "pile": {
      const c = g.combat;
      const iids = c ? c.player.piles[top.pile] : [];
      let rows = iids.map((iid) => {
        const card = c?.cards[iid];
        const def = card ? bundle.cards.get(card.defId) : undefined;
        return {
          name: card ? (def?.name ?? card.defId) + (card.upgrades > 0 ? "+" : "") : `#${iid}`,
          cost: card ? instCostLabel(card) : "?",
          type: def?.type ?? "?",
        };
      });
      // draw-pile order is hidden information — present it sorted
      if (top.pile === "draw") rows = rows.sort((a, b) => a.name.localeCompare(b.name));
      const items: RawItem[] = rows.map((r) => ({ label: `${r.name} (${r.cost}) [${r.type}]`, action: null }));
      if (items.length === 0) items.push({ label: "(empty)", enabled: false, action: null });
      return { kind: "list", id: "pile", title: pileTitle(top.pile, iids.length), list: makeList(items, top.page) };
    }
    case "potions": {
      const items: RawItem[] = g.run.potions.map((id, slot) => {
        const def = id ? bundle.potions.get(id) : undefined;
        return {
          label: id ? potionName(bundle, id) + (def?.targeted ? "  (throws at a target)" : "") : "(empty slot)",
          enabled: id !== null,
          action: id !== null ? uiAct({ type: "openOverlay", overlay: { kind: "potionMenu", slot } }) : null,
        };
      });
      return {
        kind: "list",
        id: "potions",
        title: `Potions - ${g.run.potions.filter((p) => p !== null).length}/${g.run.potions.length}`,
        list: makeList(items, 0),
      };
    }
    case "potionMenu": {
      const id = g.run.potions[top.slot];
      const def = id ? bundle.potions.get(id) : undefined;
      return {
        kind: "potionMenu",
        slot: top.slot,
        name: id ? toAscii(potionName(bundle, id)) : "(empty)",
        targeted: def?.targeted ?? false,
      };
    }
    case "inspect": {
      if (top.source === "hand" && g.combat) {
        const handIids = g.combat.player.piles.hand;
        const count = handIids.length;
        const index = Math.max(0, Math.min(count - 1, top.index));
        const iid = handIids[index];
        const card = iid !== undefined ? g.combat.cards[iid] : undefined;
        if (!card) return { kind: "inspect", title: "(empty hand)", lines: [], index: 0, count: 0 };
        const def = bundle.cards.get(card.defId);
        const lines = [
          `${def?.type ?? "?"} - ${def?.rarity ?? "?"}${def?.target === "enemy" ? " - targets an enemy" : ""}`,
          "",
          ...cardRulesText(card.defId, card.upgrades).split("\n"),
        ];
        return {
          kind: "inspect",
          title: `${cardName(bundle, card.defId, card.upgrades)} (${instCostLabel(card)})`,
          lines: lines.map(toAscii),
          index,
          count,
        };
      }
      const deck = g.run.deck;
      const count = deck.length;
      const index = Math.max(0, Math.min(count - 1, top.index));
      const mc = deck[index];
      if (!mc) return { kind: "inspect", title: "(empty deck)", lines: [], index: 0, count: 0 };
      const def = bundle.cards.get(mc.defId);
      const lines = [
        `${def?.type ?? "?"} - ${def?.rarity ?? "?"}`,
        "",
        ...cardRulesText(mc.defId, mc.upgrades).split("\n"),
      ];
      return {
        kind: "inspect",
        title: `${cardName(bundle, mc.defId, mc.upgrades)} (${def ? masterCostLabel(masterCardCost(def, mc.upgrades)) : "?"})`,
        lines: lines.map(toAscii),
        index,
        count,
      };
    }
  }
}

// --- targeting -----------------------------------------------------------------------

function buildTargeting(g: GameState, ui: UiState, bundle: ContentBundle): TargetingView | null {
  const t = ui.targeting;
  if (!t || !g.combat) return null;
  let what: string;
  if (t.kind === "card") {
    const iid = g.combat.player.piles.hand[t.handIdx];
    const card = iid !== undefined ? g.combat.cards[iid] : undefined;
    what = card ? cardName(bundle, card.defId, card.upgrades) : "the card";
  } else {
    const id = g.run.potions[t.slot];
    what = id ? potionName(bundle, id) : "the potion";
  }
  let no = 0;
  const targets = g.combat.monsters
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => !m.isDead && !m.isEscaped)
    .map(({ m, idx }) => ({
      key: keyFor(no++) ?? "?",
      name: toAscii(bundle.monsters.get(m.id)?.name ?? titleCase(m.id)),
      action:
        t.kind === "card"
          ? cmd({ cmd: "playCard", handIdx: t.handIdx, target: idx })
          : cmd({ cmd: "usePotion", slot: t.slot, target: idx }),
    }));
  return { prompt: toAscii(`Choose a target for ${what}`), targets };
}

// --- hints ------------------------------------------------------------------------------

function hintFor(mode: ViewMode, view: { screen: ScreenView; overlay: OverlayView | null }): string {
  switch (mode) {
    case "menu": {
      const m = view.screen as MenuView;
      return `[1-4] hero  [a/A] ascension  [s] seed  [n] new run${m.continueDesc ? "  [c] continue" : ""}  [q] quit`;
    }
    case "textInput":
      return "type a seed - [Enter] confirm  [Esc] cancel";
    case "targeting":
      return "[1-9] choose a target  [Esc] cancel";
    case "choice": {
      const o = view.overlay;
      if (o?.kind !== "choice") return "";
      const paging = o.list.pages > 1 ? "  [n/p] page" : "";
      if (o.single) return `[1-9] pick${paging}${o.canCancel ? "  [Esc] cancel" : ""}`;
      return `[1-0] toggle  [Enter] confirm${paging}${o.canCancel ? "  [Esc] cancel" : ""}`;
    }
    case "overlay": {
      const o = view.overlay;
      if (!o) return "";
      if (o.kind === "confirmQuit") return "[y] quit  [n] keep playing";
      if (o.kind === "potionMenu") return "[u] use  [d] discard  [Esc] cancel";
      if (o.kind === "inspect") return "[j/k] next/prev card  [Esc] close";
      const paging = o.kind === "list" && o.list.pages > 1 ? "  [n/p] page" : "";
      if (o.kind === "list" && o.id === "deck") return `[1-0] select${paging}  [Esc] close`;
      if (o.kind === "list" && o.id === "potions") return `[1-9] potion${paging}  [Esc] close`;
      return `${paging.trim().length > 0 ? paging.trim() + "  " : ""}[Esc] close`;
    }
    case "combat":
      return "[1-0] play  [e] end turn  [i] inspect  [w/x/z] draw/disc/exh  [d/r/p] deck/relics/potions  [q] quit";
    case "map":
      return "[1-9] travel  [j/k] scroll  [d/r/p] deck/relics/potions  [Esc] menu  [q] quit";
    case "neow":
      return "[1-4] choose a blessing  [d] deck  [r] relics  [q] quit";
    case "rewards":
      return "[1-9] take  [Enter] continue  [d/r/p] deck/relics/potions  [q] quit";
    case "shop": {
      const s = view.screen as SimpleListScreen;
      const paging = s.list.pages > 1 ? "  [n/p] page" : "";
      return `[1-0] buy${paging}  [Enter] leave  [d/r/p]  [q] quit`;
    }
    case "rest":
    case "treasure":
    case "event": {
      const s = view.screen as SimpleListScreen;
      const paging = s.list.pages > 1 ? "  [n/p] page" : "";
      return `[1-9] choose${paging}  [d/r/p] deck/relics/potions  [q] quit`;
    }
    case "gameOver":
      return "[1] new run  [2] menu  [q] quit";
  }
}

// --- entry ---------------------------------------------------------------------------

export function buildView(game: GameState | null, ui: UiState, bundle: ContentBundle): View {
  // menu (no game or explicitly on the menu screen)
  const room = game?.run.room ?? null;
  if (ui.screen === "menu" || !game || !room) {
    const screen = buildMenu(ui, bundle);
    const mode: ViewMode = ui.seedEdit ? "textInput" : "menu";
    return {
      mode,
      header: null,
      screen,
      overlay: null,
      targeting: null,
      toast: ui.toast != null ? toAscii(ui.toast) : null,
      log: [],
      hint: hintFor(mode, { screen, overlay: null }),
    };
  }

  const header = buildHeader(game, bundle);
  let screen: ScreenView;
  switch (room.kind) {
    case "neow":
      screen = buildNeow(room, ui);
      break;
    case "map":
      screen = buildMap(game, ui, bundle);
      break;
    case "combat":
      screen = buildCombat(game, ui, bundle);
      break;
    case "rewards":
      screen = buildRewards(game, room, ui, bundle);
      break;
    case "shop":
      screen = buildShop(game, room, ui, bundle);
      break;
    case "rest":
      screen = buildRest(game, room, ui, bundle);
      break;
    case "treasure":
      screen = buildTreasure(room, ui);
      break;
    case "event":
      screen = buildEvent(game, room, ui, bundle);
      break;
    case "gameOver":
      screen = buildGameOver(game, room, ui, bundle);
      break;
  }

  // input precedence: overlay-top > pending choice > targeting > room kind
  const top = ui.overlays[ui.overlays.length - 1];
  let overlay: OverlayView | null = null;
  let targeting: TargetingView | null = null;
  let mode: ViewMode;
  if (top) {
    overlay = buildOverlay(game, top, ui, bundle);
    mode = "overlay";
  } else if (game.pending) {
    overlay = buildChoiceOverlay(game, game.pending, ui, bundle);
    mode = "choice";
  } else if (ui.targeting) {
    targeting = buildTargeting(game, ui, bundle);
    mode = targeting ? "targeting" : (room.kind as ViewMode);
  } else {
    mode = room.kind as ViewMode;
  }

  return {
    mode,
    header,
    screen,
    overlay,
    targeting,
    toast: ui.toast != null ? toAscii(ui.toast) : null,
    log: ui.log.slice(-8).map(toAscii),
    hint: hintFor(mode, { screen, overlay }),
  };
}
