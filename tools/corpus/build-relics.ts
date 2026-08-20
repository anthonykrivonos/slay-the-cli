// Build data/corpus/relics.json by reconciling three independent sources:
//  1. sts_lightspeed Relics.h / RelicPools.h (canonical enum ids, game-internal string ids,
//     tiers, per-class shuffled relic pools in exact seeded-shuffle order)
//  2. spire-archive data/sts1/relics.json + relic_values.json (parsed from game files:
//     tier, color, numeric description values)
//  3. wiki.gg Module:Relics/data (the 180-count truth; tier taxonomy that separates Event
//     from Special; Character pool locks; mechanical rules text — flavor is NOT copied)
// Any disagreement is recorded in references/extracted/relics-conflicts.json.
//
// counter: lifetime of the relic's mutable state, grounded in sts_lightspeed's engine:
//   - "turn"       state resets every turn (per-turn play counters/flags)
//   - "combat"     state lives within one combat (turn counters, first-X flags)
//   - "persistent" state survives between combats (lightspeed RelicInstance.data /
//                  save-file relic_counters: Player.h counters written back in
//                  BattleContext::updateRelicsOnExit + GameContext getRelicValueRef users)
//   - "none"       pure trigger/passive, no mutable state

import { parseLuaModule, type LuaTable } from "./lua";

const ROOT = `${import.meta.dir}/../..`;
const relicsH = await Bun.file(`${ROOT}/references/sts_lightspeed/include/constants/Relics.h`).text();
const poolsH = await Bun.file(`${ROOT}/references/sts_lightspeed/include/constants/RelicPools.h`).text();
const spire: any[] = await Bun.file(`${ROOT}/references/spire-archive/data/sts1/relics.json`).json();
const relicValues: Record<string, (number | null)[]> = (
  await Bun.file(`${ROOT}/references/spire-archive/data/sts1/relic_values.json`).json()
).relics;
const wikiRaw = parseLuaModule(await Bun.file(`${ROOT}/references/wiki/Relics.lua`).text()) as Record<
  string,
  LuaTable
>;

// --- helpers ------------------------------------------------------------------
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const upperSnake = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** Capture the balanced-brace initializer following a declaration pattern. */
function initializer(src: string, decl: RegExp): string {
  const m = decl.exec(src);
  if (!m || m.index === undefined) throw new Error(`decl not found: ${decl}`);
  const start = src.indexOf("{", m.index + m[0].length - 1);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces for ${decl}`);
}
const strings = (src: string, decl: RegExp) =>
  [...initializer(src, decl).matchAll(/"([^"]*)"/g)].map((m) => m[1]!);
const enums = (src: string, decl: RegExp, kind: string) =>
  [...initializer(src, decl).matchAll(new RegExp(`${kind}::(\\w+)`, "g"))].map((m) => m[1]!);

// --- lightspeed: Relics.h arrays -----------------------------------------------
const lsEnum = strings(relicsH, /relicEnumNames\[\]\s*/);
const lsNames = strings(relicsH, /relicNames\[\]\s*/);
const lsGameIds = strings(relicsH, /relicIds\[\]\s*/);
const lsTiers = enums(relicsH, /relicTiers\[\]\s*/, "RelicTier");
if (new Set([lsEnum.length, lsNames.length, lsGameIds.length, lsTiers.length]).size !== 1)
  throw new Error("lightspeed array length mismatch");
if (lsEnum[lsEnum.length - 1] !== "INVALID") throw new Error("expected trailing INVALID");
const lsCount = lsEnum.length - 1; // drop INVALID

const lsIndexByNorm = new Map<string, number>();
for (let i = 0; i < lsCount; i++) {
  lsIndexByNorm.set(norm(lsEnum[i]!), i);
  lsIndexByNorm.set(norm(lsNames[i]!), i);
  lsIndexByNorm.set(norm(lsGameIds[i]!), i);
}

// --- lightspeed: RelicPools.h per-class shuffled pools --------------------------
const CLASSES = ["Ironclad", "Silent", "Defect", "Watcher"] as const;
const POOL_TIERS = ["common", "uncommon", "rare", "boss", "shop"] as const;
const classPools: Record<string, Record<string, string[]>> = {};
const declaredSizes: Record<string, Record<string, number>> = {};
for (let ci = 0; ci < CLASSES.length; ci++) {
  const cls = CLASSES[ci]!;
  const start = poolsH.indexOf(`namespace ${cls}`);
  const end = ci + 1 < CLASSES.length ? poolsH.indexOf(`namespace ${CLASSES[ci + 1]}`) : poolsH.length;
  const block = poolsH.slice(start, end);
  classPools[cls] = {};
  declaredSizes[cls] = {};
  for (const tier of POOL_TIERS) {
    const decl = new RegExp(`std::array<RelicId,\\s*(\\d+)>\\s*${tier}RelicPool\\s*=\\s*`);
    const dm = decl.exec(block);
    if (!dm) throw new Error(`${cls}.${tier} pool not found`);
    declaredSizes[cls]![tier] = parseInt(dm[1]!, 10);
    classPools[cls]![tier] = enums(block, decl, "RelicId");
  }
}
const starterRelics = enums(poolsH, /starterRelics\[\]\s*=\s*/, "RelicId"); // [IC, Silent, Defect, Watcher]

// enum id -> ["ironclad.common", ...]
const inPools = new Map<string, string[]>();
for (const cls of CLASSES)
  for (const tier of POOL_TIERS)
    for (const id of classPools[cls]![tier]!)
      inPools.set(id, [...(inPools.get(id) ?? []), `${cls.toLowerCase()}.${tier}`]);
starterRelics.forEach((id, i) =>
  inPools.set(id, [...(inPools.get(id) ?? []), `${CLASSES[i]!.toLowerCase()}.starter`]),
);

// --- wiki: drop Custom Mode blights, keep the 180 relics ------------------------
const wiki = new Map<string, LuaTable>(); // norm(name) -> entry (with __name)
for (const [name, e] of Object.entries(wikiRaw)) {
  if (e["Rarity"] === "Blight") continue;
  const key = norm(name);
  if (wiki.has(key)) throw new Error(`wiki norm collision: ${name}`);
  wiki.set(key, Object.assign({ __name: name }, e));
}

// --- spire-archive index ---------------------------------------------------------
const spireByNorm = new Map<string, any>();
for (const r of spire) {
  spireByNorm.set(norm(r.id), r);
  if (!spireByNorm.has(norm(r.name))) spireByNorm.set(norm(r.name), r);
}

// relic_values keyed by UPPER_SNAKE(game id); normalize; skip test relics
const valuesByNorm = new Map<string, (number | null)[]>();
for (const [k, v] of Object.entries(relicValues)) {
  if (k.startsWith("TEST_")) continue;
  valuesByNorm.set(norm(k), v);
}

// --- canonicalizers --------------------------------------------------------------
const CLASS_COLOR: Record<string, string> = {
  Ironclad: "red", Silent: "green", Defect: "blue", Watcher: "purple",
  ironclad: "red", silent: "green", defect: "blue", watcher: "purple",
};
// lightspeed/spire have no Event tier: their SPECIAL/Special covers wiki's event+special.
const tiersAgree = (corpus: string, other: string) =>
  corpus === other || (other === "special" && (corpus === "event" || corpus === "special"));

// counter state lifetime (see header). Everything not listed is "none".
const COUNTER: Record<string, "turn" | "combat" | "persistent"> = {
  // per-turn counters/flags (reset every turn)
  ART_OF_WAR: "turn",        // no-attack-played-this-turn flag
  KUNAI: "turn",             // attacks played this turn (every 3)
  SHURIKEN: "turn",          // attacks played this turn (every 3)
  LETTER_OPENER: "turn",     // skills played this turn (every 3)
  ORNAMENTAL_FAN: "turn",    // attacks played this turn (every 3)
  POCKETWATCH: "turn",       // cards played this turn (<=3 -> draw next turn)
  VELVET_CHOKER: "turn",     // cards played this turn (cap 6)
  NECRONOMICON: "turn",      // haveUsedNecronomiconThisTurn (Player.h)
  HOVERING_KITE: "turn",     // first-card-discarded-this-turn flag
  ORANGE_PELLETS: "turn",    // orangePelletsCardTypesPlayed bitset (Player.h)
  EMOTION_CHIP: "turn",      // lost-HP-last-turn flag
  // per-combat state (reset each combat)
  AKABEKO: "combat",           // first-Attack bonus consumed in combat
  CENTENNIAL_PUZZLE: "combat", // first-HP-loss-this-combat flag
  GAMBLING_CHIP: "combat",     // once-at-combat-start flag
  HORN_CLEAT: "combat",        // turn counter (fires turn 2)
  CAPTAINS_WHEEL: "combat",    // turn counter (fires turn 3)
  STONE_CALENDAR: "combat",    // turn counter (fires end of turn 7)
  // persists between combats (lightspeed RelicInstance.data / save relic_counters)
  HAPPY_FLOWER: "persistent",
  INCENSE_BURNER: "persistent",
  INK_BOTTLE: "persistent",
  INSERTER: "persistent",
  NUNCHAKU: "persistent",
  PEN_NIB: "persistent",
  SUNDIAL: "persistent",
  LIZARD_TAIL: "persistent",       // one-shot used flag
  OMAMORI: "persistent",           // 2 charges
  ANCIENT_TEA_SET: "persistent",   // armed-at-rest-site flag
  MAW_BANK: "persistent",          // disabled-after-spending flag
  MATRYOSHKA: "persistent",        // 2 uses
  TINY_CHEST: "persistent",        // every-4th-?-room counter
  GIRYA: "persistent",             // lift count 0..3
  WING_BOOTS: "persistent",        // 3 charges
  NEOWS_LAMENT: "persistent",      // 3 combats, decremented on combat exit
  NLOTHS_HUNGRY_FACE: "persistent",// next-chest one-shot flag
  BOTTLED_FLAME: "persistent",     // stored card choice
  BOTTLED_LIGHTNING: "persistent", // stored card choice
  BOTTLED_TORNADO: "persistent",   // stored card choice
};

// Known, explained discrepancies — suppressed from the live conflict list so new ones
// stand out, but still written to the conflicts report under "adjudicated".
const ADJUDICATED_WHY: Record<string, string> = {
  // spire-archive's relic_parser.py hardcodes KNOWN_CHARACTER_RELICS["CaptainsWheel"] = "watcher".
  // That is a spire-archive bug: wiki has no Character lock, and RelicPools.h places
  // CAPTAINS_WHEEL in all four classes' rare pools (shared). Corpus keeps pool = "shared".
  "CAPTAINS_WHEEL|pool|spire": "spire-archive parser bug; wiki + RelicPools.h agree it is shared",
};
const ADJUDICATED = new Set<string>(Object.keys(ADJUDICATED_WHY));

// --- merge ------------------------------------------------------------------------
const conflicts: any[] = [];
const needsManualVerification: any[] = [];
const missing = { spire: [] as string[], wiki: [] as string[], lightspeed: [] as string[] };
const relics: any[] = [];
const usedWiki = new Set<string>();
const usedSpire = new Set<any>();

const clash = (id: string, field: string, corpus: unknown, other: unknown, src: string) => {
  if (corpus != null && other != null && String(corpus) !== String(other) && !ADJUDICATED.has(`${id}|${field}|${src}`))
    conflicts.push({ id, field, corpus, [src]: other });
};

function buildRelic(opts: {
  lsIndex: number | null;
  wikiEntry: LuaTable | undefined;
  spireEntry: any | undefined;
}) {
  const { lsIndex, wikiEntry: wk, spireEntry: sp } = opts;
  const enumId = lsIndex != null ? lsEnum[lsIndex]! : null;
  const name = (wk?.["__name"] as string) ?? (lsIndex != null ? lsNames[lsIndex]! : sp!.name);
  const id = enumId ?? upperSnake(name);
  const gameId = lsIndex != null ? lsGameIds[lsIndex]! : null;

  // tier: wiki wins (only source distinguishing event from special)
  const wikiTier = wk ? String(wk["Rarity"]).toLowerCase() : null;
  const lsTier = lsIndex != null ? lsTiers[lsIndex]!.toLowerCase() : null;
  const spTier = sp ? String(sp.tier).toLowerCase() : null;
  const tier = wikiTier ?? (lsTier === "special" ? "special" : lsTier) ?? spTier;

  // pool: wiki Character wins; cross-checked against spire color and pool membership
  const wikiPool = wk?.["Character"] ? CLASS_COLOR[String(wk["Character"])]! : wk ? "shared" : null;
  const spPool = sp?.color ? CLASS_COLOR[sp.color]! : null;
  const pool = wikiPool ?? spPool ?? "shared";

  const pools = (enumId && inPools.get(enumId)) || [];
  const values = gameId ? (valuesByNorm.get(norm(gameId)) ?? null) : (valuesByNorm.get(norm(id)) ?? null);

  const relic: any = {
    id,
    name,
    gameId,
    tier,
    pool,
    inCharacterPools: pools,
    counter: COUNTER[id] ?? "none",
    values,
    text: (wk?.["Description"] as string) ?? sp?.description ?? null,
    unobtainable: false,
    sources: { lightspeed: enumId, spire: sp?.id ?? null, wiki: (wk?.["__name"] as string) ?? null },
  };
  if (lsIndex == null) relic.lightspeedMissing = true;

  // --- cross-checks (lightspeed/spire have no Event tier; their special == wiki event|special) ---
  if (lsTier && !tiersAgree(tier!, lsTier)) clash(id, "tier", tier, lsTier, "lightspeed");
  if (spTier && !tiersAgree(tier!, spTier)) clash(id, "tier", tier, spTier, "spire");
  if (spPool) clash(id, "pool", pool, spPool, "spire");
  if (sp && gameId) {
    // spire ids were produced by to_upper_snake(game id); compare through norm
    if (norm(sp.id) !== norm(gameId) && norm(sp.name) !== norm(name))
      clash(id, "gameId", gameId, sp.id, "spire");
  }
  // pool membership vs pool lock: shared => in all 4 class pools of one tier; locked => only its class
  if (pools.length > 0) {
    const poolClasses = new Set(pools.map((p: string) => p.split(".")[0]!));
    const derived =
      poolClasses.size === 4 ? "shared" : poolClasses.size === 1 ? CLASS_COLOR[[...poolClasses][0]!]! : "?";
    clash(id, "pool", pool, derived, "relicPools");
  }
  // numeric values must appear in the wiki rules text
  if (values && wk) {
    const textNums = new Set((String(wk["Description"]).match(/\d+/g) ?? []).map(Number));
    for (const v of values)
      if (v != null && !textNums.has(v)) clash(id, "values", v, `not in wiki text`, "wiki");
  }
  return relic;
}

// pass 1: lightspeed enum order (the engine's canonical order)
for (let i = 0; i < lsCount; i++) {
  const wk = wiki.get(norm(lsNames[i]!)) ?? wiki.get(norm(lsEnum[i]!)) ?? wiki.get(norm(lsGameIds[i]!));
  if (wk) usedWiki.add(wk["__name"] as string);
  else missing.wiki.push(lsEnum[i]!);
  const sp =
    spireByNorm.get(norm(lsGameIds[i]!)) ?? spireByNorm.get(norm(lsEnum[i]!)) ?? spireByNorm.get(norm(lsNames[i]!));
  if (sp) usedSpire.add(sp);
  else missing.spire.push(lsEnum[i]!);
  relics.push(buildRelic({ lsIndex: i, wikiEntry: wk, spireEntry: sp }));
}

// pass 2: wiki relics absent from lightspeed
for (const [, wk] of wiki) {
  const name = wk["__name"] as string;
  if (usedWiki.has(name)) continue;
  missing.lightspeed.push(name);
  const sp = spireByNorm.get(norm(name));
  if (sp) usedSpire.add(sp);
  relics.push(buildRelic({ lsIndex: null, wikiEntry: wk, spireEntry: sp }));
}

// pass 3: spire relics absent from both (unused-in-game content, e.g. Discerning Monocle)
for (const sp of spire) {
  if (usedSpire.has(sp)) continue;
  missing.lightspeed.push(`${sp.name} (spire-only)`);
  const relic = buildRelic({ lsIndex: null, wikiEntry: undefined, spireEntry: sp });
  relic.unobtainable = true; // present in game files, never obtainable in-game
  relics.push(relic);
  needsManualVerification.push({
    id: relic.id,
    issue: "spire-archive only: raw game-internal string id unrecoverable from to_upper_snake form; gameId left null",
  });
}

// special-case obtainability notes (still counted among the 180 per the wiki)
for (const r of relics) {
  if (r.id === "CIRCLET") r.note = "fallback relic granted when the relevant relic pool is exhausted";
  if (r.id === "RED_CIRCLET") r.note = "Endless mode only";
}

// --- enforcement -----------------------------------------------------------------
let ok = true;
const fail = (msg: string) => { ok = false; console.error(`FAIL: ${msg}`); };

const obtainable = relics.filter((r) => !r.unobtainable);
console.log(`relics: ${relics.length} total, ${obtainable.length} obtainable (expect 180)`);
if (obtainable.length !== 180) fail(`obtainable count ${obtainable.length} != 180`);

const EXPECT_TIERS: Record<string, number> = {
  starter: 4, common: 36, uncommon: 36, rare: 34, boss: 30, shop: 20, event: 18, special: 2,
};
const tierTally: Record<string, number> = {};
for (const r of obtainable) tierTally[r.tier] = (tierTally[r.tier] ?? 0) + 1;
console.log("tier tally:", JSON.stringify(tierTally));
for (const [t, n] of Object.entries(EXPECT_TIERS))
  if (tierTally[t] !== n) fail(`tier ${t}: ${tierTally[t] ?? 0} != ${n}`);

const EXPECT_POOLS: Record<string, Record<string, number>> = {
  Ironclad: { common: 33, uncommon: 30, rare: 28, boss: 22, shop: 17 },
  Silent: { common: 33, uncommon: 30, rare: 28, boss: 22, shop: 17 },
  Defect: { common: 33, uncommon: 30, rare: 26, boss: 22, shop: 17 },
  Watcher: { common: 33, uncommon: 30, rare: 27, boss: 21, shop: 17 },
};
for (const cls of CLASSES)
  for (const tier of POOL_TIERS) {
    const got = classPools[cls]![tier]!.length;
    const declared = declaredSizes[cls]![tier]!;
    const expect = EXPECT_POOLS[cls]![tier]!;
    if (got !== declared) fail(`${cls}.${tier}: parsed ${got} != declared std::array size ${declared}`);
    if (got !== expect) fail(`${cls}.${tier}: ${got} != expected ${expect}`);
  }
console.log(
  "per-class pool sizes:",
  CLASSES.map((c) => `${c} ${POOL_TIERS.map((t) => classPools[c]![t]!.length).join("/")}`).join("  "),
);

// every pool member must resolve to a corpus relic
const byId = new Map(relics.map((r) => [r.id, r]));
for (const [id, pools] of inPools)
  if (!byId.has(id)) fail(`pool member ${id} (${pools.join(",")}) missing from corpus`);

console.log(`in wiki/spire but NOT in lightspeed enum (${missing.lightspeed.length}):`, missing.lightspeed.join(", ") || "none");
console.log(`lightspeed relics with no wiki entry (${missing.wiki.length}):`, missing.wiki.join(", ") || "none");
console.log(`lightspeed relics with no spire entry (${missing.spire.length}):`, missing.spire.join(", ") || "none");
console.log(`relics with numeric values: ${relics.filter((r) => r.values).length} (relic_values.json has ${valuesByNorm.size} non-test entries)`);
const unusedValues = [...valuesByNorm.keys()].filter(
  (k) => !relics.some((r) => (r.gameId && norm(r.gameId) === k) || norm(r.id) === k),
);
if (unusedValues.length) fail(`relic_values entries unmatched: ${unusedValues.join(", ")}`);
console.log(`conflicts: ${conflicts.length}`);
for (const c of conflicts) console.log("  ", JSON.stringify(c));

const adjudicated = Object.entries(ADJUDICATED_WHY).map(([k, why]) => {
  const [id, field, source] = k.split("|");
  return { id, field, source, resolution: why };
});
await Bun.write(
  `${ROOT}/references/extracted/relics-conflicts.json`,
  JSON.stringify({ conflicts, adjudicated, missing, needsManualVerification }, null, 1),
);
await Bun.write(`${ROOT}/data/corpus/relics.json`, JSON.stringify(relics, null, 1));
console.log(`${ok ? "ALL CHECKS PASSED — " : "CHECKS FAILED — "}wrote data/corpus/relics.json + references/extracted/relics-conflicts.json`);
if (!ok) process.exit(1);
