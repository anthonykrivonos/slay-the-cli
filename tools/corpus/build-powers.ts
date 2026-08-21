// Build data/corpus/powers.json - every power/status effect (player + monster) -
// by reconciling three independent sources:
//  1. sts_lightspeed PlayerStatusEffects.h + MonsterStatusEffects.h
//     (canonical enum ids, owner = which enum(s) a power appears in)
//  2. spire-archive data/sts1/powers.json (146 game power records: type, text)
//  3. wiki.gg Module:Powers/data (131 records: Type buff/debuff, Stacks, rules text)
// Join is by normalized display name plus an alias table (the sources name a few
// powers differently: "Draw Card" vs "Draw Card Next Turn", "Weakened" vs "Weak",
// "Simmering Rage" vs "Wrath Next Turn", ...).
//
// Field semantics:
//  kind      buff|debuff - wiki first (spire fallback), with 2-of-3-majority
//            adjudications where the wiki is wrong (see ADJUDICATED_KIND)
//  stacking  how amounts combine: "intensity" (amounts add - includes the wiki's
//            "Counter" powers, whose counts add), "duration" (turns add), "none"
//  turnBased true when the amount ticks down at end of round (wiki Stacks
//            contains "Duration", plus DRAW_REDUCTION which the game marks
//            turn-based but the wiki lists as Intensity)
//  owner     player|monster|both from lightspeed enum membership; manual table
//            for the powers lightspeed does not model
// Disagreements land in references/extracted/powers-conflicts.json.

import { parseLuaModule, type LuaTable } from "./lua";

const ROOT = `${import.meta.dir}/../..`;
const playerH = await Bun.file(`${ROOT}/references/sts_lightspeed/include/constants/PlayerStatusEffects.h`).text();
const monsterH = await Bun.file(`${ROOT}/references/sts_lightspeed/include/constants/MonsterStatusEffects.h`).text();
const spire: any[] = await Bun.file(`${ROOT}/references/spire-archive/data/sts1/powers.json`).json();
const wikiRaw = parseLuaModule(await Bun.file(`${ROOT}/references/wiki/Powers.lua`).text()) as Record<string, LuaTable>;

// --- parse lightspeed headers ---------------------------------------------------
// Enum ids come from the enum declarations themselves (the monster
// monsterStatusEnumStrings[] array is internally misordered - REACTIVE sits in
// the wrong place - so it is not used). Display names come from the
// playerStatusStrings/enemyStatusStrings arrays, which do align with the enums.
const parseEnum = (src: string, name: string): string[] => {
  const m = src.match(new RegExp(`enum class ${name}\\s*:[^{]*\\{([\\s\\S]*?)\\};`));
  if (!m) throw new Error(`enum ${name} not found`);
  const body = m[1]!.replace(/\/\/[^\n]*/g, "");
  return [...body.matchAll(/\b([A-Z][A-Z0-9_]*)\b/g)].map((x) => x[1]!);
};
const parseStrings = (src: string, name: string): string[] => {
  const m = src.match(new RegExp(`${name}\\[\\]\\s*(?:=\\s*)?\\{([\\s\\S]*?)\\};`));
  if (!m) throw new Error(`array ${name} not found`);
  return [...m[1]!.matchAll(/"([^"]*)"/g)].map((x) => x[1]!);
};

const playerEnum = parseEnum(playerH, "PlayerStatus");
const playerNames = parseStrings(playerH, "playerStatusStrings");
const monsterEnum = parseEnum(monsterH, "MonsterStatus");
const monsterNames = parseStrings(monsterH, "enemyStatusStrings");
if (playerEnum.length !== playerNames.length) throw new Error(`player enum/name mismatch ${playerEnum.length}/${playerNames.length}`);
if (monsterEnum.length !== monsterNames.length) throw new Error(`monster enum/name mismatch ${monsterEnum.length}/${monsterNames.length}`);

// lightspeed's own buff/debuff grouping for player statuses (from the header's
// section comments; JustApplied section split by semantics). Cross-check only.
const LS_PLAYER_DEBUFFS = new Set([
  "DRAW_REDUCTION", "FRAIL", "VULNERABLE", "WEAK",
  "BIAS", "CONFUSED", "CONSTRICTED", "ENTANGLED", "FASTING", "HEX",
  "LOSE_DEXTERITY", "LOSE_STRENGTH", "NO_BLOCK", "NO_DRAW", "WRAITH_FORM",
]);

// --- canonical keys --------------------------------------------------------------
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
// variant display name -> canonical key
const ALIAS: Record<string, string> = {
  DRAWCARD: "DRAWCARDNEXTTURN",   // spire/wiki "Draw Card" = ls DRAW_CARD_NEXT_TURN
  WEAKENED: "WEAK",               // spire
  CONFUSION: "CONFUSED",          // spire
  FLYING: "FLIGHT",               // wiki
  HELLO: "HELLOWORLD",            // spire/wiki "Hello" = ls HELLO_WORLD (card Hello World)
  STRENGTHDOWN: "LOSESTRENGTH",   // spire FLEX / wiki
  DEXTERITYDOWN: "LOSEDEXTERITY", // spire DEXLOSS / wiki
  SIMMERINGRAGE: "WRATHNEXTTURN", // spire WRATHNEXTTURNPOWER / wiki
  STRENGTHUP: "GENERICSTRENGTHUP",// spire GENERIC_STRENGTH_UP_POWER / wiki
  ENERGIZEDSILENT: "ENERGIZED",   // wiki disambiguation suffixes
  ENERGIZEDDEFECT: "ENERGIZED",
  REGROW: "LIFELINK",             // ls models Darkling Life Link as the REGROW boolean
};
// corpus id when the lightspeed enum name is not the right public id
const ID_OVERRIDE: Record<string, string> = { LIFELINK: "LIFE_LINK" };
const key = (displayName: string) => {
  const n = norm(displayName);
  return ALIAS[n] ?? n;
};
const toSnake = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

// --- fixed adjudications / manual data -------------------------------------------
// kind overrides where the wiki's Type field is wrong; resolved by 2-of-3 majority
// (spire + lightspeed grouping) or by what the power does to its target.
const ADJUDICATED_KIND: Record<string, string> = {
  CHOKED: "debuff",          // applied to an enemy, loses HP per card played (wiki says Buff)
  BLOCKRETURN: "debuff",     // applied to an enemy; spire agrees debuff (wiki says Buff)
  CORPSEEXPLOSION: "debuff", // applied to an enemy; spire agrees debuff (wiki says Buff)
  NOBLOCK: "debuff",         // ls + spire agree debuff (wiki says Buff)
  FASTING: "debuff",         // ls + spire agree debuff (wiki says Buff) - verify vs game code
};
// the game marks Draw Reduction turn-based; the wiki lists it as Intensity
const TURN_BASED_EXTRA = new Set(["DRAWREDUCTION"]);
// kind for lightspeed-only implementation statuses (no wiki/spire record)
const MANUAL_KIND: Record<string, string> = { ASLEEP: "buff", MINIONLEADER: "buff" };
// stacking overrides where the fallback spire flag is wrong
const ADJUDICATED_STACKING: Record<string, string> = {
  // two Duplication Potions -> "your next 2 cards are played twice"; amounts add
  DUPLICATION: "intensity",
};

// owner for powers lightspeed does not model (key -> owner)
const MANUAL_OWNER: Record<string, string> = {
  // real card powers missing from lightspeed's enums
  RUSHDOWN: "player", MENTALFORTRESS: "player", NIRVANA: "player", STUDY: "player",
  NIGHTMARE: "player", BERSERK: "player", REPAIR: "player", RETAINCARDS: "player",
  STORM: "player", HEATSINK: "player", VAULT: "player",
  // real monster powers missing from lightspeed's enums
  BACKATTACK: "monster", EXPLOSIVE: "monster", LIFELINK: "monster",
  REGENERATE: "monster", SPLIT: "monster", UNAWAKENED: "monster",
  // unused/beta powers present in game code (owner inferred from rules text)
  ATTACKBURN: "player", SKILLBURN: "player", NOSKILLS: "player", CONSERVE: "player",
  LIGHTNINGMASTERY: "player", CANNOTCHANGESTANCE: "player", DRAW: "player",
  LIVEFOREVER: "player", RECHARGINGCORE: "player", STRIKEUP: "player", WINTER: "player",
  NULLIFYATTACK: "monster", GROWTH: "monster", TIMEMAZE: "monster",
};
const UNUSED_NOTE = "unused/beta power in V2.3.4 game code; no obtainable source";
const NOTES: Record<string, string> = {
  ENERGIZED: "two game power ids (Energized, EnergizedBlue) with identical behavior; merged",
  LIFELINK: "sts_lightspeed models this as the REGROW boolean status on Darklings",
  INTANGIBLE: "player variant (IntangiblePlayerPower) decrements at end of the player's turn; monster variant at end of its owner's turn",
  ASLEEP: "sts_lightspeed implementation status for Lagavulin's sleep, not a game power id",
  MINIONLEADER: "sts_lightspeed implementation status marking the leader whose death removes minions, not a game power id",
  VAULT: "internal helper power for the Vault card's extra turn",
  ATTACKBURN: UNUSED_NOTE, SKILLBURN: UNUSED_NOTE, NOSKILLS: UNUSED_NOTE,
  NULLIFYATTACK: UNUSED_NOTE, STRIKEUP: UNUSED_NOTE, WINTER: UNUSED_NOTE,
  CONSERVE: UNUSED_NOTE, GROWTH: UNUSED_NOTE, TIMEMAZE: UNUSED_NOTE,
  RECHARGINGCORE: UNUSED_NOTE, LIGHTNINGMASTERY: UNUSED_NOTE,
  CANNOTCHANGESTANCE: UNUSED_NOTE, DRAW: UNUSED_NOTE,
  LIVEFOREVER: "unused/beta power (the Live Forever wish card grants Plated Armor directly)",
};
// manual rules text for lightspeed-only implementation statuses
const MANUAL_TEXT: Record<string, string> = {
  ASLEEP: "Does not act; wakes (gaining Metallicize) when it loses HP or after 3 turns.",
  MINIONLEADER: "When this creature dies, its minions abandon combat.",
};

// --- collect per-key ---------------------------------------------------------------
interface Entry {
  key: string;
  lsPlayer?: string;
  lsMonster?: string;
  lsName?: string;
  spire: any[];
  wiki: { name: string; e: LuaTable }[];
}
const entries = new Map<string, Entry>();
const get = (k: string): Entry => {
  let e = entries.get(k);
  if (!e) entries.set(k, (e = { key: k, spire: [], wiki: [] }));
  return e;
};

for (let i = 0; i < playerEnum.length; i++) {
  if (playerEnum[i] === "INVALID") continue;
  const e = get(key(playerNames[i]!));
  e.lsPlayer = playerEnum[i]!;
  e.lsName = playerNames[i]!;
}
for (let i = 0; i < monsterEnum.length; i++) {
  if (monsterEnum[i] === "INVALID") continue;
  const e = get(key(monsterNames[i]!));
  e.lsMonster = monsterEnum[i]!;
  e.lsName ??= monsterNames[i]!;
}
for (const s of spire) get(key(s.name)).spire.push(s);
for (const [name, w] of Object.entries(wikiRaw)) {
  const stripped = name.replace(/ \((Silent|Defect|Ironclad|Watcher)\)$/, "");
  get(key(stripped)).wiki.push({ name, e: w });
}

// --- merge -------------------------------------------------------------------------
const cleanWiki = (s: string) =>
  s
    .replace(/\{\{[^{}|]*\|(?:[^{}|]*\|)*([^{}|]*)\}\}/g, "$1")
    .replace(/\{\{([^{}|]*)\}\}/g, "$1")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/'''/g, "")
    .replace(/@[A-Z]{1,2}\s*/g, "") // energy-icon markers (@GE, @PE, @RE, @BE)
    .trim();
// spire descriptions carry "X<default>" markers ("Deals X50% more damage");
// keep the concrete default value.
const cleanSpire = (s: string) => s.replace(/X(\d+)/g, "$1").trim();

const conflicts: any[] = [];
const powers: any[] = [];

for (const e of [...entries.values()].sort((a, b) => a.key.localeCompare(b.key))) {
  const wk = e.wiki[0];
  const sp = e.spire[0];
  const displayName =
    wk?.name.replace(/ \((Silent|Defect|Ironclad|Watcher)\)$/, "") ?? sp?.name ?? e.lsName!;
  const id = ID_OVERRIDE[e.key] ?? e.lsPlayer ?? e.lsMonster ?? toSnake(displayName);

  // --- owner ---
  let owner: string;
  if (e.lsPlayer && e.lsMonster) owner = "both";
  else if (e.lsPlayer) owner = "player";
  else if (e.lsMonster) owner = "monster";
  else {
    owner = MANUAL_OWNER[e.key]!;
    if (!owner) throw new Error(`no owner for ${e.key} (${displayName})`);
  }

  // --- kind ---
  const wikiKind = wk ? String(wk.e["Type"]).toLowerCase().replace(/s$/, "") : null;
  const spireKinds = [...new Set(e.spire.map((s: any) => String(s.type).toLowerCase()))];
  const lsKind = e.lsPlayer ? (LS_PLAYER_DEBUFFS.has(e.lsPlayer) ? "debuff" : "buff") : null;
  const kind = ADJUDICATED_KIND[e.key] ?? wikiKind ?? spireKinds[0] ?? MANUAL_KIND[e.key];
  if (!kind) throw new Error(`no kind for ${e.key} (${displayName})`);
  for (const sk of spireKinds)
    if (sk !== kind) conflicts.push({ id, field: "kind", corpus: kind, spire: sk, ...(ADJUDICATED_KIND[e.key] ? { resolution: "adjudicated" } : {}) });
  if (wikiKind && wikiKind !== kind)
    conflicts.push({ id, field: "kind", corpus: kind, wiki: wikiKind, resolution: "adjudicated: see ADJUDICATED_KIND" });
  if (lsKind && lsKind !== kind)
    conflicts.push({ id, field: "kind", corpus: kind, lightspeed: `${lsKind} (header section)` });

  // --- stacking + turnBased ---
  const wikiStacks = wk ? String(wk.e["Stacks"]) : null;
  let stacking: string;
  if (ADJUDICATED_STACKING[e.key]) {
    stacking = ADJUDICATED_STACKING[e.key]!;
    conflicts.push({ id, field: "stacking", corpus: stacking, resolution: "adjudicated: see ADJUDICATED_STACKING" });
  } else if (wikiStacks) {
    stacking = /Intensity|Counter/.test(wikiStacks) ? "intensity" : /Duration/.test(wikiStacks) ? "duration" : "none";
  } else if (sp) {
    stacking = sp.stackable ? "intensity" : "none";
    conflicts.push({ id, field: "stacking", corpus: stacking, note: "no wiki entry; from spire stackable flag" });
  } else {
    stacking = "none";
  }
  const turnBased = (wikiStacks ? /Duration/.test(wikiStacks) : false) || TURN_BASED_EXTRA.has(e.key);

  // --- text ---
  const text =
    MANUAL_TEXT[e.key] ??
    (wk?.e["Text"] ? cleanWiki(String(wk.e["Text"])) : sp?.description ? cleanSpire(sp.description) : null);

  powers.push({
    id,
    name: displayName,
    kind,
    stacking,
    turnBased,
    owner,
    text,
    ...(NOTES[e.key] ? { notes: NOTES[e.key] } : {}),
    sources: {
      lightspeed: [
        ...(e.lsPlayer ? [`player:${e.lsPlayer}`] : []),
        ...(e.lsMonster ? [`monster:${e.lsMonster}`] : []),
      ],
      spire: e.spire.map((s: any) => s.id),
      wiki: e.wiki.map((w) => w.name),
    },
  });
}

// --- enforcement / report ------------------------------------------------------------
const fail: string[] = [];
const consumed = {
  lsPlayer: powers.reduce((n, p) => n + p.sources.lightspeed.filter((x: string) => x.startsWith("player:")).length, 0),
  lsMonster: powers.reduce((n, p) => n + p.sources.lightspeed.filter((x: string) => x.startsWith("monster:")).length, 0),
  spire: powers.reduce((n, p) => n + p.sources.spire.length, 0),
  wiki: powers.reduce((n, p) => n + p.sources.wiki.length, 0),
};
if (consumed.lsPlayer !== playerEnum.length - 1) fail.push(`lightspeed player statuses consumed ${consumed.lsPlayer}/${playerEnum.length - 1}`);
if (consumed.lsMonster !== monsterEnum.length - 1) fail.push(`lightspeed monster statuses consumed ${consumed.lsMonster}/${monsterEnum.length - 1}`);
if (consumed.spire !== spire.length) fail.push(`spire powers consumed ${consumed.spire}/${spire.length}`);
if (consumed.wiki !== Object.keys(wikiRaw).length) fail.push(`wiki powers consumed ${consumed.wiki}/${Object.keys(wikiRaw).length}`);

const missing = {
  spire: powers.filter((p) => p.sources.spire.length === 0).map((p) => p.id),
  wiki: powers.filter((p) => p.sources.wiki.length === 0).map((p) => p.id),
  lightspeed: powers.filter((p) => p.sources.lightspeed.length === 0).map((p) => p.id),
};
const tally = (f: (p: any) => string) =>
  powers.reduce((t: Record<string, number>, p) => ((t[f(p)] = (t[f(p)] ?? 0) + 1), t), {});

console.log(`powers: ${powers.length}`);
console.log(`consumed: ls player ${consumed.lsPlayer}/${playerEnum.length - 1}, ls monster ${consumed.lsMonster}/${monsterEnum.length - 1}, spire ${consumed.spire}/${spire.length}, wiki ${consumed.wiki}/${Object.keys(wikiRaw).length}`);
console.log(`owner:`, JSON.stringify(tally((p) => p.owner)), `kind:`, JSON.stringify(tally((p) => p.kind)), `stacking:`, JSON.stringify(tally((p) => p.stacking)), `turnBased:`, JSON.stringify(tally((p) => String(p.turnBased))));
console.log(`no spire record (${missing.spire.length}):`, missing.spire.join(", "));
console.log(`no wiki record (${missing.wiki.length}):`, missing.wiki.join(", "));
console.log(`not in lightspeed (${missing.lightspeed.length}):`, missing.lightspeed.join(", "));
console.log(`conflicts: ${conflicts.length}`);
if (fail.length) {
  console.error("SOURCE CONSUMPTION FAILED:\n - " + fail.join("\n - "));
  process.exit(1);
}

await Bun.write(
  `${ROOT}/references/extracted/powers-conflicts.json`,
  JSON.stringify({ conflicts, missing }, null, 1),
);
await Bun.write(`${ROOT}/data/corpus/powers.json`, JSON.stringify(powers, null, 1));
console.log("wrote data/corpus/powers.json + references/extracted/powers-conflicts.json");
