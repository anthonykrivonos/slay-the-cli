// Build data/corpus/potions.json by reconciling three independent sources:
//  1. sts_lightspeed Potions.h (canonical enum ids, game ids, rarity table,
//     per-class 33-entry selectable pools, requires-target switch)
//  2. spire-archive data/sts1/potions.json (names, rarity, thrown/target cross-check)
//  3. wiki.gg Module:Potions/data (rules text with <base:sacredBark> markers,
//     Character field for the 12 class potions)
// Potency is fixed per potion (no ascension scaling); base values are a manual
// table cross-checked against the wiki base-side text. Sacred Bark doubling is
// derived from the wiki's <a:b> markers (absent on the 7 unaffected potions).
// Disagreements land in references/extracted/potions-conflicts.json.

import { parseLuaModule, type LuaTable } from "./lua";

const ROOT = `${import.meta.dir}/../..`;
const header = await Bun.file(`${ROOT}/references/sts_lightspeed/include/constants/Potions.h`).text();
const spire: any[] = await Bun.file(`${ROOT}/references/spire-archive/data/sts1/potions.json`).json();
// lua.ts locates the first `= {` table literal; Potions.lua uses `return {`.
const luaSrc = (await Bun.file(`${ROOT}/references/wiki/Potions.lua`).text()).replace(/^\s*return\s*\{/, "local d = {");
const wiki = parseLuaModule(luaSrc) as Record<string, LuaTable>;

// --- parse Potions.h ----------------------------------------------------------
const strArray = (name: string): string[] => {
  const m = header.match(new RegExp(`${name}\\[\\]\\s*(?:=\\s*)?\\{([\\s\\S]*?)\\};`));
  if (!m) throw new Error(`array ${name} not found`);
  return [...m[1]!.matchAll(/"([^"]*)"/g)].map((x) => x[1]!);
};
const enumIds = strArray("potionEnumNames"); // 44 incl INVALID, EMPTY_POTION_SLOT
const names = strArray("potionNames");
const gameIds = strArray("potionIds");

const rarBlock = header.match(/potionRarities\[\]\s*=\s*\{([\s\S]*?)\};/)![1]!;
const rarities = [...rarBlock.matchAll(/PotionRarity::(\w+)/g)].map((m) => m[1]!.toLowerCase());

const poolBlock = header.match(/potionPool\[4\]\[33\]\s*\{([\s\S]*?)\};/)![1]!;
const poolRows = [...poolBlock.matchAll(/\{([^{}]*)\}/g)].map((m) =>
  [...m[1]!.matchAll(/Potion::(\w+)/g)].map((x) => x[1]!),
);
const targetBlock = header.match(/potionRequiresTarget[\s\S]*?switch[\s\S]*?\{([\s\S]*?)return true/)![1]!;
const targeted = new Set([...targetBlock.matchAll(/Potion::(\w+)/g)].map((m) => m[1]!));

if (enumIds.length !== 44 || names.length !== 44 || gameIds.length !== 44 || rarities.length !== 44)
  throw new Error(`bad header parse: ${enumIds.length}/${names.length}/${gameIds.length}/${rarities.length}`);

// --- fixed game data ----------------------------------------------------------
// Base potency per potion (AbstractPotion.getPotency() at V2.3.4). null = no
// numeric potency. Percent-based: BLOOD_POTION (% max HP healed), FAIRY_POTION
// (% max HP revived to).
const POTENCY: Record<string, number | null> = {
  AMBROSIA: null, ANCIENT_POTION: 1, ATTACK_POTION: 1, BLESSING_OF_THE_FORGE: null,
  BLOCK_POTION: 12, BLOOD_POTION: 20, BOTTLED_MIRACLE: 2, COLORLESS_POTION: 1,
  CULTIST_POTION: 1, CUNNING_POTION: 3, DEXTERITY_POTION: 2, DISTILLED_CHAOS: 3,
  DUPLICATION_POTION: 1, ELIXIR_POTION: null, ENERGY_POTION: 2, ENTROPIC_BREW: null,
  ESSENCE_OF_DARKNESS: 1, ESSENCE_OF_STEEL: 4, EXPLOSIVE_POTION: 10, FAIRY_POTION: 30,
  FEAR_POTION: 3, FIRE_POTION: 20, FLEX_POTION: 5, FOCUS_POTION: 2, FRUIT_JUICE: 5,
  GAMBLERS_BREW: null, GHOST_IN_A_JAR: 1, HEART_OF_IRON: 6, LIQUID_BRONZE: 3,
  LIQUID_MEMORIES: 1, POISON_POTION: 6, POTION_OF_CAPACITY: 2, POWER_POTION: 1,
  REGEN_POTION: 5, SKILL_POTION: 1, SMOKE_BOMB: null, SNECKO_OIL: 5, SPEED_POTION: 5,
  STANCE_POTION: null, STRENGTH_POTION: 2, SWIFT_POTION: 3, WEAK_POTION: 3,
};

const CLASS_COLOR: Record<string, string> = { Ironclad: "red", Silent: "green", Defect: "blue", Watcher: "purple" };
const POOL_COLOR = ["red", "green", "blue", "purple"]; // CharacterClass order: IRONCLAD, SILENT, DEFECT, WATCHER

// Known, explained discrepancies - suppressed so new ones stand out.
const ADJUDICATED = new Set([
  // thrown at enemies but no single-target selection (hits ALL / whole combat);
  // lightspeed potionRequiresTarget correctly excludes them.
  "EXPLOSIVE_POTION|targeted|spire",
  "SMOKE_BOMB|targeted|spire",
  // the only number on the wiki base side is the "costs 0" rider; potency is 1 card returned.
  "LIQUID_MEMORIES|potency.base|wiki",
  // spire-archive title-cases "Of"; in-game strings use lowercase "of" (wiki matches game).
  "ESSENCE_OF_DARKNESS|name|spire",
  "POTION_OF_CAPACITY|name|spire",
]);

// --- helpers -------------------------------------------------------------------
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const cleanWiki = (s: string) =>
  s
    .replace(/\{\{[^{}|]*\|(?:[^{}|]*\|)*([^{}|]*)\}\}/g, "$1") // {{T|a|b}} -> b
    .replace(/\{\{([^{}|]*)\}\}/g, "$1")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/'''/g, "")
    .replace(/<([^<>:]*):([^<>]*)>/g, "[$1|$2]") // <base:sacredBark> -> [base|sacredBark]
    .trim();

const spireByNorm = new Map<string, any>();
for (const p of spire) {
  spireByNorm.set(norm(p.id), p);
  spireByNorm.set(norm(p.name), p);
}
const wikiByNorm = new Map(Object.entries(wiki).map(([n, e]) => [norm(n), { name: n, e }]));
// name aliases: enum/display name -> wiki page name
const WIKI_ALIAS: Record<string, string> = {
  ELIXIRPOTION: "ELIXIR",
  FAIRYPOTION: "FAIRYINABOTTLE",
};

// --- merge ----------------------------------------------------------------------
const conflicts: any[] = [];
const clash = (id: string, field: string, corpus: unknown, other: unknown, src: string) => {
  if (corpus != null && other != null && String(corpus) !== String(other) && !ADJUDICATED.has(`${id}|${field}|${src}`))
    conflicts.push({ id, field, corpus, [src]: other });
};

const potions: any[] = [];
const usedWiki = new Set<string>();
const usedSpire = new Set<string>();

for (let i = 2; i < enumIds.length; i++) {
  const id = enumIds[i]!;
  const lsName = names[i]!; // lightspeed title-cases every word ("Heart Of Iron"); join key only
  const gameId = gameIds[i]!;
  const rarity = rarities[i]!;

  const inClassPool = POOL_COLOR.filter((_, row) => poolRows[row]!.includes(id));
  const cls = inClassPool.length === 4 ? "shared" : inClassPool.length === 1 ? inClassPool[0]! : "?";

  const wk = wikiByNorm.get(WIKI_ALIAS[norm(id)] ?? norm(lsName)) ?? wikiByNorm.get(norm(id));
  const sp = spireByNorm.get(norm(id)) ?? spireByNorm.get(norm(gameId)) ?? spireByNorm.get(norm(lsName));
  if (wk) usedWiki.add(wk.name);
  if (sp) usedSpire.add(sp.id);
  if (!wk) conflicts.push({ id, field: "missing", wiki: true });
  if (!sp) conflicts.push({ id, field: "missing", spire: true });

  const rawWikiText = (wk?.e["Text"] as string) ?? null;
  const sacredBarkDoubles = rawWikiText != null && /<[^<>:]*:[^<>]*>/.test(rawWikiText);
  const base = POTENCY[id];
  if (base === undefined) throw new Error(`no potency entry for ${id}`);

  // display name: in-game capitalization comes from the wiki (then spire), not lightspeed
  const name = wk?.name ?? sp?.name ?? lsName;

  potions.push({
    id,
    name,
    gameId,
    rarity,
    class: cls,
    targeted: targeted.has(id),
    potency: { base, sacredBarkDoubles },
    inClassPool,
    text: rawWikiText ? cleanWiki(rawWikiText) : (sp?.description ?? null),
    sources: {
      lightspeed: `Potions.h:${id}`,
      spire: sp?.id ?? null,
      wiki: wk?.name ?? null,
    },
  });

  // --- cross-checks ---
  if (sp) {
    clash(id, "rarity", rarity, String(sp.rarity).toLowerCase(), "spire");
    clash(id, "targeted", targeted.has(id), sp.target === "Enemy", "spire");
    clash(id, "name", name, sp.name, "spire");
  }
  if (wk) {
    clash(id, "rarity", rarity, String(wk.e["Rarity"]).toLowerCase(), "wiki");
    const wikiClass = wk.e["Character"] ? CLASS_COLOR[String(wk.e["Character"])]! : "shared";
    clash(id, "class", cls, wikiClass, "wiki");
    // potency must appear among the numbers on the base side of the wiki text
    // (when it states any; Duplication/card-pick bases are prose)
    if (base != null) {
      const baseSide = rawWikiText!.replace(/<([^<>:]*):[^<>]*>/g, "$1");
      const nums = [...baseSide.matchAll(/\d+/g)].map((m) => Number(m[0]));
      if (nums.length && !nums.includes(base)) clash(id, "potency.base", base, nums.join(","), "wiki");
    }
  }
}

// --- enforce counts ------------------------------------------------------------
const fail: string[] = [];
if (potions.length !== 42) fail.push(`potion count ${potions.length} != 42`);
const rarityTally: Record<string, number> = {};
for (const p of potions) rarityTally[p.rarity] = (rarityTally[p.rarity] ?? 0) + 1;
if (rarityTally.common !== 20 || rarityTally.uncommon !== 12 || rarityTally.rare !== 10)
  fail.push(`rarity split ${JSON.stringify(rarityTally)} != {common:20, uncommon:12, rare:10}`);
for (let row = 0; row < 4; row++) {
  if (poolRows[row]!.length !== 33) fail.push(`pool row ${row} has ${poolRows[row]!.length} entries != 33`);
  // round-trip: reconstruct the row's membership from the corpus and compare as sets
  const fromCorpus = new Set(potions.filter((p) => p.inClassPool.includes(POOL_COLOR[row]!)).map((p) => p.id));
  const fromHeader = new Set(poolRows[row]!);
  if (fromCorpus.size !== fromHeader.size || [...fromHeader].some((x) => !fromCorpus.has(x)))
    fail.push(`pool row ${row} corpus membership does not match Potions.h`);
}
const classTally: Record<string, number> = {};
for (const p of potions) classTally[p.class] = (classTally[p.class] ?? 0) + 1;
for (const [k, v] of Object.entries({ shared: 30, red: 3, green: 3, blue: 3, purple: 3 }))
  if (classTally[k] !== v) fail.push(`class split ${JSON.stringify(classTally)} unexpected (want ${k}=${v})`);

const unusedWiki = Object.keys(wiki).filter((n) => !usedWiki.has(n));
const unusedSpire = spire.filter((p) => !usedSpire.has(p.id)).map((p) => p.id);

console.log(`potions: ${potions.length} (expect 42)`);
console.log(`rarity:`, JSON.stringify(rarityTally), `class:`, JSON.stringify(classTally));
console.log(`per-class pools: ${poolRows.map((r) => r.length).join("/")} (expect 33 each)`);
console.log(`sacredBarkDoubles=false:`, potions.filter((p) => !p.potency.sacredBarkDoubles).map((p) => p.id).join(", "));
console.log(`wiki entries unmatched (${unusedWiki.length}):`, unusedWiki.join(", "));
console.log(`spire entries unmatched (${unusedSpire.length}):`, unusedSpire.join(", "));
console.log(`conflicts: ${conflicts.length}`);
if (fail.length) {
  console.error("COUNT ENFORCEMENT FAILED:\n - " + fail.join("\n - "));
  process.exit(1);
}

await Bun.write(
  `${ROOT}/references/extracted/potions-conflicts.json`,
  JSON.stringify({ conflicts, unusedWiki, unusedSpire }, null, 1),
);
await Bun.write(`${ROOT}/data/corpus/potions.json`, JSON.stringify(potions, null, 1));
console.log("wrote data/corpus/potions.json + references/extracted/potions-conflicts.json");
