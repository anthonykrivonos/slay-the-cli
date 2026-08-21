// Run-level state: everything that persists between combats. Plain JSON data.

import type { CardId, CharacterId, EventId, MonsterId, PotionId, RelicId } from "../core/ids";

export interface MasterCard {
  defId: CardId;
  upgrades: number;
  misc: number; // Ritual Dagger / Genetic Algorithm permanent growth
  bottled: boolean;
}

export interface RelicState {
  defId: RelicId;
  /** persistent counter (Matryoshka uses left, Omamori charges, Pen Nib count, and so on) */
  counter: number;
  /** per-combat/turn flags live in combat scratch, not here */
}

export type RoomKind = "monster" | "elite" | "boss" | "event" | "shop" | "rest" | "treasure" | "neow";

export interface MapNode {
  x: number;
  y: number;
  kind: RoomKind | "unknown";
  /** indices into the next row's nodes */
  edges: number[];
  burningElite: boolean;
  emeraldKey: boolean;
}

export interface ActMap {
  act: number;
  /** rows[y][x] - null where no node */
  rows: (MapNode | null)[][];
  bossId: MonsterId;
  /** burning-elite buff rolled by mapGen (0-3); -1/undefined = none */
  burningEliteBuff?: number;
}

/** Shuffled-at-run-start pools, consumed from the front (as the game saves them). */
export interface RunPools {
  commonRelics: RelicId[];
  uncommonRelics: RelicId[];
  rareRelics: RelicId[];
  shopRelics: RelicId[];
  bossRelics: RelicId[];
  /** pre-generated per-act monster lists */
  monsterList: string[]; // encounter ids
  eliteList: string[];
  bossList: MonsterId[];
  eventList: EventId[];
  shrineList: EventId[];
  oneTimeEventList: EventId[];
}

// --- current-room tagged union ---------------------------------------------------

export type NeowBonus =
  | "THREE_CARDS"
  | "ONE_RANDOM_RARE_CARD"
  | "REMOVE_CARD"
  | "UPGRADE_CARD"
  | "TRANSFORM_CARD"
  | "RANDOM_COLORLESS"
  | "THREE_SMALL_POTIONS"
  | "RANDOM_COMMON_RELIC"
  | "TEN_PERCENT_HP_BONUS"
  | "THREE_ENEMY_KILL"
  | "HUNDRED_GOLD"
  | "RANDOM_COLORLESS_2"
  | "REMOVE_TWO"
  | "ONE_RARE_RELIC"
  | "THREE_RARE_CARDS"
  | "TWO_FIFTY_GOLD"
  | "TRANSFORM_TWO_CARDS"
  | "TWENTY_PERCENT_HP_BONUS"
  | "BOSS_RELIC";

export type NeowDrawback =
  | "NONE"
  | "TEN_PERCENT_HP_LOSS"
  | "NO_GOLD"
  | "CURSE"
  | "PERCENT_DAMAGE"
  | "LOSE_STARTER_RELIC";

export interface NeowOptionState {
  bonus: NeowBonus;
  drawback: NeowDrawback;
}

export type CardRarityRoll = "common" | "uncommon" | "rare";
export type RelicPoolTier = "common" | "uncommon" | "rare" | "shop" | "boss";

/** One claimable line on the rewards screen. Card / boss-relic choices are
 *  expanded into per-item entries sharing a group id: taking one marks the
 *  whole group taken. */
export type RewardEntry =
  | { kind: "gold"; amount: number; taken: boolean }
  | { kind: "potion"; id: PotionId; taken: boolean }
  | { kind: "relic"; id: RelicId; taken: boolean }
  | { kind: "emeraldKey"; taken: boolean }
  | { kind: "card"; group: number; id: CardId; rarity: CardRarityRoll; upgraded: boolean; taken: boolean }
  | { kind: "bossRelic"; group: number; id: RelicId; taken: boolean };

export interface ShopCardSlot {
  id: CardId;
  rarity: CardRarityRoll;
  price: number;
  sold: boolean;
  colorless: boolean;
}

export interface ShopRelicSlot {
  id: RelicId;
  tier: RelicPoolTier;
  price: number;
  sold: boolean;
}

export interface ShopPotionSlot {
  id: PotionId;
  price: number;
  sold: boolean;
}

export interface ShopState {
  /** 7 slots: 0-1 attack, 2-3 skill, 4 power, 5 colorless uncommon, 6 colorless rare */
  cards: ShopCardSlot[];
  /** 3 slots: 2 tier-rolled + 1 SHOP tier */
  relics: ShopRelicSlot[];
  potions: ShopPotionSlot[];
  removalCost: number;
  removalUsed: boolean;
}

export type ChestSize = "small" | "medium" | "large";

export interface ChestState {
  size: ChestSize;
  goldPresent: boolean;
  relicTier: CardRarityRoll; // chest relic tiers are common/uncommon/rare
  sapphireKeyAvailable: boolean;
  opened: boolean;
}

export type RewardsSource = "monster" | "elite" | "boss" | "neow" | "event";

/** Event-room scratch: setup rolls, screen-chain state, repeat counters. Plain JSON. */
export type EventRoomData = Record<string, unknown>;

export type RoomState =
  | { kind: "neow"; options: NeowOptionState[] }
  | { kind: "map" }
  | {
      kind: "combat";
      roomKind: "monster" | "elite" | "boss";
      encounterId: string;
      burningElite: boolean;
      /** present when an event started this combat: victory routes back through
       *  eventRuntime (event-defined rewards) instead of buildCombatRewards */
      eventCombat?: { eventId: EventId; data?: EventRoomData };
    }
  /** eventId null = pool exhausted (INVALID: single "leave" option);
   *  screen/data drive multi-screen events (EventDef.build reads them) */
  | { kind: "event"; eventId: EventId | null; screen?: string; data?: EventRoomData }
  | { kind: "shop"; shop: ShopState }
  | { kind: "rest"; used: boolean }
  | { kind: "treasure"; chest: ChestState }
  | { kind: "rewards"; entries: RewardEntry[]; source: RewardsSource }
  | { kind: "gameOver"; victory: boolean };

export interface RunState {
  character: CharacterId;
  ascension: number; // 0-20
  act: number;
  floor: number; // global floor counter (1-based within the run)
  hp: number;
  maxHp: number;
  gold: number;
  deck: MasterCard[];
  relics: RelicState[];
  potions: (PotionId | null)[];
  potionSlots: number;
  keys: { emerald: boolean; ruby: boolean; sapphire: boolean };
  map: ActMap | null;
  /** current position on the map: [x, y] or null before first room */
  position: [number, number] | null;
  /** current room state; undefined for single-combat games (createCombatGame) */
  room?: RoomState;
  pools: RunPools;
  /** reward pity/escalation trackers persisted like the game's save fields */
  blizzard: {
    cardRarityFactor: number; // starts +5; -1 per common; floor -40; reset on rare
    potionChance: number; // +40 base applied at roll time; this is the +/-10 adjustment
    monsterChance: number; // ?-room escalation (0.10 start)
    shopChance: number; // 0.03
    treasureChance: number; // 0.02
  };
  history: {
    combatsThisAct: number;
    eliteKillsThisAct: number;
    cardRemovesPurchased: number; // drives removal price 75 + 25n
    lastRoomWasShop: boolean;
    tinyChestCounter: number;
    seenEvents: EventId[];
    turnsThisRun: number;
    /** A20: the second act-3 boss has been queued/fought */
    a20SecondBoss?: boolean;
  };
}
