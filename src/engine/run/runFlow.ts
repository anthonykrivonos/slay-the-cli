// The run layer: everything between combats. Owns run.room (tagged union),
// room transitions, ?-room resolution with escalating chances, event pool
// consumption, act transitions (incl. the cardRng counter jump), and the
// run-start initialization (relic pool shuffles, encounter lists, map, Neow).
//
// Stream discipline (meta.rngStreams): floor streams (aiRng, cardRandomRng,
// miscRng, monsterHpRng, shuffleRng) reseed with seed+floorNum on EVERY room
// entry and on the boss treasure room; run streams tick for the whole run;
// mapRng is per act (seed+1 / +200 / +600).

import type { ContentBundle, EffectCtx } from "../content/defs";
import type { CharacterId, EventId, MonsterId } from "../core/ids";
import type { RunState, RoomState, RewardEntry, MapNode, ActMap, RoomKind } from "./runState";
import type { GameState, RunCommand } from "../game";
import type { RngRegistry } from "../core/rngRegistry";
import { Rng, JavaRandom, javaShuffle } from "../core/rng";
import { f32add, f32mul } from "../core/math";
import { PLAYER } from "../core/ids";
import { fireHook, foldHook, vetoHook } from "../core/hooks";
import { buildCombatState, initializeCombat } from "../combat/setup";
import { runQueue } from "../combat/interpreter";
import { generateMap, MAP_HEIGHT, MAP_WIDTH } from "./mapGen";
import { generateEncounters, generateExtraStrongEncounters, getActDef, resolveEncounter } from "./encounters";
import {
  buildCombatRewards,
  cardGroupEntries,
  classCardPool,
  classColor,
  hasRelic,
  nextRewardGroup,
} from "./rewards";
import { generateShop, repriceAfterRelic } from "./shop";
import { setupTreasureRoom, openChestContents } from "./treasure";
import { applyRest, applySmith, canSmith } from "./rest";
import { getNeowOptions, applyNeowBonus, applyNeowDrawback } from "./neow";
import { enterEventRoom, handleEventOption, handleEventCombatVictory } from "./eventRuntime";

// --- constants (audited against meta.json by tests) --------------------------------

export const STARTING_GOLD = 99;
export const POTION_SLOTS = { base: 3, ascension11Plus: 2 } as const;

export const UNKNOWN_ROOM = {
  base: { monster: 0.1, shop: 0.03, treasure: 0.02 },
  escalation: { monster: 0.1, shop: 0.03, treasure: 0.02 },
} as const;

export const SHRINE_CHANCE = 0.25;

/** cardRng counter jumps at act transitions (meta.rngStreams). */
export const CARD_RNG_COUNTER_JUMPS = [250, 500, 750] as const;

export const ACT_TRANSITION_HEAL = { ascension5Factor: 0.75 } as const;
export const ASCENSION_START = { damagedHpFactor: 0.9 } as const; // A6

/** One-time special event pools (meta.eventPools; A15+ drops NOTE_FOR_YOURSELF). */
export const ONE_TIME_EVENTS_ASC0: EventId[] = [
  "OMINOUS_FORGE",
  "BONFIRE_SPIRITS",
  "DESIGNER_IN_SPIRE",
  "DUPLICATOR",
  "FACE_TRADER",
  "THE_DIVINE_FOUNTAIN",
  "KNOWING_SKULL",
  "LAB",
  "NLOTH",
  "NOTE_FOR_YOURSELF",
  "SECRET_PORTAL",
  "THE_JOUST",
  "WE_MEET_AGAIN",
  "THE_WOMAN_IN_BLUE",
];
export const ONE_TIME_EVENTS_ASC15: EventId[] = ONE_TIME_EVENTS_ASC0.filter((e) => e !== "NOTE_FOR_YOURSELF");

// --- run initialization --------------------------------------------------------------

function buildRelicPool(bundle: ContentBundle, character: CharacterId, tier: "common" | "uncommon" | "rare" | "shop" | "boss"): string[] {
  const color = classColor(character);
  const out: string[] = [];
  for (const r of bundle.relics.values()) {
    if (r.tier === tier && (r.pool === "shared" || r.pool === color)) out.push(r.id);
  }
  return out;
}

function initActEventPools(run: RunState, bundle: ContentBundle, act: number): void {
  const actDef = getActDef(bundle.acts, act);
  if (actDef.events) run.pools.eventList = [...actDef.events];
  else {
    run.pools.eventList = [];
    for (const e of bundle.events.values()) if (e.pool === `act${act}`) run.pools.eventList.push(e.id);
  }
  if (actDef.shrines) run.pools.shrineList = [...actDef.shrines];
  else {
    run.pools.shrineList = [];
    for (const e of bundle.events.values()) if (e.pool === "shrine") run.pools.shrineList.push(e.id);
  }
}

function toActMap(gm: ReturnType<typeof generateMap>, act: number, bossId: MonsterId): ActMap {
  const rows: (MapNode | null)[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: (MapNode | null)[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      const n = gm.nodes[y]![x]!;
      if (n.edges.length === 0) {
        row.push(null);
        continue;
      }
      // map "?" nodes stay unresolved until entered
      const kind: MapNode["kind"] = n.room === "event" ? "unknown" : (n.room as RoomKind);
      const burning = gm.burningEliteX === x && gm.burningEliteY === y;
      row.push({ x, y, kind, edges: [...n.edges], burningElite: burning, emeraldKey: burning });
    }
    rows.push(row);
  }
  return { act, rows, bossId, burningEliteBuff: gm.burningEliteBuff };
}

/** Act 4: fixed 4-node column at x=3 — rest -> shop -> elite -> boss (the Heart). */
function act4ActMap(): ActMap {
  const rows: (MapNode | null)[][] = Array.from({ length: MAP_HEIGHT }, () =>
    new Array<MapNode | null>(MAP_WIDTH).fill(null),
  );
  const kinds: MapNode["kind"][] = ["rest", "shop", "elite", "boss"];
  kinds.forEach((kind, y) => {
    rows[y]![3] = { x: 3, y, kind, edges: y < 3 ? [3] : [], burningElite: false, emeraldKey: false };
  });
  return { act: 4, rows, bossId: "THE_HEART", burningEliteBuff: -1 };
}

function generateActMapFor(run: RunState, registry: RngRegistry, bossId: MonsterId): ActMap {
  // acts 2-3 only place a burning elite while the emerald key is not owned
  const setBurning = run.act === 1 || !run.keys.emerald;
  registry.reseedMap(run.act); // registry parity; generateMap derives its own mapRng identically
  return toActMap(generateMap(registry.seed, run.ascension, run.act, setBurning), run.act, bossId);
}

export function initRunState(
  opts: { bundle: ContentBundle; character: CharacterId; ascension?: number },
  registry: RngRegistry,
): RunState {
  const { bundle } = opts;
  const character = bundle.characters.get(opts.character);
  if (!character) throw new Error(`unknown character ${opts.character}`);
  const asc = opts.ascension ?? 0;

  const maxHp = character.maxHp - (asc >= 14 ? character.a14HpLoss : 0);
  const hp = asc >= 6 ? Math.round(maxHp * ASCENSION_START.damagedHpFactor) : maxHp;

  const deck = character.startingDeck.map((d) => ({ defId: d.defId, upgrades: d.upgrades ?? 0, misc: 0, bottled: false }));
  // A10: start cursed with Ascender's Bane (guarded until the curse def lands in content)
  if (asc >= 10 && bundle.cards.has("ASCENDERS_BANE")) {
    deck.push({ defId: "ASCENDERS_BANE", upgrades: 0, misc: 0, bottled: false });
  }

  // relic pools: shuffled ONCE at run start with java.Collections.shuffle over a
  // java.Random seeded from relicRng.randomLong(), consuming 5 longs in the
  // order common, uncommon, rare, shop, boss (meta.rngStreams.relicPoolShuffles)
  const relicRng = registry.get("relicRng");
  const tierOrder = ["common", "uncommon", "rare", "shop", "boss"] as const;
  const shuffled: Record<string, string[]> = {};
  for (const tier of tierOrder) {
    const pool = buildRelicPool(bundle, opts.character, tier);
    javaShuffle(pool, new JavaRandom(relicRng.randomLong()));
    shuffled[tier] = pool;
  }

  const actDef = getActDef(bundle.acts, 1);
  if (actDef.bosses.length === 0) throw new Error("act 1 has no bosses");
  const gen = generateEncounters(actDef, registry.get("monsterRng"));

  const run: RunState = {
    character: opts.character,
    ascension: asc,
    act: 1,
    floor: 0, // Neow is floor 0; the first map pick moves to floor 1
    hp,
    maxHp,
    gold: STARTING_GOLD,
    deck,
    relics: [{ defId: character.startingRelic, counter: 0 }],
    potions: new Array(asc >= 11 ? POTION_SLOTS.ascension11Plus : POTION_SLOTS.base).fill(null),
    potionSlots: asc >= 11 ? POTION_SLOTS.ascension11Plus : POTION_SLOTS.base,
    keys: { emerald: false, ruby: false, sapphire: false },
    map: null,
    position: null,
    room: { kind: "neow", options: getNeowOptions(registry.get("neowRng")) },
    pools: {
      commonRelics: shuffled["common"]!,
      uncommonRelics: shuffled["uncommon"]!,
      rareRelics: shuffled["rare"]!,
      shopRelics: shuffled["shop"]!,
      bossRelics: shuffled["boss"]!,
      monsterList: gen.monsterList,
      eliteList: gen.eliteList,
      bossList: gen.bossOrder,
      eventList: [],
      shrineList: [],
      oneTimeEventList: [...(asc >= 15 ? ONE_TIME_EVENTS_ASC15 : ONE_TIME_EVENTS_ASC0)],
    },
    blizzard: {
      cardRarityFactor: 5,
      potionChance: 0,
      monsterChance: UNKNOWN_ROOM.base.monster,
      shopChance: UNKNOWN_ROOM.base.shop,
      treasureChance: UNKNOWN_ROOM.base.treasure,
    },
    history: {
      combatsThisAct: 0,
      eliteKillsThisAct: 0,
      cardRemovesPurchased: 0,
      lastRoomWasShop: false,
      tinyChestCounter: 0,
      seenEvents: [],
      turnsThisRun: 0,
    },
  };

  initActEventPools(run, bundle, 1);
  run.map = generateActMapFor(run, registry, gen.bossOrder[0]!);
  return run;
}

// --- ? room resolution -----------------------------------------------------------------

/** getEventRoomOutcomeHelper (GameContext.cpp:2049-2103): one eventRng float,
 *  idx = int(roll*100) vs cumulative int(chance*100) thresholds; the shop share
 *  is 0 right after a shop; chances escalate by their base when not chosen and
 *  reset to base when chosen. Tiny Chest forces every 4th ? room to TREASURE
 *  (bypassing the roll); Juzu Bracelet converts MONSTER to EVENT after the
 *  monster chance has already reset. Exported for direct testing. */
export function resolveUnknownRoom(ctx: EffectCtx): "monster" | "shop" | "treasure" | "event" {
  const run = ctx.run;
  const b = run.blizzard;
  let outcome: "monster" | "shop" | "treasure" | "event" | null = null;

  if (hasRelic(run, "TINY_CHEST")) {
    if (run.history.tinyChestCounter === 3) {
      run.history.tinyChestCounter = 0;
      outcome = "treasure";
    } else {
      run.history.tinyChestCounter++;
    }
  }

  if (outcome === null) {
    const roll = ctx.rng("eventRng").randomFloat();
    const idx = Math.trunc(f32mul(roll, 100));
    const monsterSize = Math.trunc(f32mul(b.monsterChance, 100));
    const shopSize = monsterSize + (run.history.lastRoomWasShop ? 0 : Math.trunc(f32mul(b.shopChance, 100)));
    const treasureSize = shopSize + Math.trunc(f32mul(b.treasureChance, 100));
    outcome = idx < monsterSize ? "monster" : idx < shopSize ? "shop" : idx < treasureSize ? "treasure" : "event";
  }

  b.monsterChance = outcome === "monster" ? UNKNOWN_ROOM.base.monster : f32add(b.monsterChance, UNKNOWN_ROOM.escalation.monster);
  b.shopChance = outcome === "shop" ? UNKNOWN_ROOM.base.shop : f32add(b.shopChance, UNKNOWN_ROOM.escalation.shop);
  b.treasureChance = outcome === "treasure" ? UNKNOWN_ROOM.base.treasure : f32add(b.treasureChance, UNKNOWN_ROOM.escalation.treasure);

  if (outcome === "monster" && hasRelic(run, "JUZU_BRACELET")) outcome = "event";
  return outcome;
}

// --- event selection --------------------------------------------------------------------

/** generateEvent (GameContext.cpp:2032-2047): the selection rolls run on a COPY
 *  of eventRng (the reference passes it by value) — only the ?-room outcome
 *  roll advances the main stream. Chosen ids are removed from their pool.
 *  Returns null for INVALID (all pools empty). Exported for tests. */
export function generateEventId(ctx: EffectCtx): EventId | null {
  const run = ctx.run;
  const evRng = Rng.fromState(ctx.rng("eventRng").saveState());
  const canAdd = (id: EventId): boolean => {
    const def = ctx.bundle.events.get(id);
    return !def?.canSpawn || def.canSpawn(run);
  };

  const pickShrine = (): EventId | null => {
    const oneTimeEligible = run.pools.oneTimeEventList.filter(canAdd);
    const eligible = [...run.pools.shrineList, ...oneTimeEligible];
    if (eligible.length === 0) return null;
    const id = eligible[evRng.random(eligible.length - 1)]!;
    const si = run.pools.shrineList.indexOf(id);
    if (si !== -1) run.pools.shrineList.splice(si, 1);
    else run.pools.oneTimeEventList.splice(run.pools.oneTimeEventList.indexOf(id), 1);
    return id;
  };

  const pickEvent = (): EventId | null => {
    const eligible = run.pools.eventList.filter(canAdd);
    if (eligible.length === 0) return null;
    const id = eligible[evRng.random(eligible.length - 1)]!;
    run.pools.eventList.splice(run.pools.eventList.indexOf(id), 1);
    return id;
  };

  let chosen: EventId | null;
  if (evRng.randomFloatUpTo(1.0) < SHRINE_CHANCE) {
    if (run.pools.shrineList.length === 0 && run.pools.oneTimeEventList.length === 0) {
      chosen = run.pools.eventList.length === 0 ? null : pickEvent();
    } else {
      chosen = pickShrine();
    }
  } else {
    chosen = pickEvent() ?? pickShrine();
  }
  if (chosen) run.history.seenEvents.push(chosen);
  return chosen;
}

// --- combat entry / exit ------------------------------------------------------------------

function startCombat(state: GameState, ctx: EffectCtx, roomKind: "monster" | "elite" | "boss", encounterId: string, burningElite: boolean): void {
  const run = state.run;
  const bundle = ctx.bundle;
  const monsters = resolveCombatMonsters(bundle, run, roomKind, encounterId);
  const character = bundle.characters.get(run.character)!;
  const combat = buildCombatState(run, bundle, encounterId, monsters, character.startingEnergy, character.orbSlots, roomKind);
  state.combat = combat;
  ctx.combat = combat;
  run.room = { kind: "combat", roomKind, encounterId, burningElite };
  initializeCombat(ctx);
  if (burningElite) applyBurningEliteBuff(ctx, run.map?.burningEliteBuff ?? -1, run.act);
  runQueue(ctx);
}

function resolveCombatMonsters(
  bundle: EffectCtx["bundle"],
  run: RunState,
  roomKind: "monster" | "elite" | "boss",
  encounterId: string,
): string[] {
  if (run.act === 4) {
    // fixed Act 4 encounters (no ActDef)
    if (encounterId === "SHIELD_AND_SPEAR") return ["SPIRE_SHIELD", "SPIRE_SPEAR"];
    if (encounterId === "THE_HEART") return ["CORRUPT_HEART"];
  }
  if (roomKind === "boss") {
    const actDef = getActDef(bundle.acts, run.act);
    const multi = actDef.bossEncounters?.find((b) => b.id === encounterId);
    return multi ? [...multi.monsters] : [encounterId];
  }
  return resolveEncounter(getActDef(bundle.acts, run.act), encounterId);
}

/**
 * Burning ("emerald") elite buff, exact per the reference:
 *   0: +Strength(act)  1: +25% max HP (rounded)  2: Metallicize(act*2+2)  3: Regen(act*2+1)
 */
function applyBurningEliteBuff(ctx: EffectCtx, buff: number, act: number): void {
  if (buff < 0 || !ctx.combat) return;
  for (const m of ctx.combat.monsters) {
    if (m.isDead || m.isEscaped) continue;
    switch (buff) {
      case 0:
        m.powers.push({ id: "STRENGTH", amount: act, justApplied: false, data: null });
        break;
      case 1: {
        const inc = Math.round(m.maxHp * 0.25);
        m.maxHp += inc;
        m.hp += inc;
        break;
      }
      case 2:
        m.powers.push({ id: "METALLICIZE", amount: act * 2 + 2, justApplied: false, data: null });
        break;
      case 3:
        m.powers.push({ id: "REGEN", amount: act * 2 + 1, justApplied: false, data: null });
        break;
    }
  }
}

/** Consumed by game.ts when the interpreter flags victory inside a run. */
export function handleCombatVictory(state: GameState, ctx: EffectCtx, registry: RngRegistry): void {
  const run = state.run;
  const room = run.room;
  if (room?.kind !== "combat") return;
  if (room.eventCombat) {
    // event-room flow: rewards are event-defined (run/eventRuntime.ts)
    handleEventCombatVictory(state, ctx);
    return;
  }
  state.combat = null;
  ctx.combat = null;
  run.history.combatsThisAct++;
  if (room.roomKind === "elite") run.history.eliteKillsThisAct++;

  if (room.roomKind === "boss") {
    if (run.act >= 4) {
      // the Heart falls: the run is won
      state.outcome = { kind: "victory" };
      run.room = { kind: "gameOver", victory: true };
      return;
    }
    if (run.act === 3) {
      // A20: a second, different act-3 boss follows immediately on the next
      // floor (bossList[1] from the act's boss shuffle). No reward screen
      // between the two. // VERIFY-JAR: whether boss-1 gold banks separately.
      if (run.ascension >= 20 && !run.history.a20SecondBoss) {
        run.history.a20SecondBoss = true;
        run.floor++;
        registry.reseedFloorStreams(run.floor);
        const second = run.pools.bossList[1] ?? run.pools.bossList[0]!;
        startCombat(state, ctx, "boss", second, false);
        return;
      }
      // Act 4 opens only with all three keys; otherwise the climb ends here.
      if (run.keys.emerald && run.keys.ruby && run.keys.sapphire) {
        actTransition(state, ctx, registry);
        return;
      }
      state.outcome = { kind: "victory" };
      run.room = { kind: "gameOver", victory: true };
      return;
    }
    // boss gold uses the boss floor's miscRng, BEFORE the boss treasure room
    const entries = buildCombatRewards(ctx, "boss", false);
    // enterBossTreasureRoom: ++floorNum then reseed floor streams
    run.floor++;
    registry.reseedFloorStreams(run.floor);
    // boss relic choice: 3 from the shuffled boss pool (unchosen are not returned)
    const group = nextRewardGroup(entries);
    for (let i = 0; i < 3; i++) {
      const id = run.pools.bossRelics.shift();
      if (id !== undefined) entries.push({ kind: "bossRelic", group, id, taken: false });
    }
    run.room = { kind: "rewards", entries, source: "boss" };
    return;
  }

  run.room = {
    kind: "rewards",
    entries: buildCombatRewards(ctx, room.roomKind, room.burningElite),
    source: room.roomKind,
  };
}

// --- act transition --------------------------------------------------------------------

function actTransition(state: GameState, ctx: EffectCtx, registry: RngRegistry): void {
  const run = state.run;
  run.act++;

  // heal: full below A5; A5+ heals 75% of missing HP, rounded
  if (run.ascension >= 5) run.hp = Math.min(run.maxHp, run.hp + Math.round((run.maxHp - run.hp) * ACT_TRANSITION_HEAL.ascension5Factor));
  else run.hp = run.maxHp;

  // blizzard resets (meta.potionDrop.resetOnActTransition, unknownRoom.resetOnActTransition)
  run.blizzard.potionChance = 0;
  run.blizzard.monsterChance = UNKNOWN_ROOM.base.monster;
  run.blizzard.shopChance = UNKNOWN_ROOM.base.shop;
  run.blizzard.treasureChance = UNKNOWN_ROOM.base.treasure;

  // cardRng counter JUMP (meta.rngStreams.cardRngActTransitionCounterJump):
  // advance to the next 250-boundary by replaying randomBoolean()
  const cardRng = registry.get("cardRng");
  if (cardRng.counter < 250) cardRng.setCounter(250);
  else if (cardRng.counter < 500) cardRng.setCounter(500);
  else if (cardRng.counter < 750) cardRng.setCounter(750);

  if (run.act === 4) {
    // fixed Act 4: no encounter/event pools, no generated map
    run.pools.monsterList = [];
    run.pools.eliteList = [];
    run.pools.bossList = ["THE_HEART"];
    run.map = act4ActMap();
    run.position = null;
    run.history.combatsThisAct = 0;
    run.history.eliteKillsThisAct = 0;
    run.room = { kind: "map" };
    return;
  }

  // new act content: encounter lists continue on monsterRng; event pools swap
  const actDef = getActDef(ctx.bundle.acts, run.act);
  const gen = generateEncounters(actDef, registry.get("monsterRng"));
  run.pools.monsterList = gen.monsterList;
  run.pools.eliteList = gen.eliteList;
  run.pools.bossList = gen.bossOrder;
  initActEventPools(run, ctx.bundle, run.act);

  run.map = generateActMapFor(run, registry, gen.bossOrder[0]!);
  run.position = null;
  run.history.combatsThisAct = 0;
  run.history.eliteKillsThisAct = 0;
  run.room = { kind: "map" };
}

// --- shared helpers ----------------------------------------------------------------------

function addRelic(ctx: EffectCtx, id: string): void {
  ctx.run.relics.push({ defId: id, counter: 0 });
  const def = ctx.bundle.relics.get(id);
  def?.onEquip?.(ctx);
}

function addCardToDeck(ctx: EffectCtx, defId: string, upgraded: boolean): void {
  if (!vetoHook(ctx, PLAYER, "onObtainCard", defId)) return; // Omamori-style veto
  ctx.run.deck.push({ defId, upgrades: upgraded ? 1 : 0, misc: 0, bottled: false });
}

function gainGold(ctx: EffectCtx, amount: number): void {
  ctx.run.gold += Math.max(0, Math.floor(foldHook(ctx, PLAYER, "onGainGold", amount)));
}

function markGroupTaken(entries: RewardEntry[], group: number): void {
  for (const e of entries) {
    if ((e.kind === "card" || e.kind === "bossRelic") && e.group === group) e.taken = true;
  }
}

function leaveRewards(state: GameState, ctx: EffectCtx, registry: RngRegistry): void {
  const room = state.run.room;
  if (room?.kind !== "rewards") throw new Error("not on a rewards screen");
  if (room.source === "boss") actTransition(state, ctx, registry);
  else state.run.room = { kind: "map" };
}

/** Registered as effect "__runDeckChoice": resumes Neow deck selections. */
export function runDeckChoiceResume(ctx: EffectCtx, args: unknown): void {
  const { action, chosen } = args as { action: "remove" | "upgrade" | "transform"; chosen: number[] };
  const run = ctx.run;
  for (const i of chosen) {
    if (!run.deck[i]) throw new Error(`invalid deck index ${i}`);
  }
  if (action === "upgrade") {
    for (const i of chosen) run.deck[i]!.upgrades++;
  } else {
    const sorted = [...new Set(chosen)].sort((a, b) => b - a);
    for (const i of sorted) {
      run.deck.splice(i, 1);
      if (action === "transform") {
        // TODO exact transform rng is not pinned by meta.json; the real game
        // transforms with miscRng — uniform over the class pool, all rarities.
        const pool = [...classCardPool(ctx, "common"), ...classCardPool(ctx, "uncommon"), ...classCardPool(ctx, "rare")];
        if (pool.length > 0) {
          run.deck.push({ defId: pool[ctx.rng("miscRng").random(pool.length - 1)]!, upgrades: 0, misc: 0, bottled: false });
        }
      }
    }
  }
  run.room = { kind: "map" };
}

// --- room entry ---------------------------------------------------------------------------

function enterResolvedRoom(state: GameState, ctx: EffectCtx, kind: RoomKind, burning: boolean): void {
  const run = state.run;
  run.history.lastRoomWasShop = kind === "shop";
  fireHook(ctx, PLAYER, "onEnterRoom", kind);
  switch (kind) {
    case "monster": {
      let enc = run.pools.monsterList.shift();
      if (enc === undefined) {
        const actDef = getActDef(ctx.bundle.acts, run.act);
        run.pools.monsterList = generateExtraStrongEncounters(actDef, ctx.rng("monsterRng"), 12);
        enc = run.pools.monsterList.shift()!;
      }
      startCombat(state, ctx, "monster", enc, false);
      break;
    }
    case "elite": {
      if (run.act === 4) {
        startCombat(state, ctx, "elite", "SHIELD_AND_SPEAR", false);
        break;
      }
      const enc = run.pools.eliteList.shift();
      if (enc === undefined) throw new Error("elite list exhausted");
      startCombat(state, ctx, "elite", enc, burning);
      break;
    }
    case "boss":
      startCombat(state, ctx, "boss", run.map!.bossId, false);
      break;
    case "rest":
      run.room = { kind: "rest", used: false };
      fireHook(ctx, PLAYER, "onEnterRestSite");
      break;
    case "shop":
      run.room = { kind: "shop", shop: generateShop(ctx) };
      break;
    case "treasure":
      run.room = { kind: "treasure", chest: setupTreasureRoom(ctx) };
      break;
    case "event":
      run.room = { kind: "event", eventId: generateEventId(ctx) };
      enterEventRoom(ctx); // EventDef.onEnter setup rolls (miscRng etc.)
      break;
    case "neow":
      throw new Error("cannot re-enter Neow");
  }
}

// --- command handling -----------------------------------------------------------------------

export function handleRunCommand(state: GameState, ctx: EffectCtx, registry: RngRegistry, cmd: RunCommand): void {
  const run = state.run;
  if (!run.room) throw new Error("this game has no run layer (single-combat game)");
  if (state.pending) throw new Error("a choice is pending");
  const room = run.room;

  switch (cmd.cmd) {
    case "neowPick": {
      if (room.kind !== "neow") throw new Error("not at Neow");
      const opt = room.options[cmd.i];
      if (!opt) throw new Error(`no Neow option ${cmd.i}`);
      applyNeowDrawback(ctx, opt.drawback);
      const followUp = applyNeowBonus(ctx, opt.bonus);
      if (!followUp) {
        run.room = { kind: "map" };
      } else if (followUp.type === "cardReward") {
        run.room = { kind: "rewards", entries: cardGroupEntries(followUp.cards), source: "neow" };
      } else {
        const indices =
          followUp.action === "upgrade"
            ? run.deck.map((_, i) => i).filter((i) => canSmith(ctx, i))
            : run.deck.map((_, i) => i);
        const count = Math.min(followUp.count, indices.length);
        if (count === 0) {
          run.room = { kind: "map" };
        } else {
          ctx.requestChoice({
            request: {
              kind: "cards",
              pile: "custom",
              iids: indices, // deck indices; `choose` passes them back as chosen
              min: count,
              max: count,
              canCancel: false,
              reason: `neow:${followUp.action}`,
            },
            resume: "__runDeckChoice",
            resumeArgs: { action: followUp.action },
          });
        }
      }
      break;
    }

    case "mapPick": {
      if (room.kind !== "map") throw new Error("not at the map");
      const map = run.map!;
      let targetKind: MapNode["kind"];
      let burning = false;
      if (cmd.y === MAP_HEIGHT) {
        // the boss door above the top rest row
        if (!run.position || run.position[1] !== MAP_HEIGHT - 1) throw new Error("boss is not reachable yet");
        targetKind = "boss";
      } else {
        if (cmd.x < 0 || cmd.x >= MAP_WIDTH || cmd.y < 0 || cmd.y >= MAP_HEIGHT) throw new Error("off the map");
        const node = map.rows[cmd.y]![cmd.x];
        if (!node) throw new Error("no room at that position");
        if (run.position === null) {
          if (cmd.y !== 0) throw new Error("must start on row 0");
        } else {
          const [px, py] = run.position;
          if (cmd.y !== py + 1) throw new Error("can only move up one row");
          if (!map.rows[py]![px]!.edges.includes(cmd.x)) throw new Error("no path to that room");
        }
        targetKind = node.kind;
        burning = node.burningElite;
      }
      run.position = [cmd.x, cmd.y];
      // transitionToMapNode: ++floorNum then reseed floor streams with seed+floorNum
      run.floor++;
      registry.reseedFloorStreams(run.floor);
      const resolved: RoomKind = targetKind === "unknown" ? resolveUnknownRoom(ctx) : targetKind;
      enterResolvedRoom(state, ctx, resolved, burning);
      break;
    }

    case "takeReward": {
      if (room.kind !== "rewards") throw new Error("not on a rewards screen");
      const e = room.entries[cmd.i];
      if (!e) throw new Error(`no reward ${cmd.i}`);
      if (e.taken) throw new Error("reward already taken");
      switch (e.kind) {
        case "gold":
          gainGold(ctx, e.amount);
          e.taken = true;
          break;
        case "potion": {
          const slot = run.potions.indexOf(null);
          if (slot === -1) throw new Error("potion slots are full");
          run.potions[slot] = e.id;
          e.taken = true;
          break;
        }
        case "relic":
          addRelic(ctx, e.id);
          e.taken = true;
          break;
        case "emeraldKey":
          run.keys.emerald = true;
          e.taken = true;
          break;
        case "card":
          addCardToDeck(ctx, e.id, e.upgraded);
          markGroupTaken(room.entries, e.group);
          break;
        case "bossRelic":
          addRelic(ctx, e.id);
          markGroupTaken(room.entries, e.group);
          break;
      }
      break;
    }

    case "skipRewards":
      leaveRewards(state, ctx, registry);
      break;

    case "shopBuy": {
      if (room.kind !== "shop") throw new Error("not in a shop");
      const shop = room.shop;
      if (cmd.kind === "card") {
        const slot = shop.cards[cmd.idx];
        if (!slot || slot.sold) throw new Error("card slot unavailable");
        if (run.gold < slot.price) throw new Error("not enough gold");
        run.gold -= slot.price;
        slot.sold = true;
        addCardToDeck(ctx, slot.id, false);
        // TODO THE_COURIER restock (meta.shop.courierRestock)
      } else if (cmd.kind === "relic") {
        const slot = shop.relics[cmd.idx];
        if (!slot || slot.sold) throw new Error("relic slot unavailable");
        if (run.gold < slot.price) throw new Error("not enough gold");
        run.gold -= slot.price;
        slot.sold = true;
        addRelic(ctx, slot.id);
        // mid-shop reprice (Membership Card immediately halves remaining prices)
        repriceAfterRelic(ctx, shop, slot.id);
      } else {
        const slot = shop.potions[cmd.idx];
        if (!slot || slot.sold) throw new Error("potion slot unavailable");
        if (run.gold < slot.price) throw new Error("not enough gold");
        const free = run.potions.indexOf(null);
        if (free === -1) throw new Error("potion slots are full");
        run.gold -= slot.price;
        slot.sold = true;
        run.potions[free] = slot.id;
      }
      break;
    }

    case "shopRemove": {
      if (room.kind !== "shop") throw new Error("not in a shop");
      const shop = room.shop;
      if (shop.removalUsed) throw new Error("removal already used this visit");
      if (run.gold < shop.removalCost) throw new Error("not enough gold");
      if (!run.deck[cmd.deckIdx]) throw new Error(`invalid deck index ${cmd.deckIdx}`);
      run.gold -= shop.removalCost;
      run.deck.splice(cmd.deckIdx, 1);
      run.history.cardRemovesPurchased++;
      shop.removalUsed = true;
      break;
    }

    case "restOption": {
      if (room.kind !== "rest") throw new Error("not at a rest site");
      if (room.used) throw new Error("rest site already used");
      if (cmd.kind === "rest") {
        applyRest(ctx);
        fireHook(ctx, PLAYER, "onRest");
      } else if (cmd.kind === "recall") {
        // Recall: take the ruby key instead of resting (once per run)
        if (run.keys.ruby) throw new Error("ruby key already taken");
        run.keys.ruby = true;
      } else {
        if (cmd.deckIdx === undefined) throw new Error("smith requires deckIdx");
        applySmith(ctx, cmd.deckIdx);
        fireHook(ctx, PLAYER, "onSmith");
      }
      room.used = true;
      break;
    }

    case "openChest":
    case "takeSapphireKey": {
      if (room.kind !== "treasure") throw new Error("not in a treasure room");
      const contents = openChestContents(ctx, room.chest, cmd.cmd === "takeSapphireKey");
      if (contents.gold > 0) gainGold(ctx, contents.gold);
      if (contents.sapphireKeyTaken) run.keys.sapphire = true;
      else if (contents.relicId) addRelic(ctx, contents.relicId);
      fireHook(ctx, PLAYER, "onChestOpen", false);
      break;
    }

    case "eventOption": {
      if (room.kind !== "event") throw new Error("not in an event");
      // run/eventRuntime.ts interprets EventDefs; unknown ids fall back to a
      // single "leave" option (stub bundles). Selection roll consumption is exact.
      handleEventOption(state, ctx, registry, cmd.i);
      break;
    }

    case "proceed": {
      switch (room.kind) {
        case "rewards":
          leaveRewards(state, ctx, registry);
          break;
        case "rest":
        case "treasure":
        case "shop":
        case "event":
          run.room = { kind: "map" };
          break;
        default:
          throw new Error(`nothing to proceed from in ${room.kind}`);
      }
      break;
    }
  }
}
