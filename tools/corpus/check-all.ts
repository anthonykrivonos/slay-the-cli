// Unified corpus audit: cross-file coverage checks + runs every per-file checker.
// Run: bun tools/corpus/check-all.ts

import { $ } from "bun";
import { existsSync } from "node:fs";

const ROOT = `${import.meta.dir}/../..`;
let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`FAIL: ${msg}`);
};

// The reference clones under references/ are deliberately not committed, so this
// audit is a maintainer tool and cannot run from a bare checkout (which is why it
// is not a CI gate). Say so plainly rather than dying on an ENOENT stack.
const NEEDED_REFS = ["sts_lightspeed", "spire-archive", "wiki", "extracted"];
const absentRefs = NEEDED_REFS.filter((d) => !existsSync(`${ROOT}/references/${d}`));
if (absentRefs.length > 0) {
  console.error(`corpus audit needs the reference clones under references/.`);
  console.error(`missing: ${absentRefs.join(", ")}`);
  console.error(``);
  console.error(`They are deliberately not committed, so this audit only runs where they`);
  console.error(`exist. Content parity itself is covered by \`bun test\``);
  console.error(`(tests/audit/contentAudit.test.ts), which needs only data/corpus.`);
  process.exit(1);
}

// --- monster id coverage vs MonsterIds.h --------------------------------------
const idsH = await Bun.file(`${ROOT}/references/sts_lightspeed/include/constants/MonsterIds.h`).text();
const enumBody = idsH.slice(idsH.indexOf("enum class MonsterId"), idsH.indexOf("};"));
const enumIds = [...enumBody.matchAll(/^\s*([A-Z0-9_]+),?\s*$/gm)].map((m) => m[1]!).filter((x) => x !== "INVALID");

const monsterFiles = ["monsters-act1.json", "monsters-act2.json", "monsters-act34.json"];
const corpusMonsters = new Map<string, any>();
for (const f of monsterFiles) {
  const arr = await Bun.file(`${ROOT}/data/corpus/${f}`).json();
  const list = Array.isArray(arr) ? arr : (arr.entities ?? arr.monsters);
  for (const m of list) {
    if (corpusMonsters.has(m.id)) fail(`duplicate monster ${m.id} (${f})`);
    corpusMonsters.set(m.id, m);
  }
}

const missing = enumIds.filter((id) => !corpusMonsters.has(id));
const extra = [...corpusMonsters.keys()].filter((id) => !enumIds.includes(id));
console.log(`monsters: corpus ${corpusMonsters.size}, MonsterIds.h ${enumIds.length}`);
if (missing.length) console.warn(`  in enum but not corpus: ${missing.join(", ")}`);
if (extra.length) console.warn(`  in corpus but not enum: ${extra.join(", ")}`);

// --- encounters in meta.json reference existing monsters ----------------------
const meta = await Bun.file(`${ROOT}/data/corpus/meta.json`).json();
const encActs = meta.encounters ?? {};
for (const [actName, act] of Object.entries<any>(encActs)) {
  if (typeof act !== "object" || act === null) continue;
  for (const poolName of ["weak", "strong", "elites", "elite"]) {
    const pool = act[poolName];
    if (!Array.isArray(pool)) continue;
    for (const enc of pool) {
      const monsters: string[] = enc.monsters ?? [];
      for (const id of monsters) {
        if (!corpusMonsters.has(id) && !enumIds.includes(id)) {
          fail(`${actName}.${poolName} encounter references unknown monster ${id}`);
        }
      }
    }
  }
}

// --- characters' starting decks exist in cards corpus -------------------------
const cards = await Bun.file(`${ROOT}/data/corpus/cards.json`).json();
const cardIds = new Set(cards.map((c: any) => c.id));
const characters = await Bun.file(`${ROOT}/data/corpus/characters.json`).json();
const charList = Array.isArray(characters) ? characters : Object.values(characters);
for (const ch of charList as any[]) {
  const deck = ch.startingDeck ?? [];
  for (const entry of deck) {
    const id = typeof entry === "string" ? entry : (entry.card ?? entry.defId ?? entry.id);
    if (!cardIds.has(id)) fail(`character ${ch.id ?? ch.name} starting deck references unknown card ${id}`);
  }
}

// --- run every per-file checker ------------------------------------------------
const checkers = [
  "check-meta.ts",
  "check-events.ts",
  "check-monsters-act1.ts",
  "check-monsters-act2.ts",
  "check-monsters-act34.ts",
];
for (const c of checkers) {
  const res = await $`bun ${ROOT}/tools/corpus/${c}`.quiet().nothrow();
  const status = res.exitCode === 0 ? "ok" : "FAIL";
  console.log(`${c}: ${status}`);
  if (res.exitCode !== 0) {
    failures++;
    console.error(res.stdout.toString().slice(-2000));
    console.error(res.stderr.toString().slice(-2000));
  }
}

// --- rebuild reproducibility: builders run clean -------------------------------
for (const b of ["build-cards.ts", "build-relics.ts", "build-potions.ts", "build-powers.ts", "build-misc.ts"]) {
  const res = await $`bun ${ROOT}/tools/corpus/${b}`.quiet().nothrow();
  console.log(`${b}: ${res.exitCode === 0 ? "ok" : "FAIL"}`);
  if (res.exitCode !== 0) {
    failures++;
    console.error(res.stderr.toString().slice(-1500));
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\ncorpus audit clean");
