// Watcher basics. Values audited vs data/corpus/cards.json (color "purple").

import type { CardDef } from "../../../engine/content/defs";

export const watcherBasics: CardDef[] = [
  {
    id: "STRIKE_PURPLE",
    name: "Strike",
    color: "purple",
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
    id: "DEFEND_PURPLE",
    name: "Defend",
    color: "purple",
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
    // "Deal 9 damage. Enter Wrath." — damage resolves BEFORE the stance change
    // (no self-double), matching the game's action order.
    id: "ERUPTION",
    name: "Eruption",
    color: "purple",
    type: "attack",
    rarity: "basic",
    cost: 2,
    target: "enemy",
    values: { damage: 9 },
    upgradeValues: { cost: 1 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "changeStance", stance: "WRATH" },
    ],
  },
  {
    id: "VIGILANCE",
    name: "Vigilance",
    color: "purple",
    type: "skill",
    rarity: "basic",
    cost: 2,
    target: "self",
    values: { block: 8 },
    upgradeValues: { block: 12 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "changeStance", stance: "CALM" },
    ],
  },
];
