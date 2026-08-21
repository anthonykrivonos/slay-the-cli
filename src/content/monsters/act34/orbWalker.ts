// Orb Walker - exact port from data/corpus/monsters-act34.json (ORB_WALKER).
// ENGINE-GAP (rng parity): the reference's initHp consumes and DISCARDS one
// extra monsterHpRng.random(90,96) before the real HP roll; the engine's
// combat setup rolls HP once per monster, so the monsterHpRng stream diverges
// from the reference in this fight.

import type { MonsterDef } from "../../../engine/content/defs";
import { lastTwoMovesWere } from "../../util";
import { attackPlayer, prePower } from "../act1/_shared";
import { statusCardsNow } from "./_shared";

const LASER = "ORB_WALKER_LASER";
const CLAW = "ORB_WALKER_CLAW";

export const orbWalker: MonsterDef = {
  id: "ORB_WALKER",
  name: "Orb Walker",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [92, 102] : [90, 96]),
  // STRENGTH_UP = the corpus's GENERIC_STRENGTH_UP prebattle power (the
  // persistent Strength Up; see powers/monstersAct34.ts for the id note)
  preBattle: (ctx, self) => prePower(self, "STRENGTH_UP", ctx.asc >= 17 ? 5 : 3),
  moves: {
    ORB_WALKER_LASER: {
      id: LASER,
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 11 : 10);
        statusCardsNow(ctx, "BURN", 1, "draw");
        statusCardsNow(ctx, "BURN", 1, "discard");
      },
    },
    ORB_WALKER_CLAW: {
      id: CLAW,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 16 : 15),
    },
  },
  getMove: (_ctx, self, roll) => {
    if (roll < 40) return lastTwoMovesWere(self, CLAW) ? LASER : CLAW;
    return lastTwoMovesWere(self, LASER) ? CLAW : LASER;
  },
};
