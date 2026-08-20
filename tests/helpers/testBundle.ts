// Minimal stub ContentBundle for engine tests. Content here is deliberately
// fake (T_-prefixed) — real content lands in src/content, audited against the
// corpus. This bundle exercises: primitives, powers with f32 damage/block
// modifiers, monster AI rolls with history rules, block, and victory/defeat.

import type { CardDef, ContentBundle, MonsterDef, PowerDef, StanceDef, CharacterDef } from "../../src/engine/content/defs";
import { f32mul, f32add } from "../../src/engine/core/math";
import { calcMonsterDamage } from "../../src/engine/combat/damageCalc";
import { PLAYER, monster } from "../../src/engine/core/ids";

const cards: CardDef[] = [
  {
    id: "T_STRIKE",
    name: "T Strike",
    color: "red",
    type: "attack",
    rarity: "basic",
    cost: 1,
    target: "enemy",
    values: { damage: 6 },
    upgradeValues: { damage: 9 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "T_DEFEND",
    name: "T Defend",
    color: "red",
    type: "skill",
    rarity: "basic",
    cost: 1,
    target: "self",
    values: { block: 5 },
    upgradeValues: { block: 8 },
    keywords: [],
    primitives: [{ do: "block", n: "block" }],
  },
  {
    id: "T_BASH",
    name: "T Bash",
    color: "red",
    type: "attack",
    rarity: "basic",
    cost: 2,
    target: "enemy",
    values: { damage: 8, magic: 2 },
    upgradeValues: { damage: 10, magic: 3 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "VULNERABLE", n: "magic", target: "target" },
    ],
  },
  {
    id: "T_FLEX",
    name: "T Flex",
    color: "red",
    type: "skill",
    rarity: "basic",
    cost: 0,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "STRENGTH", n: "magic", target: "self" }],
  },
  {
    id: "T_EXHAUST_DRAW",
    name: "T Exhaust Draw",
    color: "red",
    type: "skill",
    rarity: "basic",
    cost: 1,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: ["exhaust"],
    primitives: [{ do: "draw", n: "magic" }],
  },
];

const powers: PowerDef[] = [
  {
    id: "STRENGTH",
    name: "Strength",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    canGoNegative: true,
    hooks: {
      atDamageGive: (ctx, d, _type, _card) => f32add(d, ctx.power!.amount),
    },
  },
  {
    id: "DEXTERITY",
    name: "Dexterity",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    canGoNegative: true,
    hooks: {
      modifyBlock: (ctx, b) => f32add(b, ctx.power!.amount),
    },
  },
  {
    id: "VULNERABLE",
    name: "Vulnerable",
    kind: "debuff",
    stacking: "duration",
    turnBased: true,
    hooks: {
      atDamageReceive: (_ctx, d) => f32mul(d, 1.5),
    },
  },
  {
    id: "WEAK",
    name: "Weak",
    kind: "debuff",
    stacking: "duration",
    turnBased: true,
    hooks: {
      atDamageGive: (_ctx, d) => f32mul(d, 0.75),
    },
  },
  {
    id: "FRAIL",
    name: "Frail",
    kind: "debuff",
    stacking: "duration",
    turnBased: true,
    hooks: {
      modifyBlock: (_ctx, b) => f32mul(b, 0.75),
    },
  },
  {
    id: "ARTIFACT",
    name: "Artifact",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {},
  },
  {
    id: "BARRICADE",
    name: "Barricade",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      modifyBlockRetention: (ctx, _b) => ctx.combat!.player.block,
    },
  },
];

const dummy: MonsterDef = {
  id: "T_DUMMY",
  name: "Test Dummy",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [24, 28] : [20, 25]),
  moves: {
    ATTACK: {
      id: "ATTACK",
      intent: "attack",
      execute: (ctx, self) => {
        const dmg = calcMonsterDamage(ctx, self.idx, 10);
        ctx.queue.addToBottom({
          kind: "damage",
          target: PLAYER,
          info: { type: "attack", source: monster(self.idx), amount: dmg },
        });
      },
    },
    HARDEN: {
      id: "HARDEN",
      intent: "defend",
      execute: (ctx, self) => {
        ctx.queue.addToBottom({ kind: "gainBlock", target: monster(self.idx), amount: 5, fromCard: false });
      },
    },
  },
  getMove: (_ctx, self, roll) => {
    const hist = self.moveHistory;
    const last = hist[hist.length - 1];
    const last2 = hist[hist.length - 2];
    if (roll < 60) {
      if (last === "ATTACK" && last2 === "ATTACK") return "HARDEN"; // never 3x
      return "ATTACK";
    }
    if (last === "HARDEN") return "ATTACK"; // never 2x
    return "HARDEN";
  },
};

const characters: CharacterDef[] = [
  {
    id: "IRONCLAD",
    name: "Test Ironclad",
    maxHp: 80,
    startingEnergy: 3,
    startingDeck: [],
    startingRelic: "T_NONE",
    orbSlots: 0,
    a14HpLoss: 5,
  },
];

const stances: StanceDef[] = [{ id: "NEUTRAL", name: "Neutral" }];

export function makeTestBundle(): ContentBundle {
  return {
    id: "test",
    version: "0",
    cards: new Map(cards.map((c) => [c.id, c])),
    powers: new Map(powers.map((p) => [p.id, p])),
    relics: new Map(),
    potions: new Map(),
    monsters: new Map([[dummy.id, dummy]]),
    events: new Map(),
    orbs: new Map(),
    stances: new Map(stances.map((s) => [s.id, s])),
    characters: new Map(characters.map((c) => [c.id, c])),
    acts: [],
    effects: new Map(),
  };
}
