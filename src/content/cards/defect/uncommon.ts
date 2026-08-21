// Defect uncommons (36). Values audited vs data/corpus/cards.json (color "blue").
//
// CHILL / STORM / HELLO_WORLD gain Innate on UPGRADE only (corpus text
// "[|$Innate. // ]..." and V2.3.4 behavior): base keywords exclude "innate",
// upgradeKeywords carry it. Documented in tests/content/cardsDefect.test.ts.

import type { CardDef } from "../../../engine/content/defs";
import { calcBlock, calcCardDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { channeledCount, ensureChannelTally } from "../../orbs";

const RANDOM_ORBS = ["LIGHTNING", "FROST", "DARK", "PLASMA"] as const;

export const defectUncommons: CardDef[] = [
  {
    // "Gain 1 Energy for every 4(3) cards in your draw pile."
    id: "AGGREGATE",
    name: "Aggregate",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 4 },
    upgradeValues: { magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/aggregate", args: { divisor: ctx.upgraded ? 3 : 4 } });
    },
  },
  {
    // "If you have no Block, gain 11(15) Block."
    id: "AUTO_SHIELDS",
    name: "Auto-Shields",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { block: 11 },
    upgradeValues: { block: 15 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "defect/autoShields",
        args: { iid: ctx.card.iid, base: ctx.upgraded ? 15 : 11 },
      });
    },
  },
  {
    // "Deal damage equal to 2(3) times the number of Frost Channeled this combat
    //  to ALL enemies."
    id: "BLIZZARD",
    name: "Blizzard",
    color: "blue",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "allenemy",
    values: { damage: 0, magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      const base = (ctx.upgraded ? 3 : 2) * channeledCount(ctx, "FROST");
      const amounts = ctx.combat!.monsters.map((_, i) => calcCardDamage(ctx, ctx.card, i, base));
      ctx.queue.addToBottom({ kind: "damageAllMonsters", amounts, info: { type: "attack", source: PLAYER } });
    },
  },
  {
    // "Innate. Gain 10(13) Block. Exhaust."
    id: "BOOT_SEQUENCE",
    name: "Boot Sequence",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { block: 10 },
    upgradeValues: { block: 13 },
    keywords: ["exhaust", "innate"],
    primitives: [{ do: "block", n: "block" }],
  },
  {
    // "Deal 8(11) damage. Apply 2(3) Lock-On."
    id: "BULLSEYE",
    name: "Bullseye",
    color: "blue",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 8, magic: 2 },
    upgradeValues: { damage: 11, magic: 3 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "LOCK_ON", n: "magic", target: "target" },
    ],
  },
  {
    // "Gain 2(3) Orb slots."
    id: "CAPACITOR",
    name: "Capacitor",
    color: "blue",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "changeOrbSlots", delta: ctx.upgraded ? 3 : 2 });
    },
  },
  {
    // "Channel 1(2) random Orb(s)." Rolled at play time (cardRandomRng), one
    // roll per orb. ENGINE-NOTE: roll->orb mapping uses the corpus order below;
    // the game's enum order may map identical rolls to different orbs.
    id: "CHAOS",
    name: "Chaos",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    onPlay: (ctx) => {
      const n = ctx.upgraded ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const orbId = RANDOM_ORBS[ctx.rng("cardRandomRng").random(RANDOM_ORBS.length - 1)]!;
        ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId, n: 1 } });
      }
    },
  },
  {
    // "(Innate.) Channel 1 Frost for each enemy in combat. Exhaust."
    id: "CHILL",
    name: "Chill",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { magic: 1 },
    upgradeValues: {},
    keywords: ["exhaust"],
    upgradeKeywords: ["exhaust", "innate"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/frostPerEnemy" });
    },
  },
  {
    // "Gain 2(3) Focus. Lose 1 Orb slot."
    id: "CONSUME",
    name: "Consume",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      ensureChannelTally(ctx); // losing a slot may drop orbs before the tally exists
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "FOCUS", amount: ctx.upgraded ? 3 : 2 });
      ctx.queue.addToBottom({ kind: "changeOrbSlots", delta: -1 });
    },
  },
  {
    // "Channel 1 Dark. (Trigger the passive ability of ALL Dark orbs.)"
    id: "DARKNESS",
    name: "Darkness",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: {},
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/darkness", args: { plus: ctx.upgraded } });
    },
  },
  {
    // "Gain 1(2) Focus."
    id: "DEFRAGMENT",
    name: "Defragment",
    color: "blue",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "FOCUS", n: "magic", target: "self" }],
  },
  {
    // "Deal 10(14) damage to ALL enemies. Channel 1 Dark."
    id: "DOOM_AND_GLOOM",
    name: "Doom and Gloom",
    color: "blue",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "allenemy",
    values: { damage: 10, magic: 1 },
    upgradeValues: { damage: 14 },
    keywords: [],
    primitives: [{ do: "damageAll", n: "damage" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "DARK", n: 1 } });
    },
  },
  {
    // "Double your Energy. Exhaust."
    id: "DOUBLE_ENERGY",
    name: "Double Energy",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/doubleEnergy" });
    },
  },
  {
    // "Gain 13(16) Block. Retain your hand this turn."
    id: "EQUILIBRIUM",
    name: "Equilibrium",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: { block: 13, magic: 1 },
    upgradeValues: { block: 16 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "applyPower", power: "EQUILIBRIUM", n: "magic", target: "self" },
    ],
  },
  {
    // "Costs 1 less for each Power card played this combat. Gain 12(16) Block."
    id: "FORCE_FIELD",
    name: "Force Field",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 4,
    target: "self",
    values: { block: 12 },
    upgradeValues: { block: 16 },
    keywords: [],
    // min() keeps "costs 0 this turn" effects effective when they set costForTurn
    dynamicCost: (ctx, card) =>
      Math.max(0, Math.min(card.costForTurn, 4 - ctx.combat!.combatFlags.powersPlayedThisCombat)),
    primitives: [{ do: "block", n: "block" }],
  },
  {
    // "Deal 5(6) damage. If you have played less than 3(4) cards this turn, draw 1 card."
    // turnFlags.cardsPlayedThisTurn already includes FTL itself at resolve time,
    // so "< magic played before" is "<= magic including this one".
    id: "FTL",
    name: "FTL",
    color: "blue",
    type: "attack",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { damage: 5, magic: 3 },
    upgradeValues: { damage: 6, magic: 4 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      if (ctx.combat!.turnFlags.cardsPlayedThisTurn <= (ctx.upgraded ? 4 : 3)) {
        ctx.queue.addToBottom({ kind: "draw", n: 1 });
      }
    },
  },
  {
    // "Channel 1 Plasma."
    id: "FUSION",
    name: "Fusion",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: { magic: 1, hits: 1 },
    upgradeValues: { cost: 1 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "PLASMA", n: 1 } });
    },
  },
  {
    // "Gain 1 Block. Permanently increase this card's Block by 2(3). Exhaust."
    // Growth persists in card.misc AND the master-deck copy (Ritual Dagger pattern).
    id: "GENETIC_ALGORITHM",
    name: "Genetic Algorithm",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      const block = calcBlock(ctx, 1 + ctx.card.misc, ctx.card, true);
      ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
      const growth = ctx.upgraded ? 3 : 2;
      ctx.card.misc += growth;
      if (ctx.card.masterIdx !== null) {
        const master = ctx.run.deck[ctx.card.masterIdx];
        if (master) master.misc += growth;
      }
    },
  },
  {
    // "Gain 7(10) Block. Channel 2 Frost."
    id: "GLACIER",
    name: "Glacier",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: { block: 7, magic: 2, hits: 2 },
    upgradeValues: { block: 10 },
    keywords: [],
    primitives: [{ do: "block", n: "block" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "FROST", n: 2 } });
    },
  },
  {
    // "Whenever you play a Power card, draw 1(2) cards." (power id: HEATSINK)
    id: "HEATSINKS",
    name: "Heatsinks",
    color: "blue",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "HEATSINK", n: "magic", target: "self" }],
  },
  {
    // "(Innate.) At the start of your turn, add a random Common card into your hand."
    id: "HELLO_WORLD",
    name: "Hello World",
    color: "blue",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: [],
    upgradeKeywords: ["innate"],
    primitives: [{ do: "applyPower", power: "HELLO_WORLD", n: 1, target: "self" }],
  },
  {
    // "At the start of your turn, trigger the passive ability of your next Orb 1(2) time(s)."
    id: "LOOP",
    name: "Loop",
    color: "blue",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "LOOP", n: "magic", target: "self" }],
  },
  {
    // "Remove all Block from the enemy. Deal 10(14) damage."
    id: "MELTER",
    name: "Melter",
    color: "blue",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 10 },
    upgradeValues: { damage: 14 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 14 : 10);
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/melterBlock", args: { idx: target } });
      ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
    },
  },
  {
    // "Draw 2(3) cards. Add a Burn into your discard pile."
    id: "OVERCLOCK",
    name: "Overclock",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    primitives: [
      { do: "draw", n: "magic" },
      { do: "makeCard", card: "BURN", dest: "discard" },
    ],
  },
  {
    // "Exhaust a card. Gain Energy equal to its cost."
    id: "RECYCLE",
    name: "Recycle",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/recycleChoose" });
    },
  },
  {
    // "Gain 7(9) Block X times."
    id: "REINFORCED_BODY",
    name: "Reinforced Body",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: -1,
    target: "self",
    values: { block: 7 },
    upgradeValues: { block: 9 },
    keywords: [],
    onPlay: (ctx) => {
      const x = ctx.energyOnUse;
      const block = calcBlock(ctx, ctx.upgraded ? 9 : 7, ctx.card, true);
      for (let i = 0; i < x; i++) {
        ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
      }
    },
  },
  {
    // "Lose 1(2) Focus. Gain 1(2) Strength. Gain 1(2) Dexterity."
    id: "REPROGRAM",
    name: "Reprogram",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    onPlay: (ctx) => {
      const n = ctx.upgraded ? 2 : 1;
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "FOCUS", amount: -n });
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: n });
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "DEXTERITY", amount: n });
    },
  },
  {
    // "Deal 7(9) damage to a random enemy twice." (targets roll per hit)
    id: "RIP_AND_TEAR",
    name: "Rip and Tear",
    color: "blue",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "allenemy",
    values: { damage: 7, magic: 2, hits: 2 },
    upgradeValues: { damage: 9 },
    keywords: [],
    onPlay: (ctx) => {
      const base = ctx.upgraded ? 9 : 7;
      for (let i = 0; i < 2; i++) {
        ctx.queue.addToBottom({ kind: "effect", ref: "defect/randomHit", args: { iid: ctx.card.iid, base } });
      }
    },
  },
  {
    // "Deal 7(10) damage. Draw 4(5) cards. Discard all cards drawn this way
    //  that do not cost 0."
    id: "SCRAPE",
    name: "Scrape",
    color: "blue",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 7, magic: 4 },
    upgradeValues: { damage: 10, magic: 5 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/scrape", args: { n: ctx.upgraded ? 5 : 4 } });
    },
  },
  {
    // "At the end of combat, heal 7(10) HP." (power id: REPAIR)
    id: "SELF_REPAIR",
    name: "Self Repair",
    color: "blue",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 7 },
    upgradeValues: { magic: 10 },
    keywords: ["tag:healing"],
    primitives: [{ do: "applyPower", power: "REPAIR", n: "magic", target: "self" }],
  },
  {
    // "Draw 3(4) cards."
    id: "SKIM",
    name: "Skim",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    primitives: [{ do: "draw", n: "magic" }],
  },
  {
    // "Whenever you receive unblocked attack damage, Channel 1(2) Lightning."
    id: "STATIC_DISCHARGE",
    name: "Static Discharge",
    color: "blue",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "STATIC_DISCHARGE", n: "magic", target: "self" }],
  },
  {
    // "(Innate.) Whenever you play a Power card, Channel 1 Lightning."
    id: "STORM",
    name: "Storm",
    color: "blue",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: {},
    keywords: [],
    upgradeKeywords: ["innate"],
    primitives: [{ do: "applyPower", power: "STORM", n: "magic", target: "self" }],
  },
  {
    // "Deal 24(32) damage. If this kills an enemy, gain 3 Energy."
    id: "SUNDER",
    name: "Sunder",
    color: "blue",
    type: "attack",
    rarity: "uncommon",
    cost: 3,
    target: "enemy",
    values: { damage: 24 },
    upgradeValues: { damage: 32 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 32 : 24);
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/sunder", args: { idx: target, dmg } });
    },
  },
  {
    // "Channel X(+1) Lightning. Exhaust."
    id: "TEMPEST",
    name: "Tempest",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: -1,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      const n = ctx.energyOnUse + (ctx.upgraded ? 1 : 0);
      if (n > 0) ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "LIGHTNING", n } });
    },
  },
  {
    // "Add a random Power card into your hand. It costs 0 this turn. Exhaust."
    id: "WHITE_NOISE",
    name: "White Noise",
    color: "blue",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "defect/addRandomCard",
        args: { pool: "power", n: 1, costZeroThisTurn: true },
      });
    },
  },
];
