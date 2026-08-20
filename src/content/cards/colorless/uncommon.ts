// Colorless uncommon cards (the obtainable colorless pool, uncommon half).
// Values audited against data/corpus/cards.json — corpus numbers only.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { getPowerAmount } from "../../../engine/combat/powerRuntime";
import { addRandomColorlessToHand } from "./effects";

export const colorlessUncommons: CardDef[] = [
  {
    id: "BANDAGE_UP",
    name: "Bandage Up",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { magic: 4 },
    upgradeValues: { magic: 6 },
    keywords: ["exhaust", "tag:healing"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "heal", target: PLAYER, amount: ctx.upgraded ? 6 : 4 });
    },
  },
  {
    id: "BLIND",
    name: "Blind",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { magic: 2 },
    upgradeValues: { magic: 2 },
    keywords: [],
    // ENGINE-NOTE: the upgrade changes the game's target to ALL_ENEMY; the def
    // keeps the corpus target "enemy" (a target is still supplied and ignored).
    onPlay: (ctx) => {
      if (ctx.upgraded) {
        for (const m of ctx.combat!.monsters) {
          if (m.isDead || m.isEscaped) continue;
          ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: monster(m.idx), powerId: "WEAK", amount: 2 });
        }
      } else {
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: PLAYER,
          target: monster(ctx.target ?? 0),
          powerId: "WEAK",
          amount: 2,
        });
      }
    },
  },
  {
    id: "DARK_SHACKLES",
    name: "Dark Shackles",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { magic: 9 },
    upgradeValues: { magic: 15 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      const t = monster(ctx.target ?? 0);
      const n = ctx.upgraded ? 15 : 9;
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: t, powerId: "STRENGTH", amount: -n });
      // the game checks Artifact at use time: with Artifact only the (negated)
      // Strength loss is attempted, and no end-of-turn restore is queued
      if (getPowerAmount(ctx, t, "ARTIFACT") === 0) {
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: t, powerId: "GENERIC_STRENGTH_UP", amount: n });
      }
    },
  },
  {
    id: "DEEP_BREATH",
    name: "Deep Breath",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "shuffleDiscardIntoDraw" });
      ctx.queue.addToBottom({ kind: "draw", n: ctx.upgraded ? 2 : 1 });
    },
  },
  {
    id: "DISCOVERY",
    name: "Discovery",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    upgradeKeywords: [], // upgraded Discovery no longer Exhausts
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "colorless/discoveryChoose" });
    },
  },
  {
    id: "DRAMATIC_ENTRANCE",
    name: "Dramatic Entrance",
    color: "colorless",
    type: "attack",
    rarity: "uncommon",
    cost: 0,
    target: "allenemy",
    values: { damage: 8 },
    upgradeValues: { damage: 12 },
    keywords: ["exhaust", "innate"],
    primitives: [{ do: "damageAll", n: "damage" }],
  },
  {
    id: "ENLIGHTENMENT",
    name: "Enlightenment",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: [],
    onPlay: (ctx) => {
      // base: costForTurn > 1 -> 1 this turn; upgraded: cost > 1 -> 1 for combat
      const combat = ctx.combat!;
      for (const iid of combat.player.piles.hand) {
        const c = combat.cards[iid]!;
        if (ctx.upgraded) {
          if (c.cost > 1) {
            c.cost = 1;
            c.costForTurn = 1;
          }
        } else if (c.costForTurn > 1) {
          c.costForTurn = 1;
        }
      }
    },
  },
  {
    id: "FINESSE",
    name: "Finesse",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { block: 2 },
    upgradeValues: { block: 4 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "draw", n: 1 },
    ],
  },
  {
    id: "FLASH_OF_STEEL",
    name: "Flash of Steel",
    color: "colorless",
    type: "attack",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { damage: 3 },
    upgradeValues: { damage: 6 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "draw", n: 1 },
    ],
  },
  {
    id: "FORETHOUGHT",
    name: "Forethought",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "colorless/forethoughtChoose", args: { any: ctx.upgraded } });
    },
  },
  {
    id: "GOOD_INSTINCTS",
    name: "Good Instincts",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { block: 6 },
    upgradeValues: { block: 9 },
    keywords: [],
    primitives: [{ do: "block", n: "block" }],
  },
  {
    id: "IMPATIENCE",
    name: "Impatience",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "none",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      // conditional effect checked at use time (the played card is in limbo)
      const combat = ctx.combat!;
      const hasAttack = combat.player.piles.hand.some(
        (iid) => ctx.bundle.cards.get(combat.cards[iid]!.defId)?.type === "attack",
      );
      if (!hasAttack) ctx.queue.addToBottom({ kind: "draw", n: ctx.upgraded ? 3 : 2 });
    },
  },
  {
    id: "JACK_OF_ALL_TRADES",
    name: "Jack of All Trades",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "none",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // use-time rolls (the game rolls in use() and queues MakeTempCardInHand)
      addRandomColorlessToHand(ctx, ctx.upgraded ? 2 : 1);
    },
  },
  {
    id: "MADNESS",
    name: "Madness",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "colorless/madness" });
    },
  },
  {
    id: "MIND_BLAST",
    name: "Mind Blast",
    color: "colorless",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 0 },
    upgradeValues: { cost: 1, damage: 0 },
    keywords: ["innate"],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.combat!.player.piles.draw.length);
      ctx.queue.addToBottom({
        kind: "damage",
        target: monster(target),
        info: { type: "attack", source: PLAYER, amount: dmg },
      });
    },
  },
  {
    id: "PANACEA",
    name: "Panacea",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: ["exhaust"],
    primitives: [{ do: "applyPower", power: "ARTIFACT", n: "magic", target: "self" }],
  },
  {
    id: "PANIC_BUTTON",
    name: "Panic Button",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { block: 30, magic: 2 },
    upgradeValues: { block: 40, magic: 2 },
    keywords: ["exhaust"],
    // block is calculated before NO_BLOCK lands, so Panic Button itself blocks
    primitives: [
      { do: "block", n: "block" },
      { do: "applyPower", power: "NO_BLOCK", n: "magic", target: "self" },
    ],
  },
  {
    id: "PURITY",
    name: "Purity",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "none",
    values: { magic: 3 },
    upgradeValues: { magic: 5 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "colorless/purityChoose", args: { n: ctx.upgraded ? 5 : 3 } });
    },
  },
  {
    id: "SWIFT_STRIKE",
    name: "Swift Strike",
    color: "colorless",
    type: "attack",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { damage: 7 },
    upgradeValues: { damage: 10 },
    keywords: ["strike", "tag:strike"],
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "TRIP",
    name: "Trip",
    color: "colorless",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { magic: 2 },
    upgradeValues: { magic: 2 },
    keywords: [],
    // ENGINE-NOTE: upgraded Trip targets ALL enemies (target change, like Blind)
    onPlay: (ctx) => {
      if (ctx.upgraded) {
        for (const m of ctx.combat!.monsters) {
          if (m.isDead || m.isEscaped) continue;
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: PLAYER,
            target: monster(m.idx),
            powerId: "VULNERABLE",
            amount: 2,
          });
        }
      } else {
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: PLAYER,
          target: monster(ctx.target ?? 0),
          powerId: "VULNERABLE",
          amount: 2,
        });
      }
    },
  },
];
