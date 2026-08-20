// The Maw — exact port from data/corpus/monsters-act34.json (THE_MAW).
// Fixed 300 HP at every ascension (the only enemy whose max HP never scales).
// Nom hit count at execution = floor((turn+1)/2); Nom is always followed by
// a forced Drool.
// ENGINE-GAP (rng parity): the reference makes NO monsterHpRng call for the
// fixed HP; the engine's setup rolls randomRange(300,300) (one call).

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, lastMove } from "../../util";
import { attackPlayer, playerPower, selfPower } from "../act1/_shared";
import { forceNext, takeForced, turnNumber } from "./_shared";

const ROAR = "THE_MAW_ROAR";
const DROOL = "THE_MAW_DROOL";
const SLAM = "THE_MAW_SLAM";
const NOM = "THE_MAW_NOM";

export const theMaw: MonsterDef = {
  id: "THE_MAW",
  name: "The Maw",
  category: "normal",
  hp: () => [300, 300],
  moves: {
    THE_MAW_ROAR: {
      id: ROAR,
      intent: "strongDebuff",
      execute: (ctx, self) => {
        const n = ctx.asc >= 17 ? 5 : 3;
        playerPower(ctx, self, "WEAK", n);
        playerPower(ctx, self, "FRAIL", n);
      },
    },
    THE_MAW_DROOL: {
      id: DROOL,
      intent: "buff",
      execute: (ctx, self) => selfPower(ctx, self, "STRENGTH", ctx.asc >= 17 ? 5 : 3),
    },
    THE_MAW_SLAM: {
      id: SLAM,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 30 : 25),
    },
    THE_MAW_NOM: {
      id: NOM,
      intent: "attack",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, 5, Math.floor((turnNumber(ctx) + 1) / 2));
        forceNext(self, DROOL); // hard-coded: Nom is always followed by Drool
      },
    },
  },
  getMove: (_ctx, self, roll) => {
    const forced = takeForced(self);
    if (forced) return forced;
    if (firstTurn(self)) return ROAR;
    if (roll < 50 && lastMove(self) !== NOM) return NOM;
    if (lastMove(self) !== SLAM) return SLAM;
    return DROOL;
  },
};
