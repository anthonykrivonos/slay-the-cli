// Combat state: plain JSON-serializable data only. No class instances, no
// functions - behavior is looked up in the ContentBundle by def id at
// execution time.

import type { CardId, CardInstanceId, MonsterId, MoveId, OrbId, PotionId, PowerId, StanceId } from "../core/ids";

/** A card as it exists inside a combat (piles reference instances by id). */
export interface CardInstance {
  iid: CardInstanceId;
  defId: CardId;
  upgrades: number; // 0 or 1; Searing Blow can exceed 1
  /** base cost for this combat (permanent in-combat modifications land here, e.g. Snecko roll) */
  cost: number;
  /** cost for the current turn only; reset to `cost` at end of turn */
  costForTurn: number;
  freeToPlayOnce: boolean;
  /** link back to the master deck index; null for cards created during combat */
  masterIdx: number | null;
  /** card-specific scratch value (Ritual Dagger accumulated damage, Genetic Algorithm block, X value) */
  misc: number;
  /** set while a power grants temporary retain (Well-Laid Plans selection) */
  retainOnce: boolean;
}

export type Pile = "draw" | "hand" | "discard" | "exhaust" | "limbo";

export interface PowerInstance {
  id: PowerId;
  amount: number;
  /** Weak/Vulnerable/Frail applied on the owner's off-turn skip their first end-of-round tick */
  justApplied: boolean;
  /** per-power scratch (e.g. The Bomb turns, Nightmare card, Echo Form counters) */
  data: Record<string, unknown> | null;
}

export interface OrbInstance {
  id: OrbId;
  /** Dark orb accumulated evoke value; unused by others */
  amount: number;
}

export interface PlayerCombatState {
  block: number;
  energy: number;
  energyPerTurn: number;
  stance: StanceId;
  mantra: number; // accumulates; at >=10 subtract 10 and enter Divinity
  powers: PowerInstance[]; // application order preserved - hook order depends on it
  orbs: OrbInstance[]; // index 0 = oldest (evokes first)
  orbSlots: number;
  piles: Record<Pile, CardInstanceId[]>;
}

export interface MonsterState {
  id: MonsterId;
  /** stable slot index used by ActorRef; corpses keep their slot */
  idx: number;
  hp: number;
  maxHp: number;
  block: number;
  powers: PowerInstance[];
  /** current move + history (most recent last); AI rules key off this */
  move: MoveId | null;
  moveHistory: MoveId[];
  isDead: boolean;
  isEscaped: boolean;
  halfDead: boolean; // Awakened One phase 1 corpse
  /** monster-specific scratch (Louse rolled damage, Guardian mode-shift threshold) */
  data: Record<string, unknown>;
}

export interface CardQueueItem {
  iid: CardInstanceId | null; // null => temp card played from limbo (e.g. Havoc top-of-draw handled via move first)
  target: number | null; // monster idx for targeted cards
  energyOnUse: number; // captured when queued; X-cost cards read this
  ignoreEnergyTotal: boolean; // don't pay energy (duplications, Havoc)
  regardlessOfCost: boolean;
  purgeOnUse: boolean; // remove from combat entirely after resolving
  exhaustOnUse: boolean;
  autoplayed: boolean; // duplicated/forced plays don't recount per-turn "cards played" triggers
}

export interface CombatState {
  turn: number; // 1-based player turn counter
  playerTurn: boolean;
  player: PlayerCombatState;
  monsters: MonsterState[];
  cardQueue: CardQueueItem[];
  nextCardInstanceId: number;
  /** all card instances by iid (piles hold ids) */
  cards: Record<number, CardInstance>;
  turnFlags: {
    cardsPlayedThisTurn: number;
    attacksPlayedThisTurn: number;
    skillsPlayedThisTurn: number;
    endTurnQueued: boolean;
    /** iids discarded this turn by card effects (Tactician/Reflex fire on these) */
    manualDiscardsThisTurn: number;
    /** Vault: the coming monster turn is skipped entirely (consumed once) */
    skipMonsterTurn?: boolean;
    /** type of the last card resolved this turn (Follow-Up/Sanctity conditions) */
    lastCardPlayedType?: string | null;
  };
  combatFlags: {
    cardsPlayedThisCombat: number;
    attacksPlayedThisCombat: number;
    skillsPlayedThisCombat: number;
    powersPlayedThisCombat: number;
    turnsTaken: number;
    hpLostThisCombat: number;
    /** monster encounter id for reward bookkeeping */
    encounterId: string;
  };
}
