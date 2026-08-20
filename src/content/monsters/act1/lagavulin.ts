// Lagavulin — exact port from data/corpus/monsters-act1.json (LAGAVULIN).
// Standard (asleep) spawn: ASLEEP + METALLICIZE 8 + 8 starting block. Sleeps
// turns 1-3; wakes early on any HP loss (ASLEEP power hook); the already-queued
// SLEEP still executes that turn. Awake cycle: ATTACK, ATTACK, SIPHON_SOUL.
// CONFLICT HONORED (wiki/real game over lightspeed): Metallicize is removed
// (-8) on BOTH wake paths — the natural turn-3 wake clears ASLEEP and
// Metallicize too (lightspeed only did so on a damage wake).
// The Dead Adventurer event variant spawns it awake without the prebattle
// buffs, opening on SIPHON_SOUL (handled: no ASLEEP -> first roll is SIPHON).

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, hasPower, playerPower, prePower } from "./_shared";

export const lagavulin: MonsterDef = {
  id: "LAGAVULIN",
  name: "Lagavulin",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [112, 115] : [109, 111]),
  preBattle: (_ctx, self) => {
    prePower(self, "ASLEEP", 1);
    prePower(self, "METALLICIZE", 8);
    self.block = 8;
  },
  moves: {
    LAGAVULIN_SLEEP: {
      id: "LAGAVULIN_SLEEP",
      intent: "sleep",
      execute: (ctx, self) => {
        // Natural wake at the end of game turn 3: ASLEEP and Metallicize gone.
        // Removed synchronously (not queued): rollMove runs right after execute
        // and must see the woken state; it also precedes the atEndOfTurn hook,
        // so no Metallicize block is gained on the wake turn.
        if (ctx.combat!.turn >= 3 && hasPower(self, "ASLEEP")) {
          self.powers = self.powers.filter((p) => p.id !== "ASLEEP");
          const met = self.powers.find((p) => p.id === "METALLICIZE");
          if (met) {
            met.amount -= 8;
            if (met.amount <= 0) self.powers = self.powers.filter((p) => p.id !== "METALLICIZE");
          }
        }
      },
    },
    LAGAVULIN_ATTACK: {
      id: "LAGAVULIN_ATTACK",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 3 ? 20 : 18),
    },
    LAGAVULIN_SIPHON_SOUL: {
      id: "LAGAVULIN_SIPHON_SOUL",
      intent: "strongDebuff",
      execute: (ctx, self) => {
        const amount = ctx.asc >= 18 ? -2 : -1;
        playerPower(ctx, self, "DEXTERITY", amount);
        playerPower(ctx, self, "STRENGTH", amount);
      },
    },
  },
  getMove: (_ctx, self) => {
    // one aiRng.random(99) per turn is consumed (unused), matching the reference
    if (firstTurn(self)) return hasPower(self, "ASLEEP") ? "LAGAVULIN_SLEEP" : "LAGAVULIN_SIPHON_SOUL";
    switch (lastMove(self)) {
      case "LAGAVULIN_SLEEP":
        // wake conditions were resolved during/before the SLEEP execution:
        // ASLEEP already removed -> attack next turn; otherwise keep sleeping.
        return hasPower(self, "ASLEEP") ? "LAGAVULIN_SLEEP" : "LAGAVULIN_ATTACK";
      case "LAGAVULIN_ATTACK":
        return lastTwoMovesWere(self, "LAGAVULIN_ATTACK") ? "LAGAVULIN_SIPHON_SOUL" : "LAGAVULIN_ATTACK";
      default:
        return "LAGAVULIN_ATTACK"; // SIPHON_SOUL is always followed by ATTACK
    }
  },
};
