// Silent common cards. Values audited against data/corpus/cards.json — corpus
// numbers only.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage, calcBlock } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { getPowerAmount } from "../../../engine/combat/powerRuntime";

export const silentCommons: CardDef[] = [
  {
    id: "ACROBATICS",
    name: "Acrobatics",
    color: "green",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "none",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    primitives: [{ do: "draw", n: "magic" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "silent/discardChoose",
        args: { n: 1, reason: "Acrobatics: discard a card" },
      });
    },
  },
  {
    id: "BACKFLIP",
    name: "Backflip",
    color: "green",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 5 },
    upgradeValues: { block: 8 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "draw", n: 2 },
    ],
  },
  {
    id: "BANE",
    name: "Bane",
    color: "green",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 7 },
    upgradeValues: { damage: 10 },
    keywords: [],
    onPlay: (ctx) => {
      // "If the enemy has Poison, deal damage again." Condition checked at use
      // time; both hits share one calc (BaneAction parity).
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 10 : 7);
      const hits = getPowerAmount(ctx, monster(target), "POISON") > 0 ? 2 : 1;
      for (let i = 0; i < hits; i++) {
        ctx.queue.addToBottom({
          kind: "damage",
          target: monster(target),
          info: { type: "attack", source: PLAYER, amount: dmg },
        });
      }
    },
  },
  {
    id: "BLADE_DANCE",
    name: "Blade Dance",
    color: "green",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "none",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    primitives: [{ do: "makeCard", card: "SHIV", dest: "hand", n: "magic" }],
  },
  {
    id: "CLOAK_AND_DAGGER",
    name: "Cloak and Dagger",
    color: "green",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 6, magic: 1 },
    upgradeValues: { block: 6, magic: 2 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "makeCard", card: "SHIV", dest: "hand", n: "magic" },
    ],
  },
  {
    id: "DAGGER_SPRAY",
    name: "Dagger Spray",
    color: "green",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "allenemy",
    values: { damage: 4 },
    upgradeValues: { damage: 6 },
    keywords: [],
    // "Deal 4 (6) damage to ALL enemies twice."
    primitives: [{ do: "damageAll", n: "damage", hits: 2 }],
  },
  {
    id: "DAGGER_THROW",
    name: "Dagger Throw",
    color: "green",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 9 },
    upgradeValues: { damage: 12 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "draw", n: 1 },
    ],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "silent/discardChoose",
        args: { n: 1, reason: "Dagger Throw: discard a card" },
      });
    },
  },
  {
    id: "DEADLY_POISON",
    name: "Deadly Poison",
    color: "green",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { magic: 5 },
    upgradeValues: { magic: 7 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "POISON", n: "magic", target: "target" }],
  },
  {
    id: "DEFLECT",
    name: "Deflect",
    color: "green",
    type: "skill",
    rarity: "common",
    cost: 0,
    target: "self",
    values: { block: 4 },
    upgradeValues: { block: 7 },
    keywords: [],
    primitives: [{ do: "block", n: "block" }],
  },
  {
    id: "DODGE_AND_ROLL",
    name: "Dodge and Roll",
    color: "green",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 4 },
    upgradeValues: { block: 6 },
    keywords: [],
    primitives: [{ do: "block", n: "block" }],
    onPlay: (ctx) => {
      // next-turn block is the Dex/Frail-modified value computed at play time
      // (the game applies powers to this.block before NextTurnBlockPower)
      const amount = calcBlock(ctx, ctx.upgraded ? 6 : 4, ctx.card, true);
      ctx.queue.addToBottom({
        kind: "applyPower",
        source: PLAYER,
        target: PLAYER,
        powerId: "NEXT_TURN_BLOCK",
        amount,
      });
    },
  },
  {
    id: "FLYING_KNEE",
    name: "Flying Knee",
    color: "green",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 8 },
    upgradeValues: { damage: 11 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "ENERGIZED", n: 1, target: "self" },
    ],
  },
  {
    id: "OUTMANEUVER",
    name: "Outmaneuver",
    color: "green",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "applyPower",
        source: PLAYER,
        target: PLAYER,
        powerId: "ENERGIZED",
        amount: ctx.upgraded ? 3 : 2,
      });
    },
  },
  {
    id: "PIERCING_WAIL",
    name: "Piercing Wail",
    color: "green",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "allenemy",
    values: { magic: 6 },
    upgradeValues: { magic: 8 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // "ALL enemies lose 6 (8) Strength this turn": -Str now, restored by
      // GENERIC_STRENGTH_UP at the end of the monster's own turn. The -Str is
      // Artifact-negated while the restore is a buff and is not — an Artifact
      // enemy nets +Str at end of turn (real-game parity).
      const n = ctx.upgraded ? 8 : 6;
      for (const m of ctx.combat!.monsters) {
        if (m.isDead || m.isEscaped) continue;
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: PLAYER,
          target: monster(m.idx),
          powerId: "STRENGTH",
          amount: -n,
        });
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: PLAYER,
          target: monster(m.idx),
          powerId: "GENERIC_STRENGTH_UP",
          amount: n,
        });
      }
    },
  },
  {
    id: "POISONED_STAB",
    name: "Poisoned Stab",
    color: "green",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 6, magic: 3 },
    upgradeValues: { damage: 8, magic: 4 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "POISON", n: "magic", target: "target" },
    ],
  },
  {
    id: "PREPARED",
    name: "Prepared",
    color: "green",
    type: "skill",
    rarity: "common",
    cost: 0,
    target: "none",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "draw", n: "magic" }],
    onPlay: (ctx) => {
      const n = ctx.upgraded ? 2 : 1;
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "silent/discardChoose",
        args: { n, reason: `Prepared: discard ${n}` },
      });
    },
  },
  {
    id: "QUICK_SLASH",
    name: "Quick Slash",
    color: "green",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 8 },
    upgradeValues: { damage: 12 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "draw", n: 1 },
    ],
  },
  {
    id: "SLICE",
    name: "Slice",
    color: "green",
    type: "attack",
    rarity: "common",
    cost: 0,
    target: "enemy",
    values: { damage: 6 },
    upgradeValues: { damage: 9 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "SNEAKY_STRIKE",
    name: "Sneaky Strike",
    color: "green",
    type: "attack",
    rarity: "common",
    cost: 2,
    target: "enemy",
    values: { damage: 12 },
    upgradeValues: { damage: 16 },
    keywords: ["strike", "tag:strike"],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      // "If you have discarded a card this turn, gain 2 energy." Manual
      // discards only (end-of-turn discards don't count) — checked at use time.
      if (ctx.combat!.turnFlags.manualDiscardsThisTurn > 0) {
        ctx.queue.addToBottom({ kind: "gainEnergy", n: 2 });
      }
    },
  },
  {
    id: "SUCKER_PUNCH",
    name: "Sucker Punch",
    color: "green",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 7, magic: 1 },
    upgradeValues: { damage: 9, magic: 2 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "WEAK", n: "magic", target: "target" },
    ],
  },
];
