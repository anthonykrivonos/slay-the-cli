// Rare relics - values audited vs data/corpus/relics.json.

import type { RelicDef } from "../../engine/content/defs";
import { f32mul } from "../../engine/core/math";
import { PLAYER, monster } from "../../engine/core/ids";
import {
  aliveMonsterIdxs,
  classPoolFilter,
  cnt,
  ensureContentEffects,
  gainGold,
  makeCardInstance,
  randomCardDefs,
  relicDamage,
  relicDamageAll,
} from "./lib";

export const rareRelics: RelicDef[] = [
  {
    // "Whenever you play a Power card, heal 2 HP."
    id: "BIRD_FACED_URN",
    name: "Bird-Faced Urn",
    tier: "rare",
    pool: "shared",
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type === "power") {
          ctx.queue.addToBottom({ kind: "heal", target: PLAYER, amount: 2 });
        }
      },
    },
  },
  {
    // "At the start of your turn, lose 15 Block rather than all of your Block."
    id: "CALIPERS",
    name: "Calipers",
    tier: "rare",
    pool: "shared",
    hooks: { modifyBlockRetention: (ctx, retained) => Math.max(retained, ctx.combat!.player.block - 15) },
  },
  {
    // "At the start of your 3rd turn, gain 18 Block."
    id: "CAPTAINS_WHEEL",
    name: "Captain's Wheel",
    tier: "rare",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => {
        if (ctx.combat!.turn === 3) {
          ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: 18, fromCard: false });
        }
      },
    },
  },
  {
    // "Whenever you apply Vulnerable, also apply 1 Weak."
    // ENGINE-GAP: the engine does not fire onApplyPower at the applyPower site
    // yet; hook side is ready and exact once it does.
    id: "CHAMPION_BELT",
    name: "Champion Belt",
    tier: "rare",
    pool: "red",
    hooks: {
      onApplyPower: (ctx, powerId, target, source) => {
        if (powerId === "VULNERABLE" && target.kind === "monster" && source?.kind === "player") {
          ctx.queue.addToBottom({ kind: "applyPower", source, target, powerId: "WEAK", amount: 1 });
        }
      },
    },
  },
  {
    // "Whenever you Exhaust a card, deal 3 damage to ALL enemies."
    id: "CHARONS_ASHES",
    name: "Charon's Ashes",
    tier: "rare",
    pool: "red",
    hooks: { onExhaust: (ctx) => relicDamageAll(ctx, 3) },
  },
  {
    // "At the end of your turn, gain 1 Block for each card in your hand."
    id: "CLOAK_CLASP",
    name: "Cloak Clasp",
    tier: "rare",
    pool: "purple",
    hooks: {
      atEndOfTurnPreEndOfTurnCards: (ctx) => {
        const n = ctx.combat!.player.piles.hand.length;
        if (n > 0) ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: n, fromCard: false });
      },
    },
  },
  {
    // "Whenever you Exhaust a card, add a random card to your hand."
    // Adjudication (matches returnTrulyRandomCardInCombat): random card from the
    // character's common/uncommon/rare pool, cardRandomRng. DEPENDS: pool size.
    id: "DEAD_BRANCH",
    name: "Dead Branch",
    tier: "rare",
    pool: "shared",
    hooks: {
      onExhaust: (ctx) => {
        const picked = randomCardDefs(ctx, 1, classPoolFilter(ctx))[0];
        if (picked) makeCardInstance(ctx, picked.id, 0, "hand");
      },
    },
  },
  {
    // "For each Curse in your deck, start each combat with 1 Strength."
    id: "DU_VU_DOLL",
    name: "Du-Vu Doll",
    tier: "rare",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => {
        const n = ctx.run.deck.filter((mc) => ctx.bundle.cards.get(mc.defId)?.type === "curse").length;
        if (n > 0) {
          ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: n });
        }
      },
    },
  },
  {
    // "If you lost HP during the previous turn, trigger the passive ability of
    // all Orbs at the start of your turn." DEPENDS: orb defs.
    id: "EMOTION_CHIP",
    name: "Emotion Chip",
    tier: "rare",
    pool: "blue",
    hooks: {
      atBattleStart: (ctx) => cnt(ctx).set(0),
      wasHPLost: (ctx, _info, amount) => {
        if (amount > 0) cnt(ctx).set(1);
      },
      atStartOfTurn: (ctx) => {
        if (cnt(ctx).get() !== 1) return;
        cnt(ctx).set(0);
        const orbs = ctx.combat!.player.orbs;
        for (let i = 0; i < orbs.length; i++) ctx.bundle.orbs.get(orbs[i]!.id)?.onPassive(ctx, i);
      },
    },
  },
  {
    // "Prevent the first time you would lose HP in combat." (Buffer 1)
    id: "FOSSILIZED_HELIX",
    name: "Fossilized Helix",
    tier: "rare",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) =>
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "BUFFER", amount: 1 }),
    },
  },
  {
    // "At the start of each combat, discard any number of cards, then draw that many."
    // Fires post-draw on turn 1 (the game queues its action after the opening draw).
    id: "GAMBLING_CHIP",
    name: "Gambling Chip",
    tier: "rare",
    pool: "shared",
    hooks: {
      atStartOfTurnPostDraw: (ctx) => {
        if (ctx.combat!.turn !== 1) return;
        ensureContentEffects(ctx);
        const iids = [...ctx.combat!.player.piles.hand];
        if (iids.length === 0) return;
        ctx.queue.addToBottom({
          kind: "choice",
          request: { kind: "cards", pile: "hand", iids, min: 0, max: iids.length, canCancel: true, reason: "Gambling Chip" },
          resume: "content:discardChosenThenDraw",
          resumeArgs: { iids },
        });
      },
    },
  },
  {
    // "You can no longer become Weakened."
    // ENGINE-GAP: exact once the engine fires onApplyPower (veto) at applyPower.
    id: "GINGER",
    name: "Ginger",
    tier: "rare",
    pool: "shared",
    hooks: {
      onApplyPower: (_ctx, powerId, target) => {
        if (powerId === "WEAK" && target.kind === "player") return false;
      },
    },
  },
  {
    // "Whenever you Scry, Scry 2 additional cards."
    // ENGINE-GAP: startScry has no amount-modifying fold; onScry fires after the fact.
    id: "GOLDEN_EYE",
    name: "Golden Eye",
    tier: "rare",
    pool: "purple",
    hooks: {},
  },
  {
    // "Energy is now conserved between turns."
    id: "ICE_CREAM",
    name: "Ice Cream",
    tier: "rare",
    pool: "shared",
    hooks: { retainsEnergy: () => true },
  },
  {
    // "Every 6 turns, gain 1 Intangible." (persistent counter)
    id: "INCENSE_BURNER",
    name: "Incense Burner",
    tier: "rare",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => {
        const c = cnt(ctx).get() + 1;
        if (c === 6) {
          cnt(ctx).set(0);
          ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "INTANGIBLE", amount: 1 });
        } else {
          cnt(ctx).set(c);
        }
      },
    },
  },
  {
    // "When you would die, heal to 50% of your Max HP instead (works once)."
    // ENGINE-GAP: playerDeath has no death-save hook (engine notes it lands Phase 2+).
    id: "LIZARD_TAIL",
    name: "Lizard Tail",
    tier: "rare",
    pool: "shared",
    hooks: {},
  },
  {
    // "Healing is 50% more effective during combat."
    id: "MAGIC_FLOWER",
    name: "Magic Flower",
    tier: "rare",
    pool: "red",
    hooks: { onHeal: (ctx, amount) => (ctx.combat ? f32mul(amount, 1.5) : amount) },
  },
  {
    // "Upon pickup, raise your Max HP by 14."
    id: "MANGO",
    name: "Mango",
    tier: "rare",
    pool: "shared",
    onEquip: (ctx) => {
      ctx.run.maxHp += 14;
      ctx.run.hp += 14;
    },
    hooks: {},
  },
  {
    // "Upon pickup, gain 300 Gold."
    id: "OLD_COIN",
    name: "Old Coin",
    tier: "rare",
    pool: "shared",
    onEquip: (ctx) => gainGold(ctx, 300),
    hooks: {},
  },
  {
    // "You can now remove cards from your deck at Rest Sites." RUN-LAYER (rest options).
    id: "PEACE_PIPE",
    name: "Peace Pipe",
    tier: "rare",
    pool: "shared",
    hooks: {},
  },
  {
    // "Whenever you play 3 or less cards during your turn, draw 3 additional
    // cards at the start of your next turn."
    id: "POCKETWATCH",
    name: "Pocketwatch",
    tier: "rare",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => cnt(ctx).set(0),
      atEndOfTurn: (ctx, isPlayerTurn) => {
        if (isPlayerTurn) cnt(ctx).set(ctx.combat!.turnFlags.cardsPlayedThisTurn <= 3 ? 1 : 0);
      },
      modifyDrawPerTurn: (ctx, n) => (cnt(ctx).get() === 1 ? n + 3 : n),
      atStartOfTurnPostDraw: (ctx) => cnt(ctx).set(0),
    },
  },
  {
    // "Normal enemies drop an additional card reward." RUN-LAYER (modifyRewards).
    id: "PRAYER_WHEEL",
    name: "Prayer Wheel",
    tier: "rare",
    pool: "shared",
    hooks: {},
  },
  {
    // "You can now Dig for relics at Rest Sites." RUN-LAYER (rest options).
    id: "SHOVEL",
    name: "Shovel",
    tier: "rare",
    pool: "shared",
    hooks: {},
  },
  {
    // "At the end of turn 7, deal 52 damage to ALL enemies."
    id: "STONE_CALENDAR",
    name: "Stone Calendar",
    tier: "rare",
    pool: "shared",
    hooks: {
      atEndOfTurnPreEndOfTurnCards: (ctx) => {
        if (ctx.combat!.turn === 7) relicDamageAll(ctx, 52);
      },
    },
  },
  {
    // "Whenever an enemy dies, transfer any Poison it has to a random enemy."
    // DEPENDS: POISON power. Random target via cardRandomRng.
    id: "THE_SPECIMEN",
    name: "The Specimen",
    tier: "rare",
    pool: "green",
    hooks: {
      onMonsterDeath: (ctx, m) => {
        if (!ctx.bundle.powers.has("POISON")) return;
        const poison = m.powers.find((p) => p.id === "POISON")?.amount ?? 0;
        if (poison <= 0) return;
        const alive = aliveMonsterIdxs(ctx).filter((i) => i !== m.idx);
        if (alive.length === 0) return;
        const idx = alive[ctx.rng("cardRandomRng").random(alive.length - 1)]!;
        ctx.queue.addToTop({ kind: "applyPower", source: PLAYER, target: monster(idx), powerId: "POISON", amount: poison });
      },
    },
  },
  {
    // "At the start of each combat, gain 4 Plated Armor."
    id: "THREAD_AND_NEEDLE",
    name: "Thread and Needle",
    tier: "rare",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) =>
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "PLATED_ARMOR", amount: 4 }),
    },
  },
  {
    // "Whenever you discard a card during your turn, deal 3 damage to a random enemy."
    id: "TINGSHA",
    name: "Tingsha",
    tier: "rare",
    pool: "green",
    hooks: {
      onManualDiscard: (ctx) => {
        const alive = aliveMonsterIdxs(ctx);
        if (alive.length === 0) return;
        const idx = alive[ctx.rng("cardRandomRng").random(alive.length - 1)]!;
        relicDamage(ctx, idx, 3);
      },
    },
  },
  {
    // "Whenever you would receive 5 or less unblocked Attack damage, reduce it to 1."
    id: "TORII",
    name: "Torii",
    tier: "rare",
    pool: "shared",
    hooks: {
      // ENGINE NOTE: foldHook passes the folded value FIRST, so the runtime
      // argument order here is (ctx, damage, info) even though the Hooks
      // interface declares (ctx, info, damage).
      onAttackedToChangeDamage: (_ctx, a, b) => {
        const damage = a as unknown as number;
        const info = b as unknown as import("../../engine/core/actions").DamageInfo;
        if (info.type === "attack" && info.source !== null && damage > 0 && damage <= 5) return 1;
        return damage;
      },
    },
  },
  {
    // "Whenever you discard a card during your turn, gain 3 Block."
    id: "TOUGH_BANDAGES",
    name: "Tough Bandages",
    tier: "rare",
    pool: "green",
    hooks: {
      onManualDiscard: (ctx) => ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: 3, fromCard: false }),
    },
  },
  {
    // "Whenever you would lose HP, lose 1 less."
    id: "TUNGSTEN_ROD",
    name: "Tungsten Rod",
    tier: "rare",
    pool: "shared",
    hooks: { onLoseHp: (_ctx, amount) => (amount > 0 ? amount - 1 : amount) },
  },
  {
    // "You can no longer become Frail."
    // ENGINE-GAP: exact once the engine fires onApplyPower (veto) at applyPower.
    id: "TURNIP",
    name: "Turnip",
    tier: "rare",
    pool: "shared",
    hooks: {
      onApplyPower: (_ctx, powerId, target) => {
        if (powerId === "FRAIL" && target.kind === "player") return false;
      },
    },
  },
  {
    // "Whenever you have no cards in hand during your turn, draw a card."
    // Checked after card plays and manual discards (the empty-hand sites).
    id: "UNCEASING_TOP",
    name: "Unceasing Top",
    tier: "rare",
    pool: "shared",
    hooks: {
      onAfterCardPlayed: (ctx) => unceasingTopCheck(ctx),
      onManualDiscard: (ctx) => unceasingTopCheck(ctx),
    },
  },
  {
    // "You can now gain Strength at Rest Sites (up to 3 times)." RUN-LAYER: the
    // lift action lives in the rest layer (counter = lifts); combat side applies it.
    id: "GIRYA",
    name: "Girya",
    tier: "rare",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => {
        const n = cnt(ctx).get();
        if (n > 0) {
          ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: n });
        }
      },
    },
  },
  {
    // "You may ignore paths when choosing the next room to travel to 3 times."
    // RUN-LAYER: map traversal; counter initialized on pickup.
    id: "WING_BOOTS",
    name: "Wing Boots",
    countsDown: true,
    tier: "rare",
    pool: "shared",
    onEquip: (ctx) => {
      const r = ctx.run.relics.find((x) => x.defId === "WING_BOOTS");
      if (r) r.counter = 3;
    },
    hooks: {},
  },
];

function unceasingTopCheck(ctx: import("../../engine/core/hooks").HookCtx): void {
  const combat = ctx.combat!;
  if (!combat.playerTurn) return;
  const piles = combat.player.piles;
  if (piles.hand.length === 0 && piles.draw.length + piles.discard.length > 0) {
    ctx.queue.addToBottom({ kind: "draw", n: 1 });
  }
}
