// Public engine API. UI and tests interact ONLY through:
//   createRun(...)         full run (Neow -> map -> ... -> victory/death)
//   createCombatGame(...)  single combat (test/dev entry)
//   advance(state, command, bundle) -> new state
// State is immutable from the caller's perspective: advance() deep-clones,
// executes synchronously until the next player-input point, and returns the
// clone. The action queue is always empty when advance() returns.

import type { CharacterId, MonsterId } from "./core/ids";
import type { CombatState } from "./combat/combatState";
import type { RunState } from "./run/runState";
import type { PendingChoice } from "./core/actions";
import type { ContentBundle, EffectCtx } from "./content/defs";
import { ActionQueue } from "./core/queue";
import { RngRegistry, type RngRegistryState, type Stream } from "./core/rngRegistry";
import { seedFromString, seedToString } from "./core/rng";
import { runQueue, queueEndTurn, afterCardUsed, scryResolve, effectiveCost } from "./combat/interpreter";
import { buildCombatState, initializeCombat } from "./combat/setup";
import { runPrimitives } from "./content/primitives";
import { fireHook, vetoHook } from "./core/hooks";
import { PLAYER } from "./core/ids";
import { initRunState, handleRunCommand, handleCombatVictory, handleCombatEscape, runDeckChoiceResume } from "./run/runFlow";
import { hasRelic } from "./run/rewards";

export interface GameEvent {
  event: string;
  payload?: unknown;
}

export interface GameState {
  version: number;
  seed: string; // canonical seed string
  run: RunState;
  combat: CombatState | null;
  pending: PendingChoice | null;
  rng: RngRegistryState;
  outcome: null | { kind: "victory" | "death" };
  /** drained by the UI after each advance; not part of logical state */
  eventLog: GameEvent[];
}

/** Run-layer commands (handled by run/runFlow.ts). */
export type RunCommand =
  | { cmd: "neowPick"; i: number }
  | { cmd: "mapPick"; x: number; y: number }
  | { cmd: "takeReward"; i: number }
  | { cmd: "skipRewards" }
  | { cmd: "shopBuy"; kind: "card" | "relic" | "potion"; idx: number }
  | { cmd: "shopRemove"; deckIdx: number }
  | { cmd: "restOption"; kind: "rest" | "smith" | "recall"; deckIdx?: number }
  | { cmd: "openChest" }
  | { cmd: "takeSapphireKey" }
  | { cmd: "eventOption"; i: number }
  | { cmd: "proceed" };

export type Command =
  | { cmd: "playCard"; handIdx: number; target?: number }
  | { cmd: "endTurn" }
  | { cmd: "choose"; indices: number[] }
  | { cmd: "usePotion"; slot: number; target?: number }
  | { cmd: "discardPotion"; slot: number }
  | RunCommand;

/** Register the engine-internal effects a bundle must carry. */
export function registerEngineEffects(bundle: ContentBundle): void {
  bundle.effects.set("__primitives", runPrimitives);
  bundle.effects.set("__afterCardUsed", afterCardUsed);
  bundle.effects.set("__scryResolve", scryResolve);
  bundle.effects.set("__runDeckChoice", runDeckChoiceResume);
}

interface CtxBox {
  ctx: EffectCtx;
  state: GameState;
  registry: RngRegistry;
}

function makeCtx(state: GameState, bundle: ContentBundle): CtxBox {
  const registry = RngRegistry.fromState(state.rng);
  const queue = new ActionQueue();
  const rt = { pending: null as PendingChoice | null, currentItem: null, combatOver: null as "victory" | "defeat" | "escape" | null };
  const ctx: EffectCtx = {
    run: state.run,
    combat: state.combat,
    queue,
    bundle,
    rt,
    rng: (stream: Stream) => registry.get(stream),
    asc: state.run.ascension,
    emit: (event, payload) => state.eventLog.push({ event, payload }),
    requestChoice: (choice) => {
      // no picks once the fight is decided (content may request synchronously
      // during the victory drain - e.g. a scry landing on the killing blow)
      if (rt.combatOver) return;
      rt.pending = choice;
    },
  };
  return { ctx, state, registry };
}

function finish(box: CtxBox): GameState {
  const { ctx, state, registry } = box;
  if (ctx.rt.combatOver) ctx.rt.pending = null; // decided fights leave no pending picks
  state.pending = ctx.rt.pending;
  if (ctx.rt.combatOver === "victory") {
    state.outcome = null; // run continues; the run layer consumes the victory
    state.eventLog.push({ event: "combatEnded", payload: "victory" });
    // in a full run, victory rolls the rewards screen (or the act transition)
    if (state.run.room?.kind === "combat") handleCombatVictory(state, ctx, registry);
  } else if (ctx.rt.combatOver === "escape") {
    state.outcome = null; // the run continues, just without spoils
    state.eventLog.push({ event: "combatEnded", payload: "escape" });
    handleCombatEscape(state, ctx);
  } else if (ctx.rt.combatOver === "defeat") {
    state.outcome = { kind: "death" };
    if (state.run.room) state.run.room = { kind: "gameOver", victory: false };
  }
  if (!ctx.queue.isEmpty && !ctx.rt.pending && !ctx.rt.combatOver) {
    throw new Error("invariant violated: action queue not empty at input point");
  }
  state.rng = registry.saveState(); // after run-layer rolls (rewards etc.)
  return state;
}

/** Create a full run: Neow room, act-1 map, shuffled pools, encounter lists. */
export function createRun(opts: {
  seed: string;
  bundle: ContentBundle;
  character: CharacterId;
  ascension?: number;
}): GameState {
  const { bundle } = opts;
  registerEngineEffects(bundle);
  const seedLong = seedFromString(opts.seed);
  const registry = new RngRegistry(seedLong);
  const run = initRunState({ bundle, character: opts.character, ascension: opts.ascension }, registry);
  return {
    version: 1,
    seed: seedToString(seedLong),
    run,
    combat: null,
    pending: null,
    rng: registry.saveState(),
    outcome: null,
    eventLog: [],
  };
}

/** Create a game consisting of a single combat (test/dev entry; run layer later). */
export function createCombatGame(opts: {
  seed: string;
  bundle: ContentBundle;
  character: CharacterId;
  ascension?: number;
  deck: { defId: string; upgrades?: number }[];
  relics?: string[];
  monsters: MonsterId[];
  encounterId?: string;
  hp?: number;
  maxHp?: number;
}): GameState {
  const { bundle } = opts;
  registerEngineEffects(bundle);
  const character = bundle.characters.get(opts.character);
  if (!character) throw new Error(`unknown character ${opts.character}`);

  const seedLong = seedFromString(opts.seed);
  const registry = new RngRegistry(seedLong);

  const run: RunState = {
    character: opts.character,
    ascension: opts.ascension ?? 0,
    act: 1,
    floor: 1,
    hp: opts.hp ?? character.maxHp,
    maxHp: opts.maxHp ?? character.maxHp,
    gold: 99,
    deck: opts.deck.map((d) => ({ defId: d.defId, upgrades: d.upgrades ?? 0, misc: 0, bottled: false })),
    relics: (opts.relics ?? []).map((defId) => ({ defId, counter: 0 })),
    potions: [null, null, null],
    potionSlots: 3,
    keys: { emerald: false, ruby: false, sapphire: false },
    map: null,
    position: null,
    pools: {
      commonRelics: [],
      uncommonRelics: [],
      rareRelics: [],
      shopRelics: [],
      bossRelics: [],
      monsterList: [],
      eliteList: [],
      bossList: [],
      eventList: [],
      shrineList: [],
      oneTimeEventList: [],
    },
    blizzard: { cardRarityFactor: 5, potionChance: 0, monsterChance: 0.1, shopChance: 0.03, treasureChance: 0.02 },
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

  const combat = buildCombatState(
    run,
    bundle,
    opts.encounterId ?? "TEST",
    opts.monsters,
    character.startingEnergy,
    character.orbSlots,
  );

  const state: GameState = {
    version: 1,
    seed: seedToString(seedLong),
    run,
    combat,
    pending: null,
    rng: registry.saveState(),
    outcome: null,
    eventLog: [],
  };

  const box = makeCtx(state, bundle);
  // reuse the freshly created registry state (identical), run combat init
  initializeCombat(box.ctx);
  runQueue(box.ctx);
  return finish(box);
}

export function advance(prev: GameState, cmd: Command, bundle: ContentBundle): GameState {
  registerEngineEffects(bundle);
  const state = structuredClone(prev);
  state.eventLog = [];
  const box = makeCtx(state, bundle);
  const { ctx } = box;

  if (state.outcome) throw new Error("game is over");

  switch (cmd.cmd) {
    case "playCard": {
      const combat = state.combat;
      if (!combat) throw new Error("not in combat");
      if (state.pending) throw new Error("a choice is pending");
      const iid = combat.player.piles.hand[cmd.handIdx];
      if (iid === undefined) throw new Error(`no card at hand index ${cmd.handIdx}`);
      const c = combat.cards[iid]!;
      const def = bundle.cards.get(c.defId)!;
      // playability
      if (c.cost === -2) throw new Error("unplayable card");
      const cost = c.cost === -1 ? 0 : effectiveCost(ctx, c);
      if (!c.freeToPlayOnce && combat.player.energy < cost) throw new Error("not enough energy");
      if (def.target === "enemy") {
        if (cmd.target === undefined) throw new Error("target required");
        const t = combat.monsters[cmd.target];
        if (!t || t.isDead || t.isEscaped) throw new Error("invalid target");
      }
      const cctx = { ...ctx, card: c, target: cmd.target ?? null, energyOnUse: combat.player.energy, upgraded: c.upgrades > 0 };
      if (def.canUse && !def.canUse(cctx)) throw new Error("card cannot be used now");
      if (!vetoHook(ctx, PLAYER, "canPlayCard", c)) throw new Error("a power or relic prevents playing this card");
      combat.cardQueue.push({
        iid,
        target: cmd.target ?? null,
        energyOnUse: combat.player.energy,
        ignoreEnergyTotal: false,
        regardlessOfCost: false,
        purgeOnUse: false,
        exhaustOnUse: false,
        autoplayed: false,
      });
      runQueue(ctx);
      break;
    }
    case "endTurn": {
      if (!state.combat) throw new Error("not in combat");
      if (state.pending) throw new Error("a choice is pending");
      queueEndTurn(ctx);
      runQueue(ctx);
      break;
    }
    case "choose": {
      const pending = state.pending;
      if (!pending) throw new Error("nothing to choose");
      state.pending = null;
      ctx.rt.pending = null;
      const resume = bundle.effects.get(pending.resume);
      if (!resume) throw new Error(`unknown resume effect ${pending.resume}`);
      resume(ctx, { ...(pending.resumeArgs as object), chosen: cmd.indices });
      if (state.combat) runQueue(ctx); // run-layer choices resolve without an interpreter pass
      break;
    }
    case "usePotion": {
      const run = state.run;
      if (state.pending) throw new Error("a choice is pending");
      const id = run.potions[cmd.slot];
      if (!id) throw new Error(`no potion in slot ${cmd.slot}`);
      const def = bundle.potions.get(id);
      if (!def) throw new Error(`unknown potion ${id}`);
      if (def.targeted) {
        if (!state.combat) throw new Error("targeted potions require combat");
        if (cmd.target === undefined) throw new Error("target required");
        const t = state.combat.monsters[cmd.target];
        if (!t || t.isDead || t.isEscaped) throw new Error("invalid target");
      }
      // refused, not spent: the slot keeps the potion
      if (def.canUse && !def.canUse(ctx)) throw new Error(`${def.name} cannot be used here`);
      run.potions[cmd.slot] = null;
      let potency = def.potency;
      if (def.sacredBarkDoubles && hasRelic(run, "SACRED_BARK")) potency *= 2;
      def.onUse(ctx, cmd.target ?? null, potency);
      fireHook(ctx, PLAYER, "onUsePotion"); // Toy Ornithopter site
      // TODO out-of-combat potions (Fruit Juice / Entropic Brew) must mutate run
      // state directly in their defs; combat-action potions require combat.
      if (state.combat) runQueue(ctx);
      break;
    }
    case "discardPotion": {
      if (!state.run.potions[cmd.slot]) throw new Error(`no potion in slot ${cmd.slot}`);
      state.run.potions[cmd.slot] = null;
      break;
    }
    case "neowPick":
    case "mapPick":
    case "takeReward":
    case "skipRewards":
    case "shopBuy":
    case "shopRemove":
    case "restOption":
    case "openChest":
    case "takeSapphireKey":
    case "eventOption":
    case "proceed":
      handleRunCommand(state, ctx, box.registry, cmd);
      break;
  }

  return finish(box);
}
