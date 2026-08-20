// Named effect continuations for the Ironclad card pool (plus the status/curse
// helpers that ride along in the same bundle slice). Two flavors:
//   - deferred effects: enqueued as {kind:"effect"} so their work happens at the
//     right point in the action queue (random targets roll at resolve time);
//   - choose/resume pairs: the *Choose effect builds a card choice from LIVE
//     pile contents and pauses; the resume receives {...resumeArgs, chosen}
//     where chosen holds indices into the request's iids.
// Single-candidate choices auto-resolve, matching the game's grid screens.

import type { EffectCtx, EffectFn } from "../../../engine/content/defs";
import type { GameAction } from "../../../engine/core/actions";
import type { CardInstance, CardQueueItem } from "../../../engine/combat/combatState";
import type { CardInstanceId } from "../../../engine/core/ids";
import { PLAYER, monster } from "../../../engine/core/ids";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { executeAction, exhaustCard, makeTempCard } from "../../../engine/combat/interpreter";
import { moveCard, reshuffleDiscardIntoDraw } from "../../../engine/combat/piles";
import { applyPower, getPower } from "../../../engine/combat/powerRuntime";
import { foldHook } from "../../../engine/core/hooks";

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

/** Can this card be upgraded mid-combat (Armaments)? Statuses/curses never. */
function canUpgradeInCombat(ctx: EffectCtx, c: CardInstance): boolean {
  const def = ctx.bundle.cards.get(c.defId);
  if (!def) return false;
  if (def.type === "status" || def.type === "curse") return false;
  return c.upgrades === 0 || def.keywords.includes("multiUpgrade");
}

/** In-combat upgrade: bump upgrades; sync cost on the 0->1 transition. */
function upgradeInCombat(ctx: EffectCtx, c: CardInstance): void {
  const def = ctx.bundle.cards.get(c.defId);
  if (!def) return;
  c.upgrades++;
  if (c.upgrades === 1 && def.upgradeValues.cost !== undefined) {
    const newCost = def.upgradeValues.cost;
    if (c.costForTurn === c.cost) c.costForTurn = newCost;
    c.cost = newCost;
  }
  ctx.emit("cardUpgraded", { iid: c.iid });
}

/** Build a pick-1 choice over candidates; auto-resolves 0/1-candidate cases. */
function chooseOne(
  ctx: EffectCtx,
  iids: CardInstanceId[],
  pile: "hand" | "discard" | "exhaust",
  reason: string,
  resume: string,
  extraArgs: Record<string, unknown>,
  auto: (iid: CardInstanceId) => void,
): void {
  if (iids.length === 0) return;
  if (iids.length === 1) {
    auto(iids[0]!);
    return;
  }
  // ENGINE-NOTE: advance() rebuilds the runtime slot AND the action queue, so
  // pausing mid-resolution would lose rt.currentItem (exhaustOnUse — keyword or
  // Corruption) and drop every queued action behind this effect (the card's
  // trailing actions, onUseCard hook actions, and the terminal __afterCardUsed).
  // Both are plain data: snapshot them into resumeArgs; the resume restores the
  // item, does the choice work, then replays the tail in order.
  const item = ctx.rt.currentItem ? { ...ctx.rt.currentItem } : null;
  const tail: GameAction[] = [];
  for (let a = ctx.queue.pop(); a !== undefined; a = ctx.queue.pop()) tail.push(a);
  ctx.requestChoice({
    request: { kind: "cards", pile, iids, min: 1, max: 1, canCancel: false, reason },
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

function chosenIid(ctx: EffectCtx, args: unknown): CardInstanceId {
  const { iids, chosen, __item } = args as ResumeArgs;
  if (__item) ctx.rt.currentItem = __item; // see chooseOne
  const iid = iids[chosen[0]!];
  if (iid === undefined) throw new Error("invalid choice index");
  return iid;
}

/** Re-enqueue the actions that were pending behind the pause (see chooseOne). */
function replayTail(ctx: EffectCtx, args: unknown): void {
  for (const a of (args as ResumeArgs).__tail ?? []) ctx.queue.addToBottom(a);
}

// ------------------------------------------------------------------------------
// deferred effects
// ------------------------------------------------------------------------------

/** Juggernaut: X thorns damage to a random enemy, target rolled at resolve time. */
function juggernautHit(ctx: EffectCtx, args: unknown): void {
  const { amount } = args as { amount: number };
  const idx = randomAliveIdx(ctx);
  if (idx === null) return;
  ctx.queue.addToTop({ kind: "damage", target: monster(idx), info: { type: "thorns", source: PLAYER, amount } });
}

/** Sword Boomerang: one hit at a random enemy; per-target calc at resolve time. */
function swordBoomerangHit(ctx: EffectCtx, args: unknown): void {
  const { iid, base } = args as { iid: CardInstanceId; base: number };
  const idx = randomAliveIdx(ctx);
  if (idx === null) return;
  const card = ctx.combat!.cards[iid] ?? null;
  const dmg = calcCardDamage(ctx, card, idx, base);
  ctx.queue.addToTop({ kind: "damage", target: monster(idx), info: { type: "attack", source: PLAYER, amount: dmg } });
}

/**
 * Heal the player inside an effect body. Feed/Reaper must heal even when their
 * damage just ended the combat — runQueue drops queued actions once combatOver
 * is set, so the heal happens synchronously here (onHeal fold still applied).
 */
function healPlayerNow(ctx: EffectCtx, amount: number): void {
  const healed = Math.floor(foldHook(ctx, PLAYER, "onHeal", amount));
  ctx.run.hp = Math.min(ctx.run.maxHp, ctx.run.hp + healed);
}

/** Reaper: AoE damage + heal the total HP the enemies actually lost, atomically. */
function reaperAttack(ctx: EffectCtx, args: unknown): void {
  const { amounts } = args as { amounts: number[] };
  const before = ctx.combat!.monsters.map((m) => m.hp);
  executeAction(ctx, { kind: "damageAllMonsters", amounts, info: { type: "attack", source: PLAYER } });
  let heal = 0;
  ctx.combat!.monsters.forEach((m, i) => {
    heal += Math.max(0, (before[i] ?? m.hp) - m.hp);
  });
  if (heal > 0) healPlayerNow(ctx, heal);
}

/** Feed: damage + on fatal (non-minion) raise max HP and heal, atomically. */
function feedAttack(ctx: EffectCtx, args: unknown): void {
  const { idx, dmg, bonus } = args as { idx: number; dmg: number; bonus: number };
  executeAction(ctx, { kind: "damage", target: monster(idx), info: { type: "attack", source: PLAYER, amount: dmg } });
  const m = ctx.combat!.monsters[idx];
  if (!m || !m.isDead || m.halfDead) return;
  if (ctx.bundle.monsters.get(m.id)?.category === "minion") return;
  ctx.run.maxHp += bonus;
  healPlayerNow(ctx, bonus);
}

/** Combust: each play adds 1 to the end-of-turn HP loss (power data counter). */
function combustStack(ctx: EffectCtx): void {
  const p = getPower(ctx, PLAYER, "COMBUST");
  if (!p) return;
  const prev = (p.data?.hpLoss as number | undefined) ?? 0;
  p.data = { hpLoss: prev + 1 };
}

/** Havoc: play the top card of the draw pile (random target, free) and exhaust it. */
function havocPlayTop(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  const piles = combat.player.piles;
  if (piles.draw.length === 0) {
    if (piles.discard.length === 0) return;
    reshuffleDiscardIntoDraw(ctx); // PlayTopCardAction reshuffles an empty draw pile
    if (piles.draw.length === 0) return;
  }
  // PlayTopCardAction always rolls a random target (cardRandomRng), even when
  // the played card is untargeted — keep the roll for RNG-stream parity.
  const target = randomAliveIdx(ctx);
  if (target === null) return;
  const iid = piles.draw[0]!;
  moveCard(ctx, iid, "limbo");
  combat.cardQueue.unshift({
    iid,
    target,
    energyOnUse: combat.player.energy,
    ignoreEnergyTotal: true,
    regardlessOfCost: true,
    purgeOnUse: false,
    exhaustOnUse: true, // "and Exhaust it" (powers still vanish per engine rules)
    autoplayed: true,
  });
}

// ------------------------------------------------------------------------------
// choose/resume pairs
// ------------------------------------------------------------------------------

/** Armaments: upgraded -> upgrade every upgradable card in hand; base -> pick 1. */
function armamentsChoose(ctx: EffectCtx, args: unknown): void {
  const { all } = args as { all: boolean };
  const combat = ctx.combat!;
  const candidates = combat.player.piles.hand.filter((iid) => canUpgradeInCombat(ctx, combat.cards[iid]!));
  if (all) {
    for (const iid of candidates) upgradeInCombat(ctx, combat.cards[iid]!);
    return;
  }
  chooseOne(ctx, candidates, "hand", "Armaments: upgrade a card", "ironclad/armaments", {}, (iid) =>
    upgradeInCombat(ctx, combat.cards[iid]!),
  );
}

function armamentsResume(ctx: EffectCtx, args: unknown): void {
  upgradeInCombat(ctx, ctx.combat!.cards[chosenIid(ctx, args)]!);
  replayTail(ctx, args);
}

/** Headbutt: put a discard-pile card on top of the draw pile. */
function headbuttChoose(ctx: EffectCtx): void {
  const discard = [...ctx.combat!.player.piles.discard];
  chooseOne(ctx, discard, "discard", "Headbutt: put a card on top of your draw pile", "ironclad/headbutt", {}, (iid) =>
    moveCard(ctx, iid, "draw", "top"),
  );
}

function headbuttResume(ctx: EffectCtx, args: unknown): void {
  moveCard(ctx, chosenIid(ctx, args), "draw", "top");
  replayTail(ctx, args);
}

/** Exhume: return an exhausted card (never another Exhume) to your hand. */
function exhumeChoose(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  const candidates = combat.player.piles.exhaust.filter((iid) => combat.cards[iid]!.defId !== "EXHUME");
  chooseOne(ctx, candidates, "exhaust", "Exhume: return a card to your hand", "ironclad/exhume", {}, (iid) =>
    moveCard(ctx, iid, "hand"),
  );
}

function exhumeResume(ctx: EffectCtx, args: unknown): void {
  moveCard(ctx, chosenIid(ctx, args), "hand");
  replayTail(ctx, args);
}

/** Dual Wield: copy a chosen Attack or Power card into your hand (1 or 2 copies). */
function dualWieldChoose(ctx: EffectCtx, args: unknown): void {
  const { copies } = args as { copies: number };
  const combat = ctx.combat!;
  const candidates = combat.player.piles.hand.filter((iid) => {
    const t = ctx.bundle.cards.get(combat.cards[iid]!.defId)?.type;
    return t === "attack" || t === "power";
  });
  chooseOne(ctx, candidates, "hand", "Dual Wield: choose an Attack or Power", "ironclad/dualWield", { copies }, (iid) =>
    dualWieldCopy(ctx, iid, copies),
  );
}

function dualWieldCopy(ctx: EffectCtx, iid: CardInstanceId, copies: number): void {
  const c = ctx.combat!.cards[iid]!;
  // ENGINE-NOTE: makeTempCard starts misc at 0, so in-combat scratch (Rampage
  // growth) is not carried onto the copy; the game's makeStatEquivalentCopy is.
  ctx.queue.addToTop({ kind: "makeTempCard", defId: c.defId, upgrades: c.upgrades, dest: "hand", n: copies });
}

function dualWieldResume(ctx: EffectCtx, args: unknown): void {
  const { copies } = args as { copies: number };
  dualWieldCopy(ctx, chosenIid(ctx, args), copies);
  replayTail(ctx, args);
}

/** Warcry: after drawing, put a hand card on top of the draw pile. */
function warcryChoose(ctx: EffectCtx): void {
  const hand = [...ctx.combat!.player.piles.hand];
  chooseOne(ctx, hand, "hand", "Warcry: put a card on top of your draw pile", "ironclad/warcry", {}, (iid) =>
    moveCard(ctx, iid, "draw", "top"),
  );
}

function warcryResume(ctx: EffectCtx, args: unknown): void {
  moveCard(ctx, chosenIid(ctx, args), "draw", "top");
  replayTail(ctx, args);
}

/** True Grit (upgraded): exhaust a chosen card in hand. */
function trueGritChoose(ctx: EffectCtx): void {
  const hand = [...ctx.combat!.player.piles.hand];
  chooseOne(ctx, hand, "hand", "True Grit: exhaust a card", "ironclad/trueGrit", {}, (iid) => exhaustCard(ctx, iid));
}

function trueGritResume(ctx: EffectCtx, args: unknown): void {
  exhaustCard(ctx, chosenIid(ctx, args));
  replayTail(ctx, args);
}

/** Burning Pact: exhaust a chosen card (the queued draw resolves afterwards). */
function burningPactChoose(ctx: EffectCtx): void {
  const hand = [...ctx.combat!.player.piles.hand];
  chooseOne(ctx, hand, "hand", "Burning Pact: exhaust a card", "ironclad/burningPact", {}, (iid) =>
    exhaustCard(ctx, iid),
  );
}

function burningPactResume(ctx: EffectCtx, args: unknown): void {
  exhaustCard(ctx, chosenIid(ctx, args));
  replayTail(ctx, args);
}

// ------------------------------------------------------------------------------
// status/curse helpers
// ------------------------------------------------------------------------------

/** Pride: put a copy of itself on TOP of the draw pile (not shuffled in). */
function prideCopy(ctx: EffectCtx, args: unknown): void {
  const { upgrades } = args as { upgrades: number };
  const combat = ctx.combat!;
  const iid = combat.nextCardInstanceId;
  makeTempCard(ctx, "PRIDE", upgrades, "limbo");
  moveCard(ctx, iid, "draw", "top");
}

/**
 * Doubt/Shame: end-of-turn self-debuff. The game passes isSourceMonster=true so
 * the first end-of-round tick is skipped; our applyPower derives justApplied
 * from an actual monster source, so set it explicitly on fresh applications.
 */
function endTurnDebuff(ctx: EffectCtx, args: unknown): void {
  const { powerId, amount } = args as { powerId: string; amount: number };
  const had = getPower(ctx, PLAYER, powerId) !== undefined;
  applyPower(ctx, PLAYER, PLAYER, powerId, amount);
  if (!had) {
    const p = getPower(ctx, PLAYER, powerId);
    if (p) p.justApplied = true;
  }
}

// ------------------------------------------------------------------------------

export const ironcladEffects: Map<string, EffectFn> = new Map<string, EffectFn>([
  ["ironclad/juggernautHit", juggernautHit],
  ["ironclad/swordBoomerangHit", swordBoomerangHit],
  ["ironclad/reaper", reaperAttack],
  ["ironclad/feed", feedAttack],
  ["ironclad/combustStack", combustStack],
  ["ironclad/havoc", havocPlayTop],
  ["ironclad/armamentsChoose", armamentsChoose],
  ["ironclad/armaments", armamentsResume],
  ["ironclad/headbuttChoose", headbuttChoose],
  ["ironclad/headbutt", headbuttResume],
  ["ironclad/exhumeChoose", exhumeChoose],
  ["ironclad/exhume", exhumeResume],
  ["ironclad/dualWieldChoose", dualWieldChoose],
  ["ironclad/dualWield", dualWieldResume],
  ["ironclad/warcryChoose", warcryChoose],
  ["ironclad/warcry", warcryResume],
  ["ironclad/trueGritChoose", trueGritChoose],
  ["ironclad/trueGrit", trueGritResume],
  ["ironclad/burningPactChoose", burningPactChoose],
  ["ironclad/burningPact", burningPactResume],
  ["ironclad/prideCopy", prideCopy],
  ["ironclad/endTurnDebuff", endTurnDebuff],
]);
