// Powers introduced by act-3/4 monsters (beyond powers/core.ts). Audited
// against data/corpus/monsters-act34.json + data/corpus/powers.json.
//
// Notes / adjudications:
//  - REGROW (wiki: Life Link) is the Darkling revive driver. The engine skips
//    halfDead monsters in the monster phase, so the regrow/reincarnate turns
//    are driven from atEndOfRound (fired for halfDead monsters too); each
//    half-dead "turn" consumes one aiRng.random(99) for stream parity.
//    ENGINE-GAP: those rolls happen at end of round instead of in slot order
//    during the monster phase.
//  - REGENERATE is the Awakened One's non-decaying end-of-turn heal. The
//    monsters corpus lists it under lightspeed's enum name REGEN; the powers
//    corpus separates player REGEN (ticks down) from monster REGENERATE
//    (flat) — REGENERATE is used to avoid colliding with the potion power.
//  - TIME_WARP force-ends the player's turn via the engine's queueEndTurn
//    (callEndTurnEarlySequence equivalent) after clearing pending card plays.
//  - INVINCIBLE: amount is the remaining per-turn HP-loss allowance, clamped
//    by the monster-side onLoseHp fold; resets to data.base at the start of
//    the owner's turn.
//  - BACK_ATTACK/SURROUNDED: per the corpus conflict resolution, Back Attack
//    sits on each Spire elite and Surrounded on the player. Facing = last
//    monster targeted by a card (stored on the SURROUNDED instance; initial
//    facing is slot 1, the Spire Spear). ENGINE-GAP: targeted potions do not
//    update facing (no hook site).
//  - SHARP_HIDE is owned by this workstream (The Guardian's defensive mode
//    applies it when the bundle carries it).

import type { PowerDef } from "../../engine/content/defs";
import { f32add, f32mul } from "../../engine/core/math";
import { PLAYER, monster } from "../../engine/core/ids";
import { applyPower, removePower } from "../../engine/combat/powerRuntime";
import { queueEndTurn, rollMove } from "../../engine/combat/interpreter";
import { hasRelic } from "../util";
import { replaceIntent } from "../monsters/act1/_shared";
import { setIntent } from "../monsters/act34/_shared";

export const act34MonsterPowers: PowerDef[] = [
  {
    // Darkling Life Link driver (lightspeed models it as the REGROW status).
    // data.ticks (set by Darkling.onDeath) counts remaining end-of-rounds:
    // ticks>1 -> REGROW turn (nothing), ticks==1 -> REINCARNATE intent,
    // ticks==0 -> revive at 50% max HP and roll a real move.
    id: "REGROW",
    name: "Regrow",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      atEndOfRound: (ctx) => {
        if (ctx.owner.kind !== "monster") return;
        const m = ctx.combat!.monsters[ctx.owner.idx]!;
        const p = ctx.power!;
        const ticks = (p.data?.ticks as number | undefined) ?? 0;
        if (!m.halfDead || ticks <= 0) return;
        const left = ticks - 1;
        p.data = { ticks: left };
        if (left > 0) {
          ctx.rng("aiRng").random(99); // half-dead turn parity roll
          setIntent(m, left === 1 ? "DARKLING_REINCARNATE" : "DARKLING_REGROW");
          return;
        }
        // REINCARNATE: curHp = maxHp/2, halfDead=false, +1 Str with
        // Philosopher's Stone, then rollMove immediately.
        m.hp = Math.floor(m.maxHp / 2);
        m.halfDead = false;
        delete m.data.regrowing;
        if (hasRelic(ctx, "PHILOSOPHERS_STONE")) {
          applyPower(ctx, monster(m.idx), monster(m.idx), "STRENGTH", 1);
        }
        rollMove(ctx, m);
      },
    },
  },
  {
    // Orb Walker: gains X Strength at the end of each of its turns
    // (persistent). ID NOTE: lightspeed's GENERIC_STRENGTH_UP enum covers two
    // DIFFERENT game powers — Dark Shackles' one-shot GainStrengthPower
    // (owned by the colorless workstream under GENERIC_STRENGTH_UP, removes
    // itself after firing) and the Orb Walker's persistent StrengthUpPower
    // (wiki: "Strength Up"). Registered as STRENGTH_UP to keep both exact.
    id: "STRENGTH_UP",
    name: "Strength Up",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx) => {
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: ctx.owner,
          target: ctx.owner,
          powerId: "STRENGTH",
          amount: ctx.power!.amount,
        });
      },
    },
  },
  {
    // Transient: dies in X turns. The engine's end-of-round duration tick IS
    // the corpus decrement; the fade itself is in TRANSIENT_ATTACK.
    id: "FADING",
    name: "Fading",
    kind: "buff",
    stacking: "duration",
    turnBased: true,
    hooks: {},
  },
  {
    // Transient: upon losing HP, loses that much Strength until end of turn.
    id: "SHIFTING",
    name: "Shifting",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      wasHPLost: (ctx, _info, amount) => {
        if (ctx.owner.kind !== "monster" || amount <= 0) return;
        applyPower(ctx, ctx.owner, ctx.owner, "STRENGTH", -amount);
        applyPower(ctx, ctx.owner, ctx.owner, "SHACKLED", amount);
      },
    },
  },
  {
    // At the end of its turn, regains X Strength (then falls off).
    id: "SHACKLED",
    name: "Shackled",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx) => {
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: ctx.owner,
          target: ctx.owner,
          powerId: "STRENGTH",
          amount: ctx.power!.amount,
        });
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "SHACKLED" });
      },
    },
  },
  {
    // Exploder: pure countdown display (the fixed Slam/Slam/Explode pattern
    // lives in the AI); the engine's duration tick counts it 3 -> 2 -> 1.
    id: "EXPLOSIVE",
    name: "Explosive",
    kind: "buff",
    stacking: "duration",
    turnBased: true,
    hooks: {},
  },
  {
    // Spire Growth: the player takes X damage at the end of their turn.
    id: "CONSTRICTED",
    name: "Constricted",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (ctx.owner.kind !== "player" || !isPlayerTurn) return;
        ctx.queue.addToBottom({
          kind: "damage",
          target: PLAYER,
          info: { type: "thorns", source: null, amount: ctx.power!.amount },
        });
      },
    },
  },
  {
    // Writhing Mass: on each unblocked attack-damage instance gains block
    // equal to the current amount, then amount+1; resets to data.base at the
    // end of the monster phase. ADJUDICATED: base 4 per the wiki (lightspeed
    // hardcodes 3; block amounts are invisible to its RNG-seed tests), and
    // the reset restores the applied base like the game's MalleablePower.
    id: "MALLEABLE",
    name: "Malleable",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      wasHPLost: (ctx, info) => {
        if (ctx.owner.kind !== "monster" || info.type !== "attack") return;
        const p = ctx.power!;
        ctx.queue.addToTop({ kind: "gainBlock", target: ctx.owner, amount: p.amount, fromCard: false });
        p.amount += 1;
      },
      atEndOfRound: (ctx) => {
        const p = ctx.power!;
        p.amount = (p.data?.base as number | undefined) ?? 3;
      },
    },
  },
  {
    // Writhing Mass: upon receiving unblocked attack damage, rerolls its
    // intent (the current intent counts as lastMove, so a reroll cannot
    // repeat it). Own-turn HP loss (thorns) is covered by the engine's
    // post-move rollMove instead.
    id: "REACTIVE",
    name: "Reactive",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      wasHPLost: (ctx, info) => {
        if (ctx.owner.kind !== "monster" || info.type !== "attack") return;
        if (!ctx.combat!.playerTurn) return;
        const m = ctx.combat!.monsters[ctx.owner.idx]!;
        if (m.isDead || m.isEscaped || m.hp <= 0) return;
        const def = ctx.bundle.monsters.get(m.id)!;
        const next = def.getMove(ctx, m, ctx.rng("aiRng").random(99));
        replaceIntent(m, next);
      },
    },
  },
  {
    // Giant Head: +1 per card played; takes (10*X)% more attack damage;
    // resets to 0 at the end of each round.
    id: "SLOW",
    name: "Slow",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onAfterCardPlayed: (ctx) => {
        ctx.power!.amount += 1;
      },
      atDamageReceive: (ctx, d) => f32mul(d, f32add(1, f32mul(ctx.power!.amount, 0.1))),
      atEndOfRound: (ctx) => {
        ctx.power!.amount = 0;
      },
    },
  },
  {
    // Awakened One phase 1: +X Strength whenever the player plays a Power
    // card. ADJUDICATED: lightspeed comments the trigger out; the wiki/real
    // game behavior is implemented.
    id: "CURIOSITY",
    name: "Curiosity",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type !== "power") return;
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: ctx.owner,
          target: ctx.owner,
          powerId: "STRENGTH",
          amount: ctx.power!.amount,
        });
      },
    },
  },
  {
    // Awakened One: heals X at the end of each of its turns (never decays;
    // persists into phase 2).
    id: "REGENERATE",
    name: "Regenerate",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "heal", target: ctx.owner, amount: ctx.power!.amount });
      },
    },
  },
  {
    // Internal driver for the Awakened One's REBIRTH turn (pushed by its
    // onDeath). Same halfDead end-of-round mechanism as REGROW.
    id: "AWAKENED_REBIRTH",
    name: "Rebirth",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      atEndOfRound: (ctx) => {
        if (ctx.owner.kind !== "monster") return;
        const m = ctx.combat!.monsters[ctx.owner.idx]!;
        const p = ctx.power!;
        const ticks = (p.data?.ticks as number | undefined) ?? 0;
        if (!m.halfDead || ticks <= 0) return;
        const left = ticks - 1;
        p.data = { ticks: left };
        if (left > 0) {
          ctx.rng("aiRng").random(99); // half-dead turn parity roll
          setIntent(m, "AWAKENED_ONE_REBIRTH");
          return;
        }
        // REBIRTH: full heal to the flat phase-2 max HP, keep positive
        // Strength, gain Minion Leader, next move forced Dark Echo.
        m.maxHp = ctx.asc >= 9 ? 320 : 300;
        m.hp = m.maxHp;
        m.halfDead = false;
        m.data.phase2 = true;
        delete m.data.rebirthPending;
        const str = m.powers.find((x) => x.id === "STRENGTH");
        if (str) str.amount = Math.max(0, str.amount);
        m.powers.push({ id: "MINION_LEADER", amount: 1, justApplied: false, data: null });
        removePower(ctx, ctx.owner, "AWAKENED_REBIRTH");
        ctx.rng("aiRng").random(99); // noOpRollMove parity
        setIntent(m, "AWAKENED_ONE_DARK_ECHO");
      },
    },
  },
  {
    // Time Eater: counter 0..11; the 12th card played resets it, grants +2
    // Strength and ENDS the player's turn (pending card plays fizzle).
    id: "TIME_WARP",
    name: "Time Warp",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onAfterCardPlayed: (ctx) => {
        const p = ctx.power!;
        if (p.amount < 11) {
          p.amount += 1;
          return;
        }
        p.amount = 0;
        applyPower(ctx, ctx.owner, ctx.owner, "STRENGTH", 2);
        ctx.combat!.cardQueue.length = 0; // queued plays are cleared
        queueEndTurn(ctx); // callEndTurnEarlySequence
      },
    },
  },
  {
    // Time Eater Head Slam: draw X fewer cards next turn.
    id: "DRAW_REDUCTION",
    name: "Draw Reduction",
    kind: "debuff",
    stacking: "intensity",
    turnBased: true,
    hooks: {
      modifyDrawPerTurn: (ctx, n) => n - ctx.power!.amount,
    },
  },
  {
    // Marker: minions abandon combat without their leader (the engine's
    // victory check keys off category "minion").
    id: "MINION",
    name: "Minion",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {},
  },
  {
    // Marker: killing this monster ends the fight (Reptomancer via the
    // dagger minion category; phase-2 Awakened One via its onDeath).
    id: "MINION_LEADER",
    name: "Minion Leader",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {},
  },
  {
    // Spire elites: x1.5 damage while the Surrounded player is not facing
    // this monster. Folded in each elite's atDamageGive AFTER its pre-seeded
    // Strength instance (corpus order: +strength, then x1.5, then weak).
    id: "BACK_ATTACK",
    name: "Back Attack",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      atDamageGive: (ctx, d, type) => {
        if (ctx.owner.kind !== "monster" || type !== "attack") return d;
        const surrounded = ctx.combat!.player.powers.find((p) => p.id === "SURROUNDED");
        if (!surrounded) return d;
        const facing = (surrounded.data?.facing as number | undefined) ?? 1;
        return facing === ctx.owner.idx ? d : f32mul(d, 1.5);
      },
    },
  },
  {
    // Player marker in the Spire elite fight; tracks facing = the monster
    // last targeted by a card (initially slot 1, the Spire Spear).
    id: "SURROUNDED",
    name: "Surrounded",
    kind: "debuff",
    stacking: "none",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, _card, target) => {
        if (target !== null && target !== undefined) ctx.power!.data = { facing: target };
      },
    },
  },
  {
    // Deca asc19 (and Shelled Parasite in act 2 — corpus-identical dup is
    // merge-safe): end-of-turn block X; unblocked attack damage removes 1.
    id: "PLATED_ARMOR",
    name: "Plated Armor",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurnPreEndOfTurnCards: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
      },
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (ctx.owner.kind === "monster" && !isPlayerTurn) {
          ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
        }
      },
      wasHPLost: (ctx, info) => {
        if (info.type !== "attack") return;
        ctx.queue.addToTop({ kind: "reducePower", target: ctx.owner, powerId: "PLATED_ARMOR", amount: 1 });
      },
    },
  },
  {
    // Corrupt Heart: the player takes X (blockable, unmodified) damage after
    // every card they play. Player Intangible caps it at 1 (checked here —
    // the engine folds atDamageFinalReceive only in the calc pipelines).
    id: "BEAT_OF_DEATH",
    name: "Beat of Death",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onAfterCardPlayed: (ctx) => {
        const intangible = ctx.combat!.player.powers.some((p) => p.id === "INTANGIBLE" && p.amount > 0);
        ctx.queue.addToBottom({
          kind: "damage",
          target: PLAYER,
          info: {
            type: "thorns",
            source: ctx.owner,
            amount: intangible ? Math.min(ctx.power!.amount, 1) : ctx.power!.amount,
          },
        });
      },
    },
  },
  {
    // Corrupt Heart: can lose at most `amount` more HP this turn; the
    // allowance resets to data.base (300 / 200 at asc19) at the start of the
    // owner's turn. Clamps via the monster-side onLoseHp fold.
    id: "INVINCIBLE",
    name: "Invincible",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        const p = ctx.power!;
        p.amount = (p.data?.base as number | undefined) ?? p.amount;
      },
      onLoseHp: (ctx, amount) => {
        const p = ctx.power!;
        const dealt = Math.max(0, Math.min(amount, p.amount));
        p.amount -= dealt;
        return dealt;
      },
    },
  },
  {
    // Corrupt Heart buff #3: every attack hit that makes the player lose HP
    // adds X Wounds to the discard pile.
    id: "PAINFUL_STABS",
    name: "Painful Stabs",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onAttack: (ctx, _target, info, unblocked) => {
        if (info.type !== "attack" || unblocked <= 0) return;
        ctx.queue.addToBottom({
          kind: "makeTempCard",
          defId: "WOUND",
          upgrades: 0,
          dest: "discard",
          n: ctx.power!.amount,
        });
      },
    },
  },
  {
    // The Guardian's defensive mode (deferred to this workstream by act 1):
    // whenever the player plays an Attack, they take X damage.
    id: "SHARP_HIDE",
    name: "Sharp Hide",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type !== "attack") return;
        ctx.queue.addToBottom({
          kind: "damage",
          target: PLAYER,
          info: { type: "thorns", source: ctx.owner, amount: ctx.power!.amount },
        });
      },
    },
  },
];
