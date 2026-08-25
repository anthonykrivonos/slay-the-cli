// Uncommon relics - values audited vs data/corpus/relics.json.

import type { RelicDef } from "../../engine/content/defs";
import type { CardInstance } from "../../engine/combat/combatState";
import type { HookCtx } from "../../engine/core/hooks";
import { f32add } from "../../engine/core/math";
import { PLAYER } from "../../engine/core/ids";
import { moveCard } from "../../engine/combat/piles";
import { cnt, effectiveKeywords, healPlayer, relicDamageAll } from "./lib";

/** Shared "every 3 <type>s in a single turn" counter (Kunai/Shuriken/Fan/Letter Opener). */
function everyThree(ctx: HookCtx, card: CardInstance, cardType: "attack" | "skill", fire: () => void): void {
  if (ctx.bundle.cards.get(card.defId)?.type !== cardType) return;
  const c = cnt(ctx).get() + 1;
  if (c === 3) {
    cnt(ctx).set(0);
    fire();
  } else {
    cnt(ctx).set(c);
  }
}

/** Move bottled master-deck cards of the given type to the top of the draw pile. */
function bottledToTop(ctx: HookCtx, type: "attack" | "skill" | "power"): void {
  const combat = ctx.combat!;
  for (const iid of [...combat.player.piles.draw]) {
    const c = combat.cards[iid]!;
    if (c.masterIdx === null) continue;
    if (!ctx.run.deck[c.masterIdx]?.bottled) continue;
    if (ctx.bundle.cards.get(c.defId)?.type !== type) continue;
    moveCard(ctx, iid, "draw", "top");
  }
}

export const uncommonRelics: RelicDef[] = [
  {
    // "Unplayable Curse cards can now be played..." ENGINE-GAP: the engine
    // rejects cost -2 cards before any hook fires; needs playability override
    // plus lose-1-HP-and-exhaust play semantics.
    id: "BLUE_CANDLE",
    name: "Blue Candle",
    tier: "uncommon",
    pool: "shared",
    hooks: {},
  },
  {
    // "Upon pickup, choose an Attack card. At the start of each combat, this
    // card will be in your hand." RUN-LAYER: pickup choice sets MasterCard.bottled;
    // combat side implemented here.
    id: "BOTTLED_FLAME",
    name: "Bottled Flame",
    tier: "uncommon",
    pool: "shared",
    hooks: { atBattleStartPreDraw: (ctx) => bottledToTop(ctx, "attack") },
  },
  {
    id: "BOTTLED_LIGHTNING",
    name: "Bottled Lightning",
    tier: "uncommon",
    pool: "shared",
    hooks: { atBattleStartPreDraw: (ctx) => bottledToTop(ctx, "skill") },
  },
  {
    id: "BOTTLED_TORNADO",
    name: "Bottled Tornado",
    tier: "uncommon",
    pool: "shared",
    hooks: { atBattleStartPreDraw: (ctx) => bottledToTop(ctx, "power") },
  },
  {
    // "Whenever you obtain a Curse, increase your Max HP by 6." RUN-LAYER site.
    id: "DARKSTONE_PERIAPT",
    name: "Darkstone Periapt",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      onObtainCard: (ctx, defId) => {
        if (ctx.bundle.cards.get(defId)?.type === "curse") {
          ctx.run.maxHp += 6;
          ctx.run.hp += 6;
        }
      },
    },
  },
  {
    // "Whenever you play an Attack, gain 1 temporary Dexterity."
    id: "DUALITY",
    name: "Duality",
    tier: "uncommon",
    pool: "purple",
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type !== "attack") return;
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "DEXTERITY", amount: 1 });
        ctx.queue.addToBottom({
          kind: "applyPower",
          source: PLAYER,
          target: PLAYER,
          powerId: "LOSE_DEXTERITY",
          amount: 1,
        });
      },
    },
  },
  {
    // "Whenever an enemy dies, gain 1 Energy and draw 1 card."
    id: "GREMLIN_HORN",
    name: "Gremlin Horn",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      onMonsterDeath: (ctx) => {
        ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
        ctx.queue.addToBottom({ kind: "draw", n: 1 });
      },
    },
  },
  {
    // "Your rightmost Orb triggers its passive an additional time."
    // DEPENDS: orb defs (Defect workstream). The extra trigger fires alongside
    // the normal end-of-turn batch (Plasma's at start of turn).
    id: "GOLD_PLATED_CABLES",
    name: "Gold-Plated Cables",
    tier: "uncommon",
    pool: "blue",
    hooks: {
      atEndOfTurnPreEndOfTurnCards: (ctx) => {
        const orbs = ctx.combat!.player.orbs;
        const last = orbs[orbs.length - 1];
        if (last && last.id !== "PLASMA") ctx.bundle.orbs.get(last.id)?.onPassive(ctx, orbs.length - 1);
      },
      atStartOfTurn: (ctx) => {
        const orbs = ctx.combat!.player.orbs;
        const last = orbs[orbs.length - 1];
        if (last && last.id === "PLASMA") ctx.bundle.orbs.get(last.id)?.onPassive(ctx, orbs.length - 1);
      },
    },
  },
  {
    // "At the start of your 2nd turn, gain 14 Block."
    id: "HORN_CLEAT",
    name: "Horn Cleat",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => {
        if (ctx.combat!.turn === 2) {
          ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: 14, fromCard: false });
        }
      },
    },
  },
  {
    // "Whenever you play 10 cards, draw 1 card." (persistent counter)
    id: "INK_BOTTLE",
    name: "Ink Bottle",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      onUseCard: (ctx) => {
        const c = cnt(ctx).get() + 1;
        if (c >= 10) {
          cnt(ctx).set(0);
          ctx.queue.addToBottom({ kind: "draw", n: 1 });
        } else {
          cnt(ctx).set(c);
        }
      },
    },
  },
  {
    // "Every time you play 3 Attacks in a single turn, gain 1 Dexterity."
    id: "KUNAI",
    name: "Kunai",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => cnt(ctx).set(0),
      onUseCard: (ctx, card) =>
        everyThree(ctx, card, "attack", () =>
          ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "DEXTERITY", amount: 1 }),
        ),
    },
  },
  {
    // "Every time you play 3 Skills in a single turn, deal 5 damage to ALL enemies."
    id: "LETTER_OPENER",
    name: "Letter Opener",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => cnt(ctx).set(0),
      onUseCard: (ctx, card) => everyThree(ctx, card, "skill", () => relicDamageAll(ctx, 5)),
    },
  },
  {
    // "If your HP is at or below 50% at the end of combat, heal 12 HP."
    id: "MEAT_ON_THE_BONE",
    name: "Meat on the Bone",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      onVictory: (ctx) => {
        if (ctx.run.hp <= ctx.run.maxHp / 2) healPlayer(ctx, 12);
      },
    },
  },
  {
    // "At the start of your turn, deal 3 damage to ALL enemies."
    id: "MERCURY_HOURGLASS",
    name: "Mercury Hourglass",
    tier: "uncommon",
    pool: "shared",
    hooks: { atStartOfTurn: (ctx) => relicDamageAll(ctx, 3) },
  },
  {
    // "Whenever you play a Power card, a random card in your hand costs 0 that turn."
    id: "MUMMIFIED_HAND",
    name: "Mummified Hand",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type !== "power") return;
        const combat = ctx.combat!;
        const candidates = combat.player.piles.hand.filter((iid) => combat.cards[iid]!.costForTurn > 0);
        if (candidates.length === 0) return;
        const iid = candidates[ctx.rng("cardRandomRng").random(candidates.length - 1)]!;
        combat.cards[iid]!.costForTurn = 0;
      },
    },
  },
  {
    // "At the start each combat, add 3 Shivs into your hand."
    // DEPENDS: SHIV card def (Silent workstream).
    id: "NINJA_SCROLL",
    name: "Ninja Scroll",
    tier: "uncommon",
    pool: "green",
    hooks: {
      atBattleStart: (ctx) => {
        if (ctx.bundle.cards.has("SHIV")) {
          ctx.queue.addToBottom({ kind: "makeTempCard", defId: "SHIV", upgrades: 0, dest: "hand", n: 3 });
        }
      },
    },
  },
  {
    // "Every time you play 3 Attacks in a single turn, gain 4 Block."
    id: "ORNAMENTAL_FAN",
    name: "Ornamental Fan",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => cnt(ctx).set(0),
      onUseCard: (ctx, card) =>
        everyThree(ctx, card, "attack", () =>
          ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: 4, fromCard: false }),
        ),
    },
  },
  {
    // Marker: the modified Weak multiplier (x0.6) is consumed inside the WEAK
    // power def (src/content/powers/core.ts) via hasRelic("PAPER_KRANE").
    id: "PAPER_KRANE",
    name: "Paper Krane",
    tier: "uncommon",
    pool: "green",
    hooks: {},
  },
  {
    // Marker: the modified Vulnerable multiplier (x1.75) is consumed inside the
    // VULNERABLE power def via hasRelic("PAPER_PHROG").
    id: "PAPER_PHROG",
    name: "Paper Phrog",
    tier: "uncommon",
    pool: "red",
    hooks: {},
  },
  {
    // "At the start of Boss combats, heal 25 HP."
    id: "PANTOGRAPH",
    name: "Pantograph",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => {
        if (ctx.combat!.monsters.some((m) => ctx.bundle.monsters.get(m.id)?.category === "boss")) {
          ctx.queue.addToBottom({ kind: "heal", target: PLAYER, amount: 25 });
        }
      },
    },
  },
  {
    // "Whenever you lose HP, gain 3 Block next turn."
    id: "SELF_FORMING_CLAY",
    name: "Self-Forming Clay",
    tier: "uncommon",
    pool: "red",
    hooks: {
      wasHPLost: (ctx, _info, amount) => {
        if (amount > 0) {
          // addToTop: monster-turn damage resolves after endRound is queued, so a
          // bottom-queued apply would land behind next turn's startPlayerTurn and
          // pay out one turn late.
          ctx.queue.addToTop({
            kind: "applyPower",
            source: PLAYER,
            target: PLAYER,
            powerId: "NEXT_TURN_BLOCK",
            amount: 3,
          });
        }
      },
    },
  },
  {
    // "Every time you play 3 Attacks in a single turn, gain 1 Strength."
    id: "SHURIKEN",
    name: "Shuriken",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => cnt(ctx).set(0),
      onUseCard: (ctx, card) =>
        everyThree(ctx, card, "attack", () =>
          ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: 1 }),
        ),
    },
  },
  {
    // "Cards containing 'Strike' deal 3 additional damage." (keyword "strike")
    id: "STRIKE_DUMMY",
    name: "Strike Dummy",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      atDamageGive: (ctx, d, _type, card) => {
        if (!card) return d;
        const def = ctx.bundle.cards.get(card.defId);
        if (def && effectiveKeywords(def, card).includes("strike")) return f32add(d, 3);
        return d;
      },
    },
  },
  {
    // "Every 3 times you shuffle your draw pile, gain 2 Energy." (persistent counter)
    id: "SUNDIAL",
    name: "Sundial",
    tier: "uncommon",
    pool: "shared",
    hooks: {
      onShuffle: (ctx) => {
        const c = cnt(ctx).get() + 1;
        if (c >= 3) {
          cnt(ctx).set(0);
          ctx.queue.addToBottom({ kind: "gainEnergy", n: 2 });
        } else {
          cnt(ctx).set(c);
        }
      },
    },
  },
  {
    // "At the start of each combat, Channel 1 Dark." DEPENDS: DARK orb def.
    id: "SYMBIOTIC_VIRUS",
    name: "Symbiotic Virus",
    tier: "uncommon",
    pool: "blue",
    hooks: { atBattleStart: (ctx) => ctx.queue.addToBottom({ kind: "channelOrb", orbId: "DARK" }) },
  },
  {
    // "Start each combat in Calm." DEPENDS: CALM stance def (Watcher workstream).
    id: "TEARDROP_LOCKET",
    name: "Teardrop Locket",
    tier: "uncommon",
    pool: "purple",
    hooks: { atBattleStartPreDraw: (ctx) => ctx.queue.addToBottom({ kind: "changeStance", stanceId: "CALM" }) },
  },
  {
    // "For every 5 cards in your deck, heal 3 HP whenever you enter a Rest Site."
    // RUN-LAYER: onEnterRestSite not fired yet.
    id: "ETERNAL_FEATHER",
    name: "Eternal Feather",
    tier: "uncommon",
    pool: "shared",
    hooks: { onEnterRestSite: (ctx) => healPlayer(ctx, Math.floor(ctx.run.deck.length / 5) * 3) },
  },
  {
    // "Whenever you add a Power card to your deck, Upgrade it." RUN-LAYER: the
    // obtain pipeline must apply egg upgrades when adding the MasterCard.
    id: "FROZEN_EGG",
    name: "Frozen Egg",
    tier: "uncommon",
    pool: "shared",
    hooks: {},
  },
  {
    // "The next 2 non-boss chests you open contain 2 Relics." RUN-LAYER: relic
    // generation lives in the treasure layer; counter initialized on pickup.
    id: "MATRYOSHKA",
    name: "Matryoshka",
    tier: "uncommon",
    pool: "shared",
    onEquip: (ctx) => {
      const r = ctx.run.relics.find((x) => x.defId === "MATRYOSHKA");
      if (r) r.counter = 2;
    },
    hooks: {},
  },
  {
    // "Whenever you add an Attack card to your deck, Upgrade it." RUN-LAYER.
    id: "MOLTEN_EGG",
    name: "Molten Egg",
    tier: "uncommon",
    pool: "shared",
    hooks: {},
  },
  {
    // "Upon pickup, raise your Max HP by 10."
    id: "PEAR",
    name: "Pear",
    tier: "uncommon",
    pool: "shared",
    onEquip: (ctx) => {
      ctx.run.maxHp += 10;
      ctx.run.hp += 10;
    },
    hooks: {},
  },
  {
    // "Future card rewards have 1 additional card to choose from." RUN-LAYER (modifyRewards).
    id: "QUESTION_CARD",
    name: "Question Card",
    tier: "uncommon",
    pool: "shared",
    hooks: {},
  },
  {
    // "When adding cards to your deck, you may raise your Max HP by 2 instead." RUN-LAYER.
    id: "SINGING_BOWL",
    name: "Singing Bowl",
    tier: "uncommon",
    pool: "shared",
    hooks: {},
  },
  {
    // "The Merchant restocks...; all prices are reduced by 20%."
    // Price hook implemented; restocking is RUN-LAYER.
    id: "THE_COURIER",
    name: "The Courier",
    tier: "uncommon",
    pool: "shared",
    hooks: { modifyPrice: (_ctx, price) => price * 0.8 },
  },
  {
    // "Whenever you add a Skill card to your deck, Upgrade it." RUN-LAYER.
    id: "TOXIC_EGG",
    name: "Toxic Egg",
    tier: "uncommon",
    pool: "shared",
    hooks: {},
  },
  {
    // "Potions always appear in combat rewards." RUN-LAYER (reward generation).
    id: "WHITE_BEAST_STATUE",
    name: "White Beast Statue",
    tier: "uncommon",
    pool: "shared",
    hooks: {},
  },
  {
    // "Merchant prices are reduced by 20%." (unobtainable corpus entry)
    id: "DISCERNING_MONOCLE",
    name: "Discerning Monocle",
    tier: "uncommon",
    pool: "shared",
    hooks: { modifyPrice: (_ctx, price) => price * 0.8 },
  },
];
