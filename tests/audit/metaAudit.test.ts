import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Diffs the engine's HARD-CODED run-layer constants against the ground-truth
// corpus (data/corpus/meta.json). The corpus is imported by TESTS ONLY — the
// engine never reads it at runtime.

import { CARD_REWARD, UPGRADE_CHANCES, POTION_DROP, GOLD_REWARDS, RELIC_TIER_ROLLS } from "../../src/engine/run/rewards";
import { CHESTS } from "../../src/engine/run/treasure";
import { SHOP } from "../../src/engine/run/shop";
import { REST } from "../../src/engine/run/rest";
import {
  STARTING_GOLD,
  POTION_SLOTS,
  UNKNOWN_ROOM,
  SHRINE_CHANCE,
  CARD_RNG_COUNTER_JUMPS,
  ACT_TRANSITION_HEAL,
  ASCENSION_START,
  ONE_TIME_EVENTS_ASC0,
  ONE_TIME_EVENTS_ASC15,
} from "../../src/engine/run/runFlow";
import { ENCOUNTER_LIST_LENGTHS } from "../../src/engine/run/encounters";
import {
  NEOW_BONUS_TABLE_0,
  NEOW_BONUS_TABLE_1,
  NEOW_DRAWBACKS,
  NEOW_BONUS_BY_DRAWBACK,
  NEOW_TIER2_ALL,
  NEOW_CARD_UNCOMMON_CHANCE,
} from "../../src/engine/run/neow";
import { actDefs } from "../../src/content/acts";
import { buildBaseContentBundle } from "../../src/content/index";

const meta = JSON.parse(readFileSync(join(import.meta.dir, "../../data/corpus/meta.json"), "utf8"));

describe("cardRewards", () => {
  test("counts and rarity thresholds", () => {
    expect(CARD_REWARD.baseCount).toBe(meta.cardRewards.baseCount);
    expect(CARD_REWARD.questionCardModifier).toBe(meta.cardRewards.questionCardModifier);
    expect(CARD_REWARD.bustedCrownModifier).toBe(meta.cardRewards.bustedCrownModifier);
    expect(CARD_REWARD.rareChance.elite).toBe(meta.cardRewards.rarityRoll.rareChance.elite);
    expect(CARD_REWARD.rareChance.nonElite).toBe(meta.cardRewards.rarityRoll.rareChance.nonElite);
    expect(CARD_REWARD.uncommonChance.elite).toBe(meta.cardRewards.rarityRoll.uncommonChance.elite);
    expect(CARD_REWARD.uncommonChance.nonElite).toBe(meta.cardRewards.rarityRoll.uncommonChance.nonElite);
  });

  test("pity: initial 5, floor -40, reset on rare", () => {
    expect(CARD_REWARD.pityInitial).toBe(meta.cardRewards.rarePity.initial);
    expect(meta.cardRewards.rarePity.onCommonRolled).toContain(`${CARD_REWARD.pityFloor}`);
    expect(meta.cardRewards.rarePity.onRareRolled).toContain(`${CARD_REWARD.pityInitial}`);
  });

  test("upgrade chances per act/ascension", () => {
    expect(UPGRADE_CHANCES.act1).toBe(meta.upgradeChances.act1);
    expect(UPGRADE_CHANCES.act2.base).toBe(meta.upgradeChances.act2.base);
    expect(UPGRADE_CHANCES.act2.ascension12Plus).toBe(meta.upgradeChances.act2.ascension12Plus);
    expect(UPGRADE_CHANCES.act3AndBeyond.base).toBe(meta.upgradeChances.act3AndBeyond.base);
    expect(UPGRADE_CHANCES.act3AndBeyond.ascension12Plus).toBe(meta.upgradeChances.act3AndBeyond.ascension12Plus);
    // meta.cardRewards.upgradedCardChance agrees with meta.upgradeChances
    expect(meta.cardRewards.upgradedCardChance.act2.ascensionBelow12).toBe(UPGRADE_CHANCES.act2.base);
    expect(meta.cardRewards.upgradedCardChance.act3Plus.ascension12Plus).toBe(UPGRADE_CHANCES.act3AndBeyond.ascension12Plus);
  });
});

describe("potionDrop", () => {
  test("base chance, pity step, rarity thresholds", () => {
    expect(POTION_DROP.baseChance).toBe(meta.potionDrop.baseChance);
    expect(meta.potionDrop.pity.onNoDrop).toContain(`${POTION_DROP.pityStep}`);
    expect(meta.potionDrop.pity.onDrop).toContain(`${POTION_DROP.pityStep}`);
    expect(POTION_DROP.commonBelow).toBe(meta.potionDrop.rarityRoll.commonBelow);
    expect(POTION_DROP.uncommonBelow).toBe(meta.potionDrop.rarityRoll.uncommonBelow);
  });
});

describe("goldRewards", () => {
  test("ranges and factors", () => {
    expect(GOLD_REWARDS.normalMonster.min).toBe(meta.goldRewards.normalMonster.min);
    expect(GOLD_REWARDS.normalMonster.max).toBe(meta.goldRewards.normalMonster.max);
    expect(GOLD_REWARDS.elite.min).toBe(meta.goldRewards.elite.min);
    expect(GOLD_REWARDS.elite.max).toBe(meta.goldRewards.elite.max);
    expect(GOLD_REWARDS.boss.base + GOLD_REWARDS.boss.jitterMin).toBe(meta.goldRewards.boss.min);
    expect(GOLD_REWARDS.boss.base + GOLD_REWARDS.boss.jitterMax).toBe(meta.goldRewards.boss.max);
    expect(meta.goldRewards.boss.ascension13).toContain(`${GOLD_REWARDS.ascension13BossFactor}`);
    expect(meta.goldRewards.goldenIdol).toContain(`${GOLD_REWARDS.goldenIdolFactor}`);
  });
});

describe("chests", () => {
  test("size odds, tier odds, gold chances/amounts", () => {
    expect(CHESTS.sizeOdds).toEqual(meta.chests.sizeOdds);
    expect(CHESTS.relicTierOdds.small).toEqual(meta.chests.relicTierOdds.small);
    expect(CHESTS.relicTierOdds.medium).toEqual(meta.chests.relicTierOdds.medium);
    expect(CHESTS.relicTierOdds.large).toEqual(meta.chests.relicTierOdds.large);
    expect(CHESTS.goldChancePercent).toEqual(meta.chests.goldChancePercent);
    expect(CHESTS.goldBaseAmount).toEqual(meta.chests.goldBaseAmount);
    expect(meta.chests.goldAmountRoll).toContain("0.9");
    expect(CHESTS.goldJitter).toEqual({ min: 0.9, max: 1.1 });
  });
});

describe("relicTierRolls", () => {
  test("combat, elite, shop thresholds", () => {
    expect(RELIC_TIER_ROLLS.combatReward.commonBelow).toBe(meta.relicTierRolls.combatReward.commonBelow);
    expect(RELIC_TIER_ROLLS.combatReward.uncommonBelow).toBe(meta.relicTierRolls.combatReward.uncommonBelow);
    expect(meta.relicTierRolls.elite.common).toContain(`${RELIC_TIER_ROLLS.elite.commonBelow}`);
    expect(meta.relicTierRolls.elite.rare).toContain(`${RELIC_TIER_ROLLS.elite.rareAbove}`);
    expect(SHOP.relicTierRoll.commonBelow).toBe(meta.relicTierRolls.shop.commonBelow);
    expect(SHOP.relicTierRoll.uncommonBelow).toBe(meta.relicTierRolls.shop.uncommonBelow);
  });
});

describe("shop", () => {
  test("base prices", () => {
    expect(SHOP.basePrices.cardByRarity).toEqual(meta.shop.basePrices.cardByRarity);
    expect(SHOP.basePrices.relicByTier).toEqual(meta.shop.basePrices.relicByTier);
    expect(SHOP.basePrices.potionByRarity).toEqual(meta.shop.basePrices.potionByRarity);
  });

  test("card rarity roll thresholds (9 rare / 46 common)", () => {
    expect(SHOP.cardRarityRoll.rareBelow).toBe(meta.shop.cardRarityRoll.rareBelow);
    expect(SHOP.cardRarityRoll.commonAtOrAbove).toBe(meta.shop.cardRarityRoll.commonAtOrAbove);
  });

  test("price jitter and sale slot", () => {
    expect(meta.shop.priceFormulas.classCard).toContain("0.9, 1.1");
    expect(SHOP.cardJitter).toEqual({ min: 0.9, max: 1.1 });
    expect(meta.shop.priceFormulas.relic).toContain("0.95, 1.05");
    expect(SHOP.otherJitter).toEqual({ min: 0.95, max: 1.05 });
    expect(meta.shop.priceFormulas.colorlessCard).toContain("1.2");
    expect(SHOP.colorlessFactor).toBe(1.2);
    expect(meta.shop.sale.index).toContain(`random(${SHOP.saleSlots - 1})`);
  });

  test("removal cost 75 + 25n (Smiling Mask 50)", () => {
    expect(SHOP.removal.basePrice).toBe(meta.shop.cardRemoval.basePrice);
    expect(SHOP.removal.increasePerPurchase).toBe(meta.shop.cardRemoval.increasePerPurchase);
    expect(meta.shop.cardRemoval.smilingMask).toContain(`${SHOP.removal.smilingMask}`);
  });

  test("A16 multiplier: the dispute is recorded; the wiki side (+10%) is implemented", () => {
    expect(meta.shop.disputed.ascension16Prices.length).toBe(2);
    const claims = meta.shop.disputed.ascension16Prices.map((c: { provenance: string }) => c.provenance).sort();
    expect(claims).toEqual(["sts_lightspeed", "wiki"]);
    // lightspeed says 0.80 (cheaper), wiki says "more costly" — we ship 1.1
    expect(SHOP.ascension16Factor).toBe(1.1);
  });
});

describe("unknownRoom + shrine", () => {
  test("base chances, escalation, shrine chance", () => {
    expect(UNKNOWN_ROOM.base).toEqual(meta.unknownRoom.baseChances);
    expect(meta.unknownRoom.escalation.monster).toContain(`${UNKNOWN_ROOM.escalation.monster}`);
    expect(meta.unknownRoom.escalation.shop).toContain(`${UNKNOWN_ROOM.escalation.shop}`);
    expect(meta.unknownRoom.escalation.treasure).toContain(`${UNKNOWN_ROOM.escalation.treasure}`);
    expect(UNKNOWN_ROOM.base).toEqual(meta.unknownRoom.resetOnActTransition);
    expect(SHRINE_CHANCE).toBe(meta.shrineChance.value);
  });
});

describe("rngStreams", () => {
  test("cardRng act-transition counter jumps 250/500/750", () => {
    for (const boundary of CARD_RNG_COUNTER_JUMPS) {
      expect(meta.rngStreams.cardRngActTransitionCounterJump).toContain(`${boundary}`);
    }
  });

  test("relic pool shuffle order documented as 5 relicRng longs", () => {
    expect(meta.rngStreams.relicPoolShuffles).toContain("common, uncommon, rare, shop, boss");
    expect(meta.rngStreams.relicPoolShuffles).toContain("5 relicRng longs");
  });
});

describe("neow", () => {
  test("option 0/1 bonus tables", () => {
    expect(NEOW_BONUS_TABLE_0).toEqual(meta.neow.option0.bonuses);
    expect(NEOW_BONUS_TABLE_1).toEqual(meta.neow.option1.bonuses);
  });

  test("option 2 drawbacks and per-drawback bonus tables (incl. exclusions)", () => {
    expect(NEOW_DRAWBACKS).toEqual(meta.neow.option2.drawbacks);
    expect(NEOW_BONUS_BY_DRAWBACK.TEN_PERCENT_HP_LOSS).toEqual(meta.neow.option2.bonusByDrawback.TEN_PERCENT_HP_LOSS);
    expect(NEOW_BONUS_BY_DRAWBACK.NO_GOLD).toEqual(meta.neow.option2.bonusByDrawback.NO_GOLD);
    expect(NEOW_BONUS_BY_DRAWBACK.CURSE).toEqual(meta.neow.option2.bonusByDrawback.CURSE);
    expect(NEOW_TIER2_ALL).toEqual(meta.neow.option2.bonusByDrawback.PERCENT_DAMAGE);
  });

  test("card reward rarity: 0.33 uncommon chance", () => {
    expect(meta.neow.cardRewardRarity.classCards).toContain(`${NEOW_CARD_UNCOMMON_CHANCE}`);
  });
});

describe("encounters (src/content/acts.ts)", () => {
  const byAct: Record<number, string> = { 1: "act1", 2: "act2", 3: "act3" };

  test("weak/strong/elite/boss ids and weights match, in order", () => {
    for (const act of actDefs) {
      const m = meta.encounters[byAct[act.act]!];
      expect(act.weakEncounters.map((e) => e.id)).toEqual(m.weak.map((w: { id: string }) => w.id));
      // weak picks are uniform: every corpus weight is 1/poolSize
      for (const w of m.weak) {
        expect(w.weight.n).toBe(1);
        expect(w.weight.d).toBe(m.weak.length);
      }
      expect(act.strongEncounters.map((e) => e.id)).toEqual(m.strong.map((s: { id: string }) => s.id));
      const total = act.strongEncounters.reduce((s, e) => s + e.weight, 0);
      m.strong.forEach((s: { weight: { n: number; d: number } }, i: number) => {
        expect(act.strongEncounters[i]!.weight).toBe(s.weight.n);
        expect(total).toBe(s.weight.d);
      });
      expect(act.elites.map((e) => e.id)).toEqual(m.elites);
      expect(act.bosses).toEqual(m.bosses);
    }
  });

  test("generated list lengths", () => {
    expect(actDefs[0]!.weakCount).toBe(meta.encounters.listLengths.weakGeneratedPerAct.act1);
    expect(actDefs[1]!.weakCount).toBe(meta.encounters.listLengths.weakGeneratedPerAct.act2);
    expect(actDefs[2]!.weakCount).toBe(meta.encounters.listLengths.weakGeneratedPerAct.act3);
    expect(ENCOUNTER_LIST_LENGTHS.weakGeneratedPerAct).toEqual(meta.encounters.listLengths.weakGeneratedPerAct);
    expect(ENCOUNTER_LIST_LENGTHS.strongGenerated).toBe(13); // 1 + 12 per meta
    expect(ENCOUNTER_LIST_LENGTHS.eliteGenerated).toBe(meta.encounters.listLengths.eliteGenerated);
  });
});

describe("eventPools (src/content/acts.ts + engine one-time lists)", () => {
  test("per-act event and shrine tables, in order", () => {
    const byAct: Record<number, string> = { 1: "act1", 2: "act2", 3: "act3" };
    for (const act of actDefs) {
      const m = meta.eventPools[byAct[act.act]!];
      expect(act.events).toEqual(m.events);
      expect(act.shrines).toEqual(m.shrines);
    }
  });

  test("one-time pools (A15 drops NOTE_FOR_YOURSELF)", () => {
    expect(ONE_TIME_EVENTS_ASC0).toEqual(meta.eventPools.oneTimeAsc0);
    expect(ONE_TIME_EVENTS_ASC15).toEqual(meta.eventPools.oneTimeAsc15);
    expect(meta.eventPools.oneTimeAsc15Removed).toEqual(["NOTE_FOR_YOURSELF"]);
  });
});

describe("characters + run start", () => {
  test("starting gold and potion slots", () => {
    expect(STARTING_GOLD).toBe(meta.characters.startingGold);
    expect(POTION_SLOTS.base).toBe(meta.characters.potionSlots);
    expect(POTION_SLOTS.ascension11Plus).toBe(meta.characters.potionSlotsAscension11Plus);
  });

  test("class max HP and A14 loss match the base content bundle", () => {
    const bundle = buildBaseContentBundle();
    for (const [id, c] of Object.entries(meta.characters.classes) as [string, { maxHp: number; maxHpA14: number }][]) {
      const def = bundle.characters.get(id as "IRONCLAD");
      expect(def).toBeDefined();
      expect(def!.maxHp).toBe(c.maxHp);
      expect(def!.maxHp - def!.a14HpLoss).toBe(c.maxHpA14);
    }
  });
});

describe("ascension run-structure constants", () => {
  test("A5 boss heal 75%, A6 damaged start 90%, A13 boss gold 75%", () => {
    expect(meta.ascension["5"].mechanics).toContain(`${ACT_TRANSITION_HEAL.ascension5Factor}`);
    expect(meta.ascension["6"].mechanics).toContain(`${ASCENSION_START.damagedHpFactor}`);
    expect(meta.ascension["13"].mechanics).toContain(`${GOLD_REWARDS.ascension13BossFactor}`);
  });

  test("A16 wiki text says more costly (the side we implement)", () => {
    expect(meta.ascension["16"].wiki).toBe("Shops are more costly.");
  });

  test("rest heal fraction is 30% (not ascension-dependent)", () => {
    expect(REST.healFraction).toBe(0.3);
    expect(JSON.stringify(meta.ascension)).not.toContain("rest heal"); // no asc touches rest healing
  });
});
