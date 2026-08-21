// Shop inventory + pricing, exact per data/corpus/meta.json "shop"
// (sts_lightspeed Shop.cpp). Streams: card identities/rarities = cardRng,
// relic tiers + ALL price jitter + sale slot = merchantRng, potions = potionRng.
//
// ASCENSION 16 - DISPUTED (meta.shop.disputed.ascension16Prices):
//   sts_lightspeed applies applyDiscount(0.80f) at ascension >= 16, which makes
//   shops CHEAPER; the wiki documents A16 as "Shops are more costly." (commonly
//   +10%). We implement the WIKI side: prices (and removal cost) x1.10, rounded,
//   applied before relic price hooks (Courier 0.80, Membership Card 0.50).

import type { EffectCtx } from "../content/defs";
import type { ShopState, ShopCardSlot, CardRarityRoll, RelicPoolTier } from "./runState";
import type { CardId } from "../core/ids";
import { PLAYER } from "../core/ids";
import { foldHook } from "../core/hooks";
import { f32mul } from "../core/math";
import { classCardPool, colorlessCardPool, hasRelic, obtainRelicFromPool, returnRandomPotion } from "./rewards";

// --- constants (audited against meta.json) -----------------------------------------

export const SHOP = {
  cardRarityRoll: { rareBelow: 9, commonAtOrAbove: 46 }, // BASE_RARE 9, BASE_UNCOMMON 37
  basePrices: {
    cardByRarity: { common: 50, uncommon: 75, rare: 150 },
    relicByTier: { common: 150, uncommon: 250, rare: 300, boss: 999, shop: 150, starter: 300, special: 400 },
    potionByRarity: { common: 50, uncommon: 75, rare: 100 },
  },
  colorlessFactor: 1.2,
  cardJitter: { min: 0.9, max: 1.1 },
  otherJitter: { min: 0.95, max: 1.05 },
  saleSlots: 5, // saleIdx = merchantRng.random(4)
  removal: { basePrice: 75, increasePerPurchase: 25, smilingMask: 50 },
  relicTierRoll: { commonBelow: 48, uncommonBelow: 82 },
  ascension16Factor: 1.1, // DISPUTED - wiki side implemented (lightspeed uses 0.80)
} as const;

/** Shop::rollCardRarityShop - reads cardRarityFactor but does NOT update it. */
export function rollCardRarityShop(ctx: EffectCtx): CardRarityRoll {
  const roll = ctx.rng("cardRng").random(99) + ctx.run.blizzard.cardRarityFactor;
  if (roll < SHOP.cardRarityRoll.rareBelow) return "rare";
  if (roll >= SHOP.cardRarityRoll.commonAtOrAbove) return "common";
  return "uncommon";
}

/** Shop::rollRelicTier (merchantRng): <48 common, <82 uncommon, else rare. */
export function rollShopRelicTier(ctx: EffectCtx): RelicPoolTier {
  const roll = ctx.rng("merchantRng").random(99);
  if (roll < SHOP.relicTierRoll.commonBelow) return "common";
  if (roll < SHOP.relicTierRoll.uncommonBelow) return "uncommon";
  return "rare";
}

type ShopCardType = "attack" | "skill" | "power";

/** One class-card slot: rarity roll (power slot promotes COMMON -> UNCOMMON),
 *  then a uniform cardRng pick from the class pool of that type+rarity. */
function rollShopClassCard(ctx: EffectCtx, type: ShopCardType): { id: CardId; rarity: CardRarityRoll } {
  let rarity = rollCardRarityShop(ctx);
  if (type === "power" && rarity === "common") rarity = "uncommon";
  const pool = classCardPool(ctx, rarity).filter((id) => ctx.bundle.cards.get(id)!.type === type);
  if (pool.length === 0) throw new Error(`empty shop pool: ${type}/${rarity} for ${ctx.run.character}`);
  return { id: pool[ctx.rng("cardRng").random(pool.length - 1)]!, rarity };
}

function rollColorlessCard(ctx: EffectCtx, rarity: CardRarityRoll): CardId {
  const pool = colorlessCardPool(ctx, rarity);
  if (pool.length === 0) throw new Error(`empty colorless ${rarity} pool`);
  return pool[ctx.rng("cardRng").random(pool.length - 1)]!;
}

/** Removal cost: Smiling Mask fixes it at 50; else 75 + 25 per prior purchase,
 *  then the (disputed) A16 factor and relic modifyPrice hooks. */
export function computeRemovalCost(ctx: EffectCtx): number {
  if (hasRelic(ctx.run, "SMILING_MASK")) return SHOP.removal.smilingMask;
  let cost = SHOP.removal.basePrice + SHOP.removal.increasePerPurchase * ctx.run.history.cardRemovesPurchased;
  cost = applyA16(ctx, cost);
  return Math.round(foldHook(ctx, PLAYER, "modifyPrice", cost));
}

function applyA16(ctx: EffectCtx, price: number): number {
  // DISPUTED A16 multiplier - wiki side (+10%); see file header.
  return ctx.run.ascension >= 16 ? Math.round(price * SHOP.ascension16Factor) : price;
}

function finalizePrice(ctx: EffectCtx, price: number): number {
  return Math.round(foldHook(ctx, PLAYER, "modifyPrice", applyA16(ctx, price)));
}

/** Generate the full shop inventory (Shop::setup / setupCards / setupRelics /
 *  setupPotions). Per-stream call order is preserved exactly; the sale slot is
 *  halved (integer division) BEFORE the A16/relic price factors. */
export function generateShop(ctx: EffectCtx): ShopState {
  const merchantRng = ctx.rng("merchantRng");

  // --- cards: 0-1 attack (distinct), 2-3 skill (distinct), 4 power ---
  const picks: { id: CardId; rarity: CardRarityRoll; colorless: boolean }[] = [];
  const a0 = rollShopClassCard(ctx, "attack");
  picks.push({ ...a0, colorless: false });
  let a1 = rollShopClassCard(ctx, "attack");
  let guard = 0;
  while (a1.id === a0.id && ++guard < 1000) a1 = rollShopClassCard(ctx, "attack");
  picks.push({ ...a1, colorless: false });
  const s0 = rollShopClassCard(ctx, "skill");
  picks.push({ ...s0, colorless: false });
  let s1 = rollShopClassCard(ctx, "skill");
  guard = 0;
  while (s1.id === s0.id && ++guard < 1000) s1 = rollShopClassCard(ctx, "skill");
  picks.push({ ...s1, colorless: false });
  picks.push({ ...rollShopClassCard(ctx, "power"), colorless: false });
  picks.push({ id: rollColorlessCard(ctx, "uncommon"), rarity: "uncommon", colorless: true });
  picks.push({ id: rollColorlessCard(ctx, "rare"), rarity: "rare", colorless: true });

  // prices: int(base * merchantRng.random(0.9, 1.1)) - colorless x1.2, then sale
  const cards: ShopCardSlot[] = picks.map((p) => {
    const base = SHOP.basePrices.cardByRarity[p.rarity];
    const jitter = merchantRng.randomFloatRange(SHOP.cardJitter.min, SHOP.cardJitter.max);
    let price = f32mul(base, jitter);
    if (p.colorless) price = f32mul(price, SHOP.colorlessFactor);
    return { id: p.id, rarity: p.rarity, price: Math.trunc(price), sold: false, colorless: p.colorless };
  });
  const saleIdx = merchantRng.random(SHOP.saleSlots - 1);
  cards[saleIdx]!.price = Math.trunc(cards[saleIdx]!.price / 2);

  // --- relics: 2 tier-rolled + 1 SHOP tier, then price rolls ---
  const relicPicks: { id: string; tier: RelicPoolTier }[] = [];
  for (let i = 0; i < 2; i++) {
    const tier = rollShopRelicTier(ctx);
    relicPicks.push({ id: obtainRelicFromPool(ctx.run, tier), tier });
  }
  relicPicks.push({ id: obtainRelicFromPool(ctx.run, "shop"), tier: "shop" });
  const relics = relicPicks.map((r) => ({
    id: r.id,
    tier: r.tier,
    price: Math.round(f32mul(SHOP.basePrices.relicByTier[r.tier], merchantRng.randomFloatRange(SHOP.otherJitter.min, SHOP.otherJitter.max))),
    sold: false,
  }));

  // --- potions: 3 picks (potionRng), then price rolls (merchantRng) ---
  const potionIds = [returnRandomPotion(ctx), returnRandomPotion(ctx), returnRandomPotion(ctx)];
  const potions = potionIds
    .filter((id): id is string => id !== null)
    .map((id) => ({
      id,
      price: Math.round(
        f32mul(
          SHOP.basePrices.potionByRarity[ctx.bundle.potions.get(id)!.rarity],
          merchantRng.randomFloatRange(SHOP.otherJitter.min, SHOP.otherJitter.max),
        ),
      ),
      sold: false,
    }));

  // --- A16 (disputed, wiki side) then relic price hooks (Courier/Membership) ---
  for (const c of cards) c.price = finalizePrice(ctx, c.price);
  for (const r of relics) r.price = finalizePrice(ctx, r.price);
  for (const p of potions) p.price = finalizePrice(ctx, p.price);

  return { cards, relics, potions, removalCost: computeRemovalCost(ctx), removalUsed: false };
}

/** Mid-shop reprice: buying a price-modifying relic (Membership Card) applies
 *  its factor to remaining unsold prices and the removal cost immediately. */
export function repriceAfterRelic(ctx: EffectCtx, shop: ShopState, relicId: string): void {
  const def = ctx.bundle.relics.get(relicId);
  const hook = def?.hooks.modifyPrice;
  if (!hook) return;
  const apply = (p: number) =>
    Math.round(
      hook(
        { ...ctx, owner: PLAYER, relicCounter: { get: () => 0, set: () => {} } },
        p,
      ),
    );
  for (const c of shop.cards) if (!c.sold) c.price = apply(c.price);
  for (const r of shop.relics) if (!r.sold) r.price = apply(r.price);
  for (const p of shop.potions) if (!p.sold) p.price = apply(p.price);
  if (!shop.removalUsed) shop.removalCost = apply(shop.removalCost);
}
