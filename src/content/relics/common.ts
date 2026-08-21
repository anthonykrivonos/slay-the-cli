// Common relics - values audited vs data/corpus/relics.json.
//
// Flags used throughout:
//   // RUN-LAYER - hook side implemented; the engine does not fire this hook yet
//                   (run layer absent) or the behavior needs run-level systems.
//   // ENGINE-GAP - not expressible with current hooks; def is a marker.
//   // DEPENDS - needs content from another workstream (guarded).

import type { RelicDef } from "../../engine/content/defs";
import { PLAYER, monster } from "../../engine/core/ids";
import { cnt, gainGold, healPlayer, relicDamageAll } from "./lib";

export const commonRelics: RelicDef[] = [
  {
    // "Your first Attack each combat deals 8 additional damage." (Vigor 8)
    id: "AKABEKO",
    name: "Akabeko",
    tier: "common",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) =>
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "VIGOR", amount: 8 }),
    },
  },
  {
    // "If you do not play any Attacks during your turn, gain an additional Energy next turn."
    // counter: 1 once an attack is played this turn; checked+reset at turn start.
    id: "ART_OF_WAR",
    name: "Art of War",
    tier: "common",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => {
        if (ctx.combat!.turn > 1 && cnt(ctx).get() === 0) ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
        cnt(ctx).set(0);
      },
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type === "attack") cnt(ctx).set(1);
      },
    },
  },
  {
    // "Start each combat with 10 Block."
    id: "ANCHOR",
    name: "Anchor",
    tier: "common",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: 10, fromCard: false }),
    },
  },
  {
    // "Whenever you enter a Rest Site, start the next combat with 2 extra Energy."
    // RUN-LAYER: onEnterRestSite is not fired yet; combat side consumes the flag.
    id: "ANCIENT_TEA_SET",
    name: "Ancient Tea Set",
    tier: "common",
    pool: "shared",
    hooks: {
      onEnterRestSite: (ctx) => cnt(ctx).set(1),
      atStartOfTurn: (ctx) => {
        if (ctx.combat!.turn === 1 && cnt(ctx).get() === 1) {
          cnt(ctx).set(0);
          ctx.queue.addToBottom({ kind: "gainEnergy", n: 2 });
        }
      },
    },
  },
  {
    // "At the start of each combat, apply 1 Vulnerable to ALL enemies."
    id: "BAG_OF_MARBLES",
    name: "Bag of Marbles",
    tier: "common",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => {
        for (const m of ctx.combat!.monsters) {
          if (!m.isDead && !m.isEscaped) {
            ctx.queue.addToBottom({
              kind: "applyPower",
              source: PLAYER,
              target: monster(m.idx),
              powerId: "VULNERABLE",
              amount: 1,
            });
          }
        }
      },
    },
  },
  {
    // "At the start of each combat, draw 2 additional cards."
    id: "BAG_OF_PREPARATION",
    name: "Bag of Preparation",
    tier: "common",
    pool: "shared",
    hooks: { modifyDrawPerTurn: (ctx, n) => (ctx.combat!.turn === 1 ? n + 2 : n) },
  },
  {
    // "At the start of each combat, heal 2 HP."
    id: "BLOOD_VIAL",
    name: "Blood Vial",
    tier: "common",
    pool: "shared",
    hooks: { atBattleStart: (ctx) => ctx.queue.addToBottom({ kind: "heal", target: PLAYER, amount: 2 }) },
  },
  {
    // "Start each combat with 3 Thorns."
    id: "BRONZE_SCALES",
    name: "Bronze Scales",
    tier: "common",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) =>
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "THORNS", amount: 3 }),
    },
  },
  {
    // "The first time you lose HP each combat, draw 3 cards."
    id: "CENTENNIAL_PUZZLE",
    name: "Centennial Puzzle",
    tier: "common",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) => cnt(ctx).set(0),
      wasHPLost: (ctx, _info, amount) => {
        if (amount > 0 && cnt(ctx).get() === 0) {
          cnt(ctx).set(1);
          ctx.queue.addToBottom({ kind: "draw", n: 3 });
        }
      },
    },
  },
  {
    // "Whenever you add a card to your deck, gain 9 Gold." RUN-LAYER site.
    id: "CERAMIC_FISH",
    name: "Ceramic Fish",
    tier: "common",
    pool: "shared",
    hooks: { onObtainCard: (ctx) => void gainGold(ctx, 9) },
  },
  {
    // "At the start of your turn, gain 1 Mantra."
    id: "DAMARU",
    name: "Damaru",
    tier: "common",
    pool: "purple",
    hooks: { atStartOfTurn: (ctx) => ctx.queue.addToBottom({ kind: "gainMantra", n: 1 }) },
  },
  {
    // "Start each combat with 1 Focus."
    id: "DATA_DISK",
    name: "Data Disk",
    tier: "common",
    pool: "blue",
    hooks: {
      atBattleStart: (ctx) =>
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "FOCUS", amount: 1 }),
    },
  },
  {
    // "Whenever you Rest, you may add a card to your deck."
    // RUN-LAYER: needs the rest-site card-reward flow.
    id: "DREAM_CATCHER",
    name: "Dream Catcher",
    tier: "common",
    pool: "shared",
    hooks: {},
  },
  {
    // "Every 3 turns, gain 1 Energy." (persistent counter, continues across combats)
    id: "HAPPY_FLOWER",
    name: "Happy Flower",
    tier: "common",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => {
        const c = cnt(ctx).get() + 1;
        if (c === 3) {
          cnt(ctx).set(0);
          ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
        } else {
          cnt(ctx).set(c);
        }
      },
    },
  },
  {
    // "Regular enemy combats are no longer encountered in ? rooms." RUN-LAYER (map/event gen).
    id: "JUZU_BRACELET",
    name: "Juzu Bracelet",
    tier: "common",
    pool: "shared",
    hooks: {},
  },
  {
    // "Gain 1 Energy on the first turn of each combat."
    id: "LANTERN",
    name: "Lantern",
    tier: "common",
    pool: "shared",
    hooks: {
      atStartOfTurn: (ctx) => {
        if (ctx.combat!.turn === 1) ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
      },
    },
  },
  {
    // "Whenever you climb a floor, gain 12 Gold. No longer works when you spend
    // any Gold at a shop." RUN-LAYER: onEnterRoom not fired yet; the shop layer
    // must set counter=1 on any purchase to disable it.
    id: "MAW_BANK",
    name: "Maw Bank",
    tier: "common",
    pool: "shared",
    hooks: {
      onEnterRoom: (ctx) => {
        if (cnt(ctx).get() === 0) gainGold(ctx, 12);
      },
    },
  },
  {
    // "Whenever you enter a shop, heal 15 HP." RUN-LAYER site.
    id: "MEAL_TICKET",
    name: "Meal Ticket",
    tier: "common",
    pool: "shared",
    hooks: {
      onEnterRoom: (ctx, roomKind) => {
        if (roomKind === "shop") healPlayer(ctx, 15);
      },
    },
  },
  {
    // "Every time you play 10 Attacks, gain 1 Energy." (persistent counter)
    id: "NUNCHAKU",
    name: "Nunchaku",
    tier: "common",
    pool: "shared",
    hooks: {
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type !== "attack") return;
        const c = cnt(ctx).get() + 1;
        if (c >= 10) {
          cnt(ctx).set(0);
          ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
        } else {
          cnt(ctx).set(c);
        }
      },
    },
  },
  {
    // "At the start of each combat, gain 1 Dexterity." (corpus-confirmed: Dexterity)
    id: "ODDLY_SMOOTH_STONE",
    name: "Oddly Smooth Stone",
    tier: "common",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) =>
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "DEXTERITY", amount: 1 }),
    },
  },
  {
    // "Negate the next 2 Curses you obtain." RUN-LAYER: onEquip/onObtainCard not fired yet.
    id: "OMAMORI",
    name: "Omamori",
    tier: "common",
    pool: "shared",
    onEquip: (ctx) => {
      const r = ctx.run.relics.find((x) => x.defId === "OMAMORI");
      if (r) r.counter = 2;
    },
    hooks: {
      onObtainCard: (ctx, defId) => {
        if (ctx.bundle.cards.get(defId)?.type === "curse" && cnt(ctx).get() > 0) {
          cnt(ctx).set(cnt(ctx).get() - 1);
          return false; // veto the obtain
        }
      },
    },
  },
  {
    // "If you end your turn without Block, gain 6 Block."
    // Checked before Metallicize/Plated Armor block applies (their gains are
    // still queued), matching the game's stacking behavior.
    id: "ORICHALCUM",
    name: "Orichalcum",
    tier: "common",
    pool: "shared",
    hooks: {
      atEndOfTurnPreEndOfTurnCards: (ctx) => {
        if (ctx.combat!.player.block === 0) {
          ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: 6, fromCard: false });
        }
      },
    },
  },
  {
    // "Every 10th Attack you play deals double damage." Persistent counter 0-9;
    // damage doubles while counter==9 (the 10th attack), then resets on use.
    id: "PEN_NIB",
    name: "Pen Nib",
    tier: "common",
    pool: "shared",
    hooks: {
      atDamageGive: (ctx, d, _type, card) => {
        if (card && cnt(ctx).get() === 9 && ctx.bundle.cards.get(card.defId)?.type === "attack") return d * 2;
        return d;
      },
      onUseCard: (ctx, card) => {
        if (ctx.bundle.cards.get(card.defId)?.type !== "attack") return;
        const c = cnt(ctx).get() + 1;
        cnt(ctx).set(c >= 10 ? 0 : c);
      },
    },
  },
  {
    // "Enemies in Elite combats have 25% less HP." (current HP reduced at spawn)
    id: "PRESERVED_INSECT",
    name: "Preserved Insect",
    tier: "common",
    pool: "shared",
    hooks: {
      atBattleStartPreDraw: (ctx) => {
        const isElite = ctx.combat!.monsters.some((m) => ctx.bundle.monsters.get(m.id)?.category === "elite");
        if (!isElite) return;
        for (const m of ctx.combat!.monsters) m.hp = Math.floor(m.hp * 0.75);
      },
    },
  },
  {
    // "Upon pickup, gain 2 Potion slots." RUN-LAYER: onEquip not fired yet.
    id: "POTION_BELT",
    name: "Potion Belt",
    tier: "common",
    pool: "shared",
    onEquip: (ctx) => {
      ctx.run.potionSlots += 2;
      ctx.run.potions.push(null, null);
    },
    hooks: {},
  },
  {
    // "Whenever you Rest, heal an additional 15 HP." RUN-LAYER: onRest not fired yet.
    id: "REGAL_PILLOW",
    name: "Regal Pillow",
    tier: "common",
    pool: "shared",
    hooks: { onRest: (ctx) => healPlayer(ctx, 15) },
  },
  {
    // "While your HP is at or below 50%, you have 3 additional Strength."
    // counter is the "currently active" flag (onBloodied refires on every hit while bloodied).
    id: "RED_SKULL",
    name: "Red Skull",
    tier: "common",
    pool: "red",
    hooks: {
      atBattleStart: (ctx) => {
        if (ctx.run.hp <= ctx.run.maxHp / 2) {
          cnt(ctx).set(1);
          ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: 3 });
        } else {
          cnt(ctx).set(0);
        }
      },
      onBloodied: (ctx) => {
        if (cnt(ctx).get() === 0) {
          cnt(ctx).set(1);
          ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: 3 });
        }
      },
      onNotBloodied: (ctx) => {
        if (cnt(ctx).get() === 1) {
          cnt(ctx).set(0);
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: PLAYER,
            target: PLAYER,
            powerId: "STRENGTH",
            amount: -3,
          });
        }
      },
    },
  },
  {
    // "The merchant's card removal service now always costs 50 Gold."
    // RUN-LAYER: removal pricing is a shop-layer concern (modifyPrice is per-product).
    id: "SMILING_MASK",
    name: "Smiling Mask",
    tier: "common",
    pool: "shared",
    hooks: {},
  },
  {
    // "Whenever you apply Poison, apply an additional 1 Poison."
    // ENGINE-GAP: the engine does not fire onApplyPower yet, and the hook carries
    // no amount to modify - implemented with a reentrancy flag so it is exact
    // once the call site lands. DEPENDS: POISON power (Silent workstream).
    id: "SNECKO_SKULL",
    name: "Snecko Skull",
    tier: "common",
    pool: "green",
    hooks: {
      onApplyPower: (ctx, powerId, target, source) => {
        if (powerId !== "POISON" || target.kind !== "monster" || source?.kind !== "player") return;
        if (!ctx.bundle.powers.has("POISON")) return;
        if (cnt(ctx).get() === 1) {
          cnt(ctx).set(0); // our own extra application - don't recurse
          return;
        }
        cnt(ctx).set(1);
        ctx.queue.addToTop({ kind: "applyPower", source, target, powerId: "POISON", amount: 1 });
      },
    },
  },
  {
    // "Upon pickup, raise your Max HP by 7." RUN-LAYER: onEquip not fired yet.
    id: "STRAWBERRY",
    name: "Strawberry",
    tier: "common",
    pool: "shared",
    onEquip: (ctx) => {
      ctx.run.maxHp += 7;
      ctx.run.hp += 7;
    },
    hooks: {},
  },
  {
    // "Whenever you would deal 4 or less unblocked Attack damage, increase it to 5."
    // ENGINE-GAP: needs a relic-stage atDamageFinalGive fold (the damage calc only
    // folds relics at the pre-Strength atDamageGive stage).
    id: "THE_BOOT",
    name: "The Boot",
    tier: "common",
    pool: "shared",
    hooks: {},
  },
  {
    // "Every 4th ? room is a Treasure room." RUN-LAYER (uses history.tinyChestCounter).
    id: "TINY_CHEST",
    name: "Tiny Chest",
    tier: "common",
    pool: "shared",
    hooks: {},
  },
  {
    // "Whenever you use a potion, heal 5 HP." RUN-LAYER: onUsePotion not fired yet.
    id: "TOY_ORNITHOPTER",
    name: "Toy Ornithopter",
    tier: "common",
    pool: "shared",
    hooks: {
      onUsePotion: (ctx) => {
        if (ctx.combat) ctx.queue.addToBottom({ kind: "heal", target: PLAYER, amount: 5 });
        else healPlayer(ctx, 5);
      },
    },
  },
  {
    // "At the start of each combat, gain 1 Strength."
    id: "VAJRA",
    name: "Vajra",
    tier: "common",
    pool: "shared",
    hooks: {
      atBattleStart: (ctx) =>
        ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId: "STRENGTH", amount: 1 }),
    },
  },
  {
    // "Upon pick up, Upgrade 2 random Skills." RUN-LAYER: onEquip not fired yet.
    // miscRng per the game's WarPaint implementation.
    id: "WAR_PAINT",
    name: "War Paint",
    tier: "common",
    pool: "shared",
    onEquip: (ctx) => upgradeRandomDeckCards(ctx, "skill", 2),
    hooks: {},
  },
  {
    // "Upon pickup, Upgrade 2 random Attacks." RUN-LAYER: onEquip not fired yet.
    id: "WHETSTONE",
    name: "Whetstone",
    tier: "common",
    pool: "shared",
    onEquip: (ctx) => upgradeRandomDeckCards(ctx, "attack", 2),
    hooks: {},
  },
];

function upgradeRandomDeckCards(
  ctx: import("../../engine/content/defs").EffectCtx,
  type: "attack" | "skill",
  n: number,
): void {
  const candidates = ctx.run.deck.filter((mc) => {
    const def = ctx.bundle.cards.get(mc.defId);
    return def?.type === type && mc.upgrades === 0;
  });
  const rng = ctx.rng("miscRng");
  for (let i = 0; i < n && candidates.length > 0; i++) {
    const idx = rng.random(candidates.length - 1);
    candidates.splice(idx, 1)[0]!.upgrades = 1;
  }
}
