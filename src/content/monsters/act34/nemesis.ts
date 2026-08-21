// Nemesis - exact port from data/corpus/monsters-act34.json (NEMESIS).
// Intangible cycle: after executing ANY move, if it is not currently
// Intangible it gains INTANGIBLE 2 (applied synchronously so the end-of-round
// duration tick lands the same round, i.e. intangible on every even turn).
// CONFLICT HONORED (Tri Burn count): 3 Burns, 5 at Ascension 18+ per the wiki
// (lightspeed's asc>=3 threshold is invisible to its RNG-seed tests and is
// presumed a mixup with the elite A18 tier).

import type { MonsterDef, EffectCtx } from "../../../engine/content/defs";
import type { MonsterState } from "../../../engine/combat/combatState";
import { applyPower } from "../../../engine/combat/powerRuntime";
import { monster } from "../../../engine/core/ids";
import { firstTurn, lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, powerAmount } from "../act1/_shared";
import { lastTwoContain, statusCardsNow } from "./_shared";

const ATTACK = "NEMESIS_ATTACK";
const SCYTHE = "NEMESIS_SCYTHE";
const DEBUFF = "NEMESIS_DEBUFF";

/** Gains INTANGIBLE 2 after acting on any turn it is not intangible. */
function intangibleCycle(ctx: EffectCtx, self: MonsterState): void {
  if (powerAmount(self, "INTANGIBLE") === 0) {
    applyPower(ctx, monster(self.idx), monster(self.idx), "INTANGIBLE", 2);
  }
}

export const nemesis: MonsterDef = {
  id: "NEMESIS",
  name: "Nemesis",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [200, 200] : [185, 185]),
  moves: {
    NEMESIS_ATTACK: {
      id: ATTACK,
      intent: "attack",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 3 ? 7 : 6, 3);
        intangibleCycle(ctx, self);
      },
    },
    NEMESIS_SCYTHE: {
      id: SCYTHE,
      intent: "attack",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, 45);
        intangibleCycle(ctx, self);
      },
    },
    NEMESIS_DEBUFF: {
      id: DEBUFF,
      intent: "debuff",
      execute: (ctx, self) => {
        statusCardsNow(ctx, "BURN", ctx.asc >= 18 ? 5 : 3, "discard");
        intangibleCycle(ctx, self);
      },
    },
  },
  getMove: (ctx, self, roll) => {
    if (firstTurn(self)) return roll < 50 ? ATTACK : DEBUFF;
    if (roll < 30) {
      if (!lastTwoContain(self, SCYTHE)) return SCYTHE;
      if (ctx.rng("aiRng").randomBoolean()) {
        return lastTwoMovesWere(self, ATTACK) ? DEBUFF : ATTACK;
      }
      return lastMove(self) === DEBUFF ? ATTACK : DEBUFF;
    }
    if (roll < 65) {
      if (!lastTwoMovesWere(self, ATTACK)) return ATTACK;
      if (!ctx.rng("aiRng").randomBoolean() || lastTwoContain(self, SCYTHE)) return DEBUFF;
      return SCYTHE;
    }
    if (lastMove(self) !== DEBUFF) return DEBUFF;
    if (ctx.rng("aiRng").randomBoolean() && !lastTwoContain(self, SCYTHE)) return SCYTHE;
    return ATTACK;
  },
};
