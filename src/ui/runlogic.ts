// Pure run-UI logic: seed handling, save validation, map-pick legality, and
// all display-text resolution (Neow options, rewards, glyphs, loot diffs).
// NO three.js / DOM imports — everything here is headlessly unit-testable
// (tests/ui/); the rendering half lives in main.ts / panels.ts.

import type { GameState } from "../engine/game";
import type {
  RunState,
  MapNode,
  NeowBonus,
  NeowDrawback,
  RewardEntry,
  MasterCard,
  ChestSize,
} from "../engine/run/runState";
import type { ContentBundle, CardDef, EffectCtx } from "../engine/content/defs";
import type { OrbInstance, PowerInstance } from "../engine/combat/combatState";
import type { CharacterId } from "../engine/core/ids";
import { restHealAmount } from "../engine/run/rest";
import { MAP_HEIGHT } from "../engine/run/mapGen";
import { buildEventScreen } from "../engine/run/eventRuntime";
import { RngRegistry } from "../engine/core/rngRegistry";
import { ActionQueue } from "../engine/core/queue";

// --- seeds -------------------------------------------------------------------

export const RUN_SAVE_KEY = "slay.run.save";

// menu selections persist separately from the run save
export const MENU_SEED_KEY = "slay.menu.seed";
export const MENU_CHARACTER_KEY = "slay.menu.character";
export const MENU_ASCENSION_KEY = "slay.menu.ascension";

export const PRESET_SEEDS = ["SPIRE", "IRONCLAD", "NEOW", "SLAYTHE", "JAWWORM", "MERCHANT"];

/** ?seed=FOO from location.search (null when absent/blank). */
export function seedFromSearch(search: string): string | null {
  try {
    const p = new URLSearchParams(search).get("seed");
    const trimmed = p?.trim() ?? "";
    return trimmed.length > 0 ? trimmed.toUpperCase() : null;
  } catch {
    return null;
  }
}

/** Tap-to-cycle: next preset (a custom seed cycles back into the presets). */
export function cycleSeed(current: string): string {
  const i = PRESET_SEEDS.indexOf(current);
  return PRESET_SEEDS[(i + 1) % PRESET_SEEDS.length]!;
}

/** Fresh seed for "new run" from a game-over screen: FOO -> FOO-2 -> FOO-3. */
export function bumpSeed(seed: string): string {
  const m = /^(.*)-(\d+)$/.exec(seed);
  if (m) return `${m[1]}-${Number.parseInt(m[2]!, 10) + 1}`;
  return `${seed}-2`;
}

// --- save validation -----------------------------------------------------------

/** Structural check on a parsed localStorage save. Returns the state or null.
 *  (The caller still try/catches the first render, as boot() always did.) */
export function validateSavedRun(parsed: unknown): GameState | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const s = parsed as Partial<GameState>;
  if (s.version !== 1 || typeof s.seed !== "string" || !s.rng) return null;
  const run = s.run;
  if (!run || typeof run !== "object") return null;
  if (!Array.isArray(run.deck) || !Array.isArray(run.potions)) return null;
  if (!run.room || typeof run.room.kind !== "string") return null;
  if (typeof run.hp !== "number" || typeof run.floor !== "number") return null;
  return s as GameState;
}

// --- characters + ascension (menu) --------------------------------------------------

export const CHARACTER_IDS = ["IRONCLAD", "SILENT", "DEFECT", "WATCHER"] as const;
export type UICharacterId = (typeof CHARACTER_IDS)[number];

export function isCharacterId(v: unknown): v is UICharacterId {
  return typeof v === "string" && (CHARACTER_IDS as readonly string[]).includes(v);
}

/** Accent color per character (card borders, selection highlights). */
export const CHARACTER_COLORS: Record<string, string> = {
  IRONCLAD: "#c25454",
  SILENT: "#6fce87",
  DEFECT: "#5f9ad0",
  WATCHER: "#b98ad6",
};

export interface CharacterSummary {
  id: UICharacterId;
  name: string;
  maxHp: number;
  relic: string;
}

export function characterSummary(bundle: ContentBundle, id: UICharacterId): CharacterSummary {
  const def = bundle.characters.get(id);
  if (!def) return { id, name: titleCase(id), maxHp: 0, relic: "?" };
  return { id, name: def.name, maxHp: def.maxHp, relic: relicName(bundle, def.startingRelic) };
}

export const MAX_ASCENSION = 20;

/** Parse + clamp a stored/derived ascension level to 0..20. */
export function clampAscension(v: unknown): number {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : typeof v === "number" ? v : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_ASCENSION, Math.trunc(n)));
}

/** One-line description per ascension level (cumulative with all below it). */
export const ASCENSION_LABELS: readonly string[] = [
  "The standard climb",
  "Elites spawn more often",
  "Normal enemies deal more damage",
  "Elites deal more damage",
  "Bosses deal more damage",
  "Heal less after boss fights",
  "Start each run damaged",
  "Normal enemies have more HP",
  "Elites have more HP",
  "Bosses have more HP",
  "Start with Ascender's Bane",
  "Start with one less potion slot",
  "Upgraded cards appear less often",
  "Bosses drop less gold",
  "Lower max HP",
  "Unfavorable event odds",
  "Shop prices are higher",
  "Normal enemies have deadlier moves",
  "Elites have deadlier moves",
  "Bosses have deadlier moves",
  "Face two bosses at the end of Act 3",
];

export function ascensionLabel(level: number): string {
  return ASCENSION_LABELS[clampAscension(level)]!;
}

// --- generic display helpers -----------------------------------------------------

export function titleCase(id: string): string {
  return id
    .toLowerCase()
    .split("_")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function cardName(bundle: ContentBundle, id: string, upgrades = 0): string {
  return (bundle.cards.get(id)?.name ?? titleCase(id)) + (upgrades > 0 ? "+" : "");
}

export function relicName(bundle: ContentBundle, id: string): string {
  return bundle.relics.get(id)?.name ?? titleCase(id);
}

export function potionName(bundle: ContentBundle, id: string): string {
  return bundle.potions.get(id)?.name ?? titleCase(id);
}

export function eventTitle(bundle: ContentBundle, eventId: string | null): string {
  if (eventId === null) return "An Empty Passage";
  return bundle.events.get(eventId)?.name ?? titleCase(eventId);
}

// --- master-deck cards ----------------------------------------------------------

/** Printed cost of a master card at its upgrade level (-1 = X, -2 = unplayable). */
export function masterCardCost(def: CardDef, upgrades: number): number {
  if (upgrades > 0 && def.upgradeValues.cost !== undefined) return def.upgradeValues.cost;
  return def.cost;
}

export function costText(cost: number): string {
  if (cost === -1) return "X";
  if (cost === -2) return "–";
  return String(cost);
}

/** Mirror of the engine's canSmith (rest.ts) over a master card. */
export function canSmithMaster(bundle: ContentBundle, mc: MasterCard): boolean {
  const def = bundle.cards.get(mc.defId);
  if (!def) return false;
  if (def.type === "curse" || def.type === "status") return false;
  return mc.upgrades === 0 || def.keywords.includes("multiUpgrade");
}

export function smithableDeckIndices(run: RunState, bundle: ContentBundle): number[] {
  return run.deck.map((_, i) => i).filter((i) => canSmithMaster(bundle, run.deck[i]!));
}

// --- Neow ------------------------------------------------------------------------

const NEOW_BONUS_TEXT: Record<NeowBonus, string> = {
  THREE_CARDS: "Choose one of three cards",
  ONE_RANDOM_RARE_CARD: "Obtain a random rare card",
  REMOVE_CARD: "Remove a card from your deck",
  UPGRADE_CARD: "Upgrade a card",
  TRANSFORM_CARD: "Transform a card",
  RANDOM_COLORLESS: "Choose one of three colorless cards",
  THREE_SMALL_POTIONS: "Obtain three random potions",
  RANDOM_COMMON_RELIC: "Obtain a random common relic",
  TEN_PERCENT_HP_BONUS: "Gain 10% max HP",
  THREE_ENEMY_KILL: "Neow's Lament: the first three combats begin with enemies at 1 HP",
  HUNDRED_GOLD: "Gain 100 gold",
  RANDOM_COLORLESS_2: "Choose one of three rare colorless cards",
  REMOVE_TWO: "Remove two cards from your deck",
  ONE_RARE_RELIC: "Obtain a random rare relic",
  THREE_RARE_CARDS: "Choose one of three rare cards",
  TWO_FIFTY_GOLD: "Gain 250 gold",
  TRANSFORM_TWO_CARDS: "Transform two cards",
  TWENTY_PERCENT_HP_BONUS: "Gain 20% max HP",
  BOSS_RELIC: "Swap your starting relic for a random boss relic",
};

const NEOW_DRAWBACK_TEXT: Record<NeowDrawback, string> = {
  NONE: "",
  TEN_PERCENT_HP_LOSS: "Lose 10% max HP",
  NO_GOLD: "Lose all of your gold",
  CURSE: "Gain a curse",
  PERCENT_DAMAGE: "Take damage (30% of your current HP)",
  LOSE_STARTER_RELIC: "Lose your starting relic",
};

export function neowBonusText(bonus: NeowBonus): string {
  return NEOW_BONUS_TEXT[bonus] ?? titleCase(bonus);
}

export function neowDrawbackText(drawback: NeowDrawback): string {
  return NEOW_DRAWBACK_TEXT[drawback] ?? titleCase(drawback);
}

// --- map -----------------------------------------------------------------------

export interface MapPick {
  x: number;
  y: number;
}

/** y of the boss door (row above the top rest row). */
export const BOSS_DOOR_Y = MAP_HEIGHT;

/** Legal next map nodes, mirroring runFlow's mapPick validation. Only
 *  meaningful while run.room.kind === "map". */
export function legalMapPicks(run: RunState): MapPick[] {
  const map = run.map;
  if (!map) return [];
  if (run.position === null) {
    const out: MapPick[] = [];
    map.rows[0]?.forEach((node, x) => {
      if (node && node.edges.length > 0) out.push({ x, y: 0 });
    });
    return out;
  }
  const [px, py] = run.position;
  if (py >= MAP_HEIGHT - 1) return [{ x: 3, y: BOSS_DOOR_Y }];
  const node = map.rows[py]?.[px];
  return (node?.edges ?? []).map((ex) => ({ x: ex, y: py + 1 }));
}

const MAP_GLYPHS: Record<MapNode["kind"], string> = {
  monster: "M",
  elite: "E",
  shop: "$",
  rest: "R",
  treasure: "T",
  unknown: "?",
  event: "?",
  boss: "B",
  neow: "N",
};

export function mapGlyph(kind: MapNode["kind"]): string {
  return MAP_GLYPHS[kind] ?? "?";
}

// --- events -------------------------------------------------------------------------

export interface EventOptionView {
  label: string;
  enabled: boolean;
}

export interface EventScreenView {
  summary: string;
  options: EventOptionView[];
}

/** Read-only EffectCtx over live state (mirrors tests/fuzz/realRun.test.ts):
 *  EventDef.build()/enabled() are pure — no rng consumption, no writes. */
function readonlyEventCtx(state: GameState, bundle: ContentBundle): EffectCtx {
  const registry = RngRegistry.fromState(state.rng);
  return {
    run: state.run,
    combat: state.combat,
    queue: new ActionQueue(),
    bundle,
    rt: { pending: null, currentItem: null, combatOver: null },
    rng: (st) => registry.get(st),
    asc: state.run.ascension,
    emit: () => {},
    requestChoice: () => {},
  };
}

/** Render-ready view of the current event screen, or null for stub rooms
 *  (unknown / exhausted event ids keep the historical "leave" behavior). */
export function buildEventView(state: GameState, bundle: ContentBundle): EventScreenView | null {
  if (state.run.room?.kind !== "event") return null;
  const ctx = readonlyEventCtx(state, bundle);
  const screen = buildEventScreen(ctx);
  if (!screen) return null;
  return {
    summary: screen.summary,
    options: screen.options.map((o) => ({ label: o.label, enabled: o.enabled(ctx) })),
  };
}

// --- stances / mantra / orbs (combat readouts) -----------------------------------------

/** Badge color per stance (task spec: Calm blue / Wrath red / Divinity gold). */
export const STANCE_COLORS: Record<string, string> = {
  CALM: "#7db8f0",
  WRATH: "#e06a7a",
  DIVINITY: "#ffd75e",
};

export function stanceColor(id: string): string {
  return STANCE_COLORS[id] ?? "#d9a0ff";
}

export const ORB_COLORS: Record<string, string> = {
  LIGHTNING: "#ffd75e",
  FROST: "#7de3e8",
  DARK: "#b48ae0",
  PLASMA: "#f0f2f8",
};

export function orbColor(id: string): string {
  return ORB_COLORS[id] ?? "#9aa3b8";
}

/** Player FOCUS power amount (0 when absent). */
export function playerFocus(powers: PowerInstance[]): number {
  return powers.find((p) => p.id === "FOCUS")?.amount ?? 0;
}

/** Number shown inside an orb circle: Lightning/Frost passive (Focus applied,
 *  floored at 0 like the engine's orbValue), Dark's stored evoke total,
 *  Plasma's flat passive. Null when the orb def is unknown. */
export function orbDisplayValue(bundle: ContentBundle, orb: OrbInstance, focus: number): number | null {
  if (orb.id === "DARK") return orb.amount;
  const def = bundle.orbs.get(orb.id);
  if (!def) return null;
  if (!def.usesFocus) return def.passiveBase;
  return Math.max(0, def.passiveBase + focus);
}

export function orbName(bundle: ContentBundle, id: string): string {
  return bundle.orbs.get(id)?.name ?? titleCase(id);
}

// --- keys -------------------------------------------------------------------------------

export interface KeyView {
  key: "emerald" | "ruby" | "sapphire";
  name: string;
  owned: boolean;
  color: string;
}

/** The three Act 4 keys, in display order, with lit colors. */
export function keyViews(run: RunState): KeyView[] {
  return [
    { key: "emerald", name: "Emerald", owned: run.keys.emerald, color: "#6fce87" },
    { key: "ruby", name: "Ruby", owned: run.keys.ruby, color: "#e06a7a" },
    { key: "sapphire", name: "Sapphire", owned: run.keys.sapphire, color: "#7db8f0" },
  ];
}

// --- rest ------------------------------------------------------------------------

/** Actual HP a rest would restore right now (30% of max, capped by missing). */
export function restHealPreview(run: RunState): number {
  return Math.min(run.maxHp - run.hp, restHealAmount(run.maxHp));
}

/** Recall (take the Ruby Key) is offered while the site is unused and the key
 *  is not yet owned. */
export function canRecall(run: RunState, used: boolean): boolean {
  return !used && !run.keys.ruby;
}

// --- rewards ---------------------------------------------------------------------

export function rewardLabel(e: RewardEntry, bundle: ContentBundle): string {
  switch (e.kind) {
    case "gold":
      return `${e.amount} Gold`;
    case "potion":
      return `Potion — ${potionName(bundle, e.id)}`;
    case "relic":
      return `Relic — ${relicName(bundle, e.id)}`;
    case "emeraldKey":
      return "Emerald Key";
    case "card":
      return cardName(bundle, e.id, e.upgraded ? 1 : 0);
    case "bossRelic":
      return relicName(bundle, e.id);
  }
}

/** Why a reward can't be taken right now (null = takeable). */
export function rewardBlocked(e: RewardEntry, run: RunState): string | null {
  if (e.taken) return "already taken";
  if (e.kind === "potion" && !run.potions.includes(null)) return "potion belt is full";
  return null;
}

/** Rewards flow layout: singles in order, card/bossRelic entries grouped. */
export type RewardRow =
  | { type: "single"; idx: number; entry: RewardEntry }
  | { type: "group"; kind: "card" | "bossRelic"; items: { idx: number; entry: RewardEntry }[] };

export function rewardRows(entries: RewardEntry[]): RewardRow[] {
  const rows: RewardRow[] = [];
  const groups = new Map<number, Extract<RewardRow, { type: "group" }>>();
  entries.forEach((entry, idx) => {
    if (entry.kind === "card" || entry.kind === "bossRelic") {
      let g = groups.get(entry.group);
      if (!g) {
        g = { type: "group", kind: entry.kind, items: [] };
        groups.set(entry.group, g);
        rows.push(g);
      }
      g.items.push({ idx, entry });
    } else {
      rows.push({ type: "single", idx, entry });
    }
  });
  return rows;
}

// --- treasure ---------------------------------------------------------------------

export function chestTitle(size: ChestSize): string {
  return `${titleCase(size)} Chest`;
}

/** Human summary of what an openChest/takeSapphireKey advance produced,
 *  computed as a before/after diff of run state. */
export function chestLootSummary(before: GameState, after: GameState, bundle: ContentBundle): string {
  const parts: string[] = [];
  const gold = after.run.gold - before.run.gold;
  if (gold > 0) parts.push(`${gold} gold`);
  for (const r of after.run.relics.slice(before.run.relics.length)) {
    parts.push(relicName(bundle, r.defId));
  }
  if (!before.run.keys.sapphire && after.run.keys.sapphire) parts.push("the Sapphire Key");
  if (parts.length === 0) return "The chest was empty.";
  return `Found: ${parts.join(", ")}`;
}

// --- game over -----------------------------------------------------------------------

/** Banner headline: act-4 victory (the Heart) reads differently from the
 *  act-3 door victory. */
export function gameOverTitle(victory: boolean, act: number): string {
  if (!victory) return "DEFEAT";
  return act >= 4 ? "THE HEART FALLS" : "VICTORY";
}

export function gameOverSubtitle(victory: boolean, act: number): string {
  if (!victory) return "Slain in the Spire.";
  return act >= 4
    ? "The Corrupt Heart is destroyed — the true ending."
    : "You defeated the Act 3 boss and stepped through the door.";
}

/** Stats block for the game-over screen (character + ascension + progress). */
export function gameOverStats(g: GameState, bundle: ContentBundle): string {
  const name = bundle.characters.get(g.run.character)?.name ?? titleCase(g.run.character);
  return `${name} · Ascension ${g.run.ascension}\nFloor ${g.run.floor} · Act ${g.run.act}\nseed ${g.seed}`;
}

// --- pending choices ----------------------------------------------------------------

/** Friendly title for a pending-choice reason ("neow:remove" etc). */
export function describeChoiceReason(reason: string): string {
  switch (reason) {
    case "neow:remove":
      return "Choose cards to remove";
    case "neow:upgrade":
      return "Choose cards to upgrade";
    case "neow:transform":
      return "Choose cards to transform";
    default:
      return reason;
  }
}

// --- shop ----------------------------------------------------------------------------

export function canAfford(gold: number, price: number): boolean {
  return gold >= price;
}
