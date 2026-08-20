// Byrd — exact port from data/corpus/monsters-act2.json.
// Prebattle: FLIGHT 3 (asc>=17: 4) — halves attack damage, loses 1 per
// unblocked attack hit, resets to full at the end of every round, and is
// REMOVED at 0 (corpus adjudication), grounding the Byrd: the current intent
// becomes STUNNED, then the fixed grounded script STUNNED -> HEADBUTT -> FLY
// (re-applies Flight) before the normal airborne pattern resumes.
// Airborne AI: first turn aiRng.randomBoolean(0.375) -> CAW else PECK (the
// roll is consumed but ignored; never opens with SWOOP). Then per roll PECK
// 50% (never 3x), SWOOP 20% (never 2x), CAW 30% (never 2x).
// ENGINE-GAP: the reference burns no aiRng.random(99) on the HEADBUTT -> FLY
// transition (moves chained in takeTurn); this engine's rollMove consumes one
// per turn (value unused on that transition).

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, prePower, selfPower } from "./_shared";

const PECK = "BYRD_PECK";
const SWOOP = "BYRD_SWOOP";
const CAW = "BYRD_CAW";
const STUNNED = "BYRD_STUNNED";
const HEADBUTT = "BYRD_HEADBUTT";
const FLY = "BYRD_FLY";

export const byrd: MonsterDef = {
  id: "BYRD",
  name: "Byrd",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [26, 33] : [25, 31]),
  preBattle: (ctx, self) => prePower(self, "FLIGHT", ctx.asc >= 17 ? 4 : 3),
  moves: {
    BYRD_PECK: {
      id: PECK,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 1, ctx.asc >= 2 ? 6 : 5),
    },
    BYRD_SWOOP: {
      id: SWOOP,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 14 : 12),
    },
    BYRD_CAW: {
      id: CAW,
      intent: "buff",
      execute: (ctx, self) => selfPower(ctx, self, "STRENGTH", 1),
    },
    BYRD_STUNNED: {
      id: STUNNED,
      intent: "stun",
      execute: () => {},
    },
    BYRD_HEADBUTT: {
      id: HEADBUTT,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 3),
    },
    BYRD_FLY: {
      id: FLY,
      intent: "unknown",
      execute: (ctx, self) => selfPower(ctx, self, "FLIGHT", ctx.asc >= 17 ? 4 : 3),
    },
  },
  getMove: (ctx, self, roll) => {
    if (self.data.pendingGrounded) {
      // grounded during its own turn (thorns): the stun lands next turn
      delete self.data.pendingGrounded;
      return STUNNED;
    }
    // grounded script (getMove is only reached airborne in the reference)
    switch (lastMove(self)) {
      case STUNNED:
        return HEADBUTT;
      case HEADBUTT:
        return FLY;
    }
    if (firstTurn(self)) return ctx.rng("aiRng").randomBoolean(0.375) ? CAW : PECK;
    if (roll < 50) {
      if (lastTwoMovesWere(self, PECK)) {
        return ctx.rng("aiRng").randomBoolean(0.4) ? SWOOP : CAW;
      }
      return PECK;
    }
    if (roll < 70) {
      if (lastMove(self) === SWOOP) {
        return ctx.rng("aiRng").randomBoolean(0.375) ? CAW : PECK;
      }
      return SWOOP;
    }
    if (lastMove(self) === CAW) {
      return ctx.rng("aiRng").randomBoolean(0.2857) ? SWOOP : PECK;
    }
    return CAW;
  },
};
