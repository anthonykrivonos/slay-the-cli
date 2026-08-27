// Content-definition interfaces - the contract between the engine and the
// (forkable) content bundle. Defs may contain functions; game STATE never does.

import type {
  ActorRef,
  CardId,
  CharacterId,
  EventId,
  MonsterId,
  MoveId,
  OrbId,
  PotionId,
  PowerId,
  RelicId,
  StanceId,
  EffectRefId,
} from "../core/ids";
import type { CombatState, CardInstance, MonsterState, Pile } from "../combat/combatState";
import type { RunState } from "../run/runState";
import type { ActionQueue } from "../core/queue";
import type { GameAction, DamageInfo, PendingChoice } from "../core/actions";
import type { Rng } from "../core/rng";
import type { Stream } from "../core/rngRegistry";
import type { Hooks } from "../core/hooks";

/** Mutable interpreter scratch shared by all ctx copies (hooks receive spreads). */
export interface RuntimeSlot {
  pending: PendingChoice | null;
  currentItem: import("../combat/combatState").CardQueueItem | null;
  /** combat outcome flag set by the interpreter. "escape" = the player
   *  bailed (Smoke Bomb): combat ends, no victory, no rewards. */
  combatOver: "victory" | "defeat" | "escape" | null;
}

/** Execution context handed to every content effect and hook. */
export interface EffectCtx {
  run: RunState;
  combat: CombatState | null;
  queue: ActionQueue;
  bundle: ContentBundle;
  rt: RuntimeSlot;
  rng(stream: Stream): Rng;
  /** ascension level shortcut */
  asc: number;
  /** emit a UI/animation event (no gameplay meaning) */
  emit(event: string, payload?: unknown): void;
  /** pause for player input; resume must be a registered EffectRef */
  requestChoice(choice: PendingChoice): void;
}

/** Card-effect context: adds the resolving card + target. */
export interface CardCtx extends EffectCtx {
  card: CardInstance;
  target: number | null; // monster idx
  energyOnUse: number; // for X-cost
  upgraded: boolean;
}

export type EffectFn = (ctx: EffectCtx, args?: unknown) => void;
export type CardEffectFn = (ctx: CardCtx) => void;

// --- primitives DSL (covers simple cards; audited against the corpus) ---------
export type CardPrimitive =
  | { do: "damage"; n: "damage"; hits?: "hits" | number }
  | { do: "damageAll"; n: "damage"; hits?: "hits" | number }
  | { do: "block"; n: "block" }
  | { do: "applyPower"; power: PowerId; n: "magic" | number; target: "target" | "self" | "all" }
  | { do: "draw"; n: "magic" | number }
  | { do: "gainEnergy"; n: "magic" | number }
  | { do: "loseHp"; n: "magic" | number }
  | { do: "channel"; orb: OrbId; n?: "magic" | number }
  | { do: "gainMantra"; n: "magic" | number }
  | { do: "scry"; n: "magic" | number }
  | { do: "changeStance"; stance: StanceId }
  | { do: "makeCard"; card: CardId; dest: Pile; n?: "magic" | number; upgraded?: boolean };

export interface CardDef {
  id: CardId;
  name: string;
  color: "red" | "green" | "blue" | "purple" | "colorless" | "curse";
  type: "attack" | "skill" | "power" | "status" | "curse";
  rarity: "basic" | "common" | "uncommon" | "rare" | "special" | "curse";
  cost: number; // -1 = X, -2 = unplayable
  target: "enemy" | "allenemy" | "self" | "none" | "selfandenemy" | "all";
  /** base values; upgraded variants resolved via upgrade deltas in the corpus */
  values: { damage?: number; block?: number; magic?: number; hits?: number };
  upgradeValues: { cost?: number; damage?: number; block?: number; magic?: number; hits?: number };
  keywords: string[]; // exhaust, ethereal, innate, retain, selfRetain, purgeOnUse, strike, multiUpgrade
  upgradeKeywords?: string[]; // full keyword set when upgraded (if it changes)
  // behavior - primitives for simple cards, onPlay for the rest
  primitives?: CardPrimitive[];
  onPlay?: CardEffectFn;
  canUse?: (ctx: CardCtx) => boolean;
  dynamicCost?: (ctx: EffectCtx, card: CardInstance) => number;
  // self-triggers
  onDrawThis?: CardEffectFn;
  onExhaustThis?: CardEffectFn;
  onManualDiscardThis?: CardEffectFn;
  onEndOfTurnInHand?: CardEffectFn; // Burn/Decay/Doubt/Shame/Regret
  onRetainThis?: CardEffectFn;
  /** Weave: fires after a scry resolves while this card sits in the discard pile */
  onScryThisInDiscard?: CardEffectFn;
  /** Flurry of Blows: fires on stance change while this card sits in the discard pile */
  onStanceChangeThisInDiscard?: CardEffectFn;
  /** terminal destination override after play (Tantrum shuffles back into draw) */
  afterUse?: "shuffleIntoDraw";
}

export interface PowerDef {
  id: PowerId;
  name: string;
  kind: "buff" | "debuff";
  /** how repeated applications combine */
  stacking: "intensity" | "duration" | "none";
  /** ticks down at end of round */
  turnBased: boolean;
  canGoNegative?: boolean; // Strength/Dexterity/Focus
  /** engine bookkeeping, not a real power: never shown as a buff chip or logged */
  hidden?: boolean;
  priority?: number; // rare explicit ordering overrides
  hooks: Hooks;
  onApply?: (ctx: EffectCtx, target: ActorRef, amount: number) => void;
  onRemove?: (ctx: EffectCtx, target: ActorRef) => void;
}

export interface RelicDef {
  id: RelicId;
  name: string;
  tier: "starter" | "common" | "uncommon" | "rare" | "boss" | "shop" | "event" | "special";
  pool: "shared" | "red" | "green" | "blue" | "purple";
  hooks: Hooks;
  onEquip?: EffectFn;
  onUnequip?: EffectFn;
  /** charges tick down to zero and the relic is spent (the reference's usedUp) */
  countsDown?: boolean;
  /** flat energy-per-turn delta while owned (boss energy relics) */
  energyBonus?: number;
  /** restrict energyBonus to elite/boss fights (Slaver's Collar) */
  energyBonusEliteBossOnly?: boolean;
}

export interface PotionDef {
  id: PotionId;
  name: string;
  rarity: "common" | "uncommon" | "rare";
  class: "shared" | "red" | "green" | "blue" | "purple";
  targeted: boolean;
  /** base potency; Sacred Bark doubles where sacredBarkDoubles */
  potency: number;
  sacredBarkDoubles: boolean;
  /** Refuse the potion instead of burning it (Smoke Bomb outside a non-boss
   *  fight). Deliberately a structural subset of EffectCtx so the pure CLI
   *  view can ask the same question without building a context. */
  canUse?: (ctx: { run: RunState; combat: CombatState | null }) => boolean;
  onUse: (ctx: EffectCtx, target: number | null, potency: number) => void;
}

export interface MonsterMoveDef {
  id: MoveId;
  intent:
    | "attack"
    | "attackDebuff"
    | "attackBuff"
    | "attackDefend"
    | "defend"
    | "defendBuff"
    | "defendDebuff"
    | "buff"
    | "debuff"
    | "strongDebuff"
    | "sleep"
    | "stun"
    | "escape"
    | "magic"
    | "unknown";
  /** executes the move by enqueuing actions */
  execute(ctx: EffectCtx, self: MonsterState): void;
  /** intent display numbers (damage x hits) computed through the damage calc */
  displayDamage?(ctx: EffectCtx, self: MonsterState): { damage: number; hits: number } | null;
}

export interface MonsterDef {
  id: MonsterId;
  name: string;
  category: "normal" | "elite" | "boss" | "minion" | "event";
  /** roll HP with monsterHpRng: randomRange(min, max), ascension-dependent */
  hp(asc: number): [number, number];
  moves: Record<MoveId, MonsterMoveDef>;
  /** exact AI port: choose next move from roll (aiRng.random(99)) + history */
  getMove(ctx: EffectCtx, self: MonsterState, roll: number): MoveId;
  preBattle?(ctx: EffectCtx, self: MonsterState): void;
  onDeath?(ctx: EffectCtx, self: MonsterState): void;
}

export interface EventOption {
  label: string;
  enabled(ctx: EffectCtx): boolean;
  /** apply the option's outcomes; svc provides combat plumbing (run/eventRuntime) */
  choose(ctx: EffectCtx, svc: EventServices): void;
}

/** Runtime services handed to EventOption.choose by run/eventRuntime - the only
 *  way event content may start combats (they need GameState/registry access). */
export interface EventServices {
  /** start an event combat; victory routes to EventDef.onCombatVictory */
  startCombat(opts: {
    encounterId: string;
    monsters: MonsterId[];
    roomKind: "monster" | "elite";
    /** skip MonsterDef.preBattle (Dead Adventurer's Lagavulin spawns awake) */
    suppressPreBattle?: boolean;
  }): void;
  /** jump straight to this act's boss combat (Secret Portal); floor streams reseed */
  goToBoss(): void;
}

export interface EventDef {
  id: EventId;
  name: string;
  pool: "act1" | "act2" | "act3" | "shrine" | "oneTime" | "special";
  canSpawn?(run: RunState): boolean;
  /** build the current screen from run.room (event variant) state. MUST be
   *  side-effect free and consume no rng - it can be re-rendered any time. */
  build(ctx: EffectCtx): { summary: string; options: EventOption[] };
  /** one-time setup rolls, fired right after the event room is entered */
  onEnter?(ctx: EffectCtx): void;
  /** victory handler for combats started via EventServices.startCombat; must
   *  set ctx.run.room (rewards screen / next event screen / map) */
  onCombatVictory?(ctx: EffectCtx, encounterId: string, data: unknown): void;
  /** continuation for "__eventChoice" pending choices requested by this event */
  onResume?(ctx: EffectCtx, tag: string, chosen: number[], extra: unknown): void;
}

export interface OrbDef {
  id: OrbId;
  name: string;
  passiveBase: number;
  evokeBase: number;
  usesFocus: boolean;
  onPassive(ctx: EffectCtx, slotIdx: number): void;
  onEvoke(ctx: EffectCtx, slotIdx: number): void;
}

export interface StanceDef {
  id: StanceId;
  name: string;
  /** damage dealt multiplier (Wrath 2, Divinity 3) */
  damageGiveMultiplier?: number;
  /** damage received multiplier (Wrath 2) */
  damageReceiveMultiplier?: number;
  onEnter?: EffectFn;
  onExit?: EffectFn;
  autoExitAtEndOfTurn?: boolean; // Divinity
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  maxHp: number;
  startingEnergy: number;
  startingDeck: { defId: CardId; upgrades?: number }[];
  startingRelic: RelicId;
  orbSlots: number; // Defect 3, others 0
  a14HpLoss: number;
}

export interface ActDef {
  act: number;
  weakEncounters: { id: string; monsters: MonsterId[] }[];
  strongEncounters: { id: string; monsters: MonsterId[]; weight: number }[];
  weakCount: number; // pre-generated weak fights: 3/2/2
  elites: { id: string; monsters: MonsterId[] }[];
  bosses: MonsterId[];
  /** multi-monster boss fights (Donu & Deca); bosses not listed resolve to [bossId] */
  bossEncounters?: { id: string; monsters: MonsterId[] }[];
  /** ordered per-act event pool (order matters: uniform picks index into it) */
  events?: EventId[];
  /** ordered per-act shrine pool */
  shrines?: EventId[];
}

export interface ContentBundle {
  id: string;
  version: string;
  cards: Map<CardId, CardDef>;
  powers: Map<PowerId, PowerDef>;
  relics: Map<RelicId, RelicDef>;
  potions: Map<PotionId, PotionDef>;
  monsters: Map<MonsterId, MonsterDef>;
  events: Map<EventId, EventDef>;
  orbs: Map<OrbId, OrbDef>;
  stances: Map<StanceId, StanceDef>;
  characters: Map<CharacterId, CharacterDef>;
  acts: ActDef[];
  /** named continuations for PendingChoice and effect actions */
  effects: Map<EffectRefId, EffectFn>;
}
