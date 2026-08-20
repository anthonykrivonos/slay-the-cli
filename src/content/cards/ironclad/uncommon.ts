// Ironclad uncommon cards (WHIRLWIND lives in basics.ts).
// Values audited against data/corpus/cards.json — corpus numbers only.

import type { CardDef } from "../../../engine/content/defs";
import { calcCardDamage, calcBlock } from "../../../engine/combat/damageCalc";
import { PLAYER, monster } from "../../../engine/core/ids";
import { getPowerAmount } from "../../../engine/combat/powerRuntime";
import { makeTempCard } from "../../../engine/combat/interpreter";

export const ironcladUncommons: CardDef[] = [
  {
    id: "BATTLE_TRANCE",
    name: "Battle Trance",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "none",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    // ENGINE-GAP: NO_DRAW cannot veto card-effect draws (see powers/ironclad.ts)
    primitives: [
      { do: "draw", n: "magic" },
      { do: "applyPower", power: "NO_DRAW", n: 1, target: "self" },
    ],
  },
  {
    id: "BLOODLETTING",
    name: "Bloodletting",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    primitives: [
      { do: "loseHp", n: 3 },
      { do: "gainEnergy", n: "magic" },
    ],
  },
  {
    id: "BLOOD_FOR_BLOOD",
    name: "Blood for Blood",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: 4,
    target: "enemy",
    values: { damage: 18 },
    upgradeValues: { cost: 3, damage: 22 },
    keywords: [],
    // ENGINE-GAP: CardDef.dynamicCost is declared but never consulted by the
    // engine (effectiveCost only folds modifyCardCost), and hpLostThisCombat
    // tracks amounts, not instances. The hidden BLOOD_FOR_BLOOD helper power
    // (applied on draw) decrements each copy's cost/costForTurn once per
    // HP-loss event instead; losses before the first copy is drawn are missed.
    onDrawThis: (ctx) => {
      ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "BLOOD_FOR_BLOOD", amount: 1 });
    },
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "BURNING_PACT",
    name: "Burning Pact",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/burningPactChoose" });
      ctx.queue.addToBottom({ kind: "draw", n: ctx.upgraded ? 3 : 2 });
    },
  },
  {
    id: "CARNAGE",
    name: "Carnage",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 20 },
    upgradeValues: { damage: 28 },
    keywords: ["ethereal"],
    primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "COMBUST",
    name: "Combust",
    color: "red",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 5 },
    upgradeValues: { magic: 7 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({
        kind: "applyPower",
        source: PLAYER,
        target: PLAYER,
        powerId: "COMBUST",
        amount: ctx.upgraded ? 7 : 5,
      });
      // each Combust played adds 1 to the end-of-turn HP loss
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/combustStack" });
    },
  },
  {
    id: "DARK_EMBRACE",
    name: "Dark Embrace",
    color: "red",
    type: "power",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: {},
    upgradeValues: { cost: 1 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "DARK_EMBRACE", n: 1, target: "self" }],
  },
  {
    id: "DISARM",
    name: "Disarm",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // ENGINE-NOTE: the game routes this through ApplyPowerAction(StrengthPower
      // negative), which Artifact blocks; our applyPower keys Artifact off the
      // power's kind (STRENGTH is a buff), so Artifact will not negate Disarm.
      ctx.queue.addToBottom({
        kind: "applyPower",
        source: PLAYER,
        target: monster(ctx.target ?? 0),
        powerId: "STRENGTH",
        amount: -(ctx.upgraded ? 3 : 2),
      });
    },
  },
  {
    id: "DROPKICK",
    name: "Dropkick",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 5 },
    upgradeValues: { damage: 8 },
    keywords: [],
    primitives: [{ do: "damage", n: "damage" }],
    onPlay: (ctx) => {
      // Vulnerable check happens at use time, before the damage resolves (game parity)
      if (getPowerAmount(ctx, monster(ctx.target ?? 0), "VULNERABLE") > 0) {
        ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
        ctx.queue.addToBottom({ kind: "draw", n: 1 });
      }
    },
  },
  {
    id: "DUAL_WIELD",
    name: "Dual Wield",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    onPlay: (ctx) => {
      ctx.queue.addToBottom({ kind: "effect", ref: "ironclad/dualWieldChoose", args: { copies: ctx.upgraded ? 2 : 1 } });
    },
  },
  {
    id: "ENTRENCH",
    name: "Entrench",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: {},
    upgradeValues: { cost: 1 },
    keywords: [],
    onPlay: (ctx) => {
      // plain block gain equal to current block: no Dexterity (game GainBlockAction)
      const block = ctx.combat!.player.block;
      if (block > 0) ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: false });
    },
  },
  {
    id: "EVOLVE",
    name: "Evolve",
    color: "red",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "EVOLVE", n: "magic", target: "self" }],
  },
  {
    id: "FEEL_NO_PAIN",
    name: "Feel No Pain",
    color: "red",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "FEEL_NO_PAIN", n: "magic", target: "self" }],
  },
  {
    id: "FIRE_BREATHING",
    name: "Fire Breathing",
    color: "red",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 6 },
    upgradeValues: { magic: 10 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "FIRE_BREATHING", n: "magic", target: "self" }],
  },
  {
    id: "FLAME_BARRIER",
    name: "Flame Barrier",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "self",
    values: { block: 12, magic: 4 },
    upgradeValues: { block: 16, magic: 6 },
    keywords: [],
    primitives: [
      { do: "block", n: "block" },
      { do: "applyPower", power: "FLAME_BARRIER", n: "magic", target: "self" },
    ],
  },
  {
    id: "GHOSTLY_ARMOR",
    name: "Ghostly Armor",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { block: 10 },
    upgradeValues: { block: 13 },
    keywords: ["ethereal"],
    primitives: [{ do: "block", n: "block" }],
  },
  {
    id: "HEMOKINESIS",
    name: "Hemokinesis",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 15, magic: 2 },
    upgradeValues: { damage: 20, magic: 2 },
    keywords: [],
    primitives: [
      { do: "loseHp", n: "magic" },
      { do: "damage", n: "damage" },
    ],
  },
  {
    id: "INFERNAL_BLADE",
    name: "Infernal Blade",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // random red Attack from the class pool (common/uncommon/rare, like
      // returnTrulyRandomCardInCombat). ENGINE-NOTE: pool sorted by id for
      // determinism; the game's library order differs, so specific rolls map to
      // different cards even with an identical cardRandomRng stream.
      const pool = [...ctx.bundle.cards.values()]
        .filter((d) => d.color === "red" && d.type === "attack" && d.rarity !== "basic" && d.rarity !== "special")
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
    id: "INFLAME",
    name: "Inflame",
    color: "red",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 2 },
    upgradeValues: { magic: 3 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "STRENGTH", n: "magic", target: "self" }],
  },
  {
    id: "INTIMIDATE",
    name: "Intimidate",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "allenemy",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: ["exhaust"],
    primitives: [{ do: "applyPower", power: "WEAK", n: "magic", target: "all" }],
  },
  {
    id: "METALLICIZE",
    name: "Metallicize",
    color: "red",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "METALLICIZE", n: "magic", target: "self" }],
  },
  {
    id: "POWER_THROUGH",
    name: "Power Through",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { block: 15 },
    upgradeValues: { block: 20 },
    keywords: [],
    primitives: [
      { do: "makeCard", card: "WOUND", dest: "hand", n: 2 },
      { do: "block", n: "block" },
    ],
  },
  {
    id: "PUMMEL",
    name: "Pummel",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 2, magic: 4 },
    upgradeValues: { damage: 2, magic: 5 },
    keywords: ["exhaust"],
    onPlay: (ctx) => {
      // deal 2 damage magic times (hit count is the magic number)
      const target = ctx.target ?? 0;
      const hits = ctx.upgraded ? 5 : 4;
      const dmg = calcCardDamage(ctx, ctx.card, target, 2);
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
    id: "RAGE",
    name: "Rage",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 0,
    target: "self",
    values: { magic: 3 },
    upgradeValues: { magic: 5 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "RAGE", n: "magic", target: "self" }],
  },
  {
    id: "RAMPAGE",
    name: "Rampage",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: 1,
    target: "enemy",
    values: { damage: 8, magic: 5 },
    upgradeValues: { damage: 8, magic: 8 },
    keywords: [],
    onPlay: (ctx) => {
      // growth is stored in card.misc — per combat, since instances are per-combat
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, 8 + ctx.card.misc);
      ctx.queue.addToBottom({
        kind: "damage",
        target: monster(target),
        info: { type: "attack", source: PLAYER, amount: dmg },
      });
      ctx.card.misc += ctx.upgraded ? 8 : 5;
    },
  },
  {
    id: "RECKLESS_CHARGE",
    name: "Reckless Charge",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: 0,
    target: "enemy",
    values: { damage: 7 },
    upgradeValues: { damage: 10 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "makeCard", card: "DAZED", dest: "draw" },
    ],
  },
  {
    id: "RUPTURE",
    name: "Rupture",
    color: "red",
    type: "power",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { magic: 1 },
    upgradeValues: { magic: 2 },
    keywords: [],
    primitives: [{ do: "applyPower", power: "RUPTURE", n: "magic", target: "self" }],
  },
  {
    id: "SEARING_BLOW",
    name: "Searing Blow",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 12 },
    upgradeValues: { damage: 12 },
    keywords: ["multiUpgrade"],
    onPlay: (ctx) => {
      // damage for n upgrades = n*(n+7)/2 + 12 (12, 16, 21, 27, ...)
      const n = ctx.card.upgrades;
      const target = ctx.target ?? 0;
      const dmg = calcCardDamage(ctx, ctx.card, target, (n * (n + 7)) / 2 + 12);
      ctx.queue.addToBottom({
        kind: "damage",
        target: monster(target),
        info: { type: "attack", source: PLAYER, amount: dmg },
      });
    },
  },
  {
    id: "SECOND_WIND",
    name: "Second Wind",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { block: 5 },
    upgradeValues: { block: 7 },
    keywords: [],
    onPlay: (ctx) => {
      // exhaust every non-Attack in hand; gain block per card (Dex applies per gain)
      const combat = ctx.combat!;
      const block = ctx.upgraded ? 7 : 5;
      for (const iid of [...combat.player.piles.hand]) {
        const def = ctx.bundle.cards.get(combat.cards[iid]!.defId);
        if (def?.type === "attack") continue;
        ctx.queue.addToBottom({ kind: "exhaust", sel: { kind: "iid", iid } });
        const amount = calcBlock(ctx, block, ctx.card, true);
        ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount, fromCard: true });
      }
    },
  },
  {
    id: "SEEING_RED",
    name: "Seeing Red",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "none",
    values: {},
    upgradeValues: { cost: 0 },
    keywords: ["exhaust"],
    primitives: [{ do: "gainEnergy", n: 2 }],
  },
  {
    id: "SENTINEL",
    name: "Sentinel",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "self",
    values: { block: 5 },
    upgradeValues: { block: 8 },
    keywords: [],
    primitives: [{ do: "block", n: "block" }],
    onExhaustThis: (ctx) => {
      ctx.queue.addToBottom({ kind: "gainEnergy", n: ctx.upgraded ? 3 : 2 });
    },
  },
  {
    id: "SEVER_SOUL",
    name: "Sever Soul",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 16 },
    upgradeValues: { damage: 22 },
    keywords: [],
    onPlay: (ctx) => {
      const combat = ctx.combat!;
      const target = ctx.target ?? 0;
      for (const iid of [...combat.player.piles.hand]) {
        const def = ctx.bundle.cards.get(combat.cards[iid]!.defId);
        if (def?.type !== "attack") ctx.queue.addToBottom({ kind: "exhaust", sel: { kind: "iid", iid } });
      }
      const dmg = calcCardDamage(ctx, ctx.card, target, ctx.upgraded ? 22 : 16);
      ctx.queue.addToBottom({
        kind: "damage",
        target: monster(target),
        info: { type: "attack", source: PLAYER, amount: dmg },
      });
    },
  },
  {
    id: "SHOCKWAVE",
    name: "Shockwave",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 2,
    target: "allenemy",
    values: { magic: 3 },
    upgradeValues: { magic: 5 },
    keywords: ["exhaust"],
    primitives: [
      { do: "applyPower", power: "WEAK", n: "magic", target: "all" },
      { do: "applyPower", power: "VULNERABLE", n: "magic", target: "all" },
    ],
  },
  {
    id: "SPOT_WEAKNESS",
    name: "Spot Weakness",
    color: "red",
    type: "skill",
    rarity: "uncommon",
    cost: 1,
    target: "selfandenemy",
    values: { magic: 3 },
    upgradeValues: { magic: 4 },
    keywords: [],
    onPlay: (ctx) => {
      const m = ctx.combat!.monsters[ctx.target ?? 0];
      if (!m || m.isDead || m.isEscaped || !m.move) return;
      const intent = ctx.bundle.monsters.get(m.id)?.moves[m.move]?.intent;
      if (intent && intent.startsWith("attack")) {
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: PLAYER,
          target: PLAYER,
          powerId: "STRENGTH",
          amount: ctx.upgraded ? 4 : 3,
        });
      }
    },
  },
  {
    id: "UPPERCUT",
    name: "Uppercut",
    color: "red",
    type: "attack",
    rarity: "uncommon",
    cost: 2,
    target: "enemy",
    values: { damage: 13, magic: 1 },
    upgradeValues: { damage: 13, magic: 2 },
    keywords: [],
    primitives: [
      { do: "damage", n: "damage" },
      { do: "applyPower", power: "WEAK", n: "magic", target: "target" },
      { do: "applyPower", power: "VULNERABLE", n: "magic", target: "target" },
    ],
  },
];
