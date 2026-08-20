// Ironclad rare cards. Values audited against data/corpus/cards.json.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { getPowerAmount } from "../../../engine/combat/powerRuntime";

export const ironcladRares: CardDef[] = [
  {
    id: "BARRICADE",
    name: "Barricade",
    color: "red",
    type: "power",
    rarity: "rare",
    cost: 3,
    target: "self",
    values: {},
    upgradeValues: { cost: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "BARRICADE", n: 1, target: "self" }],
  },
  {
    id: "BERSERK",
    name: "Berserk",
    color: "red",
    type: "power",
    rarity: "rare",
    cost: 0,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 1 },
    keywords: [],
    primitives: [
      { do: "applyPower", power: "VULNERABLE", n: "magic", target: "self" },
      { do: "applyPower", power: "BERSERK", n: 1, target: "self" },
    ],
  },
  {
    id: "BLUDGEON",
    name: "Bludgeon",
    color: "red",
    type: "attack",
    rarity: "rare",
    cost: 3,
    target: "enemy",
    values: { damage: 32 },
    upgradeValues: { damage: 42 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "BRUTALITY",
    name: "Brutality",
    color: "red",
    type: "power",
    rarity: "rare",
    cost: 0,
    target: "self",
    values: {},
    upgradeValues: {},
    // Innate only when upgraded (corpus flags now gate this correctly)
    keywords: [],
    upgradeKeywords: ["innate"],
    primitives: [{ do: "applyPower", power: "BRUTALITY", n: 1, target: "self" }],
  },
  {
    id: "CORRUPTION",
    name: "Corruption",
    color: "red",
    type: "power",
    rarity: "rare",
    cost: 3,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { cost: 2, magic: 3 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "CORRUPTION", n: 1, target: "self" }],
  },
  {
    id: "DEMON_FORM",
    name: "Demon Form",
    color: "red",
    type: "power",
    rarity: "rare",
    cost: 3,
    target: "none",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "DEMON_FORM", n: "magic", target: "self" }],
  },
  {
    id: "DOUBLE_TAP",
    name: "Double Tap",
    color: "red",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "DOUBLE_TAP", n: "magic", target: "self" }],
  },
  {
    id: "EXHUME",
    name: "Exhume",
    color: "red",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/exhumeChoose" });
    },
  },
  {
    id: "FEED",
    name: "Feed",
    color: "red",
    type: "attack",
    rarity: "rare",
    cost: 1,
    target: "enemy",
    values: { damage: 10, magic: 3 },
    upgradeValues: { damage: 12, magic: 4 },
    keywords: ["exhaust", "tag:healing"],
    onPlay: (ctx) => {
      // damage + fatal bonus resolve atomically (the bonus must land even when
      // the kill ends the combat — see effects.ts)
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 12 : 10);
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "ironclad/feed",
        args: { idx: target, dmg, bonus: ctx.upgraded ? 4 : 3 },
      });
    },
  },
  {
    id: "FIEND_FIRE",
    name: "Fiend Fire",
    color: "red",
    type: "attack",
    rarity: "rare",
    cost: 2,
    target: "enemy",
    values: { damage: 7 },
    upgradeValues: { damage: 10 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const n = ctx.combat!.player.piles.hand.length; // hand size at use time
      ctx.queue.addToBottom({ kind: "exhaust", sel: { kind: "all", pile: "hand" } });
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 10 : 7);
      for (let i = 0; i < n; i++) {
        ctx.queue.addToBottom({
          kind: "damage",
          target: monster(target),
          info: { type: "attack", source: PLAYER, amount: dmg },
        });
      }
    },
  },
  {
    id: "IMMOLATE",
    name: "Immolate",
    color: "red",
    type: "attack",
    rarity: "rare",
    cost: 2,
    target: "allenemy",
    values: { damage: 21 },
    upgradeValues: { damage: 28 },
    keywords: [],
    primitives: [
      { do: "damageAll", n: "damage" },
      { do: "makeCard", card: "BURN", dest: "discard" },
    ],
  },
  {
    id: "IMPERVIOUS",
    name: "Impervious",
    color: "red",
    type: "skill",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: { block: 30 },
    upgradeValues: { block: 40 },
    keywords: ["exhaust"],
    primitives: [{ do: "block", n: "block" }],
  },
  {
    id: "JUGGERNAUT",
    name: "Juggernaut",
    color: "red",
    type: "power",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: { magic: 5 },
    upgradeValues: { magic: 7 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "JUGGERNAUT", n: "magic", target: "self" }],
  },
  {
    id: "LIMIT_BREAK",
    name: "Limit Break",
    color: "red",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    upgradeKeywords: [], // upgraded Limit Break no longer Exhausts
    onPlay: (ctx) => {
      const str = getPowerAmount(ctx, PLAYER, "STRENGTH");
      if (str !== 0) {
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: str });
      }
    },
  },
  {
    id: "OFFERING",
    name: "Offering",
    color: "red",
    type: "skill",
    rarity: "rare",
    cost: 0,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 5 },
    keywords: ["exhaust"],
    primitives: [
      { do: "loseHp", n: 6 },
      { do: "gainEnergy", n: 2 },
      { do: "draw", n: "magic" },
    ],
  },
  {
    id: "REAPER",
    name: "Reaper",
    color: "red",
    type: "attack",
    rarity: "rare",
    cost: 2,
    target: "allenemy",
    values: { damage: 4 },
    upgradeValues: { damage: 5 },
    keywords: ["exhaust", "tag:healing"],
    onPlay: (ctx) => {
      // damage + heal resolve atomically (the heal must land even when the
      // sweep ends the combat — see effects.ts)
      const base = ctx.upgraded ? 5 : 4;
      const amounts = ctx.combat!.monsters.map((_, i) => calcCardDamage(ctx, ctx.card, i, base));
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/reaper", args: { amounts } });
    },
  },
];
