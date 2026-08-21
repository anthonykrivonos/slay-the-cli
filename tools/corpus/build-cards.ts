// Build data/corpus/cards.json by reconciling three independent sources:
//  1. sts_lightspeed extracted arrays (canonical IDs, rarity/type, base damage, keywords, pools)
//  2. spire-archive data/sts1/cards.json (envelope: cost, target, values, flags, upgrade deltas)
//  3. wiki.gg Module:Cards/data (370-count truth, color truth, rules text with [base|upgraded] markers)
// Any disagreement is recorded in references/extracted/cards-conflicts.json for manual adjudication.
//
// Color: the wiki wins. lightspeed's cardColors[] has a verified misordered window
// (BRILLIANCE/BRUTALITY/BUFFER/BULLET_TIME carry each other's colors), so it only cross-checks.

import { parseLuaModule, type LuaTable } from "./lua";

const ROOT = `${import.meta.dir}/../..`;
const ls = await Bun.file(`${ROOT}/references/extracted/lightspeed-cards.json`).json();
const spire: any[] = await Bun.file(`${ROOT}/references/spire-archive/data/sts1/cards.json`).json();
const wikiRaw = parseLuaModule(await Bun.file(`${ROOT}/references/wiki/Cards.lua`).text()) as Record<
  string,
  LuaTable
>;
delete wikiRaw["nodata_fallback"];

// --- canonicalizers ----------------------------------------------------------
const COLOR: Record<string, string> = {
  RED: "red", GREEN: "green", BLUE: "blue", PURPLE: "purple", COLORLESS: "colorless", CURSE: "curse",
  ironclad: "red", silent: "green", defect: "blue", watcher: "purple", colorless: "colorless", curse: "curse",
  Red: "red", Green: "green", Blue: "blue", Purple: "purple", Colorless: "colorless",
  Ironclad: "red", Silent: "green", Defect: "blue", Watcher: "purple",
};
const lc = (s: string | null | undefined) => (s == null ? null : String(s).toLowerCase());
// join-key normalization: uppercase, alphanumerics only ("J.A.X." == "J_A_X" == "JAX")
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

// --- index spire-archive by normalized id ------------------------------------
const spireByNorm = new Map<string, any>();
for (const c of spire) {
  spireByNorm.set(norm(c.id), c);
  spireByNorm.set(norm(c.name), c);
}
const findSpire = (enumId: string, gameId: string, name: string) =>
  spireByNorm.get(norm(enumId)) ?? spireByNorm.get(norm(gameId)) ?? spireByNorm.get(norm(name));

// --- index wiki by stripped name; class suffix disambiguates Strikes/Defends --
const wikiByName = new Map<string, { name: string; e: LuaTable; classColor: string | null }[]>();
for (const [name, e] of Object.entries(wikiRaw)) {
  const m = name.match(/^(.*) \((Ironclad|Silent|Defect|Watcher)\)$/);
  const stripped = (m ? m[1]! : name).toLowerCase();
  const entry = { name, e, classColor: m ? COLOR[m[2]!]! : null };
  wikiByName.set(stripped, [...(wikiByName.get(stripped) ?? []), entry]);
}
function findWiki(name: string, lsColor: string) {
  const list = wikiByName.get(name.toLowerCase());
  if (!list) return undefined;
  if (list.length === 1) return list[0];
  return list.find((x) => x.classColor === lsColor) ?? list[0];
}

const inSet = (arr: any): Set<string> => new Set((arr as any[]).flat(9) as string[]);
const classPool = inSet(ls.pools.rarity.blob);
const colorlessPool = inSet(ls.pools.colorless.blob);
const cursePool = inSet(ls.pools.curse);

const kwExpr = (table: Record<string, string>, id: string, upgraded: boolean): boolean => {
  const e = table[id];
  if (e === undefined) return false;
  if (e === "true") return true;
  if (e === "!upgraded") return !upgraded;
  if (e === "upgraded") return upgraded;
  return false;
};

const parseDelta = (base: number | null, v: unknown): number | null => {
  if (v == null) return base;
  if (typeof v === "number") return v;
  const s = String(v);
  if (/^[+-]\d+$/.test(s)) return (base ?? 0) + parseInt(s, 10);
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return base;
};

// Values for generated/token cards absent from spire-archive, from wiki rules text.
// (block/magic can't come from lightspeed, which only carries base damage.)
const MANUAL_VALUES: Record<string, { values?: any; upgrade?: any; unobtainable?: true }> = {
  SAFETY: { values: { block: 12 }, upgrade: { block: 16 } },
  INSIGHT: { values: { magic: 2 }, upgrade: { magic: 3 } },
  MIRACLE: { values: { magic: 1 }, upgrade: { magic: 2 } },
  OMEGA: { values: { magic: 50 }, upgrade: { magic: 60 } },
  JAX: { values: { magic: 2 }, upgrade: { magic: 3 } },
  APPARITION: { values: { magic: 1 }, upgrade: { magic: 1 } },
  BECOME_ALMIGHTY: { unobtainable: true, values: { magic: 3 }, upgrade: { magic: 3 } },
  FAME_AND_FORTUNE: { unobtainable: true, values: { magic: 25 }, upgrade: { magic: 25 } },
  LIVE_FOREVER: { unobtainable: true, values: { block: 8 }, upgrade: { block: 8 } },
};

// Cards with rules the envelope can't express; engine handles via bespoke effects.
const EXTRA_FLAGS: Record<string, string[]> = {
  SEARING_BLOW: ["multiUpgrade"], // can be upgraded any number of times; dmg = 12 + n(n+7)/2
};

// Known, explained discrepancies - suppressed from the report so new ones stand out.
// lightspeed's cardColors[] has two internally-misordered 4-card windows; wiki color verified correct.
const ADJUDICATED = new Set([
  "BRILLIANCE|color|lightspeed", "BRUTALITY|color|lightspeed", "BUFFER|color|lightspeed",
  "BULLET_TIME|color|lightspeed", "COLLECT|color|lightspeed", "COMBUST|color|lightspeed",
  "COMPILE_DRIVER|color|lightspeed", "CONCENTRATE|color|lightspeed",
  // Searing Blow upgrades repeatedly (+4 on first upgrade -> 16); spire-archive doesn't model it.
  "SEARING_BLOW|upgradedDamage|spire",
]);

// --- merge --------------------------------------------------------------------
const conflicts: any[] = [];
const missing = { spire: [] as string[], wiki: [] as string[] };
const cards: any[] = [];
const usedWiki = new Set<string>();

for (let i = 1; i < ls.enumStrings.length; i++) {
  const id = ls.enumStrings[i] as string;
  const name = ls.names[i] as string;
  const gameId = ls.stringIds[i] as string;
  const type = lc(ls.types[i])!;
  const lsColor = type === "curse" ? "curse" : COLOR[ls.colors[i] as string] ?? "?";
  const rarity = lc(ls.rarities[i])!;

  const sp = findSpire(id, gameId, name);
  if (!sp) missing.spire.push(id);

  const wk = findWiki(name, lsColor);
  if (!wk) missing.wiki.push(`${id} (${name} | ${lsColor})`);
  else usedWiki.add(wk.name);

  // color truth: wiki > spire > lightspeed
  const wikiColor =
    wk == null
      ? null
      : wk.e["Type"] === "Curse"
        ? "curse"
        : wk.classColor ?? COLOR[String(wk.e["Color"])] ?? null;
  const spColor = sp ? (type === "curse" ? "curse" : COLOR[sp.color]!) : null;
  const color = wikiColor ?? spColor ?? lsColor;

  const flag = (cond: boolean | undefined, name: string) => (cond ? [name] : []);
  // For base-variant keywords, lightspeed's switch tables are authoritative when
  // they list the card (they distinguish base vs upgraded: e.g. Alpha+ is innate,
  // Alpha is not). spire-archive's flat booleans describe EITHER variant, so they
  // only fill in when lightspeed has no entry.
  const baseKw = (table: Record<string, string>, spFlag: boolean | undefined) =>
    id in table ? kwExpr(table, id, false) : Boolean(spFlag);
  const baseFlags = [
    ...flag(baseKw(ls.keywords.exhaust, sp?.exhaust), "exhaust"),
    ...flag(baseKw(ls.keywords.ethereal, sp?.ethereal), "ethereal"),
    ...flag(baseKw(ls.keywords.innate, sp?.innate), "innate"),
    ...flag(sp?.retain, "retain"),
    ...flag(baseKw(ls.keywords.selfRetain, sp?.self_retain), "selfRetain"),
    ...flag(sp?.purge_on_use, "purgeOnUse"),
    ...flag(kwExpr(ls.keywords.strikeCard, id, false), "strike"),
    ...((sp?.tags ?? []) as string[]).map((t: string) => "tag:" + t.toLowerCase()),
    ...(EXTRA_FLAGS[id] ?? []),
  ];
  const upFlags = [
    ...flag(kwExpr(ls.keywords.exhaust, id, true), "exhaust"),
    ...flag(kwExpr(ls.keywords.ethereal, id, true), "ethereal"),
    ...flag(kwExpr(ls.keywords.innate, id, true), "innate"),
    ...flag(kwExpr(ls.keywords.selfRetain, id, true), "selfRetain"),
    ...flag(kwExpr(ls.keywords.strikeCard, id, false), "strike"),
  ];

  const lsDmg = ls.baseDamage[0][i] === -1 ? null : ls.baseDamage[0][i];
  const lsDmgUp = ls.baseDamage[1][i] === -1 ? null : ls.baseDamage[1][i];
  const manual = MANUAL_VALUES[id];

  const cost = sp ? sp.cost : ((wk?.e["Cost"] as number | undefined) ?? -2);
  const damage = sp?.damage ?? manual?.values?.damage ?? lsDmg;
  const upDamage = sp ? parseDelta(sp.damage, sp.upgrade?.damage) : (manual?.upgrade?.damage ?? lsDmgUp);

  const card = {
    id,
    name,
    gameId,
    color,
    type,
    rarity,
    cost: kwExpr(ls.keywords.xCost, id, false) ? -1 : cost,
    target: sp ? lc(sp.target) : ls.targets[i] ? "enemy" : "self",
    values: {
      damage,
      block: sp?.block ?? manual?.values?.block ?? null,
      magic: sp?.magic_number ?? manual?.values?.magic ?? null,
      hits: sp?.hit_count ?? null,
    },
    flags: baseFlags,
    upgrade: {
      cost: sp ? parseDelta(sp.cost, sp.upgrade?.cost) : cost,
      damage: upDamage,
      block: sp ? parseDelta(sp.block, sp.upgrade?.block) : (manual?.upgrade?.block ?? null),
      magic: sp ? parseDelta(sp.magic_number, sp.upgrade?.magic_number) : (manual?.upgrade?.magic ?? null),
      hits: sp ? parseDelta(sp.hit_count, sp.upgrade?.hit_count) : null,
      flags: upFlags,
    },
    pool: classPool.has(id)
      ? "class"
      : colorlessPool.has(id)
        ? "colorless"
        : cursePool.has(id)
          ? "curse"
          : rarity === "basic"
            ? "basic"
            : "special",
    text: (wk?.e["Text"] as string) ?? null,
    noUpgrade: wk?.e["NoUpgrade"] === true || undefined,
    unobtainable: manual?.unobtainable,
  };
  cards.push(card);

  // --- cross-checks ---
  const clash = (field: string, corpus: unknown, other: unknown, src: string) => {
    if (corpus != null && other != null && String(corpus) !== String(other) && !ADJUDICATED.has(`${id}|${field}|${src}`))
      conflicts.push({ id, field, corpus, [src]: other });
  };
  clash("color", color, lsColor, "lightspeed");
  if (sp) {
    clash("color", color, spColor, "spire");
    clash("rarity", rarity, lc(sp.rarity), "spire");
    clash("type", type, lc(sp.type), "spire");
    clash("damage", lsDmg, sp.damage, "spire");
    clash("upgradedDamage", lsDmgUp, upDamage, "spire");
  }
  if (wk) {
    clash("cost", card.cost === -1 ? "X" : card.cost, wk.e["Cost"] === -1 ? "X" : wk.e["Cost"], "wiki");
    const wRar = wk.e["Rarity"] === "Curse" ? "special" : lc(wk.e["Rarity"] as string);
    if (type !== "curse" && type !== "status") clash("rarity", rarity, wRar, "wiki");
  }
}

const unusedWiki = Object.keys(wikiRaw).filter((n) => !usedWiki.has(n));

console.log(`cards: ${cards.length} (expect 370)`);
console.log(`missing from spire-archive (${missing.spire.length}):`, missing.spire.join(", "));
console.log(`no wiki match (${missing.wiki.length}):`, missing.wiki.join("; "));
console.log(`wiki entries unmatched (${unusedWiki.length}):`, unusedWiki.join("; "));
console.log(`conflicts: ${conflicts.length}`);

const tally: Record<string, number> = {};
for (const c of cards) {
  const key = c.type === "status" ? "status" : c.color;
  tally[key] = (tally[key] ?? 0) + 1;
}
console.log("distribution:", JSON.stringify(tally), "(expect red/green/blue/purple 75 each, colorless 51, curse 14, status 5)");

await Bun.write(
  `${ROOT}/references/extracted/cards-conflicts.json`,
  JSON.stringify({ conflicts, missing, unusedWiki }, null, 1),
);
await Bun.write(`${ROOT}/data/corpus/cards.json`, JSON.stringify(cards, null, 1));
console.log("wrote data/corpus/cards.json + references/extracted/cards-conflicts.json");
