// "Upon pickup" run-layer relic effects: the boss relics that do something the
// moment they are obtained (sts_lightspeed GameContext::obtainRelic,
// GameContext.cpp:1286-1467). onEquip fires from every obtain site in the run
// layer - the boss reward screen, Neow's boss swap, events, shops - so these
// run wherever the relic lands.
//
// Two of them pause for a card pick and three hand out rewards. Rewards are
// appended to the screen the pickup happened on when there is one: the
// reference calls openCombatRewardScreen over the CURRENT room's reward list,
// so a boss-relic pickup keeps the boss screen (and its act transition on
// leave) and only a screenless pickup (Neow) opens a fresh one.

import type { EffectCtx, EffectFn } from "../../engine/content/defs";
import type { CardId, RelicId } from "../../engine/core/ids";
import type { RewardEntry } from "../../engine/run/runState";
import { JavaRandom, javaShuffle } from "../../engine/core/rng";
import { canSmith } from "../../engine/run/rest";
import { classCardPool, createCardReward, nextRewardGroup, potionPool } from "../../engine/run/rewards";
import {
  UNREMOVABLE_CURSES,
  gainMaxHp,
  obtainCard,
  removeDeckCards,
  removableIndices,
  screenlessRelicOfTier,
} from "../events/lib";

/** Starter Strikes and Defends of every class (Pandora's Box eats these). */
const STARTER_STRIKES_AND_DEFENDS: ReadonlySet<CardId> = new Set([
  "STRIKE_RED",
  "STRIKE_GREEN",
  "STRIKE_BLUE",
  "STRIKE_PURPLE",
  "DEFEND_RED",
  "DEFEND_GREEN",
  "DEFEND_BLUE",
  "DEFEND_PURPLE",
]);

// --- reward screens ------------------------------------------------------------------

/** The reward list a pickup adds to: the open rewards screen, or a new one. */
function pickupRewards(ctx: EffectCtx): RewardEntry[] {
  const room = ctx.run.room;
  if (room?.kind === "rewards") return room.entries;
  const entries: RewardEntry[] = [];
  ctx.run.room = { kind: "rewards", entries, source: "relic" };
  return entries;
}

// --- deck helpers ---------------------------------------------------------------------

/** Astrolabe's screen (TRANSFORM_UPGRADE): everything that canTransform(),
 *  bottled cards included - unlike a REMOVE screen, which drops them. */
function transformableIndices(ctx: EffectCtx): number[] {
  return ctx.run.deck.map((_, i) => i).filter((i) => !UNREMOVABLE_CURSES.includes(ctx.run.deck[i]!.defId));
}

/** The obtainable class pool, all rarities, in bundle order.
 *  ENGINE-NOTE: the game keeps its own static per-class arrays, so a given
 *  roll lands on a different card here even off an identical stream (same
 *  caveat as the Neow/event transforms and Infernal Blade). */
function classPool(ctx: EffectCtx): CardId[] {
  return [...classCardPool(ctx, "common"), ...classCardPool(ctx, "uncommon"), ...classCardPool(ctx, "rare")];
}

/** One transform replacement: uniform over the class pool with miscRng, the
 *  run's shared transform path (src/content/events/lib.ts transformDeckCard).
 *  ENGINE-NOTE: the reference's getTransformedCard picks by the transformed
 *  card's color (curse -> curse, colorless -> colorless) and excludes the card
 *  itself; that draw is not pinned by meta.json, so this stays identical to
 *  the Neow/event transforms rather than inventing a second rule. */
function obtainTransformed(ctx: EffectCtx, upgrades: number): void {
  const pool = classPool(ctx);
  if (pool.length === 0) return;
  obtainCard(ctx, pool[ctx.rng("miscRng").random(pool.length - 1)]!, upgrades);
}

/** getTrulyRandomCard(cardRandomRng): a class card of any rarity. */
function trulyRandomClassCard(ctx: EffectCtx): CardId | null {
  const pool = classPool(ctx);
  if (pool.length === 0) return null;
  return pool[ctx.rng("cardRandomRng").random(pool.length - 1)]!;
}

// --- pending card picks ------------------------------------------------------------------

/** Deck pick for a pickup screen. `iids` carry deck indices and the resume
 *  receives POSITIONS in that list back as `chosen` (what the UI sends). */
function requestPickupChoice(
  ctx: EffectCtx,
  opts: { relicId: RelicId; indices: number[]; count: number; reason: string },
): void {
  const count = Math.min(opts.count, opts.indices.length);
  if (count === 0) return; // nothing to pick: the pickup is a no-op
  ensurePickupEffects(ctx);
  ctx.requestChoice({
    request: { kind: "cards", pile: "custom", iids: opts.indices, min: count, max: count, canCancel: false, reason: opts.reason },
    resume: "content:relicPickupChoice",
    resumeArgs: { relicId: opts.relicId, indices: opts.indices },
  });
}

const relicPickupChoice: EffectFn = (ctx, args) => {
  const { relicId, indices, chosen } = args as { relicId: RelicId; indices: number[]; chosen: number[] };
  const picked = (chosen ?? []).map((i) => indices[i]).filter((i): i is number => i !== undefined);
  if (picked.length === 0) return;
  removeDeckCards(ctx, picked);
  // Astrolabe transforms what it removed, upgraded (chooseSelectCardScreenOption,
  // TRANSFORM_UPGRADE); Empty Cage just removes.
  if (relicId === "ASTROLABE") {
    for (let i = 0; i < picked.length; i++) obtainTransformed(ctx, 1);
  }
};

export const pickupEffects: ReadonlyArray<readonly [string, EffectFn]> = [
  ["content:relicPickupChoice", relicPickupChoice],
];

/** Lazily register the continuation into the live bundle (idempotent), so a
 *  bundle built from a raw def merge can still resume the pick. */
function ensurePickupEffects(ctx: EffectCtx): void {
  for (const [id, fn] of pickupEffects) {
    if (!ctx.bundle.effects.has(id)) ctx.bundle.effects.set(id, fn);
  }
}

// --- the pickups ---------------------------------------------------------------------------

/** "Upon pickup, Transform 3 cards, then Upgrade them." */
export function astrolabePickup(ctx: EffectCtx): void {
  requestPickupChoice(ctx, {
    relicId: "ASTROLABE",
    indices: transformableIndices(ctx),
    count: 3,
    reason: "relic:transform",
  });
}

/** "Upon pickup, obtain a unique Curse and 3 relics." */
export function callingBellPickup(ctx: EffectCtx): void {
  // DEPENDS: CURSE_OF_THE_BELL card def
  if (ctx.bundle.cards.has("CURSE_OF_THE_BELL")) obtainCard(ctx, "CURSE_OF_THE_BELL");
  const entries = pickupRewards(ctx);
  for (const tier of ["common", "uncommon", "rare"] as const) {
    entries.push({ kind: "relic", id: screenlessRelicOfTier(ctx, tier), taken: false });
  }
}

/** "Upon pickup, remove 2 cards from your deck." */
export function emptyCagePickup(ctx: EffectCtx): void {
  requestPickupChoice(ctx, {
    relicId: "EMPTY_CAGE",
    indices: removableIndices(ctx),
    count: 2,
    reason: "relic:remove",
  });
}

/** "Upon pickup, Transform all Strike and Defend cards." */
export function pandorasBoxPickup(ctx: EffectCtx): void {
  const deck = ctx.run.deck;
  let count = 0;
  for (let i = deck.length - 1; i >= 0; i--) {
    if (STARTER_STRIKES_AND_DEFENDS.has(deck[i]!.defId)) {
      deck.splice(i, 1);
      count++;
    }
  }
  // the reference rolls every replacement first, then obtains them in reverse
  const rolled: CardId[] = [];
  for (let i = 0; i < count; i++) {
    const id = trulyRandomClassCard(ctx);
    if (id) rolled.push(id);
  }
  for (let i = rolled.length - 1; i >= 0; i--) obtainCard(ctx, rolled[i]!);
}

/** "Upon pickup, obtain 1 Potion. Gain 50 Gold. Raise your Max HP by 5.
 *  Obtain 1 card. Upgrade 1 random card." */
export function tinyHousePickup(ctx: EffectCtx): void {
  // upgrade: java-shuffle the upgradeable deck indices with a miscRng-seeded
  // java.Random and take the first (Deck::getUpgradeableCardIdxs + shuffle)
  const upgradeable = ctx.run.deck.map((_, i) => i).filter((i) => canSmith(ctx, i));
  javaShuffle(upgradeable, new JavaRandom(ctx.rng("miscRng").randomLong()));
  if (upgradeable.length > 0) ctx.run.deck[upgradeable[0]!]!.upgrades++;

  gainMaxHp(ctx, 5); // playerIncreaseMaxHp: raises the cap and heals the same

  const entries = pickupRewards(ctx);
  entries.push({ kind: "gold", amount: 50, taken: false });
  // getRandomPotion(miscRng): a uniform class-pool draw, NOT the rarity-rolled
  // potionRng reward path
  const potions = potionPool(ctx);
  if (potions.length > 0) {
    entries.push({ kind: "potion", id: potions[ctx.rng("miscRng").random(potions.length - 1)]!, taken: false });
  }
  // createCardReward(curRoom): a treasure room rolls rarity like any non-elite,
  // non-boss room ("event" shares that 3/37 branch)
  const group = nextRewardGroup(entries);
  for (const c of createCardReward(ctx, "event")) {
    entries.push({ kind: "card", group, id: c.id, rarity: c.rarity, upgraded: c.upgraded, taken: false });
  }
}
