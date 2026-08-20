// Validates data/corpus/meta.json against the sts_lightspeed reference sources.
// Re-extracts mechanically checkable constants with regexes and diffs them.
// Usage: bun tools/corpus/check-meta.ts

const ROOT = new URL("../../", import.meta.url).pathname;
const REF = `${ROOT}references/sts_lightspeed`;

const meta = await Bun.file(`${ROOT}data/corpus/meta.json`).json();

const src = {
  game: await Bun.file(`${REF}/src/game/Game.cpp`).text(),
  gameH: await Bun.file(`${REF}/include/game/Game.h`).text(),
  gc: await Bun.file(`${REF}/src/game/GameContext.cpp`).text(),
  gcH: await Bun.file(`${REF}/include/game/GameContext.h`).text(),
  shop: await Bun.file(`${REF}/src/game/Shop.cpp`).text(),
  shopH: await Bun.file(`${REF}/include/game/Shop.h`).text(),
  map: await Bun.file(`${REF}/src/game/Map.cpp`).text(),
  neow: await Bun.file(`${REF}/src/game/Neow.cpp`).text(),
  enc: await Bun.file(`${REF}/include/constants/MonsterEncounters.h`).text(),
  events: await Bun.file(`${REF}/include/constants/Events.h`).text(),
  misc: await Bun.file(`${REF}/include/constants/Misc.h`).text(),
  potions: await Bun.file(`${REF}/include/constants/Potions.h`).text(),
  cards: await Bun.file(`${REF}/include/constants/Cards.h`).text(),
  relics: await Bun.file(`${REF}/include/constants/Relics.h`).text(),
  random: await Bun.file(`${REF}/include/game/Random.h`).text(),
  save: await Bun.file(`${REF}/include/game/SaveFile.h`).text(),
  ascWiki: await Bun.file(`${ROOT}references/wiki/Ascension.lua`).text(),
};

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `source=${a} meta=${e}`);
}
function has(name: string, text: string, re: RegExp) {
  check(name, re.test(text), `pattern not found: ${re}`);
}

// ---------- seed alphabet ----------
{
  const m = src.game.match(/constexpr auto chars = "([^"]+)"/);
  eq("seedAlphabet.chars", m?.[1], meta.seedAlphabet.chars);
  const base = src.gameH.match(/SEED_BASE = (\d+)/);
  eq("seedAlphabet.base", Number(base?.[1]), meta.seedAlphabet.base);
}

// ---------- prng ----------
{
  const c1 = src.random.match(/x \*= static_cast<std::uint64_t>\((-\d+)LL\)/);
  const c2 = src.random.match(/x \*= static_cast<std::uint64_t>\((-\d+)LL\);\s*\n\s*x \^= x >> 33;\s*\n\s*return/);
  eq("prng.murmur.constant1Signed", c1?.[1], meta.prng.murmurHash3.constant1Signed);
  eq("prng.murmur.constant2Signed", c2?.[1], meta.prng.murmurHash3.constant2Signed);
  // signed decimal <-> hex equivalence
  const toHex = (s: string) => "0x" + BigInt.asUintN(64, BigInt(s)).toString(16).toUpperCase();
  eq("prng.murmur.constant1Hex", toHex(meta.prng.murmurHash3.constant1Signed), meta.prng.murmurHash3.constant1Hex);
  eq("prng.murmur.constant2Hex", toHex(meta.prng.murmurHash3.constant2Signed), meta.prng.murmurHash3.constant2Hex);

  const nd = src.random.match(/NORM_DOUBLE = ([0-9.E-]+);/);
  const nf = src.random.match(/NORM_FLOAT = ([0-9.E-]+);/);
  eq("prng.NORM_DOUBLE", Number(nd?.[1]), meta.prng.nextDouble.NORM_DOUBLE);
  eq("prng.NORM_FLOAT", Number(nf?.[1]), meta.prng.nextFloat.NORM_FLOAT);
  has("prng.nextDouble.shift11", src.random, /nextLong\(\) >> 11/);
  has("prng.nextFloat.shift40", src.random, /nextLong\(\) >> 40/);
  has("prng.xorshift.s1<<23", src.random, /s1 \^= s1 << 23/);
  has("prng.xorshift.mix", src.random, /seed1 = s1 \^ s0 \^ s1 >> 17 \^ s0 >> 26/);
  has("prng.zeroSeed", src.random, /seed == 0 \? ONE_IN_MOST_SIGNIFICANT : seed/);
  const jm = src.random.match(/multiplier = (0x[0-9A-Fa-f]+)ULL/);
  const ja = src.random.match(/addend = (0x[0-9A-Fa-f]+)ULL/);
  eq("prng.javaRandom.multiplier", jm?.[1], meta.prng.javaRandom.multiplier);
  eq("prng.javaRandom.addend", ja?.[1], meta.prng.javaRandom.addend);
}

// ---------- rng streams ----------
{
  const decl = [...src.gcH.matchAll(/Random (\w+);/g)].map((m) => m[1]).sort();
  eq("rngStreams.declared", decl, [...meta.rngStreams.declared].sort());

  const ctorBlock = src.gc.match(/GameContext::GameContext[\s\S]*?ascension\(ascension\)/)?.[0] ?? "";
  const seeded = [...ctorBlock.matchAll(/(\w+Rng)\(seed\)/g)].map((m) => m[1]).sort();
  eq("rngStreams.seededFromRunSeedAtStart", seeded, [...meta.rngStreams.seededFromRunSeedAtStart].sort());
  has("rngStreams.mathUtilRng.offset", ctorBlock, /mathUtilRng\(seed-897897\)/);
  check("rngStreams.mathUtilRng.metaSeed", meta.rngStreams.mathUtilRng.seed === "runSeed - 897897");

  const perFloor = src.gc.match(/\+\+floorNum;\s*\n\s*\+\+curMapNodeY;\s*\n\s*const auto r = Random\(seed \+ floorNum\);\s*\n\s*(\w+) = r;\s*\n\s*(\w+) = r;\s*\n\s*(\w+) = r;/);
  eq("rngStreams.perFloorReseed.streams", perFloor?.slice(1, 4).sort(), [...meta.rngStreams.perFloorReseedOnMapTransition.streams].sort());
  has("rngStreams.cardRngJump.250", src.gc, /cardRng\.counter < 250[\s\S]{0,40}setCounter\(250\)/);
  has("rngStreams.cardRngJump.750", src.gc, /cardRng\.counter < 750[\s\S]{0,40}setCounter\(750\)/);

  const offset = src.map.match(/auto offset = act == 1 \? 1 : act\*\(100\*\(act-1\)\)/);
  check("rngStreams.mapRngOffsets.expr", offset !== null);
  check("rngStreams.mapRngOffsets.act2", 2 * (100 * 1) === 200 && meta.rngStreams.mapRngOffsets.act2 === "seed + 200");
  check("rngStreams.mapRngOffsets.act3", 3 * (100 * 2) === 600 && meta.rngStreams.mapRngOffsets.act3 === "seed + 600");

  for (const field of meta.rngStreams.persistedCounters.saveFields) {
    has(`rngStreams.persistedCounters.${field}`, src.save, new RegExp(`int ${field};`));
  }
}

// ---------- card rewards ----------
{
  has("cardRewards.roll", src.gc, /int roll = cardRng\.random\(99\) \+ cardRarityFactor;/);
  const rare = src.gc.match(/rareChance = \(room == Room::ELITE \? (\d+) : (\d+)\)/);
  eq("cardRewards.rareChance.elite", Number(rare?.[1]), meta.cardRewards.rarityRoll.rareChance.elite);
  eq("cardRewards.rareChance.nonElite", Number(rare?.[2]), meta.cardRewards.rarityRoll.rareChance.nonElite);
  const unc = src.gc.match(/uncommonChance = \(room == Room::ELITE \? (\d+) : (\d+)\)/);
  eq("cardRewards.uncommonChance.elite", Number(unc?.[1]), meta.cardRewards.rarityRoll.uncommonChance.elite);
  eq("cardRewards.uncommonChance.nonElite", Number(unc?.[2]), meta.cardRewards.rarityRoll.uncommonChance.nonElite);
  has("cardRewards.nlothsGift.x3", src.gc, /NLOTHS_GIFT\)\) \{\s*\n\s*rareChance = rareChance \* 3;/);
  has("cardRewards.pity.floor-40", src.gc, /cardRarityFactor = std::max\(cardRarityFactor - 1, -40\)/);
  has("cardRewards.pity.resetOnRare", src.gc, /case CardRarity::RARE:\s*\n\s*cardRarityFactor = 5;/);
  const init = src.gcH.match(/int cardRarityFactor = (\d+);/);
  eq("cardRewards.pity.initial", Number(init?.[1]), meta.cardRewards.rarePity.initial);
  has("cardRewards.count.base3", src.gc, /int numCards = 3;/);
  has("cardRewards.count.questionCard", src.gc, /QUESTION_CARD\)\) \{\s*\n\s*numCards \+= 1;/);
  has("cardRewards.count.bustedCrown", src.gc, /BUSTED_CROWN\)\) \{\s*\n\s*numCards -= 2;/);

  const up = src.game.match(/float sts::getUpgradedCardChance[\s\S]*?\n\}/)?.[0] ?? "";
  const nums = [...up.matchAll(/return ([0-9.]+)f;/g)].map((m) => Number(m[1]));
  eq("upgradeChances.values", nums, [
    meta.upgradeChances.act1,
    meta.upgradeChances.act2.base,
    meta.upgradeChances.act2.ascension12Plus,
    meta.upgradeChances.act3AndBeyond.base,
    meta.upgradeChances.act3AndBeyond.ascension12Plus,
  ]);
}

// ---------- colorless rewards ----------
{
  const m = src.gameH.match(/COLORLESS_RARE_CHANCE = ([0-9.]+)f/);
  eq("colorlessRewards.rareChance", Number(m?.[1]), meta.colorlessRewards.rareChance);
}

// ---------- potion drop ----------
{
  has("potionDrop.base40", src.gc, /int chance = 40 \+ potionChance;/);
  has("potionDrop.pity+10", src.gc, /potionChance \+= 10;/);
  has("potionDrop.pity-10", src.gc, /potionChance -= 10;/);
  has("potionDrop.whiteBeast100", src.gc, /WHITE_BEAST_STATUE\)\) \{\s*\n\s*chance = 100;/);
  has("potionDrop.max4rewards", src.gc, /if \(rewardsSize >= 4\) \{\s*\n\s*chance = 0;/);
  check("potionDrop.baseChance.meta", meta.potionDrop.baseChance === 40);
  has("potionDrop.rarity.common65", src.game, /if \(roll < 65\) \{\s*\n\s*rarity = PotionRarity::COMMON;/);
  has("potionDrop.rarity.uncommon90", src.game, /roll < 90\) \{\s*\n\s*rarity = PotionRarity::UNCOMMON;/);
  check("potionDrop.rarity.metaThresholds", meta.potionDrop.rarityRoll.commonBelow === 65 && meta.potionDrop.rarityRoll.uncommonBelow === 90);
}

// ---------- gold rewards ----------
{
  const n = src.gc.match(/Rewards GameContext::createCombatReward[\s\S]*?treasureRng\.random\((\d+), (\d+)\)/);
  eq("goldRewards.normal", [Number(n?.[1]), Number(n?.[2])], [meta.goldRewards.normalMonster.min, meta.goldRewards.normalMonster.max]);
  const e = src.gc.match(/Rewards GameContext::createEliteCombatReward[\s\S]*?treasureRng\.random\((\d+), (\d+)\)/);
  eq("goldRewards.elite", [Number(e?.[1]), Number(e?.[2])], [meta.goldRewards.elite.min, meta.goldRewards.elite.max]);
  const b = src.gc.match(/int goldAmt = (\d+) \+ miscRng\.random\((-?\d+), (\d+)\)/);
  eq("goldRewards.boss.range", [Number(b?.[1]) + Number(b?.[2]), Number(b?.[1]) + Number(b?.[3])], [meta.goldRewards.boss.min, meta.goldRewards.boss.max]);
  has("goldRewards.boss.a13", src.gc, /ascension >= 13\) \{\s*\n\s*goldAmt = static_cast<int>\(std::round\(\(float\)goldAmt \* 0\.75f\)\)/);
}

// ---------- chests ----------
{
  const s = src.misc.match(/SMALL_CHEST_CHANCE = (\d+)/);
  const m = src.misc.match(/MEDIUM_CHEST_CHANCE = (\d+)/);
  const l = src.misc.match(/LARGE_CHEST_CHANCE = (\d+)/);
  eq("chests.sizeOdds", [Number(s?.[1]), Number(m?.[1]), Number(l?.[1])], [meta.chests.sizeOdds.small, meta.chests.sizeOdds.medium, meta.chests.sizeOdds.large]);

  const tierBlock = src.misc.match(/chestRelicTierChances\[3\]\[2\] = \{([\s\S]*?)\};/)?.[1] ?? "";
  const rows = [...tierBlock.matchAll(/\{(\d+),(\d+)\}/g)].map((r) => [Number(r[1]), Number(r[2])]);
  const sizes = ["small", "medium", "large"] as const;
  rows.forEach((row, i) => {
    const mo = meta.chests.relicTierOdds[sizes[i]!];
    eq(`chests.relicTierOdds.${sizes[i]}`, [row[0]!, row[1]!, 100 - row[0]! - row[1]!], [mo.common, mo.uncommon, mo.rare]);
  });

  const gc = src.misc.match(/chestGoldChances\[3\] = \{(\d+),(\d+),(\d+)\}/);
  eq("chests.goldChancePercent", gc?.slice(1, 4).map(Number), [meta.chests.goldChancePercent.small, meta.chests.goldChancePercent.medium, meta.chests.goldChancePercent.large]);
  const ga = src.misc.match(/chestGoldAmounts\[3\] = \{(\d+),(\d+),(\d+)\}/);
  eq("chests.goldBaseAmount", ga?.slice(1, 4).map(Number), [meta.chests.goldBaseAmount.small, meta.chests.goldBaseAmount.medium, meta.chests.goldBaseAmount.large]);
  has("chests.singleRollQuirk", src.gc, /int roll = treasureRng\.random\(99\);\s*\n\s*info\.haveGold = roll < chestGoldChances/);
}

// ---------- relic tier rolls ----------
{
  const c = src.game.match(/commonChance = act == 4 \? 0 : (\d+)/);
  const u = src.game.match(/uncommonChance = act == 4 \? 100 : (\d+)/);
  eq("relicTierRolls.combat.common", Number(c?.[1]), meta.relicTierRolls.combatReward.commonBelow);
  eq("relicTierRolls.combat.uncommonBelow", Number(c?.[1]) + Number(u?.[1]), meta.relicTierRolls.combatReward.uncommonBelow);
  const elite = src.game.match(/returnRandomRelicTierElite[\s\S]*?roll < (\d+)[\s\S]*?roll > (\d+)/);
  check("relicTierRolls.elite", elite?.[1] === "50" && elite?.[2] === "82" && meta.relicTierRolls.elite.common === "roll < 50" && meta.relicTierRolls.elite.rare === "roll > 82");
  const shopTier = src.shop.match(/RelicTier Shop::rollRelicTier[\s\S]*?roll < (\d+)[\s\S]*?roll < (\d+)/);
  eq("relicTierRolls.shop", [Number(shopTier?.[1]), Number(shopTier?.[2])], [meta.relicTierRolls.shop.commonBelow, meta.relicTierRolls.shop.uncommonBelow]);
}

// ---------- shop ----------
{
  const rare = src.shop.match(/BASE_RARE_CHANCE = (\d+)/);
  const unc = src.shop.match(/BASE_UNCOMMON_CHANCE = (\d+)/);
  eq("shop.cardRarity.rareBelow", Number(rare?.[1]), meta.shop.cardRarityRoll.rareBelow);
  eq("shop.cardRarity.commonAtOrAbove", Number(rare?.[1]) + Number(unc?.[1]), meta.shop.cardRarityRoll.commonAtOrAbove);

  const cp = src.cards.match(/cardRarityPrices\[\] \{(\d+),(\d+),(\d+)/);
  eq("shop.basePrices.card", cp?.slice(1, 4).map(Number), [meta.shop.basePrices.cardByRarity.common, meta.shop.basePrices.cardByRarity.uncommon, meta.shop.basePrices.cardByRarity.rare]);
  const rp = src.relics.match(/relicTierPrices\[\] = \{(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\}/);
  const mrp = meta.shop.basePrices.relicByTier;
  eq("shop.basePrices.relic", rp?.slice(1, 8).map(Number), [mrp.common, mrp.uncommon, mrp.rare, mrp.boss, mrp.shop, mrp.starter, mrp.special]);
  const pp = src.potions.match(/potionRarityPrices\[\] \{(\d+),(\d+),(\d+)\}/);
  eq("shop.basePrices.potion", pp?.slice(1, 4).map(Number), [meta.shop.basePrices.potionByRarity.common, meta.shop.basePrices.potionByRarity.uncommon, meta.shop.basePrices.potionByRarity.rare]);

  const rm = src.shopH.match(/REMOVE_PRICE_INCREASE = (\d+)/);
  const br = src.shopH.match(/BASE_REMOVE_PRICE = (\d+)/);
  const sm = src.shopH.match(/SMILING_MASK_PRICE = (\d+)/);
  const cf = src.shopH.match(/COURIER_FACTOR = ([0-9.]+)f/);
  const mf = src.shopH.match(/MEMBERSHIP_CARD_FACTOR = ([0-9.]+)f/);
  eq("shop.removal.increase", Number(rm?.[1]), meta.shop.cardRemoval.increasePerPurchase);
  eq("shop.removal.base", Number(br?.[1]), meta.shop.cardRemoval.basePrice);
  eq("shop.removal.smilingMask", `fixed ${sm?.[1]}`, meta.shop.cardRemoval.smilingMask);
  eq("shop.discounts.courier", Number(cf?.[1]), meta.shop.discounts.courierFactor);
  eq("shop.discounts.membership", Number(mf?.[1]), meta.shop.discounts.membershipCardFactor);

  has("shop.stock.powerPromotion", src.shop, /rarities\[4\] == CardRarity::COMMON \? CardRarity::UNCOMMON : rarities\[4\]/);
  has("shop.stock.colorlessUncommonRare", src.shop, /cards\[5\] = getColorlessCardFromPool\(gc\.cardRng, CardRarity::UNCOMMON\);\s*\n\s*cards\[6\] = getColorlessCardFromPool\(gc\.cardRng, CardRarity::RARE\);/);
  has("shop.price.classCard", src.shop, /cardRarityPrices\[\(int\)rarities\[i\]\] \* gc\.merchantRng\.random\(0\.9f, 1\.1f\)/);
  has("shop.price.colorless1.2", src.shop, /gc\.merchantRng\.random\(0\.9f, 1\.1f\) \* 1\.2f/);
  has("shop.price.relicPotion", src.shop, /gc\.merchantRng\.random\(0\.95f, 1\.05f\)/);
  has("shop.sale.index", src.shop, /int saleIdx = gc\.merchantRng\.random\(4\);\s*\n\s*prices\[saleIdx\] \/= 2;/);
  has("shop.relics.shopTierThird", src.shop, /relics\[2\] = gc\.returnRandomRelic\(RelicTier::SHOP/);

  // disputed A16: verify BOTH recorded claims still match their sources
  has("shop.disputed.a16.lightspeed", src.shop, /if \(gc\.ascension >= 16\) \{\s*\n\s*applyDiscount\(0\.80f\);/);
  check(
    "shop.disputed.a16.wiki",
    /\[16\] = "Shops are more costly\."/.test(src.ascWiki) &&
      meta.shop.disputed.ascension16Prices.length === 2,
  );
}

// ---------- unknown room ----------
{
  const mc = src.gcH.match(/float monsterChance = ([0-9.]+)f/);
  const sc = src.gcH.match(/float shopChance = ([0-9.]+)f/);
  const tc = src.gcH.match(/float treasureChance = ([0-9.]+)f/);
  eq("unknownRoom.baseChances", [Number(mc?.[1]), Number(sc?.[1]), Number(tc?.[1])], [meta.unknownRoom.baseChances.monster, meta.unknownRoom.baseChances.shop, meta.unknownRoom.baseChances.treasure]);
  has("unknownRoom.escalation.monster", src.gc, /monsterChance \+= 0\.1F;/);
  has("unknownRoom.escalation.shop", src.gc, /shopChance \+= 0\.03F;/);
  has("unknownRoom.escalation.treasure", src.gc, /treasureChance \+= 0\.02F;/);
  has("unknownRoom.lastRoomWasShop", src.gc, /lastRoomWasShop \? 0 : \(int\) \(shopChance \* 100\)/);
  has("unknownRoom.tinyChest.every4th", src.gc, /if \(value == 3\) \{\s*\n\s*value = 0;\s*\n\s*choice = sts::Room::TREASURE;/);
  has("unknownRoom.juzu", src.gc, /JUZU_BRACELET\)\) \{\s*\n\s*choice = Room::EVENT;/);
  has("unknownRoom.ssserpent50", src.gc, /SSSERPENT_HEAD\)\) \{\s*\n\s*obtainGold\(50\);/);
}

// ---------- shrine chance ----------
{
  const m = src.gcH.match(/SHRINE_CHANCE = ([0-9.]+)F/);
  eq("shrineChance.value", Number(m?.[1]), meta.shrineChance.value);
}

// ---------- map gen ----------
{
  const h = src.map.match(/MAP_HEIGHT = (\d+)/);
  const w = src.map.match(/MAP_WIDTH = (\d+)/);
  const d = src.map.match(/PATH_DENSITY = (\d+)/);
  eq("mapGen.height", Number(h?.[1]), meta.mapGen.height);
  eq("mapGen.width", Number(w?.[1]), meta.mapGen.width);
  eq("mapGen.pathDensity", Number(d?.[1]), meta.mapGen.pathDensity);
  const gapMin = src.map.match(/MIN_ANCESTOR_GAP = (\d+)/);
  const gapMax = src.map.match(/MAX_ANCESTOR_GAP = (\d+)/);
  eq("mapGen.ancestorGap", [Number(gapMin?.[1]), Number(gapMax?.[1])], [meta.mapGen.ancestorGap.min, meta.mapGen.ancestorGap.max]);

  const shop = src.map.match(/SHOP_ROOM_CHANCE = ([0-9.]+)F/i);
  const rest = src.map.match(/REST_ROOM_CHANCE = ([0-9.]+)F/i);
  const treasure = src.map.match(/TREASURE_ROOM_CHANCE = ([0-9.]+)f/i);
  const event = src.map.match(/EVENT_ROOM_CHANCE = ([0-9.]+)f/i);
  const elite = src.map.match(/ELITE_ROOM_CHANCE_A0 = ([0-9.]+)f/);
  eq("mapGen.roomProportions", [Number(shop?.[1]), Number(rest?.[1]), Number(treasure?.[1]), Number(event?.[1]), Number(elite?.[1])], [meta.mapGen.roomProportions.shop, meta.mapGen.roomProportions.rest, meta.mapGen.roomProportions.treasure, meta.mapGen.roomProportions.event, meta.mapGen.roomProportions.elite]);
  has("mapGen.eliteA1.x1.6", src.map, /ELITE_ROOM_CHANCE_A1 = ELITE_ROOM_CHANCE_A0 \* 1\.6f/);
  check("mapGen.eliteA1.value", Math.abs(0.08 * 1.6 - meta.mapGen.roomProportions.eliteAscension1Plus) < 1e-9);
  has("mapGen.fixedRows", src.map, /const int monsterRow = 0;\s*\n\s*const int treasureRow = 8;/);
  has("mapGen.row13Quirk", src.map, /case restRowBug:\s*\n\s*\+\+counts\.unassigned;\s*\n\s*break;/);
  has("mapGen.veto.eliteY4", src.map, /case Room::ELITE:\s*\n\s*if \(node\.y <= 4\)/);
  has("mapGen.veto.restY13", src.map, /if \(node\.y >= 13\)/);
  has("mapGen.burningElite.buff", src.map, /burningEliteBuff = mapRng\.random\(0,3\)/);
}

// ---------- neow ----------
{
  has("neow.option0.roll", src.neow, /rewards\[0\]\.r = static_cast<Bonus>\(r\.random\(0, 5\)\)/);
  has("neow.option1.roll", src.neow, /rewards\[1\]\.r = static_cast<Bonus>\(6 \+ r\.random\(0, 4\)\)/);
  has("neow.option2.drawbackRoll", src.neow, /rewards\[2\]\.d = static_cast<Drawback>\(2 \+ r\.random\(0, 3\)\)/);
  has("neow.option2.percentDamageRoll", src.neow, /rewards\[2\]\.r = static_cast<Bonus>\(11 \+ r\.random\(0, 6\)\)/);
  has("neow.option3", src.neow, /rewards\[3\]\.r = Bonus::BOSS_RELIC;\s*\n\s*rewards\[3\]\.d = Drawback::LOSE_STARTER_RELIC;\s*\n\s*r\.random\(0, 0\);/);

  const tables = [...src.neow.matchAll(/case Drawback::(\w+): \{\s*\n\s*static constexpr Bonus myRewards\[\]\{([\s\S]*?)\};/g)];
  for (const t of tables) {
    const drawback = t[1];
    const bonuses = [...t[2]!.matchAll(/Bonus::(\w+)/g)].map((b) => b[1]!);
    eq(`neow.option2.bonusByDrawback.${drawback}`, bonuses, meta.neow.option2.bonusByDrawback[drawback!]);
  }
  check("neow.option2.tableCount", tables.length === 3);
}

// ---------- encounters ----------
function parsePoolBlock(name: string, text: string): string[][] {
  const block = text.match(new RegExp(`${name}\\[3\\]\\[\\d+\\] = \\{([\\s\\S]*?)\\};`))?.[1] ?? "";
  return [...block.matchAll(/\{([^{}]*)\}/g)].map((g) => [...g[1]!.matchAll(/ME::(\w+)/g)].map((m) => m[1]!));
}
function parseWeightBlock(name: string, text: string): number[][] {
  const block = text.match(new RegExp(`${name}\\[3\\]\\[\\d+\\] = \\{([\\s\\S]*?)\\};`))?.[1] ?? "";
  return [...block.matchAll(/\{([^{}]*)\}/g)].map((g) =>
    [...g[1]!.matchAll(/([0-9.]+)f\/(\d+)/g)].map((m) => Number(m[1]) / Number(m[2])),
  );
}
{
  const weak = parsePoolBlock("weakEnemies", src.enc);
  const weakW = parseWeightBlock("weakWeights", src.enc);
  const strong = parsePoolBlock("strongEnemies", src.enc);
  const strongW = parseWeightBlock("strongWeights", src.enc);
  const elitesBlock = src.enc.match(/elites\[3\]\[3\] = \{([\s\S]*?)\};/)?.[1] ?? "";
  const elites = [...elitesBlock.matchAll(/\{([^{}]*)\}/g)].map((g) => [...g[1]!.matchAll(/ME::(\w+)/g)].map((m) => m[1]!));

  const acts = ["act1", "act2", "act3"] as const;
  acts.forEach((act, i) => {
    const mw = meta.encounters[act].weak;
    eq(`encounters.${act}.weak.ids`, weak[i], mw.map((e: any) => e.id));
    mw.forEach((e: any, j: number) => {
      check(`encounters.${act}.weak.weight.${e.id}`, Math.abs(weakW[i]![j]! - e.weight.n / e.weight.d) < 1e-6, `source=${weakW[i]![j]} meta=${e.weight.n}/${e.weight.d}`);
    });
    const ms = meta.encounters[act].strong;
    eq(`encounters.${act}.strong.ids`, strong[i], ms.map((e: any) => e.id));
    ms.forEach((e: any, j: number) => {
      check(`encounters.${act}.strong.weight.${e.id}`, Math.abs(strongW[i]![j]! - e.weight.n / e.weight.d) < 1e-6, `source=${strongW[i]![j]} meta=${e.weight.n}/${e.weight.d}`);
    });
    check(`encounters.${act}.strong.weightSum`, Math.abs(strongW[i]!.reduce((a, b) => a + b, 0) - 1) < 1e-5);
    eq(`encounters.${act}.elites`, elites[i], meta.encounters[act].elites);
  });

  const bossBlock = src.gc.match(/bosses\[3\]\[3\] = \{([\s\S]*?)\};/)?.[1] ?? "";
  const bosses = [...bossBlock.matchAll(/\{([^{}]*)\}/g)].map((g) => [...g[1]!.matchAll(/ME::(\w+)/g)].map((m) => m[1]!));
  acts.forEach((act, i) => eq(`encounters.${act}.bosses`, bosses[i], meta.encounters[act].bosses));

  has("encounters.weakGenerated.3or2", src.gc, /act == 1 \? 3 : 2\);/);
  check("encounters.weakGenerated.meta", meta.encounters.listLengths.weakGeneratedPerAct.act1 === 3 && meta.encounters.listLengths.weakGeneratedPerAct.act2 === 2 && meta.encounters.listLengths.weakGeneratedPerAct.act3 === 2);
  has("encounters.strongGenerated.12", src.gc, /strongCount\[act-1\], 12\);/);
  has("encounters.elitesGenerated.10", src.gc, /void GameContext::generateElites\(\) \{\s*\n\s*for\(int i = 0; i < 10; \+\+i\)/);
  has("encounters.act4", src.gc, /boss = MonsterEncounter::THE_HEART;\s*\n\s*eliteMonsterList\.push_back\(MonsterEncounter::SHIELD_AND_SPEAR\);/);
}

// ---------- event pools ----------
function parseEventList(re: RegExp, text: string): string[] {
  const block = text.match(re)?.[1] ?? "";
  return [...block.matchAll(/Event::(\w+)/g)].map((m) => m[1]!);
}
{
  eq("eventPools.oneTimeAsc0", parseEventList(/oneTimeEventsAsc0 \{([^}]*)\}/, src.events), meta.eventPools.oneTimeAsc0);
  eq("eventPools.oneTimeAsc15", parseEventList(/oneTimeEventsAsc15 \{([^}]*)\}/, src.events), meta.eventPools.oneTimeAsc15);
  const removed = meta.eventPools.oneTimeAsc0.filter((e: string) => !meta.eventPools.oneTimeAsc15.includes(e));
  eq("eventPools.oneTimeAsc15Removed", removed, meta.eventPools.oneTimeAsc15Removed);

  for (const act of ["Act1", "Act2", "Act3"]) {
    const ns = src.events.match(new RegExp(`namespace ${act} \\{([\\s\\S]*?)\\n        \\}`))?.[1] ?? "";
    const events = parseEventList(/events \{([^}]*)\}/, ns);
    const shrines = parseEventList(/shrines \{([^}]*)\}/, ns);
    const key = act.toLowerCase();
    eq(`eventPools.${key}.events`, events, meta.eventPools[key].events);
    eq(`eventPools.${key}.shrines`, shrines, meta.eventPools[key].shrines);
  }
}

// ---------- ascension (wiki text) ----------
{
  const wiki: Record<string, string> = {};
  for (const m of src.ascWiki.matchAll(/\[(\d+)\] = "([^"]+)"/g)) {
    wiki[m[1]!] = m[2]!;
  }
  for (let i = 1; i <= 20; i++) {
    eq(`ascension.${i}.wiki`, wiki[String(i)], meta.ascension[String(i)].wiki);
  }
  has("ascension.5.heal75", src.gc, /playerHeal\(static_cast<int>\(std::round\(static_cast<float>\(maxHp-curHp\)\*0\.75f\)\)\)/);
  has("ascension.6.start90", src.gc, /curHp = ascension < 6 \? maxHp : std::round\(static_cast<float>\(maxHp\) \* 0\.9f\)/);
  has("ascension.10.bane", src.gc, /ascension >= 10\) \{\s*\n\s*deck\.obtain\(\*this, CardId::ASCENDERS_BANE\)/);
  has("ascension.11.slots", src.gc, /potionCapacity = ascension < 11 \? 3 : 2;/);
  has("ascension.20.secondBoss", src.gc, /act == 3 && ascension >= 20\) \{\s*\n\s*secondBoss = bosses\[act-1\]\[indices\[1\]\]/);
}

// ---------- characters ----------
{
  const gold = src.gcH.match(/int gold = (\d+);/);
  eq("characters.startingGold", Number(gold?.[1]), meta.characters.startingGold);
  const hp: Record<string, [number, number]> = {};
  const initPlayer = src.gc.match(/void GameContext::initPlayer[\s\S]*?\n\}/)?.[0] ?? "";
  for (const m of initPlayer.matchAll(/case CharacterClass::(\w+):\s*\n\s*maxHp = ascension < 14 \? (\d+) : (\d+);/g)) {
    hp[m[1]!] = [Number(m[2]), Number(m[3])];
  }
  for (const cls of ["IRONCLAD", "SILENT", "DEFECT", "WATCHER"]) {
    eq(`characters.${cls}.maxHp`, hp[cls], [meta.characters.classes[cls].maxHp, meta.characters.classes[cls].maxHpA14]);
  }
}

// ---------- summary ----------
console.log(`\ncheck-meta: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
