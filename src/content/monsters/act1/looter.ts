// Looter — exact port from data/corpus/monsters-act1.json (LOOTER).
// Turn 1+2: MUG. Turn 3: 50/50 LUNGE or SMOKE_BOMB. LUNGE -> SMOKE_BOMB -> ESCAPE.
// MUG/LUNGE steal min(playerGold, THIEVERY) gold (15; asc>=17: 20). Escape keeps
// the stolen gold; if killed first the reward layer refunds self.data.stolenGold.

import type { MonsterDef, EffectCtx } from "../../../engine/content/defs";
import type { MonsterState } from "../../../engine/combat/combatState";
import { firstTurn, lastMove } from "../../util";
import { attackPlayer, powerAmount, prePower, selfBlock } from "./_shared";

function stealGold(ctx: EffectCtx, self: MonsterState): void {
  const stolen = Math.min(ctx.run.gold, powerAmount(self, "THIEVERY"));
  if (stolen <= 0) return;
  ctx.run.gold -= stolen;
  self.data.stolenGold = ((self.data.stolenGold as number) ?? 0) + stolen;
  ctx.emit("goldStolen", { idx: self.idx, amount: stolen });
}

export const looter: MonsterDef = {
  id: "LOOTER",
  name: "Looter",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [46, 50] : [44, 48]),
  preBattle: (ctx, self) => prePower(self, "THIEVERY", ctx.asc >= 17 ? 20 : 15),
  moves: {
    LOOTER_MUG: {
      id: "LOOTER_MUG",
      intent: "attack",
      execute: (ctx, self) => {
        // turn-1 in-game dialog roll (consumed for aiRng parity, value unused)
        if (ctx.combat!.turn === 1) ctx.rng("aiRng").randomBoolean(0.6);
        stealGold(ctx, self);
        attackPlayer(ctx, self, ctx.asc >= 2 ? 11 : 10);
      },
    },
    LOOTER_LUNGE: {
      id: "LOOTER_LUNGE",
      intent: "attack",
      execute: (ctx, self) => {
        stealGold(ctx, self);
        attackPlayer(ctx, self, ctx.asc >= 2 ? 14 : 12);
      },
    },
    LOOTER_SMOKE_BOMB: {
      id: "LOOTER_SMOKE_BOMB",
      intent: "defend",
      execute: (ctx, self) => selfBlock(ctx, self, 6),
    },
    LOOTER_ESCAPE: {
      id: "LOOTER_ESCAPE",
      intent: "escape",
      execute: (ctx, self) => {
        ctx.queue.addToBottom({ kind: "monsterEscape", idx: self.idx });
      },
    },
  },
  getMove: (ctx, self) => {
    // ENGINE-GAP: the reference consumes no aiRng.random(99) after turn 1;
    // this engine's rollMove consumes one per turn (value unused).
    if (firstTurn(self)) return "LOOTER_MUG";
    switch (lastMove(self)) {
      case "LOOTER_MUG":
        if (self.moveHistory.length === 1) return "LOOTER_MUG"; // MUG again on turn 2
        return ctx.rng("aiRng").randomBoolean(0.5) ? "LOOTER_SMOKE_BOMB" : "LOOTER_LUNGE";
      case "LOOTER_LUNGE":
        return "LOOTER_SMOKE_BOMB";
      default:
        return "LOOTER_ESCAPE"; // SMOKE_BOMB -> ESCAPE (never rolls again once escaped)
    }
  },
};
