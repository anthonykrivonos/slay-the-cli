// Gremlin Nob — exact port from data/corpus/monsters-act1.json (GREMLIN_NOB).
// Turn 1 always Bellow (ENRAGE 2; asc>=18: 3 — +Strength whenever the player
// plays a Skill). asc<18: 33% Skull Bash / 67% Rush with Rush never 3x in a row.
// CONFLICT HONORED (asc>=18): lightspeed's branch degenerates to Rush-forever;
// per the wiki/real game the pattern is Bellow, then repeating
// [Skull Bash, Rush, Rush] — Skull Bash whenever absent from the last two moves.

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, lastTwoMovesWere } from "../../util";
import { attackPlayer, playerPower, selfPower } from "./_shared";

export const gremlinNob: MonsterDef = {
  id: "GREMLIN_NOB",
  name: "Gremlin Nob",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [85, 90] : [82, 86]),
  moves: {
    GREMLIN_NOB_BELLOW: {
      id: "GREMLIN_NOB_BELLOW",
      intent: "buff",
      execute: (ctx, self) => selfPower(ctx, self, "ENRAGE", ctx.asc >= 18 ? 3 : 2),
    },
    GREMLIN_NOB_RUSH: {
      id: "GREMLIN_NOB_RUSH",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 3 ? 16 : 14),
    },
    GREMLIN_NOB_SKULL_BASH: {
      id: "GREMLIN_NOB_SKULL_BASH",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 3 ? 8 : 6);
        playerPower(ctx, self, "VULNERABLE", 2);
      },
    },
  },
  getMove: (ctx, self, roll) => {
    if (firstTurn(self)) return "GREMLIN_NOB_BELLOW";
    if (ctx.asc >= 18) {
      // Skull Bash whenever it is not among the last two moves, else Rush
      const lastTwo = self.moveHistory.slice(-2);
      return lastTwo.includes("GREMLIN_NOB_SKULL_BASH") ? "GREMLIN_NOB_RUSH" : "GREMLIN_NOB_SKULL_BASH";
    }
    if (roll < 33 || lastTwoMovesWere(self, "GREMLIN_NOB_RUSH")) return "GREMLIN_NOB_SKULL_BASH";
    return "GREMLIN_NOB_RUSH";
  },
};
