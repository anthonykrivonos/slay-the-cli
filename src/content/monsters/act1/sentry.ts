// Sentry - exact port from data/corpus/monsters-act1.json (SENTRY).
// Prebattle: ARTIFACT 1. First move by spawn position: idx % 2 == 0 -> BOLT,
// idx % 2 == 1 -> BEAM (three-sentry elite: outer two open with Bolt). Then
// strict BOLT/BEAM alternation for the rest of combat (one aiRng.random(99)
// consumed per turn, unused - matching the reference).

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, lastMove } from "../../util";
import { addStatusCards, attackPlayer, prePower } from "./_shared";

export const sentry: MonsterDef = {
  id: "SENTRY",
  name: "Sentry",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [39, 45] : [38, 42]),
  preBattle: (_ctx, self) => prePower(self, "ARTIFACT", 1),
  moves: {
    SENTRY_BOLT: {
      id: "SENTRY_BOLT",
      intent: "debuff",
      execute: (ctx, _self) => addStatusCards(ctx, "DAZED", ctx.asc >= 18 ? 3 : 2),
    },
    SENTRY_BEAM: {
      id: "SENTRY_BEAM",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 3 ? 10 : 9),
    },
  },
  getMove: (_ctx, self) => {
    if (firstTurn(self)) return self.idx % 2 === 0 ? "SENTRY_BOLT" : "SENTRY_BEAM";
    return lastMove(self) === "SENTRY_BOLT" ? "SENTRY_BEAM" : "SENTRY_BOLT";
  },
};
