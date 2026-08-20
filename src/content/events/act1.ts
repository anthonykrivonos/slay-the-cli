// Act 1 event pool (11 events) — data/corpus/events.json is the spec; all
// labels/summaries are our own terse functional text.

import type { EventDef, EffectCtx } from "../../engine/content/defs";
import { JavaRandom, javaShuffle } from "../../engine/core/rng";
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
  healHp,
  leaveOption,
  loseGold,
  loseMaxHp,
  obtainCard,
  obtainRelic,
  openRewards,
  option,
  peekData,
  removableIndices,
  removeDeckCards,
  requestDeckChoice,
  screenOf,
  screenlessRandomRelic,
  setScreen,
  simpleEvent,
  transformDeckCard,
  upgradeableIndices,
  upgradeDeckCard,
} from "./lib";

// --- Big Fish -------------------------------------------------------------------------

const bigFish: EventDef = simpleEvent({
  id: "BIG_FISH",
  name: "Big Fish",
  pool: "act1",
  summary: "Three dangling baits offer a heal, max HP, or a cursed relic box; one must be picked.",
  options: () => [
    option("Banana: heal 1/3 of max HP", (ctx) => {
      healHp(ctx, fractionMaxHp(ctx, 0.3333, "floor"));
      endEvent(ctx);
    }),
    option("Donut: gain 5 max HP", (ctx) => {
      gainMaxHp(ctx, 5);
      endEvent(ctx);
    }),
    option("Box: obtain a random relic and the Regret curse", (ctx) => {
      obtainRelic(ctx, screenlessRandomRelic(ctx));
      obtainCard(ctx, "REGRET");
      endEvent(ctx);
    }),
  ],
});

// --- The Cleric -----------------------------------------------------------------------

const clericPurifyCost = (ctx: EffectCtx): number => (a15(ctx) ? 75 : 50);

const theCleric: EventDef = simpleEvent({
  id: "THE_CLERIC",
  name: "The Cleric",
  pool: "act1",
  canSpawn: (run) => run.gold >= 35,
  summary: "A friendly cleric sells healing or a card removal.",
  options: (b) => [
    option(
      "Heal: pay 35 gold, heal 25% of max HP",
      (ctx) => {
        loseGold(ctx, 35);
        healHp(ctx, fractionMaxHp(ctx, 0.25, "floor"));
        endEvent(ctx);
      },
      (ctx) => ctx.run.gold >= 35,
    ),
    option(
      `Purify: pay ${clericPurifyCost(b)} gold, remove a card`,
      (ctx) => {
        loseGold(ctx, clericPurifyCost(ctx));
        requestDeckChoice(ctx, { tag: "purify", indices: removableIndices(ctx), min: 1, max: 1, reason: "event:cleric" });
      },
      (ctx) => ctx.run.gold >= clericPurifyCost(ctx) && removableIndices(ctx).length > 0,
    ),
    leaveOption(),
  ],
  onResume: (ctx, tag, chosen) => {
    if (tag === "purify") removeDeckCards(ctx, chosen);
    endEvent(ctx);
  },
});

// --- Dead Adventurer --------------------------------------------------------------------

const DEAD_ADVENTURER_ENCOUNTERS: Record<string, { monsters: string[]; suppressPreBattle?: boolean }> = {
  THREE_SENTRIES: { monsters: ["SENTRY", "SENTRY", "SENTRY"] },
  GREMLIN_NOB: { monsters: ["GREMLIN_NOB"] },
  LAGAVULIN_EVENT: { monsters: ["LAGAVULIN"], suppressPreBattle: true }, // starts awake
};

interface DeadAdventurerData {
  rewards: ("GOLD" | "NOTHING" | "RELIC")[];
  encounter: string;
  phase: number;
}

const deadAdventurerData = (d: unknown): DeadAdventurerData => d as DeadAdventurerData;

const deadAdventurer: EventDef = {
  id: "DEAD_ADVENTURER",
  name: "Dead Adventurer",
  pool: "act1",
  canSpawn: (run) => run.floor >= 7,
  onEnter: (ctx) => {
    const misc = ctx.rng("miscRng");
    const rewards: DeadAdventurerData["rewards"] = ["GOLD", "NOTHING", "RELIC"];
    javaShuffle(rewards, new JavaRandom(misc.randomLong()));
    const encounter = (["THREE_SENTRIES", "GREMLIN_NOB", "LAGAVULIN_EVENT"] as const)[misc.random(2)]!;
    Object.assign(dataOf(ctx), { rewards, encounter, phase: 0 } satisfies DeadAdventurerData);
  },
  build: (ctx) => {
    const d = deadAdventurerData(peekData(ctx));
    const enc = DEAD_ADVENTURER_ENCOUNTERS[d.encounter] ?? DEAD_ADVENTURER_ENCOUNTERS["THREE_SENTRIES"]!;
    return {
      summary: "Looting a fallen adventurer up to three times risks the returning elite that killed them.",
      options: [
        combatOption(
          combatPendingLabel(
            ctx,
            "Search: roll for an elite ambush, else claim the next shuffled reward (30 gold / relic / nothing)",
            enc.monsters,
          ),
          enc.monsters,
          (ctx2, svc) => {
            const dd = deadAdventurerData(dataOf(ctx2));
            const base = a15(ctx2) ? 35 : 25;
            const chance = base + 25 * dd.phase;
            if (ctx2.rng("miscRng").random(99) < chance) {
              svc.startCombat({
                encounterId: dd.encounter,
                monsters: DEAD_ADVENTURER_ENCOUNTERS[dd.encounter]!.monsters,
                roomKind: "elite",
                suppressPreBattle: DEAD_ADVENTURER_ENCOUNTERS[dd.encounter]!.suppressPreBattle,
              });
              return;
            }
            const reward = dd.rewards[dd.phase]!;
            dd.phase++;
            if (reward === "GOLD") gainGold(ctx2, 30);
            else if (reward === "RELIC") obtainRelic(ctx2, screenlessRandomRelic(ctx2));
          },
          (ctx2) => deadAdventurerData(dataOf(ctx2)).phase < 3,
        ),
        leaveOption("Leave: no effect (available before each search)"),
      ],
    };
  },
  onCombatVictory: (ctx, _encounterId, data) => {
    const d = deadAdventurerData(data);
    const remaining = d.rewards.slice(d.phase);
    const gold = ctx.rng("miscRng").randomRange(25, 35) + 30 * remaining.filter((r) => r === "GOLD").length;
    const relics = remaining.includes("RELIC") ? [screenlessRandomRelic(ctx)] : [];
    openRewards(ctx, eventCombatRewards(ctx, { gold, relics, potionRoll: true, cardRoom: "elite" }));
  },
};

// --- Golden Idol ---------------------------------------------------------------------------

const goldenIdol: EventDef = {
  id: "GOLDEN_IDOL",
  name: "Golden Idol",
  pool: "act1",
  build: (ctx) => {
    const trap = screenOf(ctx) === "trap";
    return {
      summary: "A golden idol sits on a pedestal; taking it triggers a trap that must be answered.",
      options: [
        option(
          "Take: obtain Golden Idol relic, then choose one trap outcome",
          (c) => {
            obtainRelic(c, "GOLDEN_IDOL");
            setScreen(c, "trap");
          },
          () => !trap,
        ),
        option("Leave: no effect", (c) => endEvent(c), () => !trap),
        option(
          "Trap - Outrun: obtain the Injury curse",
          (c) => {
            obtainCard(c, "INJURY");
            endEvent(c);
          },
          () => trap,
        ),
        option(
          "Trap - Smash: take damage equal to 25% of max HP (35% at A15+)",
          (c) => {
            damagePlayer(c, fractionMaxHp(c, a15(c) ? 0.35 : 0.25, "floor"));
            endEvent(c);
          },
          () => trap,
        ),
        option(
          "Trap - Hide: lose 8% of max HP permanently (10% at A15+)",
          (c) => {
            loseMaxHp(c, fractionMaxHp(c, a15(c) ? 0.1 : 0.08, "floor"));
            endEvent(c);
          },
          () => trap,
        ),
      ],
    };
  },
};

// --- Wing Statue -----------------------------------------------------------------------------

function deckHasBigSingleHit(ctx: EffectCtx, threshold: number): boolean {
  return ctx.run.deck.some((mc) => {
    const def = ctx.bundle.cards.get(mc.defId);
    if (!def || def.type !== "attack") return false;
    const dmg = mc.upgrades > 0 ? (def.upgradeValues.damage ?? def.values.damage) : def.values.damage;
    return dmg !== undefined && dmg >= threshold;
  });
}

const wingStatue: EventDef = simpleEvent({
  id: "WING_STATUE",
  name: "Wing Statue",
  pool: "act1",
  summary: "A winged statue trades pain for a card removal, or can be smashed for gold.",
  options: () => [
    option(
      "Pray: take 7 damage, remove a card",
      (ctx) => {
        damagePlayer(ctx, 7);
        if (ctx.run.hp <= 0) return;
        requestDeckChoice(ctx, { tag: "pray", indices: removableIndices(ctx), min: 1, max: 1, reason: "event:wingStatue" });
      },
      (ctx) => removableIndices(ctx).length > 0,
    ),
    option(
      "Destroy: gain 50-80 gold (needs an attack dealing 10+ damage in one hit)",
      (ctx) => {
        gainGold(ctx, ctx.rng("miscRng").randomRange(50, 80));
        endEvent(ctx);
      },
      (ctx) => deckHasBigSingleHit(ctx, 10),
    ),
    leaveOption(),
  ],
  onResume: (ctx, _tag, chosen) => {
    removeDeckCards(ctx, chosen);
    endEvent(ctx);
  },
});

// --- World of Goop ------------------------------------------------------------------------------

const worldOfGoop: EventDef = simpleEvent({
  id: "WORLD_OF_GOOP",
  name: "World of Goop",
  pool: "act1",
  onEnter: (ctx) => {
    dataOf(ctx).loss = a15(ctx) ? ctx.rng("miscRng").randomRange(35, 75) : ctx.rng("miscRng").randomRange(20, 50);
  },
  summary: "Gold has spilled into burning slime; wade in for it or abandon some of your own gold.",
  options: () => [
    option("Gather gold: take 11 damage, gain 75 gold", (ctx) => {
      damagePlayer(ctx, 11);
      gainGold(ctx, 75);
      endEvent(ctx);
    }),
    option("Leave it: lose 20-50 gold (35-75 at A15+; capped at current gold)", (ctx) => {
      loseGold(ctx, Math.min(ctx.run.gold, dataOf(ctx).loss as number));
      endEvent(ctx);
    }),
  ],
});

// --- The Ssssserpent ------------------------------------------------------------------------------

const ssssserpent: EventDef = simpleEvent({
  id: "THE_SSSSSERPENT",
  name: "The Ssssserpent",
  pool: "act1",
  summary: "A serpent offers gold for agreeing with its worldview; agreement is cursed.",
  options: () => [
    option("Agree: gain 175 gold (150 at A15+), obtain the Doubt curse", (ctx) => {
      gainGold(ctx, a15(ctx) ? 150 : 175);
      obtainCard(ctx, "DOUBT");
      endEvent(ctx);
    }),
    option("Disagree: no effect", (ctx) => endEvent(ctx)),
  ],
});

// --- Living Wall ------------------------------------------------------------------------------------

const livingWall: EventDef = simpleEvent({
  id: "LIVING_WALL",
  name: "Living Wall",
  pool: "act1",
  summary: "Trapping walls demand one deck alteration before letting you pass.",
  options: () => [
    option(
      "Forget: remove a card",
      (ctx) => requestDeckChoice(ctx, { tag: "remove", indices: removableIndices(ctx), min: 1, max: 1, reason: "event:livingWall" }),
      (ctx) => removableIndices(ctx).length > 0,
    ),
    option(
      "Change: transform a card",
      (ctx) => requestDeckChoice(ctx, { tag: "transform", indices: removableIndices(ctx), min: 1, max: 1, reason: "event:livingWall" }),
      (ctx) => removableIndices(ctx).length > 0,
    ),
    option(
      "Grow: upgrade a card",
      (ctx) => requestDeckChoice(ctx, { tag: "upgrade", indices: upgradeableIndices(ctx), min: 1, max: 1, reason: "event:livingWall" }),
      (ctx) => upgradeableIndices(ctx).length > 0,
    ),
  ],
  onResume: (ctx, tag, chosen) => {
    const idx = chosen[0];
    if (idx !== undefined) {
      if (tag === "remove") removeDeckCards(ctx, [idx]);
      else if (tag === "transform") transformDeckCard(ctx, idx);
      else upgradeDeckCard(ctx, idx);
    }
    endEvent(ctx);
  },
});

// --- Hypnotizing Colored Mushrooms --------------------------------------------------------------------

const MUSHROOM_MONSTERS = ["FUNGI_BEAST", "FUNGI_BEAST", "FUNGI_BEAST"];

const mushrooms: EventDef = {
  id: "HYPNOTIZING_COLORED_MUSHROOMS",
  name: "Hypnotizing Colored Mushrooms",
  pool: "act1",
  canSpawn: (run) => run.floor >= 7,
  build: (ctx) => ({
    summary: "A mushroom-filled corridor compels you to fight the fungus or eat it.",
    options: [
      combatOption(
        combatPendingLabel(ctx, "Stomp: fight 3 Fungi Beasts; victory adds Odd Mushroom and 20-30 gold", MUSHROOM_MONSTERS),
        MUSHROOM_MONSTERS,
        (c, svc) => svc.startCombat({ encounterId: "MUSHROOMS_EVENT", monsters: MUSHROOM_MONSTERS, roomKind: "monster" }),
      ),
      option("Eat: heal 25% of max HP, obtain the Parasite curse", (c) => {
        healHp(c, fractionMaxHp(c, 0.25, "floor"));
        obtainCard(c, "PARASITE");
        endEvent(c);
      }),
    ],
  }),
  onCombatVictory: (ctx) => {
    const gold = ctx.rng("miscRng").randomRange(20, 30);
    openRewards(ctx, eventCombatRewards(ctx, { gold, relics: ["ODD_MUSHROOM"], potionRoll: true, cardRoom: "monster" }));
  },
};

// --- Scrap Ooze -------------------------------------------------------------------------------------------

const scrapOoze: EventDef = {
  id: "SCRAP_OOZE",
  name: "Scrap Ooze",
  pool: "act1",
  onEnter: (ctx) => {
    dataOf(ctx).attempts = 0;
  },
  build: (ctx) => ({
    summary: "Reaching into a scrap-filled ooze costs HP per attempt with a rising chance to pull out a relic.",
    options: [
      option(
        `Reach inside: take ${a15(ctx) ? 5 : 3} damage; relic chance starts at 25% and rises 10% per attempt`,
        (c) => {
          damagePlayer(c, a15(c) ? 5 : 3);
          if (c.run.hp <= 0) return;
          const d = dataOf(c);
          const attempts = (d.attempts as number) ?? 0;
          const chance = 25 + 10 * attempts;
          // lightspeed: success when random(99) >= 99 - chance
          if (c.rng("miscRng").random(99) >= 99 - chance) {
            obtainRelic(c, screenlessRandomRelic(c));
            endEvent(c);
          } else {
            d.attempts = attempts + 1;
          }
        },
      ),
      leaveOption(),
    ],
  }),
};

// --- Shining Light -----------------------------------------------------------------------------------------

const shiningLight: EventDef = simpleEvent({
  id: "SHINING_LIGHT",
  name: "Shining Light",
  pool: "act1",
  summary: "A glowing light upgrades random cards in exchange for a chunk of HP.",
  options: () => [
    option("Enter: take 20% of max HP as damage (30% at A15+); upgrade 2 random upgradeable cards", (ctx) => {
      damagePlayer(ctx, fractionMaxHp(ctx, a15(ctx) ? 0.3 : 0.2, "round"));
      const idxs = upgradeableIndices(ctx);
      javaShuffle(idxs, new JavaRandom(ctx.rng("miscRng").randomLong()));
      for (const i of idxs.slice(0, 2)) upgradeDeckCard(ctx, i);
      endEvent(ctx);
    }),
    leaveOption(),
  ],
});

export const act1Events: EventDef[] = [
  bigFish,
  theCleric,
  deadAdventurer,
  goldenIdol,
  wingStatue,
  worldOfGoop,
  ssssserpent,
  livingWall,
  mushrooms,
  scrapOoze,
  shiningLight,
];
