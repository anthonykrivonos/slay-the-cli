// ActDef data for acts 1-3, transcribed from data/corpus/meta.json
// ("encounters" ids/weights/list rules, "eventPools" per-act tables).
// Strong-encounter weights are the corpus fraction NUMERATORS (denominator =
// their sum: 32 / 29 / 8); weak and elite picks are uniform.
//
// Encounter -> monster compositions are the base game's fixed lineups.
// TODO(randomized lineups): several encounters roll their composition at
// battle init in the real game (louse colors, small/large slime variants,
// gremlin gangs, Exordium thugs/wildlife, act-3 shapes). Fixed representative
// lineups are used until that roll lands with monster content.

import type { ActDef } from "../engine/content/defs";

const act1: ActDef = {
  act: 1,
  weakCount: 3,
  weakEncounters: [
    { id: "CULTIST", monsters: ["CULTIST"] },
    { id: "JAW_WORM", monsters: ["JAW_WORM"] },
    { id: "TWO_LOUSE", monsters: ["RED_LOUSE", "GREEN_LOUSE"] }, // TODO random louse colors
    { id: "SMALL_SLIMES", monsters: ["SPIKE_SLIME_S", "ACID_SLIME_M"] }, // TODO 50/50 variant
  ],
  strongEncounters: [
    { id: "GREMLIN_GANG", weight: 2, monsters: ["MAD_GREMLIN", "SNEAKY_GREMLIN", "FAT_GREMLIN", "SHIELD_GREMLIN"] }, // TODO random gremlins
    { id: "LOTS_OF_SLIMES", weight: 2, monsters: ["SPIKE_SLIME_S", "SPIKE_SLIME_S", "SPIKE_SLIME_S", "ACID_SLIME_S", "ACID_SLIME_S"] },
    { id: "RED_SLAVER", weight: 2, monsters: ["RED_SLAVER"] },
    { id: "EXORDIUM_THUGS", weight: 3, monsters: ["RED_LOUSE", "BLUE_SLAVER"] }, // TODO random pairing
    { id: "EXORDIUM_WILDLIFE", weight: 3, monsters: ["FUNGI_BEAST", "JAW_WORM"] }, // TODO random pairing
    { id: "BLUE_SLAVER", weight: 4, monsters: ["BLUE_SLAVER"] },
    { id: "LOOTER", weight: 4, monsters: ["LOOTER"] },
    { id: "LARGE_SLIME", weight: 4, monsters: ["ACID_SLIME_L"] }, // TODO 50/50 acid/spike
    { id: "THREE_LOUSE", weight: 4, monsters: ["RED_LOUSE", "GREEN_LOUSE", "RED_LOUSE"] }, // TODO random colors
    { id: "TWO_FUNGI_BEASTS", weight: 4, monsters: ["FUNGI_BEAST", "FUNGI_BEAST"] },
  ],
  elites: [
    { id: "GREMLIN_NOB", monsters: ["GREMLIN_NOB"] },
    { id: "LAGAVULIN", monsters: ["LAGAVULIN"] },
    { id: "THREE_SENTRIES", monsters: ["SENTRY", "SENTRY", "SENTRY"] },
  ],
  bosses: ["THE_GUARDIAN", "HEXAGHOST", "SLIME_BOSS"],
  events: [
    "BIG_FISH",
    "THE_CLERIC",
    "DEAD_ADVENTURER",
    "GOLDEN_IDOL",
    "WING_STATUE",
    "WORLD_OF_GOOP",
    "THE_SSSSSERPENT",
    "LIVING_WALL",
    "HYPNOTIZING_COLORED_MUSHROOMS",
    "SCRAP_OOZE",
    "SHINING_LIGHT",
  ],
  shrines: ["MATCH_AND_KEEP", "GOLDEN_SHRINE", "TRANSMORGRIFIER", "PURIFIER", "UPGRADE_SHRINE", "WHEEL_OF_CHANGE"],
};

const act2: ActDef = {
  act: 2,
  weakCount: 2,
  weakEncounters: [
    { id: "SPHERIC_GUARDIAN", monsters: ["SPHERIC_GUARDIAN"] },
    { id: "CHOSEN", monsters: ["CHOSEN"] },
    { id: "SHELL_PARASITE", monsters: ["SHELLED_PARASITE"] },
    { id: "THREE_BYRDS", monsters: ["BYRD", "BYRD", "BYRD"] },
    { id: "TWO_THIEVES", monsters: ["LOOTER", "MUGGER"] },
  ],
  strongEncounters: [
    { id: "CHOSEN_AND_BYRDS", weight: 2, monsters: ["BYRD", "CHOSEN"] },
    { id: "SENTRY_AND_SPHERE", weight: 2, monsters: ["SENTRY", "SPHERIC_GUARDIAN"] },
    { id: "CULTIST_AND_CHOSEN", weight: 3, monsters: ["CULTIST", "CHOSEN"] },
    { id: "THREE_CULTIST", weight: 3, monsters: ["CULTIST", "CULTIST", "CULTIST"] },
    { id: "SHELLED_PARASITE_AND_FUNGI", weight: 3, monsters: ["SHELLED_PARASITE", "FUNGI_BEAST"] },
    { id: "SNECKO", weight: 4, monsters: ["SNECKO"] },
    { id: "SNAKE_PLANT", weight: 6, monsters: ["SNAKE_PLANT"] },
    { id: "CENTURION_AND_HEALER", weight: 6, monsters: ["CENTURION", "MYSTIC"] },
  ],
  elites: [
    { id: "GREMLIN_LEADER", monsters: ["MAD_GREMLIN", "SNEAKY_GREMLIN", "GREMLIN_LEADER"] }, // TODO random minions
    { id: "SLAVERS", monsters: ["BLUE_SLAVER", "TASKMASTER", "RED_SLAVER"] },
    { id: "BOOK_OF_STABBING", monsters: ["BOOK_OF_STABBING"] },
  ],
  bosses: ["AUTOMATON", "COLLECTOR", "CHAMP"], // encounter enum names (meta parity)
  bossEncounters: [
    { id: "AUTOMATON", monsters: ["BRONZE_AUTOMATON"] },
    { id: "COLLECTOR", monsters: ["THE_COLLECTOR"] },
    { id: "CHAMP", monsters: ["THE_CHAMP"] },
  ],
  events: [
    "PLEADING_VAGRANT",
    "ANCIENT_WRITING",
    "OLD_BEGGAR",
    "COLOSSEUM",
    "CURSED_TOME",
    "AUGMENTER",
    "FORGOTTEN_ALTAR",
    "GHOSTS",
    "MASKED_BANDITS",
    "THE_NEST",
    "THE_LIBRARY",
    "THE_MAUSOLEUM",
    "VAMPIRES",
  ],
  shrines: ["MATCH_AND_KEEP", "WHEEL_OF_CHANGE", "GOLDEN_SHRINE", "TRANSMORGRIFIER", "PURIFIER", "UPGRADE_SHRINE"],
};

const act3: ActDef = {
  act: 3,
  weakCount: 2,
  weakEncounters: [
    { id: "THREE_DARKLINGS", monsters: ["DARKLING", "DARKLING", "DARKLING"] },
    { id: "ORB_WALKER", monsters: ["ORB_WALKER"] },
    { id: "THREE_SHAPES", monsters: ["REPULSOR", "SPIKER", "EXPLODER"] }, // TODO random shapes
  ],
  strongEncounters: [
    { id: "SPIRE_GROWTH", weight: 1, monsters: ["SPIRE_GROWTH"] },
    { id: "TRANSIENT", weight: 1, monsters: ["TRANSIENT"] },
    { id: "FOUR_SHAPES", weight: 1, monsters: ["REPULSOR", "SPIKER", "EXPLODER", "REPULSOR"] }, // TODO random shapes
    { id: "MAW", weight: 1, monsters: ["THE_MAW"] },
    { id: "SPHERE_AND_TWO_SHAPES", weight: 1, monsters: ["SPHERIC_GUARDIAN", "REPULSOR", "SPIKER"] }, // TODO random shapes
    { id: "JAW_WORM_HORDE", weight: 1, monsters: ["JAW_WORM", "JAW_WORM", "JAW_WORM"] },
    { id: "THREE_DARKLINGS", weight: 1, monsters: ["DARKLING", "DARKLING", "DARKLING"] },
    { id: "WRITHING_MASS", weight: 1, monsters: ["WRITHING_MASS"] },
  ],
  elites: [
    { id: "GIANT_HEAD", monsters: ["GIANT_HEAD"] },
    { id: "NEMESIS", monsters: ["NEMESIS"] },
    { id: "REPTOMANCER", monsters: ["DAGGER", "REPTOMANCER", "DAGGER"] },
  ],
  bosses: ["AWAKENED_ONE", "TIME_EATER", "DONU_AND_DECA"],
  bossEncounters: [
    { id: "AWAKENED_ONE", monsters: ["CULTIST", "CULTIST", "AWAKENED_ONE"] },
    { id: "DONU_AND_DECA", monsters: ["DECA", "DONU"] },
  ],
  events: [
    "FALLING",
    "MINDBLOOM",
    "THE_MOAI_HEAD",
    "MYSTERIOUS_SPHERE",
    "SENSORY_STONE",
    "TOMB_OF_LORD_RED_MASK",
    "WINDING_HALLS",
  ],
  shrines: ["MATCH_AND_KEEP", "WHEEL_OF_CHANGE", "GOLDEN_SHRINE", "TRANSMORGRIFIER", "PURIFIER", "UPGRADE_SHRINE"],
};

// TODO act 4 (fixed SHIELD_AND_SPEAR elite + THE_HEART boss) lands with the key gate.

export const actDefs: ActDef[] = [act1, act2, act3];
