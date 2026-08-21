// The Champ - exact port from data/corpus/monsters-act2.json (boss).
// Phase 1: TAUNT is forced on turns 4, 8, 12, ... (the roll made when
// (turnNumber+1) % 4 == 0). The first roll made at < 50% HP sets the phase-2
// flag and returns ANGER (exactly once: removes all debuffs, negative Strength
// floored to 0, then +6 / +9@A4 / +12@A19 Strength). In phase 2, EXECUTE is
// forced unless it was one of the last two moves (net: every 3rd turn).
// Shared table (phase-1 non-taunt turns and blocked-EXECUTE phase-2 turns):
//   roll <= 15 (A19: 30) DEFENSIVE_STANCE - max 2 uses/combat, never twice in
//     a row; roll <= 30 GLOAT - never after GLOAT or DEFENSIVE_STANCE;
//   roll <= 55 FACE_SLAP - never twice in a row; else HEAVY_SLASH - never
//     twice in a row (falls back to FACE_SLAP).
// CONFLICT HONORED (GLOAT): Strength 2 / 3@A4 / 4@A19 (wiki tiered AscText,
// consistent with Anger = 3x Gloat at every tier; lightspeed's {3,4,5} is an
// off-by-one transcription).

import type { MonsterDef } from "../../../engine/content/defs";
import { applyPower, removePower } from "../../../engine/combat/powerRuntime";
import { monster } from "../../../engine/core/ids";
import { ascTier, lastMove } from "../../util";
import { attackPlayer, playerPower, selfBlock, selfPower } from "./_shared";

const HEAVY_SLASH = "THE_CHAMP_HEAVY_SLASH";
const FACE_SLAP = "THE_CHAMP_FACE_SLAP";
const STANCE = "THE_CHAMP_DEFENSIVE_STANCE";
const GLOAT = "THE_CHAMP_GLOAT";
const TAUNT = "THE_CHAMP_TAUNT";
const ANGER = "THE_CHAMP_ANGER";
const EXECUTE = "THE_CHAMP_EXECUTE";

export const theChamp: MonsterDef = {
  id: "THE_CHAMP",
  name: "The Champ",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [440, 440] : [420, 420]),
  moves: {
    THE_CHAMP_HEAVY_SLASH: {
      id: HEAVY_SLASH,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 18 : 16),
    },
    THE_CHAMP_FACE_SLAP: {
      id: FACE_SLAP,
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 4 ? 14 : 12);
        playerPower(ctx, self, "FRAIL", 2);
        playerPower(ctx, self, "VULNERABLE", 2);
      },
    },
    THE_CHAMP_DEFENSIVE_STANCE: {
      id: STANCE,
      intent: "defendBuff",
      execute: (ctx, self) => {
        selfBlock(ctx, self, ascTier(ctx.asc, 15, [[9, 18], [19, 20]]));
        // synchronous so the new Metallicize triggers at the end of THIS turn,
        // as in the game (a queued application would land after the hook fires)
        applyPower(ctx, monster(self.idx), monster(self.idx), "METALLICIZE", ascTier(ctx.asc, 5, [[9, 6], [19, 7]]));
      },
    },
    THE_CHAMP_GLOAT: {
      id: GLOAT,
      intent: "buff",
      execute: (ctx, self) =>
        selfPower(ctx, self, "STRENGTH", ascTier(ctx.asc, 2, [[4, 3], [19, 4]])), // adjudicated
    },
    THE_CHAMP_TAUNT: {
      id: TAUNT,
      intent: "debuff",
      execute: (ctx, self) => {
        playerPower(ctx, self, "WEAK", 2);
        playerPower(ctx, self, "VULNERABLE", 2);
      },
    },
    THE_CHAMP_ANGER: {
      id: ANGER,
      intent: "buff",
      execute: (ctx, self) => {
        // remove all debuffs from self; negative Strength is floored to 0
        for (const p of [...self.powers]) {
          const def = ctx.bundle.powers.get(p.id);
          const negativeBuff = def?.canGoNegative === true && p.amount < 0;
          if (def?.kind === "debuff" || negativeBuff) {
            removePower(ctx, monster(self.idx), p.id);
          }
        }
        selfPower(ctx, self, "STRENGTH", ascTier(ctx.asc, 6, [[4, 9], [19, 12]]));
      },
    },
    THE_CHAMP_EXECUTE: {
      id: EXECUTE,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 10, 2),
    },
  },
  getMove: (ctx, self, roll) => {
    const last = lastMove(self);
    const prev = self.moveHistory[self.moveHistory.length - 2];
    if (self.data.phase2) {
      if (last !== EXECUTE && prev !== EXECUTE) return EXECUTE;
    } else {
      if (self.hp * 2 < self.maxHp) {
        self.data.phase2 = true; // exactly once, on the first roll below 50%
        return ANGER;
      }
      if ((ctx.combat!.turn + 1) % 4 === 0) return TAUNT; // selects turns 4, 8, 12, ...
    }
    const stanceUses = (self.data.stanceUses as number | undefined) ?? 0;
    const stanceThreshold = ctx.asc >= 19 ? 30 : 15;
    if (roll <= stanceThreshold && last !== STANCE && stanceUses < 2) {
      self.data.stanceUses = stanceUses + 1;
      return STANCE;
    }
    if (roll <= 30 && last !== GLOAT && last !== STANCE) return GLOAT;
    if (roll <= 55 && last !== FACE_SLAP) return FACE_SLAP;
    if (last !== HEAVY_SLASH) return HEAVY_SLASH;
    return FACE_SLAP;
  },
};
