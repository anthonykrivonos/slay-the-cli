// Named effect continuations + shared helpers for the Silent card pool.
// Same two flavors as the ironclad/colorless slices (see their effects.ts):
//   - deferred effects: enqueued as {kind:"effect"} so their work happens at
//     the right point in the action queue (random rolls at resolve time);
//   - choose/resume pairs: the *Choose effect builds a choice from LIVE pile
//     contents and pauses; the resume receives {...resumeArgs, chosen}.
// Pauses snapshot rt.currentItem AND the queued tail (see the ENGINE-NOTE in
// cards/ironclad/effects.ts chooseOne); power-hook-driven choices (Well-Laid
// Plans, Tools of the Trade) run through the same plumbing, so the tail also
// carries turn-structure markers like endPlayerTurn.

import type { EffectCtx, EffectFn } from "../../../engine/content/defs";
import type { GameAction, ChoiceRequest } from "../../../engine/core/actions";
import type { CardQueueItem, Pile } from "../../../engine/combat/combatState";
import type { CardInstanceId } from "../../../engine/core/ids";
import { PLAYER, monster } from "../../../engine/core/ids";
import { discardCard } from "../../../engine/combat/interpreter";
import { drawCards, moveCard } from "../../../engine/combat/piles";
import { calcBlock } from "../../../engine/combat/damageCalc";
import { applyPower, getPower } from "../../../engine/combat/powerRuntime";

// ------------------------------------------------------------------------------
// choice plumbing (ironclad/colorless pattern)
// ------------------------------------------------------------------------------

function pauseChoice(ctx: EffectCtx, request: ChoiceRequest, resume: string, extraArgs: Record<string, unknown>): void {
  const item = ctx.rt.currentItem ? { ...ctx.rt.currentItem } : null;
  const tail: GameAction[] = [];
  for (let a = ctx.queue.pop(); a !== undefined; a = ctx.queue.pop()) tail.push(a);
  ctx.requestChoice({ request, resume, resumeArgs: { ...extraArgs, __item: item, __tail: tail } });
}

interface ResumeArgs {
  iids?: CardInstanceId[];
  chosen: number[];
  __item?: CardQueueItem | null;
  __tail?: GameAction[];
}

/** Restore the interrupted card-queue item (see pauseChoice). */
function restoreItem(ctx: EffectCtx, args: unknown): void {
  const { __item } = args as ResumeArgs;
  if (__item) ctx.rt.currentItem = __item;
}

/** Map chosen indices back to instance ids. */
function chosenIids(ctx: EffectCtx, args: unknown): CardInstanceId[] {
  const { iids, chosen } = args as ResumeArgs;
  restoreItem(ctx, args);
  const out: CardInstanceId[] = [];
  for (const i of chosen) {
    const iid = iids?.[i];
    if (iid === undefined) throw new Error("invalid choice index");
    out.push(iid);
  }
  return out;
}

/** Re-enqueue the actions that were pending behind the pause (see pauseChoice). */
function replayTail(ctx: EffectCtx, args: unknown): void {
  for (const a of (args as ResumeArgs).__tail ?? []) ctx.queue.addToBottom(a);
}

/** Mandatory pick-1 over candidates; auto-resolves 0/1-candidate cases. */
function chooseOne(
  ctx: EffectCtx,
  iids: CardInstanceId[],
  pile: Pile,
  reason: string,
  resume: string,
  auto: (iid: CardInstanceId) => void,
): void {
  if (iids.length === 0) return;
  if (iids.length === 1) {
    auto(iids[0]!);
    return;
  }
  pauseChoice(ctx, { kind: "cards", pile, iids, min: 1, max: 1, canCancel: false, reason }, resume, { iids });
}

function aliveMonsters(ctx: EffectCtx) {
  return ctx.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped);
}

// ------------------------------------------------------------------------------
// forced discard (Survivor / Prepared / Acrobatics / Dagger Throw / Concentrate
// / Tools of the Trade) - discard exactly min(n, hand) chosen cards, manually
// ------------------------------------------------------------------------------

function discardChoose(ctx: EffectCtx, args: unknown): void {
  const { n, reason } = args as { n: number; reason: string };
  const hand = [...ctx.combat!.player.piles.hand];
  if (hand.length === 0 || n <= 0) return;
  if (hand.length <= n) {
    // forced: the whole hand goes (the game auto-selects when short)
    for (const iid of hand) discardCard(ctx, iid, true);
    return;
  }
  pauseChoice(
    ctx,
    { kind: "cards", pile: "hand", iids: hand, min: n, max: n, canCancel: false, reason },
    "silent/discard",
    { iids: hand },
  );
}

function discardResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) discardCard(ctx, iid, true);
  replayTail(ctx, args);
}

// ------------------------------------------------------------------------------
// deferred effects
// ------------------------------------------------------------------------------

/** Bouncing Flask: one bounce - poison a random alive enemy (cardRandomRng at resolve time). */
function bouncingFlaskHit(ctx: EffectCtx, args: unknown): void {
  const { amount } = args as { amount: number };
  const alive = aliveMonsters(ctx);
  if (alive.length === 0) return;
  const idx = alive[ctx.rng("cardRandomRng").random(alive.length - 1)]!.idx;
  ctx.queue.addToTop({ kind: "applyPower", source: PLAYER, target: monster(idx), powerId: "POISON", amount });
}

/**
 * Escape Plan: draw 1; if the drawn card is a Skill, gain block. The draw is
 * synchronous so THE drawn card is identified (onDraw hooks may queue further
 * effects, but they cannot add to the hand synchronously).
 */
function escapePlan(ctx: EffectCtx, args: unknown): void {
  const { iid, base } = args as { iid: CardInstanceId; base: number };
  const combat = ctx.combat!;
  const hand = combat.player.piles.hand;
  const before = hand.length;
  drawCards(ctx, 1);
  if (hand.length <= before) return; // no card drawn (empty piles / full hand)
  const drawn = combat.cards[hand[before]!]!;
  if (ctx.bundle.cards.get(drawn.defId)?.type !== "skill") return;
  const card = combat.cards[iid] ?? null;
  const amount = calcBlock(ctx, base, card, true);
  ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount, fromCard: true });
}

/** Unload: discard every non-Attack in the LIVE hand (manual discards). */
function unloadDiscard(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  for (const iid of [...combat.player.piles.hand]) {
    const def = ctx.bundle.cards.get(combat.cards[iid]!.defId);
    if (def?.type === "attack") continue;
    discardCard(ctx, iid, true);
  }
}

// ------------------------------------------------------------------------------
// choose/resume pairs
// ------------------------------------------------------------------------------

/** Setup: put a hand card on TOP of the draw pile; it costs 0 until played. */
function setupMove(ctx: EffectCtx, iid: CardInstanceId): void {
  const c = ctx.combat!.cards[iid]!;
  c.freeToPlayOnce = true; // costs 0 until played (Forethought precedent)
  moveCard(ctx, iid, "draw", "top");
}

function setupChoose(ctx: EffectCtx): void {
  const hand = [...ctx.combat!.player.piles.hand];
  chooseOne(ctx, hand, "hand", "Setup: put a card on top of your draw pile", "silent/setup", (iid) =>
    setupMove(ctx, iid),
  );
}

function setupResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) setupMove(ctx, iid);
  replayTail(ctx, args);
}

/** Nightmare: choose a card; 3 copies arrive at the start of next turn. */
function nightmareMark(ctx: EffectCtx, iid: CardInstanceId): void {
  const c = ctx.combat!.cards[iid]!;
  const entry = { defId: c.defId, upgrades: c.upgrades, n: 3 };
  applyPower(ctx, PLAYER, PLAYER, "NIGHTMARE_POWER", entry.n);
  const p = getPower(ctx, PLAYER, "NIGHTMARE_POWER");
  if (!p) return;
  const entries = (p.data?.entries as (typeof entry)[] | undefined) ?? [];
  entries.push(entry);
  p.data = { entries };
}

function nightmareChoose(ctx: EffectCtx): void {
  const hand = [...ctx.combat!.player.piles.hand];
  chooseOne(ctx, hand, "hand", "Nightmare: choose a card to copy next turn", "silent/nightmare", (iid) =>
    nightmareMark(ctx, iid),
  );
}

function nightmareResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) nightmareMark(ctx, iid);
  replayTail(ctx, args);
}

/** Well-Laid Plans: at end of turn, retain UP TO n chosen cards (min 0). */
function wellLaidPlansChoose(ctx: EffectCtx, args: unknown): void {
  const { n } = args as { n: number };
  const hand = [...ctx.combat!.player.piles.hand];
  if (hand.length === 0 || n <= 0) return;
  pauseChoice(
    ctx,
    {
      kind: "cards",
      pile: "hand",
      iids: hand,
      min: 0,
      max: Math.min(n, hand.length),
      canCancel: false,
      reason: `Well-Laid Plans: retain up to ${n}`,
    },
    "silent/wellLaidPlans",
    { iids: hand },
  );
}

function wellLaidPlansResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) ctx.combat!.cards[iid]!.retainOnce = true;
  replayTail(ctx, args);
}

// ------------------------------------------------------------------------------

export const silentEffects: Map<string, EffectFn> = new Map<string, EffectFn>([
  ["silent/discardChoose", discardChoose],
  ["silent/discard", discardResume],
  ["silent/bouncingFlaskHit", bouncingFlaskHit],
  ["silent/escapePlan", escapePlan],
  ["silent/unloadDiscard", unloadDiscard],
  ["silent/setupChoose", setupChoose],
  ["silent/setup", setupResume],
  ["silent/nightmareChoose", nightmareChoose],
  ["silent/nightmare", nightmareResume],
  ["silent/wellLaidPlansChoose", wellLaidPlansChoose],
  ["silent/wellLaidPlans", wellLaidPlansResume],
]);
