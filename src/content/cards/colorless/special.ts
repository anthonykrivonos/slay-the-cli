// Colorless special/token cards (created by cards, relics, potions, events -
// never in reward pools). Values audited against data/corpus/cards.json.
// BECOME_ALMIGHTY / FAME_AND_FORTUNE / LIVE_FOREVER carry `unobtainable: true`
// in the corpus (unused game files); implemented for completeness, flagged below.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { gainGoldFolded } from "./effects";

export const colorlessSpecials: CardDef[] = [
  {
    id: "APPARITION",
    name: "Apparition",
    color: "colorless",
    type: "skill",
    rarity: "special",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: {},
    keywords: ["exhaust", "ethereal"],
    upgradeKeywords: ["exhaust"], // upgraded Apparition is no longer Ethereal
    primitives: [{ do: "applyPower", power: "INTANGIBLE", n: "magic", target: "self" }],
  },
  {
    // unobtainable: true in the corpus (unused game content) - cost -2 unplayable
    id: "BECOME_ALMIGHTY",
    name: "Become Almighty",
    color: "colorless",
    type: "power",
    rarity: "special",
    cost: -2,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: 3 });
    },
  },
  {
    id: "BETA",
    name: "Beta",
    color: "colorless",
    type: "skill",
    rarity: "special",
    cost: 2,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // Beta+ shuffles an Omega+ (the Alpha -> Beta -> Omega chain upgrades through)
      ctx.queue.addToBottom({
        kind: "makeTempCard",
        defId: "OMEGA",
        upgrades: ctx.upgraded ? 1 : 0,
        dest: "draw",
        n: 1,
      });
    },
  },
  {
    id: "BITE",
    name: "Bite",
    color: "colorless",
    type: "attack",
    rarity: "special",
    cost: 1,
    target: "enemy",
    values: { damage: 7, magic: 2 },
    upgradeValues: { damage: 8, magic: 3 },
    keywords: ["tag:healing"],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 8 : 7);
      ctx.queue.addToBottom({
        kind: "damage",
        target: monster(target),
        info: { type: "attack", source: PLAYER, amount: dmg },
      });
      // victory keeps draining the action queue, so the heal lands on a kill
      ctx.queue.addToBottom({ kind: "heal", target: PLAYER, amount: ctx.upgraded ? 3 : 2 });
    },
  },
  {
    id: "EXPUNGER",
    name: "Expunger",
    color: "colorless",
    type: "attack",
    rarity: "special",
    cost: 1,
    target: "enemy",
    values: { damage: 9 },
    upgradeValues: { damage: 15 },
    keywords: [],
    onPlay: (ctx) => {
      // "Deal 9(15) damage X times." - card.misc carries X (set by Conjure Blade)
      const target = ctx.target ?? 0;
      const hits = Math.max(0, ctx.card.misc);
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 15 : 9);
      for (let i = 0; i < hits; i++) {
        ctx.queue.addToBottom({
          kind: "damage",
          target: monster(target),
          info: { type: "attack", source: PLAYER, amount: dmg },
        });
      }
    },
  },
  {
    // unobtainable: true in the corpus (unused game content) - cost -2 unplayable
    id: "FAME_AND_FORTUNE",
    name: "Fame and Fortune",
    color: "colorless",
    type: "skill",
    rarity: "special",
    cost: -2,
    target: "self",
    values: { magic: 25 },
    upgradeValues: { magic: 25 },
    keywords: [],
    onPlay: (ctx) => {
      gainGoldFolded(ctx, 25);
    },
  },
  {
    id: "INSIGHT",
    name: "Insight",
    color: "colorless",
    type: "skill",
    rarity: "special",
    cost: 0,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: ["exhaust", "selfRetain"],
    primitives: [{ do: "draw", n: "magic" }],
  },
  {
    id: "JAX",
    name: "J.A.X.",
    color: "colorless",
    type: "skill",
    rarity: "special",
    cost: 0,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    primitives: [
      { do: "loseHp", n: 3 },
      { do: "applyPower", power: "STRENGTH", n: "magic", target: "self" },
    ],
  },
  {
    // unobtainable: true in the corpus (unused game content) - cost -2 unplayable
    id: "LIVE_FOREVER",
    name: "Live Forever",
    color: "colorless",
    type: "power",
    rarity: "special",
    cost: -2,
    target: "self",
    values: { block: 8 },
    upgradeValues: { block: 8 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "PLATED_ARMOR", amount: 8 });
    },
  },
  {
    id: "MIRACLE",
    name: "Miracle",
    color: "colorless",
    type: "skill",
    rarity: "special",
    cost: 0,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: ["exhaust", "selfRetain"],
    primitives: [{ do: "gainEnergy", n: "magic" }],
  },
  {
    id: "OMEGA",
    name: "Omega",
    color: "colorless",
    type: "power",
    rarity: "special",
    cost: 3,
    target: "self",
    values: { magic: 50 },
    upgradeValues: { magic: 60 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "OMEGA", n: "magic", target: "self" }],
  },
  {
    id: "RITUAL_DAGGER",
    name: "Ritual Dagger",
    color: "colorless",
    type: "attack",
    rarity: "special",
    cost: 1,
    target: "enemy",
    values: { damage: 15, magic: 3 },
    upgradeValues: { magic: 5 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // damage + fatal growth resolve atomically (growth must land even when
      // the kill ends the combat - see effects.ts); base grows with card.misc
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, 15 + ctx.card.misc);
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "colorless/ritualDagger",
        args: { idx: target, iid: ctx.card.iid, dmg, bonus: ctx.upgraded ? 5 : 3 },
      });
    },
  },
  {
    id: "SAFETY",
    name: "Safety",
    color: "colorless",
    type: "skill",
    rarity: "special",
    cost: 1,
    target: "self",
    values: { block: 12 },
    upgradeValues: { block: 16 },
    keywords: ["exhaust", "selfRetain"],
    primitives: [{ do: "block", n: "block" }],
  },
  {
    id: "SHIV",
    name: "Shiv",
    color: "colorless",
    type: "attack",
    rarity: "special",
    cost: 0,
    target: "enemy",
    values: { damage: 4 },
    upgradeValues: { damage: 6 },
    keywords: ["exhaust"],
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "SMITE",
    name: "Smite",
    color: "colorless",
    type: "attack",
    rarity: "special",
    cost: 1,
    target: "enemy",
    values: { damage: 12 },
    upgradeValues: { damage: 16 },
    keywords: ["exhaust", "selfRetain"],
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "THROUGH_VIOLENCE",
    name: "Through Violence",
    color: "colorless",
    type: "attack",
    rarity: "special",
    cost: 0,
    target: "enemy",
    values: { damage: 20 },
    upgradeValues: { damage: 30 },
    keywords: ["exhaust", "selfRetain"],
    primitives: [{ do: "damage", n: "damage" }],
  },
];
