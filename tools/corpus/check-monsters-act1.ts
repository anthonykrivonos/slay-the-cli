// Cross-checks data/corpus/monsters-act1.json (hand-transcribed from
// sts_lightspeed C++) against references/spire-archive/data/sts1/monsters.json.
//
// Compares: HP ranges (base + ascension), per-move base damage, ascension
// damage, hit counts, and block values. Every numeric mismatch is reported as
// an ERROR unless it corresponds to a conflict documented in the corpus entry
// itself (in which case it is reported as a documented CONFLICT). Intent
// mismatches and archive coverage gaps are reported as informational NOTEs.
//
// Run: bun tools/corpus/check-monsters-act1.ts

import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");

type ArchiveMove = {
  id: string;
  name: string;
  damage: number | null;
  damage_ascension: number | null;
  intent: string;
  hits: number | null;
  block: number | null;
};
type ArchiveMonster = {
  id: string;
  name: string;
  type: string;
  act: string;
  min_hp: number;
  max_hp: number;
  min_hp_ascension: number;
  max_hp_ascension: number;
  moves: ArchiveMove[];
};

type CorpusEffect = { power: string; amount: number | null; target: string };
type CorpusMove = {
  intent: string;
  damage: number | [number, number] | null;
  hits: number | null;
  block: number | null;
  effects?: CorpusEffect[];
  asc?: Record<string, Partial<CorpusMove>>;
};
type CorpusEntity = {
  id: string;
  name: string;
  category: string;
  acts: number[];
  hp: { base: [number, number]; asc: [number, number]; ascLevel: number };
  moves: Record<string, CorpusMove>;
  conflicts: { field: string; [k: string]: unknown }[];
};

const corpus: CorpusEntity[] = await Bun.file(join(root, "data/corpus/monsters-act1.json")).json();
const archive: ArchiveMonster[] = await Bun.file(
  join(root, "references/spire-archive/data/sts1/monsters.json"),
).json();

// corpus entity id -> spire-archive entity id
const ARCHIVE_ID: Record<string, string> = {
  CULTIST: "CULTIST",
  JAW_WORM: "JAWWORM",
  RED_LOUSE: "FUZZYLOUSENORMAL",
  GREEN_LOUSE: "FUZZYLOUSEDEFENSIVE",
  ACID_SLIME_S: "ACIDSLIME_S",
  ACID_SLIME_M: "ACIDSLIME_M",
  ACID_SLIME_L: "ACIDSLIME_L",
  SPIKE_SLIME_S: "SPIKESLIME_S",
  SPIKE_SLIME_M: "SPIKESLIME_M",
  SPIKE_SLIME_L: "SPIKESLIME_L",
  MAD_GREMLIN: "GREMLINWARRIOR",
  SNEAKY_GREMLIN: "GREMLINTHIEF",
  FAT_GREMLIN: "GREMLINFAT",
  SHIELD_GREMLIN: "GREMLINTSUNDERE",
  GREMLIN_WIZARD: "GREMLINWIZARD",
  LOOTER: "LOOTER",
  FUNGI_BEAST: "FUNGIBEAST",
  BLUE_SLAVER: "SLAVERBLUE",
  RED_SLAVER: "SLAVERRED",
  GREMLIN_NOB: "GREMLINNOB",
  LAGAVULIN: "LAGAVULIN",
  SENTRY: "SENTRY",
  SLIME_BOSS: "SLIMEBOSS",
  THE_GUARDIAN: "THEGUARDIAN",
  HEXAGHOST: "HEXAGHOST",
};

// corpus move enum -> spire-archive move id, per entity
const MOVE_MAP: Record<string, Record<string, string>> = {
  CULTIST: { CULTIST_DARK_STRIKE: "DARK_STRIKE", CULTIST_INCANTATION: "INCANTATION" },
  JAW_WORM: { JAW_WORM_CHOMP: "CHOMP", JAW_WORM_BELLOW: "BELLOW", JAW_WORM_THRASH: "THRASH" },
  RED_LOUSE: { RED_LOUSE_BITE: "BITE", RED_LOUSE_GROW: "STRENGTHEN" },
  GREEN_LOUSE: { GREEN_LOUSE_BITE: "BITE", GREEN_LOUSE_SPIT_WEB: "WEAKEN" },
  ACID_SLIME_S: { ACID_SLIME_S_TACKLE: "TACKLE", ACID_SLIME_S_LICK: "DEBUFF" },
  ACID_SLIME_M: {
    ACID_SLIME_M_CORROSIVE_SPIT: "WOUND_TACKLE",
    ACID_SLIME_M_TACKLE: "NORMAL_TACKLE",
    ACID_SLIME_M_LICK: "WEAK_LICK",
  },
  ACID_SLIME_L: {
    ACID_SLIME_L_CORROSIVE_SPIT: "SLIME_TACKLE",
    ACID_SLIME_L_TACKLE: "NORMAL_TACKLE",
    ACID_SLIME_L_LICK: "WEAK_LICK",
    ACID_SLIME_L_SPLIT: "SPLIT",
  },
  SPIKE_SLIME_S: { SPIKE_SLIME_S_TACKLE: "TACKLE" },
  SPIKE_SLIME_M: { SPIKE_SLIME_M_FLAME_TACKLE: "FLAME_TACKLE", SPIKE_SLIME_M_LICK: "FRAIL_LICK" },
  SPIKE_SLIME_L: {
    SPIKE_SLIME_L_FLAME_TACKLE: "FLAME_TACKLE",
    SPIKE_SLIME_L_LICK: "FRAIL_LICK",
    SPIKE_SLIME_L_SPLIT: "SPLIT",
  },
  MAD_GREMLIN: { MAD_GREMLIN_SCRATCH: "SCRATCH" },
  SNEAKY_GREMLIN: { SNEAKY_GREMLIN_PUNCTURE: "PUNCTURE" },
  FAT_GREMLIN: { FAT_GREMLIN_SMASH: "BLUNT" },
  SHIELD_GREMLIN: { SHIELD_GREMLIN_PROTECT: "PROTECT", SHIELD_GREMLIN_SHIELD_BASH: "BASH" },
  GREMLIN_WIZARD: { GREMLIN_WIZARD_ULTIMATE_BLAST: "DOPE_MAGIC", GREMLIN_WIZARD_CHARGING: "CHARGE" },
  LOOTER: { LOOTER_MUG: "MUG", LOOTER_SMOKE_BOMB: "SMOKE_BOMB" }, // LUNGE + ESCAPE absent from archive (documented)
  FUNGI_BEAST: { FUNGI_BEAST_BITE: "BITE", FUNGI_BEAST_GROW: "GROW" },
  BLUE_SLAVER: { BLUE_SLAVER_STAB: "STAB", BLUE_SLAVER_RAKE: "RAKE" },
  RED_SLAVER: { RED_SLAVER_STAB: "STAB", RED_SLAVER_SCRAPE: "SCRAPE", RED_SLAVER_ENTANGLE: "ENTANGLE" },
  GREMLIN_NOB: {
    GREMLIN_NOB_RUSH: "BULL_RUSH",
    GREMLIN_NOB_SKULL_BASH: "SKULL_BASH",
    GREMLIN_NOB_BELLOW: "BELLOW",
  },
  LAGAVULIN: {
    LAGAVULIN_ATTACK: "STRONG_ATK",
    LAGAVULIN_SIPHON_SOUL: "DEBUFF",
    LAGAVULIN_SLEEP: "IDLE",
  }, // archive OPEN (stun) has no lightspeed move (documented: folded into SLEEP)
  SENTRY: { SENTRY_BEAM: "BEAM", SENTRY_BOLT: "BOLT" },
  SLIME_BOSS: {
    SLIME_BOSS_SLAM: "SLAM",
    SLIME_BOSS_PREPARING: "PREP_SLAM",
    SLIME_BOSS_SPLIT: "SPLIT",
    SLIME_BOSS_GOOP_SPRAY: "STICKY",
  },
  THE_GUARDIAN: {
    THE_GUARDIAN_CHARGING_UP: "CHARGE_UP",
    THE_GUARDIAN_FIERCE_BASH: "FIERCE_BASH",
    THE_GUARDIAN_VENT_STEAM: "VENT_STEAM",
    THE_GUARDIAN_WHIRLWIND: "WHIRLWIND",
    THE_GUARDIAN_DEFENSIVE_MODE: "CLOSE_UP",
    THE_GUARDIAN_ROLL_ATTACK: "ROLL_ATTACK",
    THE_GUARDIAN_TWIN_SLAM: "TWIN_SLAM",
  },
  HEXAGHOST: {
    HEXAGHOST_ACTIVATE: "ACTIVATE",
    HEXAGHOST_DIVIDER: "DIVIDER",
    HEXAGHOST_SEAR: "SEAR",
    HEXAGHOST_TACKLE: "TACKLE",
    HEXAGHOST_INFLAME: "INFLAME",
    HEXAGHOST_INFERNO: "INFERNO",
  },
};

// Archive moves knowingly absent from the corpus (vestigial / not modeled by
// lightspeed), so their non-coverage is a NOTE rather than an ERROR.
const KNOWN_UNMAPPED_ARCHIVE_MOVES: Record<string, Record<string, string>> = {
  MAD_GREMLIN: { MOVE_99: "escape move: unreachable (Gremlin Leader death ends combat)" },
  SNEAKY_GREMLIN: { MOVE_99: "escape move: unreachable" },
  FAT_GREMLIN: { MOVE_99: "escape move: unreachable" },
  SHIELD_GREMLIN: { MOVE_99: "escape move: unreachable" },
  GREMLIN_WIZARD: { MOVE_99: "escape move: unreachable" },
  LAGAVULIN: { OPEN: "stunned intent: lightspeed folds the stun turn into the pending SLEEP move" },
};

const errors: string[] = [];
const conflicts: string[] = [];
const notes: string[] = [];
let checks = 0;

function cmp(entity: string, what: string, mine: number | null, theirs: number | null, documented: string | null) {
  checks++;
  const same = (mine === null && theirs === null) || mine === theirs;
  if (same) return;
  const msg = `${entity} ${what}: corpus=${mine} spire-archive=${theirs}`;
  if (documented) {
    conflicts.push(`${msg}  [documented: ${documented}]`);
  } else {
    errors.push(msg);
  }
}

// Returns the documented-conflict field string if the entity documents a
// conflict whose "field" mentions the given move/aspect, else null.
function documentedConflict(entity: CorpusEntity, needle: string): string | null {
  const hit = entity.conflicts.find((c) => c.field.toLowerCase().includes(needle.toLowerCase()));
  return hit ? hit.field : null;
}

for (const entity of corpus) {
  const archId = ARCHIVE_ID[entity.id];
  if (!archId) {
    errors.push(`${entity.id}: no archive id mapping`);
    continue;
  }
  const arch = archive.find((a) => a.id === archId);
  if (!arch) {
    errors.push(`${entity.id}: archive entity ${archId} not found`);
    continue;
  }

  // act assignment (all of these debut in the Exordium)
  checks++;
  if (arch.act !== "exordium") errors.push(`${entity.id}: archive act is ${arch.act}, expected exordium`);
  checks++;
  if (!entity.acts.includes(1)) errors.push(`${entity.id}: corpus acts ${entity.acts} missing act 1`);

  // HP
  cmp(entity.id, "hp.base.min", entity.hp.base[0], arch.min_hp, null);
  cmp(entity.id, "hp.base.max", entity.hp.base[1], arch.max_hp, null);
  cmp(entity.id, "hp.asc.min", entity.hp.asc[0], arch.min_hp_ascension, null);
  cmp(entity.id, "hp.asc.max", entity.hp.asc[1], arch.max_hp_ascension, null);

  const moveMap = MOVE_MAP[entity.id] ?? {};
  const mappedArchIds = new Set(Object.values(moveMap));

  for (const [moveId, move] of Object.entries(entity.moves)) {
    const archMoveId = moveMap[moveId];
    if (!archMoveId) {
      const known = entity.id === "LOOTER" && (moveId === "LOOTER_LUNGE" || moveId === "LOOTER_ESCAPE");
      if (known) {
        notes.push(`${entity.id}.${moveId}: absent from spire-archive (documented in corpus conflicts)`);
      } else {
        errors.push(`${entity.id}.${moveId}: no archive move mapping`);
      }
      continue;
    }
    const archMove = arch.moves.find((m) => m.id === archMoveId);
    if (!archMove) {
      errors.push(`${entity.id}.${moveId}: archive move ${archMoveId} not found`);
      continue;
    }

    // base damage
    checks++;
    const dynamicArchive = archMove.damage === null || archMove.damage === -1;
    if (typeof move.damage === "number") {
      if (dynamicArchive) {
        notes.push(`${entity.id}.${moveId}: archive has no base damage (corpus=${move.damage}) - skipped`);
      } else if (move.damage !== archMove.damage) {
        const doc = documentedConflict(entity, moveId);
        (doc ? conflicts : errors).push(
          `${entity.id}.${moveId} damage: corpus=${move.damage} spire-archive=${archMove.damage}${doc ? `  [documented: ${doc}]` : ""}`,
        );
      }
    } else if (Array.isArray(move.damage) || move.damage === null) {
      if (!dynamicArchive) {
        errors.push(
          `${entity.id}.${moveId} damage: corpus is dynamic/range (${JSON.stringify(move.damage)}) but archive has ${archMove.damage}`,
        );
      } else if (move.damage !== null || archMove.damage === -1) {
        // only worth a note when either side actually carries dynamic data
        notes.push(
          `${entity.id}.${moveId}: dynamic/ranged damage (corpus=${JSON.stringify(move.damage)}, archive=${archMove.damage}) - skipped`,
        );
      }
    }

    // ascension damage (corpus overrides live at asc 2 (normal), 3 (elite) or 4 (boss))
    checks++;
    let myAscDamage: number | null = null;
    for (const lvl of ["2", "3", "4"]) {
      const o = move.asc?.[lvl];
      if (o && typeof o.damage === "number") myAscDamage = o.damage;
    }
    if (archMove.damage_ascension !== null && archMove.damage_ascension !== -1) {
      if (myAscDamage === null) {
        errors.push(
          `${entity.id}.${moveId} damage_ascension: archive=${archMove.damage_ascension} but corpus has no asc-2/3/4 damage override`,
        );
      } else if (myAscDamage !== archMove.damage_ascension) {
        errors.push(
          `${entity.id}.${moveId} damage_ascension: corpus=${myAscDamage} spire-archive=${archMove.damage_ascension}`,
        );
      }
    } else if (myAscDamage !== null) {
      notes.push(
        `${entity.id}.${moveId}: corpus asc damage ${myAscDamage} not present in archive - skipped`,
      );
    }

    // hits (only meaningful for attacks; archive defaults hits to 1 for everything)
    if (typeof move.damage === "number" || move.hits !== null) {
      cmp(entity.id, `${moveId} hits`, move.hits ?? 1, archMove.hits ?? 1, null);
    }

    // block
    cmp(entity.id, `${moveId} block`, move.block ?? null, archMove.block ?? null, null);

    // intent (informational only - archive intents are known to be lossy)
    if (move.intent !== archMove.intent) {
      notes.push(`${entity.id}.${moveId} intent: corpus=${move.intent} spire-archive=${archMove.intent}`);
    }
  }

  // archive moves not covered by the corpus mapping
  for (const am of arch.moves) {
    if (mappedArchIds.has(am.id)) continue;
    const known = KNOWN_UNMAPPED_ARCHIVE_MOVES[entity.id]?.[am.id];
    if (known) {
      notes.push(`${entity.id}: archive move ${am.id} intentionally unmapped - ${known}`);
    } else if (entity.id === "LOOTER") {
      // handled above from the corpus side
    } else {
      errors.push(`${entity.id}: archive move ${am.id} (${am.name}) not covered by corpus`);
    }
  }
}

// entities in the archive act-1 set that the corpus should cover
const covered = new Set(Object.values(ARCHIVE_ID));
for (const a of archive) {
  if (a.act !== "exordium" || covered.has(a.id)) continue;
  if (a.id === "APOLOGY_SLIME" || a.name === "Apology Slime" || a.name.trim() === "") {
    notes.push(`archive ${a.id || "(blank id)"} (${a.name || "unnamed"}): out of scope (event filler / empty entry)`);
  } else {
    errors.push(`archive act-1 entity ${a.id} (${a.name}) not covered by corpus`);
  }
}

console.log(`\nchecked ${corpus.length} entities, ${checks} numeric comparisons\n`);
if (conflicts.length) {
  console.log(`DOCUMENTED CONFLICTS (${conflicts.length}):`);
  for (const c of conflicts) console.log("  ~ " + c);
  console.log();
}
if (notes.length) {
  console.log(`NOTES (${notes.length}):`);
  for (const n of notes) console.log("  - " + n);
  console.log();
}
if (errors.length) {
  console.log(`ERRORS (${errors.length}):`);
  for (const e of errors) console.log("  ! " + e);
  process.exit(1);
} else {
  console.log("OK: no undocumented mismatches against spire-archive.");
}
