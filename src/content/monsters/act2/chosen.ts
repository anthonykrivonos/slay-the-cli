// Chosen — exact port from data/corpus/monsters-act2.json.
// A<17: turn 1 POKE, turn 2 HEX, then strict alternation of a debuff turn
// (DEBILITATE 50% / DRAIN 50%) and an attack turn (ZAP 40% / POKE 60%).
// A17+: turn 1 HEX, then the same alternation starting with a debuff turn.
// HEX (powers/monstersAct2.ts): each non-Attack card played shuffles a Dazed
// into the draw pile. DRAIN buffs self Strength 3 during the turn.

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, lastMove } from "../../util";
import { attackPlayer, playerPower, selfPower } from "./_shared";

export const chosen: MonsterDef = {
  id: "CHOSEN",
  name: "Chosen",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [98, 103] : [95, 99]),
  moves: {
    CHOSEN_POKE: {
      id: "CHOSEN_POKE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 6 : 5, 2),
    },
    CHOSEN_ZAP: {
      id: "CHOSEN_ZAP",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 21 : 18),
    },
    CHOSEN_DEBILITATE: {
      id: "CHOSEN_DEBILITATE",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 12 : 10);
        playerPower(ctx, self, "VULNERABLE", 2);
      },
    },
    CHOSEN_DRAIN: {
      id: "CHOSEN_DRAIN",
      intent: "debuff",
      execute: (ctx, self) => {
        playerPower(ctx, self, "WEAK", 3);
        selfPower(ctx, self, "STRENGTH", 3);
      },
    },
    CHOSEN_HEX: {
      id: "CHOSEN_HEX",
      intent: "strongDebuff",
      execute: (ctx, self) => playerPower(ctx, self, "HEX", 1),
    },
  },
  getMove: (ctx, self, roll) => {
    const last = lastMove(self);
    const afterDebuff = last === "CHOSEN_DEBILITATE" || last === "CHOSEN_DRAIN";
    if (ctx.asc >= 17) {
      if (firstTurn(self)) return "CHOSEN_HEX";
      if (!afterDebuff) return roll < 50 ? "CHOSEN_DEBILITATE" : "CHOSEN_DRAIN";
      return roll < 40 ? "CHOSEN_ZAP" : "CHOSEN_POKE";
    }
    if (firstTurn(self)) return "CHOSEN_POKE";
    if (self.moveHistory.length === 1) return "CHOSEN_HEX"; // exactly one move taken: turn 2
    if (!afterDebuff) return roll < 50 ? "CHOSEN_DEBILITATE" : "CHOSEN_DRAIN";
    return roll < 40 ? "CHOSEN_ZAP" : "CHOSEN_POKE";
  },
};
