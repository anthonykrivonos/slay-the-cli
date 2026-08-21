// Corrupt Heart - exact port from data/corpus/monsters-act34.json
// (CORRUPT_HEART). Turn 1 always Debilitate (Vuln/Weak/Frail 2 + exactly 1
// EACH of Dazed/Slimed/Wound/Burn/Void shuffled into the draw pile -
// CONFLICT NOTE: all sources agree on 1 each). Attacks then alternate; a
// turn number divisible by 3 forces BUFF next turn (turns 4, 7, 10, 13,
// 16...). BUFF: negative Strength cleared then +2, plus the escalating extra
// (1st Artifact 2, 2nd Beat of Death +1, 3rd Painful Stabs, 4th +10 Str,
// 5th+ +50 Str). BEAT_OF_DEATH and INVINCIBLE live in powers/monstersAct34.ts.

import type { MonsterDef } from "../../../engine/content/defs";
import { applyPower } from "../../../engine/combat/powerRuntime";
import { monster } from "../../../engine/core/ids";
import { firstTurn } from "../../util";
import { attackPlayer, playerPower } from "../act1/_shared";
import { forceNext, statusCardsNow, takeForced, turnNumber } from "./_shared";

const DEBILITATE = "CORRUPT_HEART_DEBILITATE";
const BLOOD_SHOTS = "CORRUPT_HEART_BLOOD_SHOTS";
const ECHO = "CORRUPT_HEART_ECHO";
const BUFF = "CORRUPT_HEART_BUFF";

export const corruptHeart: MonsterDef = {
  id: "CORRUPT_HEART",
  name: "Corrupt Heart",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [800, 800] : [750, 750]),
  preBattle: (ctx, self) => {
    self.powers.push({
      id: "BEAT_OF_DEATH",
      amount: ctx.asc >= 19 ? 2 : 1,
      justApplied: false,
      data: null,
    });
    const invincible = ctx.asc >= 19 ? 200 : 300;
    self.powers.push({
      id: "INVINCIBLE",
      amount: invincible,
      justApplied: false,
      data: { base: invincible },
    });
  },
  moves: {
    CORRUPT_HEART_DEBILITATE: {
      id: DEBILITATE,
      intent: "strongDebuff",
      execute: (ctx, self) => {
        playerPower(ctx, self, "VULNERABLE", 2);
        playerPower(ctx, self, "WEAK", 2);
        playerPower(ctx, self, "FRAIL", 2);
        for (const status of ["DAZED", "SLIMED", "WOUND", "BURN", "VOID"]) {
          statusCardsNow(ctx, status, 1, "draw");
        }
      },
    },
    CORRUPT_HEART_BLOOD_SHOTS: {
      id: BLOOD_SHOTS,
      intent: "attack",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, 2, ctx.asc >= 4 ? 15 : 12);
        forceNext(self, turnNumber(ctx) % 3 === 0 ? BUFF : ECHO);
      },
    },
    CORRUPT_HEART_ECHO: {
      id: ECHO,
      intent: "attack",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 4 ? 45 : 40);
        forceNext(self, turnNumber(ctx) % 3 === 0 ? BUFF : BLOOD_SHOTS);
      },
    },
    CORRUPT_HEART_BUFF: {
      id: BUFF,
      intent: "buff",
      execute: (ctx, self) => {
        const me = monster(self.idx);
        const str = self.powers.find((p) => p.id === "STRENGTH");
        if (str && str.amount < 0) str.amount = 0; // clear negative Strength
        applyPower(ctx, me, me, "STRENGTH", 2);
        const buffCount = Math.floor(turnNumber(ctx) / 3);
        if (buffCount === 1) applyPower(ctx, me, me, "ARTIFACT", 2);
        else if (buffCount === 2) applyPower(ctx, me, me, "BEAT_OF_DEATH", 1);
        else if (buffCount === 3) applyPower(ctx, me, me, "PAINFUL_STABS", 1);
        else if (buffCount === 4) applyPower(ctx, me, me, "STRENGTH", 10);
        else applyPower(ctx, me, me, "STRENGTH", 50); // every subsequent buff
        // no forced successor: the next roll uses the 50/50
      },
    },
  },
  getMove: (ctx, self, _roll) => {
    const forced = takeForced(self);
    if (forced) return forced;
    if (firstTurn(self)) return DEBILITATE;
    // only reached from Debilitate's/Buff's roll: value ignored, 50/50
    return ctx.rng("aiRng").randomBoolean() ? BLOOD_SHOTS : ECHO;
  },
};
