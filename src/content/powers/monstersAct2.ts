// Powers introduced by act-2 monsters (beyond powers/core.ts, act-1 powers and
// the relic support powers). Audited against data/corpus/powers.json and the
// per-monster specs in data/corpus/monsters-act2.json.
//
// REUSED (defined elsewhere, semantics verified against the act-2 corpus):
//   PLATED_ARMOR  relics/supportPowers.ts - end-of-its-turn block + loses 1 per
//                 unblocked attack hit (Shelled Parasite; the armor-break stun
//                 is the marker power below).
//   CONFUSED      relics/supportPowers.ts - randomizes drawn card costs 0-3,
//                 roll always consumed (Snecko's Perplexing Glare).
//   THIEVERY      powers/monstersAct1.ts - gold stolen per attack (Mugger).
//   ARTIFACT/BARRICADE/METALLICIZE/STRENGTH/... powers/core.ts.
//
// CONFLICT HONORED (BYRD flight-removal): the corpus adjudicates the game/wiki
// power semantics over lightspeed's status bookkeeping - FLIGHT is REMOVED when
// it hits 0 (a grounded Byrd takes full damage and only regains Flight via
// BYRD_FLY); lightspeed's AI logic is kept for all move selection.

import type { PowerDef } from "../../engine/content/defs";
import { f32mul } from "../../engine/core/math";
import { replaceIntent } from "../monsters/act1/_shared";

/** Monster id -> stun move forced when its FLIGHT stacks are depleted. */
const GROUNDED_MOVES: Record<string, string> = {
  BYRD: "BYRD_STUNNED",
};

/** Monster id -> stun move forced when the hit that empties PLATED_ARMOR lands. */
const ARMOR_BREAK_STUN_MOVES: Record<string, string> = {
  SHELLED_PARASITE: "SHELLED_PARASITE_STUNNED",
};

export const act2MonsterPowers: PowerDef[] = [
  {
    // Byrd: incoming attack damage is halved (after Vulnerable, floored at the
    // end of the pipeline); each unblocked attack hit removes 1 stack. When the
    // last stack is lost the power is removed and the current intent becomes
    // the grounded stun. While airborne the amount resets to 3 (asc>=17: 4) at
    // the end of every round (the reference resets at the start of the player's
    // turn; nothing acts between the two points).
    id: "FLIGHT",
    name: "Flying",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atDamageFinalReceive: (ctx, d) => (ctx.power!.amount > 0 ? f32mul(d, 0.5) : d),
      wasHPLost: (ctx, info) => {
        if (ctx.owner.kind !== "monster" || info.type !== "attack") return;
        const p = ctx.power!;
        if (p.amount <= 0) return;
        p.amount -= 1;
        if (p.amount > 0) return;
        ctx.queue.addToTop({ kind: "removePower", target: ctx.owner, powerId: "FLIGHT" });
        const m = ctx.combat!.monsters[ctx.owner.idx]!;
        const grounded = GROUNDED_MOVES[m.id];
        if (!grounded || m.move === grounded) return;
        if (ctx.combat!.playerTurn) {
          replaceIntent(m, grounded);
        } else {
          // grounded during its own turn (thorns): getMove consumes this flag
          m.data.pendingGrounded = true;
        }
      },
      atEndOfRound: (ctx) => {
        ctx.power!.amount = ctx.asc >= 17 ? 4 : 3;
      },
    },
  },
  {
    // Chosen: whenever the player plays a non-Attack card, shuffle X Dazed
    // into the draw pile.
    id: "HEX",
    name: "Hex",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.owner.kind !== "player") return;
        if (ctx.bundle.cards.get(card.defId)?.type === "attack") return;
        ctx.queue.addToBottom({
          kind: "makeTempCard",
          defId: "DAZED",
          upgrades: 0,
          dest: "draw",
          n: ctx.power!.amount,
        });
      },
    },
  },
  {
    // Book of Stabbing: every unblocked attack hit it lands on the player adds
    // X Wounds (X = 1) to the discard pile - one trigger per damaging hit.
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
          n: Math.max(1, ctx.power!.amount),
        });
      },
    },
  },
  {
    // Snake Plant: gains block equal to the current amount each time it takes
    // unblocked attack damage, then the amount grows by 1; resets to its base
    // (3) at the end of every round.
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
    // Marker: minions abandon combat without their leader. The escape itself is
    // the leader's onDeath (escapeMinions); the engine's victory check also
    // treats category "minion" monsters as non-blocking.
    id: "MINION",
    name: "Minion",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {},
  },
  {
    // Marker on Gremlin Leader / Bronze Automaton / The Collector: when this
    // creature dies its minions abandon combat (MonsterDef.onDeath).
    id: "MINION_LEADER",
    name: "Minion Leader",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {},
  },
  {
    // Marker on a Bronze Orb holding a stolen card (self.data.stasisCardIid);
    // the card returns to the player's hand via the orb's onDeath.
    id: "STASIS",
    name: "Stasis",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {},
  },
  {
    // Shelled Parasite's Suck: one-shot marker applied around the attack -
    // heals the owner for the unblocked damage the hit dealt (the reference's
    // VampireAttack heals min(attackDamage, damage taken); unblocked damage
    // here is that minimum by construction). Removed right after the attack.
    id: "HEAL_FOR_UNBLOCKED_DAMAGE",
    name: "Vampiric",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      onAttack: (ctx, _target, info, unblocked) => {
        if (info.type !== "attack" || unblocked <= 0) return;
        ctx.queue.addToTop({ kind: "heal", target: ctx.owner, amount: unblocked });
      },
    },
  },
  {
    // Shelled Parasite: engine-side rule in the reference (Monster.cpp
    // attackedUnblockedHelper) - when the unblocked attack hit that empties
    // PLATED_ARMOR lands, the current move is replaced with the stun (it loses
    // its next turn). The shared PLATED_ARMOR power QUEUES its -1, so this
    // marker (applied after it, firing in the same hook pass) still sees the
    // pre-decrement amount: amount == 1 means this hit breaks the armor. The
    // armor never returns, so this fires at most once per combat.
    id: "PLATED_ARMOR_BREAK_STUN",
    name: "Armor Break Stun",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      wasHPLost: (ctx, info) => {
        if (ctx.owner.kind !== "monster" || info.type !== "attack") return;
        const m = ctx.combat!.monsters[ctx.owner.idx]!;
        const armor = m.powers.find((p) => p.id === "PLATED_ARMOR");
        if (!armor || armor.amount !== 1) return;
        const stun = ARMOR_BREAK_STUN_MOVES[m.id];
        if (!stun || m.move === stun) return;
        if (ctx.combat!.playerTurn) {
          replaceIntent(m, stun);
        } else {
          m.data.pendingStun = true;
        }
      },
    },
  },
];
