// Book of Stabbing — exact port from data/corpus/monsters-act2.json (elite).
// Prebattle: PAINFUL_STABS (each unblocked hit adds a Wound to the discard
// pile) + stabCount = 1 in self.data.
// AI per roll: SINGLE_STAB 15% (never twice in a row), MULTI_STAB 85% (never
// 3x). stabCount increments at SELECTION time whenever MULTI_STAB is rolled,
// so the Nth Multi Stab hits N+1 times.
// CONFLICT HONORED (A18 stab count): the A18 rule is encoded — stabCount ALSO
// increments when SINGLE_STAB is selected (lightspeed transcribed the two
// "if (asc18) ++stabCount" statements after return statements — dead code;
// the wiki/real game increments every turn at A18, so a Multi Stab executing
// on turn T hits T+1 times).

import type { MonsterDef } from "../../../engine/content/defs";
import { lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, prePower } from "./_shared";

const MULTI = "BOOK_OF_STABBING_MULTI_STAB";
const SINGLE = "BOOK_OF_STABBING_SINGLE_STAB";

export const bookOfStabbing: MonsterDef = {
  id: "BOOK_OF_STABBING",
  name: "Book of Stabbing",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [168, 172] : [160, 164]),
  preBattle: (_ctx, self) => {
    prePower(self, "PAINFUL_STABS", 1);
    self.data.stabCount = 1;
  },
  moves: {
    BOOK_OF_STABBING_MULTI_STAB: {
      id: MULTI,
      intent: "attack",
      execute: (ctx, self) => {
        // hits = current stabCount, evaluated when the move executes
        attackPlayer(ctx, self, ctx.asc >= 3 ? 7 : 6, self.data.stabCount as number);
      },
    },
    BOOK_OF_STABBING_SINGLE_STAB: {
      id: SINGLE,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 3 ? 24 : 21),
    },
  },
  getMove: (ctx, self, roll) => {
    const bump = () => {
      self.data.stabCount = (self.data.stabCount as number) + 1;
    };
    if (roll < 15) {
      if (lastMove(self) === SINGLE) {
        bump();
        return MULTI;
      }
      if (ctx.asc >= 18) bump(); // adjudicated A18 rule (see header)
      return SINGLE;
    }
    if (lastTwoMovesWere(self, MULTI)) {
      if (ctx.asc >= 18) bump(); // adjudicated A18 rule (see header)
      return SINGLE;
    }
    bump();
    return MULTI;
  },
};
