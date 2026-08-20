// Spire Shield & Spire Spear — exact ports from data/corpus/monsters-act34.json
// (SPIRE_SHIELD, SPIRE_SPEAR). Act-4 elite pair: Shield slot 0 (left/behind),
// Spear slot 1 (right/front).
// Back Attack (CONFLICT HONORED: per real game, BACK_ATTACK on each elite +
// SURROUNDED on the player): each elite's attacks deal x1.5 while the player
// is not facing it; the player faces the monster last targeted by a card
// (initially the Spear, slot 1). A STRENGTH-0 instance is pre-seeded BEFORE
// Back Attack so later Strength gains merge into it and the fold order stays
// +strength -> x1.5 back-attack -> weak (the corpus damage-order note).
// Fixed cadences: Shield SMASH on turns 3/6/9..., Spear SKEWER on 2/5/8...;
// between them the two other moves are used once each in a 50/50 order
// (aiRng.randomBoolean(), the accompanying aiRng.random(99) roll consumed but
// ignored — the engine's rollMove provides exactly that consumption).
// ENGINE-GAP: targeted potions do not update facing (no hook site); Smoke
// Bomb's Surrounded restriction is a run-layer concern.

import type { MonsterDef, EffectCtx } from "../../../engine/content/defs";
import type { MonsterState } from "../../../engine/combat/combatState";
import { calcMonsterDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { firstTurn } from "../../util";
import { attackPlayer, playerPower, prePower, selfBlock } from "../act1/_shared";
import { forceNext, prevMove, statusCardsNow, takeForced } from "./_shared";

const BASH = "SPIRE_SHIELD_BASH";
const FORTIFY = "SPIRE_SHIELD_FORTIFY";
const SMASH = "SPIRE_SHIELD_SMASH";
const BURN_STRIKE = "SPIRE_SPEAR_BURN_STRIKE";
const PIERCER = "SPIRE_SPEAR_PIERCER";
const SKEWER = "SPIRE_SPEAR_SKEWER";

function spirePreBattle(ctx: EffectCtx, self: MonsterState): void {
  // Strength seat first (fold order), then Back Attack, then Artifact
  self.powers.push({ id: "STRENGTH", amount: 0, justApplied: false, data: null });
  prePower(self, "BACK_ATTACK", 1);
  prePower(self, "ARTIFACT", ctx.asc >= 18 ? 2 : 1);
}

/** Queue a power/block action on every living Spire elite (self included). */
function eachSpire(ctx: EffectCtx, fn: (idx: number) => void): void {
  for (const m of ctx.combat!.monsters) {
    if ((m.id === "SPIRE_SHIELD" || m.id === "SPIRE_SPEAR") && !m.isDead && !m.isEscaped) fn(m.idx);
  }
}

export const spireShield: MonsterDef = {
  id: "SPIRE_SHIELD",
  name: "Spire Shield",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [125, 125] : [110, 110]),
  preBattle: (ctx, self) => {
    spirePreBattle(ctx, self);
    // pre-battle the PLAYER gains Surrounded (once for the fight); the
    // initial facing is the Spear (slot 1)
    if (!ctx.combat!.player.powers.some((p) => p.id === "SURROUNDED")) {
      ctx.combat!.player.powers.push({ id: "SURROUNDED", amount: 1, justApplied: false, data: { facing: 1 } });
    }
  },
  moves: {
    SPIRE_SHIELD_BASH: {
      id: BASH,
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 3 ? 14 : 12);
        // with orb slots: 50/50 Focus -1 / Strength -1; otherwise Strength -1
        if (ctx.combat!.player.orbSlots > 0 && ctx.bundle.powers.has("FOCUS")) {
          playerPower(ctx, self, ctx.rng("aiRng").randomBoolean() ? "FOCUS" : "STRENGTH", -1);
        } else {
          playerPower(ctx, self, "STRENGTH", -1);
        }
        const before = prevMove(self);
        forceNext(self, before === SMASH || before === undefined ? FORTIFY : SMASH);
      },
    },
    SPIRE_SHIELD_FORTIFY: {
      id: FORTIFY,
      intent: "defend",
      execute: (ctx, self) => {
        eachSpire(ctx, (idx) =>
          ctx.queue.addToBottom({ kind: "gainBlock", target: monster(idx), amount: 30, fromCard: false }),
        );
        const before = prevMove(self);
        forceNext(self, before === SMASH || before === undefined ? BASH : SMASH);
      },
    },
    SPIRE_SHIELD_SMASH: {
      id: SMASH,
      intent: "attackDefend",
      execute: (ctx, self) => {
        // block gained = the fully modified damage output (asc18+: flat 99)
        const dmg = calcMonsterDamage(ctx, self.idx, ctx.asc >= 3 ? 38 : 34);
        ctx.queue.addToBottom({
          kind: "damage",
          target: PLAYER,
          info: { type: "attack", source: monster(self.idx), amount: dmg },
        });
        selfBlock(ctx, self, ctx.asc >= 18 ? 99 : dmg);
        // no forced successor: the next roll uses the 50/50
      },
    },
  },
  getMove: (ctx, self, _roll) => {
    const forced = takeForced(self);
    if (forced) return forced;
    // consulted at battle init and after SMASH: the roll value is ignored
    return ctx.rng("aiRng").randomBoolean() ? FORTIFY : BASH;
  },
};

export const spireSpear: MonsterDef = {
  id: "SPIRE_SPEAR",
  name: "Spire Spear",
  category: "elite",
  hp: (asc) => (asc >= 8 ? [180, 180] : [160, 160]),
  preBattle: spirePreBattle,
  moves: {
    SPIRE_SPEAR_BURN_STRIKE: {
      id: BURN_STRIKE,
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 3 ? 6 : 5, 2);
        // asc18+: 2 Burns on TOP of the draw pile; below: 2 Burns to discard
        statusCardsNow(ctx, "BURN", 2, ctx.asc >= 18 ? "drawTop" : "discard");
        forceNext(self, prevMove(self) === SKEWER ? PIERCER : SKEWER);
      },
    },
    SPIRE_SPEAR_PIERCER: {
      id: PIERCER,
      intent: "buff",
      execute: (ctx, self) => {
        eachSpire(ctx, (idx) =>
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: monster(self.idx),
            target: monster(idx),
            powerId: "STRENGTH",
            amount: 2,
          }),
        );
        forceNext(self, prevMove(self) === SKEWER ? BURN_STRIKE : SKEWER);
      },
    },
    SPIRE_SPEAR_SKEWER: {
      id: SKEWER,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 10, ctx.asc >= 3 ? 4 : 3),
      // no forced successor: the next roll uses the 50/50
    },
  },
  getMove: (ctx, self, _roll) => {
    const forced = takeForced(self);
    if (forced) return forced;
    if (firstTurn(self)) return BURN_STRIKE;
    // after SKEWER: the roll value is ignored, 50/50 Piercer / Burn Strike
    return ctx.rng("aiRng").randomBoolean() ? PIERCER : BURN_STRIKE;
  },
};
