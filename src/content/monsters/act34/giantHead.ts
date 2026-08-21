// Giant Head - exact port from data/corpus/monsters-act34.json (GIANT_HEAD).
// SLOW starts at 0 (+1 per card played; +10% damage taken each; resets each
// round). It Is Time is rolled from monster turn 4 on (so first USED on turn
// 5) and escalates +5 per turn to a +30 cap.
// CONFLICT HONORED (asc18): per the wiki the Count/Glare phase lasts only 3
// turns at A18+ - It Is Time starts on turn 4 and the escalation term shifts
// to (turn - 4). lightspeed has no ascension branch (flagged as its gap).

import type { MonsterDef } from "../../../engine/content/defs";
import { lastTwoMovesWere } from "../../util";
import { attackPlayer, playerPower, prePower } from "../act1/_shared";
import { turnNumber } from "./_shared";

const COUNT = "GIANT_HEAD_COUNT";
const GLARE = "GIANT_HEAD_GLARE";
const IT_IS_TIME = "GIANT_HEAD_IT_IS_TIME";

export const giantHead: MonsterDef = {
  id: "GIANT_HEAD",
  name: "Giant Head",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [520, 520] : [500, 500]),
  preBattle: (_ctx, self) => prePower(self, "SLOW", 0),
  moves: {
    GIANT_HEAD_COUNT: {
      id: COUNT,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 13),
    },
    GIANT_HEAD_GLARE: {
      id: GLARE,
      intent: "debuff",
      execute: (ctx, self) => playerPower(ctx, self, "WEAK", 1),
    },
    GIANT_HEAD_IT_IS_TIME: {
      id: IT_IS_TIME,
      intent: "attack",
      execute: (ctx, self) => {
        const firstUseTurn = ctx.asc >= 18 ? 4 : 5;
        const base = ctx.asc >= 3 ? 40 : 30;
        const bonus = 5 * Math.min(Math.max(turnNumber(ctx) - firstUseTurn, 0), 6);
        attackPlayer(ctx, self, base + bonus);
      },
    },
  },
  getMove: (ctx, self, roll) => {
    // rolls happen during the monster's turn for the NEXT turn, so the
    // threshold check uses the current battle turn (0 at the pre-battle roll)
    if (turnNumber(ctx) >= (ctx.asc >= 18 ? 3 : 4)) return IT_IS_TIME;
    if (roll < 50) return lastTwoMovesWere(self, GLARE) ? COUNT : GLARE;
    return lastTwoMovesWere(self, COUNT) ? GLARE : COUNT;
  },
};
