// Shop relics - values audited vs data/corpus/relics.json.

import type { RelicDef } from "../../engine/content/defs";
import { PLAYER, monster } from "../../engine/core/ids";
import { cnt, colorlessPoolFilter, healPlayer, randomCardDefs, requestCardPick } from "./lib";

export const shopRelics: RelicDef[] = [
  {
    // "At the start of your turn, gain 2 Strength and ALL enemies gain 1 Strength."
    id: "BRIMSTONE",
    name: "Brimstone",
    tier: "shop",
    pool: "red",
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: 2 });
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
    // "The effects of your cost X cards are increased by 2."
    // ENGINE-GAP: X-cost cards read energyOnUse in their own defs; no hook can
    // add +2 to the captured X (needs an energyOnUse fold or card-def support).
    id: "CHEMICAL_X",
    name: "Chemical X",
    tier: "shop",
    pool: "shared",
    hooks: {},
  },
  {
    // "Start each combat with 1 Artifact."
    id: "CLOCKWORK_SOUVENIR",
    name: "Clockwork Souvenir",
    tier: "shop",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) =>
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "ARTIFACT", amount: 1 }),
    },
  },
  {
    // "When viewing your Draw Pile, the cards are now shown in order." UI-only marker.
    id: "FROZEN_EYE",
    name: "Frozen Eye",
    tier: "shop",
    pool: "shared",
    hooks: {},
  },
  {
    // "Whenever you break an enemy's Block, apply 2 Vulnerable."
    // ENGINE-GAP: no block-broken hook in the damage pipeline.
    id: "HAND_DRILL",
    name: "Hand Drill",
    tier: "shop",
    pool: "shared",
    hooks: {},
  },
  {
    // "Unplayable Status cards can now be played..." ENGINE-GAP: same
    // playability override gap as Blue Candle.
    id: "MEDICAL_KIT",
    name: "Medical Kit",
    tier: "shop",
    pool: "shared",
    hooks: {},
  },
  {
    // "50% discount on all products!"
    id: "MEMBERSHIP_CARD",
    name: "Membership Card",
    tier: "shop",
    pool: "shared",
    hooks: { modifyPrice: (_ctx, price) => price * 0.5 },
  },
  {
    // "Whenever you shuffle your draw pile, Scry 3."
    id: "MELANGE",
    name: "Melange",
    tier: "shop",
    pool: "purple",
    hooks: { onShuffle: (ctx) => ctx.queue.addToBottom({ kind: "scry", n: 3 }) },
  },
  {
    // "Whenever you play a Power, Attack, and Skill in the same turn, remove all
    // of your debuffs." counter bitmask: 1 attack | 2 skill | 4 power | 8 fired.
    id: "ORANGE_PELLETS",
    name: "Orange Pellets",
    tier: "shop",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => cnt(ctx).set(0),
      onUseCard: (ctx, card) => {
        const type = ctx.bundle.cards.get(card.defId)?.type;
        const bit = type === "attack" ? 1 : type === "skill" ? 2 : type === "power" ? 4 : 0;
        if (bit === 0) return;
        const c = cnt(ctx).get() | bit;
        cnt(ctx).set(c);
        if ((c & 7) === 7 && (c & 8) === 0) {
          cnt(ctx).set(c | 8);
          for (const p of ctx.combat!.player.powers) {
            if (ctx.bundle.powers.get(p.id)?.kind === "debuff") {
              ctx.queue.addToBottom({ kind: "removePower", target: PLAYER, powerId: p.id });
            }
          }
        }
      },
    },
  },
  {
    // "Start each combat with 3 additional Orb slots."
    id: "RUNIC_CAPACITOR",
    name: "Runic Capacitor",
    tier: "shop",
    pool: "blue",
    hooks: { atBattleStart: (ctx) => ctx.queue.addToBottom({ kind: "changeOrbSlots", delta: 3 }) },
  },
  {
    // "Start each Elite combat with 2 Strength."
    id: "SLING_OF_COURAGE",
    name: "Sling of Courage",
    tier: "shop",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => {
        if (ctx.combat!.monsters.some((m) => ctx.bundle.monsters.get(m.id)?.category === "elite")) {
          ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: 2 });
        }
      },
    },
  },
  {
    // "Cards which Exhaust when played will instead discard 50% of the time."
    // ENGINE-GAP: no exhaust-redirect hook in the exhaust flow.
    id: "STRANGE_SPOON",
    name: "Strange Spoon",
    tier: "shop",
    pool: "shared",
    hooks: {},
  },
  {
    // "Whenever you shuffle your draw pile, gain 6 Block."
    id: "THE_ABACUS",
    name: "The Abacus",
    tier: "shop",
    pool: "shared",
    hooks: {
      onShuffle: (ctx) => ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: 6, fromCard: false }),
    },
  },
  {
    // "At the start of each combat, choose 1 of 3 random Colorless cards and add
    // the chosen card into your hand." DEPENDS: colorless card pool.
    id: "TOOLBOX",
    name: "Toolbox",
    tier: "shop",
    pool: "shared",
    hooks: {
      atStartOfTurnPostDraw: (ctx) => {
        if (ctx.combat!.turn !== 1) return;
        const picks = randomCardDefs(ctx, 3, colorlessPoolFilter());
        requestCardPick(ctx, {
          defIds: picks.map((d) => d.id),
          copies: 1,
          costZero: false,
          reason: "Toolbox",
          dest: "hand",
        });
      },
    },
  },
  {
    // "At the start of each combat, apply 4 Poison to ALL enemies." DEPENDS: POISON power.
    id: "TWISTED_FUNNEL",
    name: "Twisted Funnel",
    tier: "shop",
    pool: "green",
    hooks: {
      atBattleStart: (ctx) => {
        if (!ctx.bundle.powers.has("POISON")) return;
        for (const m of ctx.combat!.monsters) {
          if (!m.isDead && !m.isEscaped) {
            ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: monster(m.idx), powerId: "POISON", amount: 4 });
          }
        }
      },
    },
  },
  {
    // "When obtained, brews 5 random potions." RUN-LAYER (potion generation).
    id: "CAULDRON",
    name: "Cauldron",
    tier: "shop",
    pool: "shared",
    hooks: {},
  },
  {
    // "Upon pickup, obtain an additional copy of a card in your deck." RUN-LAYER.
    id: "DOLLYS_MIRROR",
    name: "Dolly's Mirror",
    tier: "shop",
    pool: "shared",
    hooks: {},
  },
  {
    // "Upon pickup, raise your Max HP by 7 and heal all of your HP." RUN-LAYER: onEquip not fired yet.
    id: "LEES_WAFFLE",
    name: "Lee's Waffle",
    tier: "shop",
    pool: "shared",
    onEquip: (ctx) => {
      ctx.run.maxHp += 7;
      healPlayer(ctx, ctx.run.maxHp);
    },
    hooks: {},
  },
  {
    // "Upon pickup, choose and add 5 cards to your deck." RUN-LAYER.
    id: "ORRERY",
    name: "Orrery",
    tier: "shop",
    pool: "shared",
    hooks: {},
  },
  {
    // "Combat reward screens now contain Colorless cards and cards from other colors." RUN-LAYER.
    id: "PRISMATIC_SHARD",
    name: "Prismatic Shard",
    tier: "shop",
    pool: "shared",
    hooks: {},
  },
];
