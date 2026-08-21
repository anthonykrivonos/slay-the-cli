// The six act-1 slimes - exact ports from data/corpus/monsters-act1.json.
// Large slimes carry the SPLIT power (prebattle): at <= 50% max HP the intent is
// interrupted and replaced with SPLIT, which removes the slime and spawns two
// medium slimes of its type at slots [idx, idx+1] with hp = maxHp = its current
// HP (spawns roll their own move and do not act that turn; +1 STRENGTH each with
// Philosopher's Stone).
// CONFLICT HONORED (ACID_SLIME_L, asc>=17): lightspeed's roll<40 branch tests the
// MEDIUM slime's spit id (constant-false typo); per the wiki/real game we test the
// L slime's OWN Corrosive Spit - never 3x in a row.

import type { MonsterDef, EffectCtx } from "../../../engine/content/defs";
import type { MonsterState } from "../../../engine/combat/combatState";
import { hasRelic, lastMove, lastTwoMovesWere } from "../../util";
import {
  addStatusCards,
  attackPlayer,
  hasPower,
  padMonsterSlots,
  playerPower,
  prePower,
} from "./_shared";

// ---------------------------------------------------------------------------
// split plumbing (shared by both large slimes; Slime Boss has its own variant)
// ---------------------------------------------------------------------------

function largeSlimeSplit(ctx: EffectCtx, self: MonsterState, spawnId: string): void {
  self.isEscaped = true; // removed from combat: no death triggers, no victory check yet
  padMonsterSlots(ctx, self.idx + 2);
  const hp = self.hp;
  for (const slot of [self.idx, self.idx + 1]) {
    ctx.queue.addToBottom({ kind: "spawnMonster", monsterId: spawnId, slot, hp, rollFirstMove: true });
  }
  if (hasRelic(ctx, "PHILOSOPHERS_STONE")) {
    for (const slot of [self.idx, self.idx + 1]) {
      ctx.queue.addToBottom({
        kind: "applyPower",
        source: { kind: "monster", idx: slot },
        target: { kind: "monster", idx: slot },
        powerId: "STRENGTH",
        amount: 1,
      });
    }
  }
}

const splitPending = (self: MonsterState): boolean =>
  hasPower(self, "SPLIT") && self.hp <= Math.floor(self.maxHp / 2);

// ---------------------------------------------------------------------------
// Acid Slime (S)
// ---------------------------------------------------------------------------

export const acidSlimeS: MonsterDef = {
  id: "ACID_SLIME_S",
  name: "Acid Slime (S)",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [9, 13] : [8, 12]),
  moves: {
    ACID_SLIME_S_LICK: {
      id: "ACID_SLIME_S_LICK",
      intent: "debuff",
      execute: (ctx, self) => playerPower(ctx, self, "WEAK", 1),
    },
    ACID_SLIME_S_TACKLE: {
      id: "ACID_SLIME_S_TACKLE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 4 : 3),
    },
  },
  getMove: (ctx, self, _roll) => {
    // Turn 1: asc>=17 always LICK, else 50/50 via aiRng.randomBoolean().
    // ENGINE-GAP: the reference consumes no aiRng.random(99) after turn 1 (moves
    // are chained in takeTurn); this engine's rollMove consumes one per turn.
    if (self.moveHistory.length === 0) {
      if (ctx.asc >= 17) return "ACID_SLIME_S_LICK";
      return ctx.rng("aiRng").randomBoolean() ? "ACID_SLIME_S_TACKLE" : "ACID_SLIME_S_LICK";
    }
    // strict LICK/TACKLE alternation for the rest of combat
    return lastMove(self) === "ACID_SLIME_S_LICK" ? "ACID_SLIME_S_TACKLE" : "ACID_SLIME_S_LICK";
  },
};

// ---------------------------------------------------------------------------
// Acid Slime (M)
// ---------------------------------------------------------------------------

export const acidSlimeM: MonsterDef = {
  id: "ACID_SLIME_M",
  name: "Acid Slime (M)",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [29, 34] : [28, 32]),
  moves: {
    ACID_SLIME_M_CORROSIVE_SPIT: {
      id: "ACID_SLIME_M_CORROSIVE_SPIT",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 8 : 7);
        addStatusCards(ctx, "SLIMED", 1);
      },
    },
    ACID_SLIME_M_TACKLE: {
      id: "ACID_SLIME_M_TACKLE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 12 : 10),
    },
    ACID_SLIME_M_LICK: {
      id: "ACID_SLIME_M_LICK",
      intent: "debuff",
      execute: (ctx, self) => playerPower(ctx, self, "WEAK", 1),
    },
  },
  getMove: (ctx, self, roll) => {
    const SPIT = "ACID_SLIME_M_CORROSIVE_SPIT";
    const TACKLE = "ACID_SLIME_M_TACKLE";
    const LICK = "ACID_SLIME_M_LICK";
    if (ctx.asc >= 17) {
      if (roll < 40) {
        if (lastTwoMovesWere(self, SPIT)) return ctx.rng("aiRng").randomBoolean(0.5) ? TACKLE : LICK;
        return SPIT;
      }
      if (roll < 80) {
        if (lastTwoMovesWere(self, TACKLE)) return ctx.rng("aiRng").randomBoolean(0.5) ? SPIT : LICK;
        return TACKLE;
      }
      if (lastMove(self) === LICK) return ctx.rng("aiRng").randomBoolean(0.4) ? SPIT : TACKLE;
      return LICK;
    }
    if (roll < 30) {
      if (lastTwoMovesWere(self, SPIT)) return ctx.rng("aiRng").randomBoolean(0.5) ? TACKLE : LICK;
      return SPIT;
    }
    if (roll < 70) {
      if (lastMove(self) === TACKLE) return ctx.rng("aiRng").randomBoolean(0.4) ? SPIT : LICK;
      return TACKLE;
    }
    if (lastTwoMovesWere(self, LICK)) return ctx.rng("aiRng").randomBoolean(0.4) ? SPIT : TACKLE;
    return LICK;
  },
};

// ---------------------------------------------------------------------------
// Acid Slime (L)
// ---------------------------------------------------------------------------

export const acidSlimeL: MonsterDef = {
  id: "ACID_SLIME_L",
  name: "Acid Slime (L)",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [68, 72] : [65, 69]),
  preBattle: (_ctx, self) => prePower(self, "SPLIT", 1),
  moves: {
    ACID_SLIME_L_CORROSIVE_SPIT: {
      id: "ACID_SLIME_L_CORROSIVE_SPIT",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 12 : 11);
        addStatusCards(ctx, "SLIMED", 2);
      },
    },
    ACID_SLIME_L_TACKLE: {
      id: "ACID_SLIME_L_TACKLE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 18 : 16),
    },
    ACID_SLIME_L_LICK: {
      id: "ACID_SLIME_L_LICK",
      intent: "debuff",
      execute: (ctx, self) => playerPower(ctx, self, "WEAK", 2),
    },
    ACID_SLIME_L_SPLIT: {
      id: "ACID_SLIME_L_SPLIT",
      intent: "unknown",
      execute: (ctx, self) => largeSlimeSplit(ctx, self, "ACID_SLIME_M"),
    },
  },
  getMove: (ctx, self, roll) => {
    if (splitPending(self)) return "ACID_SLIME_L_SPLIT"; // own-turn interrupt (thorns)
    const SPIT = "ACID_SLIME_L_CORROSIVE_SPIT";
    const TACKLE = "ACID_SLIME_L_TACKLE";
    const LICK = "ACID_SLIME_L_LICK";
    if (ctx.asc >= 17) {
      if (roll < 40) {
        // adjudicated: constrain the L slime's OWN spit (lightspeed typo'd the M id)
        if (lastTwoMovesWere(self, SPIT)) return ctx.rng("aiRng").randomBoolean(0.6) ? TACKLE : LICK;
        return SPIT;
      }
      if (roll < 70) {
        if (lastTwoMovesWere(self, TACKLE)) return ctx.rng("aiRng").randomBoolean(0.6) ? SPIT : LICK;
        return TACKLE;
      }
      if (lastMove(self) === LICK) return ctx.rng("aiRng").randomBoolean(0.4) ? SPIT : TACKLE;
      return LICK;
    }
    if (roll < 30) {
      if (lastTwoMovesWere(self, SPIT)) return ctx.rng("aiRng").randomBoolean(0.5) ? TACKLE : LICK;
      return SPIT;
    }
    if (roll < 70) {
      if (lastMove(self) === TACKLE) return ctx.rng("aiRng").randomBoolean(0.4) ? SPIT : LICK;
      return TACKLE;
    }
    if (lastTwoMovesWere(self, LICK)) return ctx.rng("aiRng").randomBoolean(0.4) ? SPIT : TACKLE;
    return LICK;
  },
};

// ---------------------------------------------------------------------------
// Spike Slime (S)
// ---------------------------------------------------------------------------

export const spikeSlimeS: MonsterDef = {
  id: "SPIKE_SLIME_S",
  name: "Spike Slime (S)",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [11, 15] : [10, 14]),
  moves: {
    SPIKE_SLIME_S_TACKLE: {
      id: "SPIKE_SLIME_S_TACKLE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 6 : 5),
    },
  },
  // roll consumed every turn, unused
  getMove: () => "SPIKE_SLIME_S_TACKLE",
};

// ---------------------------------------------------------------------------
// Spike Slime (M) & (L) share the AI shape
// ---------------------------------------------------------------------------

function spikeSlimeGetMove(
  ctx: EffectCtx,
  self: MonsterState,
  roll: number,
  tackleId: string,
  lickId: string,
): string {
  if (roll < 30) {
    if (lastTwoMovesWere(self, tackleId)) return lickId;
    return tackleId;
  }
  if (lastTwoMovesWere(self, lickId) || (ctx.asc >= 17 && lastMove(self) === lickId)) return tackleId;
  return lickId;
}

export const spikeSlimeM: MonsterDef = {
  id: "SPIKE_SLIME_M",
  name: "Spike Slime (M)",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [29, 34] : [28, 32]),
  moves: {
    SPIKE_SLIME_M_FLAME_TACKLE: {
      id: "SPIKE_SLIME_M_FLAME_TACKLE",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 10 : 8);
        addStatusCards(ctx, "SLIMED", 1);
      },
    },
    SPIKE_SLIME_M_LICK: {
      id: "SPIKE_SLIME_M_LICK",
      intent: "debuff",
      execute: (ctx, self) => playerPower(ctx, self, "FRAIL", 1),
    },
  },
  getMove: (ctx, self, roll) =>
    spikeSlimeGetMove(ctx, self, roll, "SPIKE_SLIME_M_FLAME_TACKLE", "SPIKE_SLIME_M_LICK"),
};

export const spikeSlimeL: MonsterDef = {
  id: "SPIKE_SLIME_L",
  name: "Spike Slime (L)",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [67, 73] : [64, 70]),
  preBattle: (_ctx, self) => prePower(self, "SPLIT", 1),
  moves: {
    SPIKE_SLIME_L_FLAME_TACKLE: {
      id: "SPIKE_SLIME_L_FLAME_TACKLE",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 18 : 16);
        addStatusCards(ctx, "SLIMED", 2);
      },
    },
    SPIKE_SLIME_L_LICK: {
      id: "SPIKE_SLIME_L_LICK",
      intent: "debuff",
      execute: (ctx, self) => playerPower(ctx, self, "FRAIL", ctx.asc >= 17 ? 3 : 2),
    },
    SPIKE_SLIME_L_SPLIT: {
      id: "SPIKE_SLIME_L_SPLIT",
      intent: "unknown",
      execute: (ctx, self) => largeSlimeSplit(ctx, self, "SPIKE_SLIME_M"),
    },
  },
  getMove: (ctx, self, roll) => {
    if (splitPending(self)) return "SPIKE_SLIME_L_SPLIT"; // own-turn interrupt (thorns)
    return spikeSlimeGetMove(ctx, self, roll, "SPIKE_SLIME_L_FLAME_TACKLE", "SPIKE_SLIME_L_LICK");
  },
};
