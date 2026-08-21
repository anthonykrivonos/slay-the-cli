// Shelled Parasite - exact port from data/corpus/monsters-act2.json.
// Prebattle: PLATED_ARMOR 14 (shared def: 14 block at the end of each of its
// turns, -1 per unblocked attack hit) + 14 starting block (covers turn 1), and
// the armor-break stun marker (see powers/monstersAct2.ts): the hit that
// empties the armor replaces the current move with STUNNED - at most once per
// combat, since Plated Armor never returns.
// AI: first turn A<17 aiRng.randomBoolean() -> DOUBLE_STRIKE / SUCK (never
// FELL); A17+ always FELL. Then per roll FELL 20% (never twice in a row; a
// blocked FELL burns aiRng.random(20,99) - the reference compares roll, not
// the reroll, so the fallthrough always lands in the DOUBLE_STRIKE branch),
// DOUBLE_STRIKE 40% (never 3x), SUCK 40% (never 3x).
// The reference's stun turn rewrites its own history entry to FELL before
// rerolling, so FELL can never be rolled directly after a stun.
// SUCK is a vampire attack: heals the unblocked damage dealt (one-shot
// HEAL_FOR_UNBLOCKED_DAMAGE marker around the hit).

import type { MonsterDef } from "../../../engine/content/defs";
import { calcMonsterDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { firstTurn, lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, playerPower, prePower } from "./_shared";

const FELL = "SHELLED_PARASITE_FELL";
const DOUBLE_STRIKE = "SHELLED_PARASITE_DOUBLE_STRIKE";
const SUCK = "SHELLED_PARASITE_SUCK";
const STUNNED = "SHELLED_PARASITE_STUNNED";

export const shelledParasite: MonsterDef = {
  id: "SHELLED_PARASITE",
  name: "Shelled Parasite",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [70, 75] : [68, 72]),
  preBattle: (_ctx, self) => {
    prePower(self, "PLATED_ARMOR", 14);
    prePower(self, "PLATED_ARMOR_BREAK_STUN", 1);
    self.block += 14;
  },
  moves: {
    SHELLED_PARASITE_FELL: {
      id: FELL,
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 21 : 18);
        playerPower(ctx, self, "FRAIL", 2);
      },
    },
    SHELLED_PARASITE_DOUBLE_STRIKE: {
      id: DOUBLE_STRIKE,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 7 : 6, 2),
    },
    SHELLED_PARASITE_SUCK: {
      id: SUCK,
      intent: "attackBuff",
      execute: (ctx, self) => {
        const dmg = calcMonsterDamage(ctx, self.idx, ctx.asc >= 2 ? 12 : 10);
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: monster(self.idx),
          target: monster(self.idx),
          powerId: "HEAL_FOR_UNBLOCKED_DAMAGE",
          amount: 1,
        });
        ctx.queue.addToBottom({
          kind: "damage",
          target: PLAYER,
          info: { type: "attack", source: monster(self.idx), amount: dmg },
        });
        ctx.queue.addToBottom({
          kind: "removePower",
          target: monster(self.idx),
          powerId: "HEAL_FOR_UNBLOCKED_DAMAGE",
        });
      },
    },
    SHELLED_PARASITE_STUNNED: {
      id: STUNNED,
      intent: "stun",
      execute: () => {}, // loses the turn; history handling lives in getMove
    },
  },
  getMove: (ctx, self, roll) => {
    if (self.data.pendingStun) {
      // armor broke during its own turn (thorns): stun lands next turn
      delete self.data.pendingStun;
      return STUNNED;
    }
    if (firstTurn(self)) {
      if (ctx.asc >= 17) return FELL;
      return ctx.rng("aiRng").randomBoolean() ? DOUBLE_STRIKE : SUCK;
    }
    const last = lastMove(self) === STUNNED ? FELL : lastMove(self);
    let roll2 = 100;
    if (roll < 20) {
      if (last !== FELL) return FELL;
      roll2 = ctx.rng("aiRng").randomRange(20, 99); // burned; see header note
    }
    if (roll < 60 || roll2 < 60) {
      return !lastTwoMovesWere(self, DOUBLE_STRIKE) ? DOUBLE_STRIKE : SUCK;
    }
    if (!lastTwoMovesWere(self, SUCK)) return SUCK;
    return DOUBLE_STRIKE;
  },
};
