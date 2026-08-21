// Silent rare cards. Values audited against data/corpus/cards.json - corpus
// numbers only.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { returnRandomPotion } from "../../../engine/run/rewards";

export const silentRares: CardDef[] = [
  {
    id: "ADRENALINE",
    name: "Adrenaline",
    color: "green",
    type: "skill",
    rarity: "rare",
    cost: 0,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "gainEnergy", n: ctx.upgraded ? 2 : 1 });
      ctx.queue.addToBottom({ kind: "draw", n: 2 });
    },
  },
  {
    id: "AFTER_IMAGE",
    name: "After Image",
    color: "green",
    type: "power",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: {},
    // Innate only when upgraded (corpus flags now gate this correctly)
    keywords: [],
    upgradeKeywords: ["innate"],
    primitives: [{ do: "applyPower", power: "AFTER_IMAGE", n: 1, target: "self" }],
  },
  {
    id: "ALCHEMIZE",
    name: "Alchemize",
    color: "green",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust", "tag:healing"],
    onPlay: (ctx) => {
      // "Obtain a random potion." The corpus doesn't pin the stream; the
      // game's returnRandomPotion consumes potionRng - reuse the run-layer
      // roller for exactness.
      const id = returnRandomPotion(ctx);
      if (!id) return;
      const slot = ctx.run.potions.indexOf(null);
      if (slot === -1) return; // no free potion slot: the potion is lost
      ctx.run.potions[slot] = id;
      ctx.emit("potionObtained", { id, slot });
    },
  },
  {
    id: "A_THOUSAND_CUTS",
    name: "A Thousand Cuts",
    color: "green",
    type: "power",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "A_THOUSAND_CUTS", n: "magic", target: "self" }],
  },
  {
    id: "BULLET_TIME",
    name: "Bullet Time",
    color: "green",
    type: "skill",
    rarity: "rare",
    cost: 3,
    target: "none",
    values: {},
    upgradeValues: { cost: 2 },
    keywords: [],
    onPlay: (ctx) => {
      // "Reduce the cost of all cards in your hand to 0 this turn": one-time
      // costForTurn rewrite of the CURRENT hand (BulletTime.java iterates the
      // hand; cards added later this turn cost normal). X-cost/unplayable
      // (cost < 0) pass through untouched.
      const combat = ctx.combat!;
      for (const iid of combat.player.piles.hand) {
        const c = combat.cards[iid]!;
        if (c.cost >= 0) c.costForTurn = 0;
      }
      // ENGINE-GAP: NO_DRAW cannot veto card-effect draws (Battle Trance
      // precedent, see powers/ironclad.ts) - "cannot draw additional cards
      // this turn" is not enforced against draw effects.
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "NO_DRAW", amount: 1 });
    },
  },
  {
    id: "BURST",
    name: "Burst",
    color: "green",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "BURST", n: "magic", target: "self" }],
  },
  {
    id: "CORPSE_EXPLOSION",
    name: "Corpse Explosion",
    color: "green",
    type: "skill",
    rarity: "rare",
    cost: 2,
    target: "enemy",
    values: { magic: 6 },
    upgradeValues: { magic: 9 },
    keywords: [],
    primitives: [
      { do: "applyPower", power: "POISON", n: "magic", target: "target" },
      { do: "applyPower", power: "CORPSE_EXPLOSION_POWER", n: 1, target: "target" },
    ],
  },
  {
    id: "DIE_DIE_DIE",
    name: "Die Die Die",
    color: "green",
    type: "attack",
    rarity: "rare",
    cost: 1,
    target: "allenemy",
    values: { damage: 13 },
    upgradeValues: { damage: 17 },
    keywords: ["exhaust"],
    primitives: [{ do: "damageAll", n: "damage" }],
  },
  {
    id: "DOPPELGANGER",
    name: "Doppelganger",
    color: "green",
    type: "skill",
    rarity: "rare",
    cost: -1,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // "Next turn, draw X (X+1) cards and gain X (X+1) energy." - the game
      // applies the two corpus powers DRAW_CARD_NEXT_TURN + ENERGIZED.
      const n = ctx.energyOnUse + (ctx.upgraded ? 1 : 0);
      if (n <= 0) return;
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "DRAW_CARD_NEXT_TURN", amount: n });
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "ENERGIZED", amount: n });
    },
  },
  {
    id: "ENVENOM",
    name: "Envenom",
    color: "green",
    type: "power",
    rarity: "rare",
    cost: 2,
    target: "self",
    values: {},
    upgradeValues: { cost: 1 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "ENVENOM", n: 1, target: "self" }],
  },
  {
    id: "GLASS_KNIFE",
    name: "Glass Knife",
    color: "green",
    type: "attack",
    rarity: "rare",
    cost: 1,
    target: "enemy",
    values: { damage: 8 },
    upgradeValues: { damage: 12 },
    keywords: [],
    onPlay: (ctx) => {
      // per-instance, per-combat decay tracked in card.misc (Rampage precedent):
      // both hits share one calc; -2 per play, damage floor 0
      const target = ctx.target ?? 0;
      const base = Math.max(0, (ctx.upgraded ? 12 : 8) - ctx.card.misc);
      const dmg = calcCardDamage(ctx, ctx.card, target, base);
      for (let i = 0; i < 2; i++) {
        ctx.queue.addToBottom({
          kind: "damage",
          target: monster(target),
          info: { type: "attack", source: PLAYER, amount: dmg },
        });
      }
      ctx.card.misc += 2;
    },
  },
  {
    id: "GRAND_FINALE",
    name: "Grand Finale",
    color: "green",
    type: "attack",
    rarity: "rare",
    cost: 0,
    target: "allenemy",
    values: { damage: 50 },
    upgradeValues: { damage: 60 },
    keywords: [],
    canUse: (ctx) => ctx.combat!.player.piles.draw.length === 0,
    primitives: [{ do: "damageAll", n: "damage" }],
  },
  {
    id: "MALAISE",
    name: "Malaise",
    color: "green",
    type: "skill",
    rarity: "rare",
    cost: -1,
    target: "enemy",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // "Enemy loses X (X+1) Strength. Apply X (X+1) Weak."
      // ENGINE-NOTE: like Disarm, the -Strength is a negative application of a
      // can-go-negative buff, which Artifact negates (game parity).
      const n = ctx.energyOnUse + (ctx.upgraded ? 1 : 0);
      if (n <= 0) return;
      const target = monster(ctx.target ?? 0);
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target, powerId: "STRENGTH", amount: -n });
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target, powerId: "WEAK", amount: n });
    },
  },
  {
    id: "NIGHTMARE",
    name: "Nightmare",
    color: "green",
    type: "skill",
    rarity: "rare",
    cost: 3,
    target: "none",
    values: { magic: 3 },
    upgradeValues: { cost: 2, magic: 3 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "silent/nightmareChoose" });
    },
  },
  {
    id: "PHANTASMAL_KILLER",
    name: "Phantasmal Killer",
    color: "green",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "PHANTASMAL", n: 1, target: "self" }],
  },
  {
    id: "STORM_OF_STEEL",
    name: "Storm of Steel",
    color: "green",
    type: "skill",
    rarity: "rare",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    onPlay: (ctx) => {
      // "Discard your hand. Add 1 Shiv (Shiv+) into your hand for each card
      // discarded." Count captured at use time; the discards are manual.
      const n = ctx.combat!.player.piles.hand.length;
      ctx.queue.addToBottom({ kind: "discard", sel: { kind: "all", pile: "hand" }, manual: true });
      if (n > 0) {
        ctx.queue.addToBottom({ kind: "makeTempCard", defId: "SHIV", upgrades: ctx.upgraded ? 1 : 0, dest: "hand", n });
      }
    },
  },
  {
    id: "TOOLS_OF_THE_TRADE",
    name: "Tools of the Trade",
    color: "green",
    type: "power",
    rarity: "rare",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "TOOLS_OF_THE_TRADE", n: 1, target: "self" }],
  },
  {
    id: "UNLOAD",
    name: "Unload",
    color: "green",
    type: "attack",
    rarity: "rare",
    cost: 1,
    target: "enemy",
    values: { damage: 14 },
    upgradeValues: { damage: 18 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      // the non-Attack sweep evaluates the LIVE hand after the damage resolves
      ctx.queue.addToBottom({ kind: "effect", ref: "silent/unloadDiscard" });
    },
  },
  {
    id: "WRAITH_FORM",
    name: "Wraith Form",
    color: "green",
    type: "power",
    rarity: "rare",
    cost: 3,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    primitives: [
      { do: "applyPower", power: "INTANGIBLE", n: "magic", target: "self" },
      { do: "applyPower", power: "WRAITH_FORM_POWER", n: 1, target: "self" },
    ],
  },
];
