// Ironclad powers (exact V2.3.4 behavior), created by the red card pool.
// Audited against data/corpus/powers.json. Powers marked "helper" at the bottom
// are engine workarounds for triggers the hook vocabulary cannot express from a
// card def (see ENGINE-GAP comments); they are not corpus powers.

import type { PowerDef } from "../../engine/content/defs";
import type { CardInstance } from "../../engine/combat/combatState";
import { PLAYER } from "../../engine/core/ids";

export const ironcladPowers: PowerDef[] = [
  {
    id: "DEMON_FORM",
    name: "Demon Form",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
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
    id: "CORRUPTION",
    name: "Corruption",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      modifyCardCost: (ctx, a, b) => {
        // ENGINE-NOTE: foldHook passes the folded VALUE first, so the runtime
        // args are (ctx, cost, card) despite the declared (ctx, card, cost).
        const cost = a as unknown as number;
        const card = b as unknown as CardInstance;
        return ctx.bundle.cards.get(card.defId)?.type === "skill" ? 0 : cost;
      },
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type === "skill" && ctx.rt.currentItem) {
          ctx.rt.currentItem.exhaustOnUse = true;
        }
      },
    },
  },
  {
    id: "DARK_EMBRACE",
    name: "Dark Embrace",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onExhaust: (ctx) => {
        ctx.queue.addToBottom({ kind: "draw", n: ctx.power!.amount });
      },
    },
  },
  {
    id: "EVOLVE",
    name: "Evolve",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onDraw: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type === "status") {
          ctx.queue.addToBottom({ kind: "draw", n: ctx.power!.amount });
        }
      },
    },
  },
  {
    id: "FEEL_NO_PAIN",
    name: "Feel No Pain",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onExhaust: (ctx) => {
        // GainBlockAction directly: no Dexterity/Frail (fromCard false)
        ctx.queue.addToTop({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
      },
    },
  },
  {
    id: "FIRE_BREATHING",
    name: "Fire Breathing",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      // V2.3.4: triggers on drawing a Status OR a Curse; THORNS-type damage to all
      onDraw: (ctx, card) => {
        const t = ctx.bundle.cards.get(card.defId)?.type;
        if (t === "status" || t === "curse") {
          const amounts = ctx.combat!.monsters.map(() => ctx.power!.amount);
          ctx.queue.addToBottom({ kind: "damageAllMonsters", amounts, info: { type: "thorns", source: PLAYER } });
        }
      },
    },
  },
  {
    id: "FLAME_BARRIER",
    name: "Flame Barrier",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onAttacked: (ctx, info) => {
        // retaliates on any monster attack, even fully blocked (game parity)
        if (info.type === "attack" && info.source?.kind === "monster") {
          ctx.queue.addToTop({
            kind: "damage",
            target: info.source,
            info: { type: "thorns", source: ctx.owner, amount: ctx.power!.amount },
          });
        }
      },
      // expires at the start of your next turn (FlameBarrierPower.atStartOfTurn)
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "FLAME_BARRIER" });
      },
    },
  },
  {
    id: "JUGGERNAUT",
    name: "Juggernaut",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onGainedBlock: (ctx) => {
        // target chosen when the action resolves (cardRandomRng), like DamageRandomEnemyAction
        ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/juggernautHit", args: { amount: ctx.power!.amount } });
      },
    },
  },
  {
    id: "RAGE",
    name: "Rage",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type === "attack") {
          // plain block gain: no Dexterity (game GainBlockAction)
          ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
        }
      },
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (isPlayerTurn) ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "RAGE" });
      },
    },
  },
  {
    id: "RUPTURE",
    name: "Rupture",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      wasHPLost: (ctx, info, amount) => {
        // "Whenever you lose HP from a card": the game checks info.owner == player.
        // ENGINE-NOTE/assumption: our DamageInfo has no owner field for self-damage;
        // all card-originated self HP loss reaches the player as either an "hpLoss"
        // action (Offering/Bloodletting/Hemokinesis/Combust/Brutality/Regret/Pain)
        // or a source-null "thorns" damage (Burn/Decay). Monster attacks/thorns
        // carry a monster source and are excluded - matching V2.3.4 for every
        // in-scope source.
        if (amount > 0 && info.source === null && (info.type === "hpLoss" || info.type === "thorns")) {
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
    id: "COMBUST",
    name: "Combust",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (!isPlayerTurn) return;
        // 1 HP per Combust PLAYED (tracked in power data by the card), damage = amount
        const hpLoss = ((ctx.power!.data?.hpLoss as number | undefined) ?? 1);
        ctx.queue.addToBottom({ kind: "loseHp", target: ctx.owner, amount: hpLoss });
        const amounts = ctx.combat!.monsters.map(() => ctx.power!.amount);
        ctx.queue.addToBottom({ kind: "damageAllMonsters", amounts, info: { type: "thorns", source: PLAYER } });
      },
    },
  },
  {
    id: "BRUTALITY",
    name: "Brutality",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        // ENGINE-NOTE: the game's Brutality draw resolves before the turn's normal
        // draw; our startPlayerTurn draws synchronously, so this draw lands after.
        ctx.queue.addToBottom({ kind: "loseHp", target: ctx.owner, amount: ctx.power!.amount });
        ctx.queue.addToBottom({ kind: "draw", n: ctx.power!.amount });
      },
    },
  },
  {
    id: "BERSERK",
    name: "Berserk",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainEnergy", n: ctx.power!.amount });
      },
    },
  },
  {
    id: "DOUBLE_TAP",
    name: "Double Tap",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card, target) => {
        if (ctx.power!.amount <= 0) return;
        if (ctx.bundle.cards.get(card.defId)?.type !== "attack") return;
        const item = ctx.rt.currentItem;
        if (!item || item.autoplayed) return; // duplicated plays don't re-trigger
        // duplicate resolves right after the original finishes (free, autoplayed)
        ctx.combat!.cardQueue.unshift({
          iid: card.iid,
          target,
          energyOnUse: item.energyOnUse,
          ignoreEnergyTotal: true,
          regardlessOfCost: true,
          purgeOnUse: false,
          exhaustOnUse: false,
          autoplayed: true,
        });
        ctx.queue.addToBottom({ kind: "reducePower", target: ctx.owner, powerId: "DOUBLE_TAP", amount: 1 });
      },
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (isPlayerTurn) ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "DOUBLE_TAP" });
      },
    },
  },
  {
    id: "NO_DRAW",
    name: "No Draw",
    kind: "debuff",
    stacking: "none",
    turnBased: false,
    hooks: {
      // ENGINE-GAP: drawCards has no veto hook, so card-effect draws (Pommel
      // Strike after Battle Trance) cannot be blocked. modifyDrawPerTurn covers
      // only the start-of-turn draw - moot anyway since the power is removed at
      // end of turn. Enforcement of "cannot draw additional cards" is skipped.
      modifyDrawPerTurn: () => 0,
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (isPlayerTurn) ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "NO_DRAW" });
      },
    },
  },
  {
    id: "LOSE_STRENGTH",
    name: "Strength Down",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (!isPlayerTurn) return;
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: ctx.owner,
          target: ctx.owner,
          powerId: "STRENGTH",
          amount: -ctx.power!.amount,
        });
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "LOSE_STRENGTH" });
      },
    },
  },

  // --- helper powers (engine workarounds; not in the corpus power list) --------
  {
    // ENGINE-GAP workaround: "costs 1 less each TIME you lose HP this combat".
    // combatFlags.hpLostThisCombat accumulates AMOUNTS, not instances, and card
    // defs have no wasHPLost hook, so the card applies this hidden power when
    // drawn; it decrements every BLOOD_FOR_BLOOD instance's cost per HP-loss
    // event. Losses occurring before the first copy is drawn are not counted
    // (the real game counts from combat start via AbstractPlayer.wasHPLost).
    id: "BLOOD_FOR_BLOOD",
    name: "Blood for Blood",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      wasHPLost: (ctx, _info, amount) => {
        if (amount <= 0) return;
        for (const c of Object.values(ctx.combat!.cards)) {
          if (c.defId !== "BLOOD_FOR_BLOOD") continue;
          c.cost = Math.max(0, c.cost - 1);
          c.costForTurn = Math.max(0, c.costForTurn - 1);
        }
      },
    },
  },
  {
    // Normality's in-hand veto. ENGINE-GAP workaround: cards in hand cannot veto
    // other plays, so the curse applies this power when drawn; canPlayCard
    // live-checks the hand so staleness is harmless. The game also surfaces a
    // Normality power icon while the curse is in hand, so the visual matches.
    id: "NORMALITY",
    name: "Normality",
    kind: "debuff",
    stacking: "none",
    turnBased: false,
    hooks: {
      canPlayCard: (ctx) => {
        const hand = ctx.combat!.player.piles.hand;
        const inHand = hand.some((iid) => ctx.combat!.cards[iid]?.defId === "NORMALITY");
        if (inHand && ctx.combat!.turnFlags.cardsPlayedThisTurn >= 3) return false;
        return true;
      },
      atStartOfTurnPostDraw: (ctx) => {
        const hand = ctx.combat!.player.piles.hand;
        if (!hand.some((iid) => ctx.combat!.cards[iid]?.defId === "NORMALITY")) {
          ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "NORMALITY" });
        }
      },
    },
  },
  {
    // Pain's in-hand trigger. ENGINE-GAP workaround: no whileInHand onUseCard
    // exists for card defs, so the curse applies this power when drawn; the hook
    // live-counts Pain copies in hand (the played card sits in limbo, so "other
    // cards" is automatic). One 1-HP loss per copy, like the game's per-card
    // LoseHPAction (each is a separate Rupture trigger).
    id: "PAIN",
    name: "Pain",
    kind: "debuff",
    stacking: "none",
    turnBased: false,
    hooks: {
      onUseCard: (ctx) => {
        const hand = ctx.combat!.player.piles.hand;
        const n = hand.filter((iid) => ctx.combat!.cards[iid]?.defId === "PAIN").length;
        for (let i = 0; i < n; i++) {
          ctx.queue.addToTop({ kind: "loseHp", target: ctx.owner, amount: 1 });
        }
      },
      atStartOfTurnPostDraw: (ctx) => {
        const hand = ctx.combat!.player.piles.hand;
        if (!hand.some((iid) => ctx.combat!.cards[iid]?.defId === "PAIN")) {
          ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "PAIN" });
        }
      },
    },
  },
];
