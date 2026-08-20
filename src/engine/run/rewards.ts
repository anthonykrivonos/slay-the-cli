// Combat rewards, exact per data/corpus/meta.json (cardRewards, potionDrop,
// goldRewards, relicTierRolls) / sts_lightspeed GameContext.cpp:1607-1969.
// Stream discipline: gold = treasureRng (boss: miscRng), cards = cardRng,
// potions = potionRng, relic tiers = relicRng. Relic identities come from the
// run-start shuffled pools (no rng at obtain time).

import type { EffectCtx } from "../content/defs";
import type { RunState, RewardEntry, CardRarityRoll, RelicPoolTier } from "./runState";
import type { CardId, CharacterId, PotionId, RelicId } from "../core/ids";

// --- constants (audited against meta.json by tests/audit/metaAudit.test.ts) ----

export const CARD_REWARD = {
  baseCount: 3,
  questionCardModifier: 1,
  bustedCrownModifier: -2,
  rareChance: { elite: 10, nonElite: 3 },
  uncommonChance: { elite: 40, nonElite: 37 },
  pityInitial: 5,
  pityFloor: -40,
} as const;

export const UPGRADE_CHANCES = {
  act1: 0.0,
  act2: { base: 0.25, ascension12Plus: 0.125 },
  act3AndBeyond: { base: 0.5, ascension12Plus: 0.25 },
} as const;

export const POTION_DROP = {
  baseChance: 40,
  pityStep: 10,
  commonBelow: 65,
  uncommonBelow: 90,
} as const;

export const GOLD_REWARDS = {
  normalMonster: { min: 10, max: 20 },
  elite: { min: 25, max: 35 },
  boss: { base: 100, jitterMin: -5, jitterMax: 5 },
  ascension13BossFactor: 0.75,
  goldenIdolFactor: 0.25,
} as const;

export const RELIC_TIER_ROLLS = {
  combatReward: { commonBelow: 50, uncommonBelow: 83 },
  elite: { commonBelow: 50, rareAbove: 82 },
} as const;

// --- shared helpers -------------------------------------------------------------

export function hasRelic(run: RunState, id: RelicId): boolean {
  return run.relics.some((r) => r.defId === id);
}

export function classColor(character: CharacterId): "red" | "green" | "blue" | "purple" {
  switch (character) {
    case "IRONCLAD":
      return "red";
    case "SILENT":
      return "green";
    case "DEFECT":
      return "blue";
    case "WATCHER":
      return "purple";
  }
}

/** Class card pool of one rarity, in bundle insertion order (the game's static
 *  per-class arrays). Uniform picks index into this with cardRng. */
export function classCardPool(ctx: EffectCtx, rarity: CardRarityRoll): CardId[] {
  const color = classColor(ctx.run.character);
  const out: CardId[] = [];
  for (const c of ctx.bundle.cards.values()) {
    if (c.color === color && c.rarity === rarity) out.push(c.id);
  }
  return out;
}

export function colorlessCardPool(ctx: EffectCtx, rarity: CardRarityRoll): CardId[] {
  const out: CardId[] = [];
  for (const c of ctx.bundle.cards.values()) {
    if (c.color === "colorless" && c.rarity === rarity) out.push(c.id);
  }
  return out;
}

export function cursePool(ctx: EffectCtx): CardId[] {
  const out: CardId[] = [];
  for (const c of ctx.bundle.cards.values()) {
    if (c.type === "curse") out.push(c.id);
  }
  return out;
}

/** Potions available to this class (shared + class pool), insertion order. */
export function potionPool(ctx: EffectCtx): PotionId[] {
  const color = classColor(ctx.run.character);
  const out: PotionId[] = [];
  for (const p of ctx.bundle.potions.values()) {
    if (p.class === "shared" || p.class === color) out.push(p.id);
  }
  return out;
}

// --- relic pools ----------------------------------------------------------------

const TIER_POOL_KEY: Record<RelicPoolTier, keyof RunState["pools"]> = {
  common: "commonRelics",
  uncommon: "uncommonRelics",
  rare: "rareRelics",
  shop: "shopRelics",
  boss: "bossRelics",
};

/** Consume the front of a shuffled tier pool with the game's exhaustion
 *  fallbacks: common -> uncommon -> rare -> CIRCLET; shop -> uncommon;
 *  boss -> RED_CIRCLET (meta.relicTierRolls.poolExhaustionFallbacks). */
export function obtainRelicFromPool(run: RunState, tier: RelicPoolTier): RelicId {
  const chain: RelicPoolTier[] =
    tier === "common"
      ? ["common", "uncommon", "rare"]
      : tier === "uncommon"
        ? ["uncommon", "rare"]
        : tier === "rare"
          ? ["rare"]
          : tier === "shop"
            ? ["shop", "uncommon", "rare"]
            : ["boss"];
  for (const t of chain) {
    const pool = run.pools[TIER_POOL_KEY[t]] as RelicId[];
    const id = pool.shift();
    if (id !== undefined) return id;
  }
  return tier === "boss" ? "RED_CIRCLET" : "CIRCLET";
}

// --- card rewards ----------------------------------------------------------------

export type RewardRoomKind = "monster" | "elite" | "boss" | "event";

/** rollCardRarity (GameContext.cpp:1607-1630): boss rooms return RARE before
 *  any roll; otherwise d100 + cardRarityFactor vs elite 10/40, non-elite 3/37.
 *  N'loth's Gift triples the rare chance outside rest sites. */
export function rollCardRarity(ctx: EffectCtx, room: RewardRoomKind): CardRarityRoll {
  if (room === "boss") return "rare";
  const roll = ctx.rng("cardRng").random(99) + ctx.run.blizzard.cardRarityFactor;
  let rareChance = room === "elite" ? CARD_REWARD.rareChance.elite : CARD_REWARD.rareChance.nonElite;
  const uncommonChance = room === "elite" ? CARD_REWARD.uncommonChance.elite : CARD_REWARD.uncommonChance.nonElite;
  if (hasRelic(ctx.run, "NLOTHS_GIFT")) rareChance *= 3;
  if (roll < rareChance) return "rare";
  if (roll < rareChance + uncommonChance) return "uncommon";
  return "common";
}

export function upgradeChance(act: number, ascension: number): number {
  if (act <= 1) return UPGRADE_CHANCES.act1;
  if (act === 2) return ascension >= 12 ? UPGRADE_CHANCES.act2.ascension12Plus : UPGRADE_CHANCES.act2.base;
  return ascension >= 12 ? UPGRADE_CHANCES.act3AndBeyond.ascension12Plus : UPGRADE_CHANCES.act3AndBeyond.base;
}

export interface RolledCard {
  id: CardId;
  rarity: CardRarityRoll;
  upgraded: boolean;
}

/** createCardReward (GameContext.cpp:1777-1838): 3 cards (+1 Question Card,
 *  -2 Busted Crown); per card: rarity roll -> pity update (common: factor-1
 *  floored at -40; rare: reset to 5) -> uniform class-pool pick with dupe
 *  reroll (id only, not rarity) -> upgrade roll for non-rares when chance > 0. */
export function createCardReward(ctx: EffectCtx, room: RewardRoomKind): RolledCard[] {
  const run = ctx.run;
  const cardRng = ctx.rng("cardRng");
  let numCards = CARD_REWARD.baseCount;
  if (hasRelic(run, "QUESTION_CARD")) numCards += CARD_REWARD.questionCardModifier;
  if (hasRelic(run, "BUSTED_CROWN")) numCards += CARD_REWARD.bustedCrownModifier;
  // TODO PRISMATIC_SHARD: any-color pool draws (burns an extra cardRng.randomLong per card)

  const chance = upgradeChance(run.act, run.ascension);
  const out: RolledCard[] = [];
  for (let i = 0; i < numCards; i++) {
    const rarity = rollCardRarity(ctx, room);
    if (rarity === "rare") run.blizzard.cardRarityFactor = CARD_REWARD.pityInitial;
    else if (rarity === "common") {
      run.blizzard.cardRarityFactor = Math.max(run.blizzard.cardRarityFactor - 1, CARD_REWARD.pityFloor);
    }
    const pool = classCardPool(ctx, rarity);
    if (pool.length === 0) throw new Error(`empty ${rarity} card pool for ${run.character}`);
    let id: CardId;
    let guard = 0;
    do {
      id = pool[cardRng.random(pool.length - 1)]!;
    } while (out.some((c) => c.id === id) && ++guard < 1000);
    const upgraded = rarity !== "rare" && chance > 0 && cardRng.randomBoolean(chance);
    out.push({ id, rarity, upgraded });
  }
  return out;
}

// --- potions ---------------------------------------------------------------------

/** returnRandomPotion (Game.cpp:294-326): rarity d100 (<65 common, <90
 *  uncommon, else rare), then uniform pool draws until the rarity matches. */
export function returnRandomPotion(ctx: EffectCtx): PotionId | null {
  const potionRng = ctx.rng("potionRng");
  const roll = potionRng.randomRange(0, 99);
  const rarity: CardRarityRoll =
    roll < POTION_DROP.commonBelow ? "common" : roll < POTION_DROP.uncommonBelow ? "uncommon" : "rare";
  const pool = potionPool(ctx);
  if (!pool.some((id) => ctx.bundle.potions.get(id)!.rarity === rarity)) return null; // stub-bundle guard
  for (;;) {
    const id = pool[potionRng.random(pool.length - 1)]!;
    if (ctx.bundle.potions.get(id)!.rarity === rarity) return id;
  }
}

/** addPotionRewards (GameContext.cpp:1755-1775): chance 40 + potionChance
 *  (White Beast Statue: 100; >= 4 rewards already: 0); the d100 roll is always
 *  consumed; pity +/-10 on miss/drop. */
export function rollPotionReward(ctx: EffectCtx, rewardsSoFar: number): PotionId | null {
  const run = ctx.run;
  let chance = POTION_DROP.baseChance + run.blizzard.potionChance;
  if (hasRelic(run, "WHITE_BEAST_STATUE")) chance = 100;
  if (rewardsSoFar >= 4) chance = 0;
  if (ctx.rng("potionRng").random(99) >= chance) {
    run.blizzard.potionChance += POTION_DROP.pityStep;
    return null;
  }
  run.blizzard.potionChance -= POTION_DROP.pityStep;
  return returnRandomPotion(ctx);
}

// --- gold ------------------------------------------------------------------------

export function rollGoldReward(ctx: EffectCtx, room: "monster" | "elite" | "boss"): number {
  const run = ctx.run;
  let gold: number;
  if (room === "monster") {
    gold = ctx.rng("treasureRng").randomRange(GOLD_REWARDS.normalMonster.min, GOLD_REWARDS.normalMonster.max);
  } else if (room === "elite") {
    gold = ctx.rng("treasureRng").randomRange(GOLD_REWARDS.elite.min, GOLD_REWARDS.elite.max);
  } else {
    gold = GOLD_REWARDS.boss.base + ctx.rng("miscRng").randomRange(GOLD_REWARDS.boss.jitterMin, GOLD_REWARDS.boss.jitterMax);
    // A13 "Poor bosses" applies BEFORE the Golden Idol bonus
    if (run.ascension >= 13) gold = Math.round(gold * GOLD_REWARDS.ascension13BossFactor);
  }
  if (hasRelic(run, "GOLDEN_IDOL")) gold += Math.round(gold * GOLD_REWARDS.goldenIdolFactor);
  return gold;
}

// --- relic tier rolls -------------------------------------------------------------

/** returnRandomRelicTierElite (Game.cpp:283-292): <50 common, >82 rare, else uncommon. */
export function eliteRelicTier(ctx: EffectCtx): RelicPoolTier {
  const roll = ctx.rng("relicRng").random(99);
  if (roll < RELIC_TIER_ROLLS.elite.commonBelow) return "common";
  if (roll > RELIC_TIER_ROLLS.elite.rareAbove) return "rare";
  return "uncommon";
}

/** returnRandomRelicTier (Game.cpp:268-281): combat-reward tier roll. */
export function combatRelicTier(ctx: EffectCtx): RelicPoolTier {
  const roll = ctx.rng("relicRng").randomRange(0, 99);
  if (roll < RELIC_TIER_ROLLS.combatReward.commonBelow) return "common";
  if (roll < RELIC_TIER_ROLLS.combatReward.uncommonBelow) return "uncommon";
  return "rare";
}

// --- reward screen assembly --------------------------------------------------------

/** Next unused group id within this rewards screen (kept deterministic —
 *  group ids are per-screen, never process-global). */
export function nextRewardGroup(entries: RewardEntry[]): number {
  let g = 0;
  for (const e of entries) {
    if ((e.kind === "card" || e.kind === "bossRelic") && e.group >= g) g = e.group + 1;
  }
  return g;
}

function pushCardGroup(entries: RewardEntry[], cards: RolledCard[]): void {
  const group = nextRewardGroup(entries);
  for (const c of cards) {
    entries.push({ kind: "card", group, id: c.id, rarity: c.rarity, upgraded: c.upgraded, taken: false });
  }
}

function rewardCategoryCount(entries: RewardEntry[]): number {
  // potionCount + relicCount + goldRewardCount + cardRewardCount (card GROUPS)
  const groups = new Set<number>();
  let n = 0;
  for (const e of entries) {
    if (e.kind === "gold" || e.kind === "potion" || e.kind === "relic") n++;
    else if (e.kind === "card") groups.add(e.group);
  }
  return n + groups.size;
}

/** Build the post-combat rewards screen. Boss rooms only add potion/card while
 *  act < 3 (GameContext.cpp:1953-1969); boss relic choices are appended by the
 *  run flow (boss treasure room), not here. */
export function buildCombatRewards(ctx: EffectCtx, room: "monster" | "elite" | "boss", burningElite: boolean): RewardEntry[] {
  const run = ctx.run;
  const entries: RewardEntry[] = [];

  entries.push({ kind: "gold", amount: rollGoldReward(ctx, room), taken: false });

  if (room === "elite") {
    entries.push({ kind: "relic", id: obtainRelicFromPool(run, eliteRelicTier(ctx)), taken: false });
    if (burningElite && !run.keys.emerald) entries.push({ kind: "emeraldKey", taken: false });
  }

  const wantsPotionAndCard = room !== "boss" || run.act < 3;
  if (wantsPotionAndCard) {
    const potion = rollPotionReward(ctx, rewardCategoryCount(entries));
    if (potion) entries.push({ kind: "potion", id: potion, taken: false });
    pushCardGroup(entries, createCardReward(ctx, room));
    if (room === "monster" && hasRelic(run, "PRAYER_WHEEL")) {
      pushCardGroup(entries, createCardReward(ctx, room));
    }
  }

  return entries;
}

/** Wrap a pre-rolled card list as a rewards screen card group (Neow, events). */
export function cardGroupEntries(cards: RolledCard[]): RewardEntry[] {
  const entries: RewardEntry[] = [];
  pushCardGroup(entries, cards);
  return entries;
}
