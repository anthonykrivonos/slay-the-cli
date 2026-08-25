// Helper powers required by relics/potions in this workstream. Ids and
// semantics audited against data/corpus/powers.json. Some of these (e.g.
// LOSE_STRENGTH, PLATED_ARMOR, FOCUS) are shared with other workstreams -
// definitions are corpus-identical, so map-merge by id is safe.

import type { PowerDef } from "../../engine/content/defs";

export const relicSupportPowers: PowerDef[] = [
  {
    // "Gain X Block next turn." (Self-Forming Clay)
    id: "NEXT_TURN_BLOCK",
    name: "Next Turn Block",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "NEXT_TURN_BLOCK" });
      },
    },
  },
  {
    // "At the end of this turn, lose X Strength." (Mutagenic Strength, Flex Potion)
    id: "LOSE_STRENGTH",
    name: "Strength Down",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (ctx.owner.kind === "player" ? !isPlayerTurn : isPlayerTurn) return;
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: ctx.owner,
          target: ctx.owner,
          powerId: "STRENGTH",
          amount: -ctx.power!.amount,
        });
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "LOSE_STRENGTH" });
      },
    },
  },
  {
    // "At the end of this turn, lose X Dexterity." (Duality, Speed Potion)
    id: "LOSE_DEXTERITY",
    name: "Dexterity Down",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (ctx.owner.kind === "player" ? !isPlayerTurn : isPlayerTurn) return;
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: ctx.owner,
          target: ctx.owner,
          powerId: "DEXTERITY",
          amount: -ctx.power!.amount,
        });
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "LOSE_DEXTERITY" });
      },
    },
  },
  {
    // "At the end of your turn, gain X Block. Unblocked attack damage reduces it by 1."
    // (Thread and Needle, Essence of Steel)
    id: "PLATED_ARMOR",
    name: "Plated Armor",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurnPreEndOfTurnCards: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
      },
      // monsters (Shelled Parasite) gain theirs at the end of THEIR turn
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (ctx.owner.kind === "monster" && !isPlayerTurn) {
          ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
        }
      },
      wasHPLost: (ctx, info, amount) => {
        if (info.type === "attack" && info.source !== null && amount > 0) {
          ctx.queue.addToTop({ kind: "reducePower", target: ctx.owner, powerId: "PLATED_ARMOR", amount: 1 });
        }
      },
    },
  },
  {
    // "Heals X HP at the end of your turn. Reduced by 1 each turn." (Regen Potion)
    // turnBased: the engine's end-of-round tick handles the decrement.
    id: "REGEN",
    name: "Regen",
    kind: "buff",
    stacking: "intensity",
    turnBased: true,
    hooks: {
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (ctx.owner.kind === "player" && isPlayerTurn) {
          ctx.queue.addToBottom({ kind: "heal", target: ctx.owner, amount: ctx.power!.amount });
        }
      },
    },
  },
  {
    // "Increases the effectiveness of Orbs by X." Read by the orb runtime via
    // getPowerAmount(...,"FOCUS"); no hooks needed. (Data Disk, Focus Potion)
    id: "FOCUS",
    name: "Focus",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    canGoNegative: true,
    hooks: {},
  },
  {
    // "Whenever you draw a card, randomize its cost." (Snecko Eye)
    // Exact port: roll always consumed; cost only rewritten when it changes.
    id: "CONFUSED",
    name: "Confused",
    kind: "debuff",
    stacking: "none",
    turnBased: false,
    hooks: {
      onDraw: (ctx, card) => {
        if (card.cost >= 0) {
          const newCost = ctx.rng("cardRandomRng").random(3);
          if (newCost !== card.cost) {
            card.cost = newCost;
            card.costForTurn = newCost;
          }
        }
      },
    },
  },
  {
    // "Prevent the next X times you would lose HP." (Fossilized Helix)
    id: "BUFFER",
    name: "Buffer",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onLoseHp: (ctx, amount) => {
        if (amount <= 0 || ctx.power!.amount <= 0) return amount;
        ctx.power!.amount--;
        if (ctx.power!.amount <= 0) {
          ctx.queue.addToTop({ kind: "removePower", target: ctx.owner, powerId: "BUFFER" });
        }
        return 0;
      },
    },
  },
  {
    // "This turn, your next X cards are played twice." (Duplication Potion)
    // KNOWN LIMIT (ENGINE-GAP): a duplicated POWER card fizzles - the original
    // resolution deletes the instance before the duplicate drains, because the
    // engine's card queue is id-based while the game replays the object.
    id: "DUPLICATION",
    name: "Duplication",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card, target) => {
        const item = ctx.rt.currentItem;
        if (!item || item.autoplayed || item.purgeOnUse) return;
        if (ctx.power!.amount <= 0) return;
        ctx.power!.amount--;
        if (ctx.power!.amount <= 0) {
          ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "DUPLICATION" });
        }
        ctx.combat!.cardQueue.unshift({
          iid: card.iid,
          target,
          energyOnUse: item.energyOnUse,
          ignoreEnergyTotal: true,
          regardlessOfCost: true,
          purgeOnUse: false,
          exhaustOnUse: false,
          autoplayed: true,
          via: "DUPLICATION_POTION",
        });
      },
      // expires at the end of the turn it was drunk
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (ctx.owner.kind === "player" && isPlayerTurn) {
          ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "DUPLICATION" });
        }
      },
    },
  },
];
