// Silent uncommon cards. Values audited against data/corpus/cards.json -
// corpus numbers only.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { getPowerAmount } from "../../../engine/combat/powerRuntime";
import { makeTempCard } from "../../../engine/combat/interpreter";

export const silentUncommons: CardDef[] = [
  {
    id: "ACCURACY",
    name: "Accuracy",
    color: "green",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 4 },
    upgradeValues: { magic: 6 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "ACCURACY", n: "magic", target: "self" }],
  },
  {
    id: "ALL_OUT_ATTACK",
    name: "All-Out Attack",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "allenemy",
    values: { damage: 10 },
    upgradeValues: { damage: 14 },
    keywords: [],
    primitives: [{ do: "damageAll", n: "damage" }],
    onPlay: (ctx) => {
      // random discard IS a manual discard (Reflex/Tactician trigger)
      ctx.queue.addToBottom({ kind: "discard", sel: { kind: "random", pile: "hand", n: 1 }, manual: true });
    },
  },
  {
    id: "BACKSTAB",
    name: "Backstab",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { damage: 11 },
    upgradeValues: { damage: 15 },
    keywords: ["exhaust", "innate"],
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "BLUR",
    name: "Blur",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { block: 5 },
    upgradeValues: { block: 8 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "applyPower", power: "BLUR", n: 1, target: "self" },
    ],
  },
  {
    id: "BOUNCING_FLASK",
    name: "Bouncing Flask",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "allenemy",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    onPlay: (ctx) => {
      // "Apply 3 Poison to a random enemy 3 (4) times." Each bounce rolls its
      // target at resolve time (cardRandomRng), like DamageRandomEnemyAction.
      const times = ctx.upgraded ? 4 : 3;
      for (let i = 0; i < times; i++) {
        ctx.queue.addToBottom({ kind: "effect", ref: "silent/bouncingFlaskHit", args: { amount: 3 } });
      }
    },
  },
  {
    id: "CALCULATED_GAMBLE",
    name: "Calculated Gamble",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    upgradeKeywords: [], // upgraded Calculated Gamble no longer Exhausts
    onPlay: (ctx) => {
      // hand size captured at use time (the resolving card sits in limbo)
      const n = ctx.combat!.player.piles.hand.length;
      ctx.queue.addToBottom({ kind: "discard", sel: { kind: "all", pile: "hand" }, manual: true });
      if (n > 0) ctx.queue.addToBottom({ kind: "draw", n });
    },
  },
  {
    id: "CALTROPS",
    name: "Caltrops",
    color: "green",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 5 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "THORNS", n: "magic", target: "self" }],
  },
  {
    id: "CATALYST",
    name: "Catalyst",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: {},
    upgradeValues: {},
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // "Double (Triple) the enemy's Poison": apply current amount x1 (x2)
      // more, read at use time (Catalyst.java parity).
      const target = ctx.target ?? 0;
      const poison = getPowerAmount(ctx, monster(target), "POISON");
      if (poison <= 0) return;
      ctx.queue.addToBottom({
        kind: "applyPower",
        source: PLAYER,
        target: monster(target),
        powerId: "POISON",
        amount: poison * (ctx.upgraded ? 2 : 1),
      });
    },
  },
  {
    id: "CHOKE",
    name: "Choke",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 12, magic: 3 },
    upgradeValues: { damage: 12, magic: 5 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "CHOKED", n: "magic", target: "target" },
    ],
  },
  {
    id: "CONCENTRATE",
    name: "Concentrate",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 2 },
    keywords: [],
    onPlay: (ctx) => {
      const n = ctx.upgraded ? 2 : 3;
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "silent/discardChoose",
        args: { n, reason: `Concentrate: discard ${n}` },
      });
      ctx.queue.addToBottom({ kind: "gainEnergy", n: 2 });
    },
  },
  {
    id: "CRIPPLING_CLOUD",
    name: "Crippling Cloud",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "allenemy",
    values: { magic: 4 },
    upgradeValues: { magic: 7 },
    keywords: ["exhaust"],
    primitives: [
      { do: "applyPower", power: "POISON", n: "magic", target: "all" },
      { do: "applyPower", power: "WEAK", n: 2, target: "all" },
    ],
  },
  {
    id: "DASH",
    name: "Dash",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 10, block: 10 },
    upgradeValues: { damage: 13, block: 13 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "damage", n: "damage" },
    ],
  },
  {
    id: "DISTRACTION",
    name: "Distraction",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // "Add a random Skill into your hand. It costs 0 this turn." The game's
      // returnTrulyRandomCardInCombat(SKILL) draws from EVERY class (cross-
      // class pool), excluding only SPECIAL rarity. ENGINE-NOTE: pool sorted
      // by id for determinism (Infernal Blade precedent); the game's library
      // order differs, so specific rolls map to different cards.
      const pool = [...ctx.bundle.cards.values()]
        .filter((d) => d.type === "skill" && d.rarity !== "special" && d.color !== "curse")
        .sort((a, b) => (a.id < b.id ? -1 : 1));
      if (pool.length === 0) return;
      const pick = pool[ctx.rng("cardRandomRng").random(pool.length - 1)]!;
      const combat = ctx.combat!;
      const iid = combat.nextCardInstanceId;
      makeTempCard(ctx, pick.id, 0, "hand");
      const c = combat.cards[iid];
      if (c) c.costForTurn = 0; // costs 0 this turn
    },
  },
  {
    id: "ENDLESS_AGONY",
    name: "Endless Agony",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { damage: 4 },
    upgradeValues: { damage: 6 },
    keywords: ["exhaust"],
    primitives: [{ do: "damage", n: "damage" }],
    onDrawThis: (ctx) => {
      ctx.queue.addToBottom({
        kind: "makeTempCard",
        defId: "ENDLESS_AGONY",
        upgrades: ctx.card.upgrades,
        dest: "hand",
        n: 1,
      });
    },
  },
  {
    id: "ESCAPE_PLAN",
    name: "Escape Plan",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { block: 3 },
    upgradeValues: { block: 5 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "silent/escapePlan",
        args: { iid: ctx.card.iid, base: ctx.upgraded ? 5 : 3 },
      });
    },
  },
  {
    id: "EVISCERATE",
    name: "Eviscerate",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 3,
    target: "enemy",
    values: { damage: 7 },
    upgradeValues: { damage: 9 },
    keywords: [],
    // "Costs 1 less for each card discarded this turn" - manual discards only,
    // floor 0. Based on costForTurn so other cost-for-turn effects compose.
    dynamicCost: (ctx, c) => Math.max(0, c.costForTurn - ctx.combat!.turnFlags.manualDiscardsThisTurn),
    primitives: [{ do: "damage", n: "damage", hits: 3 }],
  },
  {
    id: "EXPERTISE",
    name: "Expertise",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 6 },
    upgradeValues: { magic: 7 },
    keywords: [],
    onPlay: (ctx) => {
      // "Draw cards until you have 6 (7) in your hand." (resolving card is in limbo)
      const n = (ctx.upgraded ? 7 : 6) - ctx.combat!.player.piles.hand.length;
      if (n > 0) ctx.queue.addToBottom({ kind: "draw", n });
    },
  },
  {
    id: "FINISHER",
    name: "Finisher",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 6 },
    upgradeValues: { damage: 8 },
    keywords: [],
    onPlay: (ctx) => {
      // one hit per Attack played this turn - the counter is incremented
      // before onPlay runs, so Finisher counts itself (game parity: the card
      // joins cardsPlayedThisTurn before use()).
      const target = ctx.target ?? 0;
      const hits = ctx.combat!.turnFlags.attacksPlayedThisTurn;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 8 : 6);
      for (let i = 0; i < hits; i++) {
        ctx.queue.addToBottom({
          kind: "damage",
          target: monster(target),
          info: { type: "attack", source: PLAYER, amount: dmg },
        });
      }
    },
  },
  {
    id: "FLECHETTES",
    name: "Flechettes",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 4 },
    upgradeValues: { damage: 6 },
    keywords: [],
    onPlay: (ctx) => {
      // one hit per Skill in hand at use time (Flechettes itself is in limbo)
      const combat = ctx.combat!;
      const target = ctx.target ?? 0;
      const hits = combat.player.piles.hand.filter(
        (iid) => ctx.bundle.cards.get(combat.cards[iid]!.defId)?.type === "skill",
      ).length;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 6 : 4);
      for (let i = 0; i < hits; i++) {
        ctx.queue.addToBottom({
          kind: "damage",
          target: monster(target),
          info: { type: "attack", source: PLAYER, amount: dmg },
        });
      }
    },
  },
  {
    id: "FOOTWORK",
    name: "Footwork",
    color: "green",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "DEXTERITY", n: "magic", target: "self" }],
  },
  {
    id: "HEEL_HOOK",
    name: "Heel Hook",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 5 },
    upgradeValues: { damage: 8 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      // Weak check happens at use time, before the damage resolves (Dropkick parity)
      if (getPowerAmount(ctx, monster(ctx.target ?? 0), "WEAK") > 0) {
        ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
        ctx.queue.addToBottom({ kind: "draw", n: 1 });
      }
    },
  },
  {
    id: "INFINITE_BLADES",
    name: "Infinite Blades",
    color: "green",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: {},
    keywords: [], // Innate only when upgraded (corpus flags now gate this correctly)
    upgradeKeywords: ["innate"],
    primitives: [{ do: "applyPower", power: "INFINITE_BLADES", n: 1, target: "self" }],
  },
  {
    id: "LEG_SWEEP",
    name: "Leg Sweep",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { block: 11, magic: 2 },
    upgradeValues: { block: 14, magic: 3 },
    keywords: [],
    primitives: [
      { do: "applyPower", power: "WEAK", n: "magic", target: "target" },
      { do: "block", n: "block" },
    ],
  },
  {
    id: "MASTERFUL_STAB",
    name: "Masterful Stab",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { damage: 12 },
    upgradeValues: { damage: 16 },
    keywords: [],
    // "Costs 1 additional energy for each time you lose HP this combat."
    // INSTANCES, not amounts - counted by the hidden MASTERFUL_STAB power the
    // card applies when drawn (see powers/silent.ts for the ENGINE-GAP note).
    dynamicCost: (ctx, c) => c.costForTurn + getPowerAmount(ctx, PLAYER, "MASTERFUL_STAB"),
    onDrawThis: (ctx) => {
      ctx.queue.addToBottom({
        kind: "applyPower",
        source: PLAYER,
        target: PLAYER,
        powerId: "MASTERFUL_STAB",
        amount: 0,
      });
    },
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "NOXIOUS_FUMES",
    name: "Noxious Fumes",
    color: "green",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "NOXIOUS_FUMES", n: "magic", target: "self" }],
  },
  {
    id: "PREDATOR",
    name: "Predator",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 15 },
    upgradeValues: { damage: 20 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "DRAW_CARD_NEXT_TURN", n: 2, target: "self" },
    ],
  },
  {
    id: "REFLEX",
    name: "Reflex",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: -2,
    target: "none",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    // Unplayable; triggers ONLY on manual discards (engine handles the gating)
    onManualDiscardThis: (ctx) => {
      ctx.queue.addToBottom({ kind: "draw", n: ctx.upgraded ? 3 : 2 });
    },
  },
  {
    id: "RIDDLE_WITH_HOLES",
    name: "Riddle with Holes",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 3 },
    upgradeValues: { damage: 4 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage", hits: 5 }],
  },
  {
    id: "SETUP",
    name: "Setup",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "silent/setupChoose" });
    },
  },
  {
    id: "SKEWER",
    name: "Skewer",
    color: "green",
    type: "attack",
    rarity: "uncommon",
    cost: -1,
    target: "enemy",
    values: { damage: 7 },
    upgradeValues: { damage: 10 },
    keywords: [],
    onPlay: (ctx) => {
      // "Deal 7 (10) damage X times." X captured at queue time; engine spends it.
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 10 : 7);
      for (let i = 0; i < ctx.energyOnUse; i++) {
        ctx.queue.addToBottom({
          kind: "damage",
          target: monster(target),
          info: { type: "attack", source: PLAYER, amount: dmg },
        });
      }
    },
  },
  {
    id: "TACTICIAN",
    name: "Tactician",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: -2,
    target: "none",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    // Unplayable; triggers ONLY on manual discards (engine handles the gating)
    onManualDiscardThis: (ctx) => {
      ctx.queue.addToBottom({ kind: "gainEnergy", n: ctx.upgraded ? 2 : 1 });
    },
  },
  {
    id: "TERROR",
    name: "Terror",
    color: "green",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: {},
    upgradeValues: { cost: 0 },
    // corpus upgrade.flags drop "exhaust", but the corpus text has no
    // [base|upgraded] marker around $Exhaust (contrast CALCULATED_GAMBLE's
    // "[<br>$Exhaust.|]"). V2.3.4 Terror+ still Exhausts; adjudicated in favor
    // of the text (SEEING_RED precedent).
    keywords: ["exhaust"],
    primitives: [{ do: "applyPower", power: "VULNERABLE", n: 99, target: "target" }],
  },
  {
    id: "WELL_LAID_PLANS",
    name: "Well-Laid Plans",
    color: "green",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "WELL_LAID_PLANS", n: "magic", target: "self" }],
  },
];
