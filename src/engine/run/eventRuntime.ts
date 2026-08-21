// Generic event-room interpreter. runFlow delegates here for: room entry
// (EventDef.onEnter setup rolls), the eventOption command (validate against
// enabled(), apply choose()), and event-combat victories (EventDef.onCombatVictory
// builds the event-defined rewards - the standard buildCombatRewards path would
// consume the wrong rng streams).
//
// Unknown / null event ids keep the historical stub behavior: a single implicit
// "leave" option that returns to the map (test bundles rely on this).

import type { EffectCtx, EventOption, EventServices } from "../content/defs";
import type { GameState } from "../game";
import type { RngRegistry } from "../core/rngRegistry";
import { buildCombatState, initializeCombat } from "../combat/setup";
import { runQueue } from "../combat/interpreter";

/** Fire the event's one-time setup (rolls stored into room.data). */
export function enterEventRoom(ctx: EffectCtx): void {
  const room = ctx.run.room;
  if (room?.kind !== "event" || room.eventId === null) return;
  ctx.bundle.events.get(room.eventId)?.onEnter?.(ctx);
}

/** Render the current event screen, or null when the room is a stub (unknown /
 *  exhausted event id). Pure: build() must not roll or mutate. */
export function buildEventScreen(ctx: EffectCtx): { summary: string; options: EventOption[] } | null {
  const room = ctx.run.room;
  if (room?.kind !== "event" || room.eventId === null) return null;
  const def = ctx.bundle.events.get(room.eventId);
  return def ? def.build(ctx) : null;
}

function makeEventServices(state: GameState, ctx: EffectCtx, registry: RngRegistry): EventServices {
  return {
    startCombat(opts): void {
      const run = state.run;
      const room = run.room;
      if (room?.kind !== "event" || room.eventId === null) throw new Error("startCombat outside an event room");
      for (const id of opts.monsters) {
        if (!ctx.bundle.monsters.has(id)) throw new Error(`event combat needs missing monster ${id}`);
      }
      const character = ctx.bundle.characters.get(run.character)!;
      const combat = buildCombatState(
        run,
        ctx.bundle,
        opts.encounterId,
        opts.monsters,
        character.startingEnergy,
        character.orbSlots,
        opts.roomKind,
      );
      state.combat = combat;
      ctx.combat = combat;
      run.room = {
        kind: "combat",
        roomKind: opts.roomKind,
        encounterId: opts.encounterId,
        burningElite: false,
        eventCombat: { eventId: room.eventId, data: room.data },
      };
      // suppressPreBattle: init against a patched monster map with preBattle
      // stripped (only initializeCombat reads it; later turns use the real defs)
      let initCtx = ctx;
      if (opts.suppressPreBattle) {
        const monsters = new Map(ctx.bundle.monsters);
        for (const id of new Set(opts.monsters)) {
          const def = monsters.get(id)!;
          monsters.set(id, { ...def, preBattle: undefined });
        }
        initCtx = { ...ctx, bundle: { ...ctx.bundle, monsters } };
      }
      initializeCombat(initCtx);
      runQueue(initCtx);
    },

    goToBoss(): void {
      const run = state.run;
      const bossId = run.map!.bossId;
      // mirror the boss-door transition: ++floor, reseed floor streams, boss combat
      run.floor++;
      registry.reseedFloorStreams(run.floor);
      const character = ctx.bundle.characters.get(run.character)!;
      const combat = buildCombatState(run, ctx.bundle, bossId, [bossId], character.startingEnergy, character.orbSlots, "boss");
      state.combat = combat;
      ctx.combat = combat;
      // no eventCombat marker: victory takes the normal boss path (act transition)
      run.room = { kind: "combat", roomKind: "boss", encounterId: bossId, burningElite: false };
      initializeCombat(ctx);
      runQueue(ctx);
    },
  };
}

/** Handle `eventOption i`: validate against the built screen and apply. */
export function handleEventOption(state: GameState, ctx: EffectCtx, registry: RngRegistry, i: number): void {
  const run = state.run;
  const room = run.room;
  if (room?.kind !== "event") throw new Error("not in an event");
  const def = room.eventId !== null ? ctx.bundle.events.get(room.eventId) : undefined;
  if (!def) {
    // stub fallback: unknown id / INVALID -> single leave option
    run.room = { kind: "map" };
    return;
  }
  const screen = def.build(ctx);
  const opt = screen.options[i];
  if (!opt) throw new Error(`no event option ${i}`);
  if (!opt.enabled(ctx)) throw new Error(`event option ${i} is unavailable`);
  opt.choose(ctx, makeEventServices(state, ctx, registry));
}

/** Victory of a combat started by an event (room.eventCombat present): clear
 *  combat, keep the fight-count bookkeeping identical to handleCombatVictory,
 *  then let the event define what the victory yields. */
export function handleEventCombatVictory(state: GameState, ctx: EffectCtx): void {
  const run = state.run;
  const room = run.room;
  if (room?.kind !== "combat" || !room.eventCombat) return;
  state.combat = null;
  ctx.combat = null;
  run.history.combatsThisAct++;
  if (room.roomKind === "elite") run.history.eliteKillsThisAct++;
  const def = ctx.bundle.events.get(room.eventCombat.eventId);
  if (def?.onCombatVictory) def.onCombatVictory(ctx, room.encounterId, room.eventCombat.data);
  else run.room = { kind: "map" };
}
