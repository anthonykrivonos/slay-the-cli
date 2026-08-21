// Watcher commons (19). Values audited vs data/corpus/cards.json.
// "last card played this combat" conditions read turnFlags.lastCardPlayedType,
// which the interpreter sets after each card resolves (so during onPlay it
// still holds the PREVIOUS card's type) and never resets mid-combat.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage, calcBlock } from "../../../engine/combat/damageCalc";
import { moveCard } from "../../../engine/combat/piles";
import { PLAYER, monster } from "../../../engine/core/ids";

export const watcherCommons: CardDef[] = [
  {
    // "Deal 7(10) damage for each enemy in combat." - one hit per living enemy,
    // all aimed at the target (the game queues count separate DamageActions).
    id: "BOWLING_BASH",
    name: "Bowling Bash",
    color: "purple",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 7 },
    upgradeValues: { damage: 10 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const count = ctx.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped).length;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 10 : 7);
      for (let i = 0; i < count; i++) {
        ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
      }
    },
  },
  {
    id: "CONSECRATE",
    name: "Consecrate",
    color: "purple",
    type: "attack",
    rarity: "common",
    cost: 0,
    target: "allenemy",
    values: { damage: 5 },
    upgradeValues: { damage: 8 },
    keywords: [],
    primitives: [{ do: "damageAll", n: "damage" }],
  },
  {
    id: "CRESCENDO",
    name: "Crescendo",
    color: "purple",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust", "selfRetain"],
    primitives: [{ do: "changeStance", stance: "WRATH" }],
  },
  {
    id: "CRUSH_JOINTS",
    name: "Crush Joints",
    color: "purple",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 8, magic: 1 },
    upgradeValues: { damage: 10, magic: 2 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 10 : 8);
      ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
      if (ctx.combat!.turnFlags.lastCardPlayedType === "skill") {
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: PLAYER,
          target: monster(target),
          powerId: "VULNERABLE",
          amount: ctx.upgraded ? 2 : 1,
        });
      }
    },
  },
  {
    id: "CUT_THROUGH_FATE",
    name: "Cut Through Fate",
    color: "purple",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 7, magic: 2 },
    upgradeValues: { damage: 9, magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 9 : 7);
      ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/scryStart", args: { n: ctx.upgraded ? 3 : 2 } });
      ctx.queue.addToBottom({ kind: "draw", n: 1 });
    },
  },
  {
    id: "EMPTY_BODY",
    name: "Empty Body",
    color: "purple",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 7 },
    upgradeValues: { block: 10 },
    keywords: ["tag:empty"],
    primitives: [
      { do: "block", n: "block" },
      { do: "changeStance", stance: "NEUTRAL" },
    ],
  },
  {
    id: "EMPTY_FIST",
    name: "Empty Fist",
    color: "purple",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 9 },
    upgradeValues: { damage: 14 },
    keywords: ["tag:empty"],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "changeStance", stance: "NEUTRAL" },
    ],
  },
  {
    id: "EVALUATE",
    name: "Evaluate",
    color: "purple",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 6 },
    upgradeValues: { block: 10 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "makeCard", card: "INSIGHT", dest: "draw" },
    ],
  },
  {
    // "Whenever you change Stances, return this from the discard pile to your
    // hand." Self-trigger fired by the stance runtime; hand-full leaves it.
    id: "FLURRY_OF_BLOWS",
    name: "Flurry of Blows",
    color: "purple",
    type: "attack",
    rarity: "common",
    cost: 0,
    target: "enemy",
    values: { damage: 4 },
    upgradeValues: { damage: 6 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onStanceChangeThisInDiscard: (ctx) => {
      if (ctx.combat!.player.piles.hand.length < 10) moveCard(ctx, ctx.card.iid, "hand");
    },
  },
  {
    id: "FLYING_SLEEVES",
    name: "Flying Sleeves",
    color: "purple",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 4 },
    upgradeValues: { damage: 6 },
    keywords: ["selfRetain"],
    primitives: [{ do: "damage", n: "damage", hits: 2 }],
  },
  {
    id: "FOLLOW_UP",
    name: "Follow-Up",
    color: "purple",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 7 },
    upgradeValues: { damage: 11 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 11 : 7);
      ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
      if (ctx.combat!.turnFlags.lastCardPlayedType === "attack") {
        ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
      }
    },
  },
  {
    // "Gain 3(4) Block. If you are in Wrath, gain 9(14) additional Block."
    // ENGINE-NOTE: corpus upgrade.magic reads 9, but the corpus card TEXT is
    // "[9|14]" (the game's Halt+ bonus is 14); the structured field missed the
    // delta, so the upgraded bonus is carried here, not in upgradeValues.
    id: "HALT",
    name: "Halt",
    color: "purple",
    type: "skill",
    rarity: "common",
    cost: 0,
    target: "self",
    values: { block: 3, magic: 9 },
    upgradeValues: { block: 4 },
    keywords: [],
    onPlay: (ctx) => {
      const base = ctx.upgraded ? 4 : 3;
      const bonus = ctx.combat!.player.stance === "WRATH" ? (ctx.upgraded ? 14 : 9) : 0;
      const block = calcBlock(ctx, base + bonus, ctx.card, true);
      ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
    },
  },
  {
    // "Scry 1(2). Gain 2(3) Block. Deal 3(4) damage." - in that order.
    id: "JUST_LUCKY",
    name: "Just Lucky",
    color: "purple",
    type: "attack",
    rarity: "common",
    cost: 0,
    target: "enemy",
    values: { damage: 3, block: 2, magic: 1 },
    upgradeValues: { damage: 4, block: 3, magic: 2 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/scryStart", args: { n: ctx.upgraded ? 2 : 1 } });
      const block = calcBlock(ctx, ctx.upgraded ? 3 : 2, ctx.card, true);
      ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 4 : 3);
      ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
    },
  },
  {
    // "Apply 8(11) Mark. ALL enemies lose HP equal to their Mark." The trigger
    // resolves after the application, so the target's fresh Mark counts.
    id: "PRESSURE_POINTS",
    name: "Pressure Points",
    color: "purple",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { magic: 8 },
    upgradeValues: { magic: 11 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      ctx.queue.addToBottom({
        kind: "applyPower",
        source: PLAYER,
        target: monster(target),
        powerId: "MARK",
        amount: ctx.upgraded ? 11 : 8,
      });
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/pressurePoints" });
    },
  },
  {
    id: "PROSTRATE",
    name: "Prostrate",
    color: "purple",
    type: "skill",
    rarity: "common",
    cost: 0,
    target: "self",
    values: { block: 4, magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/gainMantra", args: { n: ctx.upgraded ? 3 : 2 } });
      const block = calcBlock(ctx, 4, ctx.card, true);
      ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
    },
  },
  {
    id: "PROTECT",
    name: "Protect",
    color: "purple",
    type: "skill",
    rarity: "common",
    cost: 2,
    target: "self",
    values: { block: 12 },
    upgradeValues: { block: 16 },
    keywords: ["selfRetain"],
    primitives: [{ do: "block", n: "block" }],
  },
  {
    id: "SASH_WHIP",
    name: "Sash Whip",
    color: "purple",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 8, magic: 1 },
    upgradeValues: { damage: 10, magic: 2 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 10 : 8);
      ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
      if (ctx.combat!.turnFlags.lastCardPlayedType === "attack") {
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: PLAYER,
          target: monster(target),
          powerId: "WEAK",
          amount: ctx.upgraded ? 2 : 1,
        });
      }
    },
  },
  {
    id: "THIRD_EYE",
    name: "Third Eye",
    color: "purple",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 7, magic: 3 },
    upgradeValues: { block: 9, magic: 5 },
    keywords: [],
    onPlay: (ctx) => {
      const block = calcBlock(ctx, ctx.upgraded ? 9 : 7, ctx.card, true);
      ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/scryStart", args: { n: ctx.upgraded ? 5 : 3 } });
    },
  },
  {
    id: "TRANQUILITY",
    name: "Tranquility",
    color: "purple",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust", "selfRetain"],
    primitives: [{ do: "changeStance", stance: "CALM" }],
  },
];
