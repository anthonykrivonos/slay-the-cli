// Cross-checks data/corpus/monsters-act34.json (transcribed from sts_lightspeed)
// against references/spire-archive/data/sts1/monsters.json.
//
// Exit code 0 when every HP range and move damage/hits/block number either
// matches the archive or is covered by an explicitly documented conflict below.
// Silent mismatches fail the run.
//
// Run: bun tools/corpus/check-monsters-act34.ts

import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");
const corpus = (await Bun.file(join(root, "data/corpus/monsters-act34.json")).json()) as {
  monsters: CorpusMonster[];
};
const archive = (await Bun.file(
  join(root, "references/spire-archive/data/sts1/monsters.json"),
).json()) as ArchiveMonster[];

interface CorpusMove {
  intent: string;
  damage: number | null;
  hits: number | null;
  block: number | null;
  asc: Record<string, { damage?: number; hits?: number; block?: number }>;
}
interface CorpusMonster {
  id: string;
  name: string;
  hp: { base: [number, number]; asc: [number, number]; ascLevel: number };
  moves: Record<string, CorpusMove>;
}
interface ArchiveMove {
  id: string;
  name: string;
  damage: number | null;
  damage_ascension: number | null;
  intent: string;
  hits: number | null;
  block: number | null;
}
interface ArchiveMonster {
  id: string;
  name: string;
  min_hp: number;
  max_hp: number;
  min_hp_ascension: number | null;
  max_hp_ascension: number | null;
  moves: ArchiveMove[];
}

// corpus id -> archive id
const monsterMap: Record<string, string> = {
  DARKLING: "DARKLING",
  ORB_WALKER: "ORB_WALKER",
  SPIKER: "SPIKER",
  REPULSOR: "REPULSOR",
  EXPLODER: "EXPLODER",
  TRANSIENT: "TRANSIENT",
  THE_MAW: "MAW",
  SPIRE_GROWTH: "SERPENT",
  WRITHING_MASS: "WRITHINGMASS",
  GIANT_HEAD: "GIANTHEAD",
  NEMESIS: "NEMESIS",
  REPTOMANCER: "REPTOMANCER",
  DAGGER: "DAGGER",
  AWAKENED_ONE: "AWAKENEDONE",
  TIME_EATER: "TIMEEATER",
  DONU: "DONU",
  DECA: "DECA",
  SPIRE_SHIELD: "SPIRESHIELD",
  SPIRE_SPEAR: "SPIRESPEAR",
  CORRUPT_HEART: "CORRUPTHEART",
};

// corpus move enum -> archive move id (null = archive has no comparable row)
const moveMap: Record<string, Record<string, string | null>> = {
  DARKLING: {
    DARKLING_NIP: "NIP",
    DARKLING_CHOMP: "CHOMP",
    DARKLING_HARDEN: "HARDEN",
    DARKLING_REGROW: "COUNT", // archive stores Regrow under id COUNT
    DARKLING_REINCARNATE: "REINCARNATE",
  },
  ORB_WALKER: { ORB_WALKER_LASER: "LASER", ORB_WALKER_CLAW: "CLAW" },
  SPIKER: { SPIKER_CUT: "ATTACK", SPIKER_SPIKE: "BUFF_THORNS" },
  REPULSOR: { REPULSOR_BASH: "ATTACK", REPULSOR_REPULSE: "DAZE" },
  EXPLODER: { EXPLODER_SLAM: "ATTACK", EXPLODER_EXPLODE: "BLOCK" }, // archive misnames explode as BLOCK
  TRANSIENT: { TRANSIENT_ATTACK: "ATTACK" },
  THE_MAW: {
    THE_MAW_ROAR: "ROAR",
    THE_MAW_SLAM: "SLAM",
    THE_MAW_DROOL: "DROOL",
    THE_MAW_NOM: "NOMNOMNOM",
  },
  SPIRE_GROWTH: {
    SPIRE_GROWTH_QUICK_TACKLE: "QUICK_TACKLE",
    SPIRE_GROWTH_CONSTRICT: "CONSTRICT",
    SPIRE_GROWTH_SMASH: "SMASH",
  },
  WRITHING_MASS: {
    WRITHING_MASS_STRONG_STRIKE: "BIG_HIT",
    WRITHING_MASS_MULTI_STRIKE: "MULTI_HIT",
    WRITHING_MASS_FLAIL: "ATTACK_BLOCK",
    WRITHING_MASS_WITHER: "ATTACK_DEBUFF",
    WRITHING_MASS_IMPLANT: "MEGA_DEBUFF",
  },
  GIANT_HEAD: {
    GIANT_HEAD_GLARE: "GLARE",
    GIANT_HEAD_IT_IS_TIME: "IT_IS_TIME",
    GIANT_HEAD_COUNT: "COUNT",
  },
  NEMESIS: { NEMESIS_ATTACK: "TRI_ATTACK", NEMESIS_SCYTHE: "SCYTHE", NEMESIS_DEBUFF: "TRI_BURN" },
  REPTOMANCER: {
    REPTOMANCER_SNAKE_STRIKE: "SNAKE_STRIKE",
    REPTOMANCER_SUMMON: "SPAWN_DAGGER",
    REPTOMANCER_BIG_BITE: "BIG_BITE",
  },
  DAGGER: { DAGGER_STAB: "WOUND", DAGGER_EXPLODE: "EXPLODE" },
  AWAKENED_ONE: {
    AWAKENED_ONE_SLASH: "SLASH",
    AWAKENED_ONE_SOUL_STRIKE: "SOUL_STRIKE",
    AWAKENED_ONE_REBIRTH: "REBIRTH",
    AWAKENED_ONE_DARK_ECHO: "DARK_ECHO",
    AWAKENED_ONE_SLUDGE: "SLUDGE",
    AWAKENED_ONE_TACKLE: "TACKLE",
  },
  TIME_EATER: {
    TIME_EATER_REVERBERATE: "REVERBERATE",
    TIME_EATER_HEAD_SLAM: "HEAD_SLAM",
    TIME_EATER_RIPPLE: "RIPPLE",
    TIME_EATER_HASTE: "HASTE",
  },
  DONU: { DONU_CIRCLE_OF_POWER: "CIRCLE_OF_PROTECTION", DONU_BEAM: "BEAM" },
  DECA: { DECA_BEAM: "BEAM", DECA_SQUARE_OF_PROTECTION: "SQUARE_OF_PROTECTION" },
  SPIRE_SHIELD: {
    SPIRE_SHIELD_BASH: "BASH",
    SPIRE_SHIELD_FORTIFY: "FORTIFY",
    SPIRE_SHIELD_SMASH: "SMASH",
  },
  SPIRE_SPEAR: {
    SPIRE_SPEAR_BURN_STRIKE: "BURN_STRIKE",
    SPIRE_SPEAR_PIERCER: "PIERCER",
    SPIRE_SPEAR_SKEWER: "SKEWER",
  },
  CORRUPT_HEART: {
    CORRUPT_HEART_DEBILITATE: "DEBILITATE",
    CORRUPT_HEART_BLOOD_SHOTS: "BLOOD_SHOTS",
    CORRUPT_HEART_ECHO: "ECHO_ATTACK",
    CORRUPT_HEART_BUFF: "GAIN_ONE_STRENGTH",
  },
};

// Mismatches that are documented in the corpus file's per-entity "conflicts"
// arrays (or are known spire-archive data-quality gaps). Anything listed here
// is reported as an allowed, documented conflict — anything NOT listed fails.
const documentedConflicts: Record<string, string> = {
  "AWAKENED_ONE.hp.asc":
    "lightspeed rolls hpRng.random(300,320) at asc9+; archive/wiki record flat 320 (see corpus conflicts)",
  "TRANSIENT.hp.asc":
    "archive has no ascended HP row (Transient HP is a fixed 999 at all ascensions)",
  "DARKLING.DARKLING_CHOMP.hits":
    "archive/wiki say 2 hits; lightspeed implements 1 hit — corpus records 2 (documented conflict)",
  "GIANT_HEAD.GIANT_HEAD_IT_IS_TIME.damage":
    "archive stores 5/15 (the per-turn increment); real base is 30/40 +5-per-turn (documented conflict)",
  "GIANT_HEAD.GIANT_HEAD_IT_IS_TIME.damage_asc":
    "same archive error as base damage",
  "TIME_EATER.TIME_EATER_HASTE.block":
    "archive says 26; lightspeed+wiki agree on 32 at asc19 (documented conflict)",
  "EXPLODER.EXPLODER_EXPLODE.damage":
    "archive lists the explode row (id BLOCK) with null damage; explode deals a flat 30 (documented conflict)",
  "WRITHING_MASS.WRITHING_MASS_FLAIL.block":
    "archive block is null; lightspeed says 16 (18 at asc2) — wiki says flat 16 (documented conflict)",
  "SPIRE_SHIELD.SPIRE_SHIELD_SMASH.block":
    "archive stores the asc18 flat 99; base behavior is block = damage dealt (corpus block null + effect)",
  "TIME_EATER.TIME_EATER_HASTE.block_base":
    "corpus has no base block (heal-only below asc19); archive stores 26 unconditionally",
};

let failures = 0;
let allowed = 0;
let checks = 0;

function report(kind: "ok" | "conflict" | "FAIL", key: string, msg: string) {
  if (kind === "FAIL") {
    failures++;
    console.log(`FAIL      ${key}: ${msg}`);
  } else if (kind === "conflict") {
    allowed++;
    console.log(`conflict  ${key}: ${msg} [documented: ${documentedConflicts[key]}]`);
  }
}

function checkNum(key: string, mine: number | null, theirs: number | null) {
  // compare only when the archive has a value; archive nulls are missing data
  if (theirs === null || theirs === undefined) return;
  checks++;
  if (mine === theirs) return;
  if (key in documentedConflicts) {
    report("conflict", key, `corpus=${mine} archive=${theirs}`);
  } else {
    report("FAIL", key, `corpus=${mine} archive=${theirs}`);
  }
}

/** highest-threshold asc override value for a field, or the base value */
function ascValue(move: CorpusMove, field: "damage" | "hits" | "block"): number | null {
  let best: number | null = move[field];
  const levels = Object.keys(move.asc ?? {})
    .map(Number)
    .sort((a, b) => a - b);
  for (const lv of levels) {
    const o = move.asc[String(lv)];
    if (o && o[field] !== undefined) best = o[field]!;
  }
  return best;
}

const archiveById = new Map(archive.map((m) => [m.id, m]));

for (const m of corpus.monsters) {
  const aid = monsterMap[m.id];
  const a = archiveById.get(aid!);
  if (!a) {
    report("FAIL", `${m.id}`, `archive monster ${aid} not found`);
    continue;
  }

  // HP
  checkNum(`${m.id}.hp.base.min`, m.hp.base[0], a.min_hp);
  checkNum(`${m.id}.hp.base.max`, m.hp.base[1], a.max_hp);
  if (a.min_hp_ascension !== null) {
    const key = `${m.id}.hp.asc`;
    checks++;
    if (m.hp.asc[0] === a.min_hp_ascension && m.hp.asc[1] === a.max_hp_ascension) {
      // ok
    } else if (key in documentedConflicts) {
      report(
        "conflict",
        key,
        `corpus=[${m.hp.asc}] archive=[${a.min_hp_ascension},${a.max_hp_ascension}]`,
      );
    } else {
      report(
        "FAIL",
        key,
        `corpus=[${m.hp.asc}] archive=[${a.min_hp_ascension},${a.max_hp_ascension}]`,
      );
    }
  } else if (m.hp.asc[0] !== m.hp.base[0] || m.hp.asc[1] !== m.hp.base[1]) {
    // archive says "no ascended HP"; corpus asc should equal base unless documented
    const key = `${m.id}.hp.asc`;
    checks++;
    if (key in documentedConflicts) report("conflict", key, `corpus asc=[${m.hp.asc}] archive=null`);
    else report("FAIL", key, `corpus asc=[${m.hp.asc}] but archive has no ascended HP`);
  }

  // Moves
  const amoves = new Map(a.moves.map((mv) => [mv.id, mv]));
  for (const [moveId, mv] of Object.entries(m.moves)) {
    const amId = moveMap[m.id]?.[moveId];
    if (amId === undefined) {
      report("FAIL", `${m.id}.${moveId}`, "no archive mapping declared");
      continue;
    }
    if (amId === null) continue;
    const am = amoves.get(amId);
    if (!am) {
      report("FAIL", `${m.id}.${moveId}`, `archive move ${amId} not found`);
      continue;
    }

    checkNum(`${m.id}.${moveId}.damage`, mv.damage, am.damage);
    checkNum(`${m.id}.${moveId}.damage_asc`, ascValue(mv, "damage"), am.damage_ascension);

    // archive hits: only meaningful for attacks (it stores 1 for non-attacks too)
    if (am.damage !== null && am.hits !== null && mv.hits !== null) {
      checkNum(`${m.id}.${moveId}.hits`, mv.hits, am.hits);
    }
    if (am.block !== null) {
      const key = `${m.id}.${moveId}.block`;
      const mineBase = mv.block;
      const mineAsc = ascValue(mv, "block");
      checks++;
      if (mineBase === am.block || mineAsc === am.block) {
        // archive stores a single block value; accept either base or ascended match
      } else if (key in documentedConflicts || `${key}_base` in documentedConflicts) {
        const k = key in documentedConflicts ? key : `${key}_base`;
        allowed++;
        console.log(
          `conflict  ${key}: corpus base=${mineBase}/asc=${mineAsc} archive=${am.block} [documented: ${documentedConflicts[k]}]`,
        );
      } else {
        report("FAIL", key, `corpus base=${mineBase}/asc=${mineAsc} archive=${am.block}`);
      }
    }
  }

  // moves present in archive but absent from corpus
  const mapped = new Set(Object.values(moveMap[m.id] ?? {}));
  for (const am of a.moves) {
    if (!mapped.has(am.id)) {
      report("FAIL", `${m.id}.<archive:${am.id}>`, "archive move not mapped by corpus");
    }
  }
}

console.log("");
console.log(
  `checked ${corpus.monsters.length} monsters, ${checks} numeric comparisons: ` +
    `${checks - allowed - failures} clean, ${allowed} documented conflicts, ${failures} failures`,
);
if (failures > 0) process.exit(1);
console.log("OK — no silent mismatches");
