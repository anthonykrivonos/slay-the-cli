// Test-only EffectCtx builder + run-walk helpers shared by the run tests.

import type { ContentBundle, EffectCtx } from "../../src/engine/content/defs";
import type { GameState, Command } from "../../src/engine/game";
import { advance } from "../../src/engine/game";
import { ActionQueue } from "../../src/engine/core/queue";
import { RngRegistry } from "../../src/engine/core/rngRegistry";
import { MAP_HEIGHT } from "../../src/engine/run/mapGen";

/** Build a live EffectCtx over a GameState (mutates state.run; call saveRng()
 *  to persist stream positions back into the state). */
export function makeTestCtx(state: GameState, bundle: ContentBundle): { ctx: EffectCtx; registry: RngRegistry; saveRng: () => void } {
  const registry = RngRegistry.fromState(state.rng);
  const ctx: EffectCtx = {
    run: state.run,
    combat: state.combat,
    queue: new ActionQueue(),
    bundle,
    rt: { pending: null, currentItem: null, combatOver: null },
    rng: (stream) => registry.get(stream),
    asc: state.run.ascension,
    emit: () => {},
    requestChoice: () => {},
  };
  return { ctx, registry, saveRng: () => (state.rng = registry.saveState()) };
}

const handNames = (s: GameState): string[] =>
  s.combat!.player.piles.hand.map((iid) => s.combat!.cards[iid]!.defId);

/** Play attacks until the combat ends (test decks are all T_ attacks/skills). */
export function autoWinCombat(s: GameState, bundle: ContentBundle): GameState {
  let guard = 0;
  while (s.combat && !s.outcome) {
    if (guard++ > 400) throw new Error("autoWinCombat stuck");
    const target = s.combat.monsters.findIndex((m) => !m.isDead && !m.isEscaped);
    const names = handNames(s);
    const energy = s.combat.player.energy;
    const atkIdx = names.findIndex((n) => {
      const def = bundle.cards.get(n)!;
      return def.type === "attack" && def.cost >= 0 && def.cost <= energy;
    });
    if (atkIdx !== -1 && target !== -1) {
      s = advance(s, { cmd: "playCard", handIdx: atkIdx, target }, bundle);
    } else {
      s = advance(s, { cmd: "endTurn" }, bundle);
    }
  }
  return s;
}

/** Advance one "step" of a run with a canonical policy (used for full walks). */
export function stepRun(s: GameState, bundle: ContentBundle): GameState {
  const room = s.run.room!;
  switch (room.kind) {
    case "neow":
      return advance(s, { cmd: "neowPick", i: 1 }, bundle); // no-drawback bonus, no sub-screen for most rolls
    case "map": {
      if (s.run.position === null) {
        const row = s.run.map!.rows[0]!;
        const x = row.findIndex((n) => n !== null);
        return advance(s, { cmd: "mapPick", x, y: 0 }, bundle);
      }
      const [px, py] = s.run.position;
      if (py === MAP_HEIGHT - 1) return advance(s, { cmd: "mapPick", x: 3, y: MAP_HEIGHT }, bundle);
      const edges = s.run.map!.rows[py]![px]!.edges;
      return advance(s, { cmd: "mapPick", x: edges[0]!, y: py + 1 }, bundle);
    }
    case "combat":
      return autoWinCombat(s, bundle);
    case "rewards":
      return advance(s, { cmd: "skipRewards" }, bundle);
    case "rest":
    case "shop":
      return advance(s, { cmd: "proceed" }, bundle);
    case "treasure":
      return room.chest.opened
        ? advance(s, { cmd: "proceed" }, bundle)
        : advance(s, { cmd: "openChest" }, bundle);
    case "event":
      return advance(s, { cmd: "eventOption", i: 0 }, bundle);
    case "gameOver":
      throw new Error("run is over");
  }
}

/** Walk until a predicate holds (or fail after maxSteps). */
export function walkUntil(
  s: GameState,
  bundle: ContentBundle,
  done: (s: GameState) => boolean,
  maxSteps = 3000,
): GameState {
  // resolve a possible pending Neow deck choice policy: never triggered by neowPick i=1
  for (let i = 0; i < maxSteps; i++) {
    if (done(s)) return s;
    if (s.pending) {
      const req = s.pending.request;
      const picks = req.kind === "cards" ? req.iids.slice(0, req.min) : [0];
      s = advance(s, { cmd: "choose", indices: picks }, bundle);
      continue;
    }
    s = stepRun(s, bundle);
  }
  throw new Error("walkUntil exceeded maxSteps");
}

/** Record of a full deterministic command trace for replay comparisons. */
export function runSignature(s: GameState): string {
  return JSON.stringify({ run: s.run, rng: s.rng, combat: s.combat, outcome: s.outcome, pending: s.pending });
}
