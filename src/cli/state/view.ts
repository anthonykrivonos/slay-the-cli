// buildView: GameState + UiState -> render-ready View. This is the ONLY layer
// that consults the ContentBundle (names, rules text, intents, event screens,
// legality). Renderers and the keymap consume the View exclusively, which
// keeps them pure, snapshot-testable, and ignorant of game internals.

import type { GameState, Command } from "../../engine/game";
import type { RoomState, RewardEntry } from "../../engine/run/runState";
import type { CardInstance, CombatState } from "../../engine/combat/combatState";
import type { CardDef, ContentBundle } from "../../engine/content/defs";
import type { PendingChoice } from "../../engine/core/actions";
import { getIntents, type IntentInfo, type IntentPower } from "../../engine/combat/intents";
import { peekRelicFromPool } from "../../engine/run/rewards";
import { getCardPreviews, previewCardAt, type CardPreview } from "../../engine/combat/preview";
import {
  titleCase,
  isCharacterId,
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
  stanceColor,
  restHealPreview,
  canRecall,
  rewardLabel,
  rewardBlocked,
  rewardRows,
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
import { cardRulesText, cardGlossary } from "../text/cardtext";
import { relicText, relicLines, relicGlossary } from "../text/relictext";
import { potionText, potionLines, potionGlossary } from "../text/potiontext";
import { powerText } from "../text/powertext";
import type { Keyword } from "../text/keywords";
import { CARD_TYPE_ACCENTS } from "../text/runlogic";
import { toAscii } from "../text/ascii";
import type { UiState, Overlay, PileName, InspectSource } from "./uiState";
import { currentEraStart } from "./uiState";
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
  /** one entry per potion slot, in slot order; null = empty */
  potions: ({ name: string; letter: string } | null)[];
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
  /** absolute index (i) of the focus-cursor item, or null (no cursor) */
  focusI: number | null;
}

export interface MenuView {
  kind: "menu";
  seed: string;
  seedEdit: string | null;
  ascension: number;
  ascensionLabel: string;
  characters: { key: string; id: string; name: string; maxHp: number; relic: string; selected: boolean }[];
  continueDesc: string | null;
  /** one-line "a newer version exists" notice, or null when current */
  updateNotice: string | null;
  /** resolved focus index of the SETTINGS row (it moves with CONTINUE), so the
   *  keymap and the renderer never recompute the ordinals themselves */
  settingsIdx: number;
  /** focus cursor: 0-3 heroes, 4 NEW RUN, then CONTINUE (when there is a save)
   *  and SETTINGS at settingsIdx; null = no cursor */
  focusIdx: number | null;
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
  /** global run floor (the header shows it too; the legend gauge uses it) */
  floor: number;
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
  /** picks[] index under the selection cursor, or null */
  focusPick: number | null;
}

export interface PowerChipView {
  name: string;
  amount: number;
  kind: "buff" | "debuff";
}

/** One spelled-out piece of an intent: "v Weak 2", "^ Str +3", "+2 Burn". */
export interface IntentPartView {
  text: string;
  kind: "attack" | "block" | "buff" | "debuff" | "cards" | "other";
}

export interface IntentView {
  /** raw MonsterMoveDef intent category */
  kind: string;
  damage: number | null;
  hits: number;
  block: number;
  /** damage x hits, when it hits more than once (null otherwise) */
  total: number | null;
  /** e.g. "/! 11 x2", "/! 9 [+5]", "[+5]", "^^", "vv", "zz", "**", "<<", "()", "??" */
  glyph: string;
  /** coloring bucket for renderers */
  color: "attack" | "block" | "buff" | "debuff" | "other";
  /** what the move does besides its glyph: the buff, the debuff, the statuses */
  parts: IntentPartView[];
  /** the preview knows what the move does FIRST but not all of it */
  partial: boolean;
}

export interface EnemyPanelView {
  key: string | null; // targeting number for alive enemies
  /** monster id, for the ASCII portrait and its tint */
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  intent: IntentView | null;
  move: string | null;
  powers: PowerChipView[];
  gone: "dead" | "escaped" | null;
}

export interface OrbView {
  id: string;
  /** one-letter tag inside the chip: L/F/D/P; "-" when empty */
  letter: string;
  name: string;
  value: number | null;
  empty: boolean;
}

export interface CombatView {
  kind: "combat";
  turn: number;
  enemies: EnemyPanelView[];
  you: {
    /** character id, for the ASCII portrait in the player panel */
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    block: number;
    energy: number;
    energyMax: number;
    stance: string | null;
    stanceColor: string | null;
    mantra: number | null;
    powers: PowerChipView[];
    orbs: OrbView[] | null;
  };
  hand: {
    key: string | null;
    name: string;
    cost: string;
    /** card type: keys CARD_TYPE_ACCENTS and the A/S/P letter */
    type: string;
    rarity: string;
    targeted: boolean;
    playable: boolean;
    /** full rules text, split into lines */
    rules: string[];
    /** what the card would really do right now ("9 dmg", "3 blk"), with the
     *  tone saying whether powers pushed it up or down. null = nothing to show */
    preview: { text: string; tone: "up" | "down" | "flat" } | null;
  }[];
  /** the two numbers that decide a turn, for the readout above your panel */
  threat: { incoming: number; block: number };
  piles: { draw: number; discard: number; exhaust: number };
  relics: { name: string; abbrev: string; counter: number }[];
  potions: ({ name: string; letter: string } | null)[];
  log: string[];
  /** hand index holding the hover focus (render highlight), or null */
  focusHand: number | null;
  /** enemies[] index holding the hover focus, or null */
  focusEnemy: number | null;
  /** potion slot holding the hover focus, or null: Enter uses that potion */
  focusPotionSlot: number | null;
}

export interface SimpleListScreen {
  kind: "neow" | "rest" | "treasure" | "event";
  title: string;
  /** body lines above the list (event summary, chest text...) */
  intro: string[];
  list: ListView;
}

export interface ShopCardView {
  /** absolute list index (hotkeys mirror list.items) */
  i: number;
  name: string;
  cost: string;
  /** card type, keying CARD_TYPE_ACCENTS */
  cardType: string;
  rules: string[];
  price: number;
  sold: boolean;
  affordable: boolean;
}

export interface ShopRowView {
  i: number;
  name: string;
  /** relic tier or potion rarity */
  tier: string;
  price: number;
  sold: boolean;
  affordable: boolean;
  /** corpus effect text */
  text: string;
}

export interface ShopView {
  kind: "shop";
  title: string;
  gold: number;
  cards: ShopCardView[];
  relics: ShopRowView[];
  potions: ShopRowView[];
  removal: { i: number; price: number; used: boolean; affordable: boolean };
  leave: { i: number };
  list: ListView;
}

export type RewardRowView =
  | {
      type: "single";
      i: number;
      icon: string;
      label: string;
      /** corpus effect text for a relic/potion reward (null for gold/keys) */
      text: string | null;
      enabled: boolean;
      note: string | null;
    }
  | {
      type: "group";
      kind: "card" | "bossRelic";
      title: string;
      items: { i: number; name: string; cost: string; cardType: string; rules: string[]; enabled: boolean; note: string | null }[];
    };

export interface RewardsView {
  kind: "rewards";
  title: string;
  rows: RewardRowView[];
  /** absolute list index of the Continue action */
  continueI: number;
  list: ListView;
}

export interface GameOverView {
  kind: "gameOver";
  /** VICTORY / DEFEAT / THE HEART FALLS */
  title: string;
  victory: boolean;
  subtitle: string;
  /** hero + ascension / floor + act / seed */
  stats: string[];
  list: ListView;
}

export type ScreenView = MenuView | MapView | CombatView | SimpleListScreen | ShopView | RewardsView | GameOverView;

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
  | { kind: "list"; id: "deck" | "relics" | "pile" | "potions" | "settings"; title: string; list: ListView }
  | { kind: "potionMenu"; slot: number; name: string; targeted: boolean }
  | {
      kind: "inspect";
      /** which collection is being paged through */
      source: InspectSource;
      chip: "CARD" | "RELIC" | "POTION";
      name: string;
      /** printed energy cost; null for relics and potions (no cost corner) */
      cost: string | null;
      /** hex accent for the name */
      color: string;
      /** "Attack - basic" / "Relic - boss" / "Potion - rare" */
      type: string;
      targeted: boolean;
      rules: string[];
      /** short definitions for the keywords the rules text names */
      keywords: Keyword[];
      /** what Enter does here: the thing's own list action (take the reward,
       *  buy the shop item, open the potion menu). A card in hand is the one
       *  exception - playing it needs the keymap's energy/targeting ladder. */
      enter: KeyAction | null;
      index: number;
      count: number;
    }
  | { kind: "log"; title: string; lines: string[]; currentFrom: number }
  | { kind: "confirmQuit" };

export interface TargetingView {
  prompt: string;
  /** damage: what the card would deal to THAT target (Vulnerable lives on the
   *  target, so this is the number you are choosing between) */
  targets: { key: string; name: string; damage: number | null; action: KeyAction }[];
  /** auto-focused candidate target (always set while targeting) */
  focusIdx: number;
}

/** Bottom info-panel content for whatever holds the hover/selection focus. */
export interface TooltipView {
  /** kind chip: CARD / RELIC / POTION / ENEMY / NODE / CHOICE / HERO ... */
  chip: string;
  /** hex accent for the chip */
  color: string;
  name: string;
  meta: string;
  lines: string[];
}

export interface View {
  mode: ViewMode;
  /** highlight color for focus/selection chrome: the current character's
   *  accent (the selected hero on the menu), so the cursor always wears the
   *  color of whoever is being played. */
  accent: string;
  header: HeaderView | null;
  screen: ScreenView;
  overlay: OverlayView | null;
  targeting: TargetingView | null;
  toast: string | null;
  log: string[];
  hint: string;
  /** info panel for the focused thing (null = default browse hint) */
  tooltip: TooltipView | null;
  /** what [i] would open right now (null = nothing here to inspect). The
   *  view resolves this so the keymap never has to index items itself. */
  inspect: { source: InspectSource; index: number } | null;
  /** how many focusables the current mode exposes (for Tab/arrow cycling) */
  focusCount: number;
  /** resolved focus index within the current mode's focusables */
  focusIdx: number | null;
  /** hjkl are movement keys right now: the keymap translates them to arrows
   *  before dispatch, and the hint bar prints whichever keys that leaves. */
  vimKeys: boolean;
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

/** Slice a full item list to one page. When a focus cursor is given, the
 *  page auto-follows it (arrow selection scrolls through page boundaries). */
function makeList(all: RawItem[], page: number, focusI: number | null = null): ListView {
  const pages = Math.max(1, Math.ceil(all.length / LIST_PAGE_SIZE));
  const fI = focusI !== null && all.length > 0 ? Math.max(0, Math.min(focusI, all.length - 1)) : null;
  const p = fI !== null ? Math.floor(fI / LIST_PAGE_SIZE) : Math.max(0, Math.min(page, pages - 1));
  const items = all.slice(p * LIST_PAGE_SIZE, p * LIST_PAGE_SIZE + LIST_PAGE_SIZE).map((it, k) => ({
    key: keyFor(k),
    i: p * LIST_PAGE_SIZE + k,
    label: toAscii(it.label),
    sub: it.sub != null ? toAscii(it.sub) : null,
    enabled: it.enabled ?? true,
    note: it.note != null ? toAscii(it.note) : null,
    action: it.action ?? null,
  }));
  return { items, page: p, pages, total: all.length, focusI: fI };
}

/** ASCII printed cost for a live card instance. */
function instCostLabel(card: CardInstance): string {
  if (card.cost === -1) return "X";
  if (card.cost === -2) return "-";
  return String(card.costForTurn);
}

function masterCostLabel(cost: number): string {
  return costText(cost);
}

function prettyMove(monsterId: string, moveId: string): string {
  const stripped = moveId.startsWith(`${monsterId}_`) ? moveId.slice(monsterId.length + 1) : moveId;
  return titleCase(stripped);
}

const INTENT_GLYPHS: Record<string, string> = {
  buff: "^^",
  debuff: "v",
  strongDebuff: "vv",
  sleep: "zz",
  stun: "**",
  escape: "<<",
  magic: "()",
  unknown: "??",
  defend: "[+?]",
  defendBuff: "[+?]^",
  defendDebuff: "[+?]v",
  attackBuff: "/! ?",
  attackDebuff: "/! ?",
  attackDefend: "/! ?",
  attack: "/! ?",
};

/** Shortened power names, so an intent chip fits a narrow panel. */
const SHORT_POWER: Record<string, string> = {
  STRENGTH: "Str",
  DEXTERITY: "Dex",
  VULNERABLE: "Vuln",
  ARTIFACT: "Artifact",
  PLATED_ARMOR: "Plate",
  DRAW_REDUCTION: "Draw",
  METALLICIZE: "Metal",
  REGENERATE: "Regen",
  THORNS: "Thorns",
  RITUAL: "Ritual",
  CURL_UP: "Curl Up",
  ANGRY: "Angry",
};

function shortPowerName(bundle: ContentBundle, id: string): string {
  return SHORT_POWER[id] ?? bundle.powers.get(id)?.name ?? titleCase(id);
}

/** Signed amount, so a drained stat reads as the loss it is. */
function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/**
 * The chips that spell out an intent beyond its glyph: what the buff is, which
 * debuff is coming, how many statuses land in your deck. Ordered by how much
 * they change your turn.
 */
function intentParts(bundle: ContentBundle, info: IntentInfo): IntentPartView[] {
  const parts: IntentPartView[] = [];
  for (const p of info.powers) {
    const name = shortPowerName(bundle, p.powerId);
    if (p.target === "you") {
      // a debuff applied reads as its size; something taken away reads as a
      // minus, whether that is a drained stat or cards off your draw
      const drain = p.amount < 0 || p.powerId === "DRAW_REDUCTION";
      parts.push({ text: `v ${name} ${drain ? `-${Math.abs(p.amount)}` : p.amount}`, kind: "debuff" });
    } else if (p.target === "self") {
      parts.push({ text: `^ ${name} ${signed(p.amount)}`, kind: "buff" });
    } else {
      parts.push({ text: `^ ally ${name} ${signed(p.amount)}`, kind: "buff" });
    }
  }
  for (const c of info.cards) {
    const name = toAscii(bundle.cards.get(c.defId)?.name ?? titleCase(c.defId));
    parts.push({ text: `+${c.n} ${name}`, kind: "cards" });
  }
  if (info.hpLoss > 0) parts.push({ text: `-${info.hpLoss} HP`, kind: "debuff" });
  if (info.allyBlock > 0) parts.push({ text: `ally [+${info.allyBlock}]`, kind: "block" });
  if (info.heal > 0) parts.push({ text: `heals ${info.heal}`, kind: "buff" });
  if (info.summons.length > 0) {
    const names = info.summons.map((id) => toAscii(bundle.monsters.get(id)?.name ?? titleCase(id)));
    parts.push({ text: `summons ${names.join(", ")}`, kind: "other" });
  }
  return parts;
}

/** StS-style intent mark: `/! 11 x2` attack, `[+5]` defend, `^^` buff... */
function buildIntentView(bundle: ContentBundle, info: IntentInfo | null): IntentView | null {
  if (!info) return null;
  const parts = intentParts(bundle, info);
  let glyph: string;
  let color: IntentView["color"];
  if (info.damage !== null) {
    glyph = `/! ${info.damage}${info.hits > 1 ? ` x${info.hits}` : ""}${info.block > 0 ? ` [+${info.block}]` : ""}`;
    color = "attack";
  } else if (info.block > 0) {
    glyph = `[+${info.block}]`;
    color = "block";
  } else if (parts.length > 0) {
    // A move with nothing to hit or block for says what it does instead of
    // wearing a category mark: "v Weak 2" beats "v" followed by "v Weak 2".
    const lead = parts.shift()!;
    glyph = lead.text;
    color = lead.kind === "buff" ? "buff" : lead.kind === "block" ? "block" : lead.kind === "other" ? "other" : "debuff";
  } else {
    glyph = INTENT_GLYPHS[info.kind] ?? "??";
    color = info.kind.startsWith("defend") ? "block" : "other";
  }
  return {
    kind: info.kind,
    damage: info.damage,
    hits: info.hits,
    block: info.block,
    // the number that actually matters when a move hits several times
    total: info.damage !== null && info.hits > 1 ? info.damage * info.hits : null,
    glyph,
    color,
    parts,
    partial: info.partial,
  };
}

/**
 * The card's real numbers as one short line ("9 dmg", "9 dmg x2", "3 blk",
 * "9 dmg / 5 blk"), with the tone set by comparing against the printed value:
 * up when a power raised it, down when Weak or Frail cut it.
 */
function handPreview(
  def: CardDef | undefined,
  upgrades: number,
  pv: CardPreview | null,
): { text: string; tone: "up" | "down" | "flat" } | null {
  if (!pv) return null;
  const printed = (k: "damage" | "block"): number | undefined =>
    upgrades > 0 && def?.upgradeValues[k] !== undefined ? def.upgradeValues[k] : def?.values[k];
  const parts: string[] = [];
  let tone: "up" | "down" | "flat" = "flat";
  const compare = (got: number, base: number | undefined): void => {
    if (base === undefined || tone !== "flat") return;
    tone = got > base ? "up" : got < base ? "down" : "flat";
  };
  if (pv.damage !== null) {
    parts.push(`${pv.damage} dmg${pv.hits > 1 ? ` x${pv.hits}` : ""}`);
    compare(pv.damage, printed("damage"));
  }
  if (pv.block > 0) {
    parts.push(`${pv.block} blk`);
    compare(pv.block, printed("block"));
  }
  if (parts.length === 0) return null;
  return { text: parts.join(" / "), tone };
}

/** The enemy the hover cursor points at, if it points at one. The combat
 *  focus order is hand -> living enemies -> relics -> potions (see below). */
function cursorEnemyIdx(c: CombatState, handCount: number, screenFocus: number | null): number | null {
  if (screenFocus === null) return null;
  const alive: number[] = [];
  c.monsters.forEach((m, idx) => {
    if (!m.isDead && !m.isEscaped) alive.push(idx);
  });
  const k = screenFocus - handCount;
  return k >= 0 && k < alive.length ? (alive[k] ?? null) : null;
}

/** Total damage aimed at you this turn, over every living attacker. */
function incomingDamage(intents: (IntentInfo | null)[], monsters: { isDead: boolean; isEscaped: boolean }[]): number {
  let total = 0;
  intents.forEach((info, idx) => {
    const m = monsters[idx];
    if (!info || !m || m.isDead || m.isEscaped || info.damage === null) return;
    total += info.damage * Math.max(1, info.hits);
  });
  return total;
}

const ORB_LETTERS: Record<string, string> = {
  LIGHTNING: "L",
  FROST: "F",
  DARK: "D",
  PLASMA: "P",
};

function powerChips(bundle: ContentBundle, powers: { id: string; amount: number }[]): PowerChipView[] {
  return powers.map((p) => ({
    name: toAscii(bundle.powers.get(p.id)?.name ?? titleCase(p.id)),
    amount: p.amount,
    kind: bundle.powers.get(p.id)?.kind ?? "buff",
  }));
}

/** Alphabetic 3-letter tag for the relic strip. */
function relicAbbrev(name: string): string {
  return name.replace(/[^A-Za-z]/g, "").slice(0, 3);
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

/** Potion slot label shared by the header cell and the combat strip. */
function potionSlotView(bundle: ContentBundle, id: string): { name: string; letter: string } {
  const name = potionName(bundle, id);
  return { name: toAscii(name), letter: name.slice(0, 1).toUpperCase() };
}

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
    potions: run.potions.map((id) => (id === null ? null : potionSlotView(bundle, id))),
    deckCount: run.deck.length,
    relicCount: run.relics.length,
    seed: g.seed,
  };
}

// --- per-screen view builders ------------------------------------------------------

/** Menu focusables: 4 heroes, NEW RUN, CONTINUE (when present), SETTINGS. */
export function menuFocusCount(hasContinue: boolean): number {
  return 6 + (hasContinue ? 1 : 0);
}

/** Where the SETTINGS row sits. It goes last so the hero and NEW RUN ordinals
 *  never move, and CONTINUE keeps index 5 whenever it is there. */
export function menuSettingsIdx(hasContinue: boolean): number {
  return hasContinue ? 6 : 5;
}

/** The update line, in the game's voice. null when current or unknown. */
function updateNoticeText(update: { behind: number } | null): string | null {
  if (update === null || update.behind <= 0) return null;
  const n = update.behind;
  return `The Spire has shifted: ${n} commit${n === 1 ? "" : "s"} ahead. Run: slay --update`;
}

function buildMenu(ui: UiState, bundle: ContentBundle, focusI: number | null): MenuView {
  const continueDesc = ui.menuSave ? toAscii(ui.menuSave.desc) : null;
  const count = menuFocusCount(continueDesc !== null);
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
    continueDesc,
    updateNotice: updateNoticeText(ui.update),
    settingsIdx: menuSettingsIdx(continueDesc !== null),
    focusIdx: focusI !== null ? Math.min(focusI, count - 1) : null,
  };
}

function buildNeow(room: Extract<RoomState, { kind: "neow" }>, page: number, focusI: number | null): SimpleListScreen {
  const items: RawItem[] = room.options.map((opt, i) => ({
    label: neowBonusText(opt.bonus),
    sub: opt.drawback !== "NONE" ? `! ${neowDrawbackText(opt.drawback)}` : null,
    action: cmd({ cmd: "neowPick", i }),
  }));
  return {
    kind: "neow",
    title: "NEOW'S BLESSING - choose one",
    intro: [],
    list: makeList(items, page, focusI),
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
  const rawFocus = ui.focus && ui.focus.scope === "map" ? ui.focus.idx : null;
  return {
    kind: "map",
    act: g.run.act,
    floor: g.run.floor,
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
    focusPick: rawFocus !== null && picks.length > 0 ? Math.min(rawFocus, picks.length - 1) : null,
  };
}

function buildCombat(g: GameState, ui: UiState, bundle: ContentBundle, screenFocus: number | null): CombatView {
  const c = g.combat!;
  const intents = getIntents(g, bundle);
  let targetNo = 0;
  const enemies: EnemyPanelView[] = c.monsters.map((m, idx) => {
    const gone = m.isDead ? ("dead" as const) : m.isEscaped ? ("escaped" as const) : null;
    const info = intents[idx] ?? null;
    return {
      key: gone ? null : (keyFor(targetNo++) ?? null),
      id: m.id,
      name: toAscii(bundle.monsters.get(m.id)?.name ?? titleCase(m.id)),
      hp: m.hp,
      maxHp: m.maxHp,
      block: m.block,
      intent: gone ? null : buildIntentView(bundle, info),
      move: gone || !info ? null : toAscii(prettyMove(m.id, info.moveId)),
      powers: gone ? [] : powerChips(bundle, m.powers),
      gone,
    };
  });

  const p = c.player;
  const focus = playerFocus(p.powers);
  let orbs: OrbView[] | null = null;
  if (p.orbSlots > 0) {
    orbs = [];
    for (let i = 0; i < p.orbSlots; i++) {
      const orb = p.orbs[i];
      if (!orb) {
        orbs.push({ id: "", letter: "-", name: "(empty)", value: null, empty: true });
      } else {
        orbs.push({
          id: orb.id,
          letter: ORB_LETTERS[orb.id] ?? orbName(bundle, orb.id).slice(0, 1).toUpperCase(),
          name: toAscii(orbName(bundle, orb.id)),
          value: orbDisplayValue(bundle, orb, focus),
          empty: false,
        });
      }
    }
  }
  // previews aim at the enemy under the cursor when there is one, else at the
  // first living target - the same monster a click would hit by default
  const firstAlive = c.monsters.findIndex((m) => !m.isDead && !m.isEscaped);
  const cursorEnemy = cursorEnemyIdx(c, c.player.piles.hand.length, screenFocus);
  const previewTarget = cursorEnemy ?? (firstAlive === -1 ? 0 : firstAlive);
  const previews = getCardPreviews(g, bundle, previewTarget);
  const hand = c.player.piles.hand.map((iid, i) => {
    const card = c.cards[iid]!;
    const def = bundle.cards.get(card.defId);
    return {
      key: keyFor(i),
      name: toAscii((def?.name ?? titleCase(card.defId)) + (card.upgrades > 0 ? "+" : "")),
      cost: instCostLabel(card),
      type: def?.type ?? "?",
      rarity: def?.rarity ?? "?",
      targeted: def?.target === "enemy",
      playable: isPlayable(card, p.energy),
      rules: cardRulesText(card.defId, card.upgrades)
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map(toAscii),
      preview: handPreview(def, card.upgrades, previews[i] ?? null),
    };
  });

  // Resolve the hover focus onto the thing it points at. The enumeration order
  // is hand -> alive enemies -> relics -> potions -> orbs -> stance, and it has
  // to match combatFocus, which builds the tooltip from the same cursor.
  let focusHand: number | null = null;
  let focusEnemy: number | null = null;
  let focusPotionSlot: number | null = null;
  if (screenFocus !== null) {
    const aliveIdx: number[] = [];
    c.monsters.forEach((m, idx) => {
      if (!m.isDead && !m.isEscaped) aliveIdx.push(idx);
    });
    const potionSlots = g.run.potions.map((id, slot) => ({ id, slot })).filter((p) => p.id !== null);
    let k = screenFocus;
    if (k < hand.length) {
      focusHand = k;
    } else if ((k -= hand.length) < aliveIdx.length) {
      focusEnemy = aliveIdx[k]!;
    } else if ((k -= aliveIdx.length) < g.run.relics.length) {
      // relics do nothing when you press Enter on them; they are already doing it
    } else if ((k -= g.run.relics.length) < potionSlots.length) {
      focusPotionSlot = potionSlots[k]!.slot;
    }
  }

  return {
    kind: "combat",
    turn: c.turn,
    enemies,
    threat: { incoming: incomingDamage(intents, c.monsters), block: p.block },
    you: {
      id: g.run.character,
      name: toAscii(bundle.characters.get(g.run.character)?.name ?? titleCase(g.run.character)),
      hp: g.run.hp,
      maxHp: g.run.maxHp,
      block: p.block,
      energy: p.energy,
      energyMax: p.energyPerTurn,
      stance: p.stance !== "NEUTRAL" ? toAscii((bundle.stances.get(p.stance)?.name ?? titleCase(p.stance)).toUpperCase()) : null,
      stanceColor: p.stance !== "NEUTRAL" ? stanceColor(p.stance) : null,
      mantra: p.mantra > 0 ? p.mantra : null,
      powers: powerChips(bundle, p.powers),
      orbs,
    },
    hand,
    piles: {
      draw: p.piles.draw.length,
      discard: p.piles.discard.length,
      exhaust: p.piles.exhaust.length,
    },
    relics: g.run.relics.map((r) => {
      const name = toAscii(relicName(bundle, r.defId));
      return { name, abbrev: relicAbbrev(name), counter: r.counter };
    }),
    potions: g.run.potions.map((id) => (id === null ? null : potionSlotView(bundle, id))),
    // only the fight you are in: the era stamp keeps the previous combat out
    log: ui.log.filter((l) => l.era === ui.logEra).slice(-8).map((l) => toAscii(l.text)),
    focusHand,
    focusEnemy,
    focusPotionSlot,
  };
}

const REWARD_ICONS: Record<string, string> = {
  gold: "($)",
  potion: "(!)",
  relic: "(*)",
  emeraldKey: "(K)",
};

function buildRewards(g: GameState, room: Extract<RoomState, { kind: "rewards" }>, page: number, focusI: number | null, bundle: ContentBundle): RewardsView {
  const items: RawItem[] = room.entries.map((e, i) => {
    const blocked = rewardBlocked(e, g.run);
    const isCard = e.kind === "card";
    return {
      // the icon and the grouping already say what a row is, so the label is
      // just the thing's name, the way the game lists its spoils
      label: rewardLabel(e, bundle),
      sub: isCard && !e.taken ? firstRulesLine(e.id, e.upgraded ? 1 : 0) : null,
      enabled: blocked === null,
      note: e.taken ? "taken" : blocked,
      action: cmd({ cmd: "takeReward", i }),
    };
  });
  items.push({
    label: room.source === "boss" ? "Continue to the next act" : "Continue",
    action: cmd({ cmd: "skipRewards" }),
  });

  const rows: RewardRowView[] = rewardRows(room.entries).map((row) => {
    if (row.type === "single") {
      const e = row.entry;
      const blocked = rewardBlocked(e, g.run);
      return {
        type: "single" as const,
        i: row.idx,
        icon: REWARD_ICONS[e.kind] ?? "( )",
        label: toAscii(rewardLabel(e, bundle)),
        text:
          e.kind === "relic"
            ? relicText(e.id) || null
            : e.kind === "potion"
              ? potionText(e.id, sacredBark(g)) || null
              : null,
        enabled: blocked === null,
        note: e.taken ? "taken" : blocked !== null ? toAscii(blocked) : null,
      };
    }
    return {
      type: "group" as const,
      kind: row.kind,
      title: row.kind === "card" ? "Choose one card:" : "Choose one boss relic:",
      items: row.items.map(({ idx, entry }) => {
        const blocked = rewardBlocked(entry, g.run);
        const up = entry.kind === "card" && entry.upgraded ? 1 : 0;
        const def = entry.kind === "card" ? bundle.cards.get(entry.id) : undefined;
        return {
          i: idx,
          name: toAscii(rewardLabel(entry, bundle)),
          cost: entry.kind === "card" && def ? masterCostLabel(masterCardCost(def, up)) : "",
          cardType: entry.kind === "card" ? (def?.type ?? "?") : "relic",
          rules:
            entry.kind === "card"
              ? cardRulesText(entry.id, up)
                  .split("\n")
                  .filter((l) => l.trim().length > 0)
                  .map(toAscii)
              : entry.kind === "bossRelic"
                ? [relicText(entry.id)].filter((l) => l.length > 0)
                : [],
          enabled: blocked === null,
          note: entry.taken ? "taken" : blocked !== null ? toAscii(blocked) : null,
        };
      }),
    };
  });

  return {
    kind: "rewards",
    // the game says enemy, not monster
    title: `SPOILS OF BATTLE - ${room.source === "monster" ? "enemy" : room.source}`,
    rows,
    continueI: room.entries.length,
    list: makeList(items, page, focusI),
  };
}

function buildShop(g: GameState, room: Extract<RoomState, { kind: "shop" }>, page: number, focusI: number | null, bundle: ContentBundle): ShopView {
  const shop = room.shop;
  const gold = g.run.gold;
  const items: RawItem[] = [];
  const cards: ShopCardView[] = [];
  const relics: ShopRowView[] = [];
  const potions: ShopRowView[] = [];
  shop.cards.forEach((slot, idx) => {
    const def = bundle.cards.get(slot.id);
    items.push({
      label: `Card   ${def?.name ?? titleCase(slot.id)} (${def ? masterCostLabel(def.cost) : "?"})  ${slot.price}G`,
      sub: null,
      enabled: !slot.sold,
      note: slot.sold ? "sold" : gold < slot.price ? `need ${slot.price}G` : null,
      action: cmd({ cmd: "shopBuy", kind: "card", idx }),
    });
    cards.push({
      i: items.length - 1,
      name: toAscii(def?.name ?? titleCase(slot.id)),
      cost: def ? masterCostLabel(def.cost) : "?",
      cardType: def?.type ?? "?",
      rules: cardRulesText(slot.id, 0)
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map(toAscii),
      price: slot.price,
      sold: slot.sold,
      affordable: gold >= slot.price,
    });
  });
  shop.relics.forEach((slot, idx) => {
    items.push({
      label: `Relic  ${relicName(bundle, slot.id)} (${slot.tier})  ${slot.price}G`,
      enabled: !slot.sold,
      note: slot.sold ? "sold" : gold < slot.price ? `need ${slot.price}G` : null,
      action: cmd({ cmd: "shopBuy", kind: "relic", idx }),
    });
    relics.push({
      i: items.length - 1,
      name: toAscii(relicName(bundle, slot.id)),
      tier: slot.tier,
      price: slot.price,
      sold: slot.sold,
      affordable: gold >= slot.price,
      text: relicText(slot.id),
    });
  });
  shop.potions.forEach((slot, idx) => {
    items.push({
      label: `Potion ${potionName(bundle, slot.id)}  ${slot.price}G`,
      enabled: !slot.sold,
      note: slot.sold ? "sold" : gold < slot.price ? `need ${slot.price}G` : null,
      action: cmd({ cmd: "shopBuy", kind: "potion", idx }),
    });
    potions.push({
      i: items.length - 1,
      name: toAscii(potionName(bundle, slot.id)),
      tier: bundle.potions.get(slot.id)?.rarity ?? "?",
      price: slot.price,
      sold: slot.sold,
      affordable: gold >= slot.price,
      text: potionText(slot.id, sacredBark(g)),
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
  const removal = {
    i: items.length - 1,
    price: shop.removalCost,
    used: shop.removalUsed,
    affordable: gold >= shop.removalCost,
  };
  items.push({ label: "Leave the shop", action: cmd({ cmd: "proceed" }) });
  return {
    kind: "shop",
    title: `THE MERCHANT - you have ${gold}G`,
    gold,
    cards,
    relics,
    potions,
    removal,
    leave: { i: items.length - 1 },
    list: makeList(items, page, focusI),
  };
}

function buildRest(g: GameState, room: Extract<RoomState, { kind: "rest" }>, page: number, focusI: number | null, bundle: ContentBundle): SimpleListScreen {
  const items: RawItem[] = [];
  const intro: string[] = [];
  if (room.used) {
    intro.push("You have already used this rest site.");
    items.push({ label: "Continue", action: cmd({ cmd: "proceed" }) });
  } else {
    const heal = restHealPreview(g.run);
    const smithable = smithableDeckIndices(g.run, bundle);
    // the game names these in one word, with the detail underneath
    // subs stay short: at 80 columns a button box has 13 usable characters
    items.push({
      label: "Rest",
      sub: `Heal ${heal} HP`,
      action: cmd({ cmd: "restOption", kind: "rest" }),
    });
    items.push({
      label: "Smith",
      sub: "Upgrade a card",
      enabled: smithable.length > 0,
      note: smithable.length === 0 ? "nothing to upgrade" : null,
      action: uiAct({ type: "openOverlay", overlay: { kind: "deck", mode: "smith", page: 0 } }),
    });
    if (canRecall(g.run, room.used)) {
      items.push({
        label: "Recall",
        sub: "Take the Ruby Key",
        action: cmd({ cmd: "restOption", kind: "recall" }),
      });
    }
    items.push({ label: "Leave", action: cmd({ cmd: "proceed" }) });
  }
  return { kind: "rest", title: "REST SITE", intro, list: makeList(items, page, focusI) };
}

function buildTreasure(
  g: GameState,
  room: Extract<RoomState, { kind: "treasure" }>,
  ui: UiState,
  page: number,
  focusI: number | null,
  bundle: ContentBundle,
): SimpleListScreen {
  const chest = room.chest;
  // The relic is decided at setup (the pools are shuffled at run start), so the
  // chest can show what is in it before you trade it for the key. DEVIATION:
  // the real game reveals on opening, one click later; the information is the
  // same, and choosing the key blind was worse.
  const relic = chest.opened ? null : toAscii(relicName(bundle, peekRelicFromPool(g.run, chest.relicTier)));
  const intro = [chest.opened ? (ui.lastLoot ?? "Chest opened.") : `Inside: ${relic}`];
  const items: RawItem[] = [];
  if (!chest.opened) {
    items.push({ label: "Open the chest", action: cmd({ cmd: "openChest" }) });
    if (chest.sapphireKeyAvailable) {
      items.push({
        label: "Take the Sapphire Key",
        sub: `Forfeits ${relic}`,
        action: cmd({ cmd: "takeSapphireKey" }),
      });
    }
  } else {
    items.push({ label: "Continue", action: cmd({ cmd: "proceed" }) });
  }
  return { kind: "treasure", title: chestTitle(chest.size).toUpperCase(), intro: intro.map(toAscii), list: makeList(items, page, focusI) };
}

function buildEvent(g: GameState, room: Extract<RoomState, { kind: "event" }>, page: number, focusI: number | null, bundle: ContentBundle): SimpleListScreen {
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
    list: makeList(items, page, focusI),
  };
}

function buildGameOver(g: GameState, room: Extract<RoomState, { kind: "gameOver" }>, page: number, focusI: number | null, bundle: ContentBundle): GameOverView {
  const name = bundle.characters.get(g.run.character)?.name ?? titleCase(g.run.character);
  const items: RawItem[] = [
    { label: "Climb again", sub: "Same hero, next seed", action: uiAct({ type: "rerun" }) },
    { label: "Back to the menu", action: uiAct({ type: "backToMenu" }) },
  ];
  return {
    kind: "gameOver",
    title: gameOverTitle(room.victory, g.run.act),
    victory: room.victory,
    subtitle: toAscii(gameOverSubtitle(room.victory, g.run.act)),
    stats: [
      toAscii(`${name} - Ascension ${g.run.ascension}`),
      toAscii(`Floor ${g.run.floor} - Act ${g.run.act}`),
      toAscii(`seed ${g.seed}`),
    ],
    list: makeList(items, page, focusI),
  };
}

// --- overlays -----------------------------------------------------------------------

function buildChoiceOverlay(g: GameState, pending: PendingChoice, ui: UiState, focusI: number | null, bundle: ContentBundle): OverlayView {
  const req = pending.request;
  const min = req.kind === "cards" ? req.min : req.kind === "option" ? 1 : 0;
  const max = req.kind === "cards" ? req.max : req.kind === "option" ? 1 : req.iids.length;
  const canCancel = req.kind === "cards" && req.canCancel;
  const title =
    req.kind === "cards"
      ? describeChoiceReason(req.reason)
      : req.kind === "option"
        ? req.reason
        : "Choose cards to discard";
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
    list: makeList(raw, ui.choicePage, focusI),
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

/** Cards of a combat pile in DISPLAY order (draw pile sorted by name: its
 *  real order is hidden information). Shared by the overlay list builder and
 *  the focus tooltip so the two can never disagree on ordering. */
function pileEntries(g: GameState, pile: PileName): { iid: number; card: CardInstance }[] {
  const c = g.combat;
  if (!c) return [];
  const out: { iid: number; card: CardInstance }[] = [];
  for (const iid of c.player.piles[pile]) {
    const card = c.cards[iid];
    if (card) out.push({ iid, card });
  }
  return out;
}

// --- inspectables ---------------------------------------------------------------------
//
// One resolver for "every card, relic and potion this place is showing", in
// the same order the cursor walks them. The focus code and the inspect
// overlay both index into it, so the two can never disagree about which item
// index 3 is - the class of bug that used to make [i] on the rewards screen
// open the wrong card once one had been taken.

/** Sacred Bark doubles potion potency, and the corpus writes potion text as
 *  [base|doubled], so every potion string has to know whether it is held. */
function sacredBark(g: GameState): boolean {
  return g.run.relics.some((r) => r.defId === "SACRED_BARK");
}

interface InspectBase {
  /** index within the source's own addressing (deck slot, reward entry,
   *  potion slot, list index...) so callers can map a cursor onto a ref */
  at: number;
  /** what Enter does on this item, or null when there is nothing to do */
  enter: KeyAction | null;
}

/** Enter in the inspector has to behave exactly like Enter on the thing's own
 *  row, refusal included: a sold shop slot or a reward you cannot take says so
 *  instead of firing the command. Mirrors selectItem in input/keymap.ts. */
function enterOr(blocked: string | null, action: KeyAction): KeyAction {
  return blocked === null ? action : uiAct({ type: "toast", text: toAscii(blocked) });
}

type InspectRef =
  | (InspectBase & { kind: "card"; defId: string; upgrades: number; cost: string })
  | (InspectBase & { kind: "relic"; defId: string })
  | (InspectBase & { kind: "potion"; defId: string });

function masterCard(bundle: ContentBundle, defId: string, upgrades: number, at: number): InspectRef {
  const def = bundle.cards.get(defId);
  return {
    kind: "card",
    at,
    enter: null,
    defId,
    upgrades,
    cost: def ? masterCostLabel(masterCardCost(def, upgrades)) : "?",
  };
}

/** Everything inspectable in `source`, in cursor order. */
function inspectables(g: GameState, source: InspectSource, bundle: ContentBundle): InspectRef[] {
  switch (source.of) {
    case "hand": {
      const c = g.combat;
      if (!c) return [];
      return c.player.piles.hand.flatMap((iid, at) => {
        const card = c.cards[iid];
        return card ? [{ kind: "card" as const, at, enter: null, defId: card.defId, upgrades: card.upgrades, cost: instCostLabel(card) }] : [];
      });
    }
    case "deck":
      return g.run.deck.map((mc, at) => masterCard(bundle, mc.defId, mc.upgrades, at));
    case "pile":
      return pileEntries(g, source.pile).map(({ card }, at) => ({
        kind: "card" as const,
        at,
        enter: null,
        defId: card.defId,
        upgrades: card.upgrades,
        cost: instCostLabel(card),
      }));
    case "relics":
      return g.run.relics.map((r, at) => ({ kind: "relic" as const, at, enter: null, defId: r.defId }));
    case "potions":
      return g.run.potions.flatMap((id, slot) =>
        id === null
          ? []
          : [
              {
                kind: "potion" as const,
                at: slot,
                enter: uiAct({ type: "openOverlay", overlay: { kind: "potionMenu", slot } }),
                defId: id,
              },
            ],
      );
    case "reward": {
      const room = g.run.room;
      if (room?.kind !== "rewards") return [];
      return room.entries.flatMap((e, at) => {
        // same note the row shows, so the refusal reads the same either way
        const blocked = e.taken ? "taken" : rewardBlocked(e, g.run);
        const enter = enterOr(blocked, cmd({ cmd: "takeReward", i: at }));
        if (e.kind === "card") {
          const up = e.upgraded ? 1 : 0;
          return [{ ...masterCard(bundle, e.id, up, at), enter }];
        }
        if (e.kind === "relic" || e.kind === "bossRelic") return [{ kind: "relic" as const, at, enter, defId: e.id }];
        if (e.kind === "potion") return [{ kind: "potion" as const, at, enter, defId: e.id }];
        return []; // gold and keys have nothing to read
      });
    }
    case "shop": {
      const room = g.run.room;
      if (room?.kind !== "shop") return [];
      const shop = room.shop;
      // the same order buildShop pushes them, so `at` IS the list index
      const out: InspectRef[] = [];
      const buy = (kind: "card" | "relic" | "potion", idx: number, sold: boolean): KeyAction =>
        enterOr(sold ? "sold" : null, cmd({ cmd: "shopBuy", kind, idx }));
      shop.cards.forEach((slot, idx) => {
        out.push({ ...masterCard(bundle, slot.id, 0, out.length), enter: buy("card", idx, slot.sold) });
      });
      shop.relics.forEach((slot, idx) => {
        out.push({ kind: "relic", at: out.length, enter: buy("relic", idx, slot.sold), defId: slot.id });
      });
      shop.potions.forEach((slot, idx) => {
        out.push({ kind: "potion", at: out.length, enter: buy("potion", idx, slot.sold), defId: slot.id });
      });
      return out;
    }
    case "choice": {
      const req = g.pending?.request;
      if (!req || req.kind === "option") return [];
      const c = g.combat;
      return req.iids.flatMap((iid, at) => {
        if (!c) {
          const mc = g.run.deck[iid];
          return mc ? [masterCard(bundle, mc.defId, mc.upgrades, at)] : [];
        }
        const card = c.cards[iid];
        return card ? [{ kind: "card" as const, at, enter: null, defId: card.defId, upgrades: card.upgrades, cost: instCostLabel(card) }] : [];
      });
    }
  }
}

/** The inspect target for a cursor sitting at `at` within `source`. Falls
 *  back to the first item, which is what [i] with no cursor should open. */
function inspectAt(g: GameState, source: InspectSource, bundle: ContentBundle, at: number | null): { source: InspectSource; index: number } | null {
  const refs = inspectables(g, source, bundle);
  if (refs.length === 0) return null;
  const index = at === null ? 0 : refs.findIndex((r) => r.at === at);
  return { source, index: index < 0 ? 0 : index };
}

/** One inspected item, rendered as the big box in render/overlays.ts. */
function describeInspect(
  g: GameState,
  source: InspectSource,
  ref: InspectRef,
  index: number,
  count: number,
  bundle: ContentBundle,
): OverlayView {
  const common = { kind: "inspect" as const, source, enter: ref.enter, index, count };
  if (ref.kind === "relic") {
    const def = bundle.relics.get(ref.defId);
    return {
      ...common,
      chip: "RELIC",
      name: toAscii(relicName(bundle, ref.defId)),
      cost: null,
      color: TIP_COLOR.relic,
      type: `Relic - ${def?.tier ?? "?"}`,
      targeted: false,
      rules: relicLines(ref.defId),
      keywords: relicGlossary(ref.defId),
    };
  }
  if (ref.kind === "potion") {
    const def = bundle.potions.get(ref.defId);
    const doubled = sacredBark(g);
    return {
      ...common,
      chip: "POTION",
      name: toAscii(potionName(bundle, ref.defId)),
      cost: null,
      color: TIP_COLOR.potion,
      type: `Potion - ${def?.rarity ?? "?"}`,
      targeted: def?.targeted ?? false,
      rules: potionLines(ref.defId, doubled),
      keywords: potionGlossary(ref.defId, doubled),
    };
  }
  const def = bundle.cards.get(ref.defId);
  return {
    ...common,
    chip: "CARD",
    name: toAscii(cardName(bundle, ref.defId, ref.upgrades)),
    cost: ref.cost,
    color: CARD_TYPE_ACCENTS[def?.type ?? ""] ?? TIP_COLOR.card,
    type: `${titleCase(def?.type ?? "?")} - ${def?.rarity ?? "?"}`,
    targeted: def?.target === "enemy",
    rules: cardRulesText(ref.defId, ref.upgrades)
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map(toAscii),
    keywords: cardGlossary(ref.defId, ref.upgrades),
  };
}

/** The settings overlay. It is the one overlay that opens without a run, so it
 *  is built from UiState alone and both buildView branches can reach it. Rows
 *  are ordinary list items, which is what makes the existing list renderer and
 *  the keymap's paged-list tail work on it unchanged. */
function buildSettingsOverlay(ui: UiState, focusI: number | null): Extract<OverlayView, { kind: "list" }> {
  const items: RawItem[] = [
    {
      label: `Vim keys  ${ui.vimKeys ? "[x]" : "[ ]"}`,
      sub: "hjkl move the cursor; the log moves to [L]",
      action: uiAct({ type: "toggleVimKeys" }),
    },
  ];
  // the cursor starts on the first row so Enter toggles straight away
  return { kind: "list", id: "settings", title: "SETTINGS", list: makeList(items, 0, focusI ?? 0) };
}

/** Focus + tooltip for the settings overlay, without a GameState (overlayFocus
 *  needs one, and the menu has none). */
function settingsFocus(o: Extract<OverlayView, { kind: "list" }>, accent: string): FocusInfo {
  const idx = o.list.focusI;
  return {
    count: o.list.total,
    idx,
    tooltip: idx !== null ? tipChoiceItem(o.list, idx, accent) : null,
  };
}

function buildOverlay(g: GameState, top: Overlay, ui: UiState, focusI: number | null, bundle: ContentBundle): OverlayView {
  switch (top.kind) {
    case "confirmQuit":
      return { kind: "confirmQuit" };
    case "settings":
      return buildSettingsOverlay(ui, focusI);
    case "log": {
      const shown = ui.log.slice(-100);
      return {
        kind: "log",
        title: `Combat log - ${ui.log.length} entr${ui.log.length === 1 ? "y" : "ies"}`,
        lines: shown.map((l) => toAscii(l.text)),
        // everything above this belongs to an earlier fight (rendered dim)
        currentFrom: Math.max(0, currentEraStart(ui) - (ui.log.length - shown.length)),
      };
    }
    case "deck": {
      const deck = g.run.deck;
      const shopRoom = g.run.room?.kind === "shop" ? g.run.room : null;
      const title =
        top.mode === "view"
          ? `Deck - ${deck.length} card${deck.length === 1 ? "" : "s"}`
          : top.mode === "smith"
            ? "UPGRADE A CARD"
            : `REMOVE A CARD (${shopRoom?.shop.removalCost ?? "?"} G)`;
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
                : uiAct({ type: "openOverlay", overlay: { kind: "inspect", source: { of: "deck" }, index: deckIdx } }),
        };
      });
      return { kind: "list", id: "deck", title, list: makeList(items, top.page, focusI) };
    }
    case "relics": {
      const items: RawItem[] = g.run.relics.map((r) => ({
        label: relicName(bundle, r.defId) + (r.counter > 0 ? `  (${r.counter})` : ""),
        sub: relicText(r.defId) || null,
        action: null,
      }));
      if (items.length === 0) items.push({ label: "(none)", enabled: false, action: null });
      return { kind: "list", id: "relics", title: `Relics - ${g.run.relics.length}`, list: makeList(items, top.page, focusI) };
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
      // draw-pile order is hidden information - present it sorted
      if (top.pile === "draw") rows = rows.sort((a, b) => a.name.localeCompare(b.name));
      const items: RawItem[] = rows.map((r) => ({ label: `${r.name} (${r.cost}) [${r.type}]`, action: null }));
      if (items.length === 0) items.push({ label: "(empty)", enabled: false, action: null });
      return { kind: "list", id: "pile", title: pileTitle(top.pile, iids.length), list: makeList(items, top.page, focusI) };
    }
    case "potions": {
      const items: RawItem[] = g.run.potions.map((id, slot) => {
        const def = id ? bundle.potions.get(id) : undefined;
        return {
          label: id ? potionName(bundle, id) + (def?.targeted ? "  (throws at a target)" : "") : "(empty slot)",
          sub: id ? potionText(id, sacredBark(g)) || null : null,
          enabled: id !== null,
          action: id !== null ? uiAct({ type: "openOverlay", overlay: { kind: "potionMenu", slot } }) : null,
        };
      });
      return {
        kind: "list",
        id: "potions",
        title: `Potions - ${g.run.potions.filter((p) => p !== null).length}/${g.run.potions.length}`,
        list: makeList(items, 0, focusI),
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
      const refs = inspectables(g, top.source, bundle);
      const count = refs.length;
      const index = Math.max(0, Math.min(count - 1, top.index));
      const ref = refs[index];
      if (!ref) {
        // the collection emptied under the overlay (last reward taken, last
        // potion drunk); show an honest placeholder rather than crashing
        return {
          kind: "inspect",
          source: top.source,
          chip: "CARD",
          name: "(nothing here)",
          cost: null,
          color: TIP_COLOR.card,
          type: "",
          targeted: false,
          rules: [],
          keywords: [],
          enter: null,
          index: 0,
          count: 0,
        };
      }
      return describeInspect(g, top.source, ref, index, count, bundle);
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
  // the card is aimed but not yet committed: price every candidate, so Vulnerable
  // and Weak are visible in the choice itself
  const iid = t.kind === "card" ? g.combat.player.piles.hand[t.handIdx] : undefined;
  const damageAt = (idx: number): number | null => {
    if (iid === undefined) return null;
    const pv = previewCardAt(g, bundle, iid, idx);
    return pv?.damage ?? null;
  };
  const targets = g.combat.monsters
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => !m.isDead && !m.isEscaped)
    .map(({ m, idx }) => ({
      key: keyFor(no++) ?? "?",
      name: toAscii(bundle.monsters.get(m.id)?.name ?? titleCase(m.id)),
      damage: damageAt(idx),
      action:
        t.kind === "card"
          ? cmd({ cmd: "playCard", handIdx: t.handIdx, target: idx })
          : cmd({ cmd: "usePotion", slot: t.slot, target: idx }),
    }));
  const raw = ui.focus && ui.focus.scope === "targeting" ? ui.focus.idx : 0;
  const focusIdx = targets.length > 0 ? Math.max(0, Math.min(raw, targets.length - 1)) : 0;
  return { prompt: toAscii(`Choose a target for ${what}`), targets, focusIdx };
}

// --- focus + tooltip -------------------------------------------------------------
//
// The read-only hover/selection focus: Tab and the arrow keys move a pointer
// through the current mode's focusables; the bottom info panel explains the
// pointed-at thing; Enter activates it on menu-like screens. Enumeration
// order here mirrors the order the builders above emit - list screens use
// the absolute list index directly.

const TIP_COLOR = {
  card: "#c9d0e0",
  relic: "#ffe9a0",
  potion: "#6fce87",
  enemy: "#e06a7a",
  node: "#6fce87",
  choice: "#ffd75e",
  gold: "#ffe9a0",
} as const;

const TIP_KEYWORDS = new Set(["exhaust", "ethereal", "innate", "retain", "selfRetain"]);

function tipCard(bundle: ContentBundle, defId: string, upgrades: number, costLabel: string, metaExtra = ""): TooltipView {
  const def = bundle.cards.get(defId);
  const lines = cardRulesText(defId, upgrades)
    .split("\n")
    .filter((l) => l.trim().length > 0);
  const kws = (upgrades > 0 && def?.upgradeKeywords ? def.upgradeKeywords : (def?.keywords ?? []))
    .filter((k) => TIP_KEYWORDS.has(k))
    .map((k) => (k === "selfRetain" ? "Retain" : titleCase(k)));
  const joined = lines.join(" ").toLowerCase();
  const missing = kws.filter((k) => !joined.includes(k.toLowerCase()));
  if (missing.length > 0) lines.push(missing.map((k) => `${k}.`).join(" "));
  return {
    chip: "CARD",
    color: CARD_TYPE_ACCENTS[def?.type ?? ""] ?? TIP_COLOR.card,
    name: toAscii(`${cardName(bundle, defId, upgrades)} (${costLabel})`),
    meta: toAscii(
      `${titleCase(def?.type ?? "?")} - ${def?.rarity ?? "?"}${def?.target === "enemy" ? " - targets an enemy" : ""}${metaExtra}`,
    ),
    lines: lines.map(toAscii),
  };
}

function tipRelic(bundle: ContentBundle, defId: string, metaExtra = ""): TooltipView {
  const tier = bundle.relics.get(defId)?.tier ?? "?";
  return {
    chip: "RELIC",
    color: TIP_COLOR.relic,
    name: toAscii(relicName(bundle, defId)),
    meta: toAscii(`Relic - ${tier}${metaExtra}`),
    lines: relicLines(defId),
  };
}

function tipPotion(bundle: ContentBundle, defId: string, doubled: boolean, metaExtra = ""): TooltipView {
  const def = bundle.potions.get(defId);
  return {
    chip: "POTION",
    color: TIP_COLOR.potion,
    name: toAscii(potionName(bundle, defId)),
    meta: toAscii(`Potion - ${def?.rarity ?? "?"}${def?.targeted ? " - throws at a target" : ""}${metaExtra}`),
    lines: potionLines(defId, doubled),
  };
}

const INTENT_SENTENCES: Record<string, string> = {
  buff: "intends to buff itself",
  debuff: "intends to debuff you",
  strongDebuff: "intends to debuff you hard",
  sleep: "is sleeping",
  stun: "is stunned",
  escape: "intends to flee",
  magic: "is casting something",
  unknown: "intent unknown",
  defend: "intends to defend",
  defendBuff: "intends to defend and buff",
  defendDebuff: "intends to defend and debuff you",
};

/** "a", "a and b", "a, b and c" */
function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]!}`;
}

/** Full sentences for the INFO panel: everything the move is about to do. */
function intentSentence(bundle: ContentBundle, monsterId: string, info: IntentInfo | null): string {
  if (!info) return "Intent unknown.";
  const move = prettyMove(monsterId, info.moveId);
  const clauses: string[] = [];
  if (info.damage !== null) {
    clauses.push(
      info.hits > 1
        ? `attack for ${info.damage} x ${info.hits} (${info.damage * info.hits} in total)`
        : `attack for ${info.damage}`,
    );
  }
  // Group by what happens to whom and share the verb, so a triple debuff reads
  // as one clause and Block joins whatever else the move gains.
  const named = (p: IntentPower): string =>
    `${Math.abs(p.amount)} ${bundle.powers.get(p.powerId)?.name ?? titleCase(p.powerId)}`;
  const bucket = (pred: (p: IntentPower) => boolean): string[] => info.powers.filter(pred).map(named);
  const apply = bucket((p) => p.target === "you" && p.amount > 0);
  const drain = bucket((p) => p.target === "you" && p.amount < 0);
  const gain = [...(info.block > 0 ? [`${info.block} Block`] : []), ...bucket((p) => p.target === "self" && p.amount > 0)];
  const lose = bucket((p) => p.target === "self" && p.amount < 0);
  const ally = [...(info.allyBlock > 0 ? [`${info.allyBlock} Block`] : []), ...bucket((p) => p.target === "ally")];
  if (apply.length > 0) clauses.push(`apply ${listWords(apply)} to you`);
  if (drain.length > 0) clauses.push(`drain ${listWords(drain)} from you`);
  if (gain.length > 0) clauses.push(`gain ${listWords(gain)}`);
  if (lose.length > 0) clauses.push(`lose ${listWords(lose)}`);
  if (ally.length > 0) clauses.push(`give an ally ${listWords(ally)}`);
  for (const c of info.cards) {
    const name = bundle.cards.get(c.defId)?.name ?? titleCase(c.defId);
    clauses.push(`put ${c.n} ${name} in your ${c.dest} pile`);
  }
  if (info.heal > 0) clauses.push(`heal ${info.heal} HP`);
  if (info.hpLoss > 0) clauses.push(`take ${info.hpLoss} HP from you`);
  if (info.summons.length > 0) {
    const names = info.summons.map((id) => bundle.monsters.get(id)?.name ?? titleCase(id));
    clauses.push(`summon ${names.join(" and ")}`);
  }
  if (clauses.length === 0) return `${move}: ${INTENT_SENTENCES[info.kind] ?? titleCase(info.kind)}.`;
  // a preview that stopped early says so rather than pretending to be the lot
  return `${move}: intends to ${listWords(clauses)}${info.partial ? ", and more it will not show" : ""}.`;
}

function tipEnemy(
  bundle: ContentBundle,
  m: { id: string; hp: number; maxHp: number; block: number; powers: { id: string; amount: number }[] },
  info: IntentInfo | null,
): TooltipView {
  const lines = [intentSentence(bundle, m.id, info)];
  for (const p of m.powers) {
    const name = bundle.powers.get(p.id)?.name ?? titleCase(p.id);
    const desc = powerText(p.id, p.amount);
    lines.push(desc.length > 0 ? `${name} ${p.amount}: ${desc}` : `${name} ${p.amount}`);
  }
  return {
    chip: "ENEMY",
    color: TIP_COLOR.enemy,
    name: toAscii(bundle.monsters.get(m.id)?.name ?? titleCase(m.id)),
    meta: toAscii(`HP ${m.hp}/${m.maxHp}${m.block > 0 ? ` - Block ${m.block}` : ""}`),
    lines: lines.map(toAscii),
  };
}

const NODE_INFO: Record<string, [string, string]> = {
  monster: ["Enemy", "A standard combat. Victory pays gold and offers a card."],
  elite: ["Elite", "A dangerous fight. Drops a relic on top of the usual spoils."],
  shop: ["Merchant", "Buy cards, relics and potions, or pay to remove a card."],
  rest: ["Rest Site", "Rest to heal 30% of max HP, or smith to upgrade a card."],
  treasure: ["Treasure", "A chest holding a free relic."],
  unknown: ["Unknown", "Could be an event, a fight, a shop, or treasure."],
  event: ["Unknown", "Could be an event, a fight, a shop, or treasure."],
  boss: ["Boss", "The act boss. Beat it to climb higher."],
};

function tipNode(kind: string, burning: boolean, key: string): TooltipView {
  const [name, desc] = NODE_INFO[kind] ?? [titleCase(kind), ""];
  return {
    chip: "NODE",
    color: TIP_COLOR.node,
    name,
    meta: `travel with [${key}]`,
    lines: [burning ? `${desc} This one burns, and it drops the Emerald Key.` : desc],
  };
}

function tipChoiceItem(list: ListView, idx: number, accent: string): TooltipView | null {
  const item = list.items.find((it) => it.i === idx);
  if (!item) return null;
  return {
    chip: "CHOICE",
    color: accent,
    name: item.label,
    meta: item.note !== null ? `(${item.note})` : "",
    lines: item.sub !== null ? [item.sub] : [],
  };
}

interface FocusInfo {
  count: number;
  idx: number | null;
  tooltip: TooltipView | null;
  /** what [i] opens from this cursor position; omitted when the focused
   *  thing has no rules text of its own (an enemy, a map node, a button) */
  inspect?: { source: InspectSource; index: number } | null;
}

const NO_FOCUS: FocusInfo = { count: 0, idx: null, tooltip: null };

function menuFocus(ui: UiState, bundle: ContentBundle, screen: MenuView): FocusInfo {
  const count = menuFocusCount(screen.continueDesc !== null);
  const idx = screen.focusIdx;
  if (idx === null) return { count, idx: null, tooltip: null };
  if (idx < 4) {
    const ch = screen.characters[idx]!;
    const def = isCharacterId(ch.id) ? bundle.characters.get(ch.id) : undefined;
    const relicId = def?.startingRelic;
    const lines = [`Starts with ${ch.relic}.`];
    if (relicId !== undefined) {
      const t = relicText(relicId);
      if (t.length > 0) lines.push(t);
    }
    return {
      count,
      idx,
      tooltip: {
        chip: "HERO",
        color: CHARACTER_COLORS[ch.id] ?? "#54689a",
        name: ch.name,
        meta: `${ch.maxHp} max HP`,
        lines,
      },
    };
  }
  if (idx === 4) {
    return {
      count,
      idx,
      tooltip: {
        chip: "CHOICE",
        color: CHARACTER_COLORS[ui.character] ?? TIP_COLOR.choice,
        name: "NEW RUN",
        meta: "",
        lines: ["Begin a fresh climb with the selected hero, ascension and seed."],
      },
    };
  }
  if (idx === screen.settingsIdx) {
    return {
      count,
      idx,
      tooltip: {
        chip: "CHOICE",
        color: CHARACTER_COLORS[ui.character] ?? TIP_COLOR.choice,
        name: "SETTINGS",
        meta: "",
        lines: ["Vim keys, and anything else worth remembering between runs."],
      },
    };
  }
  return {
    count,
    idx,
    tooltip: {
      chip: "CHOICE",
      color: CHARACTER_COLORS[ui.character] ?? TIP_COLOR.choice,
      name: "CONTINUE",
      meta: "",
      lines: [screen.continueDesc ?? ""],
    },
  };
}

// phrased the way the game phrases them
const STANCE_TIPS: Record<string, string> = {
  CALM: "Serenity. Gain 2 Energy when you exit Calm.",
  WRATH: "Fury. Deal double damage. Receive double damage.",
  DIVINITY: "Transcendence. Deal triple damage. Exit Divinity at the end of your turn.",
};

function combatFocus(g: GameState, ui: UiState, bundle: ContentBundle, accent: string): FocusInfo {
  const c = g.combat;
  if (!c) return NO_FOCUS;
  const hand = c.player.piles.hand;
  const alive = c.monsters.map((m, i) => ({ m, i })).filter(({ m }) => !m.isDead && !m.isEscaped);
  const relics = g.run.relics;
  const potions = g.run.potions.map((id, slot) => ({ id, slot })).filter((p) => p.id !== null);
  const orbs = c.player.orbs.filter((o) => o != null);
  const stances = c.player.stance !== "NEUTRAL" ? 1 : 0;
  const count = hand.length + alive.length + relics.length + potions.length + orbs.length + stances;
  const raw = ui.focus && ui.focus.scope === "combat" ? ui.focus.idx : null;
  if (raw === null || count === 0) return { count, idx: null, tooltip: null };
  let k = Math.min(raw, count - 1);
  const idx = k;
  if (k < hand.length) {
    const card = c.cards[hand[k]!]!;
    return {
      count,
      idx,
      tooltip: tipCard(bundle, card.defId, card.upgrades, instCostLabel(card)),
      inspect: inspectAt(g, { of: "hand" }, bundle, k),
    };
  }
  k -= hand.length;
  if (k < alive.length) {
    const { m, i } = alive[k]!;
    const info = getIntents(g, bundle)[i] ?? null;
    return { count, idx, tooltip: tipEnemy(bundle, m, info) };
  }
  k -= alive.length;
  if (k < relics.length) {
    const r = relics[k]!;
    return {
      count,
      idx,
      tooltip: tipRelic(bundle, r.defId, r.counter > 0 ? ` - counter ${r.counter}` : ""),
      inspect: inspectAt(g, { of: "relics" }, bundle, k),
    };
  }
  k -= relics.length;
  if (k < potions.length) {
    const p = potions[k]!;
    return {
      count,
      idx,
      tooltip: tipPotion(bundle, p.id!, sacredBark(g), ` - slot ${p.slot + 1}`),
      inspect: inspectAt(g, { of: "potions" }, bundle, p.slot),
    };
  }
  k -= potions.length;
  if (k < orbs.length) {
    const orb = orbs[k]!;
    const def = bundle.orbs.get(orb.id);
    const focus = playerFocus(c.player.powers);
    const val = orbDisplayValue(bundle, orb, focus);
    const lines: string[] = [];
    if (def) {
      lines.push(
        orb.id === "DARK"
          ? `Passive: grows each turn. Evoke: deal ${orb.amount} damage.`
          : `Passive ${val ?? def.passiveBase} - Evoke ${def.evokeBase}${def.usesFocus ? " (Focus applies)" : ""}.`,
      );
    }
    return {
      count,
      idx,
      tooltip: {
        chip: "ORB",
        color: accent,
        name: toAscii(orbName(bundle, orb.id)),
        meta: val !== null ? `value ${val}` : "",
        lines,
      },
    };
  }
  const st = c.player.stance;
  return {
    count,
    idx,
    tooltip: {
      chip: "STANCE",
      color: stanceColor(st),
      name: toAscii((bundle.stances.get(st)?.name ?? titleCase(st)).toUpperCase()),
      meta: "stance",
      lines: [STANCE_TIPS[st] ?? ""],
    },
  };
}

function targetingFocus(g: GameState, bundle: ContentBundle, targeting: TargetingView): FocusInfo {
  const alive = g.combat
    ? g.combat.monsters.map((m, i) => ({ m, i })).filter(({ m }) => !m.isDead && !m.isEscaped)
    : [];
  const count = targeting.targets.length;
  if (count === 0) return NO_FOCUS;
  const idx = targeting.focusIdx;
  const t = alive[idx];
  if (!t) return { count, idx, tooltip: null };
  const info = g.combat ? (getIntents(g, bundle)[t.i] ?? null) : null;
  return { count, idx, tooltip: tipEnemy(bundle, t.m, info) };
}

function mapFocus(g: GameState, ui: UiState, screen: MapView): FocusInfo {
  const picks = screen.picks;
  const count = picks.length;
  const raw = ui.focus && ui.focus.scope === "map" ? ui.focus.idx : null;
  if (raw === null || count === 0) return { count, idx: null, tooltip: null };
  const idx = Math.min(raw, count - 1);
  const p = picks[idx]!;
  const node = p.y > screen.maxY ? null : g.run.map?.rows[p.y]?.[p.x];
  const kind = node ? node.kind : "boss";
  return { count, idx, tooltip: tipNode(kind, node?.burningElite ?? false, p.key) };
}

function choiceFocus(g: GameState, pending: PendingChoice, overlay: OverlayView, bundle: ContentBundle, accent: string): FocusInfo {
  if (overlay.kind !== "choice") return NO_FOCUS;
  const count = overlay.list.total;
  const idx = overlay.list.focusI;
  if (idx === null) return { count, idx: null, tooltip: null };
  const req = pending.request;
  if (req.kind === "option") {
    return { count, idx, tooltip: tipChoiceItem(overlay.list, idx, accent) };
  }
  const iid = req.iids[idx];
  if (iid === undefined) return { count, idx, tooltip: null };
  const inspect = inspectAt(g, { of: "choice" }, bundle, idx);
  if (!g.combat) {
    const mc = g.run.deck[iid];
    if (!mc) return { count, idx, tooltip: tipChoiceItem(overlay.list, idx, accent) };
    const def = bundle.cards.get(mc.defId);
    return {
      count,
      idx,
      tooltip: tipCard(bundle, mc.defId, mc.upgrades, def ? masterCostLabel(masterCardCost(def, mc.upgrades)) : "?"),
      inspect,
    };
  }
  const card = g.combat.cards[iid];
  if (!card) return { count, idx, tooltip: tipChoiceItem(overlay.list, idx, accent) };
  return { count, idx, tooltip: tipCard(bundle, card.defId, card.upgrades, instCostLabel(card)), inspect };
}

function overlayFocus(g: GameState, top: Overlay, overlay: OverlayView, bundle: ContentBundle, accent: string): FocusInfo {
  if (overlay.kind !== "list") return NO_FOCUS;
  const count = overlay.list.total;
  const idx = overlay.list.focusI;
  if (idx === null) return { count, idx: null, tooltip: null };
  switch (top.kind) {
    case "deck": {
      const mc = g.run.deck[idx];
      if (!mc) return { count, idx, tooltip: null };
      const def = bundle.cards.get(mc.defId);
      return {
        count,
        idx,
        tooltip: tipCard(bundle, mc.defId, mc.upgrades, def ? masterCostLabel(masterCardCost(def, mc.upgrades)) : "?"),
        inspect: inspectAt(g, { of: "deck" }, bundle, idx),
      };
    }
    case "relics": {
      const r = g.run.relics[idx];
      if (!r) return { count, idx, tooltip: null };
      return {
        count,
        idx,
        tooltip: tipRelic(bundle, r.defId, r.counter > 0 ? ` - counter ${r.counter}` : ""),
        inspect: inspectAt(g, { of: "relics" }, bundle, idx),
      };
    }
    case "pile": {
      const entries = pileEntries(g, top.pile);
      const e = entries[idx];
      if (!e) return { count, idx, tooltip: null };
      return {
        count,
        idx,
        tooltip: tipCard(bundle, e.card.defId, e.card.upgrades, instCostLabel(e.card)),
        inspect: inspectAt(g, { of: "pile", pile: top.pile }, bundle, idx),
      };
    }
    case "potions": {
      const id = g.run.potions[idx];
      if (id == null) return { count, idx, tooltip: tipChoiceItem(overlay.list, idx, accent) };
      return {
        count,
        idx,
        tooltip: tipPotion(bundle, id, sacredBark(g)),
        inspect: inspectAt(g, { of: "potions" }, bundle, idx),
      };
    }
    case "settings":
      return { count, idx, tooltip: tipChoiceItem(overlay.list, idx, accent) };
    default:
      return NO_FOCUS;
  }
}

function listScreenFocus(
  g: GameState,
  room: RoomState,
  screen: { list: ListView },
  bundle: ContentBundle,
  accent: string,
): FocusInfo {
  const count = screen.list.total;
  const idx = screen.list.focusI;
  if (idx === null) return { count, idx: null, tooltip: null };
  // richer than the inline squeeze for the typed rooms
  if (room.kind === "shop") {
    const shop = room.shop;
    let k = idx;
    const inShop = inspectAt(g, { of: "shop" }, bundle, idx);
    if (k < shop.cards.length) {
      const slot = shop.cards[k]!;
      const def = bundle.cards.get(slot.id);
      return {
        count,
        idx,
        tooltip: tipCard(bundle, slot.id, 0, def ? masterCostLabel(def.cost) : "?", ` - ${slot.price}G`),
        inspect: inShop,
      };
    }
    k -= shop.cards.length;
    if (k < shop.relics.length) {
      const slot = shop.relics[k]!;
      return { count, idx, tooltip: tipRelic(bundle, slot.id, ` - ${slot.price}G`), inspect: inShop };
    }
    k -= shop.relics.length;
    if (k < shop.potions.length) {
      const slot = shop.potions[k]!;
      return { count, idx, tooltip: tipPotion(bundle, slot.id, sacredBark(g), ` - ${slot.price}G`), inspect: inShop };
    }
    return { count, idx, tooltip: tipChoiceItem(screen.list, idx, accent) };
  }
  if (room.kind === "rewards") {
    const e = room.entries[idx];
    if (e) {
      const inReward = inspectAt(g, { of: "reward" }, bundle, idx);
      if (e.kind === "card") {
        const def = bundle.cards.get(e.id);
        const up = e.upgraded ? 1 : 0;
        return {
          count,
          idx,
          tooltip: tipCard(bundle, e.id, up, def ? masterCostLabel(masterCardCost(def, up)) : "?"),
          inspect: inReward,
        };
      }
      if (e.kind === "relic" || e.kind === "bossRelic") {
        return { count, idx, tooltip: tipRelic(bundle, e.id), inspect: inReward };
      }
      if (e.kind === "potion") return { count, idx, tooltip: tipPotion(bundle, e.id, sacredBark(g)), inspect: inReward };
    }
    return { count, idx, tooltip: tipChoiceItem(screen.list, idx, accent) };
  }
  return { count, idx, tooltip: tipChoiceItem(screen.list, idx, accent) };
}

/** What [i] opens when no cursor is set: the first inspectable thing this
 *  place is showing, which is how combat's [i] has always behaved. */
function defaultInspect(g: GameState, mode: ViewMode, top: Overlay | undefined, bundle: ContentBundle): { source: InspectSource; index: number } | null {
  let source: InspectSource | null = null;
  if (mode === "overlay" && top) {
    if (top.kind === "deck") source = { of: "deck" };
    else if (top.kind === "relics") source = { of: "relics" };
    else if (top.kind === "potions") source = { of: "potions" };
    else if (top.kind === "pile") source = { of: "pile", pile: top.pile };
  } else if (mode === "choice") source = { of: "choice" };
  else if (mode === "combat") source = { of: "hand" };
  else if (mode === "shop") source = { of: "shop" };
  else if (mode === "rewards") source = { of: "reward" };
  if (source === null) return null;
  return inspectAt(g, source, bundle, null);
}

// --- hints ------------------------------------------------------------------------------

/** The verb Enter carries in the inspector, per collection. */
const INSPECT_CTA: Partial<Record<InspectSource["of"], string>> = {
  hand: "play",
  reward: "take",
  shop: "buy",
  potions: "use",
};

function hintFor(
  mode: ViewMode,
  view: {
    screen: ScreenView;
    overlay: OverlayView | null;
    inspect: { source: InspectSource } | null;
    vimKeys: boolean;
  },
): string {
  const insp = view.inspect !== null ? "  [i] inspect" : "";
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
      if (o.single) return `[1-9] pick${paging}${insp}${o.canCancel ? "  [Esc] cancel" : ""}`;
      return `[1-0] toggle  [Enter] confirm${paging}${insp}${o.canCancel ? "  [Esc] cancel" : ""}`;
    }
    case "overlay": {
      const o = view.overlay;
      if (!o) return "";
      if (o.kind === "confirmQuit") return "[y] quit  [n] keep playing";
      if (o.kind === "potionMenu") return "[Enter/u] use  [d] discard  [Esc] cancel";
      if (o.kind === "inspect") {
        const verb = INSPECT_CTA[o.source.of];
        const cta = verb !== undefined && (o.source.of === "hand" || o.enter !== null) ? `[Enter] ${verb}  ` : "";
        return `${cta}[j/k] next/prev  [Esc] close`;
      }
      if (o.kind === "log") return "[Esc] close";
      if (o.kind === "list" && o.id === "settings") return "[1/Enter] toggle  [Esc] close";
      const paging = o.kind === "list" && o.list.pages > 1 ? "  [n/p] page" : "";
      if (o.kind === "list" && o.id === "deck") return `[1-0] select${paging}${insp}  [Esc] close`;
      if (o.kind === "list" && o.id === "potions") return `[1-9] potion${paging}${insp}  [Esc] close`;
      return `${paging.trim().length > 0 ? paging.trim() + "  " : ""}${insp.trim().length > 0 ? insp.trim() + "  " : ""}[Esc] close`;
    }
    case "combat":
      // [l] is a movement key under vim bindings, so the log wears [L] there
      return `[1-0/Enter] play  [e] end turn  [i] inspect  [${view.vimKeys ? "L" : "l"}] log  [w/x/z] piles  [d/r/p] deck  [q] quit`;
    case "map":
      return view.vimKeys
        ? "[h/l] path  [Enter] go  [j/k] scroll  [1-9] travel  [d/r/p] deck  [q] quit"
        : "[<-/->] path  [Enter] go  [up/dn] scroll  [1-9] travel  [d/r/p] deck  [q] quit";
    case "neow":
      return "[1-4] choose a blessing  [d] deck  [r] relics  [q] quit";
    case "rewards":
      return "[1-9] take  [i] inspect  [Enter] continue  [d/r/p] deck  [q] quit";
    case "shop": {
      const s = view.screen as ShopView;
      const paging = s.list.pages > 1 ? "  [n/p] page" : "";
      return `[1-0] buy${paging}${insp}  [Enter] leave  [d/r/p]  [q] quit`;
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
    // settings is the one overlay that opens without a run. Every other kind
    // needs a GameState, so the menu keeps ignoring them exactly as before.
    const menuTop = ui.overlays[ui.overlays.length - 1];
    const overlayRaw = ui.focus && ui.focus.scope === "overlay" ? ui.focus.idx : null;
    const overlay = menuTop?.kind === "settings" ? buildSettingsOverlay(ui, overlayRaw) : null;
    const mode: ViewMode = overlay ? "overlay" : ui.seedEdit ? "textInput" : "menu";
    const menuRaw = mode === "menu" && ui.focus && ui.focus.scope === "menu" ? ui.focus.idx : null;
    const screen = buildMenu(ui, bundle, menuRaw);
    const accent = CHARACTER_COLORS[ui.character] ?? "#54689a";
    const focus: FocusInfo = overlay
      ? settingsFocus(overlay, accent)
      : mode === "menu"
        ? menuFocus(ui, bundle, screen)
        : NO_FOCUS;
    return {
      mode,
      accent,
      header: null,
      screen,
      overlay,
      targeting: null,
      toast: ui.toast != null ? toAscii(ui.toast) : null,
      log: [],
      hint: hintFor(mode, { screen, overlay, inspect: null, vimKeys: ui.vimKeys }),
      tooltip: focus.tooltip,
      inspect: null,
      focusCount: focus.count,
      focusIdx: focus.idx,
      vimKeys: ui.vimKeys,
    };
  }

  // input precedence: overlay-top > pending choice > targeting > room kind
  // (mode is resolved FIRST so the focus cursor can flow into the builders -
  // the page auto-follows the cursor)
  const top = ui.overlays[ui.overlays.length - 1];
  let targeting: TargetingView | null = null;
  let mode: ViewMode;
  if (top) {
    mode = "overlay";
  } else if (game.pending) {
    mode = "choice";
  } else if (ui.targeting) {
    targeting = buildTargeting(game, ui, bundle);
    mode = targeting ? "targeting" : (room.kind as ViewMode);
  } else {
    mode = room.kind as ViewMode;
  }
  const rawFocus = ui.focus && ui.focus.scope === mode ? ui.focus.idx : null;
  const screenFocus = mode === room.kind ? rawFocus : null;

  const header = buildHeader(game, bundle);
  let screen: ScreenView;
  switch (room.kind) {
    case "neow":
      screen = buildNeow(room, ui.page, screenFocus);
      break;
    case "map":
      screen = buildMap(game, ui, bundle);
      break;
    case "combat":
      screen = buildCombat(game, ui, bundle, screenFocus);
      break;
    case "rewards":
      screen = buildRewards(game, room, ui.page, screenFocus, bundle);
      break;
    case "shop":
      screen = buildShop(game, room, ui.page, screenFocus, bundle);
      break;
    case "rest":
      screen = buildRest(game, room, ui.page, screenFocus, bundle);
      break;
    case "treasure":
      screen = buildTreasure(game, room, ui, ui.page, screenFocus, bundle);
      break;
    case "event":
      screen = buildEvent(game, room, ui.page, screenFocus, bundle);
      break;
    case "gameOver":
      screen = buildGameOver(game, room, ui.page, screenFocus, bundle);
      break;
  }

  let overlay: OverlayView | null = null;
  if (top) {
    overlay = buildOverlay(game, top, ui, rawFocus, bundle);
  } else if (game.pending) {
    overlay = buildChoiceOverlay(game, game.pending, ui, rawFocus, bundle);
  }

  // focus + tooltip for the active mode
  let focus: FocusInfo;
  if (mode === "overlay" && top && overlay) {
    focus = overlayFocus(game, top, overlay, bundle, header.accent);
  } else if (mode === "choice" && game.pending && overlay) {
    focus = choiceFocus(game, game.pending, overlay, bundle, header.accent);
  } else if (mode === "targeting" && targeting) {
    focus = targetingFocus(game, bundle, targeting);
  } else if (mode === "combat") {
    focus = combatFocus(game, ui, bundle, header.accent);
  } else if (mode === "map" && screen.kind === "map") {
    focus = mapFocus(game, ui, screen);
  } else if (screen.kind !== "map" && screen.kind !== "combat" && mode === room.kind) {
    focus = listScreenFocus(game, room, screen, bundle, header.accent);
  } else {
    focus = NO_FOCUS;
  }

  // the cursor's own target when it has one, else the first thing here
  const inspect = focus.inspect ?? defaultInspect(game, mode, top, bundle);

  return {
    mode,
    accent: header.accent,
    header,
    screen,
    overlay,
    targeting,
    toast: ui.toast != null ? toAscii(ui.toast) : null,
    log: ui.log.slice(-8).map((l) => toAscii(l.text)),
    hint: hintFor(mode, { screen, overlay, inspect, vimKeys: ui.vimKeys }),
    tooltip: focus.tooltip,
    inspect,
    focusCount: focus.count,
    focusIdx: focus.idx,
    vimKeys: ui.vimKeys,
  };
}
