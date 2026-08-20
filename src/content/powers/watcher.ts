// Watcher powers (exact V2.3.4 behavior), created by the purple card pool.
// Ids/kind/stacking audited against data/corpus/powers.json (note the corpus
// ids: DEVA is Deva Form's power, BLASPHEMER is Blasphemy's "die next turn",
// WRATH_NEXT_TURN + DRAW_CARD_NEXT_TURN are Simmering Fury's pair, MARK is
// Pressure Points' debuff, BLOCK_RETURN is Talk to the Hand's, FREE_ATTACK_POWER
// is Swivel's). MANTRA_GAINED at the bottom is a non-corpus helper (see note).

import type { PowerDef } from "../../engine/content/defs";
import { PLAYER, monster } from "../../engine/core/ids";

export const watcherPowers: PowerDef[] = [
  {
    // "Whenever a card is Retained, lower its cost by X." Permanent for the
    // combat (the game's setCostForCombat): both cost and costForTurn drop.
    id: "ESTABLISHMENT",
    name: "Establishment",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onRetain: (ctx, card) => {
        if (card.cost <= 0) return; // X-cost/unplayable/0-cost untouched
        card.cost = Math.max(0, card.cost - ctx.power!.amount);
        card.costForTurn = Math.max(0, card.costForTurn - ctx.power!.amount);
      },
    },
  },
  {
    // "Whenever you switch Stances, gain X Block." Plain GainBlockAction in the
    // game: no Dexterity/Frail (fromCard false).
    id: "MENTAL_FORTRESS",
    name: "Mental Fortress",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onChangeStance: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
      },
    },
  },
  {
    // "Whenever you enter Wrath, draw X cards." (game id ADAPTATION)
    id: "RUSHDOWN",
    name: "Rushdown",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onChangeStance: (ctx, _from, to) => {
        if (to === "WRATH") ctx.queue.addToBottom({ kind: "draw", n: ctx.power!.amount });
      },
    },
  },
  {
    // "Whenever you Scry, gain X Block." Fires once per scry action (onScry),
    // not per card looked at. Plain block (no Dexterity).
    id: "NIRVANA",
    name: "Nirvana",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onScry: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
      },
    },
  },
  {
    // "At the end of your turn, shuffle X Insights into your draw pile."
    id: "STUDY",
    name: "Study",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (!isPlayerTurn) return;
        ctx.queue.addToBottom({ kind: "makeTempCard", defId: "INSIGHT", upgrades: 0, dest: "draw", n: ctx.power!.amount });
      },
    },
  },
  {
    // "At the start of your turn, gain X Mantra." Routed through the tracked
    // gain so Brilliance's "Mantra gained this combat" counter sees it.
    id: "DEVOTION",
    name: "Devotion",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "effect", ref: "watcher/gainMantra", args: { n: ctx.power!.amount } });
      },
    },
  },
  {
    // Deva Form. "At the start of your turn, gain [gain] Energy and increase
    // this gain by X." The current gain lives in power data (starts at the
    // stack amount: 1 per Deva Form played); each turn it grows by amount.
    id: "DEVA",
    name: "Deva",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        const p = ctx.power!;
        const gain = (p.data?.gain as number | undefined) ?? p.amount;
        ctx.queue.addToBottom({ kind: "gainEnergy", n: gain });
        p.data = { gain: gain + p.amount };
      },
    },
  },
  {
    // "At the start of your turn, add X Smites into your hand."
    // ENGINE-NOTE: our startPlayerTurn draws synchronously, so the queued add
    // lands after the turn's normal draw (Brutality precedent in ironclad.ts).
    id: "BATTLE_HYMN",
    name: "Battle Hymn",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "makeTempCard", defId: "SMITE", upgrades: 0, dest: "hand", n: ctx.power!.amount });
      },
    },
  },
  {
    // "At the end of your turn, if you are in Calm, gain X Block." Same trigger
    // site as Metallicize (before end-of-turn card self-triggers).
    id: "LIKE_WATER",
    name: "Like Water",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurnPreEndOfTurnCards: (ctx) => {
        if (ctx.combat!.player.stance !== "CALM") return;
        ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
      },
    },
  },
  {
    // "At the start of your turn, Scry X." (game id WIREHEADING)
    // ENGINE-NOTE: the game scries BEFORE the turn's draw; our startPlayerTurn
    // draws synchronously, so the queued scry resolves after it (Brutality
    // precedent). Goes through watcher/scryStart, not the raw scry action —
    // see the ENGINE-GAP note on scryStart in cards/watcher/effects.ts.
    id: "FORESIGHT",
    name: "Foresight",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "effect", ref: "watcher/scryStart", args: { n: ctx.power!.amount } });
      },
    },
  },
  {
    // "Whenever you gain Block, apply X Weak to ALL enemies." Lasts this turn.
    id: "WAVE_OF_THE_HAND",
    name: "Wave of the Hand",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onGainedBlock: (ctx) => {
        for (const m of ctx.combat!.monsters) {
          if (m.isDead || m.isEscaped) continue;
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: PLAYER,
            target: monster(m.idx),
            powerId: "WEAK",
            amount: ctx.power!.amount,
          });
        }
      },
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (isPlayerTurn) {
          ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "WAVE_OF_THE_HAND" });
        }
      },
    },
  },
  {
    // "Whenever a card is created during combat, Upgrade it."
    id: "MASTER_REALITY",
    name: "Master Reality",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      modifyCreatedCardUpgrades: (_ctx, n) => Math.max(n, 1),
    },
  },
  {
    // Blasphemy's "Die next turn." (game id ENDTURNDEATH). Pure HP loss —
    // bypasses block, hits the onLoseHp clamps like any other loss.
    id: "BLASPHEMER",
    name: "Blasphemer",
    kind: "debuff",
    stacking: "none",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "loseHp", target: ctx.owner, amount: 9999 });
      },
    },
  },
  {
    // "At the start of your next X turns, put a Miracle+ into your hand."
    // ENGINE-NOTE: corpus powers.json tags COLLECT turnBased, but the game's
    // CollectPower self-reduces when it triggers (not at end of round) — a
    // round-end tick on top would halve its lifetime, so turnBased stays false
    // here and the power decrements itself (exact "next X turns" behavior).
    id: "COLLECT",
    name: "Collect",
    kind: "buff",
    stacking: "duration",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "makeTempCard", defId: "MIRACLE", upgrades: 1, dest: "hand", n: 1 });
        ctx.queue.addToBottom({ kind: "reducePower", target: ctx.owner, powerId: "COLLECT", amount: 1 });
      },
    },
  },
  {
    // Simmering Fury half 1: "Enter Wrath at the start of your turn."
    id: "WRATH_NEXT_TURN",
    name: "Simmering Rage",
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "changeStance", stanceId: "WRATH" });
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "WRATH_NEXT_TURN" });
      },
    },
  },
  {
    // Simmering Fury half 2 (shared game power): "Draw X additional cards next
    // turn." ENGINE-NOTE: lands after the turn's normal draw (see Battle Hymn).
    id: "DRAW_CARD_NEXT_TURN",
    name: "Draw Card",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "draw", n: ctx.power!.amount });
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "DRAW_CARD_NEXT_TURN" });
      },
    },
  },
  {
    // Talk to the Hand's mark: "When attacked, you gain X Block." On the
    // MONSTER; the player gains the block. Triggers on every player attack
    // damage action (per hit), even fully blocked ones (game parity —
    // BlockReturnPower has no damage check).
    id: "BLOCK_RETURN",
    name: "Block Return",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onAttacked: (ctx, info) => {
        if (info.type === "attack" && info.source?.kind === "player") {
          ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: ctx.power!.amount, fromCard: false });
        }
      },
    },
  },
  {
    // Pressure Points' mark: "Whenever you play Pressure Points, lose X HP."
    // Inert marker — the HP loss is driven by the card (watcher/pressurePoints).
    id: "MARK",
    name: "Mark",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {},
  },
  {
    // Swivel: "Ignore energy cost on the next X Attacks you play." The cost
    // fold zeroes attacks while a stack remains; playing an attack consumes
    // one stack (the reducePower resolves after the play has already paid 0).
    id: "FREE_ATTACK_POWER",
    name: "Free Attack Power",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      modifyCardCost: (ctx, cost, card) =>
        ctx.bundle.cards.get(card.defId)?.type === "attack" ? 0 : cost,
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type === "attack") {
          ctx.queue.addToBottom({ kind: "reducePower", target: ctx.owner, powerId: "FREE_ATTACK_POWER", amount: 1 });
        }
      },
    },
  },
  {
    // "At the start of your turn, lose X Energy." (game id ENERGYDOWN)
    // ENGINE-NOTE: the corpus describes Fasting as an energyPerTurn reduction;
    // energyPerTurn is not content-mutable, but ordering makes this exact:
    // startPlayerTurn recharges synchronously BEFORE queued atStartOfTurn
    // actions drain, so this loseEnergy always lands right after the recharge
    // (net energyPerTurn - X, clamped at 0), before any card is playable.
    id: "FASTING",
    name: "Fasting",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "loseEnergy", n: ctx.power!.amount });
      },
    },
  },

  // --- helper powers (engine workarounds; not in the corpus power list) --------
  {
    // ENGINE-GAP workaround: Brilliance needs "Mantra gained this combat" and
    // the engine has no onGainMantra hook (mantra is raw player state). This
    // hidden tally (BLOOD_FOR_BLOOD precedent) is maintained two ways:
    //  - cooperatively: every watcher-slice mantra source routes through the
    //    watcher/gainMantra effect, which adds n and predicts the post-gain
    //    mantra in data.lastSeen;
    //  - by reconciliation: raw {kind:"gainMantra"} sources (Damaru) are caught
    //    at the next checkpoint — a tracked gain, a mantra-driven Divinity
    //    entry (the +10 threshold crossing below), or a Brilliance play.
    // Known imprecision (documented): a direct Divinity entry that does NOT
    // come from mantra (Ambrosia potion) is indistinguishable from a raw
    // 10-mantra threshold crossing and overcounts +10 while this tally exists;
    // the watcher's own Blasphemy avoids this via data.skipDivinity.
    id: "MANTRA_GAINED",
    name: "Mantra Gained",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onChangeStance: (ctx, _from, to) => {
        const p = ctx.power!;
        const data = (p.data ??= { lastSeen: 0 });
        const lastSeen = (data.lastSeen as number | undefined) ?? 0;
        const now = ctx.combat!.player.mantra;
        if (to === "DIVINITY") {
          if (data.skipDivinity) {
            data.skipDivinity = false;
          } else {
            // mantra-driven entry: 10 was consumed crossing the threshold
            p.amount += now - lastSeen + 10;
          }
        } else if (now > lastSeen) {
          p.amount += now - lastSeen; // stray raw gains since the last checkpoint
        }
        data.lastSeen = now;
      },
    },
  },
];
