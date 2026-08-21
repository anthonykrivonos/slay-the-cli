// Snecko - exact port from data/corpus/monsters-act2.json.
// Turn 1 always PERPLEXING_GLARE (applies CONFUSED - the shared def in
// relics/supportPowers.ts: every drawn card's cost is randomized 0-3, roll
// always consumed - the only source of Confused in the game). GLARE is never
// selected again. Then per roll: BITE 60% (never 3x), TAIL_WHIP 40%.

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, lastTwoMovesWere } from "../../util";
import { attackPlayer, playerPower } from "./_shared";

export const snecko: MonsterDef = {
  id: "SNECKO",
  name: "Snecko",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [120, 125] : [114, 120]),
  moves: {
    SNECKO_PERPLEXING_GLARE: {
      id: "SNECKO_PERPLEXING_GLARE",
      intent: "strongDebuff",
      execute: (ctx, self) => playerPower(ctx, self, "CONFUSED", 1),
    },
    SNECKO_BITE: {
      id: "SNECKO_BITE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 18 : 15),
    },
    SNECKO_TAIL_WHIP: {
      id: "SNECKO_TAIL_WHIP",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 10 : 8);
        playerPower(ctx, self, "VULNERABLE", 2);
        if (ctx.asc >= 17) playerPower(ctx, self, "WEAK", 2);
      },
    },
  },
  getMove: (_ctx, self, roll) => {
    if (firstTurn(self)) return "SNECKO_PERPLEXING_GLARE";
    if (roll < 40 || lastTwoMovesWere(self, "SNECKO_BITE")) return "SNECKO_TAIL_WHIP";
    return "SNECKO_BITE";
  },
};
