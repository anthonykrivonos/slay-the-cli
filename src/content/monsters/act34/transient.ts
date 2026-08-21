// Transient - exact port from data/corpus/monsters-act34.json (TRANSIENT).
// Fixed 999 HP at all ascensions. Attack = (asc2? 40 : 30) + 10 per elapsed
// turn. FADING 5 (asc17: 6) counts down via the engine's end-of-round tick;
// on the turn FADING shows 1 it attacks and then fades away - modeled as a
// monsterEscape (no on-death triggers fire, the player still wins if it was
// alone), exactly like the reference's Suicide(triggerRelics=false).
// ENGINE-GAP (rng parity): the reference makes NO monsterHpRng call for the
// fixed 999 HP; the engine's setup rolls randomRange(999,999) (one call).

import type { MonsterDef } from "../../../engine/content/defs";
import { attackPlayer, powerAmount, prePower } from "../act1/_shared";
import { turnNumber } from "./_shared";

export const transient: MonsterDef = {
  id: "TRANSIENT",
  name: "Transient",
  category: "normal",
  hp: () => [999, 999],
  preBattle: (ctx, self) => {
    prePower(self, "SHIFTING", 1);
    prePower(self, "FADING", ctx.asc >= 17 ? 6 : 5);
  },
  moves: {
    TRANSIENT_ATTACK: {
      id: "TRANSIENT_ATTACK",
      intent: "attack",
      execute: (ctx, self) => {
        const base = (ctx.asc >= 2 ? 40 : 30) + 10 * (turnNumber(ctx) - 1);
        attackPlayer(ctx, self, base);
        if (powerAmount(self, "FADING") === 1) {
          ctx.queue.addToBottom({ kind: "monsterEscape", idx: self.idx });
        }
      },
    },
  },
  // roll consumed every turn, value unused (only move)
  getMove: () => "TRANSIENT_ATTACK",
};
