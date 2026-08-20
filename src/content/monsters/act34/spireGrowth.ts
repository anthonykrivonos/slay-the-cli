// Spire Growth — exact port from data/corpus/monsters-act34.json
// (SPIRE_GROWTH). Constrict applies the permanent CONSTRICTED debuff (the
// player takes 10 / 12 asc17 damage at the end of each of their turns); at
// asc17+ Constrict is used whenever legal, below that it needs roll >= 50.

import type { MonsterDef } from "../../../engine/content/defs";
import { lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, playerPower } from "../act1/_shared";

const QUICK_TACKLE = "SPIRE_GROWTH_QUICK_TACKLE";
const SMASH = "SPIRE_GROWTH_SMASH";
const CONSTRICT = "SPIRE_GROWTH_CONSTRICT";

export const spireGrowth: MonsterDef = {
  id: "SPIRE_GROWTH",
  name: "Spire Growth",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [190, 190] : [170, 170]),
  moves: {
    SPIRE_GROWTH_QUICK_TACKLE: {
      id: QUICK_TACKLE,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 18 : 16),
    },
    SPIRE_GROWTH_SMASH: {
      id: SMASH,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 25 : 22),
    },
    SPIRE_GROWTH_CONSTRICT: {
      id: CONSTRICT,
      intent: "strongDebuff",
      execute: (ctx, self) => playerPower(ctx, self, "CONSTRICTED", ctx.asc >= 17 ? 12 : 10),
    },
  },
  getMove: (ctx, self, roll) => {
    const constricted = ctx.combat!.player.powers.some((p) => p.id === "CONSTRICTED");
    const useConstrict =
      !constricted && lastMove(self) !== CONSTRICT && (ctx.asc >= 17 || roll >= 50);
    if (useConstrict) return CONSTRICT;
    if (roll < 50 && !lastTwoMovesWere(self, QUICK_TACKLE)) return QUICK_TACKLE;
    if (!lastTwoMovesWere(self, SMASH)) return SMASH;
    return QUICK_TACKLE;
  },
};
