// Slime Boss — exact port from data/corpus/monsters-act1.json (SLIME_BOSS).
// Fixed 3-turn loop: GOOP_SPRAY -> PREPARING -> SLAM -> ... At <= 50% max HP the
// intent is interrupted (SPLIT power) and SPLIT replaces whatever was queued,
// including SLAM. SPLIT removes the boss and spawns SPIKE_SLIME_L at slot 0 and
// ACID_SLIME_L at slot 2, each with curHp = maxHp = the boss's HP at split; the
// spawns roll their own moves and do not act that turn (+1 STRENGTH each with
// Philosopher's Stone). The spawned large slimes split again at half their
// inherited maxHp.

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, hasRelic, lastMove } from "../../util";
import { addStatusCards, attackPlayer, hasPower, padMonsterSlots } from "./_shared";

export const slimeBoss: MonsterDef = {
  id: "SLIME_BOSS",
  name: "Slime Boss",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [150, 150] : [140, 140]),
  preBattle: (_ctx, self) => self.powers.push({ id: "SPLIT", amount: 1, justApplied: false, data: null }),
  moves: {
    SLIME_BOSS_GOOP_SPRAY: {
      id: "SLIME_BOSS_GOOP_SPRAY",
      intent: "strongDebuff",
      execute: (ctx, _self) => addStatusCards(ctx, "SLIMED", ctx.asc >= 19 ? 5 : 3),
    },
    SLIME_BOSS_PREPARING: {
      id: "SLIME_BOSS_PREPARING",
      intent: "unknown",
      execute: () => {},
    },
    SLIME_BOSS_SLAM: {
      id: "SLIME_BOSS_SLAM",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 38 : 35),
    },
    SLIME_BOSS_SPLIT: {
      id: "SLIME_BOSS_SPLIT",
      intent: "unknown",
      execute: (ctx, self) => {
        self.isEscaped = true; // boss leaves combat; spawns keep it going
        padMonsterSlots(ctx, 3);
        const hp = self.hp;
        ctx.queue.addToBottom({ kind: "spawnMonster", monsterId: "SPIKE_SLIME_L", slot: 0, hp, rollFirstMove: true });
        ctx.queue.addToBottom({ kind: "spawnMonster", monsterId: "ACID_SLIME_L", slot: 2, hp, rollFirstMove: true });
        if (hasRelic(ctx, "PHILOSOPHERS_STONE")) {
          for (const slot of [0, 2]) {
            ctx.queue.addToBottom({
              kind: "applyPower",
              source: { kind: "monster", idx: slot },
              target: { kind: "monster", idx: slot },
              powerId: "STRENGTH",
              amount: 1,
            });
          }
        }
      },
    },
  },
  getMove: (_ctx, self) => {
    // ENGINE-GAP: the reference consumes no aiRng.random(99) after turn 1;
    // this engine's rollMove consumes one per turn (value unused).
    if (hasPower(self, "SPLIT") && self.hp <= Math.floor(self.maxHp / 2)) {
      return "SLIME_BOSS_SPLIT"; // own-turn interrupt (thorns)
    }
    if (firstTurn(self)) return "SLIME_BOSS_GOOP_SPRAY";
    switch (lastMove(self)) {
      case "SLIME_BOSS_GOOP_SPRAY":
        return "SLIME_BOSS_PREPARING";
      case "SLIME_BOSS_PREPARING":
        return "SLIME_BOSS_SLAM";
      default:
        return "SLIME_BOSS_GOOP_SPRAY";
    }
  },
};
