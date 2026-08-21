// Gremlin Leader - exact port from data/corpus/monsters-act2.json (elite).
// Corpus encounter layout: leader at slot 3, the two starting gremlins at
// slots 1 and 2, slot 0 empty; up to 3 minions alive at once. The reference
// group setup marks the starting gremlins as MINIONs - this engine's encounter
// data cannot, so the leader's preBattle marks every other monster in slots
// 0..2 (and its own MINION_LEADER; on death all MINIONs abandon combat).
// AI tables by living-gremlin count (slots 0..2):
//   0: RALLY 75% / STAB 25% (neither twice in a row)
//   1: RALLY 50% / ENCOURAGE 30% / STAB 20% with the reference's rerolls
//      (blocked RALLY -> aiRng.random(50,99) < 80 ? ENCOURAGE : STAB;
//       blocked STAB  -> aiRng.random(0,80)  < 50 ? RALLY : ENCOURAGE)
//   2+: ENCOURAGE 66% / STAB 34% (neither twice in a row)
// RALLY summons 2 gremlins into open slots searched in order 1, 2, then 0:
// each is a uniform aiRng.random(7) pick from the 8-entry pool, rolls fresh HP
// from monsterHpRng, gets MINION (+1 STR with Philosopher's Stone) and
// immediately rolls its own first move - per-gremlin, in slot order.
// CONFLICT HONORED (ENCOURAGE): minion block 6, raised to 10 at A18 (wiki
// tiered AscText; lightspeed's asc>=3 threshold for 10 is a slipped tier);
// STR 3 / 4@A3 / 5@A18 per all sources.

import type { MonsterDef, EffectCtx } from "../../../engine/content/defs";
import type { MonsterState } from "../../../engine/combat/combatState";
import { rollMove, spawnMonster } from "../../../engine/combat/interpreter";
import { applyPower } from "../../../engine/combat/powerRuntime";
import { monster } from "../../../engine/core/ids";
import { ascTier, hasRelic, lastMove } from "../../util";
import { attackPlayer, escapeMinions, padMonsterSlots, prePower, selfPower, slotOpen } from "./_shared";

const RALLY = "GREMLIN_LEADER_RALLY";
const ENCOURAGE = "GREMLIN_LEADER_ENCOURAGE";
const STAB = "GREMLIN_LEADER_STAB";

/** The 8-entry summon pool (MonsterGroup.cpp getGremlin). */
const GREMLIN_POOL = [
  "MAD_GREMLIN",
  "MAD_GREMLIN",
  "SNEAKY_GREMLIN",
  "SNEAKY_GREMLIN",
  "FAT_GREMLIN",
  "FAT_GREMLIN",
  "SHIELD_GREMLIN",
  "GREMLIN_WIZARD",
];

/** Minion slots are 0..2; the leader's own slot never counts. */
function livingGremlins(ctx: EffectCtx, self: MonsterState): MonsterState[] {
  return ctx.combat!.monsters.filter(
    (m) => m.idx <= 2 && m.idx !== self.idx && !m.isDead && !m.isEscaped,
  );
}

export const gremlinLeader: MonsterDef = {
  id: "GREMLIN_LEADER",
  name: "Gremlin Leader",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [145, 155] : [140, 148]),
  preBattle: (ctx, self) => {
    prePower(self, "MINION_LEADER", 1);
    for (const m of livingGremlins(ctx, self)) prePower(m, "MINION", 1);
  },
  onDeath: (ctx, _self) => escapeMinions(ctx),
  moves: {
    GREMLIN_LEADER_RALLY: {
      id: RALLY,
      intent: "unknown",
      execute: (ctx, self) => {
        padMonsterSlots(ctx, 3);
        const openSlots = [1, 2, 0].filter((s) => s !== self.idx && slotOpen(ctx, s)).slice(0, 2);
        for (const slot of openSlots) {
          const id = GREMLIN_POOL[ctx.rng("aiRng").random(7)]!;
          spawnMonster(ctx, id, slot, null, false); // fresh monsterHpRng roll + gremlin preBattle
          const g = ctx.combat!.monsters[slot]!;
          prePower(g, "MINION", 1);
          if (hasRelic(ctx, "PHILOSOPHERS_STONE")) {
            applyPower(ctx, monster(slot), monster(slot), "STRENGTH", 1);
          }
          rollMove(ctx, g); // summons roll their first move immediately; they act next round
        }
      },
    },
    GREMLIN_LEADER_ENCOURAGE: {
      id: ENCOURAGE,
      intent: "defendBuff",
      execute: (ctx, self) => {
        ctx.rng("aiRng").randomRange(0, 2); // in-game quote roll (consumed, unused)
        const str = ascTier(ctx.asc, 3, [
          [3, 4],
          [18, 5],
        ]);
        const block = ctx.asc >= 18 ? 10 : 6; // adjudicated tier (see header)
        selfPower(ctx, self, "STRENGTH", str);
        for (const g of livingGremlins(ctx, self)) {
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: monster(self.idx),
            target: monster(g.idx),
            powerId: "STRENGTH",
            amount: str,
          });
          ctx.queue.addToBottom({ kind: "gainBlock", target: monster(g.idx), amount: block, fromCard: false });
        }
      },
    },
    GREMLIN_LEADER_STAB: {
      id: STAB,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 6, 3),
    },
  },
  getMove: (ctx, self, roll) => {
    const alive = livingGremlins(ctx, self).length;
    if (alive === 0) {
      if (roll < 75) return lastMove(self) === RALLY ? STAB : RALLY;
      return lastMove(self) === STAB ? RALLY : STAB;
    }
    if (alive === 1) {
      if (roll < 50) {
        if (lastMove(self) === RALLY) {
          return ctx.rng("aiRng").randomRange(50, 99) < 80 ? ENCOURAGE : STAB;
        }
        return RALLY;
      }
      if (roll < 80) return lastMove(self) === ENCOURAGE ? STAB : ENCOURAGE;
      if (lastMove(self) === STAB) {
        return ctx.rng("aiRng").randomRange(0, 80) < 50 ? RALLY : ENCOURAGE;
      }
      return STAB;
    }
    // 2-3 gremlins alive
    if (roll < 66) return lastMove(self) === ENCOURAGE ? STAB : ENCOURAGE;
    if (lastMove(self) === STAB) return ENCOURAGE;
    return STAB;
  },
};
