// Event + special relics — values audited vs data/corpus/relics.json.

import type { RelicDef } from "../../engine/content/defs";
import { PLAYER, monster } from "../../engine/core/ids";
import {
  classPoolFilter,
  cnt,
  gainGold,
  healPlayer,
  makeCardInstance,
  randomCardDefs,
  upgradeInCombat,
  canUpgradeInCombat,
} from "./lib";

export const eventRelics: RelicDef[] = [
  {
    // "Whenever you gain Gold, heal 5 HP." RUN-LAYER: onGainGold not fired yet.
    id: "BLOODY_IDOL",
    name: "Bloody Idol",
    tier: "event",
    pool: "shared",
    hooks: {
      onGainGold: (ctx, amount) => {
        healPlayer(ctx, 5);
        return amount;
      },
    },
  },
  {
    // "You feel more talkative." No gameplay effect (flavor relic).
    id: "CULTIST_HEADPIECE",
    name: "Cultist Headpiece",
    tier: "event",
    pool: "shared",
    hooks: {},
  },
  {
    // "At the start of each combat, add a random Power card into your hand.
    // It costs 0 for that turn." DEPENDS: power-card pool.
    id: "ENCHIRIDION",
    name: "Enchiridion",
    tier: "event",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => {
        const picked = randomCardDefs(ctx, 1, classPoolFilter(ctx, "power"))[0];
        if (!picked) return;
        const c = makeCardInstance(ctx, picked.id, 0, "hand");
        if (c) c.costForTurn = 0;
      },
    },
  },
  {
    // "At the end of combat, raise your Max HP by 1."
    id: "FACE_OF_CLERIC",
    name: "Face of Cleric",
    tier: "event",
    pool: "shared",
    hooks: {
      onVictory: (ctx) => {
        ctx.run.maxHp += 1;
        ctx.run.hp += 1;
      },
    },
  },
  {
    // "Enemies drop 25% more Gold." RUN-LAYER (combat gold rewards).
    id: "GOLDEN_IDOL",
    name: "Golden Idol",
    tier: "event",
    pool: "shared",
    hooks: {},
  },
  {
    // "Start each combat with 1 Weak." (expires at the end of round 1)
    id: "GREMLIN_VISAGE",
    name: "Gremlin Visage",
    tier: "event",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) =>
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "WEAK", amount: 1 }),
    },
  },
  {
    // "You can no longer heal."
    id: "MARK_OF_THE_BLOOM",
    name: "Mark of the Bloom",
    tier: "event",
    pool: "shared",
    hooks: { onHeal: () => 0 },
  },
  {
    // "Start each combat with 3 Strength. At the end of your first turn, lose 3 Strength."
    id: "MUTAGENIC_STRENGTH",
    name: "Mutagenic Strength",
    tier: "event",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => {
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: 3 });
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "LOSE_STRENGTH", amount: 3 });
      },
    },
  },
  {
    // "The first Attack played each turn that costs 2 or more is played twice.
    // Upon pickup, obtain a special Curse." Curse obtain guarded (DEPENDS:
    // NECRONOMICURSE card def); RUN-LAYER: onEquip not fired yet.
    id: "NECRONOMICON",
    name: "Necronomicon",
    tier: "event",
    pool: "shared",
    onEquip: (ctx) => {
      if (ctx.bundle.cards.has("NECRONOMICURSE")) {
        ctx.run.deck.push({ defId: "NECRONOMICURSE", upgrades: 0, misc: 0, bottled: false });
      }
    },
    hooks: {
      atStartOfTurn: (ctx) => cnt(ctx).set(0),
      onUseCard: (ctx, card, target) => {
        const item = ctx.rt.currentItem;
        if (!item || item.autoplayed || item.purgeOnUse) return;
        if (cnt(ctx).get() !== 0) return;
        if (ctx.bundle.cards.get(card.defId)?.type !== "attack") return;
        if (card.costForTurn < 2) return;
        cnt(ctx).set(1);
        ctx.combat!.cardQueue.unshift({
          iid: card.iid,
          target,
          energyOnUse: item.energyOnUse,
          ignoreEnergyTotal: true,
          regardlessOfCost: true,
          purgeOnUse: false,
          exhaustOnUse: false,
          autoplayed: true,
        });
      },
    },
  },
  {
    // "At the end of each turn, you may shuffle 1 of 3 random cards into your
    // draw pile." ENGINE-GAP: a choice requested mid-end-turn strands the
    // actions queued behind it (endPlayerTurn/monsterTurn are dropped at the
    // input point — the action queue is not serialized across a pending
    // choice). Needs engine support for mid-sequence choices.
    id: "NILRYS_CODEX",
    name: "Nilry's Codex",
    tier: "event",
    pool: "shared",
    hooks: {},
  },
  {
    // "Enemies in your first 3 combats will have 1 HP." counter set on pickup.
    id: "NEOWS_LAMENT",
    name: "Neow's Lament",
    tier: "event",
    pool: "shared",
    onEquip: (ctx) => {
      const r = ctx.run.relics.find((x) => x.defId === "NEOWS_LAMENT");
      if (r) r.counter = 3;
    },
    hooks: {
      atBattleStartPreDraw: (ctx) => {
        if (cnt(ctx).get() <= 0) return;
        cnt(ctx).set(cnt(ctx).get() - 1);
        for (const m of ctx.combat!.monsters) m.hp = 1;
      },
    },
  },
  {
    // "Triples the chance of finding Rare cards from combat rewards." RUN-LAYER.
    id: "NLOTHS_GIFT",
    name: "N'loth's Gift",
    tier: "event",
    pool: "shared",
    hooks: {},
  },
  {
    // "The next non-Boss chest you open is empty." RUN-LAYER (treasure generation).
    id: "NLOTHS_HUNGRY_FACE",
    name: "N'loth's Hungry Face",
    tier: "event",
    pool: "shared",
    hooks: {},
  },
  {
    // Marker: the modified Vulnerable-taken multiplier (x1.25) is consumed inside
    // the VULNERABLE power def via hasRelic("ODD_MUSHROOM").
    id: "ODD_MUSHROOM",
    name: "Odd Mushroom",
    tier: "event",
    pool: "shared",
    hooks: {},
  },
  {
    // "At the start of each combat, apply 1 Weak to ALL enemies."
    id: "RED_MASK",
    name: "Red Mask",
    tier: "event",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => {
        for (const m of ctx.combat!.monsters) {
          if (!m.isDead && !m.isEscaped) {
            ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: monster(m.idx), powerId: "WEAK", amount: 1 });
          }
        }
      },
    },
  },
  {
    // "Whenever you enter a ? room, gain 50 Gold." RUN-LAYER: onEnterRoom not fired yet.
    id: "SSSERPENT_HEAD",
    name: "Ssserpent Head",
    tier: "event",
    pool: "shared",
    hooks: {
      onEnterRoom: (ctx, roomKind) => {
        if (roomKind === "event") gainGold(ctx, 50);
      },
    },
  },
  {
    // "It's unpleasant." No gameplay effect.
    id: "SPIRIT_POOP",
    name: "Spirit Poop",
    tier: "event",
    pool: "shared",
    hooks: {},
  },
  {
    // "At the start of your turn, Upgrade a random card in your hand for the
    // rest of combat." miscRng per the game's implementation.
    id: "WARPED_TONGS",
    name: "Warped Tongs",
    tier: "event",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => {
        const combat = ctx.combat!;
        const candidates = combat.player.piles.hand.filter((iid) => canUpgradeInCombat(ctx, combat.cards[iid]!));
        if (candidates.length === 0) return;
        const iid = candidates[ctx.rng("miscRng").random(candidates.length - 1)]!;
        upgradeInCombat(ctx, combat.cards[iid]!);
      },
    },
  },
  // --- special tier ------------------------------------------------------------
  {
    // "Collect as many as you can." No gameplay effect.
    id: "CIRCLET",
    name: "Circlet",
    tier: "special",
    pool: "shared",
    hooks: {},
  },
  {
    // "You ran out of relics. Impressive!" No gameplay effect.
    id: "RED_CIRCLET",
    name: "Red Circlet",
    tier: "special",
    pool: "shared",
    hooks: {},
  },
];
