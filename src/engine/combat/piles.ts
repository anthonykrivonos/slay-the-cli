// Pile operations. Shuffles use the game's construction: a java.util.Random
// seeded from shuffleRng.randomLong(), applied with Collections.shuffle.
// Draw handles the empty-draw reshuffle and the 10-card hand limit (further
// draws fizzle when the hand is full).

import { JavaRandom, javaShuffle } from "../core/rng";
import { fireHook } from "../core/hooks";
import { PLAYER } from "../core/ids";
import type { CardInstanceId } from "../core/ids";
import type { EffectCtx } from "../content/defs";
import type { CardInstance, Pile } from "./combatState";

export const HAND_LIMIT = 10;

export function card(ctx: EffectCtx, iid: CardInstanceId): CardInstance {
  const c = ctx.combat!.cards[iid];
  if (!c) throw new Error(`no card instance ${iid}`);
  return c;
}

export function pileOf(ctx: EffectCtx, iid: CardInstanceId): Pile | null {
  const piles = ctx.combat!.player.piles;
  for (const p of Object.keys(piles) as Pile[]) {
    if (piles[p].includes(iid)) return p;
  }
  return null;
}

export function removeFromPiles(ctx: EffectCtx, iid: CardInstanceId): void {
  const piles = ctx.combat!.player.piles;
  for (const p of Object.keys(piles) as Pile[]) {
    const idx = piles[p].indexOf(iid);
    if (idx !== -1) piles[p].splice(idx, 1);
  }
}

export function moveCard(
  ctx: EffectCtx,
  iid: CardInstanceId,
  to: Pile,
  position: "top" | "bottom" | "random" = "top",
): void {
  removeFromPiles(ctx, iid);
  const pile = ctx.combat!.player.piles[to];
  if (position === "top") {
    // draw pile: index 0 = top (drawn first)
    to === "draw" ? pile.unshift(iid) : pile.push(iid);
  } else if (position === "bottom") {
    to === "draw" ? pile.push(iid) : pile.unshift(iid);
  } else {
    const idx = ctx.rng("cardRandomRng").random(pile.length);
    pile.splice(idx, 0, iid);
  }
}

/** Shuffle the draw pile in place (the game's java shuffle seeded from shuffleRng). */
export function shuffleDrawPile(ctx: EffectCtx): void {
  const rnd = new JavaRandom(ctx.rng("shuffleRng").randomLong());
  javaShuffle(ctx.combat!.player.piles.draw, rnd);
}

/** Move discard into draw and shuffle; fires onShuffle hooks (Sundial, The Abacus). */
export function reshuffleDiscardIntoDraw(ctx: EffectCtx): void {
  const piles = ctx.combat!.player.piles;
  piles.draw.push(...piles.discard);
  piles.discard.length = 0;
  shuffleDrawPile(ctx);
  fireHook(ctx, PLAYER, "onShuffle");
  ctx.emit("shuffle");
}

/**
 * Draw n cards one at a time: reshuffle when draw is empty; stop entirely if
 * both piles are empty or the hand is full. Fires onDraw hooks + onDrawThis.
 */
export function drawCards(ctx: EffectCtx, n: number): void {
  const piles = ctx.combat!.player.piles;
  for (let i = 0; i < n; i++) {
    if (piles.hand.length >= HAND_LIMIT) {
      ctx.emit("drawFizzled", { remaining: n - i });
      return;
    }
    if (piles.draw.length === 0) {
      if (piles.discard.length === 0) return;
      reshuffleDiscardIntoDraw(ctx);
      if (piles.draw.length === 0) return;
    }
    const iid = piles.draw.shift()!;
    piles.hand.push(iid);
    const c = card(ctx, iid);
    ctx.emit("cardDrawn", { iid });
    fireHook(ctx, PLAYER, "onDraw", c);
    const def = ctx.bundle.cards.get(c.defId);
    if (def?.onDrawThis)
      def.onDrawThis({ ...ctx, card: c, target: null, energyOnUse: 0, upgraded: c.upgrades > 0 });
  }
}
