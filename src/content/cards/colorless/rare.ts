// Colorless rare cards (the obtainable colorless pool, rare half).
// Values audited against data/corpus/cards.json - corpus numbers only.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { addClassCardsToDrawCostZero, violencePull } from "./effects";

export const colorlessRares: CardDef[] = [
  {
    id: "APOTHEOSIS",
    name: "Apotheosis",
    color: "colorless",
    type: "skill",
    rarity: "rare",
    cost: 2,
    target: "none",
    values: {},
    upgradeValues: { cost: 1 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // upgrades ALL cards in combat (draw/hand/discard/exhaust), this combat only
      ctx.queue.addToBottom({ kind: "effect", ref: "colorless/apotheosis" });
    },
  },
  {
    id: "CHRYSALIS",
    name: "Chrysalis",
    color: "colorless",
    type: "skill",
    rarity: "rare",
    cost: 2,
    target: "none",
    values: { magic: 3, hits: 3 },
    upgradeValues: { magic: 5, hits: 3 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // 3(5) random class Skills shuffled into the draw pile, cost 0 this combat
      addClassCardsToDrawCostZero(ctx, ctx.upgraded ? 5 : 3, "skill");
    },
  },
  {
    id: "HAND_OF_GREED",
    name: "Hand of Greed",
    color: "colorless",
    type: "attack",
    rarity: "rare",
    cost: 2,
    target: "enemy",
    values: { damage: 20, magic: 20 },
    upgradeValues: { damage: 25, magic: 25 },
    keywords: [],
    onPlay: (ctx) => {
      // damage + fatal gold resolve atomically (the gold must land even when
      // the kill ends the combat - see effects.ts, Feed pattern)
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 25 : 20);
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "colorless/handOfGreed",
        args: { idx: target, dmg, gold: ctx.upgraded ? 25 : 20 },
      });
    },
  },
  {
    id: "MAGNETISM",
    name: "Magnetism",
    color: "colorless",
    type: "power",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { cost: 1, magic: 1 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "MAGNETISM", n: "magic", target: "self" }],
  },
  {
    id: "MASTER_OF_STRATEGY",
    name: "Master of Strategy",
    color: "colorless",
    type: "skill",
    rarity: "rare",
    cost: 0,
    target: "none",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: ["exhaust"],
    primitives: [{ do: "draw", n: "magic" }],
  },
  {
    id: "MAYHEM",
    name: "Mayhem",
    color: "colorless",
    type: "power",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { cost: 1, magic: 1 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "MAYHEM", n: "magic", target: "self" }],
  },
  {
    id: "METAMORPHOSIS",
    name: "Metamorphosis",
    color: "colorless",
    type: "skill",
    rarity: "rare",
    cost: 2,
    target: "none",
    values: { magic: 3, hits: 3 },
    upgradeValues: { magic: 5, hits: 3 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // 3(5) random class Attacks shuffled into the draw pile, cost 0 this combat
      addClassCardsToDrawCostZero(ctx, ctx.upgraded ? 5 : 3, "attack");
    },
  },
  {
    id: "PANACHE",
    name: "Panache",
    color: "colorless",
    type: "power",
    rarity: "rare",
    cost: 0,
    target: "self",
    values: { magic: 10 },
    upgradeValues: { magic: 14 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "PANACHE", n: "magic", target: "self" }],
  },
  {
    id: "SADISTIC_NATURE",
    name: "Sadistic Nature",
    color: "colorless",
    type: "power",
    rarity: "rare",
    cost: 0,
    target: "self",
    values: { magic: 5 },
    upgradeValues: { magic: 7 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "SADISTIC", n: "magic", target: "self" }],
  },
  {
    id: "SECRET_TECHNIQUE",
    name: "Secret Technique",
    color: "colorless",
    type: "skill",
    rarity: "rare",
    cost: 0,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    upgradeKeywords: [], // upgraded Secret Technique no longer Exhausts
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "colorless/secretTechniqueChoose" });
    },
  },
  {
    id: "SECRET_WEAPON",
    name: "Secret Weapon",
    color: "colorless",
    type: "skill",
    rarity: "rare",
    cost: 0,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    upgradeKeywords: [], // upgraded Secret Weapon no longer Exhausts
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "colorless/secretWeaponChoose" });
    },
  },
  {
    id: "THE_BOMB",
    name: "The Bomb",
    color: "colorless",
    type: "skill",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: { magic: 40 },
    upgradeValues: { magic: 50 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "colorless/theBomb", args: { damage: ctx.upgraded ? 50 : 40 } });
    },
  },
  {
    id: "THINKING_AHEAD",
    name: "Thinking Ahead",
    color: "colorless",
    type: "skill",
    rarity: "rare",
    cost: 0,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    upgradeKeywords: [], // upgraded Thinking Ahead no longer Exhausts
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "draw", n: 2 });
      ctx.queue.addToBottom({ kind: "effect", ref: "colorless/putOnDrawTopChoose" });
    },
  },
  {
    id: "TRANSMUTATION",
    name: "Transmutation",
    color: "colorless",
    type: "skill",
    rarity: "rare",
    cost: -1, // X
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // X random (upgraded: Upgraded) colorless cards to hand, cost 0 this turn.
      // Rolls happen when the action resolves (TransmutationAction parity).
      const x = ctx.energyOnUse; // X-cost: captured at queue time; engine spends it
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "colorless/addRandomColorless",
        args: { n: x, upgraded: ctx.upgraded, zeroCostThisTurn: true },
      });
    },
  },
  {
    id: "VIOLENCE",
    name: "Violence",
    color: "colorless",
    type: "skill",
    rarity: "rare",
    cost: 0,
    target: "none",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // use-time rolls (Violence.use picks with cardRandomRng directly)
      violencePull(ctx, ctx.upgraded ? 4 : 3);
    },
  },
];
