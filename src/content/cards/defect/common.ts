// Defect commons (18). Values audited vs data/corpus/cards.json (color "blue").

import type { CardDef } from "../../../engine/content/defs";
import { calcBlock, calcCardDamage } from "../../../engine/combat/damageCalc";
import { getPowerAmount } from "../../../engine/combat/powerRuntime";
import { PLAYER, monster } from "../../../engine/core/ids";

export const defectCommons: CardDef[] = [
  {
    // "Deal 7(10) damage. Channel 1 Lightning."
    id: "BALL_LIGHTNING",
    name: "Ball Lightning",
    color: "blue",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 7, magic: 1, hits: 1 },
    upgradeValues: { damage: 10 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "LIGHTNING", n: 1 } });
    },
  },
  {
    // "Deal 4(6) damage for each Channeled Orb." (orbs currently in play)
    id: "BARRAGE",
    name: "Barrage",
    color: "blue",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 4 },
    upgradeValues: { damage: 6 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const hits = ctx.combat!.player.orbs.length;
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 6 : 4);
      for (let i = 0; i < hits; i++) {
        ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
      }
    },
  },
  {
    // "Deal 3(4) damage. Apply 1(2) Vulnerable."
    id: "BEAM_CELL",
    name: "Beam Cell",
    color: "blue",
    type: "attack",
    rarity: "common",
    cost: 0,
    target: "enemy",
    values: { damage: 3, magic: 1 },
    upgradeValues: { damage: 4, magic: 2 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "VULNERABLE", n: "magic", target: "target" },
    ],
  },
  {
    // "Gain 7(10) Block. Next turn, gain 1 Energy."
    id: "CHARGE_BATTERY",
    name: "Charge Battery",
    color: "blue",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 7 },
    upgradeValues: { block: 10 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "applyPower", power: "ENERGIZED", n: 1, target: "self" },
    ],
  },
  {
    // "Deal 3(5) damage. Increase the damage of ALL Claw cards by 2 this combat."
    // Damage = printed base + the hidden CLAW_BUFF counter; the played Claw
    // deals its pre-buff damage, then the buff grows (game order).
    id: "CLAW",
    name: "Claw",
    color: "blue",
    type: "attack",
    rarity: "common",
    cost: 0,
    target: "enemy",
    values: { damage: 3, magic: 2 },
    upgradeValues: { damage: 5 },
    keywords: [],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const buff = getPowerAmount(ctx, PLAYER, "CLAW_BUFF");
      const dmg = calcCardDamage(ctx, ctx.card, target, (ctx.upgraded ? 5 : 3) + buff);
      ctx.queue.addToBottom({ kind: "damage", target: monster(target), info: { type: "attack", source: PLAYER, amount: dmg } });
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "CLAW_BUFF", amount: 2 });
    },
  },
  {
    // "Deal 6(9) damage. Channel 1 Frost."
    id: "COLD_SNAP",
    name: "Cold Snap",
    color: "blue",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 6, magic: 1, hits: 1 },
    upgradeValues: { damage: 9 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "FROST", n: 1 } });
    },
  },
  {
    // "Deal 7(10) damage. Draw 1 card for each unique Orb you have."
    id: "COMPILE_DRIVER",
    name: "Compile Driver",
    color: "blue",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 7, magic: 1 },
    upgradeValues: { damage: 10 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      const unique = new Set(ctx.combat!.player.orbs.map((o) => o.id)).size;
      if (unique > 0) ctx.queue.addToBottom({ kind: "draw", n: unique });
    },
  },
  {
    // "Channel 1 Frost. Draw 1(2) cards."
    id: "COOLHEADED",
    name: "Coolheaded",
    color: "blue",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/channel", args: { orbId: "FROST", n: 1 } });
      ctx.queue.addToBottom({ kind: "draw", n: ctx.upgraded ? 2 : 1 });
    },
  },
  {
    // "Deal 3(4) damage. If the enemy intends to attack, apply 1(2) Weak."
    id: "GO_FOR_THE_EYES",
    name: "Go for the Eyes",
    color: "blue",
    type: "attack",
    rarity: "common",
    cost: 0,
    target: "enemy",
    values: { damage: 3, magic: 1 },
    upgradeValues: { damage: 4, magic: 2 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      const target = ctx.target ?? 0;
      const m = ctx.combat!.monsters[target];
      if (!m || !m.move) return;
      const intent = ctx.bundle.monsters.get(m.id)?.moves[m.move]?.intent;
      if (intent && intent.startsWith("attack")) {
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: PLAYER,
          target: monster(target),
          powerId: "WEAK",
          amount: ctx.upgraded ? 2 : 1,
        });
      }
    },
  },
  {
    // "Gain 3(5) Block. Put a card from your discard pile into your hand. (Exhaust.)"
    id: "HOLOGRAM",
    name: "Hologram",
    color: "blue",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 3 },
    upgradeValues: { block: 5 },
    keywords: ["exhaust"],
    upgradeKeywords: [],
    primitives: [{ do: "block", n: "block" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/hologramChoose" });
    },
  },
  {
    // "Gain 9(12) Block."
    id: "LEAP",
    name: "Leap",
    color: "blue",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 9 },
    upgradeValues: { block: 12 },
    keywords: [],
    primitives: [{ do: "block", n: "block" }],
  },
  {
    // "Deal 9(12) damage. Put the next card you play this turn on top of your draw pile."
    id: "REBOUND",
    name: "Rebound",
    color: "blue",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "enemy",
    values: { damage: 9 },
    upgradeValues: { damage: 12 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "REBOUND", amount: 1 });
      // arm the power's self-skip so Rebound doesn't rebound itself
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/reboundArm" });
    },
  },
  {
    // "Evoke your next Orb. Channel the Orb that was just Evoked."
    id: "RECURSION",
    name: "Recursion",
    color: "blue",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/recursion" });
    },
  },
  {
    // "Gain Block equal to the number of cards in your discard pile (+3)."
    id: "STACK",
    name: "Stack",
    color: "blue",
    type: "skill",
    rarity: "common",
    cost: 1,
    target: "self",
    values: { block: 0 },
    upgradeValues: { block: 3 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "effect",
        ref: "defect/stackBlock",
        args: { iid: ctx.card.iid, bonus: ctx.upgraded ? 3 : 0 },
      });
    },
  },
  {
    // "Gain 6(8) Block. Decrease this card's Block by 1 this combat."
    // Per-combat shrink lives in card.misc (combat copies start from master 0).
    id: "STEAM_BARRIER",
    name: "Steam Barrier",
    color: "blue",
    type: "skill",
    rarity: "common",
    cost: 0,
    target: "self",
    values: { block: 6 },
    upgradeValues: { block: 8 },
    keywords: [],
    onPlay: (ctx) => {
      const base = Math.max(0, (ctx.upgraded ? 8 : 6) - ctx.card.misc);
      const block = calcBlock(ctx, base, ctx.card, true);
      ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
      ctx.card.misc += 1;
    },
  },
  {
    // "Deal 15(20) damage. Reduce this card's cost by 1 this combat."
    id: "STREAMLINE",
    name: "Streamline",
    color: "blue",
    type: "attack",
    rarity: "common",
    cost: 2,
    target: "enemy",
    values: { damage: 15, magic: 1 },
    upgradeValues: { damage: 20 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      // the game mutates the card's cost for the rest of the combat; deferred
      // so the reduction lands AFTER this play's energy is paid
      ctx.queue.addToBottom({ kind: "effect", ref: "defect/reduceCostForCombat", args: { iid: ctx.card.iid } });
    },
  },
  {
    // "Deal 6(9) damage to ALL enemies. Draw 1 card."
    id: "SWEEPING_BEAM",
    name: "Sweeping Beam",
    color: "blue",
    type: "attack",
    rarity: "common",
    cost: 1,
    target: "allenemy",
    values: { damage: 6, magic: 1 },
    upgradeValues: { damage: 9 },
    keywords: [],
    primitives: [
      { do: "damageAll", n: "damage" },
      { do: "draw", n: 1 },
    ],
  },
  {
    // "Gain 2(3) Energy. Add a Void into your discard pile."
    id: "TURBO",
    name: "TURBO",
    color: "blue",
    type: "skill",
    rarity: "common",
    cost: 0,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    primitives: [
      { do: "gainEnergy", n: "magic" },
      { do: "makeCard", card: "VOID", dest: "discard" },
    ],
  },
];
