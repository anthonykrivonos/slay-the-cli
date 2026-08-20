// Hexaghost — exact port from data/corpus/monsters-act1.json (HEXAGHOST).
// Turn 1 ACTIVATE (sets dividerDamage = floor(playerHP/12) + 1), turn 2 DIVIDER
// (dividerDamage x6), then the fixed repeating 7-move loop
// [SEAR, TACKLE, SEAR, INFLAME, TACKLE, SEAR, INFERNO] driven by counter seq.
// No randomness in move selection (one aiRng.random(99) per turn is consumed,
// unused — matching the reference).
// CONFLICT (kept lightspeed, per corpus transcription): INFERNO only attacks;
// Sear Burns are created upgraded from game turn 10 onward (exactly every SEAR
// after the first INFERNO). The real game additionally adds 3 Burn+ on Inferno
// and retro-upgrades existing Burns — omitted here as in the transcription.

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, lastMove } from "../../util";
import { addStatusCards, attackPlayer, selfBlock, selfPower } from "./_shared";

export const hexaghost: MonsterDef = {
  id: "HEXAGHOST",
  name: "Hexaghost",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [264, 264] : [250, 250]),
  moves: {
    HEXAGHOST_ACTIVATE: {
      id: "HEXAGHOST_ACTIVATE",
      intent: "unknown",
      execute: (ctx, self) => {
        self.data.dividerDamage = Math.floor(ctx.run.hp / 12) + 1;
      },
    },
    HEXAGHOST_DIVIDER: {
      id: "HEXAGHOST_DIVIDER",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, self.data.dividerDamage as number, 6),
    },
    HEXAGHOST_SEAR: {
      id: "HEXAGHOST_SEAR",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, 6);
        // Burns are created upgraded from game turn 10 onward
        addStatusCards(ctx, "BURN", ctx.asc >= 19 ? 2 : 1, ctx.combat!.turn >= 10 ? 1 : 0);
      },
    },
    HEXAGHOST_TACKLE: {
      id: "HEXAGHOST_TACKLE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 6 : 5, 2),
    },
    HEXAGHOST_INFLAME: {
      id: "HEXAGHOST_INFLAME",
      intent: "defendBuff",
      execute: (ctx, self) => {
        selfBlock(ctx, self, 12);
        selfPower(ctx, self, "STRENGTH", ctx.asc >= 19 ? 3 : 2);
      },
    },
    HEXAGHOST_INFERNO: {
      id: "HEXAGHOST_INFERNO",
      intent: "attackDebuff",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 3 : 2, 6),
    },
  },
  getMove: (_ctx, self) => {
    if (firstTurn(self)) return "HEXAGHOST_ACTIVATE";
    switch (lastMove(self)) {
      case "HEXAGHOST_ACTIVATE":
        return "HEXAGHOST_DIVIDER";
      case "HEXAGHOST_DIVIDER":
        self.data.seq = 0;
        return "HEXAGHOST_SEAR";
      case "HEXAGHOST_SEAR": {
        const seq = self.data.seq as number;
        self.data.seq = seq + 1;
        if (seq === 0) return "HEXAGHOST_TACKLE";
        if (seq === 2) return "HEXAGHOST_INFLAME";
        return "HEXAGHOST_INFERNO";
      }
      case "HEXAGHOST_TACKLE":
        self.data.seq = (self.data.seq as number) + 1;
        return "HEXAGHOST_SEAR";
      case "HEXAGHOST_INFLAME":
        self.data.seq = (self.data.seq as number) + 1;
        return "HEXAGHOST_TACKLE";
      default: {
        // INFERNO: seq resets, loop restarts at SEAR
        self.data.seq = 0;
        return "HEXAGHOST_SEAR";
      }
    }
  },
};
