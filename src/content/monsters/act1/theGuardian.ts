// The Guardian — exact port from data/corpus/monsters-act1.json (THE_GUARDIAN).
// Offensive loop: CHARGING_UP (+9 block) -> FIERCE_BASH -> VENT_STEAM ->
// WHIRLWIND -> repeat. MODE_SHIFT (prebattle 30; asc>=9: 35; asc>=19: 40) counts
// down with every HP loss; at <= 0 it is removed, 20 block is gained, and the
// intent becomes DEFENSIVE_MODE immediately (see powers/monstersAct1.ts).
// Defensive sequence: DEFENSIVE_MODE (+Sharp Hide) -> ROLL_ATTACK -> TWIN_SLAM
// (removes Sharp Hide, threshold += 10, re-gains MODE_SHIFT) -> WHIRLWIND,
// re-entering the offensive loop.
// SHARP_HIDE is owned by the act-3 workstream: applied/removed only when the
// bundle carries the power def.

import type { MonsterDef } from "../../../engine/content/defs";
import { ascTier, firstTurn, lastMove } from "../../util";
import { attackPlayer, playerPower, selfBlock, selfPower } from "./_shared";

const guardianModeShiftBase = (asc: number): number =>
  ascTier(asc, 30, [
    [9, 35],
    [19, 40],
  ]);

export const theGuardian: MonsterDef = {
  id: "THE_GUARDIAN",
  name: "The Guardian",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [250, 250] : [240, 240]),
  preBattle: (ctx, self) => {
    const d = guardianModeShiftBase(ctx.asc);
    self.data.modeShiftBase = d;
    self.powers.push({ id: "MODE_SHIFT", amount: d, justApplied: false, data: null });
  },
  moves: {
    THE_GUARDIAN_CHARGING_UP: {
      id: "THE_GUARDIAN_CHARGING_UP",
      intent: "defend",
      execute: (ctx, self) => selfBlock(ctx, self, 9),
    },
    THE_GUARDIAN_FIERCE_BASH: {
      id: "THE_GUARDIAN_FIERCE_BASH",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 36 : 32),
    },
    THE_GUARDIAN_VENT_STEAM: {
      id: "THE_GUARDIAN_VENT_STEAM",
      intent: "strongDebuff",
      execute: (ctx, self) => {
        playerPower(ctx, self, "VULNERABLE", 2);
        playerPower(ctx, self, "WEAK", 2);
      },
    },
    THE_GUARDIAN_WHIRLWIND: {
      id: "THE_GUARDIAN_WHIRLWIND",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 5, 4),
    },
    THE_GUARDIAN_DEFENSIVE_MODE: {
      id: "THE_GUARDIAN_DEFENSIVE_MODE",
      intent: "buff",
      execute: (ctx, self) => {
        // SHARP_HIDE lands with the act-3 content workstream
        if (ctx.bundle.powers.has("SHARP_HIDE")) selfPower(ctx, self, "SHARP_HIDE", ctx.asc >= 19 ? 4 : 3);
      },
    },
    THE_GUARDIAN_ROLL_ATTACK: {
      id: "THE_GUARDIAN_ROLL_ATTACK",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 10 : 9),
    },
    THE_GUARDIAN_TWIN_SLAM: {
      id: "THE_GUARDIAN_TWIN_SLAM",
      intent: "attackBuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, 8, 2);
        ctx.queue.addToBottom({ kind: "removePower", target: { kind: "monster", idx: self.idx }, powerId: "SHARP_HIDE" });
        const d = (self.data.modeShiftBase as number) + 10;
        self.data.modeShiftBase = d;
        selfPower(ctx, self, "MODE_SHIFT", d);
      },
    },
  },
  getMove: (_ctx, self) => {
    // ENGINE-GAP: the reference consumes no aiRng.random(99) after turn 1;
    // this engine's rollMove consumes one per turn (value unused).
    if (self.data.pendingModeShift) {
      // mode shift during the Guardian's own turn (thorns)
      delete self.data.pendingModeShift;
      return "THE_GUARDIAN_DEFENSIVE_MODE";
    }
    if (firstTurn(self)) return "THE_GUARDIAN_CHARGING_UP";
    switch (lastMove(self)) {
      case "THE_GUARDIAN_CHARGING_UP":
        return "THE_GUARDIAN_FIERCE_BASH";
      case "THE_GUARDIAN_FIERCE_BASH":
        return "THE_GUARDIAN_VENT_STEAM";
      case "THE_GUARDIAN_VENT_STEAM":
        return "THE_GUARDIAN_WHIRLWIND";
      case "THE_GUARDIAN_DEFENSIVE_MODE":
        return "THE_GUARDIAN_ROLL_ATTACK";
      case "THE_GUARDIAN_ROLL_ATTACK":
        return "THE_GUARDIAN_TWIN_SLAM";
      case "THE_GUARDIAN_TWIN_SLAM":
        return "THE_GUARDIAN_WHIRLWIND";
      default:
        return "THE_GUARDIAN_CHARGING_UP"; // WHIRLWIND -> offensive loop restart
    }
  },
};
