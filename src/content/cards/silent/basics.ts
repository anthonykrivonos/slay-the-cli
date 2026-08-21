// Silent basic cards. Values audited against data/corpus/cards.json - corpus
// numbers only.

import type { CardDef } from "../../../engine/content/defs";

export const silentBasics: CardDef[] = [
  {
    id: "STRIKE_GREEN",
    name: "Strike",
    color: "green",
    type: "attack",
    rarity: "basic",
    cost: 1,
    target: "enemy",
    values: { damage: 6 },
    upgradeValues: { damage: 9 },
    keywords: ["strike", "tag:starter_strike", "tag:strike"],
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "DEFEND_GREEN",
    name: "Defend",
    color: "green",
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
    id: "SURVIVOR",
    name: "Survivor",
    color: "green",
    type: "skill",
    rarity: "basic",
    cost: 1,
    target: "self",
    values: { block: 8 },
    upgradeValues: { block: 11 },
    keywords: [],
    primitives: [{ do: "block", n: "block" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "silent/discardChoose",
        args: { n: 1, reason: "Survivor: discard a card" },
      });
    },
  },
  {
    id: "NEUTRALIZE",
    name: "Neutralize",
    color: "green",
    type: "attack",
    rarity: "basic",
    cost: 0,
    target: "enemy",
    values: { damage: 3, magic: 1 },
    upgradeValues: { damage: 4, magic: 2 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "WEAK", n: "magic", target: "target" },
    ],
  },
];
