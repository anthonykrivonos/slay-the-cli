// Defect orb runtime: slots, channel (auto-evoke on overflow), evoke, Focus.
// Orb order: index 0 = oldest/leftmost (evokes first). End-of-turn passives fire
// left-to-right; Plasma's passive fires at start of turn instead.

import type { EffectCtx } from "../content/defs";
import type { OrbInstance } from "./combatState";
import { fireHook, foldHookScoped } from "../core/hooks";
import { PLAYER } from "../core/ids";
import { getPowerAmount } from "./powerRuntime";

export function getFocus(ctx: EffectCtx): number {
  const base = getPowerAmount(ctx, PLAYER, "FOCUS");
  return foldHookScoped(ctx, PLAYER, "powers", "modifyFocus", base);
}

/** Passive/evoke value for an orb = base + Focus (Plasma excluded; floor at 0 for output-like orbs). */
export function orbValue(ctx: EffectCtx, orb: OrbInstance, kind: "passive" | "evoke"): number {
  const def = ctx.bundle.orbs.get(orb.id);
  if (!def) return 0;
  const base = kind === "passive" ? def.passiveBase : def.evokeBase;
  if (!def.usesFocus) return base;
  return Math.max(0, base + getFocus(ctx));
}

export function channelOrb(ctx: EffectCtx, orbId: string): void {
  const player = ctx.combat!.player;
  if (player.orbSlots <= 0) return; // no slots: channel fizzles (game behavior without orb slots)
  if (player.orbs.length >= player.orbSlots) {
    evokeOrb(ctx, 1); // overflow auto-evokes the oldest orb once
  }
  player.orbs.push({ id: orbId, amount: 0 });
  fireHook(ctx, PLAYER, "onChannel", orbId);
  ctx.emit("orbChanneled", { orbId });
}

export function evokeOrb(ctx: EffectCtx, times: number): void {
  const player = ctx.combat!.player;
  const orb = player.orbs.shift();
  if (!orb) return;
  const def = ctx.bundle.orbs.get(orb.id);
  for (let i = 0; i < times; i++) {
    def?.onEvoke(ctx, 0);
    fireHook(ctx, PLAYER, "onEvoke", orb.id);
  }
  ctx.emit("orbEvoked", { orbId: orb.id, times });
}

export function changeOrbSlots(ctx: EffectCtx, delta: number): void {
  const player = ctx.combat!.player;
  player.orbSlots = Math.max(0, Math.min(10, player.orbSlots + delta));
  // losing slots evokes nothing; excess orbs are removed rightmost-first (game rule)
  while (player.orbs.length > player.orbSlots) player.orbs.pop();
}

/** End-of-turn orb passives, left to right (Plasma passives run at start of turn). */
export function triggerEndOfTurnOrbs(ctx: EffectCtx): void {
  const player = ctx.combat!.player;
  for (let i = 0; i < player.orbs.length; i++) {
    const orb = player.orbs[i]!;
    const def = ctx.bundle.orbs.get(orb.id);
    if (def && orb.id !== "PLASMA") def.onPassive(ctx, i);
  }
}

export function triggerStartOfTurnOrbs(ctx: EffectCtx): void {
  const player = ctx.combat!.player;
  for (let i = 0; i < player.orbs.length; i++) {
    const orb = player.orbs[i]!;
    const def = ctx.bundle.orbs.get(orb.id);
    if (def && orb.id === "PLASMA") def.onPassive(ctx, i);
  }
}
