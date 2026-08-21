// Time Eater - exact port from data/corpus/monsters-act34.json (TIME_EATER).
// TIME_WARP (powers/monstersAct34.ts) counts player card plays; the 12th
// force-ends the turn and grants +2 Strength. Haste fires on the first roll
// after dropping below 50% HP, exactly once: heals UP to exactly
// floor(maxHp/2), removes its own debuffs (Shackled included, negative
// Strength -> 0) and at asc19+ gains 32 block (CONFLICT HONORED: 32 per
// lightspeed + wiki; spire-archive's 26 is stale).

import type { MonsterDef } from "../../../engine/content/defs";
import { lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, playerPower, prePower, selfBlock } from "../act1/_shared";
import { removeMonsterDebuffs, statusCardsNow } from "./_shared";

const REVERBERATE = "TIME_EATER_REVERBERATE";
const HEAD_SLAM = "TIME_EATER_HEAD_SLAM";
const RIPPLE = "TIME_EATER_RIPPLE";
const HASTE = "TIME_EATER_HASTE";

export const timeEater: MonsterDef = {
  id: "TIME_EATER",
  name: "Time Eater",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [480, 480] : [456, 456]),
  preBattle: (_ctx, self) => prePower(self, "TIME_WARP", 0),
  moves: {
    TIME_EATER_REVERBERATE: {
      id: REVERBERATE,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 8 : 7, 3),
    },
    TIME_EATER_HEAD_SLAM: {
      id: HEAD_SLAM,
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 4 ? 32 : 26);
        playerPower(ctx, self, "DRAW_REDUCTION", 1);
        if (ctx.asc >= 19) statusCardsNow(ctx, "SLIMED", 2, "discard");
      },
    },
    TIME_EATER_RIPPLE: {
      id: RIPPLE,
      intent: "defendDebuff",
      execute: (ctx, self) => {
        selfBlock(ctx, self, 20);
        playerPower(ctx, self, "WEAK", 1);
        playerPower(ctx, self, "VULNERABLE", 1);
        if (ctx.asc >= 19) playerPower(ctx, self, "FRAIL", 1);
      },
    },
    TIME_EATER_HASTE: {
      id: HASTE,
      intent: "buff",
      execute: (ctx, self) => {
        self.data.usedHaste = true;
        self.hp = Math.floor(self.maxHp / 2); // heals UP to exactly half
        if (ctx.asc >= 19) selfBlock(ctx, self, 32);
        removeMonsterDebuffs(ctx, self); // Shackled included: pending restore lost
      },
    },
  },
  getMove: (ctx, self, roll) => {
    if (!self.data.usedHaste && self.hp < Math.floor(self.maxHp / 2)) return HASTE;
    let r = roll;
    if (r < 45) {
      if (!lastTwoMovesWere(self, REVERBERATE)) return REVERBERATE;
      r = ctx.rng("aiRng").randomRange(50, 99);
    }
    if (r < 80) {
      if (lastMove(self) !== HEAD_SLAM) return HEAD_SLAM;
      return ctx.rng("aiRng").randomBoolean(0.66) ? REVERBERATE : RIPPLE;
    }
    if (lastMove(self) === RIPPLE) {
      return ctx.rng("aiRng").random(74) < 45 ? REVERBERATE : HEAD_SLAM;
    }
    return RIPPLE;
  },
};
