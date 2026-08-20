// Named effect continuations + shared helpers for the Watcher card pool. Same
// two flavors as the ironclad/colorless slices (see cards/ironclad/effects.ts):
//   - deferred effects: enqueued as {kind:"effect"} so their work happens at the
//     right point in the action queue (random rolls at resolve time);
//   - choose/resume pairs: the *Choose effect builds a choice from LIVE pile
//     contents and pauses; the resume receives {...resumeArgs, chosen}.
// Single-candidate mandatory choices auto-resolve, matching the game's grids.

import type { CardDef, EffectCtx, EffectFn } from "../../../engine/content/defs";
import type { GameAction, ChoiceRequest } from "../../../engine/core/actions";
import type { CardQueueItem, PowerInstance } from "../../../engine/combat/combatState";
import type { CardInstanceId } from "../../../engine/core/ids";
import { PLAYER, monster } from "../../../engine/core/ids";
import { executeAction, makeTempCard, queueEndTurn, scryResolve } from "../../../engine/combat/interpreter";
import { moveCard } from "../../../engine/combat/piles";
import { applyPower, getPower } from "../../../engine/combat/powerRuntime";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { changeStance, gainMantra } from "../../../engine/combat/stanceRuntime";
import { gainGoldFolded } from "../colorless/effects";

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

// ------------------------------------------------------------------------------
// choice plumbing (see ironclad/effects.ts chooseOne for the ENGINE-NOTE on why
// the current item + the queued tail must be snapshotted across the pause)
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

// ------------------------------------------------------------------------------
// scry
// ------------------------------------------------------------------------------

/**
 * Scry entry point for all watcher content ("watcher/scryStart", args {n}).
 *
 * ENGINE-GAP: the raw {kind:"scry"} action is unusable from card effects for
 * two reasons, so this effect replaces it (engine untouched):
 *   1. its "__scryResolve" continuation expects {discarded: iids} but the
 *      public choose command supplies {chosen: indices} — the built-in resume
 *      path cannot be driven through advance();
 *   2. the engine's startScry pauses WITHOUT snapshotting the current card
 *      item + queued tail, so a card's post-scry actions (Cut Through Fate's
 *      draw, __afterCardUsed) would be dropped by the pause.
 * This effect mirrors startScry (top-n of draw, no-op when empty — no onScry
 * on an empty scry, matching the engine), pauses via the standard snapshot,
 * and the resume maps chosen->discarded and calls the ENGINE's exported
 * scryResolve so onScry hooks (Nirvana) and onScryThisInDiscard self-triggers
 * (Weave) run with exact engine semantics.
 */
function scryStart(ctx: EffectCtx, args: unknown): void {
  const { n } = args as { n: number };
  if (n <= 0) return;
  const draw = ctx.combat!.player.piles.draw;
  const iids = draw.slice(0, Math.min(n, draw.length));
  if (iids.length === 0) return;
  pauseChoice(ctx, { kind: "scry", iids }, "watcher/scry", { iids });
}

function scryResume(ctx: EffectCtx, args: unknown): void {
  const { iids, chosen } = args as ResumeArgs;
  restoreItem(ctx, args);
  const discarded = (chosen ?? []).map((i) => {
    const iid = iids?.[i];
    if (iid === undefined) throw new Error("invalid scry index");
    return iid;
  });
  scryResolve(ctx, { iids, discarded });
  replayTail(ctx, args);
}

// ------------------------------------------------------------------------------
// mantra (tracked for Brilliance — see MANTRA_GAINED in powers/watcher.ts)
// ------------------------------------------------------------------------------

function mantraTally(ctx: EffectCtx): PowerInstance {
  let p = getPower(ctx, PLAYER, "MANTRA_GAINED");
  if (!p) {
    applyPower(ctx, PLAYER, PLAYER, "MANTRA_GAINED", 0);
    p = getPower(ctx, PLAYER, "MANTRA_GAINED")!;
  }
  return p;
}

/** Fold any raw (untracked) gains since the last checkpoint into the tally. */
function reconcileTally(ctx: EffectCtx, p: PowerInstance): void {
  const data = (p.data ??= { lastSeen: 0 });
  const lastSeen = (data.lastSeen as number | undefined) ?? 0;
  const now = ctx.combat!.player.mantra;
  if (now > lastSeen) p.amount += now - lastSeen;
  data.lastSeen = now;
}

/** "watcher/gainMantra" {n}: tally + engine gain (may enter Divinity). */
function gainMantraTracked(ctx: EffectCtx, args: unknown): void {
  const { n } = args as { n: number };
  const p = mantraTally(ctx);
  reconcileTally(ctx, p);
  p.amount += n;
  // predict the post-gain mantra so a Divinity entry inside gainMantra() nets
  // zero in the tally's onChangeStance reconciliation (already counted here)
  p.data = { ...(p.data ?? {}), lastSeen: ctx.combat!.player.mantra + n };
  gainMantra(ctx, n);
}

/** Brilliance's read: total Mantra gained this combat (reconciled first). */
export function mantraGainedThisCombat(ctx: EffectCtx): number {
  const p = mantraTally(ctx);
  reconcileTally(ctx, p);
  return p.amount;
}

/** "watcher/enterDivinity": direct entry (Blasphemy) — no +10 threshold cross. */
function enterDivinityDirect(ctx: EffectCtx): void {
  const p = getPower(ctx, PLAYER, "MANTRA_GAINED");
  if (p) {
    reconcileTally(ctx, p);
    p.data = { ...(p.data ?? {}), skipDivinity: true };
  }
  changeStance(ctx, "DIVINITY");
  if (p) p.data = { ...(p.data ?? {}), skipDivinity: false, lastSeen: ctx.combat!.player.mantra };
}

// ------------------------------------------------------------------------------
// deferred effects
// ------------------------------------------------------------------------------

/** "watcher/endTurn": Conclude/Meditate/Vault — end the turn at resolve time. */
function endTurnEffect(ctx: EffectCtx): void {
  queueEndTurn(ctx);
}

/** Wallop: damage + gain Block equal to unblocked (HP) damage, atomically. */
function wallopAttack(ctx: EffectCtx, args: unknown): void {
  const { idx, dmg } = args as { idx: number; dmg: number };
  const m = ctx.combat!.monsters[idx];
  if (!m || m.isDead || m.isEscaped) return;
  const before = m.hp;
  executeAction(ctx, { kind: "damage", target: monster(idx), info: { type: "attack", source: PLAYER, amount: dmg } });
  const unblocked = Math.max(0, before - m.hp);
  // plain block, no Dexterity/Frail (the game's direct GainBlockAction)
  if (unblocked > 0) executeAction(ctx, { kind: "gainBlock", target: PLAYER, amount: unblocked, fromCard: false });
}

/** Pressure Points: ALL enemies lose HP equal to their Mark (after applying). */
function pressurePointsTrigger(ctx: EffectCtx): void {
  for (const m of aliveMonsters(ctx)) {
    const amt = getPower(ctx, monster(m.idx), "MARK")?.amount ?? 0;
    if (amt > 0) ctx.queue.addToBottom({ kind: "loseHp", target: monster(m.idx), amount: amt });
  }
}

/** Ragnarok: one hit at a random enemy; per-target calc at resolve time. */
function ragnarokHit(ctx: EffectCtx, args: unknown): void {
  const { iid, base } = args as { iid: CardInstanceId; base: number };
  const idx = randomAliveIdx(ctx);
  if (idx === null) return;
  const card = ctx.combat!.cards[iid] ?? null;
  const dmg = calcCardDamage(ctx, card, idx, base);
  ctx.queue.addToTop({ kind: "damage", target: monster(idx), info: { type: "attack", source: PLAYER, amount: dmg } });
}

/** Judgment: threshold checked at resolve; "set their HP to 0" via HP loss. */
function judgmentEffect(ctx: EffectCtx, args: unknown): void {
  const { idx, threshold } = args as { idx: number; threshold: number };
  const m = ctx.combat!.monsters[idx];
  if (!m || m.isDead || m.isEscaped) return;
  if (m.hp <= threshold) executeAction(ctx, { kind: "loseHp", target: monster(idx), amount: m.hp });
}

/** Lesson Learned: damage + on fatal upgrade a random deck card, atomically. */
function lessonLearnedAttack(ctx: EffectCtx, args: unknown): void {
  const { idx, dmg } = args as { idx: number; dmg: number };
  const m = ctx.combat!.monsters[idx];
  if (!m || m.isDead || m.isEscaped) return;
  executeAction(ctx, { kind: "damage", target: monster(idx), info: { type: "attack", source: PLAYER, amount: dmg } });
  if (!m.isDead || m.halfDead) return;
  // permanent upgrade of a random upgradable master-deck card (miscRng, like
  // the game's LessonLearnedAction over player.masterDeck.getUpgradableCards())
  const candidates = ctx.run.deck
    .map((mc, i) => ({ mc, i }))
    .filter(({ mc }) => {
      const def = ctx.bundle.cards.get(mc.defId);
      if (!def || def.type === "status" || def.type === "curse") return false;
      return mc.upgrades === 0 || def.keywords.includes("multiUpgrade");
    });
  if (candidates.length === 0) return;
  const pick = candidates[ctx.rng("miscRng").random(candidates.length - 1)]!;
  pick.mc.upgrades++;
  ctx.emit("deckCardUpgraded", { deckIdx: pick.i });
}

/** Conjure Blade: shuffle an Expunger with X hits into the draw pile. */
function conjureBlade(ctx: EffectCtx, args: unknown): void {
  const { x } = args as { x: number };
  const combat = ctx.combat!;
  const iid = combat.nextCardInstanceId;
  makeTempCard(ctx, "EXPUNGER", 0, "draw"); // Master Reality upgrade fold applies
  const c = combat.cards[iid];
  if (c) c.misc = x; // Expunger reads hits from misc
}

/** Scrawl: draw until the hand is full (count fixed at resolve time). */
function scrawlDraw(ctx: EffectCtx): void {
  const n = 10 - ctx.combat!.player.piles.hand.length;
  if (n > 0) ctx.queue.addToTop({ kind: "draw", n });
}

// ------------------------------------------------------------------------------
// choose/resume pairs
// ------------------------------------------------------------------------------

/** Meditate: put n discard-pile cards into the hand; they gain Retain (once). */
function meditateChoose(ctx: EffectCtx, args: unknown): void {
  const { n } = args as { n: number };
  const discard = [...ctx.combat!.player.piles.discard];
  if (discard.length === 0) return;
  const take = Math.min(n, discard.length);
  if (discard.length <= take) {
    for (const iid of discard) meditateTake(ctx, iid);
    return;
  }
  pauseChoice(
    ctx,
    { kind: "cards", pile: "discard", iids: discard, min: take, max: take, canCancel: false, reason: "Meditate: put cards into your hand" },
    "watcher/meditate",
    { iids: discard },
  );
}

function meditateTake(ctx: EffectCtx, iid: CardInstanceId): void {
  if (ctx.combat!.player.piles.hand.length >= 10) return; // hand full: stays put
  moveCard(ctx, iid, "hand");
  const c = ctx.combat!.cards[iid];
  if (c) c.retainOnce = true;
}

function meditateResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) meditateTake(ctx, iid);
  replayTail(ctx, args);
}

/**
 * Omniscience: choose a draw-pile card; play it twice (free, autoplayed), the
 * second play exhausts it. ENGINE-NOTE: both plays share one target roll made
 * here (the game re-targets each resolution); a power chosen here vanishes
 * after its first play, so its duplicate fizzles (the game replays a copy).
 */
function omniscienceChoose(ctx: EffectCtx): void {
  const draw = [...ctx.combat!.player.piles.draw];
  if (draw.length === 0) return;
  if (draw.length === 1) {
    omnisciencePlay(ctx, draw[0]!);
    return;
  }
  pauseChoice(
    ctx,
    { kind: "cards", pile: "draw", iids: draw, min: 1, max: 1, canCancel: false, reason: "Omniscience: choose a card to play twice" },
    "watcher/omniscience",
    { iids: draw },
  );
}

function omnisciencePlay(ctx: EffectCtx, iid: CardInstanceId): void {
  const combat = ctx.combat!;
  const c = combat.cards[iid];
  if (!c) return;
  const def = ctx.bundle.cards.get(c.defId);
  const target = def?.target === "enemy" ? randomAliveIdx(ctx) : null;
  if (def?.target === "enemy" && target === null) return;
  const mk = (exhaustOnUse: boolean): CardQueueItem => ({
    iid,
    target,
    energyOnUse: combat.player.energy,
    ignoreEnergyTotal: true,
    regardlessOfCost: true,
    purgeOnUse: false,
    exhaustOnUse,
    autoplayed: true,
  });
  combat.cardQueue.unshift(mk(true)); // second play: "and Exhaust it"
  combat.cardQueue.unshift(mk(false)); // first play resolves first
}

function omniscienceResume(ctx: EffectCtx, args: unknown): void {
  const [iid] = chosenIids(ctx, args);
  if (iid !== undefined) omnisciencePlay(ctx, iid);
  replayTail(ctx, args);
}

/** Foreign Influence: choose 1 of 3 random Attacks of ANY color for the hand. */
function foreignInfluenceChoose(ctx: EffectCtx, args: unknown): void {
  const { zeroCost } = args as { zeroCost: boolean };
  // obtainable attacks of any color (the game's getAnyColorCard(ATTACK) pool);
  // sorted by id for determinism (Discovery/Infernal Blade precedent)
  const pool: CardDef[] = [...ctx.bundle.cards.values()]
    .filter((d) => d.type === "attack" && d.rarity !== "basic" && d.rarity !== "special" && d.rarity !== "curse")
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (pool.length === 0) return;
  const picks: CardDef[] = [];
  let guard = 0;
  while (picks.length < 3 && ++guard < 1000) {
    const c = pool[ctx.rng("cardRandomRng").random(pool.length - 1)]!;
    if (!picks.some((p) => p.id === c.id)) picks.push(c);
    if (picks.length >= pool.length) break;
  }
  pauseChoice(
    ctx,
    { kind: "option", options: picks.map((p) => p.name), reason: "Foreign Influence: choose an Attack to add to your hand" },
    "watcher/foreignInfluence",
    { defIds: picks.map((p) => p.id), zeroCost },
  );
}

function foreignInfluenceResume(ctx: EffectCtx, args: unknown): void {
  const { defIds, zeroCost, chosen } = args as ResumeArgs & { defIds: string[]; zeroCost: boolean };
  restoreItem(ctx, args);
  const defId = defIds[chosen[0]!];
  if (defId !== undefined) {
    const combat = ctx.combat!;
    const iid = combat.nextCardInstanceId;
    makeTempCard(ctx, defId, 0, "hand");
    const c = combat.cards[iid];
    if (c && zeroCost) c.costForTurn = 0; // upgraded: costs 0 this turn
  }
  replayTail(ctx, args);
}

/** Wish: choose one of Plated Armor / Strength / Gold. */
function wishChoose(ctx: EffectCtx, args: unknown): void {
  const { armor, str, gold } = args as { armor: number; str: number; gold: number };
  pauseChoice(
    ctx,
    {
      kind: "option",
      options: [`Gain ${armor} Plated Armor`, `Gain ${str} Strength`, `Gain ${gold} Gold`],
      reason: "Wish: choose one",
    },
    "watcher/wish",
    { armor, str, gold },
  );
}

function wishResume(ctx: EffectCtx, args: unknown): void {
  const { armor, str, gold, chosen } = args as ResumeArgs & { armor: number; str: number; gold: number };
  restoreItem(ctx, args);
  switch (chosen[0]) {
    case 0:
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "PLATED_ARMOR", amount: armor });
      break;
    case 1:
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: str });
      break;
    case 2:
      gainGoldFolded(ctx, gold);
      break;
  }
  replayTail(ctx, args);
}

// ------------------------------------------------------------------------------

export const watcherEffects: Map<string, EffectFn> = new Map<string, EffectFn>([
  ["watcher/scryStart", scryStart],
  ["watcher/scry", scryResume],
  ["watcher/gainMantra", gainMantraTracked],
  ["watcher/enterDivinity", enterDivinityDirect],
  ["watcher/endTurn", endTurnEffect],
  ["watcher/wallop", wallopAttack],
  ["watcher/pressurePoints", pressurePointsTrigger],
  ["watcher/ragnarokHit", ragnarokHit],
  ["watcher/judgment", judgmentEffect],
  ["watcher/lessonLearned", lessonLearnedAttack],
  ["watcher/conjureBlade", conjureBlade],
  ["watcher/scrawl", scrawlDraw],
  ["watcher/meditateChoose", meditateChoose],
  ["watcher/meditate", meditateResume],
  ["watcher/omniscienceChoose", omniscienceChoose],
  ["watcher/omniscience", omniscienceResume],
  ["watcher/foreignInfluenceChoose", foreignInfluenceChoose],
  ["watcher/foreignInfluence", foreignInfluenceResume],
  ["watcher/wishChoose", wishChoose],
  ["watcher/wish", wishResume],
]);
