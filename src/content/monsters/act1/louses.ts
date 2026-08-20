// Red & Green Louse — exact ports from data/corpus/monsters-act1.json.
// Spawn: bite damage D = monsterHpRng.random(5,7) (asc>=2: 6,8), rolled once and
// stored; BITE always deals D. Prebattle: CURL_UP = monsterHpRng over [3,7]
// (asc>=7: [4,8]; asc>=17: [9,12]) — corpus specifies monsterHpRng for both.
// NOTE: the reference rolls each louse's D inside its constructor (interleaved
// hp0,D0,hp1,D1...); this engine rolls all HP first, then preBattle per slot
// (hp0,hp1,D0,CURL0,D1,CURL1) — same stream, slightly different order.
// AI (roll d100, 25% utility / 75% bite):
//   <25: GROW/SPIT_WEB unless lastMove was it and (asc>=17 or the move before was too) -> BITE
//   else: BITE unless last two were BITE -> GROW/SPIT_WEB

import type { MonsterDef, EffectCtx } from "../../../engine/content/defs";
import type { MonsterState } from "../../../engine/combat/combatState";
import { lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, playerPower, prePower, selfPower } from "./_shared";

function lousePreBattle(ctx: EffectCtx, self: MonsterState): void {
  const d = ctx.asc >= 2 ? ctx.rng("monsterHpRng").randomRange(6, 8) : ctx.rng("monsterHpRng").randomRange(5, 7);
  self.data.biteDamage = d;
  const [lo, hi] = ctx.asc >= 17 ? [9, 12] : ctx.asc >= 7 ? [4, 8] : [3, 7];
  prePower(self, "CURL_UP", ctx.rng("monsterHpRng").randomRange(lo, hi));
}

function louseGetMove(
  ctx: EffectCtx,
  self: MonsterState,
  roll: number,
  biteId: string,
  utilityId: string,
): string {
  if (roll < 25) {
    const hist = self.moveHistory;
    if (lastMove(self) === utilityId && (ctx.asc >= 17 || hist[hist.length - 2] === utilityId)) {
      return biteId;
    }
    return utilityId;
  }
  if (lastTwoMovesWere(self, biteId)) return utilityId;
  return biteId;
}

export const redLouse: MonsterDef = {
  id: "RED_LOUSE",
  name: "Red Louse",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [11, 16] : [10, 15]),
  preBattle: lousePreBattle,
  moves: {
    RED_LOUSE_BITE: {
      id: "RED_LOUSE_BITE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, self.data.biteDamage as number),
    },
    RED_LOUSE_GROW: {
      id: "RED_LOUSE_GROW",
      intent: "buff",
      execute: (ctx, self) => selfPower(ctx, self, "STRENGTH", ctx.asc >= 17 ? 4 : 3),
    },
  },
  getMove: (ctx, self, roll) => louseGetMove(ctx, self, roll, "RED_LOUSE_BITE", "RED_LOUSE_GROW"),
};

export const greenLouse: MonsterDef = {
  id: "GREEN_LOUSE",
  name: "Green Louse",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [12, 18] : [11, 17]),
  preBattle: lousePreBattle,
  moves: {
    GREEN_LOUSE_BITE: {
      id: "GREEN_LOUSE_BITE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, self.data.biteDamage as number),
    },
    GREEN_LOUSE_SPIT_WEB: {
      id: "GREEN_LOUSE_SPIT_WEB",
      intent: "debuff",
      execute: (ctx, self) => playerPower(ctx, self, "WEAK", 2),
    },
  },
  getMove: (ctx, self, roll) => louseGetMove(ctx, self, roll, "GREEN_LOUSE_BITE", "GREEN_LOUSE_SPIT_WEB"),
};
