// Defect basics. Values audited vs data/corpus/cards.json (color "blue").

import type { CardDef } from "../../../engine/content/defs";

export const defectBasics: CardDef[] = [
  {
    id: "STRIKE_BLUE",
    name: "Strike",
    color: "blue",
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
    id: "DEFEND_BLUE",
    name: "Defend",
    color: "blue",
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
    // "Channel 1 Lightning."
    id: "ZAP",
    name: "Zap",
    color: "blue",
    type: "skill",
    rarity: "basic",
    cost: 1,
    target: "self",
    values: { magic: 1, hits: 1 },
    upgradeValues: { cost: 0 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "LIGHTNING", n: 1 } });
    },
  },
  {
    // "Evoke your next Orb twice."
    id: "DUALCAST",
    name: "Dualcast",
    color: "blue",
    type: "skill",
    rarity: "basic",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/evoke", args: { times: 2 } });
    },
  },
];
