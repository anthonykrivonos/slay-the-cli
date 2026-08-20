// Intent display numbers — exactly what the game shows: the move's damage run
// through the live calc pipeline (Strength, Weak, Vulnerable-on-player, etc.).
//
// Rather than duplicating per-move damage tables, we DRY-RUN the move's
// execute() against a structuredClone of the state with a throwaway queue and
// a poisoned RNG, then read the enqueued actions without applying them.
// Moves whose preview would need randomness or a choice fall back to
// category-only (the game shows those as plain intents too).

import type { ContentBundle, EffectCtx } from "../content/defs";
import { ActionQueue } from "../core/queue";

export interface IntentInfo {
  kind: string; // MonsterMoveDef.intent category
  moveId: string;
  /** per-hit attack damage aimed at the player (null = not an attack preview) */
  damage: number | null;
  hits: number;
  /** block the monster will gain for itself */
  block: number;
}

export function computeIntent(ctx: EffectCtx, idx: number): IntentInfo | null {
  const combat = ctx.combat;
  if (!combat) return null;
  const m = combat.monsters[idx];
  if (!m || m.isDead || m.isEscaped || m.halfDead || !m.move) return null;
  const def = ctx.bundle.monsters.get(m.id);
  const move = def?.moves[m.move];
  if (!move) return null;

  const fallback: IntentInfo = { kind: move.intent, moveId: m.move, damage: null, hits: 0, block: 0 };
  try {
    const combatClone = structuredClone(combat);
    const runClone = structuredClone(ctx.run);
    const queue = new ActionQueue();
    const dryCtx: EffectCtx = {
      ...ctx,
      run: runClone,
      combat: combatClone,
      queue,
      rng: (() => {
        throw new Error("rng not available in intent dry-run");
      }) as never,
      rt: { pending: null, currentItem: null, combatOver: null },
      emit: () => {},
      requestChoice: () => {
        throw new Error("choice not available in intent dry-run");
      },
    };
    move.execute(dryCtx, combatClone.monsters[idx]!);

    let damage: number | null = null;
    let hits = 0;
    let block = 0;
    for (let a = queue.pop(); a !== undefined; a = queue.pop()) {
      if (a.kind === "damage" && a.target.kind === "player" && a.info.type === "attack") {
        damage = a.info.amount;
        hits++;
      } else if (a.kind === "gainBlock" && a.target.kind === "monster" && a.target.idx === idx) {
        block += a.amount;
      }
    }
    return { kind: move.intent, moveId: m.move, damage, hits, block };
  } catch {
    return fallback; // move preview needs rng/choice: category only, like the game
  }
}

/**
 * UI entry point: intent for every monster slot, computed from a bare
 * GameState (no live RNG needed — the dry-run never rolls).
 */
export function getIntents(
  state: { run: EffectCtx["run"]; combat: EffectCtx["combat"] },
  bundle: ContentBundle,
): (IntentInfo | null)[] {
  if (!state.combat) return [];
  const ctx: EffectCtx = {
    run: state.run,
    combat: state.combat,
    queue: new ActionQueue(),
    bundle,
    rt: { pending: null, currentItem: null, combatOver: null },
    rng: (() => {
      throw new Error("rng not available in intent computation");
    }) as never,
    asc: state.run.ascension,
    emit: () => {},
    requestChoice: () => {
      throw new Error("choice not available in intent computation");
    },
  };
  return state.combat.monsters.map((_, i) => computeIntent(ctx, i));
}
