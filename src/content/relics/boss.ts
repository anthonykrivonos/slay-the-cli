// Boss relics - values audited vs data/corpus/relics.json.
//
// ENGINE-GAP(energy): "Gain 1 Energy at the start of your turn" on boss relics
// means +1 energyPerTurn. PlayerCombatState.energyPerTurn is set from the
// character at combat build and there is no hook to modify it - the engine
// owner wires energyPerTurn from relics (per workstream agreement). Affected:
// ECTOPLASM, SOZU, CURSED_KEY, BUSTED_CROWN, COFFEE_DRIPPER, FUSION_HAMMER,
// RUNIC_DOME, VELVET_CHOKER, PHILOSOPHERS_STONE, MARK_OF_PAIN and the
// conditional SLAVERS_COLLAR. Their non-energy sides are implemented below
// where expressible.

import type { RelicDef } from "../../engine/content/defs";
import { f32add } from "../../engine/core/math";
import { PLAYER, monster } from "../../engine/core/ids";
import { cnt, healPlayer } from "./lib";

export const bossRelics: RelicDef[] = [
  {
    // "Replaces Burning Blood. At the end of combat, heal 12 HP."
    // (Starter replacement on pickup is RUN-LAYER.)
    id: "BLACK_BLOOD",
    name: "Black Blood",
    tier: "boss",
    pool: "red",
    hooks: { onVictory: (ctx) => healPlayer(ctx, 12) },
  },
  {
    // "Gain 1 Energy... Future card rewards have 2 less cards." ENGINE-GAP(energy) + RUN-LAYER(rewards).
    id: "BUSTED_CROWN",
    energyBonus: 1,
    name: "Busted Crown",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Gain 1 Energy... You can no longer Rest at Rest Sites." ENGINE-GAP(energy) + RUN-LAYER(rest).
    id: "COFFEE_DRIPPER",
    energyBonus: 1,
    name: "Coffee Dripper",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Gain 1 Energy... Whenever you open a non-Boss chest, obtain a Curse."
    // ENGINE-GAP(energy); the curse obtain needs the run layer's curse pool + relicRng.
    id: "CURSED_KEY",
    energyBonus: 1,
    name: "Cursed Key",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Gain 1 Energy... You can no longer gain Gold." ENGINE-GAP(energy); gold zeroing implemented.
    id: "ECTOPLASM",
    energyBonus: 1,
    name: "Ectoplasm",
    tier: "boss",
    pool: "shared",
    hooks: { onGainGold: () => 0 },
  },
  {
    // "Replaces Cracked Core. If you end your turn with any empty Orb slots, Channel 1 Frost."
    // DEPENDS: FROST orb def.
    id: "FROZEN_CORE",
    name: "Frozen Core",
    tier: "boss",
    pool: "blue",
    hooks: {
      atEndOfTurnPreEndOfTurnCards: (ctx) => {
        const p = ctx.combat!.player;
        if (p.orbs.length < p.orbSlots) ctx.queue.addToBottom({ kind: "channelOrb", orbId: "FROST" });
      },
    },
  },
  {
    // "Gain 1 Energy... You can no longer Smith." ENGINE-GAP(energy) + RUN-LAYER(rest).
    id: "FUSION_HAMMER",
    energyBonus: 1,
    name: "Fusion Hammer",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Replaces Pure Water. At the start of each combat, add 3 Miracles into your hand."
    // DEPENDS: MIRACLE card def.
    id: "HOLY_WATER",
    name: "Holy Water",
    tier: "boss",
    pool: "purple",
    hooks: {
      atBattleStart: (ctx) => {
        if (ctx.bundle.cards.has("MIRACLE")) {
          ctx.queue.addToBottom({ kind: "makeTempCard", defId: "MIRACLE", upgrades: 0, dest: "hand", n: 3 });
        }
      },
    },
  },
  {
    // "The first time you discard a card each turn, gain 1 Energy."
    id: "HOVERING_KITE",
    name: "Hovering Kite",
    tier: "boss",
    pool: "green",
    hooks: {
      atStartOfTurn: (ctx) => cnt(ctx).set(0),
      onManualDiscard: (ctx) => {
        if (cnt(ctx).get() === 0) {
          cnt(ctx).set(1);
          ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
        }
      },
    },
  },
  {
    // "Every 2 turns, gain 1 Orb slot." (persistent counter)
    id: "INSERTER",
    name: "Inserter",
    tier: "boss",
    pool: "blue",
    hooks: {
      atStartOfTurn: (ctx) => {
        const c = cnt(ctx).get() + 1;
        if (c === 2) {
          cnt(ctx).set(0);
          ctx.queue.addToBottom({ kind: "changeOrbSlots", delta: 1 });
        } else {
          cnt(ctx).set(c);
        }
      },
    },
  },
  {
    // "Gain 1 Energy... At the start of combat, shuffle 2 Wounds into your draw pile."
    // ENGINE-GAP(energy); DEPENDS: WOUND card def.
    id: "MARK_OF_PAIN",
    energyBonus: 1,
    name: "Mark of Pain",
    tier: "boss",
    pool: "red",
    hooks: {
      atBattleStartPreDraw: (ctx) => {
        if (ctx.bundle.cards.has("WOUND")) {
          ctx.queue.addToBottom({ kind: "makeTempCard", defId: "WOUND", upgrades: 0, dest: "draw", n: 2 });
        }
      },
    },
  },
  {
    // "At the start of each combat, Channel 1 Plasma." DEPENDS: PLASMA orb def.
    id: "NUCLEAR_BATTERY",
    name: "Nuclear Battery",
    tier: "boss",
    pool: "blue",
    hooks: { atBattleStart: (ctx) => ctx.queue.addToBottom({ kind: "channelOrb", orbId: "PLASMA" }) },
  },
  {
    // "Gain 1 Energy... ALL enemies start combat with 1 Strength."
    // ENGINE-GAP(energy); the Strength side is implemented.
    id: "PHILOSOPHERS_STONE",
    energyBonus: 1,
    name: "Philosopher's Stone",
    tier: "boss",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => {
        for (const m of ctx.combat!.monsters) {
          if (!m.isDead && !m.isEscaped) {
            ctx.queue.addToBottom({
              kind: "applyPower",
              source: monster(m.idx),
              target: monster(m.idx),
              powerId: "STRENGTH",
              amount: 1,
            });
          }
        }
      },
    },
  },
  {
    // "Replaces Ring of the Snake. At the start of your turn, draw 1 additional card."
    id: "RING_OF_THE_SERPENT",
    name: "Ring of the Serpent",
    tier: "boss",
    pool: "green",
    hooks: { modifyDrawPerTurn: (_ctx, n) => n + 1 },
  },
  {
    // "Gain 1 Energy... You can no longer see enemy intents."
    // ENGINE-GAP(energy); intent hiding is UI-side (no gameplay hook).
    id: "RUNIC_DOME",
    energyBonus: 1,
    name: "Runic Dome",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Whenever you lose HP, draw 1 card."
    id: "RUNIC_CUBE",
    name: "Runic Cube",
    tier: "boss",
    pool: "red",
    hooks: {
      wasHPLost: (ctx, _info, amount) => {
        if (amount > 0) ctx.queue.addToBottom({ kind: "draw", n: 1 });
      },
    },
  },
  {
    // "At the end of your turn, you no longer discard your hand."
    id: "RUNIC_PYRAMID",
    name: "Runic Pyramid",
    tier: "boss",
    pool: "shared",
    hooks: { retainsHand: () => true },
  },
  {
    // "Double the effectiveness of potions." Marker: consumed by the potion
    // potency computation (effectivePotency in src/content/potions/index.ts).
    id: "SACRED_BARK",
    name: "Sacred Bark",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "During Boss and Elite combats, gain 1 Energy at the start of your turn."
    // ENGINE-GAP(energy): conditional energyPerTurn, wired engine-side.
    id: "SLAVERS_COLLAR",
    energyBonus: 1,
    energyBonusEliteBossOnly: true,
    name: "Slaver's Collar",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "At the start of your turn, draw 2 additional cards. Start each combat Confused."
    id: "SNECKO_EYE",
    name: "Snecko Eye",
    tier: "boss",
    pool: "shared",
    hooks: {
      modifyDrawPerTurn: (_ctx, n) => n + 2,
      atBattleStart: (ctx) =>
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "CONFUSED", amount: 1 }),
    },
  },
  {
    // "Gain 1 Energy... You can no longer obtain potions." ENGINE-GAP(energy) + RUN-LAYER(potion rewards).
    id: "SOZU",
    energyBonus: 1,
    name: "Sozu",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Gain 1 Energy... You cannot play more than 6 cards per turn."
    // ENGINE-GAP(energy); the play cap is implemented.
    id: "VELVET_CHOKER",
    energyBonus: 1,
    name: "Velvet Choker",
    tier: "boss",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => cnt(ctx).set(0),
      canPlayCard: (ctx) => cnt(ctx).get() < 6,
      onUseCard: (ctx) => cnt(ctx).set(cnt(ctx).get() + 1),
    },
  },
  {
    // "Whenever you exit Calm, gain an additional Energy."
    id: "VIOLET_LOTUS",
    name: "Violet Lotus",
    tier: "boss",
    pool: "purple",
    hooks: {
      onChangeStance: (ctx, from) => {
        if (from === "CALM") ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
      },
    },
  },
  {
    // "Attacks that cost 0 deal 4 additional damage."
    id: "WRIST_BLADE",
    name: "Wrist Blade",
    tier: "boss",
    pool: "green",
    hooks: {
      atDamageGive: (ctx, d, _type, card) => {
        if (card && card.costForTurn === 0 && ctx.bundle.cards.get(card.defId)?.type === "attack") {
          return f32add(d, 4);
        }
        return d;
      },
    },
  },
  {
    // "Upon pickup, Transform 3 cards, then Upgrade them." RUN-LAYER (transform flow).
    id: "ASTROLABE",
    name: "Astrolabe",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Elites now drop an additional relic when defeated." RUN-LAYER (rewards).
    id: "BLACK_STAR",
    name: "Black Star",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Upon pickup, obtain a unique Curse and 3 relics." RUN-LAYER.
    id: "CALLING_BELL",
    name: "Calling Bell",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Upon pickup, remove 2 cards from your deck." RUN-LAYER (removal choice).
    id: "EMPTY_CAGE",
    name: "Empty Cage",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Upon pickup, Transform all Strike and Defend cards." RUN-LAYER.
    id: "PANDORAS_BOX",
    name: "Pandora's Box",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
  {
    // "Upon pickup, obtain 1 Potion, 50 Gold, +5 Max HP, 1 card, upgrade 1 random card." RUN-LAYER.
    id: "TINY_HOUSE",
    name: "Tiny House",
    tier: "boss",
    pool: "shared",
    hooks: {},
  },
];
