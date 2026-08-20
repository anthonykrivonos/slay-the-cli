// Taskmaster — exact port from data/corpus/monsters-act2.json (elite; middle
// monster of the SLAVERS encounter, also The Colosseum).
// SCOURING_WHIP every turn: attack 7 (never asc-scaled), then Wounds into the
// discard pile — 1 base / 2 from asc>=3 / 3 (+1 self Strength first) at asc>=18.
// CONFLICT HONORED (wound tier): the 2-Wound tier starts at asc >= 3
// (lightspeed elite damage-tier; the wiki data module is internally
// inconsistent between A2 and A3).
// ENGINE-GAP (hp quirk): the reference's initHp burns one extra
// monsterHpRng.random(54,60) BEFORE its real HP roll; this engine rolls all
// encounter HP up front, so the parity burn happens in preBattle (after the
// encounter's HP rolls) — total stream consumption matches, exact interleaving
// inside the encounter does not.

import type { MonsterDef } from "../../../engine/content/defs";
import { addStatusCards, attackPlayer, selfPower } from "./_shared";

export const taskmaster: MonsterDef = {
  id: "TASKMASTER",
  name: "Taskmaster",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [57, 64] : [54, 60]),
  preBattle: (ctx, _self) => {
    ctx.rng("monsterHpRng").randomRange(54, 60); // parity burn (see header)
  },
  moves: {
    TASKMASTER_SCOURING_WHIP: {
      id: "TASKMASTER_SCOURING_WHIP",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, 7);
        if (ctx.asc >= 18) {
          selfPower(ctx, self, "STRENGTH", 1);
          addStatusCards(ctx, "WOUND", 3);
        } else if (ctx.asc >= 3) {
          addStatusCards(ctx, "WOUND", 2);
        } else {
          addStatusCards(ctx, "WOUND", 1);
        }
      },
    },
  },
  getMove: () => "TASKMASTER_SCOURING_WHIP", // roll consumed but ignored, every turn
};
