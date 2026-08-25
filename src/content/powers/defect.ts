// Defect powers (exact V2.3.4 behavior), created by the blue card pool. Ids and
// semantics audited against data/corpus/powers.json - note the corpus ids that
// differ from their card names: ELECTRO (Electrodynamics), HEATSINK (Heatsinks),
// DRAW (Machine Learning), BIAS (Biased Cognition's downside), REPAIR (Self
// Repair), ENERGIZED (Charge Battery), REBOUND (Rebound). FOCUS and BUFFER are
// NOT defined here: relics/supportPowers.ts already carries the corpus-correct
// defs (FOCUS with canGoNegative: true - required by Biased Cognition) and the
// integrator's map-merge keeps a single copy. Helper powers at the bottom are
// engine workarounds, not corpus powers.

import type { PowerDef, EffectCtx } from "../../engine/content/defs";
import type { CardInstance, CardQueueItem } from "../../engine/combat/combatState";
import { makeTempCard } from "../../engine/combat/interpreter";
import { foldHook } from "../../engine/core/hooks";
import { PLAYER } from "../../engine/core/ids";

/**
 * Play `card` a second time (Echo Form / Amplify), DOUBLE_TAP pattern: the
 * duplicate resolves right after the original finishes (free, autoplayed).
 * ENGINE-GAP workaround for POWER cards: re-queuing the same iid fizzles
 * (afterCardUsed deletes the instance before the duplicate drains, as noted on
 * the DUPLICATION potion power), so powers are duplicated via a temp copy that
 * purges after resolving. ENGINE-NOTE: makeTempCard folds
 * modifyCreatedCardUpgrades (Master Reality), which the game would not apply
 * to a duplicated play.
 */
function duplicateCardPlay(ctx: EffectCtx, card: CardInstance, target: number | null, item: CardQueueItem, via: string): void {
  const combat = ctx.combat!;
  const def = ctx.bundle.cards.get(card.defId);
  if (!def) return;
  if (def.type === "power") {
    const iid = combat.nextCardInstanceId;
    makeTempCard(ctx, card.defId, card.upgrades, "limbo");
    combat.cardQueue.unshift({
      iid,
      target,
      energyOnUse: item.energyOnUse,
      ignoreEnergyTotal: true,
      regardlessOfCost: true,
      purgeOnUse: true,
      exhaustOnUse: false,
      autoplayed: true,
      via,
    });
    return;
  }
  combat.cardQueue.unshift({
    iid: card.iid,
    target,
    energyOnUse: item.energyOnUse,
    ignoreEnergyTotal: true,
    regardlessOfCost: true,
    purgeOnUse: false,
    exhaustOnUse: false,
    autoplayed: true,
    via,
  });
}

export const defectPowers: PowerDef[] = [
  {
    // "The first X cards you play each turn are played twice."
    id: "ECHO_FORM",
    name: "Echo Form",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.power!.data = { used: 0 };
      },
      onUseCard: (ctx, card, target) => {
        const item = ctx.rt.currentItem;
        if (!item || item.autoplayed || item.purgeOnUse) return;
        const used = (ctx.power!.data?.used as number | undefined) ?? 0;
        if (used >= ctx.power!.amount) return;
        ctx.power!.data = { used: used + 1 };
        duplicateCardPlay(ctx, card, target, item, "ECHO_FORM");
      },
    },
  },
  {
    // "Your next X Power cards are played twice this turn."
    id: "AMPLIFY",
    name: "Amplify",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card, target) => {
        if (ctx.power!.amount <= 0) return;
        if (ctx.bundle.cards.get(card.defId)?.type !== "power") return;
        const item = ctx.rt.currentItem;
        if (!item || item.autoplayed || item.purgeOnUse) return;
        duplicateCardPlay(ctx, card, target, item, "AMPLIFY");
        ctx.queue.addToBottom({ kind: "reducePower", target: ctx.owner, powerId: "AMPLIFY", amount: 1 });
      },
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (isPlayerTurn) ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "AMPLIFY" });
      },
    },
  },
  {
    // "Lightning hits ALL enemies." Read by the LIGHTNING orb effect; the
    // Electrodynamics CARD does the channeling - this power only retargets.
    id: "ELECTRO",
    name: "Electro",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {},
  },
  {
    // "At the start of your turn, trigger the passive ability of your next Orb
    //  X times." Next = leftmost (index 0), whatever its type (Plasma included).
    id: "LOOP",
    name: "Loop",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        const orbs = ctx.combat!.player.orbs;
        const first = orbs[0];
        if (!first) return;
        const def = ctx.bundle.orbs.get(first.id);
        if (!def) return;
        for (let i = 0; i < ctx.power!.amount; i++) def.onPassive(ctx, 0);
      },
    },
  },
  {
    // "Whenever you play a Power card, Channel X Lightning."
    id: "STORM",
    name: "Storm",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type !== "power") return;
        ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "LIGHTNING", n: ctx.power!.amount } });
      },
    },
  },
  {
    // "Whenever you receive unblocked attack damage, Channel X Lightning."
    id: "STATIC_DISCHARGE",
    name: "Static Discharge",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      wasHPLost: (ctx, info, amount) => {
        if (info.type !== "attack" || amount <= 0) return;
        ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "LIGHTNING", n: ctx.power!.amount } });
      },
    },
  },
  {
    // "Whenever you play a Power card, draw X cards."
    id: "HEATSINK",
    name: "Heatsink",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type !== "power") return;
        ctx.queue.addToBottom({ kind: "draw", n: ctx.power!.amount });
      },
    },
  },
  {
    // "At the start of your turn, add X random Common cards into your hand."
    id: "HELLO_WORLD",
    name: "Hello",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "effect", ref: "defect/addRandomCard", args: { pool: "common", n: ctx.power!.amount } });
      },
    },
  },
  {
    // "At the start of your turn, add X random Power cards into your hand."
    id: "CREATIVE_AI",
    name: "Creative AI",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "effect", ref: "defect/addRandomCard", args: { pool: "power", n: ctx.power!.amount } });
      },
    },
  },
  {
    // "At the start of your turn, draw X additional cards." (Machine Learning)
    id: "DRAW",
    name: "Draw",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      modifyDrawPerTurn: (ctx, n) => n + ctx.power!.amount,
    },
  },
  {
    // "At the start of your turn, lose X Focus." (Biased Cognition's downside;
    // the negative FOCUS application is Artifact-negatable, as in the game)
    id: "BIAS",
    name: "Bias",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: ctx.owner,
          target: ctx.owner,
          powerId: "FOCUS",
          amount: -ctx.power!.amount,
        });
      },
    },
  },
  {
    // "Retain your hand for X turns." (duration ticks at end of round)
    // retainsHand skips the end-of-turn DISCARD only: ethereal cards still
    // exhaust out of a kept hand (interpreter endOfTurnDiscard).
    id: "EQUILIBRIUM",
    name: "Equilibrium",
    kind: "buff",
    stacking: "duration",
    turnBased: true,
    hooks: {
      retainsHand: () => true,
    },
  },
  {
    // "Receives 50% more damage from Orbs for X turns." Read by the orb damage
    // effects in content/orbs.ts (Lightning/Dark, x1.5 int-truncated).
    id: "LOCK_ON",
    name: "Lock-On",
    kind: "debuff",
    stacking: "duration",
    turnBased: true,
    hooks: {},
  },
  {
    // "At the end of combat, heal X HP." (Self Repair) Heals synchronously on
    // victory - queued heals may be dropped once combat is over (Feed pattern).
    id: "REPAIR",
    name: "Repair",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onVictory: (ctx) => {
        const healed = Math.floor(foldHook(ctx, PLAYER, "onHeal", ctx.power!.amount));
        ctx.run.hp = Math.min(ctx.run.maxHp, ctx.run.hp + healed);
      },
    },
  },
  {
    // "Gain X additional Energy next turn." (Charge Battery)
    id: "ENERGIZED",
    name: "Energized",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onEnergyRecharge: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainEnergy", n: ctx.power!.amount });
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "ENERGIZED" });
      },
    },
  },
  {
    // "The next card you play this turn is put on top of your draw pile."
    // data.skip protects the Rebound play that applied it (the game's skipFirst);
    // the deferred move runs after the terminal discard and only if the card
    // actually landed in the discard pile (exhaust/powers win, as in the game).
    id: "REBOUND",
    name: "Rebound",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onAfterCardPlayed: (ctx, card) => {
        const p = ctx.power!;
        const skip = (p.data?.skip as number | undefined) ?? 0;
        if (skip > 0) {
          p.data = { ...p.data, skip: skip - 1 };
          return;
        }
        if (p.amount <= 0) return;
        ctx.queue.addToBottom({ kind: "effect", ref: "defect/reboundMove", args: { iid: card.iid } });
        ctx.queue.addToBottom({ kind: "reducePower", target: ctx.owner, powerId: "REBOUND", amount: 1 });
      },
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (isPlayerTurn) ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "REBOUND" });
      },
    },
  },

  // --- helper powers (engine workarounds; not in the corpus power list) --------
  {
    // Per-combat channel tally for Blizzard/Thunder Strike. Created lazily by
    // the first content orb operation (seeded from the orbs then in play, which
    // still include battle-start relic channels); onChannel counts every channel
    // from any source afterwards. See content/orbs.ts ensureChannelTally.
    id: "CHANNEL_TALLY",
    name: "Channel Tally",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      onChannel: (ctx, orbId) => {
        const counts = { ...((ctx.power!.data?.counts as Record<string, number> | undefined) ?? {}) };
        counts[orbId] = (counts[orbId] ?? 0) + 1;
        ctx.power!.data = { counts };
      },
    },
  },
  {
    // Claw: "Increase the damage of ALL Claw cards by 2 this combat." Combat-
    // wide counter; every Claw's damage = printed base + this amount (applies
    // to copies created later too, matching the game).
    id: "CLAW_BUFF",
    name: "Claw Buff",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {},
  },
];
