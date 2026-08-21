// Cultist - exact port from data/corpus/monsters-act1.json (CULTIST).
// AI: turn 1 always Incantation (roll consumed, unused), Dark Strike forever after.
// RITUAL R = 3 (asc>=2: 4, asc>=17: 5); core RITUAL grants +R Strength at the end
// of each of the Cultist's turns starting the turn AFTER it was applied (the
// queued application lands after the turn-1 atEndOfTurn hook fires - skipFirst).

import type { MonsterDef } from "../../../engine/content/defs";
import { ascTier, firstTurn } from "../../util";
import { attackPlayer, selfPower } from "./_shared";

export const cultist: MonsterDef = {
  id: "CULTIST",
  name: "Cultist",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [50, 56] : [48, 54]),
  moves: {
    CULTIST_INCANTATION: {
      id: "CULTIST_INCANTATION",
      intent: "buff",
      execute: (ctx, self) => {
        const ritual = ascTier(ctx.asc, 3, [
          [2, 4],
          [17, 5],
        ]);
        selfPower(ctx, self, "RITUAL", ritual);
      },
    },
    CULTIST_DARK_STRIKE: {
      id: "CULTIST_DARK_STRIKE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 6),
    },
  },
  getMove: (_ctx, self, _roll) => {
    // roll is consumed every turn but its value is never used
    if (firstTurn(self)) return "CULTIST_INCANTATION";
    return "CULTIST_DARK_STRIKE";
  },
};
