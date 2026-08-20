// Ironclad basics + exemplar cards showing every implementation pattern:
// pure primitives (Strike/Defend/Bash), dynamic damage (Body Slam), side-effect
// on play (Anger), and X-cost (Whirlwind). Values audited vs data/corpus/cards.json.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";

export const ironcladBasics: CardDef[] = [
  {
    id: "STRIKE_RED",
    name: "Strike",
    color: "red",
    type: "attack",
    rarity: "basic",
    cost: 1,
    target: "enemy",
    values: { damage: 6 },
    upgradeValues: { damage: 9 },
    keywords: ["strike", "tag:starter_strike"],
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "DEFEND_RED",
    name: "Defend",
    color: "red",
    type: "skill",
    rarity: "basic",
    cost: 1,
    target: "self",
    values: { block: 5 },
    upgradeValues: { block: 8 },
    keywords: ["tag:starter_defend"],
    primitives: [{ do: "block", n: "block" }],
  },
  {
    id: "BASH",
    name: "Bash",
    color: "red",
    type: "attack",
    rarity: "basic",
    cost: 2,
    target: "enemy",
    values: { damage: 8, magic: 2 },
    upgradeValues: { damage: 10, magic: 3 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "VULNERABLE", n: "magic", target: "target" },
    ],
  },
  {
    id: "BODY_SLAM",
    name: "Body Slam",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 0 },
    upgradeValues: { cost: 0 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.combat!.player.block);
      ctx.queue.addToBottom({
        kind: "damage",
        target: monster(target),
        info: { type: "attack", source: PLAYER, amount: dmg },
      });
    },
  },
  {
    id: "ANGER",
    name: "Anger",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 0,
    target: "enemy",
    values: { damage: 6 },
    upgradeValues: { damage: 8 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 8 : 6);
      ctx.queue.addToBottom({
        kind: "damage",
        target: monster(target),
        info: { type: "attack", source: PLAYER, amount: dmg },
      });
      ctx.queue.addToBottom({
        kind: "makeTempCard",
        defId: "ANGER",
        upgrades: ctx.card.upgrades,
        dest: "discard",
        n: 1,
      });
    },
  },
  {
    id: "WHIRLWIND",
    name: "Whirlwind",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: -1,
    target: "allenemy",
    values: { damage: 5 },
    upgradeValues: { damage: 8 },
    keywords: [],
    onPlay: (ctx) => {
      const base = ctx.upgraded ? 8 : 5;
      const x = ctx.energyOnUse; // X-cost: captured at queue time; engine spends it
      const amounts = ctx.combat!.monsters.map((_, i) => calcCardDamage(ctx, ctx.card, i, base));
      for (let i = 0; i < x; i++) {
        ctx.queue.addToBottom({ kind: "damageAllMonsters", amounts, info: { type: "attack", source: PLAYER } });
      }
    },
  },
];
