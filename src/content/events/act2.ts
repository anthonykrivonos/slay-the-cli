// Act 2 event pool (13 events) - data/corpus/events.json is the spec.

import type { EventDef, EffectCtx } from "../../engine/content/defs";
import { obtainRelicFromPool, POTION_DROP } from "../../engine/run/rewards";
import { rollCardRarity, classCardPool } from "../../engine/run/rewards";
import {
  a15,
  combatOption,
  combatPendingLabel,
  damagePlayer,
  dataOf,
  endEvent,
  eventCombatRewards,
  fractionMaxHp,
  gainGold,
  gainMaxHp,
  hasRelic,
  healHp,
  leaveOption,
  loseGold,
  loseHp,
  loseMaxHp,
  obtainCard,
  obtainRelic,
  openRewards,
  option,
  removableIndices,
  removeDeckCards,
  removeRelic,
  requestDeckChoice,
  requestOptionChoice,
  peekData,
  screenOf,
  screenlessRandomRelic,
  setScreen,
  simpleEvent,
  transformDeckCard,
  upgradeableIndices,
  upgradeDeckCard,
} from "./lib";

// --- Pleading Vagrant --------------------------------------------------------------------

const pleadingVagrant: EventDef = simpleEvent({
  id: "PLEADING_VAGRANT",
  name: "Pleading Vagrant",
  pool: "act2",
  summary: "A vagrant offers a relic for coin; it can also simply be robbed at the cost of a curse.",
  options: () => [
    option(
      "Offer gold: pay 85 gold, obtain a random relic",
      (ctx) => {
        loseGold(ctx, 85);
        obtainRelic(ctx, screenlessRandomRelic(ctx));
        endEvent(ctx);
      },
      (ctx) => ctx.run.gold >= 85,
    ),
    option("Rob: obtain a random relic and the Shame curse", (ctx) => {
      obtainRelic(ctx, screenlessRandomRelic(ctx));
      obtainCard(ctx, "SHAME");
      endEvent(ctx);
    }),
    leaveOption(),
  ],
});

// --- Ancient Writing ---------------------------------------------------------------------

function isStarterStrikeOrDefend(ctx: EffectCtx, deckIdx: number): boolean {
  const mc = ctx.run.deck[deckIdx]!;
  const def = ctx.bundle.cards.get(mc.defId);
  return def?.rarity === "basic" && (mc.defId.startsWith("STRIKE") || mc.defId.startsWith("DEFEND"));
}

const ancientWriting: EventDef = simpleEvent({
  id: "ANCIENT_WRITING",
  name: "Ancient Writing",
  pool: "act2",
  summary: "Glowing glyphs grant either a card removal or upgrades to every starter Strike and Defend.",
  options: () => [
    option(
      "Elegance: remove a card",
      (ctx) => requestDeckChoice(ctx, { tag: "remove", indices: removableIndices(ctx), min: 1, max: 1, reason: "event:ancientWriting" }),
      (ctx) => removableIndices(ctx).length > 0,
    ),
    option("Simplicity: upgrade all starter Strikes and Defends", (ctx) => {
      for (const i of upgradeableIndices(ctx)) {
        if (isStarterStrikeOrDefend(ctx, i)) upgradeDeckCard(ctx, i);
      }
      endEvent(ctx);
    }),
  ],
  onResume: (ctx, _tag, chosen) => {
    removeDeckCards(ctx, chosen);
    endEvent(ctx);
  },
});

// --- Old Beggar --------------------------------------------------------------------------

const oldBeggar: EventDef = simpleEvent({
  id: "OLD_BEGGAR",
  name: "Old Beggar",
  pool: "act2",
  canSpawn: (run) => run.gold >= 75,
  summary: "A beggar removes a card from your deck in exchange for alms.",
  options: () => [
    option(
      "Offer gold: pay 75 gold, remove a card",
      (ctx) => {
        loseGold(ctx, 75);
        requestDeckChoice(ctx, { tag: "remove", indices: removableIndices(ctx), min: 1, max: 1, reason: "event:oldBeggar" });
      },
      (ctx) => ctx.run.gold >= 75 && removableIndices(ctx).length > 0,
    ),
    leaveOption(),
  ],
  onResume: (ctx, _tag, chosen) => {
    removeDeckCards(ctx, chosen);
    endEvent(ctx);
  },
});

// --- The Colosseum ------------------------------------------------------------------------

const COLOSSEUM_SLAVERS = ["BLUE_SLAVER", "RED_SLAVER"];
const COLOSSEUM_NOBS = ["TASKMASTER", "GREMLIN_NOB"];

const colosseum: EventDef = {
  id: "COLOSSEUM",
  name: "The Colosseum",
  pool: "act2",
  // second half of the act map (curMapNodeY > 7)
  canSpawn: (run) => run.position !== null && run.position[1] > 7,
  build: (ctx) => {
    const won = screenOf(ctx) === "wonFirst";
    return {
      summary: "You are thrown into an arena: a forced fight, then a choice to flee or face a harder bout for big rewards.",
      options: [
        combatOption(
          combatPendingLabel(ctx, "Fight: battle Blue Slaver + Red Slaver with no combat rewards", COLOSSEUM_SLAVERS),
          COLOSSEUM_SLAVERS,
          (c, svc) => svc.startCombat({ encounterId: "COLOSSEUM_EVENT_SLAVERS", monsters: COLOSSEUM_SLAVERS, roomKind: "monster" }),
          () => !won,
        ),
        option("Cowardice: escape, event ends", (c) => endEvent(c), () => won),
        combatOption(
          combatPendingLabel(
            ctx,
            "Victory: battle Taskmaster + Gremlin Nob; win 100 gold, a rare and an uncommon relic, and a card reward",
            COLOSSEUM_NOBS,
          ),
          COLOSSEUM_NOBS,
          (c, svc) => svc.startCombat({ encounterId: "COLOSSEUM_EVENT_NOBS", monsters: COLOSSEUM_NOBS, roomKind: "elite" }),
          () => won,
        ),
      ],
    };
  },
  onCombatVictory: (ctx, encounterId, data) => {
    if (encounterId === "COLOSSEUM_EVENT_SLAVERS") {
      // no reward screen; the potion pity still advances invisibly (corpus note)
      ctx.run.blizzard.potionChance += POTION_DROP.pityStep;
      ctx.run.room = {
        kind: "event",
        eventId: "COLOSSEUM",
        screen: "wonFirst",
        data: (data as Record<string, unknown> | undefined) ?? {},
      };
      return;
    }
    // COLOSSEUM_EVENT_NOBS: elite combat for most triggers; Black Star adds no extra relic
    openRewards(
      ctx,
      eventCombatRewards(ctx, {
        gold: 100,
        relics: [obtainRelicFromPool(ctx.run, "rare"), obtainRelicFromPool(ctx.run, "uncommon")],
        potionRoll: true,
        cardRoom: "elite",
      }),
    );
  },
};

// --- Cursed Tome ---------------------------------------------------------------------------

const CURSED_TOME_BOOKS = ["NECRONOMICON", "ENCHIRIDION", "NILRYS_CODEX"] as const;

const cursedTome: EventDef = {
  id: "CURSED_TOME",
  name: "Cursed Tome",
  pool: "act2",
  build: (ctx) => {
    const screen = screenOf(ctx); // undefined | "reading" | "take"
    const page = (peekData(ctx).page as number) ?? 1;
    return {
      summary: "A sinister book charges escalating HP per page and finally offers one of three book relics.",
      options: [
        option(
          "Read: begin reading (no cost)",
          (c) => {
            setScreen(c, "reading");
            dataOf(c).page = 1;
          },
          () => screen === undefined,
        ),
        option(
          `Continue: lose ${page} HP (page ${page} of 3)`,
          (c) => {
            const d = dataOf(c);
            const p = (d.page as number) ?? 1;
            loseHp(c, p);
            if (c.run.hp <= 0) return;
            if (p >= 3) setScreen(c, "take");
            else d.page = p + 1;
          },
          () => screen === "reading",
        ),
        option(
          `Take: lose ${a15(ctx) ? 15 : 10} HP; obtain Necronomicon, Enchiridion, or Nilry's Codex`,
          (c) => {
            loseHp(c, a15(c) ? 15 : 10);
            if (c.run.hp <= 0) return;
            const id = CURSED_TOME_BOOKS[c.rng("miscRng").random(2)]!;
            openRewards(c, [{ kind: "relic", id, taken: false }]);
          },
          () => screen === "take",
        ),
        option(
          "Stop: lose 3 HP, no relic",
          (c) => {
            loseHp(c, 3);
            if (c.run.hp <= 0) return;
            endEvent(c);
          },
          () => screen === "take",
        ),
        option("Leave: no effect", (c) => endEvent(c), () => screen === undefined),
      ],
    };
  },
};

// --- Augmenter ---------------------------------------------------------------------------------

const augmenter: EventDef = simpleEvent({
  id: "AUGMENTER",
  name: "Augmenter",
  pool: "act2",
  summary: "A back-alley scientist offers a mutagen card, a double transform, or an unstable strength relic.",
  options: () => [
    option("Test J.A.X.: obtain the J.A.X. card", (ctx) => {
      obtainCard(ctx, "JAX");
      endEvent(ctx);
    }),
    option(
      "Become test subject: transform 2 cards",
      (ctx) => {
        const indices = removableIndices(ctx);
        requestDeckChoice(ctx, { tag: "transform2", indices, min: Math.min(2, indices.length), max: Math.min(2, indices.length), reason: "event:augmenter" });
      },
      (ctx) => removableIndices(ctx).length > 0,
    ),
    option("Ingest mutagens: obtain Mutagenic Strength relic", (ctx) => {
      obtainRelic(ctx, "MUTAGENIC_STRENGTH");
      endEvent(ctx);
    }),
  ],
  onResume: (ctx, _tag, chosen) => {
    // descending order keeps remaining indices valid (replacements append)
    for (const i of [...new Set(chosen)].sort((x, y) => y - x)) transformDeckCard(ctx, i);
    endEvent(ctx);
  },
});

// --- Forgotten Altar ------------------------------------------------------------------------------

const forgottenAltar: EventDef = simpleEvent({
  id: "FORGOTTEN_ALTAR",
  name: "Forgotten Altar",
  pool: "act2",
  onEnter: (ctx) => {
    // HP loss computed at setup from PRE-gain max HP
    dataOf(ctx).sacrificeLoss = fractionMaxHp(ctx, a15(ctx) ? 0.35 : 0.25, "round");
  },
  summary: "An altar demands sacrifice: trade the Golden Idol, bleed for max HP, or desecrate it and be cursed.",
  options: () => [
    option(
      "Offer Golden Idol: replace Golden Idol with Bloody Idol",
      (ctx) => {
        const idx = ctx.run.relics.findIndex((r) => r.defId === "GOLDEN_IDOL");
        ctx.run.relics[idx] = { defId: "BLOODY_IDOL", counter: 0 };
        ctx.bundle.relics.get("BLOODY_IDOL")?.onEquip?.(ctx);
        endEvent(ctx);
      },
      (ctx) => hasRelic(ctx.run, "GOLDEN_IDOL"),
    ),
    option("Sacrifice: gain 5 max HP, lose 25% of max HP (35% at A15+)", (ctx) => {
      const loss = dataOf(ctx).sacrificeLoss as number;
      gainMaxHp(ctx, 5);
      loseHp(ctx, loss);
      if (ctx.run.hp <= 0) return;
      endEvent(ctx);
    }),
    option("Desecrate: obtain the Decay curse", (ctx) => {
      obtainCard(ctx, "DECAY");
      endEvent(ctx);
    }),
  ],
});

// --- Council of Ghosts -----------------------------------------------------------------------------

const ghosts: EventDef = simpleEvent({
  id: "GHOSTS",
  name: "Council of Ghosts",
  pool: "act2",
  summary: "Spectral figures offer Apparition cards in exchange for half your max HP.",
  options: () => [
    option("Accept: lose 50% of max HP permanently, obtain 5 Apparitions (3 at A15+)", (ctx) => {
      loseMaxHp(ctx, Math.min(ctx.run.maxHp - 1, fractionMaxHp(ctx, 0.5, "ceil")));
      const n = a15(ctx) ? 3 : 5;
      for (let i = 0; i < n; i++) obtainCard(ctx, "APPARITION");
      endEvent(ctx);
    }),
    option("Refuse: no effect", (ctx) => endEvent(ctx)),
  ],
});

// --- Masked Bandits ---------------------------------------------------------------------------------

const BANDIT_MONSTERS = ["POINTY", "ROMEO", "BEAR"];

const maskedBandits: EventDef = {
  id: "MASKED_BANDITS",
  name: "Masked Bandits",
  pool: "act2",
  build: (ctx) => ({
    summary: "Bandits demand every coin you carry; refusing starts a fight for their leader's mask.",
    options: [
      option("Pay: lose ALL gold", (c) => {
        loseGold(c, c.run.gold);
        endEvent(c);
      }),
      combatOption(
        combatPendingLabel(ctx, "Fight: battle the bandits; victory yields Red Mask, 25-35 gold, and a card reward", BANDIT_MONSTERS),
        BANDIT_MONSTERS,
        (c, svc) => svc.startCombat({ encounterId: "MASKED_BANDITS_EVENT", monsters: BANDIT_MONSTERS, roomKind: "monster" }),
      ),
    ],
  }),
  onCombatVictory: (ctx) => {
    const gold = ctx.rng("miscRng").randomRange(25, 35);
    // no potion roll in the reference's reward list (corpus note)
    openRewards(ctx, eventCombatRewards(ctx, { gold, relics: ["RED_MASK"], cardRoom: "monster" }));
  },
};

// --- The Nest ------------------------------------------------------------------------------------------

const theNest: EventDef = simpleEvent({
  id: "THE_NEST",
  name: "The Nest",
  pool: "act2",
  summary: "Infiltrating a cult offers either a quick gold grab or a bloody initiation for a ritual blade.",
  options: () => [
    option("Smash and grab: gain 99 gold (50 at A15+)", (ctx) => {
      gainGold(ctx, a15(ctx) ? 50 : 99);
      endEvent(ctx);
    }),
    option("Stay in line: take 6 damage, obtain the Ritual Dagger card", (ctx) => {
      damagePlayer(ctx, 6);
      if (ctx.run.hp <= 0) return;
      obtainCard(ctx, "RITUAL_DAGGER");
      endEvent(ctx);
    }),
  ],
});

// --- The Library ----------------------------------------------------------------------------------------

const theLibrary: EventDef = simpleEvent({
  id: "THE_LIBRARY",
  name: "The Library",
  pool: "act2",
  summary: "An abandoned library lets you study one of twenty cards or nap for a heal.",
  options: () => [
    option("Read: choose 1 of 20 distinct class cards to obtain", (ctx) => {
      // 20 unique cards: per card an EVENT rarity roll, then a cardRng class
      // pick with dupe reroll; the display list is generated order REVERSED.
      const cardRng = ctx.rng("cardRng");
      const rolled: string[] = [];
      for (let i = 0; i < 20; i++) {
        const rarity = rollCardRarity(ctx, "event");
        const pool = classCardPool(ctx, rarity);
        if (pool.length === 0) continue;
        let id: string;
        let guard = 0;
        do {
          id = pool[cardRng.random(pool.length - 1)]!;
        } while (rolled.includes(id) && ++guard < 1000);
        rolled.push(id);
      }
      const display = [...rolled].reverse();
      requestOptionChoice(ctx, {
        tag: "read",
        options: display.map((id) => ctx.bundle.cards.get(id)?.name ?? id),
        reason: "event:library",
        extra: { cards: display },
      });
    }),
    option("Sleep: heal 33% of max HP (20% at A15+)", (ctx) => {
      healHp(ctx, fractionMaxHp(ctx, a15(ctx) ? 0.2 : 0.33, "round"));
      endEvent(ctx);
    }),
  ],
  onResume: (ctx, _tag, chosen, extra) => {
    const cards = (extra as { cards: string[] }).cards;
    const id = cards[chosen[0] ?? 0];
    if (id) obtainCard(ctx, id);
    endEvent(ctx);
  },
});

// --- The Mausoleum ----------------------------------------------------------------------------------------

const theMausoleum: EventDef = simpleEvent({
  id: "THE_MAUSOLEUM",
  name: "The Mausoleum",
  pool: "act2",
  summary: "A leaking sarcophagus holds a relic; opening it risks a curse.",
  options: () => [
    option("Open coffin: obtain a random relic; 50% chance of the Writhe curse (guaranteed at A15+)", (ctx) => {
      obtainRelic(ctx, screenlessRandomRelic(ctx));
      const cursed = a15(ctx) ? true : ctx.rng("miscRng").randomBoolean();
      if (cursed) obtainCard(ctx, "WRITHE");
      endEvent(ctx);
    }),
    leaveOption(),
  ],
});

// --- Vampires(?) -------------------------------------------------------------------------------------------

function removeStarterStrikes(ctx: EffectCtx): void {
  const idxs = ctx.run.deck
    .map((_, i) => i)
    .filter((i) => {
      const mc = ctx.run.deck[i]!;
      return mc.defId.startsWith("STRIKE") && ctx.bundle.cards.get(mc.defId)?.rarity === "basic";
    });
  removeDeckCards(ctx, idxs);
}

const vampires: EventDef = simpleEvent({
  id: "VAMPIRES",
  name: "Vampires(?)",
  pool: "act2",
  summary: "A blood cult converts your starter Strikes into Bites for a price paid in max HP or a Blood Vial.",
  options: () => [
    option(
      "Offer Blood Vial: lose the relic; remove all starter Strikes; obtain 5 Bites",
      (ctx) => {
        removeRelic(ctx, "BLOOD_VIAL");
        removeStarterStrikes(ctx);
        for (let i = 0; i < 5; i++) obtainCard(ctx, "BITE");
        endEvent(ctx);
      },
      (ctx) => hasRelic(ctx.run, "BLOOD_VIAL"),
    ),
    option("Accept: lose 30% of max HP permanently; remove all starter Strikes; obtain 5 Bites", (ctx) => {
      loseMaxHp(ctx, Math.min(ctx.run.maxHp - 1, fractionMaxHp(ctx, 0.3, "ceil")));
      removeStarterStrikes(ctx);
      for (let i = 0; i < 5; i++) obtainCard(ctx, "BITE");
      endEvent(ctx);
    }),
    option("Refuse: no effect", (ctx) => endEvent(ctx)),
  ],
});

export const act2Events: EventDef[] = [
  pleadingVagrant,
  ancientWriting,
  oldBeggar,
  colosseum,
  cursedTome,
  augmenter,
  forgottenAltar,
  ghosts,
  maskedBandits,
  theNest,
  theLibrary,
  theMausoleum,
  vampires,
];
