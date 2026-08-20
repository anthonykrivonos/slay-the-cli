// Act 3 event pool (7 events) — data/corpus/events.json is the spec.

import type { EventDef, EffectCtx } from "../../engine/content/defs";
import { JavaRandom, javaShuffle } from "../../engine/core/rng";
import {
  a15,
  cardName,
  combatOption,
  combatPendingLabel,
  createColorlessCardReward,
  dataOf,
  deckIndicesOfType,
  endEvent,
  eventCombatRewards,
  fractionMaxHp,
  gainGold,
  hasRelic,
  healHp,
  healToFull,
  leaveOption,
  loseGold,
  loseHp,
  loseMaxHp,
  obtainCard,
  openRewards,
  option,
  peekData,
  removeDeckCards,
  removeRelic,
  obtainRelic,
  screenlessRelicOfTier,
  simpleEvent,
  upgradeableIndices,
  upgradeDeckCard,
} from "./lib";

// --- Falling --------------------------------------------------------------------------

const fallingPick = (ctx: EffectCtx, key: string): number | undefined => peekData(ctx)[key] as number | undefined;

function fallingLabel(ctx: EffectCtx, verb: string, key: string, type: string): string {
  const idx = fallingPick(ctx, key);
  const mc = idx !== undefined ? ctx.run.deck[idx] : undefined;
  return mc ? `${verb}: lose ${cardName(ctx, mc)} (${type})` : `${verb}: lose the shown ${type}`;
}

const falling: EventDef = {
  id: "FALLING",
  name: "Falling",
  pool: "act3",
  onEnter: (ctx) => {
    // one uniform miscRng pick per card type present, in option order
    // (skill, power, attack). Bottled cards are NOT excluded (reference TODO).
    const d = dataOf(ctx);
    const misc = ctx.rng("miscRng");
    for (const [key, type] of [
      ["skillIdx", "skill"],
      ["powerIdx", "power"],
      ["attackIdx", "attack"],
    ] as const) {
      const idxs = deckIndicesOfType(ctx, type);
      if (idxs.length > 0) d[key] = idxs[misc.random(idxs.length - 1)]!;
    }
  },
  build: (ctx) => {
    const mk = (verb: string, key: string, type: string) =>
      option(
        fallingLabel(ctx, verb, key, type),
        (c) => {
          const idx = fallingPick(c, key);
          if (idx !== undefined) removeDeckCards(c, [idx]);
          endEvent(c);
        },
        (c) => fallingPick(c, key) !== undefined,
      );
    return {
      summary: "Mid-fall you must jettison one card: a preselected random skill, power, or attack.",
      options: [
        mk("Land", "skillIdx", "skill"),
        mk("Channel", "powerIdx", "power"),
        mk("Strike", "attackIdx", "attack"),
        option(
          "Land on your head: no card lost",
          (c) => endEvent(c),
          (c) => fallingPick(c, "skillIdx") === undefined && fallingPick(c, "powerIdx") === undefined && fallingPick(c, "attackIdx") === undefined,
        ),
      ],
    };
  },
};

// --- Mindbloom -------------------------------------------------------------------------

const MINDBLOOM_BOSSES = ["THE_GUARDIAN", "HEXAGHOST", "SLIME_BOSS"];

const mindbloom: EventDef = {
  id: "MINDBLOOM",
  name: "Mindbloom",
  pool: "act3",
  build: (ctx) => ({
    summary: "Your thoughts become real: fight a phantom Act 1 boss, upgrade everything, or take gold/health with a curse.",
    options: [
      combatOption(
        combatPendingLabel(ctx, "I am War: fight a random Act 1 boss for a rare relic, gold, and a card reward", MINDBLOOM_BOSSES),
        MINDBLOOM_BOSSES,
        (c, svc) => {
          const order = [...MINDBLOOM_BOSSES];
          javaShuffle(order, new JavaRandom(c.rng("miscRng").randomLong()));
          const boss = order[0]!;
          svc.startCombat({ encounterId: boss, monsters: [boss], roomKind: "monster" });
        },
      ),
      option("I am Awake: upgrade every upgradeable card; obtain Mark of the Bloom", (c) => {
        for (const i of upgradeableIndices(c)) upgradeDeckCard(c, i);
        obtainRelic(c, "MARK_OF_THE_BLOOM");
        endEvent(c);
      }),
      option(
        "I am Rich: gain 999 gold, obtain 2 Normality curses",
        (c) => {
          gainGold(c, 999);
          obtainCard(c, "NORMALITY");
          obtainCard(c, "NORMALITY");
          endEvent(c);
        },
        (c) => c.run.floor <= 40,
      ),
      option(
        "I am Healthy: heal to full, obtain the Doubt curse",
        (c) => {
          healToFull(c);
          obtainCard(c, "DOUBT");
          endEvent(c);
        },
        (c) => c.run.floor >= 41,
      ),
    ],
  }),
  onCombatVictory: (ctx) => {
    const gold = a15(ctx) ? 25 : 50;
    openRewards(ctx, eventCombatRewards(ctx, { gold, relics: [screenlessRelicOfTier(ctx, "rare")], potionRoll: true, cardRoom: "monster" }));
  },
};

// --- The Moai Head ----------------------------------------------------------------------

const moaiHead: EventDef = simpleEvent({
  id: "THE_MOAI_HEAD",
  name: "The Moai Head",
  pool: "act3",
  canSpawn: (run) => run.hp <= run.maxHp / 2 || run.relics.some((r) => r.defId === "GOLDEN_IDOL"),
  summary: "A stone head swallows the wounded whole, or swallows a Golden Idol for a fortune.",
  options: () => [
    option("Jump inside: lose 12.5% of max HP permanently (18% at A15+), then heal to full", (ctx) => {
      loseMaxHp(ctx, fractionMaxHp(ctx, a15(ctx) ? 0.18 : 0.125, "round"));
      healToFull(ctx); // Mark of the Bloom zeroes this
      endEvent(ctx);
    }),
    option(
      "Offer Golden Idol: lose the relic, gain 333 gold",
      (ctx) => {
        removeRelic(ctx, "GOLDEN_IDOL");
        gainGold(ctx, 333);
        endEvent(ctx);
      },
      (ctx) => hasRelic(ctx.run, "GOLDEN_IDOL"),
    ),
    leaveOption(),
  ],
});

// --- Mysterious Sphere --------------------------------------------------------------------

const SPHERE_MONSTERS = ["ORB_WALKER", "ORB_WALKER"];

const mysteriousSphere: EventDef = {
  id: "MYSTERIOUS_SPHERE",
  name: "Mysterious Sphere",
  pool: "act3",
  build: (ctx) => ({
    summary: "A guarded bone sphere hides a rare relic; cracking it wakes its sentries.",
    options: [
      combatOption(
        combatPendingLabel(ctx, "Open sphere: fight 2 Orb Walkers; victory yields a rare relic, 45-55 gold, and a card reward", SPHERE_MONSTERS),
        SPHERE_MONSTERS,
        // not an elite combat for relic triggers (corpus note)
        (c, svc) => svc.startCombat({ encounterId: "MYSTERIOUS_SPHERE_EVENT", monsters: SPHERE_MONSTERS, roomKind: "monster" }),
      ),
      leaveOption(),
    ],
  }),
  onCombatVictory: (ctx) => {
    const gold = ctx.rng("miscRng").randomRange(45, 55);
    openRewards(ctx, eventCombatRewards(ctx, { gold, relics: [screenlessRelicOfTier(ctx, "rare")], potionRoll: true, cardRoom: "monster" }));
  },
};

// --- Sensory Stone ----------------------------------------------------------------------------

function sensoryRecall(ctx: EffectCtx, hpCost: number, rewards: number): void {
  if (hpCost > 0) {
    loseHp(ctx, hpCost);
    if (ctx.run.hp <= 0) return;
  }
  const groups = [];
  for (let i = 0; i < rewards; i++) groups.push(createColorlessCardReward(ctx));
  openRewards(ctx, eventCombatRewards(ctx, { extraCardGroups: groups }));
}

const sensoryStone: EventDef = simpleEvent({
  id: "SENSORY_STONE",
  name: "Sensory Stone",
  pool: "act3",
  summary: "A memory-stone dispenses colorless card rewards; deeper recall costs HP.",
  options: () => [
    option("Recall 1: receive 1 colorless card reward", (ctx) => sensoryRecall(ctx, 0, 1)),
    option("Recall 2: lose 5 HP, receive 2 colorless card rewards", (ctx) => sensoryRecall(ctx, 5, 2)),
    option("Recall 3: lose 10 HP, receive 3 colorless card rewards", (ctx) => sensoryRecall(ctx, 10, 3)),
  ],
});

// --- Tomb of Lord Red Mask -----------------------------------------------------------------------

const tombOfLordRedMask: EventDef = simpleEvent({
  id: "TOMB_OF_LORD_RED_MASK",
  name: "Tomb of Lord Red Mask",
  pool: "act3",
  summary: "A tomb pays tribute to mask-wearers and sells its mask for everything you own.",
  options: () => [
    option(
      "Don the Red Mask: gain 222 gold",
      (ctx) => {
        gainGold(ctx, 222);
        endEvent(ctx);
      },
      (ctx) => hasRelic(ctx.run, "RED_MASK"),
    ),
    option(
      "Offer gold: lose ALL gold, obtain the Red Mask relic",
      (ctx) => {
        loseGold(ctx, ctx.run.gold);
        obtainRelic(ctx, "RED_MASK");
        endEvent(ctx);
      },
      (ctx) => !hasRelic(ctx.run, "RED_MASK"),
    ),
    leaveOption(),
  ],
});

// --- Winding Halls --------------------------------------------------------------------------------

const windingHalls: EventDef = simpleEvent({
  id: "WINDING_HALLS",
  name: "Winding Halls",
  pool: "act3",
  summary: "Lost in shifting halls, you choose between madness, a cursed rest, or backtracking at a max HP cost.",
  options: () => [
    option("Embrace madness: lose 12.5% of max HP (18% at A15+), obtain 2 Madness cards", (ctx) => {
      loseHp(ctx, fractionMaxHp(ctx, a15(ctx) ? 0.18 : 0.125, "round"));
      if (ctx.run.hp <= 0) return;
      obtainCard(ctx, "MADNESS");
      obtainCard(ctx, "MADNESS");
      endEvent(ctx);
    }),
    option("Press on: heal 25% of max HP (20% at A15+), obtain the Writhe curse", (ctx) => {
      healHp(ctx, fractionMaxHp(ctx, a15(ctx) ? 0.2 : 0.25, "round"));
      obtainCard(ctx, "WRITHE");
      endEvent(ctx);
    }),
    option("Retrace your steps: lose 5% of max HP permanently", (ctx) => {
      loseMaxHp(ctx, fractionMaxHp(ctx, 0.05, "round"));
      endEvent(ctx);
    }),
  ],
});

export const act3Events: EventDef[] = [
  falling,
  mindbloom,
  moaiHead,
  mysteriousSphere,
  sensoryStone,
  tombOfLordRedMask,
  windingHalls,
];
