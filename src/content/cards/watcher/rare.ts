// Watcher rares (17). Values audited vs data/corpus/cards.json.
// ENGINE-NOTE on upgrade-gated keywords: for ALPHA, ESTABLISHMENT (Innate) and
// BLASPHEMY (Retain) the corpus structured flags carry the keyword on the base
// card, but the corpus card TEXT ("[|$Innate. ]", "[|$Retain. ]") and V2.3.4
// gate it to the upgrade - the gate wins here (keywords/upgradeKeywords split).

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage, calcBlock } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { mantraGainedThisCombat } from "./effects";

export const watcherRares: CardDef[] = [
  {
    id: "ALPHA",
    name: "Alpha",
    color: "purple",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    upgradeKeywords: ["exhaust", "innate"],
    primitives: [{ do: "makeCard", card: "BETA", dest: "draw" }],
  },
  {
    // "Enter Divinity. Die next turn. Exhaust" - the death is the BLASPHEMER
    // power; the Divinity entry goes through watcher/enterDivinity so the
    // Brilliance mantra tally doesn't misread it as a +10 threshold crossing.
    id: "BLASPHEMY",
    name: "Blasphemy",
    color: "purple",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    upgradeKeywords: ["exhaust", "selfRetain"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/enterDivinity" });
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "BLASPHEMER", amount: 1 });
    },
  },
  {
    // "Deal 12(16) damage. Deals additional damage equal to Mantra gained this
    // combat." (tracked tally - see MANTRA_GAINED in powers/watcher.ts)
    id: "BRILLIANCE",
    name: "Brilliance",
    color: "purple",
    type: "attack",
    rarity: "rare",
    cost: 1,
    target: "enemy",
    values: { damage: 12, magic: 0 },
    upgradeValues: { damage: 16 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const bonus = mantraGainedThisCombat(ctx);
      const dmg = calcCardDamage(ctx, ctx.card, target, (ctx.upgraded ? 16 : 12) + bonus);
      ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
    },
  },
  {
    // "Shuffle an Expunger with X(X+1) [hits] into your draw pile."
    id: "CONJURE_BLADE",
    name: "Conjure Blade",
    color: "purple",
    type: "skill",
    rarity: "rare",
    cost: -1,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "watcher/conjureBlade",
        args: { x: ctx.energyOnUse + (ctx.upgraded ? 1 : 0) },
      });
    },
  },
  {
    // "Unplayable. When you draw this card, add 2(3) Miracles to your hand and
    // Exhaust." - pure onDrawThis self-trigger.
    id: "DEUS_EX_MACHINA",
    name: "Deus Ex Machina",
    color: "purple",
    type: "skill",
    rarity: "rare",
    cost: -2,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: ["exhaust"],
    onDrawThis: (ctx) => {
      ctx.queue.addToBottom({ kind: "makeTempCard", defId: "MIRACLE", upgrades: 0, dest: "hand", n: ctx.upgraded ? 3 : 2 });
      ctx.queue.addToBottom({ kind: "exhaust", sel: { kind: "iid", iid: ctx.card.iid } });
    },
  },
  {
    id: "DEVA_FORM",
    name: "Deva Form",
    color: "purple",
    type: "power",
    rarity: "rare",
    cost: 3,
    target: "self",
    values: { magic: 1 },
    upgradeValues: {},
    keywords: ["ethereal"],
    upgradeKeywords: [],
    primitives: [{ do: "applyPower", power: "DEVA", n: "magic", target: "self" }],
  },
  {
    id: "DEVOTION",
    name: "Devotion",
    color: "purple",
    type: "power",
    rarity: "rare",
    cost: 1,
    target: "none",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "DEVOTION", n: "magic", target: "self" }],
  },
  {
    id: "ESTABLISHMENT",
    name: "Establishment",
    color: "purple",
    type: "power",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: {},
    keywords: [],
    upgradeKeywords: ["innate"],
    primitives: [{ do: "applyPower", power: "ESTABLISHMENT", n: "magic", target: "self" }],
  },
  {
    // "If the enemy has 30(40) or less HP, set their HP to 0."
    id: "JUDGMENT",
    name: "Judgment",
    color: "purple",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "enemy",
    values: { magic: 30 },
    upgradeValues: { magic: 40 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "watcher/judgment",
        args: { idx: ctx.target ?? 0, threshold: ctx.upgraded ? 40 : 30 },
      });
    },
  },
  {
    // "Deal 10(13) damage. If Fatal, Upgrade a random card in your deck."
    id: "LESSON_LEARNED",
    name: "Lesson Learned",
    color: "purple",
    type: "attack",
    rarity: "rare",
    cost: 2,
    target: "enemy",
    values: { damage: 10 },
    upgradeValues: { damage: 13 },
    keywords: ["exhaust", "tag:healing"],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 13 : 10);
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/lessonLearned", args: { idx: target, dmg } });
    },
  },
  {
    id: "MASTER_REALITY",
    name: "Master Reality",
    color: "purple",
    type: "power",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "MASTER_REALITY", n: 1, target: "self" }],
  },
  {
    // "Choose a card in your draw pile. Play the chosen card twice and Exhaust
    // it. Exhaust."
    id: "OMNISCIENCE",
    name: "Omniscience",
    color: "purple",
    type: "skill",
    rarity: "rare",
    cost: 4,
    target: "none",
    values: { magic: 2 },
    upgradeValues: { cost: 3 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/omniscienceChoose" });
    },
  },
  {
    // "Deal 5(6) damage to a random enemy 5(6) times." - target rolled per hit
    // at resolve time, per-target damage calc (Sword Boomerang pattern).
    id: "RAGNAROK",
    name: "Ragnarok",
    color: "purple",
    type: "attack",
    rarity: "rare",
    cost: 3,
    target: "allenemy",
    values: { damage: 5, magic: 5, hits: 5 },
    upgradeValues: { damage: 6, magic: 6 },
    keywords: [],
    onPlay: (ctx) => {
      const hits = ctx.upgraded ? 6 : 5;
      const base = ctx.upgraded ? 6 : 5;
      for (let i = 0; i < hits; i++) {
        ctx.queue.addToBottom({ kind: "effect", ref: "watcher/ragnarokHit", args: { iid: ctx.card.iid, base } });
      }
    },
  },
  {
    id: "SCRAWL",
    name: "Scrawl",
    color: "purple",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/scrawl" });
    },
  },
  {
    // "Gain 3(4) Block for each card in your hand." (the resolving card sits
    // in limbo, so it doesn't count itself - game parity)
    id: "SPIRIT_SHIELD",
    name: "Spirit Shield",
    color: "purple",
    type: "skill",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    onPlay: (ctx) => {
      const per = ctx.upgraded ? 4 : 3;
      const count = ctx.combat!.player.piles.hand.length;
      const block = calcBlock(ctx, per * count, ctx.card, true);
      ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
    },
  },
  {
    // "Take an extra turn after this one. End your turn." - the coming monster
    // turn is skipped entirely (round-end ticks still happen).
    id: "VAULT",
    name: "Vault",
    color: "purple",
    type: "skill",
    rarity: "rare",
    cost: 3,
    target: "all",
    values: {},
    upgradeValues: { cost: 2 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.combat!.turnFlags.skipMonsterTurn = true;
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/endTurn" });
    },
  },
  {
    // "Choose one: Gain 6(8) Plated Armor, 3(4) Strength, or 25(30) Gold."
    id: "WISH",
    name: "Wish",
    color: "purple",
    type: "skill",
    rarity: "rare",
    cost: 3,
    target: "none",
    values: { damage: 3, block: 6, magic: 25 },
    upgradeValues: { damage: 4, block: 8, magic: 30 },
    keywords: ["exhaust", "tag:healing"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "watcher/wishChoose",
        args: { armor: ctx.upgraded ? 8 : 6, str: ctx.upgraded ? 4 : 3, gold: ctx.upgraded ? 30 : 25 },
      });
    },
  },
];
