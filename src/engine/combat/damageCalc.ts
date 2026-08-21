// Damage & block CALCULATION pipelines with the game's exact stage order and
// float32 rounding discipline. (Application - block absorb, HP loss, triggers -
// lives in the interpreter.)
//
// Card damage (player -> monster), stage order per the game:
//   base -> relic atDamageGive (Strike Dummy/Wrist Blade adds)
//        -> player power atDamageGive in application order (Str/Vigor add,
//           Double Damage x2, Pen Nib x2, Weak x0.75)
//        -> stance give multiplier (Wrath x2, Divinity x3)
//        -> target power atDamageReceive (Slow, Vulnerable x1.5/PaperPhrog x1.75)
//        -> player atDamageFinalGive -> target atDamageFinalReceive
//           (Flight x0.5, Intangible -> min(d,1))
//        -> floor, clamp >= 0
// NOTE: the reference C++ clamps Intangible with max(); the game reduces damage
// to 1 (its player-side path uses min correctly). Adjudicated: min.
//
// Monster damage (monster -> player):
//   (base + monster power atDamageGive: Strength add, Weak x0.75/Paper Krane x0.6,
//    Surrounded x1.5 when not facing)
//        -> player power atDamageReceive (Vulnerable x1.5 / Odd Mushroom x1.25)
//        -> player stance receive multiplier (Wrath x2)
//        -> player power atDamageFinalReceive (Intangible -> min(d,1))
//        -> floor, clamp >= 0

import { f32, f32mul } from "../core/math";
import { foldHookScoped } from "../core/hooks";
import type { EffectCtx } from "../content/defs";
import type { CardInstance } from "./combatState";
import { PLAYER, monster, type ActorRef } from "../core/ids";

export function calcCardDamage(ctx: EffectCtx, card: CardInstance | null, targetIdx: number, base: number): number {
  let d = f32(base);
  d = foldHookScoped(ctx, PLAYER, "relics", "atDamageGive", d, "attack", card);
  d = foldHookScoped(ctx, PLAYER, "powers", "atDamageGive", d, "attack", card);
  d = applyStanceGive(ctx, d);
  d = foldHookScoped(ctx, monster(targetIdx), "powers", "atDamageReceive", d, "attack");
  d = foldHookScoped(ctx, PLAYER, "powers", "atDamageFinalGive", d, "attack");
  d = foldHookScoped(ctx, PLAYER, "relics", "atDamageFinalGive", d, "attack"); // The Boot
  d = foldHookScoped(ctx, monster(targetIdx), "powers", "atDamageFinalReceive", d, "attack");
  return Math.max(0, Math.floor(d));
}

export function calcMonsterDamage(ctx: EffectCtx, sourceIdx: number, base: number): number {
  let d = f32(base);
  d = foldHookScoped(ctx, monster(sourceIdx), "powers", "atDamageGive", d, "attack", null);
  d = foldHookScoped(ctx, PLAYER, "powers", "atDamageReceive", d, "attack");
  d = applyStanceReceive(ctx, d);
  d = foldHookScoped(ctx, PLAYER, "powers", "atDamageFinalReceive", d, "attack");
  return Math.max(0, Math.floor(d));
}

function applyStanceGive(ctx: EffectCtx, d: number): number {
  const stance = ctx.combat ? ctx.bundle.stances.get(ctx.combat.player.stance) : undefined;
  return stance?.damageGiveMultiplier ? f32mul(d, stance.damageGiveMultiplier) : d;
}

function applyStanceReceive(ctx: EffectCtx, d: number): number {
  const stance = ctx.combat ? ctx.bundle.stances.get(ctx.combat.player.stance) : undefined;
  return stance?.damageReceiveMultiplier ? f32mul(d, stance.damageReceiveMultiplier) : d;
}

/** Block gain from a card or effect. Non-card block skips Dex/Frail (flag). */
export function calcBlock(ctx: EffectCtx, base: number, card: CardInstance | null, fromCard: boolean): number {
  let b = f32(base);
  if (fromCard) {
    b = foldHookScoped(ctx, PLAYER, "powers", "modifyBlock", b, card);
  }
  return Math.max(0, Math.floor(b));
}

/** Monster block gain (Dexterity-like monster powers fold here if any). */
export function calcMonsterBlock(ctx: EffectCtx, idx: number, base: number): number {
  const b = foldHookScoped(ctx, monster(idx), "powers", "modifyBlock", f32(base), null);
  return Math.max(0, Math.floor(b));
}
