// Status cards (colorless per the corpus). Values audited against
// data/corpus/cards.json.

import type { CardDef } from "../../engine/content/defs";
import { PLAYER } from "../../engine/core/ids";

export const statusCards: CardDef[] = [
  {
    id: "BURN",
    name: "Burn",
    color: "colorless",
    type: "status",
    rarity: "common",
    cost: -2, // unplayable
    target: "none",
    values: { magic: 2 },
    upgradeValues: { magic: 4 },
    keywords: [],
    onEndOfTurnInHand: (ctx) => {
      // the game deals this as THORNS-type damage to the player (source-less),
      // so it is absorbed by Block and triggers Rupture
      ctx.queue.addToBottom({
        kind: "damage",
        target: PLAYER,
        info: { type: "thorns", source: null, amount: ctx.upgraded ? 4 : 2 },
      });
    },
  },
  {
    id: "DAZED",
    name: "Dazed",
    color: "colorless",
    type: "status",
    rarity: "common",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["ethereal"],
  },
  {
    id: "SLIMED",
    name: "Slimed",
    color: "colorless",
    type: "status",
    rarity: "common",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"], // playable; does nothing but Exhaust
  },
  {
    id: "VOID",
    name: "Void",
    color: "colorless",
    type: "status",
    rarity: "common",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["ethereal"],
    onDrawThis: (ctx) => {
      ctx.queue.addToTop({ kind: "loseEnergy", n: 1 });
    },
  },
  {
    id: "WOUND",
    name: "Wound",
    color: "colorless",
    type: "status",
    rarity: "common",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
  },
];
