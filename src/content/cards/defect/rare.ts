// Defect rares (17). Values audited vs data/corpus/cards.json (color "blue").
//
// MACHINE_LEARNING gains Innate on UPGRADE only, like CHILL/STORM/HELLO_WORLD
// (see uncommon.ts header): base keywords exclude it, upgradeKeywords carry it.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { PLAYER } from "../../../engine/core/ids";
import { channeledCount } from "../../orbs";

export const defectRares: CardDef[] = [
  {
    // "Deal 10(14) damage. Put all cost 0 cards from your discard pile into your hand."
    id: "ALL_FOR_ONE",
    name: "All for One",
    color: "blue",
    type: "attack",
    rarity: "rare",
    cost: 2,
    target: "enemy",
    values: { damage: 10 },
    upgradeValues: { damage: 14 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/allForOne" });
    },
  },
  {
    // "This turn, your next 1(2) Power card(s) are played twice."
    id: "AMPLIFY",
    name: "Amplify",
    color: "blue",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "AMPLIFY", n: "magic", target: "self" }],
  },
  {
    // "Gain 4(5) Focus. At the start of your turn, lose 1 Focus." (BIAS power)
    id: "BIASED_COGNITION",
    name: "Biased Cognition",
    color: "blue",
    type: "power",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: { magic: 4 },
    upgradeValues: { magic: 5 },
    keywords: [],
    primitives: [
      { do: "applyPower", power: "FOCUS", n: "magic", target: "self" },
      { do: "applyPower", power: "BIAS", n: 1, target: "self" },
    ],
  },
  {
    // "Prevent the next 1(2) time(s) you would lose HP."
    id: "BUFFER",
    name: "Buffer",
    color: "blue",
    type: "power",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "BUFFER", n: "magic", target: "self" }],
  },
  {
    // "Deal 11(15) damage. Gain 1 Artifact. Exhaust."
    id: "CORE_SURGE",
    name: "Core Surge",
    color: "blue",
    type: "attack",
    rarity: "rare",
    cost: 1,
    target: "enemy",
    values: { damage: 11, magic: 1 },
    upgradeValues: { damage: 15 },
    keywords: ["exhaust"],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "ARTIFACT", n: "magic", target: "self" },
    ],
  },
  {
    // "At the start of your turn, add a random Power card into your hand."
    id: "CREATIVE_AI",
    name: "Creative AI",
    color: "blue",
    type: "power",
    rarity: "rare",
    cost: 3,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { cost: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "CREATIVE_AI", n: "magic", target: "self" }],
  },
  {
    // "(Ethereal.) The first card you play each turn is played twice."
    id: "ECHO_FORM",
    name: "Echo Form",
    color: "blue",
    type: "power",
    rarity: "rare",
    cost: 3,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["ethereal"],
    upgradeKeywords: [],
    primitives: [{ do: "applyPower", power: "ECHO_FORM", n: 1, target: "self" }],
  },
  {
    // "Lightning now hits ALL enemies. Channel 2(3) Lightning."
    // The CARD channels; the ELECTRO power only changes targeting.
    id: "ELECTRODYNAMICS",
    name: "Electrodynamics",
    color: "blue",
    type: "power",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: { magic: 2, hits: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "ELECTRO", amount: 1 });
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "LIGHTNING", n: ctx.upgraded ? 3 : 2 } });
    },
  },
  {
    // "Remove(Evoke) all your Orbs. Gain 1 Energy and draw 1 card for each Orb
    //  removed(Evoked). Exhaust."
    id: "FISSION",
    name: "Fission",
    color: "blue",
    type: "skill",
    rarity: "rare",
    cost: 0,
    target: "none",
    values: { magic: 1 },
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/fission", args: { evoke: ctx.upgraded } });
    },
  },
  {
    // "Deal 26(34) damage to ALL enemies. Lose 3 Focus."
    id: "HYPERBEAM",
    name: "Hyperbeam",
    color: "blue",
    type: "attack",
    rarity: "rare",
    cost: 2,
    target: "allenemy",
    values: { damage: 26, magic: 3 },
    upgradeValues: { damage: 34 },
    keywords: [],
    primitives: [{ do: "damageAll", n: "damage" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "FOCUS", amount: -3 });
    },
  },
  {
    // "(Innate.) At the start of your turn, draw 1 additional card." (DRAW power)
    id: "MACHINE_LEARNING",
    name: "Machine Learning",
    color: "blue",
    type: "power",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: {},
    keywords: [],
    upgradeKeywords: ["innate"],
    primitives: [{ do: "applyPower", power: "DRAW", n: "magic", target: "self" }],
  },
  {
    // "Deal 24(30) damage. Channel 3 Plasma."
    id: "METEOR_STRIKE",
    name: "Meteor Strike",
    color: "blue",
    type: "attack",
    rarity: "rare",
    cost: 5,
    target: "enemy",
    values: { damage: 24, magic: 3, hits: 3 },
    upgradeValues: { damage: 30 },
    keywords: ["strike", "tag:strike"],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "PLASMA", n: 3 } });
    },
  },
  {
    // "Evoke your next Orb X(+1) times."
    id: "MULTI_CAST",
    name: "Multi-Cast",
    color: "blue",
    type: "skill",
    rarity: "rare",
    cost: -1,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    onPlay: (ctx) => {
      const times = ctx.energyOnUse + (ctx.upgraded ? 1 : 0);
      if (times > 0) ctx.queue.addToBottom({ kind: "effect", ref: "defect/evoke", args: { times } });
    },
  },
  {
    // "Channel 1 Lightning. Channel 1 Frost. Channel 1 Dark. (Exhaust.)"
    id: "RAINBOW",
    name: "Rainbow",
    color: "blue",
    type: "skill",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    upgradeKeywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "LIGHTNING", n: 1 } });
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "FROST", n: 1 } });
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "DARK", n: 1 } });
    },
  },
  {
    // "Shuffle ALL your cards into your draw pile. Draw 4(6) cards. Exhaust."
    // (hand + discard; the exhaust pile stays out, as in V2.3.4)
    id: "REBOOT",
    name: "Reboot",
    color: "blue",
    type: "skill",
    rarity: "rare",
    cost: 0,
    target: "self",
    values: { magic: 4 },
    upgradeValues: { magic: 6 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/reboot", args: { draw: ctx.upgraded ? 6 : 4 } });
    },
  },
  {
    // "Put 1(2) card(s) from your draw pile into your hand. Exhaust."
    id: "SEEK",
    name: "Seek",
    color: "blue",
    type: "skill",
    rarity: "rare",
    cost: 0,
    target: "none",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/seekChoose", args: { n: ctx.upgraded ? 2 : 1 } });
    },
  },
  {
    // "Deal 7(9) damage to a random enemy for each Lightning Channeled this combat."
    id: "THUNDER_STRIKE",
    name: "Thunder Strike",
    color: "blue",
    type: "attack",
    rarity: "rare",
    cost: 3,
    target: "allenemy",
    values: { damage: 7, magic: 0 },
    upgradeValues: { damage: 9 },
    keywords: ["strike", "tag:strike"],
    onPlay: (ctx) => {
      const hits = channeledCount(ctx, "LIGHTNING");
      const base = ctx.upgraded ? 9 : 7;
      for (let i = 0; i < hits; i++) {
        ctx.queue.addToBottom({ kind: "effect", ref: "defect/randomHit", args: { iid: ctx.card.iid, base } });
      }
    },
  },
];
