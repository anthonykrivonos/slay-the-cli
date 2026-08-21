// Neow's blessing: the 4-option structure and bonus/drawback tables, exact per
// data/corpus/meta.json "neow" (sts_lightspeed Neow.cpp:13-136).
// neowRng rolls the options and class-card contents; colorless card identities
// are drawn with cardRng (meta.neow.cardRewardRarity).

import type { EffectCtx } from "../content/defs";
import type { NeowBonus, NeowDrawback, NeowOptionState } from "./runState";
import type { CardId, PotionId } from "../core/ids";
import type { Rng } from "../core/rng";
import type { RolledCard } from "./rewards";
import { classCardPool, colorlessCardPool, cursePool, returnRandomPotion, obtainRelicFromPool } from "./rewards";

// --- tables (meta.neow; audited by tests/audit/metaAudit.test.ts) -------------------

export const NEOW_BONUS_TABLE_0: NeowBonus[] = [
  "THREE_CARDS",
  "ONE_RANDOM_RARE_CARD",
  "REMOVE_CARD",
  "UPGRADE_CARD",
  "TRANSFORM_CARD",
  "RANDOM_COLORLESS",
];

export const NEOW_BONUS_TABLE_1: NeowBonus[] = [
  "THREE_SMALL_POTIONS",
  "RANDOM_COMMON_RELIC",
  "TEN_PERCENT_HP_BONUS",
  "THREE_ENEMY_KILL",
  "HUNDRED_GOLD",
];

export const NEOW_DRAWBACKS: NeowDrawback[] = ["TEN_PERCENT_HP_LOSS", "NO_GOLD", "CURSE", "PERCENT_DAMAGE"];

/** All 7 tier-2 bonuses in enum order (PERCENT_DAMAGE rolls 11 + random(0,6) over these). */
export const NEOW_TIER2_ALL: NeowBonus[] = [
  "RANDOM_COLORLESS_2",
  "REMOVE_TWO",
  "ONE_RARE_RELIC",
  "THREE_RARE_CARDS",
  "TWO_FIFTY_GOLD",
  "TRANSFORM_TWO_CARDS",
  "TWENTY_PERCENT_HP_BONUS",
];

/** Drawback-specific 6-entry tables (exclusions: HP_LOSS x 20%HP, NO_GOLD x
 *  250 gold, CURSE x REMOVE_TWO). */
export const NEOW_BONUS_BY_DRAWBACK: Record<Exclude<NeowDrawback, "NONE" | "LOSE_STARTER_RELIC" | "PERCENT_DAMAGE">, NeowBonus[]> = {
  TEN_PERCENT_HP_LOSS: ["RANDOM_COLORLESS_2", "REMOVE_TWO", "ONE_RARE_RELIC", "THREE_RARE_CARDS", "TWO_FIFTY_GOLD", "TRANSFORM_TWO_CARDS"],
  NO_GOLD: ["RANDOM_COLORLESS_2", "REMOVE_TWO", "ONE_RARE_RELIC", "THREE_RARE_CARDS", "TRANSFORM_TWO_CARDS", "TWENTY_PERCENT_HP_BONUS"],
  CURSE: ["RANDOM_COLORLESS_2", "ONE_RARE_RELIC", "THREE_RARE_CARDS", "TWO_FIFTY_GOLD", "TRANSFORM_TWO_CARDS", "TWENTY_PERCENT_HP_BONUS"],
};

export const NEOW_BONUS_VALUES = {
  TEN_PERCENT_HP_BONUS: 0.1,
  TWENTY_PERCENT_HP_BONUS: 0.2,
  HUNDRED_GOLD: 100,
  TWO_FIFTY_GOLD: 250,
  THREE_ENEMY_KILL: 3, // Neow's Lament charges
  THREE_SMALL_POTIONS: 3,
} as const;

export const NEOW_CARD_UNCOMMON_CHANCE = 0.33;

// --- option generation ---------------------------------------------------------------

/** Neow::getOptions - exact roll order: random(0,5), 6+random(0,4),
 *  drawback 2+random(0,3), bonus random(0,5) into the drawback table (or
 *  11+random(0,6) over all tier-2 for PERCENT_DAMAGE), then a trailing
 *  random(0,0) after the boss-relic option is assigned. */
export function getNeowOptions(neowRng: Rng): NeowOptionState[] {
  const options: NeowOptionState[] = [];
  options.push({ bonus: NEOW_BONUS_TABLE_0[neowRng.randomRange(0, 5)]!, drawback: "NONE" });
  options.push({ bonus: NEOW_BONUS_TABLE_1[neowRng.randomRange(0, 4)]!, drawback: "NONE" });
  const drawback = NEOW_DRAWBACKS[neowRng.randomRange(0, 3)]!;
  let bonus: NeowBonus;
  if (drawback === "PERCENT_DAMAGE") {
    bonus = NEOW_TIER2_ALL[neowRng.randomRange(0, 6)]!;
  } else {
    bonus = NEOW_BONUS_BY_DRAWBACK[drawback as keyof typeof NEOW_BONUS_BY_DRAWBACK][neowRng.randomRange(0, 5)]!;
  }
  options.push({ bonus, drawback });
  options.push({ bonus: "BOSS_RELIC", drawback: "LOSE_STARTER_RELIC" });
  neowRng.randomRange(0, 0); // consumed after assignment (Neow.cpp trailing roll)
  return options;
}

// --- card rewards ---------------------------------------------------------------------

/** Neow::getCardReward: per card neowRng.randomBoolean(0.33) -> UNCOMMON else
 *  COMMON (RARE when rareOnly, no roll); class picks use neowRng; dupes reroll. */
export function neowClassCardReward(ctx: EffectCtx, rareOnly: boolean): RolledCard[] {
  const neowRng = ctx.rng("neowRng");
  const out: RolledCard[] = [];
  for (let i = 0; i < 3; i++) {
    const rarity = rareOnly ? "rare" : neowRng.randomBoolean(NEOW_CARD_UNCOMMON_CHANCE) ? "uncommon" : "common";
    const pool = classCardPool(ctx, rarity);
    if (pool.length === 0) throw new Error(`empty ${rarity} pool for Neow card reward`);
    let id: CardId;
    let guard = 0;
    do {
      id = pool[neowRng.random(pool.length - 1)]!;
    } while (out.some((c) => c.id === id) && ++guard < 1000);
    out.push({ id, rarity, upgraded: false });
  }
  return out;
}

/** Neow::getColorlessCardReward: rarity roll via neowRng (COMMON promoted to
 *  UNCOMMON, so effectively always UNCOMMON unless rareOnly); identities are
 *  drawn with cardRng (meta.neow.cardRewardRarity.colorless). */
export function neowColorlessCardReward(ctx: EffectCtx, rareOnly: boolean): RolledCard[] {
  const neowRng = ctx.rng("neowRng");
  const cardRng = ctx.rng("cardRng");
  const out: RolledCard[] = [];
  for (let i = 0; i < 3; i++) {
    let rarity: "uncommon" | "rare";
    if (rareOnly) rarity = "rare";
    else {
      neowRng.randomBoolean(NEOW_CARD_UNCOMMON_CHANCE); // roll consumed; COMMON promotes to UNCOMMON
      rarity = "uncommon";
    }
    const pool = colorlessCardPool(ctx, rarity);
    if (pool.length === 0) throw new Error(`empty colorless ${rarity} pool for Neow card reward`);
    let id: CardId;
    let guard = 0;
    do {
      id = pool[cardRng.random(pool.length - 1)]!;
    } while (out.some((c) => c.id === id) && ++guard < 1000);
    out.push({ id, rarity, upgraded: false });
  }
  return out;
}

// --- application ------------------------------------------------------------------------

export type NeowFollowUp =
  | { type: "cardReward"; cards: RolledCard[] }
  | { type: "deckChoice"; action: "remove" | "upgrade" | "transform"; count: number }
  | null;

/** Apply a drawback (before the bonus). */
export function applyNeowDrawback(ctx: EffectCtx, drawback: NeowDrawback): void {
  const run = ctx.run;
  switch (drawback) {
    case "NONE":
      break;
    case "TEN_PERCENT_HP_LOSS":
      run.maxHp -= Math.floor(run.maxHp / 10);
      run.hp = Math.min(run.hp, run.maxHp);
      break;
    case "NO_GOLD":
      run.gold = 0;
      break;
    case "CURSE": {
      const curses = cursePool(ctx);
      if (curses.length > 0) {
        const id = curses[ctx.rng("cardRng").random(curses.length - 1)]!;
        run.deck.push({ defId: id, upgrades: 0, misc: 0, bottled: false });
      }
      break;
    }
    case "PERCENT_DAMAGE":
      // "take 30% of current HP as damage": curHp/10*3 with integer division
      run.hp = Math.max(1, run.hp - Math.floor(run.hp / 10) * 3);
      break;
    case "LOSE_STARTER_RELIC":
      run.relics.splice(0, 1); // the starter relic occupies slot 0
      break;
  }
}

/** Apply a bonus; returns a follow-up screen request when one is needed. */
export function applyNeowBonus(ctx: EffectCtx, bonus: NeowBonus): NeowFollowUp {
  const run = ctx.run;
  switch (bonus) {
    case "THREE_CARDS":
      return { type: "cardReward", cards: neowClassCardReward(ctx, false) };
    case "THREE_RARE_CARDS":
      return { type: "cardReward", cards: neowClassCardReward(ctx, true) };
    case "RANDOM_COLORLESS":
      return { type: "cardReward", cards: neowColorlessCardReward(ctx, false) };
    case "RANDOM_COLORLESS_2":
      return { type: "cardReward", cards: neowColorlessCardReward(ctx, true) };
    case "ONE_RANDOM_RARE_CARD": {
      const pool = classCardPool(ctx, "rare");
      if (pool.length === 0) throw new Error("empty rare pool");
      const id = pool[ctx.rng("neowRng").random(pool.length - 1)]!;
      run.deck.push({ defId: id, upgrades: 0, misc: 0, bottled: false });
      return null;
    }
    case "REMOVE_CARD":
      return { type: "deckChoice", action: "remove", count: 1 };
    case "REMOVE_TWO":
      return { type: "deckChoice", action: "remove", count: 2 };
    case "UPGRADE_CARD":
      return { type: "deckChoice", action: "upgrade", count: 1 };
    case "TRANSFORM_CARD":
      return { type: "deckChoice", action: "transform", count: 1 };
    case "TRANSFORM_TWO_CARDS":
      return { type: "deckChoice", action: "transform", count: 2 };
    case "THREE_SMALL_POTIONS": {
      for (let i = 0; i < NEOW_BONUS_VALUES.THREE_SMALL_POTIONS; i++) {
        const id: PotionId | null = returnRandomPotion(ctx);
        if (id) {
          const slot = run.potions.indexOf(null);
          if (slot !== -1) run.potions[slot] = id; // overflow potions are lost
        }
      }
      return null;
    }
    case "RANDOM_COMMON_RELIC":
      run.relics.push({ defId: obtainRelicFromPool(run, "common"), counter: 0 });
      return null;
    case "ONE_RARE_RELIC":
      run.relics.push({ defId: obtainRelicFromPool(run, "rare"), counter: 0 });
      return null;
    case "BOSS_RELIC":
      run.relics.push({ defId: obtainRelicFromPool(run, "boss"), counter: 0 });
      return null;
    case "TEN_PERCENT_HP_BONUS":
      run.maxHp += Math.floor(run.maxHp * NEOW_BONUS_VALUES.TEN_PERCENT_HP_BONUS);
      return null;
    case "TWENTY_PERCENT_HP_BONUS":
      run.maxHp += Math.floor(run.maxHp * NEOW_BONUS_VALUES.TWENTY_PERCENT_HP_BONUS);
      return null;
    case "HUNDRED_GOLD":
      run.gold += NEOW_BONUS_VALUES.HUNDRED_GOLD;
      return null;
    case "TWO_FIFTY_GOLD":
      run.gold += NEOW_BONUS_VALUES.TWO_FIFTY_GOLD;
      return null;
    case "THREE_ENEMY_KILL":
      // Neow's Lament: first 3 combats start enemies at 1 HP (combat hook is relic content)
      run.relics.push({ defId: "NEOWS_LAMENT", counter: NEOW_BONUS_VALUES.THREE_ENEMY_KILL });
      return null;
  }
}
