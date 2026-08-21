// Named effect continuations for the Defect card pool. Same two flavors as the
// ironclad slice: deferred effects (work happens at the right queue position -
// random targets and pile counts resolve at action time) and choose/resume
// pairs (choice built from LIVE pile contents; single/zero-candidate choices
// auto-resolve). All channels and evokes go through trackedChannel/trackedEvoke
// from content/orbs.ts so Dark's stored amount survives the engine's
// shift-before-onEvoke and the per-combat channel tally stays exact.

import type { EffectCtx, EffectFn } from "../../../engine/content/defs";
import type { GameAction } from "../../../engine/core/actions";
import type { CardQueueItem } from "../../../engine/combat/combatState";
import type { CardInstanceId } from "../../../engine/core/ids";
import { PLAYER, monster } from "../../../engine/core/ids";
import { calcCardDamage, calcBlock } from "../../../engine/combat/damageCalc";
import { effectiveCost, executeAction, exhaustCard, makeTempCard } from "../../../engine/combat/interpreter";
import { drawCards, moveCard, shuffleDrawPile } from "../../../engine/combat/piles";
import { orbEffects, trackedChannel, trackedEvoke } from "../../orbs";

// ------------------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------------------

function aliveMonsters(ctx: EffectCtx) {
  return ctx.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped);
}

function randomAliveIdx(ctx: EffectCtx): number | null {
  const alive = aliveMonsters(ctx);
  if (alive.length === 0) return null;
  return alive[ctx.rng("cardRandomRng").random(alive.length - 1)]!.idx;
}

/**
 * Build a pick-n choice over candidates with the ironclad slice's pause-safe
 * snapshot pattern (see cards/ironclad/effects.ts chooseOne for the ENGINE-NOTE:
 * advance() rebuilds the runtime slot and the action queue, so the current card
 * item and the queued tail are stashed in resumeArgs and replayed on resume).
 * n >= candidates auto-resolves on all of them; 0 candidates is a no-op.
 */
function chooseCards(
  ctx: EffectCtx,
  iids: CardInstanceId[],
  pile: "hand" | "draw" | "discard" | "exhaust",
  n: number,
  reason: string,
  resume: string,
  extraArgs: Record<string, unknown>,
  auto: (iid: CardInstanceId) => void,
): void {
  if (iids.length === 0 || n <= 0) return;
  if (iids.length <= n) {
    for (const iid of iids) auto(iid);
    return;
  }
  const item = ctx.rt.currentItem ? { ...ctx.rt.currentItem } : null;
  const tail: GameAction[] = [];
  for (let a = ctx.queue.pop(); a !== undefined; a = ctx.queue.pop()) tail.push(a);
  ctx.requestChoice({
    request: { kind: "cards", pile, iids, min: n, max: n, canCancel: false, reason },
    resume,
    resumeArgs: { ...extraArgs, iids, __item: item, __tail: tail },
  });
}

interface ResumeArgs {
  iids: CardInstanceId[];
  chosen: number[];
  __item?: CardQueueItem | null;
  __tail?: GameAction[];
}

function chosenIids(ctx: EffectCtx, args: unknown): CardInstanceId[] {
  const { iids, chosen, __item } = args as ResumeArgs;
  if (__item) ctx.rt.currentItem = __item;
  return chosen.map((i) => {
    const iid = iids[i];
    if (iid === undefined) throw new Error("invalid choice index");
    return iid;
  });
}

function replayTail(ctx: EffectCtx, args: unknown): void {
  for (const a of (args as ResumeArgs).__tail ?? []) ctx.queue.addToBottom(a);
}

/** Recycle's energy value: current cost; X-cost and unplayable count as 0. */
function costAsEnergy(ctx: EffectCtx, iid: CardInstanceId): number {
  const c = ctx.combat!.cards[iid];
  if (!c) return 0;
  return Math.max(0, effectiveCost(ctx, c));
}

// ------------------------------------------------------------------------------
// orb plumbing effects
// ------------------------------------------------------------------------------

/** Channel n orbs of one type (tracked: tally + Dark evoke snapshot). */
function channelEffect(ctx: EffectCtx, args: unknown): void {
  const { orbId, n } = args as { orbId: string; n?: number };
  for (let i = 0; i < (n ?? 1); i++) trackedChannel(ctx, orbId);
}

/** Evoke the leftmost orb `times` times (Dualcast 2, Multi-Cast X, Recursion 1). */
function evokeEffect(ctx: EffectCtx, args: unknown): void {
  const { times } = args as { times: number };
  trackedEvoke(ctx, times);
}

/** Chill: Channel 1 Frost per enemy alive at resolve time. */
function frostPerEnemy(ctx: EffectCtx): void {
  const n = aliveMonsters(ctx).length;
  for (let i = 0; i < n; i++) trackedChannel(ctx, "FROST");
}

/** Darkness: Channel 1 Dark; upgraded also triggers every Dark orb's passive. */
function darkness(ctx: EffectCtx, args: unknown): void {
  const { plus } = args as { plus: boolean };
  trackedChannel(ctx, "DARK");
  if (!plus) return;
  const orbs = ctx.combat!.player.orbs;
  for (let i = 0; i < orbs.length; i++) {
    if (orbs[i]!.id === "DARK") ctx.bundle.orbs.get("DARK")?.onPassive(ctx, i);
  }
}

/** Fission: remove (base) or Evoke (upgraded) all orbs; energy + draw per orb. */
function fission(ctx: EffectCtx, args: unknown): void {
  const { evoke } = args as { evoke: boolean };
  const player = ctx.combat!.player;
  const count = player.orbs.length;
  if (count === 0) return;
  if (evoke) {
    for (let i = 0; i < count; i++) trackedEvoke(ctx, 1);
  } else {
    player.orbs.length = 0; // removed, not Evoked: no evoke triggers
  }
  ctx.queue.addToBottom({ kind: "gainEnergy", n: count });
  ctx.queue.addToBottom({ kind: "draw", n: count });
}

/**
 * Recursion: Evoke the leftmost orb, then Channel an orb of the same type.
 * The game re-channels the same orb instance, so a Dark orb KEEPS its
 * accumulated evoke damage - restored onto the fresh instance here.
 */
function recursion(ctx: EffectCtx): void {
  const player = ctx.combat!.player;
  const first = player.orbs[0];
  if (!first) return;
  const { id, amount } = first;
  trackedEvoke(ctx, 1);
  trackedChannel(ctx, id);
  const rechanneled = player.orbs[player.orbs.length - 1];
  if (rechanneled && rechanneled.id === id) rechanneled.amount = amount;
}

// ------------------------------------------------------------------------------
// deferred effects
// ------------------------------------------------------------------------------

/** One hit at a random enemy, per-target calc at resolve (Thunder Strike, Rip and Tear). */
function randomHit(ctx: EffectCtx, args: unknown): void {
  const { iid, base } = args as { iid: CardInstanceId; base: number };
  const idx = randomAliveIdx(ctx);
  if (idx === null) return;
  const card = ctx.combat!.cards[iid] ?? null;
  const dmg = calcCardDamage(ctx, card, idx, base);
  ctx.queue.addToTop({ kind: "damage", target: monster(idx), info: { type: "attack", source: PLAYER, amount: dmg } });
}

/** Melter: remove all Block from the target before the damage lands. */
function melterBlock(ctx: EffectCtx, args: unknown): void {
  const { idx } = args as { idx: number };
  const m = ctx.combat!.monsters[idx];
  if (m && !m.isDead && !m.isEscaped) m.block = 0;
}

/** Auto-Shields: gain Block only if the player has none (checked at resolve). */
function autoShields(ctx: EffectCtx, args: unknown): void {
  const { iid, base } = args as { iid: CardInstanceId; base: number };
  if (ctx.combat!.player.block > 0) return;
  const card = ctx.combat!.cards[iid] ?? null;
  const block = calcBlock(ctx, base, card, true);
  ctx.queue.addToTop({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
}

/** Stack: Block = discard pile size (+3 upgraded), counted at resolve. */
function stackBlock(ctx: EffectCtx, args: unknown): void {
  const { iid, bonus } = args as { iid: CardInstanceId; bonus: number };
  const card = ctx.combat!.cards[iid] ?? null;
  const block = calcBlock(ctx, ctx.combat!.player.piles.discard.length + bonus, card, true);
  ctx.queue.addToTop({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
}

/** Aggregate: energy = floor(draw pile size / divisor), counted at resolve. */
function aggregate(ctx: EffectCtx, args: unknown): void {
  const { divisor } = args as { divisor: number };
  const n = Math.floor(ctx.combat!.player.piles.draw.length / divisor);
  if (n > 0) ctx.queue.addToTop({ kind: "gainEnergy", n });
}

/** Double Energy. */
function doubleEnergy(ctx: EffectCtx): void {
  ctx.combat!.player.energy *= 2;
}

/** Sunder: damage + 3 Energy if it kills, atomically (Feed pattern). */
function sunder(ctx: EffectCtx, args: unknown): void {
  const { idx, dmg } = args as { idx: number; dmg: number };
  executeAction(ctx, { kind: "damage", target: monster(idx), info: { type: "attack", source: PLAYER, amount: dmg } });
  const m = ctx.combat!.monsters[idx];
  if (!m || !m.isDead || m.halfDead) return;
  executeAction(ctx, { kind: "gainEnergy", n: 3 });
}

/** Scrape: draw n, then discard everything drawn that does not cost 0. */
function scrape(ctx: EffectCtx, args: unknown): void {
  const { n } = args as { n: number };
  const hand = ctx.combat!.player.piles.hand;
  const before = hand.length;
  drawCards(ctx, n);
  const drawn = hand.slice(before); // drawCards appends to the end of the hand
  for (const iid of drawn) {
    const c = ctx.combat!.cards[iid]!;
    if (effectiveCost(ctx, c) !== 0) {
      ctx.queue.addToBottom({ kind: "discard", sel: { kind: "iid", iid }, manual: true });
    }
  }
}

/**
 * Reboot: shuffle hand + discard into the draw pile (exhaust stays out, and
 * Reboot itself is resolving in limbo), then draw. ENGINE-NOTE: like the game's
 * bespoke shuffle this does not fire onShuffle relic triggers.
 */
function reboot(ctx: EffectCtx, args: unknown): void {
  const { draw } = args as { draw: number };
  const piles = ctx.combat!.player.piles;
  piles.draw.push(...piles.hand.splice(0));
  piles.draw.push(...piles.discard.splice(0));
  shuffleDrawPile(ctx);
  drawCards(ctx, draw);
}

/** All for One: every current-cost-0 card in the discard pile to hand (up to 10). */
function allForOne(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  for (const iid of [...combat.player.piles.discard]) {
    if (combat.player.piles.hand.length >= 10) return;
    const c = combat.cards[iid]!;
    if (effectiveCost(ctx, c) === 0) moveCard(ctx, iid, "hand");
  }
}

/** Streamline: permanently (this combat) reduce the card's cost by 1. */
function reduceCostForCombat(ctx: EffectCtx, args: unknown): void {
  const { iid } = args as { iid: CardInstanceId };
  const c = ctx.combat!.cards[iid];
  if (!c || c.cost < 0) return;
  c.cost = Math.max(0, c.cost - 1);
  c.costForTurn = Math.max(0, c.costForTurn - 1);
}

/** Rebound (power) deferred move: draw-top only if the card ended in the discard. */
function reboundMove(ctx: EffectCtx, args: unknown): void {
  const { iid } = args as { iid: CardInstanceId };
  if (ctx.combat!.player.piles.discard.includes(iid)) moveCard(ctx, iid, "draw", "top");
}

/** Rebound (card): arm the power's self-skip so it doesn't rebound itself. */
function reboundArm(ctx: EffectCtx): void {
  const p = ctx.combat!.player.powers.find((q) => q.id === "REBOUND");
  if (!p) return;
  const skip = (p.data?.skip as number | undefined) ?? 0;
  p.data = { ...p.data, skip: skip + 1 };
}

/**
 * Hello World / Creative AI / White Noise card creation. Pools filter the blue
 * class pool (like the game's returnTrulyRandomCardInCombat), sorted by id for
 * determinism (ENGINE-NOTE: the game's library order differs, so specific
 * cardRandomRng rolls map to different cards - same caveat as Infernal Blade).
 */
function addRandomCard(ctx: EffectCtx, args: unknown): void {
  const { pool, n, costZeroThisTurn } = args as { pool: "common" | "power"; n: number; costZeroThisTurn?: boolean };
  const candidates = [...ctx.bundle.cards.values()]
    .filter((d) =>
      d.color === "blue" &&
      d.rarity !== "basic" &&
      d.rarity !== "special" &&
      (pool === "common" ? d.rarity === "common" : d.type === "power"),
    )
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (candidates.length === 0) return;
  const combat = ctx.combat!;
  for (let i = 0; i < n; i++) {
    const pick = candidates[ctx.rng("cardRandomRng").random(candidates.length - 1)]!;
    const iid = combat.nextCardInstanceId;
    makeTempCard(ctx, pick.id, 0, "hand");
    if (costZeroThisTurn) {
      const c = combat.cards[iid];
      if (c) c.costForTurn = 0;
    }
  }
}

// ------------------------------------------------------------------------------
// choose/resume pairs
// ------------------------------------------------------------------------------

/** Seek: put n chosen cards from the draw pile into your hand. */
function seekChoose(ctx: EffectCtx, args: unknown): void {
  const { n } = args as { n: number };
  const draw = [...ctx.combat!.player.piles.draw];
  chooseCards(ctx, draw, "draw", n, "Seek: put a card into your hand", "defect/seek", {}, (iid) =>
    moveCard(ctx, iid, "hand"),
  );
}

function seekResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) moveCard(ctx, iid, "hand");
  replayTail(ctx, args);
}

/** Hologram: put a card from the discard pile into your hand. */
function hologramChoose(ctx: EffectCtx): void {
  const discard = [...ctx.combat!.player.piles.discard];
  chooseCards(ctx, discard, "discard", 1, "Hologram: put a card into your hand", "defect/hologram", {}, (iid) =>
    moveCard(ctx, iid, "hand"),
  );
}

function hologramResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) moveCard(ctx, iid, "hand");
  replayTail(ctx, args);
}

/** Recycle: exhaust a chosen card, gain Energy equal to its (current) cost. */
function recycleChoose(ctx: EffectCtx): void {
  const hand = [...ctx.combat!.player.piles.hand];
  chooseCards(ctx, hand, "hand", 1, "Recycle: exhaust a card", "defect/recycle", {}, (iid) => {
    const e = costAsEnergy(ctx, iid);
    exhaustCard(ctx, iid);
    if (e > 0) ctx.queue.addToBottom({ kind: "gainEnergy", n: e });
  });
}

function recycleResume(ctx: EffectCtx, args: unknown): void {
  const [iid] = chosenIids(ctx, args);
  if (iid !== undefined) {
    const e = costAsEnergy(ctx, iid);
    exhaustCard(ctx, iid);
    if (e > 0) ctx.queue.addToBottom({ kind: "gainEnergy", n: e });
  }
  replayTail(ctx, args);
}

// ------------------------------------------------------------------------------

export const defectEffects: Map<string, EffectFn> = new Map<string, EffectFn>([
  ...orbEffects,
  ["defect/channel", channelEffect],
  ["defect/evoke", evokeEffect],
  ["defect/frostPerEnemy", frostPerEnemy],
  ["defect/darkness", darkness],
  ["defect/fission", fission],
  ["defect/recursion", recursion],
  ["defect/randomHit", randomHit],
  ["defect/melterBlock", melterBlock],
  ["defect/autoShields", autoShields],
  ["defect/stackBlock", stackBlock],
  ["defect/aggregate", aggregate],
  ["defect/doubleEnergy", doubleEnergy],
  ["defect/sunder", sunder],
  ["defect/scrape", scrape],
  ["defect/reboot", reboot],
  ["defect/allForOne", allForOne],
  ["defect/reduceCostForCombat", reduceCostForCombat],
  ["defect/reboundMove", reboundMove],
  ["defect/reboundArm", reboundArm],
  ["defect/addRandomCard", addRandomCard],
  ["defect/seekChoose", seekChoose],
  ["defect/seek", seekResume],
  ["defect/hologramChoose", hologramChoose],
  ["defect/hologram", hologramResume],
  ["defect/recycleChoose", recycleChoose],
  ["defect/recycle", recycleResume],
]);
