// Curse cards. Values audited against data/corpus/cards.json.
// ENGINE-NOTE: CardDef.rarity has no "curse" member, so corpus rarity "curse"
// is mapped to "special" (the type field already identifies curses).

import type { CardDef } from "../../engine/content/defs";
import { PLAYER } from "../../engine/core/ids";

export const curseCards: CardDef[] = [
  {
    id: "ASCENDERS_BANE",
    name: "Ascender's Bane",
    color: "curse",
    type: "curse",
    rarity: "special",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["ethereal"],
    // ENGINE-GAP: "Cannot be removed from your deck" is a run-layer rule; card
    // defs have no unremovable flag yet, so removal screens must special-case it.
  },
  {
    id: "CLUMSY",
    name: "Clumsy",
    color: "curse",
    type: "curse",
    rarity: "curse",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["ethereal"],
  },
  {
    id: "CURSE_OF_THE_BELL",
    name: "Curse of the Bell",
    color: "curse",
    type: "curse",
    rarity: "special",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    // ENGINE-GAP: unremovable from the deck — run-layer rule, see Ascender's Bane.
  },
  {
    id: "DECAY",
    name: "Decay",
    color: "curse",
    type: "curse",
    rarity: "curse",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    onEndOfTurnInHand: (ctx) => {
      // 2 THORNS-type damage to the player, like Burn
      ctx.queue.addToBottom({ kind: "damage", target: PLAYER, info: { type: "thorns", source: null, amount: 2 } });
    },
  },
  {
    id: "DOUBT",
    name: "Doubt",
    color: "curse",
    type: "curse",
    rarity: "curse",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    onEndOfTurnInHand: (ctx) => {
      // Weak 1, applied "as if by a monster" so it survives the coming round tick
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/endTurnDebuff", args: { powerId: "WEAK", amount: 1 } });
    },
  },
  {
    id: "INJURY",
    name: "Injury",
    color: "curse",
    type: "curse",
    rarity: "curse",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
  },
  {
    id: "NECRONOMICURSE",
    name: "Necronomicurse",
    color: "curse",
    type: "curse",
    rarity: "special",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    onExhaustThis: (ctx) => {
      // "There is no escape": exhausting it puts a fresh copy in your hand
      ctx.queue.addToBottom({ kind: "makeTempCard", defId: "NECRONOMICURSE", upgrades: 0, dest: "hand", n: 1 });
    },
  },
  {
    id: "NORMALITY",
    name: "Normality",
    color: "curse",
    type: "curse",
    rarity: "curse",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    // in-hand veto lives in the NORMALITY helper power (see powers/ironclad.ts);
    // applied on draw, it live-checks the hand + turnFlags.cardsPlayedThisTurn
    onDrawThis: (ctx) => {
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "NORMALITY", amount: 1 });
    },
  },
  {
    id: "PAIN",
    name: "Pain",
    color: "curse",
    type: "curse",
    rarity: "curse",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    // "While in hand, lose 1 HP when other cards are played" — via the PAIN
    // helper power (see powers/ironclad.ts), applied on draw
    onDrawThis: (ctx) => {
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "PAIN", amount: 1 });
    },
  },
  {
    id: "PARASITE",
    name: "Parasite",
    color: "curse",
    type: "curse",
    rarity: "curse",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    // ENGINE-GAP: "If transformed or removed from your deck, lose 3 Max HP" is a
    // run-layer trigger; card defs have no remove/transform hook yet.
  },
  {
    id: "PRIDE",
    name: "Pride",
    color: "curse",
    type: "curse",
    rarity: "special",
    cost: 1, // the only playable curse
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust", "innate"],
    // playing it does nothing (it just Exhausts); at end of turn while in hand,
    // put a copy on TOP of the draw pile
    onEndOfTurnInHand: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/prideCopy", args: { upgrades: ctx.card.upgrades } });
    },
  },
  {
    id: "REGRET",
    name: "Regret",
    color: "curse",
    type: "curse",
    rarity: "curse",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    onEndOfTurnInHand: (ctx) => {
      // lose HP equal to hand size; the interpreter passes it via energyOnUse
      ctx.queue.addToBottom({ kind: "loseHp", target: PLAYER, amount: ctx.energyOnUse });
    },
  },
  {
    id: "SHAME",
    name: "Shame",
    color: "curse",
    type: "curse",
    rarity: "curse",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    onEndOfTurnInHand: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/endTurnDebuff", args: { powerId: "FRAIL", amount: 1 } });
    },
  },
  {
    id: "WRITHE",
    name: "Writhe",
    color: "curse",
    type: "curse",
    rarity: "curse",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["innate"],
  },
];
