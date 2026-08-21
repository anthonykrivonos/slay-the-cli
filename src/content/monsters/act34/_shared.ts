// Shared helpers for act-3/4 monster ports. Content-side only (no engine
// changes). The generic queue/power wrappers live in ../act1/_shared; this
// module adds the facilities the Beyond/Ending entities need: synchronous
// status-card creation ("immediately" per the corpus), forced-successor
// bookkeeping (setMove semantics), non-attack damage, suicides, debuff wipes
// and driver-side intent setting for half-dead revive cycles.

import type { EffectCtx } from "../../../engine/content/defs";
import type { MonsterState } from "../../../engine/combat/combatState";
import { makeTempCard } from "../../../engine/combat/interpreter";
import { moveCard } from "../../../engine/combat/piles";
import { removePower } from "../../../engine/combat/powerRuntime";
import { PLAYER, monster } from "../../../engine/core/ids";

/** getMonsterTurnNumber(): 1-based battle turn. During the monster phase of
 *  round N ctx.combat.turn === N; the pre-battle first-move roll sees 0. */
export const turnNumber = (ctx: EffectCtx): number => ctx.combat!.turn;

/** The move executed BEFORE the currently-executing one (moveHistory's last
 *  entry is the current move; len-2 is the previous turn's). */
export const prevMove = (m: MonsterState): string | undefined =>
  m.moveHistory[m.moveHistory.length - 2];

export const lastTwoContain = (m: MonsterState, move: string): boolean =>
  m.moveHistory[m.moveHistory.length - 1] === move ||
  m.moveHistory[m.moveHistory.length - 2] === move;

/** setMove: force the next rolled move (consumed by getMove before any bands;
 *  the engine's rollMove still consumes one aiRng.random(99) - matching the
 *  reference's noOpRollMove parity call). */
export const forceNext = (m: MonsterState, move: string): void => {
  m.data.next = move;
};

export const takeForced = (m: MonsterState): string | undefined => {
  const next = m.data.next as string | undefined;
  if (next !== undefined) delete m.data.next;
  return next;
};

/** Driver-side intent set (half-dead revive cycles run outside rollMove). */
export function setIntent(m: MonsterState, move: string): void {
  m.move = move;
  m.moveHistory.push(move);
  if (m.moveHistory.length > 8) m.moveHistory.shift();
}

/**
 * Create n status cards synchronously (the corpus marks these "executed
 * during the monster turn, not queued"). dest "draw" shuffles into a random
 * position; "drawTop" stacks on top of the draw pile (Spire Spear asc18).
 */
export function statusCardsNow(
  ctx: EffectCtx,
  defId: string,
  n: number,
  dest: "draw" | "discard" | "drawTop",
): void {
  for (let i = 0; i < n; i++) {
    if (dest === "drawTop") {
      makeTempCard(ctx, defId, 0, "discard");
      moveCard(ctx, ctx.combat!.nextCardInstanceId - 1, "draw", "top");
    } else {
      makeTempCard(ctx, defId, 0, dest);
    }
  }
}

/**
 * Non-attack damage to the player (Exploder, Beat of Death): blockable,
 * capped by player Intangible, NOT modified by strength/weak/vulnerable/
 * back-attack. The engine folds atDamageFinalReceive only inside the calc
 * pipelines, so the Intangible cap is applied here at enqueue time (the
 * action resolves within the same move/hook, before Intangible can change).
 */
export function nonAttackDamage(ctx: EffectCtx, sourceIdx: number, amount: number): void {
  const intangible = ctx.combat!.player.powers.some((p) => p.id === "INTANGIBLE" && p.amount > 0);
  ctx.queue.addToBottom({
    kind: "damage",
    target: PLAYER,
    info: { type: "thorns", source: monster(sourceIdx), amount: intangible ? Math.min(amount, 1) : amount },
  });
}

/** Suicide(triggerRelics=true): a real death - on-death triggers fire. */
export function suicide(ctx: EffectCtx, self: MonsterState): void {
  ctx.queue.addToBottom({ kind: "loseHp", target: monster(self.idx), amount: 99999 });
}

/** RemoveDebuffsAction: strips all debuff-kind powers and clamps negative
 *  Strength to 0 (the instance is kept so power fold order is preserved). */
export function removeMonsterDebuffs(ctx: EffectCtx, self: MonsterState): void {
  for (const p of [...self.powers]) {
    const def = ctx.bundle.powers.get(p.id);
    if (def?.kind === "debuff") removePower(ctx, monster(self.idx), p.id);
  }
  const str = self.powers.find((p) => p.id === "STRENGTH");
  if (str && str.amount < 0) str.amount = 0;
}

/** Count of alive (non-corpse, non-fled, non-half-dead) monsters with an id. */
export function aliveCount(ctx: EffectCtx, id: string): number {
  return ctx.combat!.monsters.filter((m) => m.id === id && !m.isDead && !m.isEscaped && !m.halfDead)
    .length;
}
