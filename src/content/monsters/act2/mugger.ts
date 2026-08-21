// Mugger - exact port from data/corpus/monsters-act2.json (mirrors Looter).
// Fixed script: MUG (turn 1), MUG (turn 2), then 50/50 SMOKE_BOMB -> ESCAPE or
// LUNGE -> SMOKE_BOMB -> ESCAPE. MUG/LUNGE steal min(playerGold, THIEVERY)
// gold (15; asc>=17: 20) BEFORE the attack; the escape keeps the stolen gold,
// and killing it first refunds self.data.stolenGold (reward layer).
// CONFLICT HONORED (SMOKE_BOMB block): 11 (A17: 17) per lightspeed+wiki;
// spire-archive's 28 is bad data.
// Exact aiRng burns during moves: MUG burns aiRng.random(2) (dialog) and, on
// turn 2 only, an extra aiRng.randomBoolean(0.6); LUNGE burns aiRng.random(2).
// ENGINE-GAP: the reference consumes no aiRng.random(99) after turn 1 (the
// script is chained via setMove); this engine's rollMove consumes one per turn.

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

export const mugger: MonsterDef = {
  id: "MUGGER",
  name: "Mugger",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [50, 54] : [48, 52]),
  preBattle: (ctx, self) => prePower(self, "THIEVERY", ctx.asc >= 17 ? 20 : 15),
  moves: {
    MUGGER_MUG: {
      id: "MUGGER_MUG",
      intent: "attack",
      execute: (ctx, self) => {
        ctx.rng("aiRng").random(2); // dialog roll (consumed for parity, unused)
        if (ctx.combat!.turn === 2) ctx.rng("aiRng").randomBoolean(0.6); // extra turn-2 dialog roll
        stealGold(ctx, self);
        attackPlayer(ctx, self, ctx.asc >= 2 ? 11 : 10);
      },
    },
    MUGGER_LUNGE: {
      id: "MUGGER_LUNGE",
      intent: "attack",
      execute: (ctx, self) => {
        ctx.rng("aiRng").random(2); // dialog roll (consumed for parity, unused)
        stealGold(ctx, self);
        attackPlayer(ctx, self, ctx.asc >= 2 ? 18 : 16);
      },
    },
    MUGGER_SMOKE_BOMB: {
      id: "MUGGER_SMOKE_BOMB",
      intent: "defend",
      execute: (ctx, self) => selfBlock(ctx, self, ctx.asc >= 17 ? 17 : 11),
    },
    MUGGER_ESCAPE: {
      id: "MUGGER_ESCAPE",
      intent: "escape",
      execute: (ctx, self) => {
        ctx.queue.addToBottom({ kind: "monsterEscape", idx: self.idx });
      },
    },
  },
  getMove: (ctx, self) => {
    if (firstTurn(self)) return "MUGGER_MUG";
    switch (lastMove(self)) {
      case "MUGGER_MUG":
        if (self.moveHistory.length === 1) return "MUGGER_MUG"; // MUG again on turn 2
        return ctx.rng("aiRng").randomBoolean(0.5) ? "MUGGER_SMOKE_BOMB" : "MUGGER_LUNGE";
      case "MUGGER_LUNGE":
        return "MUGGER_SMOKE_BOMB";
      default:
        return "MUGGER_ESCAPE"; // SMOKE_BOMB -> ESCAPE
    }
  },
};
