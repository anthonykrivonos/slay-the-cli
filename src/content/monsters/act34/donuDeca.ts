// Donu & Deca - exact ports from data/corpus/monsters-act34.json (DONU,
// DECA). Paired boss: Deca in slot 0, Donu in slot 1 (the DONU_AND_DECA boss
// encounter must resolve to BOTH - see act34BossEncounters in ./index.ts).
// Strict out-of-phase alternation with no AI randomness after the initial
// forced first moves: turn 1 Deca Beam + Donu Circle of Power, turn 2 Deca
// Square of Protection + Donu Beam, repeat.
// ENGINE-GAP (rng parity): the reference's Donu/Deca move handlers consume NO
// aiRng calls after battle init; this engine's rollMove consumes one
// aiRng.random(99) per monster per turn (value unused).

import type { MonsterDef, EffectCtx } from "../../../engine/content/defs";
import { monster } from "../../../engine/core/ids";
import { firstTurn, lastMove } from "../../util";
import { attackPlayer, prePower } from "../act1/_shared";
import { statusCardsNow } from "./_shared";

/** Apply an action to every combat slot (dead included - harmless, per the
 *  corpus note that Circle of Power hits a dead Deca; escaped/gap skipped). */
function eachSlot(ctx: EffectCtx, fn: (idx: number) => void): void {
  for (const m of ctx.combat!.monsters) {
    if (!m.isEscaped) fn(m.idx);
  }
}

export const donu: MonsterDef = {
  id: "DONU",
  name: "Donu",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [265, 265] : [250, 250]),
  preBattle: (ctx, self) => prePower(self, "ARTIFACT", ctx.asc >= 19 ? 3 : 2),
  moves: {
    DONU_CIRCLE_OF_POWER: {
      id: "DONU_CIRCLE_OF_POWER",
      intent: "buff",
      execute: (ctx, self) => {
        eachSlot(ctx, (idx) =>
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: monster(self.idx),
            target: monster(idx),
            powerId: "STRENGTH",
            amount: 3,
          }),
        );
      },
    },
    DONU_BEAM: {
      id: "DONU_BEAM",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 12 : 10, 2),
    },
  },
  getMove: (_ctx, self) => {
    if (firstTurn(self)) return "DONU_CIRCLE_OF_POWER";
    return lastMove(self) === "DONU_CIRCLE_OF_POWER" ? "DONU_BEAM" : "DONU_CIRCLE_OF_POWER";
  },
};

export const deca: MonsterDef = {
  id: "DECA",
  name: "Deca",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [265, 265] : [250, 250]),
  preBattle: (ctx, self) => prePower(self, "ARTIFACT", ctx.asc >= 19 ? 3 : 2),
  moves: {
    DECA_BEAM: {
      id: "DECA_BEAM",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 4 ? 12 : 10, 2);
        statusCardsNow(ctx, "DAZED", 2, "discard");
      },
    },
    DECA_SQUARE_OF_PROTECTION: {
      id: "DECA_SQUARE_OF_PROTECTION",
      intent: "defend",
      execute: (ctx, self) => {
        eachSlot(ctx, (idx) => {
          ctx.queue.addToBottom({ kind: "gainBlock", target: monster(idx), amount: 16, fromCard: false });
          if (ctx.asc >= 19) {
            ctx.queue.addToBottom({
              kind: "applyPower",
              source: monster(self.idx),
              target: monster(idx),
              powerId: "PLATED_ARMOR",
              amount: 3,
            });
          }
        });
      },
    },
  },
  getMove: (_ctx, self) => {
    if (firstTurn(self)) return "DECA_BEAM";
    return lastMove(self) === "DECA_BEAM" ? "DECA_SQUARE_OF_PROTECTION" : "DECA_BEAM";
  },
};
