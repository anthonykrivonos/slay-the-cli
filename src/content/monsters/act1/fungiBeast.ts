// Fungi Beast - exact port from data/corpus/monsters-act1.json (FUNGI_BEAST).
// AI: roll d100 - <60 BITE (never 3x in a row), else GROW (never twice in a row).
// SPORE_CLOUD 2 (prebattle, always 2): on death applies 2 VULNERABLE to the
// player, even when killed during the monster turn.

import type { MonsterDef } from "../../../engine/content/defs";
import { ascTier, lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, playerPower, powerAmount, prePower, selfPower } from "./_shared";

export const fungiBeast: MonsterDef = {
  id: "FUNGI_BEAST",
  name: "Fungi Beast",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [24, 28] : [22, 28]),
  preBattle: (_ctx, self) => prePower(self, "SPORE_CLOUD", 2),
  moves: {
    FUNGI_BEAST_BITE: {
      id: "FUNGI_BEAST_BITE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 6),
    },
    FUNGI_BEAST_GROW: {
      id: "FUNGI_BEAST_GROW",
      intent: "buff",
      execute: (ctx, self) =>
        selfPower(
          ctx,
          self,
          "STRENGTH",
          ascTier(ctx.asc, 3, [
            [2, 4],
            [17, 5],
          ]),
        ),
    },
  },
  getMove: (_ctx, self, roll) => {
    if (roll < 60) {
      if (lastTwoMovesWere(self, "FUNGI_BEAST_BITE")) return "FUNGI_BEAST_GROW";
      return "FUNGI_BEAST_BITE";
    }
    if (lastMove(self) === "FUNGI_BEAST_GROW") return "FUNGI_BEAST_BITE";
    return "FUNGI_BEAST_GROW";
  },
  onDeath: (ctx, self) => {
    const amount = powerAmount(self, "SPORE_CLOUD");
    if (amount > 0) playerPower(ctx, self, "VULNERABLE", amount);
  },
};
