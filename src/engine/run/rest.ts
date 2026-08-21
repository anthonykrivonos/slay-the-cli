// Rest site: Rest heals 30% of max HP rounded down; Smith upgrades one
// upgradable deck card. (No ascension level changes rest healing; A5 only
// changes the BOSS-transition heal, handled in runFlow.)

import type { EffectCtx } from "../content/defs";
import { fireHook } from "../core/hooks";
import { PLAYER } from "../core/ids";

export const REST = { healFraction: 0.3 } as const;

export function restHealAmount(maxHp: number): number {
  return Math.floor(maxHp * REST.healFraction);
}

export function applyRest(ctx: EffectCtx): void {
  const run = ctx.run;
  run.hp = Math.min(run.maxHp, run.hp + restHealAmount(run.maxHp));
  fireHook(ctx, PLAYER, "onRest");
}

/** A deck card can be smithed if never upgraded, or if it multi-upgrades. */
export function canSmith(ctx: EffectCtx, deckIdx: number): boolean {
  const mc = ctx.run.deck[deckIdx];
  if (!mc) return false;
  const def = ctx.bundle.cards.get(mc.defId);
  if (!def) return false;
  if (def.type === "curse" || def.type === "status") return false;
  return mc.upgrades === 0 || def.keywords.includes("multiUpgrade");
}

export function applySmith(ctx: EffectCtx, deckIdx: number): void {
  if (!canSmith(ctx, deckIdx)) throw new Error(`deck card ${deckIdx} cannot be upgraded`);
  ctx.run.deck[deckIdx]!.upgrades++;
  fireHook(ctx, PLAYER, "onSmith");
}
