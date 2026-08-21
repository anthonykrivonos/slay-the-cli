// Powers created by the colorless card pool (exact V2.3.4 behavior).
// Ids/kind/stacking audited against data/corpus/powers.json (note the card
// SADISTIC_NATURE creates power SADISTIC; Panic Button creates NO_BLOCK;
// Dark Shackles' end-of-turn restore is GENERIC_STRENGTH_UP = GainStrengthPower).

import type { PowerDef } from "../../../engine/content/defs";
import { PLAYER } from "../../../engine/core/ids";

interface BombEntry {
  turns: number;
  damage: number;
}

export const colorlessPowers: PowerDef[] = [
  {
    // "At the start of your turn, add X random Colorless cards into your hand."
    // ENGINE-NOTE: our startPlayerTurn draws synchronously, so the queued add
    // lands after the turn's normal draw (the game adds before it) - Brutality
    // precedent in powers/ironclad.ts.
    id: "MAGNETISM",
    name: "Magnetism",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "effect", ref: "colorless/addRandomColorless", args: { n: ctx.power!.amount } });
      },
    },
  },
  {
    // "At the start of your turn, play the top X cards of your draw pile."
    // ENGINE-NOTE: like Magnetism, the plays land after the turn's normal draw.
    id: "MAYHEM",
    name: "Mayhem",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        for (let i = 0; i < ctx.power!.amount; i++) {
          ctx.queue.addToBottom({ kind: "effect", ref: "colorless/mayhemPlayTop" });
        }
      },
    },
  },
  {
    // "You cannot gain Block from cards." (Panic Button) Duration ticks at end
    // of round; only card-sourced block folds modifyBlock (calcBlock fromCard).
    id: "NO_BLOCK",
    name: "No Block",
    kind: "debuff",
    stacking: "duration",
    turnBased: true,
    hooks: {
      modifyBlock: () => 0,
    },
  },
  {
    // "At the end of your turn, deal X damage to ALL enemies." (THORNS type)
    id: "OMEGA",
    name: "Omega",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (!isPlayerTurn) return;
        const amounts = ctx.combat!.monsters.map(() => ctx.power!.amount);
        ctx.queue.addToBottom({ kind: "damageAllMonsters", amounts, info: { type: "thorns", source: PLAYER } });
      },
    },
  },
  {
    // "Every time you play 5 cards in a single turn, deal X damage to ALL
    // enemies." Counter lives in power data; resets to 5 at the start of each
    // turn. The Panache card itself decrements the fresh counter to 4 (the
    // power exists before the after-card trigger fires - game parity).
    id: "PANACHE",
    name: "Panache",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.power!.data = { count: 5 };
      },
      onAfterCardPlayed: (ctx) => {
        const count = (((ctx.power!.data?.count as number | undefined) ?? 5) - 1);
        if (count <= 0) {
          ctx.power!.data = { count: 5 };
          const amounts = ctx.combat!.monsters.map(() => ctx.power!.amount);
          ctx.queue.addToBottom({ kind: "damageAllMonsters", amounts, info: { type: "thorns", source: PLAYER } });
        } else {
          ctx.power!.data = { count };
        }
      },
    },
  },
  {
    // "Whenever you apply a debuff to an enemy, they take X damage." (card:
    // SADISTIC_NATURE). Fires on the source-side onApplyPower notification,
    // which the power runtime only raises after a SUCCESSFUL application
    // (Artifact-negated applications don't trigger - game parity). Negative
    // Strength/Dexterity are buff-typed and don't trigger (game parity).
    id: "SADISTIC",
    name: "Sadistic",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onApplyPower: (ctx, powerId, target) => {
        if (target.kind !== "monster") return;
        if (ctx.bundle.powers.get(powerId)?.kind !== "debuff") return;
        ctx.queue.addToBottom({
          kind: "damage",
          target,
          info: { type: "thorns", source: PLAYER, amount: ctx.power!.amount },
        });
      },
    },
  },
  {
    // "At the end of 3 turns, deal X damage to ALL enemies." Each cast is an
    // independent fuse in power data (see colorless/theBomb in effects.ts);
    // amount mirrors the oldest fuse's remaining turns for display.
    id: "THE_BOMB",
    name: "The Bomb",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (!isPlayerTurn) return;
        const p = ctx.power!;
        const bombs = (p.data?.bombs as BombEntry[] | undefined) ?? [];
        const remaining: BombEntry[] = [];
        for (const b of bombs) {
          b.turns--;
          if (b.turns <= 0) {
            const amounts = ctx.combat!.monsters.map(() => b.damage);
            ctx.queue.addToBottom({ kind: "damageAllMonsters", amounts, info: { type: "thorns", source: PLAYER } });
          } else {
            remaining.push(b);
          }
        }
        p.data = { bombs: remaining };
        p.amount = remaining[0]?.turns ?? 0;
        if (remaining.length === 0) {
          ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "THE_BOMB" });
        }
      },
    },
  },
  {
    // "At the end of its turn, gains X Strength." One-shot restore used by
    // Dark Shackles (the game's GainStrengthPower); self-removes after firing
    // at the end of the OWNER's turn.
    id: "GENERIC_STRENGTH_UP",
    name: "Strength Up",
    kind: "buff",
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
          amount: ctx.power!.amount,
        });
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "GENERIC_STRENGTH_UP" });
      },
    },
  },
];
