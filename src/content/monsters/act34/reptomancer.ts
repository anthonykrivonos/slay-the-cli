// Reptomancer + Snake Dagger — exact ports from data/corpus/monsters-act34.json
// (REPTOMANCER, DAGGER). Turn 1 is always Summon (the spawn cap is NOT
// consulted). Summoned daggers fill dead/empty slots in the fixed search
// order [4, 1, 3, 0], have Stab preset (skipping the summon round — they are
// not in that round's move queue), consume one aiRng.random(99) each
// (noOpRollMove parity), and get +1 Strength with Philosopher's Stone.
// CONFLICT HONORED (spawn cap): per the wiki, at most 4 Daggers in play —
// Summon becomes Snake Strike when 4 daggers are alive (lightspeed instead
// counts all alive monsters incl. the Reptomancer; unresolved without the
// JAR, wiki taken as the cap the brief adjudicates).
// ENGINE-GAP (rng parity): the reference's initHp consumes and DISCARDS one
// extra monsterHpRng.random(180,190) before the real HP roll (not
// reproducible in the engine's setup loop).
// Slot geometry: acts.ts spawns [DAGGER, REPTOMANCER, DAGGER]; the array is
// padded to 5 slots on the first summon so the [4,1,3,0] search order works
// (the corpus's canonical layout has empties at 0 and 3 with the Reptomancer
// in slot 2 — cosmetic positioning only).

import type { MonsterDef } from "../../../engine/content/defs";
import { spawnMonster } from "../../../engine/combat/interpreter";
import { applyPower } from "../../../engine/combat/powerRuntime";
import { monster } from "../../../engine/core/ids";
import { firstTurn, hasRelic, lastMove, lastTwoMovesWere } from "../../util";
import { addStatusCards, attackPlayer, padMonsterSlots, playerPower, prePower } from "../act1/_shared";
import { aliveCount, setIntent, suicide } from "./_shared";

const SUMMON = "REPTOMANCER_SUMMON";
const SNAKE_STRIKE = "REPTOMANCER_SNAKE_STRIKE";
const BIG_BITE = "REPTOMANCER_BIG_BITE";

const DAGGER_SLOT_ORDER = [4, 1, 3, 0];

export const reptomancer: MonsterDef = {
  id: "REPTOMANCER",
  name: "Reptomancer",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [190, 200] : [180, 190]),
  preBattle: (_ctx, self) => prePower(self, "MINION_LEADER", 1),
  moves: {
    REPTOMANCER_SUMMON: {
      id: SUMMON,
      intent: "unknown",
      execute: (ctx, _self) => {
        const combat = ctx.combat!;
        const count = ctx.asc >= 18 ? 2 : 1;
        padMonsterSlots(ctx, 5);
        for (let i = 0; i < count; i++) {
          const slot = DAGGER_SLOT_ORDER.find((s) => {
            const m = combat.monsters[s];
            return !m || m.isDead || m.isEscaped;
          });
          if (slot === undefined) break; // no open slot
          spawnMonster(ctx, "DAGGER", slot, null, false); // hp roll 20-25 via monsterHpRng
          const d = combat.monsters[slot]!;
          setIntent(d, "DAGGER_STAB"); // preset; skips its turn this round
          ctx.rng("aiRng").random(99); // bc.noOpRollMove() parity per dagger
          if (hasRelic(ctx, "PHILOSOPHERS_STONE")) {
            applyPower(ctx, monster(slot), monster(slot), "STRENGTH", 1);
          }
        }
      },
    },
    REPTOMANCER_SNAKE_STRIKE: {
      id: SNAKE_STRIKE,
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 3 ? 16 : 13, 2);
        playerPower(ctx, self, "WEAK", 1);
      },
    },
    REPTOMANCER_BIG_BITE: {
      id: BIG_BITE,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 3 ? 34 : 30),
    },
  },
  getMove: (ctx, self, roll) => {
    if (firstTurn(self)) return SUMMON; // cap not consulted on turn 1
    const canSpawn = aliveCount(ctx, "DAGGER") < 4;
    let r = roll;
    for (;;) {
      if (r < 33) {
        if (lastMove(self) !== SNAKE_STRIKE) return SNAKE_STRIKE;
        r = ctx.rng("aiRng").randomRange(33, 99);
      }
      if (r < 66) {
        if (!lastTwoMovesWere(self, SUMMON) && canSpawn) return SUMMON;
        return SNAKE_STRIKE;
      }
      if (lastMove(self) !== BIG_BITE) return BIG_BITE;
      r = ctx.rng("aiRng").randomRange(0, 65);
    }
  },
};

// ---------------------------------------------------------------------------
// Snake Dagger — fixed two-turn life: Stab (9 + Wound to discard) then
// Explode (25, a real ATTACK) followed by a real suicide (on-death triggers
// fire). Minion: flees when the Reptomancer dies.
// ---------------------------------------------------------------------------

export const dagger: MonsterDef = {
  id: "DAGGER",
  name: "Dagger",
  category: "minion",
  hp: () => [20, 25],
  preBattle: (_ctx, self) => prePower(self, "MINION", 1),
  moves: {
    DAGGER_STAB: {
      id: "DAGGER_STAB",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, 9);
        addStatusCards(ctx, "WOUND", 1);
      },
    },
    DAGGER_EXPLODE: {
      id: "DAGGER_EXPLODE",
      intent: "attack",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, 25);
        suicide(ctx, self);
      },
    },
  },
  // roll consumed, value unused: Stab then Explode, always
  getMove: (_ctx, self) => (lastMove(self) === "DAGGER_STAB" ? "DAGGER_EXPLODE" : "DAGGER_STAB"),
};
