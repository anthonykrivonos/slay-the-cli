// Ironclad common cards (BODY_SLAM and ANGER live in basics.ts).
// Values audited against data/corpus/cards.json - corpus numbers only.

import type { CardDef, CardCtx } from "../../../engine/content/defs";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { getPowerAmount } from "../../../engine/combat/powerRuntime";

/** Effective keyword set for an instance (upgrade keyword swaps respected). */
function instanceKeywords(ctx: CardCtx, iid: number): string[] {
  const c = ctx.combat!.cards[iid]!;
  const def = ctx.bundle.cards.get(c.defId);
  if (!def) return [];
  return c.upgrades > 0 && def.upgradeKeywords ? def.upgradeKeywords : def.keywords;
}

/**
 * Perfected Strike: count cards with the "strike" keyword. V2.3.4 counts
 * hand + draw + discard at use time (exhaust pile excluded); the count happens
 * before the played card leaves the hand, so the card itself (now in limbo) is
 * included explicitly.
 */
function countStrikes(ctx: CardCtx): number {
  const piles = ctx.combat!.player.piles;
  let n = 0;
  for (const pile of ["draw", "hand", "discard"] as const) {
    for (const iid of piles[pile]) if (instanceKeywords(ctx, iid).includes("strike")) n++;
  }
  if (instanceKeywords(ctx, ctx.card.iid).includes("strike")) n++;
  return n;
}

export const ironcladCommons: CardDef[] = [
  {
    id: "ARMAMENTS",
    name: "Armaments",
    color: "red",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 5 },
    upgradeValues: { block: 5 },
    keywords: [],
    primitives: [{ do: "block", n: "block" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/armamentsChoose", args: { all: ctx.upgraded } });
    },
  },
  {
    id: "CLASH",
    name: "Clash",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 0,
    target: "enemy",
    values: { damage: 14 },
    upgradeValues: { damage: 18 },
    keywords: [],
    canUse: (ctx) =>
      ctx.combat!.player.piles.hand.every(
        (iid) => ctx.bundle.cards.get(ctx.combat!.cards[iid]!.defId)?.type === "attack",
      ),
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "CLEAVE",
    name: "Cleave",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "allenemy",
    values: { damage: 8 },
    upgradeValues: { damage: 11 },
    keywords: [],
    primitives: [{ do: "damageAll", n: "damage" }],
  },
  {
    id: "CLOTHESLINE",
    name: "Clothesline",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 2,
    target: "enemy",
    values: { damage: 12, magic: 2 },
    upgradeValues: { damage: 14, magic: 3 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "WEAK", n: "magic", target: "target" },
    ],
  },
  {
    id: "FLEX",
    name: "Flex",
    color: "red",
    type: "skill",
    rarity: "common",
    cost: 0,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 4 },
    keywords: [],
    primitives: [
      { do: "applyPower", power: "STRENGTH", n: "magic", target: "self" },
      { do: "applyPower", power: "LOSE_STRENGTH", n: "magic", target: "self" },
    ],
  },
  {
    id: "HAVOC",
    name: "Havoc",
    color: "red",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/havoc" });
    },
  },
  {
    id: "HEADBUTT",
    name: "Headbutt",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 9 },
    upgradeValues: { damage: 12 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/headbuttChoose" });
    },
  },
  {
    id: "HEAVY_BLADE",
    name: "Heavy Blade",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 2,
    target: "enemy",
    values: { damage: 14, magic: 3 },
    upgradeValues: { damage: 14, magic: 5 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      // Strength affects this card magic times: fold (magic - 1) extra Strength
      // into the base; the normal pipeline applies the final one.
      const str = getPowerAmount(ctx, PLAYER, "STRENGTH");
      const extraTimes = (ctx.upgraded ? 5 : 3) - 1;
      const dmg = calcCardDamage(ctx, ctx.card, target, 14 + str * extraTimes);
      ctx.queue.addToBottom({
        kind: "damage",
        target: monster(target),
        info: { type: "attack", source: PLAYER, amount: dmg },
      });
    },
  },
  {
    id: "IRON_WAVE",
    name: "Iron Wave",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 5, block: 5 },
    upgradeValues: { damage: 7, block: 7 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "damage", n: "damage" },
    ],
  },
  {
    id: "PERFECTED_STRIKE",
    name: "Perfected Strike",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 2,
    target: "enemy",
    values: { damage: 6, magic: 2 },
    upgradeValues: { damage: 6, magic: 3 },
    keywords: ["strike", "tag:strike"],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const per = ctx.upgraded ? 3 : 2;
      const dmg = calcCardDamage(ctx, ctx.card, target, 6 + per * countStrikes(ctx));
      ctx.queue.addToBottom({
        kind: "damage",
        target: monster(target),
        info: { type: "attack", source: PLAYER, amount: dmg },
      });
    },
  },
  {
    id: "POMMEL_STRIKE",
    name: "Pommel Strike",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 9, magic: 1 },
    upgradeValues: { damage: 10, magic: 2 },
    keywords: ["strike", "tag:strike"],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "draw", n: "magic" },
    ],
  },
  {
    id: "SHRUG_IT_OFF",
    name: "Shrug It Off",
    color: "red",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 8 },
    upgradeValues: { block: 11 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "draw", n: 1 },
    ],
  },
  {
    id: "SWORD_BOOMERANG",
    name: "Sword Boomerang",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "allenemy",
    values: { damage: 3, magic: 3, hits: 3 },
    upgradeValues: { damage: 3, magic: 4, hits: 3 },
    keywords: [],
    onPlay: (ctx) => {
      // magic hits, each at a random enemy; target + enemy powers resolve per hit
      const hits = ctx.upgraded ? 4 : 3;
      for (let i = 0; i < hits; i++) {
        ctx.queue.addToBottom({
          kind: "effect",
          ref: "ironclad/swordBoomerangHit",
          args: { iid: ctx.card.iid, base: 3 },
        });
      }
    },
  },
  {
    id: "THUNDERCLAP",
    name: "Thunderclap",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "allenemy",
    values: { damage: 4 },
    upgradeValues: { damage: 7 },
    keywords: [],
    primitives: [
      { do: "damageAll", n: "damage" },
      { do: "applyPower", power: "VULNERABLE", n: 1, target: "all" },
    ],
  },
  {
    id: "TRUE_GRIT",
    name: "True Grit",
    color: "red",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 7 },
    upgradeValues: { block: 9 },
    keywords: [],
    primitives: [{ do: "block", n: "block" }],
    onPlay: (ctx) => {
      if (ctx.upgraded) {
        ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/trueGritChoose" });
      } else {
        ctx.queue.addToBottom({ kind: "exhaust", sel: { kind: "random", pile: "hand", n: 1 } });
      }
    },
  },
  {
    id: "TWIN_STRIKE",
    name: "Twin Strike",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 5 },
    upgradeValues: { damage: 7 },
    keywords: ["strike", "tag:strike"],
    primitives: [{ do: "damage", n: "damage", hits: 2 }],
  },
  {
    id: "WARCRY",
    name: "Warcry",
    color: "red",
    type: "skill",
    rarity: "common",
    cost: 0,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "draw", n: ctx.upgraded ? 2 : 1 });
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/warcryChoose" });
    },
  },
  {
    id: "WILD_STRIKE",
    name: "Wild Strike",
    color: "red",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 12 },
    upgradeValues: { damage: 17 },
    keywords: ["strike", "tag:strike"],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "makeCard", card: "WOUND", dest: "draw" }, // random draw position = shuffled in
    ],
  },
];
