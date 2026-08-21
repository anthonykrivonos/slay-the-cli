// Treasure rooms, exact per data/corpus/meta.json "chests"
// (sts_lightspeed GameContext.cpp:1063-1080 setupTreasureRoom and
// 1885-1917 openTreasureRoomChest, Misc.h constants).
//
// The reference's SINGLE-ROLL QUIRK is ported verbatim: one treasureRng
// d100 decides BOTH whether the chest holds gold AND the relic tier, so gold
// presence and relic tier are correlated (e.g. a small chest with an uncommon
// relic - roll >= 75 - can never hold gold, since gold needs roll < 50).

import type { EffectCtx } from "../content/defs";
import type { ChestState, ChestSize } from "./runState";
import type { RelicId } from "../core/ids";
import { obtainRelicFromPool } from "./rewards";

export const CHESTS = {
  sizeOdds: { small: 50, medium: 33, large: 17 }, // roll < 50 | < 83 | else
  relicTierOdds: {
    small: { common: 75, uncommon: 25, rare: 0 },
    medium: { common: 35, uncommon: 50, rare: 15 },
    large: { common: 0, uncommon: 75, rare: 25 },
  },
  goldChancePercent: { small: 50, medium: 35, large: 50 },
  goldBaseAmount: { small: 25, medium: 50, large: 75 },
  goldJitter: { min: 0.9, max: 1.1 },
} as const;

/** setupTreasureRoom: size roll, then ONE shared roll for gold chance + tier. */
export function setupTreasureRoom(ctx: EffectCtx): ChestState {
  const treasureRng = ctx.rng("treasureRng");
  const sizeRoll = treasureRng.random(99);
  const size: ChestSize = sizeRoll < CHESTS.sizeOdds.small ? "small" : sizeRoll < CHESTS.sizeOdds.small + CHESTS.sizeOdds.medium ? "medium" : "large";

  const roll = treasureRng.random(99); // single-roll quirk: used for BOTH below
  const goldPresent = roll < CHESTS.goldChancePercent[size];
  const tiers = CHESTS.relicTierOdds[size];
  const relicTier = roll < tiers.common ? "common" : roll < tiers.common + tiers.uncommon ? "uncommon" : "rare";

  return { size, goldPresent, relicTier, sapphireKeyAvailable: !ctx.run.keys.sapphire, opened: false };
}

export interface ChestContents {
  gold: number;
  relicId: RelicId | null; // null when the sapphire key was taken instead
  sapphireKeyTaken: boolean;
}

/** openTreasureRoomChest: gold amount = round(random(base*0.9, base*1.1)),
 *  then the relic (or the sapphire key INSTEAD of the relic).
 *  TODO relic content hooks: CURSED_KEY random curse, MATRYOSHKA extra relic
 *  (relicRng.randomBoolean(0.75) common else uncommon), NLOTHS_HUNGRY_FACE. */
export function openChestContents(ctx: EffectCtx, chest: ChestState, takeSapphireKey: boolean): ChestContents {
  if (chest.opened) throw new Error("chest already opened");
  chest.opened = true;
  let gold = 0;
  if (chest.goldPresent) {
    const base = CHESTS.goldBaseAmount[chest.size];
    gold = Math.round(ctx.rng("treasureRng").randomFloatRange(base * CHESTS.goldJitter.min, base * CHESTS.goldJitter.max));
  }
  // the relic identity is determined (shown) either way; taking the key forfeits it
  const relicId = obtainRelicFromPool(ctx.run, chest.relicTier);
  if (takeSapphireKey) {
    if (!chest.sapphireKeyAvailable) throw new Error("sapphire key not available");
    return { gold, relicId: null, sapphireKeyTaken: true };
  }
  return { gold, relicId, sapphireKeyTaken: false };
}
