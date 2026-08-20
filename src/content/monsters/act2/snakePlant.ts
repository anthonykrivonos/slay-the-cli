// Snake Plant — exact port from data/corpus/monsters-act2.json.
// Prebattle: MALLEABLE 3 (block equal to the current amount per unblocked
// attack hit, +1 per trigger, reset to 3 at the end of every round).
// AI per roll: CHOMP 65% (never 3x), ENFEEBLING_SPORES 35%.
// CONFLICT HONORED (A17 pattern): lightspeed — the A17 change only loosens the
// spores gate from "never 2x in a row" to "never 3x in a row" (the wiki's
// fixed CHOMP,CHOMP,SPORES cycle claim is from an under-construction page).

import type { MonsterDef } from "../../../engine/content/defs";
import { lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, playerPower } from "./_shared";

const CHOMP = "SNAKE_PLANT_CHOMP";
const SPORES = "SNAKE_PLANT_ENFEEBLING_SPORES";

export const snakePlant: MonsterDef = {
  id: "SNAKE_PLANT",
  name: "Snake Plant",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [78, 82] : [75, 79]),
  preBattle: (_ctx, self) => {
    // data.base keeps the end-of-round reset target
    self.powers.push({ id: "MALLEABLE", amount: 3, justApplied: false, data: { base: 3 } });
  },
  moves: {
    SNAKE_PLANT_CHOMP: {
      id: CHOMP,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 8 : 7, 3),
    },
    SNAKE_PLANT_ENFEEBLING_SPORES: {
      id: SPORES,
      intent: "strongDebuff",
      execute: (ctx, self) => {
        playerPower(ctx, self, "FRAIL", 2);
        playerPower(ctx, self, "WEAK", 2);
      },
    },
  },
  getMove: (ctx, self, roll) => {
    if (roll < 65) {
      return lastTwoMovesWere(self, CHOMP) ? SPORES : CHOMP;
    }
    if (ctx.asc >= 17) {
      return !lastTwoMovesWere(self, SPORES) ? SPORES : CHOMP;
    }
    return lastMove(self) === SPORES ? CHOMP : SPORES;
  },
};
