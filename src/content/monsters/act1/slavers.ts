// Blue & Red Slaver - exact ports from data/corpus/monsters-act1.json.
// CONFLICTS HONORED (wiki/real game over lightspeed):
//  - Blue Slaver asc>=17: RAKE never twice in a row (lightspeed's OR-flattened
//    expression made the asc17 clause dead code).
//  - Red Slaver: usedEntangle IS set when Entangle is used (once per combat;
//    lightspeed never writes the flag).
//  - Red Slaver asc>=17: SCRAPE never twice in a row (same OR-flattening bug).
// UNRESOLVED CONFLICT (kept lightspeed): post-entangle STAB branch threshold is
// roll >= 50 (the wiki prose says 55%, i.e. roll >= 45; unresolvable without
// the game jar - corpus does not adjudicate, so the transcribed 50 stands).

import type { MonsterDef } from "../../../engine/content/defs";
import { lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, playerPower } from "./_shared";

export const blueSlaver: MonsterDef = {
  id: "BLUE_SLAVER",
  name: "Blue Slaver",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [48, 52] : [46, 50]),
  moves: {
    BLUE_SLAVER_STAB: {
      id: "BLUE_SLAVER_STAB",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 13 : 12),
    },
    BLUE_SLAVER_RAKE: {
      id: "BLUE_SLAVER_RAKE",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 8 : 7);
        playerPower(ctx, self, "WEAK", ctx.asc >= 17 ? 2 : 1);
      },
    },
  },
  getMove: (ctx, self, roll) => {
    if (roll >= 40 && !lastTwoMovesWere(self, "BLUE_SLAVER_STAB")) return "BLUE_SLAVER_STAB";
    const rakeAllowed =
      ctx.asc >= 17 ? lastMove(self) !== "BLUE_SLAVER_RAKE" : !lastTwoMovesWere(self, "BLUE_SLAVER_RAKE");
    if (rakeAllowed) return "BLUE_SLAVER_RAKE";
    return "BLUE_SLAVER_STAB";
  },
};

export const redSlaver: MonsterDef = {
  id: "RED_SLAVER",
  name: "Red Slaver",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [48, 52] : [46, 50]),
  moves: {
    RED_SLAVER_STAB: {
      id: "RED_SLAVER_STAB",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 14 : 13),
    },
    RED_SLAVER_SCRAPE: {
      id: "RED_SLAVER_SCRAPE",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 9 : 8);
        playerPower(ctx, self, "VULNERABLE", ctx.asc >= 17 ? 2 : 1);
      },
    },
    RED_SLAVER_ENTANGLE: {
      id: "RED_SLAVER_ENTANGLE",
      intent: "strongDebuff",
      execute: (ctx, self) => {
        self.data.usedEntangle = true;
        playerPower(ctx, self, "ENTANGLED", 1);
      },
    },
  },
  getMove: (ctx, self, roll) => {
    if (self.moveHistory.length === 0) return "RED_SLAVER_STAB";
    const usedEntangle = self.data.usedEntangle === true;
    if (roll >= 75 && !usedEntangle) return "RED_SLAVER_ENTANGLE";
    if (roll >= 50 && usedEntangle && !lastTwoMovesWere(self, "RED_SLAVER_STAB")) return "RED_SLAVER_STAB";
    const scrapeAllowed =
      ctx.asc >= 17 ? lastMove(self) !== "RED_SLAVER_SCRAPE" : !lastTwoMovesWere(self, "RED_SLAVER_SCRAPE");
    if (scrapeAllowed) return "RED_SLAVER_SCRAPE";
    return "RED_SLAVER_STAB";
  },
};
