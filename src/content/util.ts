// Shared helpers for content modules.

import type { EffectCtx } from "../engine/content/defs";
import type { MonsterState } from "../engine/combat/combatState";

export const hasRelic = (ctx: EffectCtx, id: string): boolean => ctx.run.relics.some((r) => r.defId === id);

export const lastMove = (m: MonsterState): string | undefined => m.moveHistory[m.moveHistory.length - 1];

export const lastTwoMovesWere = (m: MonsterState, move: string): boolean =>
  m.moveHistory.length >= 2 &&
  m.moveHistory[m.moveHistory.length - 1] === move &&
  m.moveHistory[m.moveHistory.length - 2] === move;

export const firstTurn = (m: MonsterState): boolean => m.moveHistory.length === 0;

/** Ascension-tiered value helper: pick the highest tier <= asc. */
export function ascTier<T>(asc: number, base: T, tiers: [number, T][]): T {
  let v = base;
  for (const [level, val] of tiers) {
    if (asc >= level) v = val;
  }
  return v;
}
