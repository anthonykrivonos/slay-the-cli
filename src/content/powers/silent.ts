// Silent powers (exact V2.3.4 behavior), created by the green card pool.
// Audited against data/corpus/powers.json. Where a power id here differs from
// the corpus id it is noted inline (the workstream disambiguates card/power id
// collisions with a _POWER suffix: WRAITH_FORM_POWER / CORPSE_EXPLOSION_POWER /
// NIGHTMARE_POWER; A_THOUSAND_CUTS keeps the card's id - corpus power id is
// THOUSAND_CUTS). MASTERFUL_STAB at the bottom is a helper power (engine
// workaround, not a corpus power).
//
// Shared corpus powers used by green cards but owned by other slices are
// re-exported by reference at the bottom (map-merge by id is safe - identical
// objects): NO_DRAW (ironclad), GENERIC_STRENGTH_UP (colorless),
// NEXT_TURN_BLOCK (relic support).

import type { PowerDef } from "../../engine/content/defs";
import { f32add, f32mul } from "../../engine/core/math";
import { PLAYER, monster } from "../../engine/core/ids";
import { executeAction } from "../../engine/combat/interpreter";
import { reducePower } from "../../engine/combat/powerRuntime";
import { ironcladPowers } from "./ironclad";
import { colorlessPowers } from "../cards/colorless/powers";
import { relicSupportPowers } from "../relics/supportPowers";

function shared(pool: PowerDef[], id: string): PowerDef {
  const def = pool.find((p) => p.id === id);
  if (!def) throw new Error(`shared power ${id} not found`);
  return def;
}

export const silentPowers: PowerDef[] = [
  {
    // "At the start of its turn, loses X HP, then reduce Poison by 1."
    // The corpus marks POISON turnBased, but the decrement is owned by this
    // start-of-turn tick; turnBased would ALSO decrement at end of round
    // (double tick), so the power manages its own countdown (Blur/Phantasmal
    // do the same below).
    id: "POISON",
    name: "Poison",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        const amt = ctx.power!.amount;
        if (amt <= 0) return;
        // SYNCHRONOUS loseHp (bypasses block; fires wasHPLost - wakes Lagavulin,
        // triggers Corpse Explosion/Mode Shift) so the HP loss lands before the
        // owner's move queues its damage. THEN stacks -1 (removed at 0).
        // A monster killed here does not act: executeMonsterMove re-checks
        // isDead after this hook. ENGINE-GAP (still open): its next-move roll
        // happens before queued wake effects resolve (see the Lagavulin test).
        executeAction(ctx, { kind: "loseHp", target: ctx.owner, amount: amt });
        reducePower(ctx, ctx.owner, "POISON", 1);
      },
    },
  },
  {
    id: "ACCURACY",
    name: "Accuracy",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      // "Shivs deal X additional damage." The game raises the Shiv's BASE
      // damage, so multipliers (Double Damage/Phantasmal, Wrath, Pen Nib)
      // apply AFTER the add: (base + X) * mult.
      // ORDERING CAVEAT: our damage pipeline folds player powers in
      // APPLICATION order. With ACCURACY applied before a Double Damage-style
      // multiplier the result matches the game; applying the multiplier power
      // first would yield base * mult + X instead. Adopted order (application
      // order) is documented by a test in cardsSilentPowers.test.ts.
      atDamageGive: (ctx, d, _type, card) =>
        card && card.defId === "SHIV" ? f32add(d, ctx.power!.amount) : d,
    },
  },
  {
    // "Whenever you play a card, gain X Block." (plain gain: no Dexterity)
    id: "AFTER_IMAGE",
    name: "After Image",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainBlock", target: ctx.owner, amount: ctx.power!.amount, fromCard: false });
      },
    },
  },
  {
    // "Whenever you play a card, deal X damage to ALL enemies." (THORNS type)
    // Corpus power id: THOUSAND_CUTS (card id kept per workstream naming).
    id: "A_THOUSAND_CUTS",
    name: "Thousand Cuts",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx) => {
        const amounts = ctx.combat!.monsters.map(() => ctx.power!.amount);
        ctx.queue.addToBottom({ kind: "damageAllMonsters", amounts, info: { type: "thorns", source: PLAYER } });
      },
    },
  },
  {
    // "Whenever an Attack deals unblocked damage, apply X Poison."
    id: "ENVENOM",
    name: "Envenom",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onAttack: (ctx, target, info, unblocked) => {
        if (info.type !== "attack" || unblocked <= 0) return;
        if (target.kind !== "monster") return;
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: PLAYER,
          target,
          powerId: "POISON",
          amount: ctx.power!.amount,
        });
      },
    },
  },
  {
    // "At the start of your turn, apply X Poison to ALL enemies."
    id: "NOXIOUS_FUMES",
    name: "Noxious Fumes",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        for (const m of ctx.combat!.monsters) {
          if (m.isDead || m.isEscaped) continue;
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: PLAYER,
            target: monster(m.idx),
            powerId: "POISON",
            amount: ctx.power!.amount,
          });
        }
      },
    },
  },
  {
    // "At the end of your turn, lose X Dexterity." Corpus id: WRAITH_FORM.
    // CONFLICT HONORED: the corpus power text says "start of your turn"; the
    // card text ("At the end of your turn, lose 1 Dexterity") and V2.3.4's
    // WraithFormPower.atEndOfTurn agree on end of turn - end of turn it is.
    id: "WRAITH_FORM_POWER",
    name: "Wraith Form",
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
          powerId: "DEXTERITY",
          amount: -ctx.power!.amount,
        });
      },
    },
  },
  {
    // "At the start of your turn, add X Shivs to your hand."
    // ENGINE-NOTE: startPlayerTurn draws synchronously, so the queued shivs
    // land after the turn's normal draw (Brutality precedent).
    id: "INFINITE_BLADES",
    name: "Infinite Blades",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "makeTempCard", defId: "SHIV", upgrades: 0, dest: "hand", n: ctx.power!.amount });
      },
    },
  },
  {
    // "At the start of your turn, draw X cards and discard X cards."
    // The discard is a player choice: the hook enqueues an effect so the pause
    // can snapshot/replay the rest of the queue (see effects.ts).
    id: "TOOLS_OF_THE_TRADE",
    name: "Tools of the Trade",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurnPostDraw: (ctx) => {
        const n = ctx.power!.amount;
        ctx.queue.addToBottom({ kind: "draw", n });
        ctx.queue.addToBottom({
          kind: "effect",
          ref: "silent/discardChoose",
          args: { n, reason: "Tools of the Trade: discard" },
        });
      },
    },
  },
  {
    // "Your next X Skills are played twice this turn." Mirrors DOUBLE_TAP's
    // queue-duplication exactly, gated on type skill.
    id: "BURST",
    name: "Burst",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx, card, target) => {
        if (ctx.power!.amount <= 0) return;
        if (ctx.bundle.cards.get(card.defId)?.type !== "skill") return;
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
          via: "BURST",
        });
        ctx.queue.addToBottom({ kind: "reducePower", target: ctx.owner, powerId: "BURST", amount: 1 });
      },
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (isPlayerTurn) ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "BURST" });
      },
    },
  },
  {
    // "Deal Double Damage for the next X turns." (Phantasmal Killer)
    // Corpus marks it turnBased, but the game's PhantasmalPower decrements
    // itself at the START of the turn it grants Double Damage - end-of-round
    // ticking would remove it before it ever fires. Self-managed countdown.
    id: "PHANTASMAL",
    name: "Phantasmal",
    kind: "buff",
    stacking: "duration",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: ctx.owner,
          target: ctx.owner,
          powerId: "DOUBLE_DAMAGE",
          amount: 1,
        });
        ctx.queue.addToBottom({ kind: "reducePower", target: ctx.owner, powerId: "PHANTASMAL", amount: 1 });
      },
    },
  },
  {
    // "Attacks deal double damage for X turns." Player-applied at turn start
    // (justApplied false), so the normal end-of-round tick expires it after
    // exactly the turn it covers.
    id: "DOUBLE_DAMAGE",
    name: "Double Damage",
    kind: "buff",
    stacking: "duration",
    turnBased: true,
    hooks: {
      atDamageGive: (ctx, d) => f32mul(d, 2),
    },
  },
  {
    // "On death, deal damage equal to its Max HP (times stacks) to ALL
    // enemies." Corpus power id: CORPSE_EXPLOSION (suffix disambiguates from
    // the card). ENGINE-GAP: there is no monster-side onDeath power hook
    // (onMonsterDeath fires on PLAYER sources only), so the dying monster's
    // own wasHPLost + hp<=0 is used, with a data flag guarding re-entry
    // (halfDead corpses can take further hits at 0 HP).
    id: "CORPSE_EXPLOSION_POWER",
    name: "Corpse Explosion",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      wasHPLost: (ctx) => {
        if (ctx.owner.kind !== "monster") return;
        const m = ctx.combat!.monsters[ctx.owner.idx]!;
        if (m.hp > 0) return;
        const p = ctx.power!;
        if (p.data?.exploded) return;
        p.data = { ...(p.data ?? {}), exploded: true };
        // THORNS-type damage (blockable) to ALL enemies; the dead owner is
        // skipped by the damage application itself.
        const amounts = ctx.combat!.monsters.map(() => m.maxHp * p.amount);
        ctx.queue.addToBottom({ kind: "damageAllMonsters", amounts, info: { type: "thorns", source: PLAYER } });
      },
    },
  },
  {
    // "Whenever you play a card this turn, loses X HP." Lives on the choked
    // monster; expires at the end of the player's turn.
    id: "CHOKED",
    name: "Choked",
    kind: "debuff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      onUseCard: (ctx) => {
        ctx.queue.addToBottom({ kind: "loseHp", target: ctx.owner, amount: ctx.power!.amount });
      },
      atEndOfTurn: (ctx, isPlayerTurn) => {
        // monster-owned power: its atEndOfTurn site fires with isPlayerTurn
        // false at the end of ITS turn - no card can be played between the
        // player's end of turn and this, so removal here still means "this turn"
        if (!isPlayerTurn) ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "CHOKED" });
      },
    },
  },
  {
    // "Block is not removed at the beginning of your next X turns."
    // Corpus marks it turnBased, but the countdown belongs at the start of the
    // player's turn AFTER the retention check - end-of-round ticking would
    // remove a 1-stack Blur before it ever preserved anything. Self-managed.
    id: "BLUR",
    name: "Blur",
    kind: "buff",
    stacking: "duration",
    turnBased: false,
    hooks: {
      modifyBlockRetention: (ctx) => ctx.combat!.player.block,
      atStartOfTurn: (ctx) => {
        ctx.queue.addToTop({ kind: "reducePower", target: ctx.owner, powerId: "BLUR", amount: 1 });
      },
    },
  },
  {
    // "At the end of your turn, Retain up to X cards." Fires before the
    // end-of-turn cards (Burn et al.); the selection is a player choice, so
    // the hook enqueues an effect (pause snapshots the queued tail, including
    // the endPlayerTurn marker - see effects.ts).
    id: "WELL_LAID_PLANS",
    name: "Well-Laid Plans",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atEndOfTurnPreEndOfTurnCards: (ctx) => {
        ctx.queue.addToBottom({ kind: "effect", ref: "silent/wellLaidPlansChoose", args: { n: ctx.power!.amount } });
      },
    },
  },
  {
    // "Add X copies of the chosen card into your hand next turn." Corpus power
    // id: NIGHTMARE (suffix disambiguates from the card). data.entries holds
    // one {defId, upgrades, n} per Nightmare cast; amount = total copies.
    id: "NIGHTMARE_POWER",
    name: "Nightmare",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurnPostDraw: (ctx) => {
        const entries =
          (ctx.power!.data?.entries as { defId: string; upgrades: number; n: number }[] | undefined) ?? [];
        for (const e of entries) {
          ctx.queue.addToBottom({ kind: "makeTempCard", defId: e.defId, upgrades: e.upgrades, dest: "hand", n: e.n });
        }
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "NIGHTMARE_POWER" });
      },
    },
  },
  {
    // "Gain X additional Energy next turn." (Outmaneuver, Flying Knee,
    // Doppelganger.) Fires before the recharge; the queued gain resolves after
    // the recharge set the new turn's base energy.
    id: "ENERGIZED",
    name: "Energized",
    kind: "buff",
    stacking: "intensity",
    turnBased: false,
    hooks: {
      atStartOfTurn: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainEnergy", n: ctx.power!.amount });
        ctx.queue.addToBottom({ kind: "removePower", target: ctx.owner, powerId: "ENERGIZED" });
      },
    },
  },
  {
    // "Draw X additional cards next turn." (Predator, Doppelganger.)
    // ENGINE-NOTE: startPlayerTurn draws synchronously, so the queued draw
    // lands after the turn's normal draw (Brutality precedent).
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

  // --- helper powers (engine workarounds; not in the corpus power list) --------
  {
    // ENGINE-GAP workaround: Masterful Stab "costs 1 additional energy for each
    // TIME you lose HP this combat". combatFlags.hpLostThisCombat accumulates
    // AMOUNTS, not instances, and card defs have no wasHPLost hook - so the
    // card applies this hidden power when drawn (Blood for Blood precedent);
    // its amount counts HP-loss EVENTS, which the card's dynamicCost reads.
    // Losses occurring before the first copy is drawn are not counted (the
    // real game counts from combat start via AbstractPlayer.wasHPLost).
    id: "MASTERFUL_STAB",
    name: "Masterful Stab",
    hidden: true, // engine bookkeeping, never shown
    kind: "buff",
    stacking: "none",
    turnBased: false,
    hooks: {
      wasHPLost: (ctx, _info, amount) => {
        if (amount > 0) ctx.power!.amount++;
      },
    },
  },

  // --- shared corpus powers owned by other slices (same object, merge-safe) ----
  shared(ironcladPowers, "NO_DRAW"), // Bullet Time
  shared(colorlessPowers, "GENERIC_STRENGTH_UP"), // Piercing Wail end-of-turn restore
  shared(relicSupportPowers, "NEXT_TURN_BLOCK"), // Dodge and Roll
];
