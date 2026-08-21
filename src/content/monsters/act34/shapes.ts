// The three act-3 Shapes - exact ports from data/corpus/monsters-act34.json
// (SPIKER, REPULSOR, EXPLODER). All are category "normal" per the corpus
// conflict resolutions (spire-archive mislabels them Elite).

import type { MonsterDef } from "../../../engine/content/defs";
import { ascTier, lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, prePower, selfPower } from "../act1/_shared";
import { nonAttackDamage, statusCardsNow, suicide } from "./_shared";

// ---------------------------------------------------------------------------
// Spiker
// ---------------------------------------------------------------------------

export const spiker: MonsterDef = {
  id: "SPIKER",
  name: "Spiker",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [44, 60] : [42, 56]),
  preBattle: (ctx, self) =>
    prePower(
      self,
      "THORNS",
      ascTier(ctx.asc, 3, [
        [2, 4],
        [17, 7],
      ]),
    ),
  moves: {
    SPIKER_CUT: {
      id: "SPIKER_CUT",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 9 : 7),
    },
    SPIKER_SPIKE: {
      id: "SPIKER_SPIKE",
      intent: "buff",
      execute: (ctx, self) => {
        self.data.spikes = ((self.data.spikes as number) ?? 0) + 1;
        selfPower(ctx, self, "THORNS", 2);
      },
    },
  },
  getMove: (_ctx, self, roll) => {
    // miscInfo counts Spike uses: at most 6, then Cut every turn
    const spikes = (self.data.spikes as number) ?? 0;
    if (spikes > 5 || (roll < 50 && lastMove(self) !== "SPIKER_CUT")) return "SPIKER_CUT";
    return "SPIKER_SPIKE";
  },
};

// ---------------------------------------------------------------------------
// Repulsor
// ---------------------------------------------------------------------------

export const repulsor: MonsterDef = {
  id: "REPULSOR",
  name: "Repulsor",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [31, 38] : [29, 35]),
  moves: {
    REPULSOR_BASH: {
      id: "REPULSOR_BASH",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 13 : 11),
    },
    REPULSOR_REPULSE: {
      id: "REPULSOR_REPULSE",
      intent: "debuff",
      // shuffles 2 Dazed into the draw pile immediately (not queued)
      execute: (ctx) => statusCardsNow(ctx, "DAZED", 2, "draw"),
    },
  },
  getMove: (_ctx, self, roll) =>
    roll < 20 && lastMove(self) !== "REPULSOR_BASH" ? "REPULSOR_BASH" : "REPULSOR_REPULSE",
};

// ---------------------------------------------------------------------------
// Exploder - fixed Slam, Slam, Explode. The explosion is 30 non-attack
// damage (blockable, unmodified) followed by a real suicide (on-death
// triggers fire). EXPLOSIVE 3 is the countdown display.
// ---------------------------------------------------------------------------

export const exploder: MonsterDef = {
  id: "EXPLODER",
  name: "Exploder",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [30, 35] : [30, 30]),
  preBattle: (_ctx, self) => prePower(self, "EXPLOSIVE", 3),
  moves: {
    EXPLODER_SLAM: {
      id: "EXPLODER_SLAM",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 11 : 9),
    },
    EXPLODER_EXPLODE: {
      id: "EXPLODER_EXPLODE",
      intent: "unknown",
      execute: (ctx, self) => {
        nonAttackDamage(ctx, self.idx, 30);
        suicide(ctx, self);
      },
    },
  },
  getMove: (_ctx, self, _roll) => {
    // roll consumed every turn, value unused (fixed pattern)
    if (lastTwoMovesWere(self, "EXPLODER_SLAM")) return "EXPLODER_EXPLODE";
    return "EXPLODER_SLAM";
  },
};
