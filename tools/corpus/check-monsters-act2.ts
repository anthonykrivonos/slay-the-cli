// Cross-checks data/corpus/monsters-act2.json (hand-transcribed from
// sts_lightspeed + wiki) against references/spire-archive/data/sts1/monsters.json.
//
// Rules: every numeric disagreement must either match spire-archive or be
// covered by a documented entry in the monster's `conflicts` array (matched by
// its `field` path). Documented conflicts are reported as OK; silent
// mismatches fail the run (exit 1).
//
// Run: bun tools/corpus/check-monsters-act2.ts

import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");
const corpus = (await Bun.file(join(root, "data/corpus/monsters-act2.json")).json()) as CorpusMonster[];
const archive = (await Bun.file(join(root, "references/spire-archive/data/sts1/monsters.json")).json()) as ArchiveMonster[];

interface CorpusEffect {
  power: string;
  amount: number | null;
  target: string;
}
interface CorpusMove {
  intent: string;
  damage: number | null;
  hits: number | null;
  block: number | null;
  effects: CorpusEffect[];
  asc: Record<string, Partial<Pick<CorpusMove, "damage" | "hits" | "block" | "effects">>>;
}
interface CorpusMonster {
  id: string;
  name: string;
  category: string;
  hp: { base: [number, number]; asc: [number, number]; ascLevel: number };
  moves: Record<string, CorpusMove>;
  conflicts: { field: string; note?: string }[];
}
interface ArchiveMove {
  id: string;
  name: string;
  damage: number | null;
  damage_ascension: number | null;
  intent: string;
  hits: number;
  block: number | null;
}
interface ArchiveMonster {
  id: string;
  name: string;
  min_hp: number | null;
  max_hp: number | null;
  min_hp_ascension: number | null;
  max_hp_ascension: number | null;
  moves: ArchiveMove[];
}

// corpus MonsterIds.h enum -> spire-archive monster id
const monsterMap: Record<string, string> = {
  SPHERIC_GUARDIAN: "SPHERICGUARDIAN",
  CHOSEN: "CHOSEN",
  SHELLED_PARASITE: "SHELLED_PARASITE",
  BYRD: "BYRD",
  MUGGER: "MUGGER",
  CENTURION: "CENTURION",
  MYSTIC: "HEALER",
  SNAKE_PLANT: "SNAKEPLANT",
  SNECKO: "SNECKO",
  BOOK_OF_STABBING: "BOOKOFSTABBING",
  GREMLIN_LEADER: "GREMLINLEADER",
  TASKMASTER: "SLAVERBOSS",
  BRONZE_AUTOMATON: "BRONZEAUTOMATON",
  BRONZE_ORB: "BRONZEORB",
  THE_COLLECTOR: "THECOLLECTOR",
  TORCH_HEAD: "TORCHHEAD",
  THE_CHAMP: "CHAMP",
  BEAR: "BANDITBEAR",
  ROMEO: "BANDITLEADER",
  POINTY: "BANDITCHILD",
};

// corpus MonsterMoves.h enum -> spire-archive move id (per monster)
const moveMap: Record<string, Record<string, string>> = {
  SPHERIC_GUARDIAN: {
    SPHERIC_GUARDIAN_SLAM: "BIG_ATTACK",
    SPHERIC_GUARDIAN_ACTIVATE: "INITIAL_BLOCK_GAIN",
    SPHERIC_GUARDIAN_HARDEN: "BLOCK_ATTACK",
    SPHERIC_GUARDIAN_ATTACK_DEBUFF: "FRAIL_ATTACK",
  },
  CHOSEN: {
    CHOSEN_POKE: "POKE",
    CHOSEN_ZAP: "ZAP",
    CHOSEN_DEBILITATE: "DEBILITATE",
    CHOSEN_DRAIN: "DRAIN",
    CHOSEN_HEX: "HEX",
  },
  SHELLED_PARASITE: {
    SHELLED_PARASITE_FELL: "FELL",
    SHELLED_PARASITE_DOUBLE_STRIKE: "DOUBLE_STRIKE",
    SHELLED_PARASITE_SUCK: "LIFE_SUCK",
    SHELLED_PARASITE_STUNNED: "STUNNED",
  },
  BYRD: {
    BYRD_PECK: "PECK",
    BYRD_FLY: "GO_AIRBORNE",
    BYRD_SWOOP: "SWOOP",
    BYRD_STUNNED: "STUNNED",
    BYRD_HEADBUTT: "HEADBUTT",
    BYRD_CAW: "CAW",
  },
  MUGGER: {
    MUGGER_MUG: "MUG",
    MUGGER_SMOKE_BOMB: "SMOKE_BOMB",
    // MUGGER_LUNGE / MUGGER_ESCAPE not present in spire-archive
  },
  CENTURION: {
    CENTURION_SLASH: "SLASH",
    CENTURION_DEFEND: "PROTECT",
    CENTURION_FURY: "FURY",
  },
  MYSTIC: {
    MYSTIC_ATTACK_DEBUFF: "ATTACK",
    MYSTIC_HEAL: "HEAL",
    MYSTIC_BUFF: "BUFF",
  },
  SNAKE_PLANT: {
    SNAKE_PLANT_CHOMP: "CHOMPY_CHOMPS",
    SNAKE_PLANT_ENFEEBLING_SPORES: "SPORES",
  },
  SNECKO: {
    SNECKO_PERPLEXING_GLARE: "GLARE",
    SNECKO_BITE: "BITE",
    SNECKO_TAIL_WHIP: "TAIL",
  },
  BOOK_OF_STABBING: {
    BOOK_OF_STABBING_MULTI_STAB: "STAB",
    BOOK_OF_STABBING_SINGLE_STAB: "BIG_STAB",
  },
  GREMLIN_LEADER: {
    GREMLIN_LEADER_RALLY: "RALLY",
    GREMLIN_LEADER_ENCOURAGE: "ENCOURAGE",
    GREMLIN_LEADER_STAB: "STAB",
  },
  TASKMASTER: {
    TASKMASTER_SCOURING_WHIP: "SCOURING_WHIP",
  },
  BRONZE_AUTOMATON: {
    BRONZE_AUTOMATON_FLAIL: "FLAIL",
    BRONZE_AUTOMATON_HYPER_BEAM: "HYPER_BEAM",
    BRONZE_AUTOMATON_STUNNED: "STUNNED",
    BRONZE_AUTOMATON_SPAWN_ORBS: "SPAWN_ORBS",
    BRONZE_AUTOMATON_BOOST: "BOOST",
  },
  BRONZE_ORB: {
    BRONZE_ORB_BEAM: "BEAM",
    BRONZE_ORB_SUPPORT_BEAM: "SUPPORT_BEAM",
    BRONZE_ORB_STASIS: "STASIS",
  },
  THE_COLLECTOR: {
    THE_COLLECTOR_SPAWN: "SPAWN",
    THE_COLLECTOR_FIREBALL: "FIREBALL",
    THE_COLLECTOR_BUFF: "BUFF",
    THE_COLLECTOR_MEGA_DEBUFF: "MEGA_DEBUFF",
    // spire-archive's REVIVE move does not exist in the shipped game
  },
  TORCH_HEAD: {
    TORCH_HEAD_TACKLE: "TACKLE",
  },
  THE_CHAMP: {
    THE_CHAMP_HEAVY_SLASH: "HEAVY_SLASH",
    THE_CHAMP_DEFENSIVE_STANCE: "DEFENSIVE_STANCE",
    THE_CHAMP_EXECUTE: "EXECUTE",
    THE_CHAMP_FACE_SLAP: "FACE_SLAP",
    THE_CHAMP_GLOAT: "GLOAT",
    THE_CHAMP_TAUNT: "TAUNT",
    THE_CHAMP_ANGER: "ANGER",
  },
  BEAR: {
    BEAR_BEAR_HUG: "BEAR_HUG",
    // BEAR_LUNGE / BEAR_MAUL not present in spire-archive
  },
  ROMEO: {
    ROMEO_MOCK: "MOCK",
    // ROMEO_AGONIZING_SLASH / ROMEO_CROSS_SLASH not present in spire-archive
  },
  POINTY: {
    POINTY_ATTACK: "POINTY_SPECIAL",
  },
};

let checks = 0;
let failures = 0;
let documented = 0;
const infos: string[] = [];

function isDocumented(m: CorpusMonster, fieldPath: string): { field: string; note?: string } | undefined {
  return m.conflicts.find(
    (c) => fieldPath.startsWith(c.field) || c.field.startsWith(fieldPath),
  );
}

function compare(m: CorpusMonster, fieldPath: string, mine: unknown, theirs: unknown) {
  checks++;
  if (mine === theirs) return;
  const conflict = isDocumented(m, fieldPath);
  if (conflict) {
    documented++;
    console.log(
      `  OK (documented conflict) ${m.id} ${fieldPath}: corpus=${JSON.stringify(mine)} spire-archive=${JSON.stringify(theirs)}`,
    );
    return;
  }
  failures++;
  console.error(
    `  FAIL ${m.id} ${fieldPath}: corpus=${JSON.stringify(mine)} spire-archive=${JSON.stringify(theirs)} (undocumented mismatch)`,
  );
}

// the ascension tier at which spire-archive's `damage_ascension` applies
// (A2 normals/events, A3 elites, A4 bosses+boss minions)
function ascDamage(move: CorpusMove): number | null {
  for (const lvl of ["2", "3", "4"]) {
    const d = move.asc[lvl]?.damage;
    if (d !== undefined) return d;
  }
  return null;
}

// block granted to an ally rather than self (e.g. Bronze Orb Support Beam):
// spire-archive stores it in `block`, the corpus stores it as an ally BLOCK
// effect. The fallback is only used when spire-archive actually recorded a
// value (it leaves Centurion's Protect at null, for instance).
function effectiveBlock(move: CorpusMove, archiveBlock: number | null): number | null {
  if (move.block !== null) return move.block;
  if (archiveBlock === null) return null;
  const allyBlock = move.effects.find((e) => e.power === "BLOCK" && e.target === "allies");
  return allyBlock?.amount ?? null;
}

const archiveById = new Map(archive.map((m) => [m.id, m]));

for (const m of corpus) {
  const spireId = monsterMap[m.id];
  if (!spireId) {
    failures++;
    console.error(`FAIL ${m.id}: no spire-archive mapping defined`);
    continue;
  }
  const a = archiveById.get(spireId);
  if (!a) {
    failures++;
    console.error(`FAIL ${m.id}: spire-archive monster '${spireId}' not found`);
    continue;
  }
  console.log(`${m.id} <-> spire-archive:${spireId} ("${a.name}")`);

  // --- HP ---
  compare(m, "hp.base", m.hp.base[0], a.min_hp);
  compare(m, "hp.base", m.hp.base[1], a.max_hp);
  if (a.min_hp_ascension === null || a.max_hp_ascension === null) {
    infos.push(`${m.id}: spire-archive has no ascension HP (corpus asc=[${m.hp.asc}]) - skipped`);
  } else {
    compare(m, "hp.asc", m.hp.asc[0], a.min_hp_ascension);
    compare(m, "hp.asc", m.hp.asc[1], a.max_hp_ascension);
  }

  // --- moves ---
  const map = moveMap[m.id] ?? {};
  const archiveMoves = new Map(a.moves.map((mv) => [mv.id, mv]));
  const mappedArchiveIds = new Set(Object.values(map));

  for (const [moveId, move] of Object.entries(m.moves)) {
    const spireMoveId = map[moveId];
    if (!spireMoveId) {
      infos.push(`${m.id}.${moveId}: not present in spire-archive - skipped`);
      continue;
    }
    const am = archiveMoves.get(spireMoveId);
    if (!am) {
      failures++;
      console.error(`  FAIL ${m.id}.${moveId}: mapped spire-archive move '${spireMoveId}' not found`);
      continue;
    }
    const base = `moves.${moveId}`;
    if (am.damage === null && move.damage !== null) {
      // spire-archive occasionally lacks base damage (e.g. Pointy Special);
      // null there means "no data", not "no damage".
      infos.push(`${m.id}.${moveId}: corpus damage ${move.damage} but spire-archive damage is null - skipped`);
    } else {
      compare(m, `${base}.damage`, move.damage, am.damage);
    }
    if (am.damage_ascension !== null) {
      compare(m, `${base}.damage(asc)`, ascDamage(move), am.damage_ascension);
    } else if (ascDamage(move) !== null) {
      // spire-archive frequently leaves damage_ascension null even when the
      // game scales the damage (e.g. Byrd Swoop is filled in, Torch Head is null);
      // only report when spire actually has a value, otherwise informational.
      infos.push(`${m.id}.${moveId}: corpus has asc damage ${ascDamage(move)} but spire-archive damage_ascension is null - skipped`);
    }
    // spire-archive uses hits:1 as a filler even for non-attacks; only compare
    // hits when the move actually deals damage and the corpus hit count is static.
    if (move.damage !== null) {
      if (move.hits === null) {
        infos.push(`${m.id}.${moveId}: dynamic hit count (corpus hits=null) - skipped`);
      } else {
        compare(m, `${base}.hits`, move.hits, am.hits);
      }
    }
    compare(m, `${base}.block`, effectiveBlock(move, am.block), am.block);
    compare(m, `${base}.intent`, move.intent, am.intent);
  }

  for (const am of a.moves) {
    if (!mappedArchiveIds.has(am.id)) {
      infos.push(`${m.id}: spire-archive move '${am.id}' ("${am.name}") has no corpus counterpart - skipped`);
    }
  }
}

// every corpus entry must map, and every mapping must have a corpus entry
for (const id of Object.keys(monsterMap)) {
  if (!corpus.some((m) => m.id === id)) {
    failures++;
    console.error(`FAIL: mapping for ${id} exists but corpus entry is missing`);
  }
}

console.log("\n--- info (skipped, not comparable) ---");
for (const line of infos) console.log(`  ${line}`);

console.log(
  `\n${corpus.length} monsters, ${checks} comparisons, ${documented} documented conflicts, ${failures} undocumented mismatches`,
);

if (failures > 0) {
  process.exit(1);
}
console.log("CLEAN");
