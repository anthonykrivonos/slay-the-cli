// Named effect continuations + shared helpers for the colorless card pool.
// Same two flavors as the ironclad slice (see cards/ironclad/effects.ts):
//   - deferred effects: enqueued as {kind:"effect"} so their work happens at the
//     right point in the action queue (random rolls at resolve time);
//   - choose/resume pairs: the *Choose effect builds a choice from LIVE pile
//     contents and pauses; the resume receives {...resumeArgs, chosen}.
// Single-candidate mandatory choices auto-resolve, matching the game's grids.

import type { CardDef, EffectCtx, EffectFn } from "../../../engine/content/defs";
import type { GameAction, ChoiceRequest } from "../../../engine/core/actions";
import type { CardInstance, CardQueueItem, Pile } from "../../../engine/combat/combatState";
import type { CardInstanceId } from "../../../engine/core/ids";
import { PLAYER, monster } from "../../../engine/core/ids";
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

function classColor(ctx: EffectCtx): "red" | "green" | "blue" | "purple" {
  switch (ctx.run.character) {
    case "SILENT":
      return "green";
    case "DEFECT":
      return "blue";
    case "WATCHER":
      return "purple";
    default:
      return "red";
  }
}

/**
 * Obtainable class card pool (common/uncommon/rare), optionally filtered by
 * type — the game's returnTrulyRandomCardInCombat(type). ENGINE-NOTE: pool
 * sorted by id for determinism (Infernal Blade precedent); the game's library
 * order differs, so specific rolls map to different cards even with an
 * identical cardRandomRng stream.
 */
function classPool(ctx: EffectCtx, type?: "attack" | "skill"): CardDef[] {
  const color = classColor(ctx);
  return [...ctx.bundle.cards.values()]
    .filter(
      (d) =>
        d.color === color &&
        (!type || d.type === type) &&
        d.rarity !== "basic" &&
        d.rarity !== "special" &&
        d.rarity !== "curse",
    )
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Obtainable colorless pool (uncommon + rare) — returnTrulyRandomColorlessCardInCombat. */
function colorlessPool(ctx: EffectCtx): CardDef[] {
  return [...ctx.bundle.cards.values()]
    .filter((d) => d.color === "colorless" && (d.rarity === "uncommon" || d.rarity === "rare"))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * Add n random obtainable colorless cards to the hand (Jack of All Trades,
 * Magnetism, Transmutation). Each pick rolls cardRandomRng independently
 * (duplicates possible, like the game's per-copy returnTrulyRandom... calls).
 */
export function addRandomColorlessToHand(
  ctx: EffectCtx,
  n: number,
  opts?: { upgraded?: boolean; zeroCostThisTurn?: boolean },
): void {
  const pool = colorlessPool(ctx);
  if (pool.length === 0) return;
  const combat = ctx.combat!;
  for (let i = 0; i < n; i++) {
    const pick = pool[ctx.rng("cardRandomRng").random(pool.length - 1)]!;
    const iid = combat.nextCardInstanceId;
    makeTempCard(ctx, pick.id, opts?.upgraded ? 1 : 0, "hand");
    const c = combat.cards[iid];
    if (!c) continue;
    if (opts?.upgraded && pick.upgradeValues.cost !== undefined) {
      // ENGINE-NOTE: makeTempCard seeds cost from def.cost; sync the upgraded cost
      c.cost = pick.upgradeValues.cost;
      c.costForTurn = pick.upgradeValues.cost;
    }
    if (opts?.zeroCostThisTurn) c.costForTurn = 0; // costs 0 this turn
  }
}

/**
 * Chrysalis / Metamorphosis: shuffle n random class skills/attacks into the
 * draw pile; they cost 0 for the rest of the combat. Rolls + random draw-pile
 * positions consume cardRandomRng (MakeTempCardInDrawPileAction random spot).
 */
export function addClassCardsToDrawCostZero(ctx: EffectCtx, n: number, type: "attack" | "skill"): void {
  const pool = classPool(ctx, type);
  if (pool.length === 0) return;
  const combat = ctx.combat!;
  for (let i = 0; i < n; i++) {
    const pick = pool[ctx.rng("cardRandomRng").random(pool.length - 1)]!;
    const iid = combat.nextCardInstanceId;
    makeTempCard(ctx, pick.id, 0, "draw");
    const c = combat.cards[iid];
    if (c) {
      c.cost = 0; // costs 0 this combat
      c.costForTurn = 0;
    }
  }
}

/** Gold gain folded through onGainGold (Ectoplasm zeroes it, Bloody Idol heals). */
export function gainGoldFolded(ctx: EffectCtx, amount: number): void {
  const n = Math.floor(foldHook(ctx, PLAYER, "onGainGold", amount));
  if (n > 0) ctx.run.gold += n;
}

/** Can this card be upgraded mid-combat (Apotheosis)? Statuses/curses never. */
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

// ------------------------------------------------------------------------------
// deferred effects
// ------------------------------------------------------------------------------

/** Apotheosis: upgrade every upgradable card in every pile, for this combat. */
function apotheosisUpgradeAll(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  // the game's ApotheosisAction covers hand + draw + discard + exhaust (the
  // resolving Apotheosis itself sits in limbo and is skipped)
  for (const pile of ["draw", "hand", "discard", "exhaust"] as const) {
    for (const iid of [...combat.player.piles[pile]]) {
      const c = combat.cards[iid]!;
      if (canUpgradeInCombat(ctx, c)) upgradeInCombat(ctx, c);
    }
  }
}

/** Magnetism / Transmutation resolve point: n random colorless cards to hand. */
function addRandomColorlessEffect(ctx: EffectCtx, args: unknown): void {
  const { n, upgraded, zeroCostThisTurn } = args as { n: number; upgraded?: boolean; zeroCostThisTurn?: boolean };
  addRandomColorlessToHand(ctx, n, { upgraded, zeroCostThisTurn });
}

/**
 * Madness: a random card in hand costs 0 for the rest of combat. Exact port of
 * MadnessAction: re-rolls the full hand until an eligible (cost > 0) card is
 * hit, consuming cardRandomRng per roll (X-cost and 0-cost cards re-roll).
 */
function madnessZeroCost(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  const hand = combat.player.piles.hand;
  if (!hand.some((iid) => combat.cards[iid]!.cost > 0)) return;
  let c = combat.cards[hand[ctx.rng("cardRandomRng").random(hand.length - 1)]!]!;
  let guard = 0;
  while (c.cost <= 0 && ++guard < 1000) {
    c = combat.cards[hand[ctx.rng("cardRandomRng").random(hand.length - 1)]!]!;
  }
  c.cost = 0;
  c.costForTurn = 0;
  ctx.emit("cardCostModified", { iid: c.iid });
}

/**
 * Mayhem: play the top card of the draw pile (free, random target, NOT
 * exhausted — contrast Havoc). PlayTopCardAction reshuffles an empty draw pile
 * and always rolls a random target even for untargeted cards (RNG parity).
 * Items are PUSHED (not unshifted) so multi-stack Mayhem plays keep pile order.
 */
function mayhemPlayTop(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  const piles = combat.player.piles;
  if (piles.draw.length === 0) {
    if (piles.discard.length === 0) return;
    reshuffleDiscardIntoDraw(ctx);
    if (piles.draw.length === 0) return;
  }
  const target = randomAliveIdx(ctx);
  if (target === null) return;
  const iid = piles.draw[0]!;
  moveCard(ctx, iid, "limbo");
  combat.cardQueue.push({
    iid,
    target,
    energyOnUse: combat.player.energy,
    ignoreEnergyTotal: true,
    regardlessOfCost: true,
    purgeOnUse: false,
    exhaustOnUse: false,
    autoplayed: true,
  });
}

interface BombEntry {
  turns: number;
  damage: number;
}

/**
 * The Bomb: register a 3-turn fuse on the THE_BOMB power. ENGINE-NOTE: the
 * game holds one TheBombPower instance PER cast (its addPower special-cases
 * stacking); our power runtime keys instances by id, so extra casts append
 * independent fuses to the single instance's data instead.
 */
function theBombApply(ctx: EffectCtx, args: unknown): void {
  const { damage } = args as { damage: number };
  const existing = getPower(ctx, PLAYER, "THE_BOMB");
  if (existing) {
    const bombs = (existing.data?.bombs as BombEntry[] | undefined) ?? [];
    bombs.push({ turns: 3, damage });
    existing.data = { bombs };
    return;
  }
  applyPower(ctx, PLAYER, PLAYER, "THE_BOMB", 3); // amount displays turns remaining
  const p = getPower(ctx, PLAYER, "THE_BOMB");
  if (p) p.data = { bombs: [{ turns: 3, damage }] };
}

/** Hand of Greed: damage + gold on fatal (non-minion), atomically (Feed pattern). */
function handOfGreedAttack(ctx: EffectCtx, args: unknown): void {
  const { idx, dmg, gold } = args as { idx: number; dmg: number; gold: number };
  executeAction(ctx, { kind: "damage", target: monster(idx), info: { type: "attack", source: PLAYER, amount: dmg } });
  const m = ctx.combat!.monsters[idx];
  if (!m || !m.isDead || m.halfDead) return;
  if (ctx.bundle.monsters.get(m.id)?.category === "minion") return;
  gainGoldFolded(ctx, gold);
}

/**
 * Ritual Dagger: damage + on fatal (non-minion) permanently grow this card's
 * damage: in-combat instance misc AND the master-deck copy via masterIdx.
 */
function ritualDaggerAttack(ctx: EffectCtx, args: unknown): void {
  const { idx, iid, dmg, bonus } = args as { idx: number; iid: CardInstanceId; dmg: number; bonus: number };
  executeAction(ctx, { kind: "damage", target: monster(idx), info: { type: "attack", source: PLAYER, amount: dmg } });
  const m = ctx.combat!.monsters[idx];
  if (!m || !m.isDead || m.halfDead) return;
  if (ctx.bundle.monsters.get(m.id)?.category === "minion") return;
  const c = ctx.combat!.cards[iid];
  if (!c) return;
  c.misc += bonus;
  if (c.masterIdx !== null) {
    const master = ctx.run.deck[c.masterIdx];
    if (master) master.misc += bonus;
  }
}

/** Violence-style helper: n random Attacks from the draw pile into the hand. */
export function violencePull(ctx: EffectCtx, n: number): void {
  const combat = ctx.combat!;
  const candidates = combat.player.piles.draw.filter(
    (iid) => ctx.bundle.cards.get(combat.cards[iid]!.defId)?.type === "attack",
  );
  const picked: CardInstanceId[] = [];
  for (let i = 0; i < n && candidates.length > 0; i++) {
    const idx = ctx.rng("cardRandomRng").random(candidates.length - 1);
    picked.push(candidates.splice(idx, 1)[0]!);
  }
  for (const iid of picked) {
    if (combat.player.piles.hand.length < 10) moveCard(ctx, iid, "hand");
  }
}

function violenceEffect(ctx: EffectCtx, args: unknown): void {
  const { n } = args as { n: number };
  violencePull(ctx, n);
}

// ------------------------------------------------------------------------------
// choose/resume pairs
// ------------------------------------------------------------------------------

/** Discovery: choose 1 of 3 distinct random class cards; it costs 0 this turn. */
function discoveryChoose(ctx: EffectCtx): void {
  const pool = classPool(ctx);
  if (pool.length === 0) return;
  const picks: CardDef[] = [];
  let guard = 0;
  // DiscoveryAction re-rolls duplicates until 3 distinct cards are generated
  while (picks.length < 3 && ++guard < 1000) {
    const c = pool[ctx.rng("cardRandomRng").random(pool.length - 1)]!;
    if (!picks.some((p) => p.id === c.id)) picks.push(c);
  }
  if (picks.length === 0) return;
  pauseChoice(
    ctx,
    { kind: "option", options: picks.map((p) => p.name), reason: "Discovery: choose a card to add to your hand" },
    "colorless/discovery",
    { defIds: picks.map((p) => p.id) },
  );
}

function discoveryResume(ctx: EffectCtx, args: unknown): void {
  const { defIds, chosen } = args as ResumeArgs & { defIds: string[] };
  restoreItem(ctx, args);
  const defId = defIds[chosen[0]!];
  if (defId !== undefined) {
    const combat = ctx.combat!;
    const iid = combat.nextCardInstanceId;
    makeTempCard(ctx, defId, 0, "hand");
    const c = combat.cards[iid];
    if (c) c.costForTurn = 0; // costs 0 this turn
  }
  replayTail(ctx, args);
}

/** Secret Technique: put a Skill from the draw pile into your hand. */
function secretTechniqueChoose(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  const skills = combat.player.piles.draw.filter(
    (iid) => ctx.bundle.cards.get(combat.cards[iid]!.defId)?.type === "skill",
  );
  chooseOne(ctx, skills, "draw", "Secret Technique: put a Skill into your hand", "colorless/secretTechnique", (iid) =>
    moveCard(ctx, iid, "hand"),
  );
}

function secretTechniqueResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) moveCard(ctx, iid, "hand");
  replayTail(ctx, args);
}

/** Secret Weapon: put an Attack from the draw pile into your hand. */
function secretWeaponChoose(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  const attacks = combat.player.piles.draw.filter(
    (iid) => ctx.bundle.cards.get(combat.cards[iid]!.defId)?.type === "attack",
  );
  chooseOne(ctx, attacks, "draw", "Secret Weapon: put an Attack into your hand", "colorless/secretWeapon", (iid) =>
    moveCard(ctx, iid, "hand"),
  );
}

function secretWeaponResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) moveCard(ctx, iid, "hand");
  replayTail(ctx, args);
}

/** Thinking Ahead (after the draw): put a hand card on top of the draw pile. */
function putOnDrawTopChoose(ctx: EffectCtx): void {
  const hand = [...ctx.combat!.player.piles.hand];
  chooseOne(ctx, hand, "hand", "Thinking Ahead: put a card on top of your draw pile", "colorless/putOnDrawTop", (iid) =>
    moveCard(ctx, iid, "draw", "top"),
  );
}

function putOnDrawTopResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) moveCard(ctx, iid, "draw", "top");
  replayTail(ctx, args);
}

/** Purity: exhaust up to n chosen cards in your hand. */
function purityChoose(ctx: EffectCtx, args: unknown): void {
  const { n } = args as { n: number };
  const hand = [...ctx.combat!.player.piles.hand];
  if (hand.length === 0) return;
  pauseChoice(
    ctx,
    { kind: "cards", pile: "hand", iids: hand, min: 0, max: n, canCancel: false, reason: "Purity: exhaust up to " + n },
    "colorless/purity",
    { iids: hand },
  );
}

function purityResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) exhaustCard(ctx, iid);
  replayTail(ctx, args);
}

/**
 * Forethought: put a card (upgraded: any number) from your hand on the BOTTOM
 * of the draw pile; it costs 0 until played (freeToPlayOnce).
 */
function forethoughtChoose(ctx: EffectCtx, args: unknown): void {
  const { any } = args as { any: boolean };
  const hand = [...ctx.combat!.player.piles.hand];
  if (hand.length === 0) return;
  if (!any && hand.length === 1) {
    forethoughtMove(ctx, hand[0]!);
    return;
  }
  pauseChoice(
    ctx,
    {
      kind: "cards",
      pile: "hand",
      iids: hand,
      min: any ? 0 : 1,
      max: any ? hand.length : 1,
      canCancel: false,
      reason: "Forethought: put on the bottom of your draw pile",
    },
    "colorless/forethought",
    { iids: hand },
  );
}

function forethoughtMove(ctx: EffectCtx, iid: CardInstanceId): void {
  const c = ctx.combat!.cards[iid]!;
  c.freeToPlayOnce = true; // costs 0 until played
  moveCard(ctx, iid, "draw", "bottom");
}

function forethoughtResume(ctx: EffectCtx, args: unknown): void {
  for (const iid of chosenIids(ctx, args)) forethoughtMove(ctx, iid);
  replayTail(ctx, args);
}

// ------------------------------------------------------------------------------

export const colorlessEffects: Map<string, EffectFn> = new Map<string, EffectFn>([
  ["colorless/apotheosis", apotheosisUpgradeAll],
  ["colorless/addRandomColorless", addRandomColorlessEffect],
  ["colorless/madness", madnessZeroCost],
  ["colorless/mayhemPlayTop", mayhemPlayTop],
  ["colorless/theBomb", theBombApply],
  ["colorless/handOfGreed", handOfGreedAttack],
  ["colorless/ritualDagger", ritualDaggerAttack],
  ["colorless/violence", violenceEffect],
  ["colorless/discoveryChoose", discoveryChoose],
  ["colorless/discovery", discoveryResume],
  ["colorless/secretTechniqueChoose", secretTechniqueChoose],
  ["colorless/secretTechnique", secretTechniqueResume],
  ["colorless/secretWeaponChoose", secretWeaponChoose],
  ["colorless/secretWeapon", secretWeaponResume],
  ["colorless/putOnDrawTopChoose", putOnDrawTopChoose],
  ["colorless/putOnDrawTop", putOnDrawTopResume],
  ["colorless/purityChoose", purityChoose],
  ["colorless/purity", purityResume],
  ["colorless/forethoughtChoose", forethoughtChoose],
  ["colorless/forethought", forethoughtResume],
]);
