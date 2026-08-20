// Core shared powers (exact V2.3.4 behavior). Audited against data/corpus/powers.json.

import type { PowerDef } from "../../engine/content/defs";
import { f32add, f32mul } from "../../engine/core/math";
import { PLAYER, monster } from "../../engine/core/ids";
import { hasRelic } from "../util";

export const corePowers: PowerDef[] = [
  {
    id: "STRENGTH",
    name: "Strength",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    canGoNegative: true,
    hooks: { atDamageGive: (ctx, d) => f32add(d, ctx.power!.amount) },
  },
  {
    id: "DEXTERITY",
    name: "Dexterity",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    canGoNegative: true,
    hooks: { modifyBlock: (ctx, b) => f32add(b, ctx.power!.amount) },
  },
  {
    id: "VULNERABLE",
    name: "Vulnerable",
    kind: "debuff",
    stacking: "duration",
    turnBased: true,
    hooks: {
      atDamageReceive: (ctx, d) => {
        // owner is the one TAKING damage
        if (ctx.owner.kind === "monster" && hasRelic(ctx, "PAPER_PHROG")) return f32mul(d, 1.75);
        if (ctx.owner.kind === "player" && hasRelic(ctx, "ODD_MUSHROOM")) return f32mul(d, 1.25);
        return f32mul(d, 1.5);
      },
    },
  },
  {
    id: "WEAK",
    name: "Weak",
    kind: "debuff",
    stacking: "duration",
    turnBased: true,
    hooks: {
      atDamageGive: (ctx, d) => {
        if (ctx.owner.kind === "monster" && hasRelic(ctx, "PAPER_KRANE")) return f32mul(d, 0.6);
        return f32mul(d, 0.75);
      },
    },
  },
  {
    id: "FRAIL",
    name: "Frail",
    kind: "debuff",
    stacking: "duration",
    turnBased: true,
    hooks: { modifyBlock: (ctx, b) => f32mul(b, 0.75) },
  },
  {
    id: "VIGOR",
    name: "Vigor",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atDamageGive: (ctx, d) => f32add(d, ctx.power!.amount),
      onAfterCardPlayed: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type === "attack") {
          ctx.queue.addToTop({ kind: "removePower", target: ctx.owner, powerId: "VIGOR" });
        }
      },
    },
  },
  {
    id: "RITUAL",
    name: "Ritual",
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
    id: "CURL_UP",
    name: "Curl Up",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      onAttacked: (ctx, info, damageTaken) => {
        if (info.type === "attack" && damageTaken > 0) {
          ctx.queue.addToTop({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
          ctx.queue.addToTop({ kind: "removePower", target: ctx.owner, powerId: "CURL_UP" });
        }
      },
    },
  },
  {
    id: "ANGRY",
    name: "Angry",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      // triggers on ANY attack received, even fully blocked (the game's AngryPower has no damage check)
      onAttacked: (ctx, info, _damageTaken) => {
        if (info.type === "attack" && info.source?.kind === "player") {
          ctx.queue.addToTop({
            kind: "applyPower",
            source: ctx.owner,
            target: ctx.owner,
            powerId: "STRENGTH",
            amount: ctx.power!.amount,
          });
        }
      },
    },
  },
  {
    id: "ENRAGE",
    name: "Enrage",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type === "skill") {
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: ctx.owner,
            target: ctx.owner,
            powerId: "STRENGTH",
            amount: ctx.power!.amount,
          });
        }
      },
    },
  },
  {
    id: "METALLICIZE",
    name: "Metallicize",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurnPreEndOfTurnCards: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
      },
      // monsters gain their metallicize at the end of THEIR turn
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (ctx.owner.kind === "monster" && !isPlayerTurn) {
          ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
        }
      },
    },
  },
  {
    id: "THORNS",
    name: "Thorns",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onAttacked: (ctx, info) => {
        if (info.type === "attack" && info.source) {
          ctx.queue.addToTop({
            kind: "damage",
            target: info.source,
            info: { type: "thorns", source: ctx.owner, amount: ctx.power!.amount },
          });
        }
      },
    },
  },
  {
    id: "ARTIFACT",
    name: "Artifact",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {}, // negation handled by the power runtime
  },
  {
    id: "BARRICADE",
    name: "Barricade",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: { modifyBlockRetention: (ctx) => ctx.combat!.player.block },
  },
  {
    id: "SPORE_CLOUD",
    name: "Spore Cloud",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {}, // applied by Fungi Beast's onDeath
  },
  {
    id: "INTANGIBLE",
    name: "Intangible",
    kind: "buff",
    stacking: "duration",
    turnBased: true,
    hooks: { atDamageFinalReceive: (_ctx, d) => Math.min(d, 1) },
  },
];
