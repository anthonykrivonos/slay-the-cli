// Shared helpers for act-1 monster ports. Content-side only (no engine changes):
// thin wrappers over the GameAction queue plus MonsterState scratch accessors.

import type { EffectCtx } from "../../../engine/content/defs";
import type { MonsterState } from "../../../engine/combat/combatState";
import { calcMonsterDamage } from "../../../engine/combat/damageCalc";
import { applyPower } from "../../../engine/combat/powerRuntime";
import { PLAYER, monster } from "../../../engine/core/ids";

/** Queue `hits` attack-damage actions vs the player (damage calc'd once, like the exemplars). */
export function attackPlayer(ctx: EffectCtx, self: MonsterState, base: number, hits = 1): void {
  const dmg = calcMonsterDamage(ctx, self.idx, base);
  for (let i = 0; i < hits; i++) {
    ctx.queue.addToBottom({
      kind: "damage",
      target: PLAYER,
      info: { type: "attack", source: monster(self.idx), amount: dmg },
    });
  }
}

/** Queue a power application onto the monster itself. */
export function selfPower(ctx: EffectCtx, self: MonsterState, powerId: string, amount: number): void {
  ctx.queue.addToBottom({
    kind: "applyPower",
    source: monster(self.idx),
    target: monster(self.idx),
    powerId,
    amount,
  });
}

/**
 * Apply a power to the player SYNCHRONOUSLY (source = this monster, so duration
 * debuffs get justApplied), exactly as the reference applies these inline in
 * takeTurn. A queued application would still resolve this round, but only after
 * the move returns - inline keeps the ordering identical to the reference.
 */
export function playerPower(ctx: EffectCtx, self: MonsterState, powerId: string, amount: number): void {
  applyPower(ctx, monster(self.idx), PLAYER, powerId, amount);
}

/** Queue block gain for the monster itself. */
export function selfBlock(ctx: EffectCtx, self: MonsterState, amount: number): void {
  ctx.queue.addToBottom({ kind: "gainBlock", target: monster(self.idx), amount, fromCard: false });
}

/** Queue n copies of a status/curse card into a player pile (default: discard). */
export function addStatusCards(
  ctx: EffectCtx,
  defId: string,
  n: number,
  upgrades = 0,
  dest: "draw" | "hand" | "discard" = "discard",
): void {
  ctx.queue.addToBottom({ kind: "makeTempCard", defId, upgrades, dest, n });
}

/** Pre-battle direct power push (bypasses the action queue: powers must exist before first-move rolls). */
export function prePower(self: MonsterState, powerId: string, amount: number): void {
  self.powers.push({ id: powerId, amount, justApplied: false, data: null });
}

export function powerAmount(self: MonsterState, powerId: string): number {
  return self.powers.find((p) => p.id === powerId)?.amount ?? 0;
}

export function hasPower(self: MonsterState, powerId: string): boolean {
  return self.powers.some((p) => p.id === powerId);
}

/**
 * Replace a monster's current intent in place (mode shift / split interrupts).
 * The last moveHistory entry is the pending intent (pushed by rollMove), so it
 * is rewritten too - move-chaining getMove implementations key off lastMove.
 */
export function replaceIntent(m: MonsterState, moveId: string): void {
  m.move = moveId;
  if (m.moveHistory.length > 0) m.moveHistory[m.moveHistory.length - 1] = moveId;
  else m.moveHistory.push(moveId);
}

/**
 * Pad ctx.combat.monsters to `length` dense slots with inert escaped placeholders
 * so numeric-slot spawnMonster never creates array holes. Mirrors the reference's
 * fixed 5-slot positional monster array (slime splits land at exact slot indices).
 */
export function padMonsterSlots(ctx: EffectCtx, length: number): void {
  const monsters = ctx.combat!.monsters;
  while (monsters.length < length) {
    monsters.push({
      id: "GAP",
      idx: monsters.length,
      hp: 0,
      maxHp: 0,
      block: 0,
      powers: [],
      move: null,
      moveHistory: [],
      isDead: false,
      isEscaped: true, // never acts, never counted alive, never targetable
      halfDead: false,
      data: {},
    });
  }
}
