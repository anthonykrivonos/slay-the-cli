// Shared helpers for act-2 monster ports: re-exports the act-1 queue wrappers
// and adds the multi-slot / minion plumbing the act-2 leaders need.

import type { EffectCtx } from "../../../engine/content/defs";
import type { MonsterState } from "../../../engine/combat/combatState";

export {
  addStatusCards,
  attackPlayer,
  hasPower,
  padMonsterSlots,
  playerPower,
  powerAmount,
  prePower,
  replaceIntent,
  selfBlock,
  selfPower,
} from "../act1/_shared";

export function aliveMonsters(ctx: EffectCtx): MonsterState[] {
  return ctx.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped);
}

export const aliveCount = (ctx: EffectCtx): number => aliveMonsters(ctx).length;

/** MINION_LEADER death: every living MINION-marked monster abandons combat. */
export function escapeMinions(ctx: EffectCtx): void {
  for (const m of ctx.combat!.monsters) {
    if (!m.isDead && !m.isEscaped && m.powers.some((p) => p.id === "MINION")) {
      m.isEscaped = true;
      ctx.emit("monsterEscaped", { idx: m.idx });
    }
  }
}

/** true when a slot can be spawned into (missing, dead corpse, or inert gap). */
export function slotOpen(ctx: EffectCtx, slot: number): boolean {
  const m = ctx.combat!.monsters[slot];
  return !m || m.isDead || m.isEscaped;
}
