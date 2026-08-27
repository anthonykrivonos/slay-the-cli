// Potions - all 42, audited vs data/corpus/potions.json.
//
// Contract: onUse(ctx, target, potency) receives the ALREADY-RESOLVED potency.
// The use site (run layer / tests) computes it via effectivePotency(), which
// doubles the corpus base when the player holds SACRED_BARK and the potion's
// sacredBarkDoubles flag is set.
//
// Damage from potions is THORNS-type with no attacker (see relics/lib.ts).
// Choice-based potions enqueue a "choice" action whose continuation is in
// contentEffects (registered lazily + exported for static bundle merge).

import type { EffectCtx, PotionDef } from "../../engine/content/defs";
import { PLAYER, monster } from "../../engine/core/ids";
import { drawCards } from "../../engine/combat/piles";
import { hasRelic } from "../util";
import {
  aliveMonsterIdxs,
  canUpgradeInCombat,
  classPoolFilter,
  colorlessPoolFilter,
  ensureContentEffects,
  healPlayer,
  randomCardDefs,
  relicDamage,
  relicDamageAll,
  requestCardPick,
  upgradeInCombat,
} from "../relics/lib";

export { contentEffects } from "../relics/lib";

/** Resolve a potion's potency: corpus base, doubled by Sacred Bark where flagged. */
export function effectivePotency(ctx: EffectCtx, def: PotionDef): number {
  return def.sacredBarkDoubles && hasRelic(ctx, "SACRED_BARK") ? def.potency * 2 : def.potency;
}

const applySelf = (ctx: EffectCtx, powerId: string, amount: number) =>
  ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: PLAYER, powerId, amount });

const applyTarget = (ctx: EffectCtx, target: number | null, powerId: string, amount: number) =>
  ctx.queue.addToBottom({ kind: "applyPower", source: PLAYER, target: monster(target ?? 0), powerId, amount });

/** Discovery-style potion: choose 1 of 3 random cards of a type; add `potency` copies at cost 0 this turn. */
function discoveryPotion(ctx: EffectCtx, potency: number, pred: (d: import("../../engine/content/defs").CardDef) => boolean, reason: string): void {
  const picks = randomCardDefs(ctx, 3, pred); // DEPENDS: landed card pool size
  requestCardPick(ctx, { defIds: picks.map((d) => d.id), copies: potency, costZero: true, reason, dest: "hand" });
}

export const allPotions: PotionDef[] = [
  {
    // "Enter Divinity." DEPENDS: DIVINITY stance def (Watcher workstream).
    id: "AMBROSIA",
    name: "Ambrosia",
    rarity: "rare",
    class: "purple",
    targeted: false,
    potency: 0,
    sacredBarkDoubles: false,
    onUse: (ctx) => ctx.queue.addToBottom({ kind: "changeStance", stanceId: "DIVINITY" }),
  },
  {
    // "Gain [1|2] Artifact."
    id: "ANCIENT_POTION",
    name: "Ancient Potion",
    rarity: "uncommon",
    class: "shared",
    targeted: false,
    potency: 1,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "ARTIFACT", potency),
  },
  {
    // "Choose 1 of 3 random Attack cards to add [potency copies] to your hand; cost 0 this turn."
    id: "ATTACK_POTION",
    name: "Attack Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 1,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => discoveryPotion(ctx, potency, classPoolFilter(ctx, "attack"), "Attack Potion"),
  },
  {
    // "Upgrade all cards in your hand for the rest of combat."
    id: "BLESSING_OF_THE_FORGE",
    name: "Blessing of the Forge",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 0,
    sacredBarkDoubles: false,
    onUse: (ctx) => {
      const combat = ctx.combat!;
      for (const iid of combat.player.piles.hand) {
        const c = combat.cards[iid]!;
        if (canUpgradeInCombat(ctx, c)) upgradeInCombat(ctx, c);
      }
    },
  },
  {
    // "Gain [12|24] Block."
    id: "BLOCK_POTION",
    name: "Block Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 12,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: potency, fromCard: false }),
  },
  {
    // "Heal for [20%|40%] of your Max HP."
    id: "BLOOD_POTION",
    name: "Blood Potion",
    rarity: "common",
    class: "red",
    targeted: false,
    potency: 20,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => healPlayer(ctx, Math.floor((ctx.run.maxHp * potency) / 100)),
  },
  {
    // "Add [2|4] Miracles to your hand." DEPENDS: MIRACLE card def.
    id: "BOTTLED_MIRACLE",
    name: "Bottled Miracle",
    rarity: "common",
    class: "purple",
    targeted: false,
    potency: 2,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => {
      if (ctx.bundle.cards.has("MIRACLE")) {
        ctx.queue.addToBottom({ kind: "makeTempCard", defId: "MIRACLE", upgrades: 0, dest: "hand", n: potency });
      }
    },
  },
  {
    // "Choose 1 of 3 random Colorless cards..." DEPENDS: colorless pool.
    id: "COLORLESS_POTION",
    name: "Colorless Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 1,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => discoveryPotion(ctx, potency, colorlessPoolFilter(), "Colorless Potion"),
  },
  {
    // "Gain [1|2] Ritual."
    id: "CULTIST_POTION",
    name: "Cultist Potion",
    rarity: "rare",
    class: "shared",
    targeted: false,
    potency: 1,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "RITUAL", potency),
  },
  {
    // "Add [3|6] Shivs+ to your hand." (upgraded) DEPENDS: SHIV card def.
    id: "CUNNING_POTION",
    name: "Cunning Potion",
    rarity: "uncommon",
    class: "green",
    targeted: false,
    potency: 3,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => {
      if (ctx.bundle.cards.has("SHIV")) {
        ctx.queue.addToBottom({ kind: "makeTempCard", defId: "SHIV", upgrades: 1, dest: "hand", n: potency });
      }
    },
  },
  {
    // "Gain [2|4] Dexterity."
    id: "DEXTERITY_POTION",
    name: "Dexterity Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 2,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "DEXTERITY", potency),
  },
  {
    // "Play the top [3|6] cards of your draw pile."
    // PARTIAL: the top cards are captured at use time; the game re-reads the top
    // as each play resolves (differs only if a played card reorders the pile).
    // Random targets rolled with cardRandomRng at use time.
    id: "DISTILLED_CHAOS",
    name: "Distilled Chaos",
    rarity: "uncommon",
    class: "shared",
    targeted: false,
    potency: 3,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => {
      const combat = ctx.combat!;
      const top = combat.player.piles.draw.slice(0, potency);
      for (const iid of top) {
        const def = ctx.bundle.cards.get(combat.cards[iid]!.defId);
        let target: number | null = null;
        if (def && (def.target === "enemy" || def.target === "selfandenemy")) {
          const alive = aliveMonsterIdxs(ctx);
          if (alive.length === 0) continue;
          target = alive[ctx.rng("cardRandomRng").random(alive.length - 1)]!;
        }
        combat.cardQueue.push({
          iid,
          target,
          energyOnUse: 0,
          ignoreEnergyTotal: true,
          regardlessOfCost: true,
          purgeOnUse: false,
          exhaustOnUse: false,
          autoplayed: true,
          via: "DISTILLED_CHAOS",
        });
      }
    },
  },
  {
    // "This turn, your next [1|2] card(s) are played twice." (DUPLICATION power)
    id: "DUPLICATION_POTION",
    name: "Duplication Potion",
    rarity: "uncommon",
    class: "shared",
    targeted: false,
    potency: 1,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "DUPLICATION", potency),
  },
  {
    // "Exhaust any number of cards in your hand."
    id: "ELIXIR_POTION",
    name: "Elixir",
    rarity: "uncommon",
    class: "red",
    targeted: false,
    potency: 0,
    sacredBarkDoubles: false,
    onUse: (ctx) => {
      ensureContentEffects(ctx);
      const iids = [...ctx.combat!.player.piles.hand];
      if (iids.length === 0) return;
      ctx.queue.addToBottom({
        kind: "choice",
        request: { kind: "cards", pile: "hand", iids, min: 0, max: iids.length, canCancel: true, reason: "Elixir" },
        resume: "content:exhaustChosen",
        resumeArgs: { iids },
      });
    },
  },
  {
    // "Gain [2|4] Energy."
    id: "ENERGY_POTION",
    name: "Energy Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 2,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => ctx.queue.addToBottom({ kind: "gainEnergy", n: potency }),
  },
  {
    // "Fill all your empty potion slots with random potions."
    // RUN-LAYER: random potion generation (potionRng + rarity weights) lives in
    // the run layer. No-op until it lands.
    id: "ENTROPIC_BREW",
    name: "Entropic Brew",
    rarity: "rare",
    class: "shared",
    targeted: false,
    potency: 0,
    sacredBarkDoubles: false,
    onUse: () => {},
  },
  {
    // "Channel [1|2] Dark for each orb slot." DEPENDS: DARK orb def.
    id: "ESSENCE_OF_DARKNESS",
    name: "Essence of Darkness",
    rarity: "rare",
    class: "blue",
    targeted: false,
    potency: 1,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => {
      const n = ctx.combat!.player.orbSlots * potency;
      for (let i = 0; i < n; i++) ctx.queue.addToBottom({ kind: "channelOrb", orbId: "DARK" });
    },
  },
  {
    // "Gain [4|8] Plated Armor."
    id: "ESSENCE_OF_STEEL",
    name: "Essence of Steel",
    rarity: "uncommon",
    class: "shared",
    targeted: false,
    potency: 4,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "PLATED_ARMOR", potency),
  },
  {
    // "Deal [10|20] damage to all enemies."
    id: "EXPLOSIVE_POTION",
    name: "Explosive Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 10,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => relicDamageAll(ctx, potency),
  },
  {
    // "When you would die, heal to [30%|60%] of Max HP instead."
    // ENGINE-GAP: non-drinkable death-save; playerDeath has no hook yet.
    id: "FAIRY_POTION",
    name: "Fairy in a Bottle",
    rarity: "rare",
    class: "shared",
    targeted: false,
    potency: 30,
    sacredBarkDoubles: true,
    onUse: () => {},
  },
  {
    // "Apply [3|6] Vulnerable to target enemy."
    id: "FEAR_POTION",
    name: "Fear Potion",
    rarity: "common",
    class: "shared",
    targeted: true,
    potency: 3,
    sacredBarkDoubles: true,
    onUse: (ctx, target, potency) => applyTarget(ctx, target, "VULNERABLE", potency),
  },
  {
    // "Deal [20|40] damage to target enemy."
    id: "FIRE_POTION",
    name: "Fire Potion",
    rarity: "common",
    class: "shared",
    targeted: true,
    potency: 20,
    sacredBarkDoubles: true,
    onUse: (ctx, target, potency) => relicDamage(ctx, target ?? 0, potency),
  },
  {
    // "Gain [5|10] Strength. At the end of your turn, lose [5|10] Strength."
    id: "FLEX_POTION",
    name: "Flex Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 5,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => {
      applySelf(ctx, "STRENGTH", potency);
      applySelf(ctx, "LOSE_STRENGTH", potency);
    },
  },
  {
    // "Gain [2|4] Focus."
    id: "FOCUS_POTION",
    name: "Focus Potion",
    rarity: "common",
    class: "blue",
    targeted: false,
    potency: 2,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "FOCUS", potency),
  },
  {
    // "Gain [5|10] Max HP." (raises current HP too)
    id: "FRUIT_JUICE",
    name: "Fruit Juice",
    rarity: "rare",
    class: "shared",
    targeted: false,
    potency: 5,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => {
      ctx.run.maxHp += potency;
      healPlayer(ctx, potency);
    },
  },
  {
    // "Discard any number of cards, then draw that many."
    id: "GAMBLERS_BREW",
    name: "Gambler's Brew",
    rarity: "uncommon",
    class: "shared",
    targeted: false,
    potency: 0,
    sacredBarkDoubles: false,
    onUse: (ctx) => {
      ensureContentEffects(ctx);
      const iids = [...ctx.combat!.player.piles.hand];
      if (iids.length === 0) return;
      ctx.queue.addToBottom({
        kind: "choice",
        request: { kind: "cards", pile: "hand", iids, min: 0, max: iids.length, canCancel: true, reason: "Gambler's Brew" },
        resume: "content:discardChosenThenDraw",
        resumeArgs: { iids },
      });
    },
  },
  {
    // "Gain [1|2] Intangible."
    id: "GHOST_IN_A_JAR",
    name: "Ghost in a Jar",
    rarity: "rare",
    class: "green",
    targeted: false,
    potency: 1,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "INTANGIBLE", potency),
  },
  {
    // "Gain [6|12] Metallicize."
    id: "HEART_OF_IRON",
    name: "Heart of Iron",
    rarity: "rare",
    class: "red",
    targeted: false,
    potency: 6,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "METALLICIZE", potency),
  },
  {
    // "Gain [3|6] Thorns."
    id: "LIQUID_BRONZE",
    name: "Liquid Bronze",
    rarity: "uncommon",
    class: "shared",
    targeted: false,
    potency: 3,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "THORNS", potency),
  },
  {
    // "Choose [1|2] card(s) in your discard pile; return to hand, cost 0 this turn."
    id: "LIQUID_MEMORIES",
    name: "Liquid Memories",
    rarity: "uncommon",
    class: "shared",
    targeted: false,
    potency: 1,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => {
      ensureContentEffects(ctx);
      const iids = [...ctx.combat!.player.piles.discard];
      if (iids.length === 0) return;
      ctx.queue.addToBottom({
        kind: "choice",
        request: {
          kind: "cards",
          pile: "discard",
          iids,
          min: 0,
          max: Math.min(potency, iids.length),
          canCancel: true,
          reason: "Liquid Memories",
        },
        resume: "content:returnChosenToHandFree",
        resumeArgs: { iids },
      });
    },
  },
  {
    // "Apply [6|12] Poison to target enemy." DEPENDS: POISON power (Silent workstream).
    id: "POISON_POTION",
    name: "Poison Potion",
    rarity: "common",
    class: "green",
    targeted: true,
    potency: 6,
    sacredBarkDoubles: true,
    onUse: (ctx, target, potency) => {
      if (ctx.bundle.powers.has("POISON")) applyTarget(ctx, target, "POISON", potency);
    },
  },
  {
    // "Gain [2|4] Orb slots."
    id: "POTION_OF_CAPACITY",
    name: "Potion of Capacity",
    rarity: "uncommon",
    class: "blue",
    targeted: false,
    potency: 2,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => ctx.queue.addToBottom({ kind: "changeOrbSlots", delta: potency }),
  },
  {
    // "Choose 1 of 3 random Power cards..."
    id: "POWER_POTION",
    name: "Power Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 1,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => discoveryPotion(ctx, potency, classPoolFilter(ctx, "power"), "Power Potion"),
  },
  {
    // "Gain [5|10] Regeneration."
    id: "REGEN_POTION",
    name: "Regen Potion",
    rarity: "uncommon",
    class: "shared",
    targeted: false,
    potency: 5,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "REGEN", potency),
  },
  {
    // "Choose 1 of 3 random Skill cards..."
    id: "SKILL_POTION",
    name: "Skill Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 1,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => discoveryPotion(ctx, potency, classPoolFilter(ctx, "skill"), "Skill Potion"),
  },
  {
    // "Escape from a non-boss combat. Receive no rewards."
    id: "SMOKE_BOMB",
    name: "Smoke Bomb",
    rarity: "rare",
    class: "shared",
    targeted: false,
    potency: 0,
    sacredBarkDoubles: false,
    // bosses cannot be walked out on; event combats can
    canUse: (ctx) => ctx.combat !== null && !(ctx.run.room?.kind === "combat" && ctx.run.room.roomKind === "boss"),
    onUse: (ctx) => {
      ctx.rt.combatOver = "escape";
    },
  },
  {
    // "Draw [5|10] cards. Randomize the cost of cards in your hand."
    id: "SNECKO_OIL",
    name: "Snecko Oil",
    rarity: "rare",
    class: "shared",
    targeted: false,
    potency: 5,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => {
      drawCards(ctx, potency);
      const combat = ctx.combat!;
      for (const iid of combat.player.piles.hand) {
        const c = combat.cards[iid]!;
        if (c.cost >= 0) {
          const newCost = ctx.rng("cardRandomRng").random(3);
          c.cost = newCost;
          c.costForTurn = newCost;
        }
      }
    },
  },
  {
    // "Gain [5|10] Dexterity. At the end of your turn, lose [5|10] Dexterity."
    id: "SPEED_POTION",
    name: "Speed Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 5,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => {
      applySelf(ctx, "DEXTERITY", potency);
      applySelf(ctx, "LOSE_DEXTERITY", potency);
    },
  },
  {
    // "Enter Calm or Wrath." DEPENDS: CALM/WRATH stance defs.
    id: "STANCE_POTION",
    name: "Stance Potion",
    rarity: "uncommon",
    class: "purple",
    targeted: false,
    potency: 0,
    sacredBarkDoubles: false,
    onUse: (ctx) => {
      ensureContentEffects(ctx);
      ctx.queue.addToBottom({
        kind: "choice",
        request: { kind: "option", options: ["Calm", "Wrath"], reason: "Stance Potion" },
        resume: "content:stanceChosen",
        resumeArgs: { stances: ["CALM", "WRATH"] },
      });
    },
  },
  {
    // "Gain [2|4] Strength."
    id: "STRENGTH_POTION",
    name: "Strength Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 2,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => applySelf(ctx, "STRENGTH", potency),
  },
  {
    // "Draw [3|6] cards."
    id: "SWIFT_POTION",
    name: "Swift Potion",
    rarity: "common",
    class: "shared",
    targeted: false,
    potency: 3,
    sacredBarkDoubles: true,
    onUse: (ctx, _t, potency) => ctx.queue.addToBottom({ kind: "draw", n: potency }),
  },
  {
    // "Apply [3|6] Weak to target enemy."
    id: "WEAK_POTION",
    name: "Weak Potion",
    rarity: "common",
    class: "shared",
    targeted: true,
    potency: 3,
    sacredBarkDoubles: true,
    onUse: (ctx, target, potency) => applyTarget(ctx, target, "WEAK", potency),
  },
];
