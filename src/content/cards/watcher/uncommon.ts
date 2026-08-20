// Watcher uncommons (35). Values audited vs data/corpus/cards.json.
// ENGINE-NOTE on upgrade-gated keywords: for BATTLE_HYMN and WORSHIP the corpus
// structured flags carry the keyword on the base card, but the corpus card TEXT
// ("[|$Innate. ]", "[|$Retain. ]") and V2.3.4 gate it to the upgrade — the gate
// wins here (keywords/upgradeKeywords split), matching real behavior.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage, calcBlock } from "../../../engine/combat/damageCalc";
import { moveCard } from "../../../engine/combat/piles";
import { PLAYER, monster } from "../../../engine/core/ids";

export const watcherUncommons: CardDef[] = [
  {
    id: "BATTLE_HYMN",
    name: "Battle Hymn",
    color: "purple",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: {},
    keywords: [],
    upgradeKeywords: ["innate"],
    primitives: [{ do: "applyPower", power: "BATTLE_HYMN", n: "magic", target: "self" }],
  },
  {
    id: "CARVE_REALITY",
    name: "Carve Reality",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 6 },
    upgradeValues: { damage: 10 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "makeCard", card: "SMITE", dest: "hand" },
    ],
  },
  {
    // "Put a Miracle+ into your hand at the start of your next X(X+1) turns."
    id: "COLLECT",
    name: "Collect",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: -1,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      const amt = ctx.energyOnUse + (ctx.upgraded ? 1 : 0);
      if (amt > 0) {
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "COLLECT", amount: amt });
      }
    },
  },
  {
    id: "CONCLUDE",
    name: "Conclude",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "allenemy",
    values: { damage: 12 },
    upgradeValues: { damage: 16 },
    keywords: [],
    primitives: [{ do: "damageAll", n: "damage" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/endTurn" });
    },
  },
  {
    id: "DECEIVE_REALITY",
    name: "Deceive Reality",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { block: 4 },
    upgradeValues: { block: 7 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "makeCard", card: "SAFETY", dest: "hand" },
    ],
  },
  {
    id: "EMPTY_MIND",
    name: "Empty Mind",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: ["tag:empty"],
    primitives: [
      { do: "changeStance", stance: "NEUTRAL" },
      { do: "draw", n: "magic" },
    ],
  },
  {
    // "Gain 3(4) Strength/Dexterity. Gain 1 less Energy at the start of each
    // turn." — the energy loss is the FASTING power (see powers/watcher.ts).
    id: "FASTING",
    name: "Fasting",
    color: "purple",
    type: "power",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    primitives: [
      { do: "applyPower", power: "STRENGTH", n: "magic", target: "self" },
      { do: "applyPower", power: "DEXTERITY", n: "magic", target: "self" },
      { do: "applyPower", power: "FASTING", n: 1, target: "self" },
    ],
  },
  {
    // "Deal 8(11) damage. If the enemy intends to Attack, enter Calm." Intent
    // is read at use time from the target's current move (game parity).
    id: "FEAR_NO_EVIL",
    name: "Fear No Evil",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 8 },
    upgradeValues: { damage: 11 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const m = ctx.combat!.monsters[target];
      const move = m?.move ? ctx.bundle.monsters.get(m.id)?.moves[m.move] : undefined;
      const intendsAttack = move !== undefined && move.intent.startsWith("attack");
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 11 : 8);
      ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
      if (intendsAttack) ctx.queue.addToBottom({ kind: "changeStance", stanceId: "CALM" });
    },
  },
  {
    id: "FOREIGN_INFLUENCE",
    name: "Foreign Influence",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/foreignInfluenceChoose", args: { zeroCost: ctx.upgraded } });
    },
  },
  {
    id: "FORESIGHT",
    name: "Foresight",
    color: "purple",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "FORESIGHT", n: "magic", target: "self" }],
  },
  {
    id: "INDIGNATION",
    name: "Indignation",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: { magic: 3 },
    upgradeValues: { magic: 5 },
    keywords: [],
    onPlay: (ctx) => {
      if (ctx.combat!.player.stance === "WRATH") {
        for (const m of ctx.combat!.monsters) {
          if (m.isDead || m.isEscaped) continue;
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: PLAYER,
            target: monster(m.idx),
            powerId: "VULNERABLE",
            amount: ctx.upgraded ? 5 : 3,
          });
        }
      } else {
        ctx.queue.addToBottom({ kind: "changeStance", stanceId: "WRATH" });
      }
    },
  },
  {
    id: "INNER_PEACE",
    name: "Inner Peace",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    onPlay: (ctx) => {
      if (ctx.combat!.player.stance === "CALM") {
        ctx.queue.addToBottom({ kind: "draw", n: ctx.upgraded ? 4 : 3 });
      } else {
        ctx.queue.addToBottom({ kind: "changeStance", stanceId: "CALM" });
      }
    },
  },
  {
    id: "LIKE_WATER",
    name: "Like Water",
    color: "purple",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: { magic: 5 },
    upgradeValues: { magic: 7 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "LIKE_WATER", n: "magic", target: "self" }],
  },
  {
    // "Put 1(2) card(s) from your discard pile into your hand and Retain
    // it(them). Enter Calm. End your turn."
    id: "MEDITATE",
    name: "Meditate",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/meditateChoose", args: { n: ctx.upgraded ? 2 : 1 } });
      ctx.queue.addToBottom({ kind: "changeStance", stanceId: "CALM" });
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/endTurn" });
    },
  },
  {
    id: "MENTAL_FORTRESS",
    name: "Mental Fortress",
    color: "purple",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 4 },
    upgradeValues: { magic: 6 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "MENTAL_FORTRESS", n: "magic", target: "self" }],
  },
  {
    id: "NIRVANA",
    name: "Nirvana",
    color: "purple",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "NIRVANA", n: "magic", target: "self" }],
  },
  {
    // "Retain. Gain 5(7) Block. Whenever this card is Retained, increase its
    // Block by 2(3)." — growth lives in card.misc (this combat).
    id: "PERSEVERANCE",
    name: "Perseverance",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { block: 5, magic: 2 },
    upgradeValues: { block: 7, magic: 3 },
    keywords: ["selfRetain"],
    onPlay: (ctx) => {
      const block = calcBlock(ctx, (ctx.upgraded ? 7 : 5) + ctx.card.misc, ctx.card, true);
      ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
    },
    onRetainThis: (ctx) => {
      ctx.card.misc += ctx.upgraded ? 3 : 2;
    },
  },
  {
    id: "PRAY",
    name: "Pray",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/gainMantra", args: { n: ctx.upgraded ? 4 : 3 } });
      ctx.queue.addToBottom({ kind: "makeTempCard", defId: "INSIGHT", upgrades: 0, dest: "draw", n: 1 });
    },
  },
  {
    id: "REACH_HEAVEN",
    name: "Reach Heaven",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 10 },
    upgradeValues: { damage: 15 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "makeCard", card: "THROUGH_VIOLENCE", dest: "draw" },
    ],
  },
  {
    id: "RUSHDOWN",
    name: "Rushdown",
    color: "purple",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { cost: 0 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "RUSHDOWN", n: "magic", target: "self" }],
  },
  {
    id: "SANCTITY",
    name: "Sanctity",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { block: 6, magic: 2 },
    upgradeValues: { block: 9 },
    keywords: [],
    onPlay: (ctx) => {
      const block = calcBlock(ctx, ctx.upgraded ? 9 : 6, ctx.card, true);
      ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
      if (ctx.combat!.turnFlags.lastCardPlayedType === "skill") {
        ctx.queue.addToBottom({ kind: "draw", n: 2 });
      }
    },
  },
  {
    // "Retain. Deal 20(26) damage. When Retained, lower its cost by 1 this
    // combat." — permanent in-combat cost drop on the instance.
    id: "SANDS_OF_TIME",
    name: "Sands of Time",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 4,
    target: "enemy",
    values: { damage: 20 },
    upgradeValues: { damage: 26 },
    keywords: ["selfRetain"],
    primitives: [{ do: "damage", n: "damage" }],
    onRetainThis: (ctx) => {
      ctx.card.cost = Math.max(0, ctx.card.cost - 1);
      ctx.card.costForTurn = Math.max(0, ctx.card.costForTurn - 1);
    },
  },
  {
    // "Can only be played if this is the only Attack in your hand."
    id: "SIGNATURE_MOVE",
    name: "Signature Move",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 30 },
    upgradeValues: { damage: 40 },
    keywords: [],
    canUse: (ctx) => {
      const combat = ctx.combat!;
      return !combat.player.piles.hand.some(
        (iid) => iid !== ctx.card.iid && ctx.bundle.cards.get(combat.cards[iid]!.defId)?.type === "attack",
      );
    },
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    // "At the start of your next turn, enter Wrath and draw 2(3) cards." —
    // the game's WrathNextTurnPower + DrawCardNextTurnPower pair.
    id: "SIMMERING_FURY",
    name: "Simmering Fury",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "WRATH_NEXT_TURN", amount: 1 });
      ctx.queue.addToBottom({
        kind: "applyPower",
        source: PLAYER,
        target: PLAYER,
        powerId: "DRAW_CARD_NEXT_TURN",
        amount: ctx.upgraded ? 3 : 2,
      });
    },
  },
  {
    id: "STUDY",
    name: "Study",
    color: "purple",
    type: "power",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { cost: 1 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "STUDY", n: "magic", target: "self" }],
  },
  {
    id: "SWIVEL",
    name: "Swivel",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: { block: 8 },
    upgradeValues: { block: 11 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "applyPower", power: "FREE_ATTACK_POWER", n: 1, target: "self" },
    ],
  },
  {
    id: "TALK_TO_THE_HAND",
    name: "Talk to the Hand",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 5, magic: 2 },
    upgradeValues: { damage: 7, magic: 3 },
    keywords: ["exhaust"],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "BLOCK_RETURN", n: "magic", target: "target" },
    ],
  },
  {
    // "Deal 3 damage 3(4) times. Enter Wrath. Shuffle this card into your draw
    // pile." — terminal destination handled by afterUse.
    id: "TANTRUM",
    name: "Tantrum",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 3, magic: 3, hits: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const hits = ctx.upgraded ? 4 : 3;
      const dmg = calcCardDamage(ctx, ctx.card, target, 3);
      for (let i = 0; i < hits; i++) {
        ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
      }
      ctx.queue.addToBottom({ kind: "changeStance", stanceId: "WRATH" });
    },
    afterUse: "shuffleIntoDraw",
  },
  {
    // "Deal 9(12) damage. Gain Block equal to unblocked damage dealt."
    id: "WALLOP",
    name: "Wallop",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 9 },
    upgradeValues: { damage: 12 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 12 : 9);
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/wallop", args: { idx: target, dmg } });
    },
  },
  {
    id: "WAVE_OF_THE_HAND",
    name: "Wave of the Hand",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "WAVE_OF_THE_HAND", n: "magic", target: "self" }],
  },
  {
    // "Whenever you Scry, return this from the discard pile to your hand."
    id: "WEAVE",
    name: "Weave",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { damage: 4 },
    upgradeValues: { damage: 6 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onScryThisInDiscard: (ctx) => {
      if (ctx.combat!.player.piles.hand.length < 10) moveCard(ctx, ctx.card.iid, "hand");
    },
  },
  {
    id: "WHEEL_KICK",
    name: "Wheel Kick",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 15, magic: 2 },
    upgradeValues: { damage: 20 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "draw", n: "magic" },
    ],
  },
  {
    // "Retain. Deal 7(10) damage. When Retained, increase its damage by 4(5)
    // this combat." — growth lives in card.misc.
    id: "WINDMILL_STRIKE",
    name: "Windmill Strike",
    color: "purple",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 7, magic: 4 },
    upgradeValues: { damage: 10, magic: 5 },
    keywords: ["selfRetain", "strike"],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, (ctx.upgraded ? 10 : 7) + ctx.card.misc);
      ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
    },
    onRetainThis: (ctx) => {
      ctx.card.misc += ctx.upgraded ? 5 : 4;
    },
  },
  {
    id: "WORSHIP",
    name: "Worship",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: { magic: 5 },
    upgradeValues: {},
    keywords: [],
    upgradeKeywords: ["selfRetain"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "watcher/gainMantra", args: { n: 5 } });
    },
  },
  {
    id: "WREATH_OF_FLAME",
    name: "Wreath of Flame",
    color: "purple",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 5 },
    upgradeValues: { magic: 8 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "VIGOR", n: "magic", target: "self" }],
  },
];
