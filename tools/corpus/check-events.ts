// Validates data/corpus/events.json against the ground-truth pools in
// sts_lightspeed's Events.h, cross-checks names against the wiki's Events.lua
// (via tools/corpus/lua.ts), and enforces paraphrase discipline (no long text
// fields that could be smuggled game prose).
//
// Run: bun tools/corpus/check-events.ts

import { parseLuaModule, type LuaTable } from "./lua";

const ROOT = new URL("../..", import.meta.url).pathname;
const EVENTS_H = `${ROOT}references/sts_lightspeed/include/constants/Events.h`;
const EVENTS_LUA = `${ROOT}references/wiki/Events.lua`;
const CORPUS = `${ROOT}data/corpus/events.json`;

const MAX_TEXT = 160; // chars; summaries/labels longer than this fail the build
const NON_EVENTS = new Set(["INVALID", "MONSTER", "REST", "SHOP", "TREASURE", "NEOW"]);
const EXPECTED_POOL_COUNTS = { act1: 11, act2: 13, act3: 7, shrine: 6, oneTime: 14 } as const;
const EVENT_COMBATS = [
  "LAGAVULIN_EVENT",
  "COLOSSEUM_EVENT_SLAVERS",
  "COLOSSEUM_EVENT_NOBS",
  "MASKED_BANDITS_EVENT",
  "MUSHROOMS_EVENT",
  "MYSTERIOUS_SPHERE_EVENT",
] as const;

// corpus name -> Events.lua key, where they differ
const LUA_NAME_ALIASES: Record<string, string> = {
  "Note For Yourself": "A Note For Yourself",
  Mindbloom: "Mind Bloom",
  "Vampires(?)": "Vampires",
};

let failures = 0;
function fail(msg: string) {
  failures++;
  console.error(`FAIL: ${msg}`);
}
function ok(msg: string) {
  console.log(`  ok: ${msg}`);
}

// ---------- parse Events.h ----------
const headerSrc = await Bun.file(EVENTS_H).text();

function extractEnumNames(src: string): string[] {
  const body = src.match(/enum class Event[^{]*\{([\s\S]*?)\}/)?.[1];
  if (!body) throw new Error("Events.h: enum class Event not found");
  return [...body.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*(?:=\s*\d+\s*)?,/gm)].map((m) => m[1]!);
}

function extractArray(src: string, decl: RegExp): string[] {
  const body = src.match(decl)?.[1];
  if (!body) throw new Error(`Events.h: array not found for ${decl}`);
  return [...body.matchAll(/Event::([A-Z0-9_]+)/g)].map((m) => m[1]!);
}

function actSection(src: string, act: string): string {
  const i = src.indexOf(`namespace ${act}`);
  if (i === -1) throw new Error(`Events.h: namespace ${act} not found`);
  const j = src.indexOf("}", src.indexOf("shrines", i));
  return src.slice(i, j + 1);
}

const enumNames = extractEnumNames(headerSrc).filter((n) => !NON_EVENTS.has(n));
const pools = {
  act1: extractArray(actSection(headerSrc, "Act1"), /events\s*\{([^}]*)\}/),
  act2: extractArray(actSection(headerSrc, "Act2"), /events\s*\{([^}]*)\}/),
  act3: extractArray(actSection(headerSrc, "Act3"), /events\s*\{([^}]*)\}/),
  shrine: extractArray(actSection(headerSrc, "Act1"), /shrines\s*\{([^}]*)\}/),
  oneTime: extractArray(headerSrc, /oneTimeEventsAsc0\s*\{([^}]*)\}/),
};
const oneTimeAsc15 = extractArray(headerSrc, /oneTimeEventsAsc15\s*\{([^}]*)\}/);

// shrine pools must be the same set in all three acts
for (const act of ["Act2", "Act3"]) {
  const s = extractArray(actSection(headerSrc, act), /shrines\s*\{([^}]*)\}/);
  const same = s.length === pools.shrine.length && s.every((e) => pools.shrine.includes(e));
  if (!same) fail(`Events.h: ${act} shrine pool differs from Act1's`);
}

// pool counts straight from the header
for (const [pool, expected] of Object.entries(EXPECTED_POOL_COUNTS)) {
  const got = pools[pool as keyof typeof pools].length;
  if (got !== expected) fail(`Events.h ${pool} pool has ${got} events, expected ${expected}`);
  else ok(`Events.h ${pool} pool count = ${expected}`);
}
const poolUnion = Object.values(pools).flat();
if (poolUnion.length !== 51) fail(`Events.h pools sum to ${poolUnion.length}, expected 51`);
if (new Set(poolUnion).size !== 51) fail("Events.h pools contain duplicate event ids");
for (const e of enumNames) {
  if (!poolUnion.includes(e)) fail(`Events.h enum ${e} is in no pool`);
}
// A15 one-time pool: exactly the base pool minus NOTE_FOR_YOURSELF
{
  const expect = pools.oneTime.filter((e) => e !== "NOTE_FOR_YOURSELF");
  const same = oneTimeAsc15.length === expect.length && expect.every((e) => oneTimeAsc15.includes(e));
  if (!same) fail("Events.h oneTimeEventsAsc15 != oneTimeEventsAsc0 minus NOTE_FOR_YOURSELF");
  else ok("A15 one-time pool = base pool minus NOTE_FOR_YOURSELF");
}

// ---------- load corpus ----------
const corpus = (await Bun.file(CORPUS).json()) as {
  meta: unknown;
  eventCombatEncounters: Record<string, { event: string; note: string }>;
  events: Array<{
    id: string;
    gameId: string;
    name: string;
    pool: keyof typeof EXPECTED_POOL_COUNTS;
    acts: number[];
    canSpawn: unknown;
    summary: string;
    options: Array<{ label: string; outcomes: unknown[] }>;
    verified: boolean;
    conflicts: string[];
    sources: string[];
  }>;
};

// every enum event appears exactly once
const seen = new Map<string, number>();
for (const ev of corpus.events) seen.set(ev.id, (seen.get(ev.id) ?? 0) + 1);
for (const e of enumNames) {
  const n = seen.get(e) ?? 0;
  if (n !== 1) fail(`corpus has ${n} entries for ${e}, expected exactly 1`);
}
for (const id of seen.keys()) {
  if (!enumNames.includes(id)) fail(`corpus event ${id} is not an Events.h enum name`);
}
if (corpus.events.length === 51) ok("corpus contains exactly 51 events, one per Events.h id");
else fail(`corpus contains ${corpus.events.length} events, expected 51`);

// pool membership matches Events.h exactly
for (const [pool, ids] of Object.entries(pools)) {
  const inCorpus = corpus.events.filter((e) => e.pool === pool).map((e) => e.id);
  if (inCorpus.length !== ids.length) {
    fail(`corpus ${pool} pool has ${inCorpus.length} events, Events.h has ${ids.length}`);
  }
  for (const id of ids) {
    if (!inCorpus.includes(id)) fail(`corpus: ${id} missing from pool ${pool}`);
  }
}
ok("pool membership checked against Events.h arrays");

// per-event structural checks + paraphrase discipline
const expectedActs: Record<string, number[]> = { act1: [1], act2: [2], act3: [3] };
for (const ev of corpus.events) {
  if (ev.summary.length > MAX_TEXT) fail(`${ev.id}: summary exceeds ${MAX_TEXT} chars (${ev.summary.length})`);
  if (!ev.summary.trim()) fail(`${ev.id}: empty summary`);
  if (!Array.isArray(ev.options) || ev.options.length === 0) fail(`${ev.id}: no options`);
  for (const [i, opt] of ev.options.entries()) {
    if (typeof opt.label !== "string" || !opt.label.trim()) fail(`${ev.id} option ${i}: missing label`);
    else if (opt.label.length > MAX_TEXT) fail(`${ev.id} option ${i}: label exceeds ${MAX_TEXT} chars (${opt.label.length})`);
    if (!Array.isArray(opt.outcomes)) fail(`${ev.id} option ${i}: outcomes must be an array`);
  }
  if (typeof ev.verified !== "boolean") fail(`${ev.id}: verified must be boolean`);
  if (!Array.isArray(ev.sources) || ev.sources.length === 0) fail(`${ev.id}: sources missing`);
  if (!ev.sources.some((s) => s.startsWith("GameContext.cpp") || s.startsWith("Events.h"))) {
    fail(`${ev.id}: no lightspeed source reference`);
  }
  const acts = expectedActs[ev.pool];
  if (acts && (ev.acts.length !== acts.length || !acts.every((a) => ev.acts.includes(a)))) {
    fail(`${ev.id}: acts ${JSON.stringify(ev.acts)} inconsistent with pool ${ev.pool}`);
  }
  if (ev.pool === "shrine" && JSON.stringify(ev.acts) !== "[1,2,3]") {
    fail(`${ev.id}: shrine events must list acts [1,2,3]`);
  }
  if (!ev.verified) {
    const extra = (ev as Record<string, unknown>)["needsJarVerification"];
    if (!ev.conflicts.length && !(Array.isArray(extra) && extra.length)) {
      fail(`${ev.id}: verified=false but neither conflicts nor needsJarVerification documented`);
    }
  }
}
ok(`summaries/labels all within ${MAX_TEXT} chars`);

// event-combat encounter references
for (const enc of EVENT_COMBATS) {
  const ref = corpus.eventCombatEncounters[enc];
  if (!ref) {
    fail(`eventCombatEncounters missing ${enc}`);
    continue;
  }
  const owner = corpus.events.find((e) => e.id === ref.event);
  if (!owner) {
    fail(`eventCombatEncounters.${enc} points at unknown event ${ref.event}`);
    continue;
  }
  const inOptions = JSON.stringify(owner.options).includes(enc);
  if (!inOptions) fail(`${owner.id}: options never reference encounter ${enc}`);
}
if (Object.keys(corpus.eventCombatEncounters).length !== EVENT_COMBATS.length) {
  fail("eventCombatEncounters must list exactly the 6 event-combat encounters");
} else {
  ok("all 6 event-combat encounters referenced on their owning events");
}

// ---------- cross-check names against wiki Events.lua ----------
const luaSrc = await Bun.file(EVENTS_LUA).text();
// lua.ts expects an `= {` assignment; Events.lua is a bare `return {` module.
const luaData = parseLuaModule(luaSrc.replace(/^\s*return\s*/, "_ = ")) as LuaTable;
const luaKeys = new Set(Object.keys(luaData));
for (const ev of corpus.events) {
  const key = LUA_NAME_ALIASES[ev.name] ?? ev.name;
  if (!luaKeys.has(key)) fail(`${ev.id}: name '${ev.name}' not found in wiki Events.lua`);
}
if (luaKeys.size !== 51) fail(`wiki Events.lua has ${luaKeys.size} entries, expected 51`);
else ok("all 51 corpus names resolve to wiki Events.lua entries");

// ---------- summary ----------
const byPool = Object.fromEntries(
  Object.keys(EXPECTED_POOL_COUNTS).map((p) => [p, corpus.events.filter((e) => e.pool === p).length]),
);
const unverified = corpus.events.filter((e) => !e.verified).map((e) => e.id);
console.log(`\npools: ${JSON.stringify(byPool)}`);
console.log(`verified: ${corpus.events.length - unverified.length}, unverified: ${unverified.length} (${unverified.join(", ")})`);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
