// Spheric Guardian - exact port from data/corpus/monsters-act2.json.
// Prebattle: ARTIFACT 3, BARRICADE (block never expires), 40 block.
// Fixed script: ACTIVATE (+25 block; asc>=17: +35), ATTACK_DEBUFF (10 + Frail 5),
// then SLAM (10x2), HARDEN (+15 block, 10), SLAM, HARDEN, ... forever. A2: 11s.
// CONFLICT HONORED (ACTIVATE block): 25 (A17: 35) per lightspeed+wiki;
// spire-archive's 95 is bad data.
// CONFLICT HONORED (hp.asc): fixed 20/20 at every ascension (not a real
// disagreement - the game never raises its HP).
// ENGINE-GAP: the reference's initHp consumes NO monsterHpRng roll for the
// fixed 20 HP; this engine's combat setup rolls randomRange(20,20) (one call,
// value forced). One aiRng.random(99) per turn matches the reference exactly
// (initial rollMove, then a noOpRollMove each turn).

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, lastMove } from "../../util";
import { attackPlayer, playerPower, prePower, selfBlock } from "./_shared";

export const sphericGuardian: MonsterDef = {
  id: "SPHERIC_GUARDIAN",
  name: "Spheric Guardian",
  category: "normal",
  hp: () => [20, 20],
  preBattle: (_ctx, self) => {
    prePower(self, "ARTIFACT", 3);
    prePower(self, "BARRICADE", 1);
    self.block += 40;
  },
  moves: {
    SPHERIC_GUARDIAN_ACTIVATE: {
      id: "SPHERIC_GUARDIAN_ACTIVATE",
      intent: "defend",
      execute: (ctx, self) => selfBlock(ctx, self, ctx.asc >= 17 ? 35 : 25),
    },
    SPHERIC_GUARDIAN_ATTACK_DEBUFF: {
      id: "SPHERIC_GUARDIAN_ATTACK_DEBUFF",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 11 : 10);
        playerPower(ctx, self, "FRAIL", 5);
      },
    },
    SPHERIC_GUARDIAN_SLAM: {
      id: "SPHERIC_GUARDIAN_SLAM",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 11 : 10, 2),
    },
    SPHERIC_GUARDIAN_HARDEN: {
      id: "SPHERIC_GUARDIAN_HARDEN",
      intent: "attackDefend",
      execute: (ctx, self) => {
        selfBlock(ctx, self, 15);
        attackPlayer(ctx, self, ctx.asc >= 2 ? 11 : 10);
      },
    },
  },
  getMove: (_ctx, self) => {
    if (firstTurn(self)) return "SPHERIC_GUARDIAN_ACTIVATE";
    switch (lastMove(self)) {
      case "SPHERIC_GUARDIAN_ACTIVATE":
        return "SPHERIC_GUARDIAN_ATTACK_DEBUFF";
      case "SPHERIC_GUARDIAN_HARDEN":
        return "SPHERIC_GUARDIAN_SLAM";
      default:
        return lastMove(self) === "SPHERIC_GUARDIAN_SLAM"
          ? "SPHERIC_GUARDIAN_HARDEN"
          : "SPHERIC_GUARDIAN_SLAM"; // ATTACK_DEBUFF -> SLAM
    }
  },
};
