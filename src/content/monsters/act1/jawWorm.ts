// Jaw Worm — exact port from data/corpus/monsters-act1.json (JAW_WORM).
// AI: turn 1 always Chomp (act 1); then roll d100:
//   <25 Chomp (never twice: 56.25% Bellow else Thrash)
//   <55 Thrash (never 3x: 35.7% Chomp else Bellow)
//   else Bellow (never twice: 41.6% Chomp else Thrash)

import type { MonsterDef } from "../../../engine/content/defs";
import { calcMonsterDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { ascTier, firstTurn, lastMove, lastTwoMovesWere } from "../../util";

export const jawWorm: MonsterDef = {
  id: "JAW_WORM",
  name: "Jaw Worm",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [42, 46] : [40, 44]),
  moves: {
    JAW_WORM_CHOMP: {
      id: "JAW_WORM_CHOMP",
      intent: "attack",
      execute: (ctx, self) => {
        const base = ctx.asc >= 2 ? 12 : 11;
        const dmg = calcMonsterDamage(ctx, self.idx, base);
        ctx.queue.addToBottom({
          kind: "damage",
          target: PLAYER,
          info: { type: "attack", source: monster(self.idx), amount: dmg },
        });
      },
    },
    JAW_WORM_THRASH: {
      id: "JAW_WORM_THRASH",
      intent: "attackDefend",
      execute: (ctx, self) => {
        const dmg = calcMonsterDamage(ctx, self.idx, 7);
        ctx.queue.addToBottom({
          kind: "damage",
          target: PLAYER,
          info: { type: "attack", source: monster(self.idx), amount: dmg },
        });
        ctx.queue.addToBottom({ kind: "gainBlock", target: monster(self.idx), amount: 5, fromCard: false });
      },
    },
    JAW_WORM_BELLOW: {
      id: "JAW_WORM_BELLOW",
      intent: "defendBuff",
      execute: (ctx, self) => {
        const str = ascTier(ctx.asc, 3, [
          [2, 4],
          [17, 5],
        ]);
        const block = ctx.asc >= 17 ? 9 : 6;
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: monster(self.idx),
          target: monster(self.idx),
          powerId: "STRENGTH",
          amount: str,
        });
        ctx.queue.addToBottom({ kind: "gainBlock", target: monster(self.idx), amount: block, fromCard: false });
      },
    },
  },
  getMove: (ctx, self, roll) => {
    if (firstTurn(self)) return "JAW_WORM_CHOMP";
    if (roll < 25) {
      if (lastMove(self) === "JAW_WORM_CHOMP") {
        return ctx.rng("aiRng").randomBoolean(0.5625) ? "JAW_WORM_BELLOW" : "JAW_WORM_THRASH";
      }
      return "JAW_WORM_CHOMP";
    }
    if (roll < 55) {
      if (lastTwoMovesWere(self, "JAW_WORM_THRASH")) {
        return ctx.rng("aiRng").randomBoolean(0.357) ? "JAW_WORM_CHOMP" : "JAW_WORM_BELLOW";
      }
      return "JAW_WORM_THRASH";
    }
    if (lastMove(self) === "JAW_WORM_BELLOW") {
      return ctx.rng("aiRng").randomBoolean(0.416) ? "JAW_WORM_CHOMP" : "JAW_WORM_THRASH";
    }
    return "JAW_WORM_BELLOW";
  },
};
