import { test, expect, describe } from "bun:test";
import { buildBaseContentBundle } from "../../src/content/index";
import cardsCorpus from "../../data/corpus/cards.json";
import relicsCorpus from "../../data/corpus/relics.json";
import potionsCorpus from "../../data/corpus/potions.json";

// The central exactness gate: every def in the bundle must match its corpus
// envelope EXACTLY. Missing content is allowed (phases) and reported as
// coverage; mismatched or unknown content fails.

const bundle = buildBaseContentBundle();

const cardsById = new Map((cardsCorpus as any[]).map((c) => [c.id, c]));
const relicsById = new Map((relicsCorpus as any[]).map((r) => [r.id, r]));
const potionList = Array.isArray(potionsCorpus) ? (potionsCorpus as any[]) : Object.values(potionsCorpus as object);
const potionsById = new Map(potionList.map((p: any) => [p.id, p]));

describe("cards vs corpus", () => {
  test("every implemented card exists in the corpus", () => {
    const unknown = [...bundle.cards.keys()].filter((id) => !cardsById.has(id));
    expect(unknown).toEqual([]);
  });

  test("implemented card envelopes match the corpus exactly", () => {
    const mismatches: string[] = [];
    for (const [id, def] of bundle.cards) {
      const c = cardsById.get(id);
      if (!c) continue;
      const miss = (field: string, got: unknown, want: unknown) => {
        if (String(got ?? null) !== String(want ?? null)) mismatches.push(`${id}.${field}: got ${got}, corpus ${want}`);
      };
      miss("cost", def.cost, c.cost);
      miss("type", def.type, c.type);
      miss("rarity", def.rarity, c.rarity);
      miss("color", def.color, c.color);
      // target: corpus uses lowercase variants like "allenemy"/"self"/"enemy"/"none"/"selfandenemy"/"all"
      miss("target", def.target, c.target);
      for (const k of ["damage", "block", "magic", "hits"] as const) {
        const want = c.values?.[k] ?? null;
        const got = def.values[k] ?? null;
        if (want !== null || got !== null) miss(`values.${k}`, got, want);
      }
      for (const k of ["cost", "damage", "block", "magic", "hits"] as const) {
        const want = c.upgrade?.[k] ?? null;
        const got = def.upgradeValues[k] ?? null;
        // corpus upgrade carries resolved values even when unchanged; only compare when the def declares one
        if (got !== null && String(got) !== String(want)) mismatches.push(`${id}.upgrade.${k}: got ${got}, corpus ${want}`);
      }
      // keyword flags (both directions, ignoring tags + engine-only markers)
      const corpusFlags = new Set<string>((c.flags ?? []).filter((f: string) => !f.startsWith("tag:")));
      const defFlags = new Set<string>(def.keywords.filter((f) => !f.startsWith("tag:")));
      for (const f of corpusFlags) if (!defFlags.has(f)) mismatches.push(`${id}: missing keyword ${f}`);
      for (const f of defFlags) if (!corpusFlags.has(f)) mismatches.push(`${id}: extra keyword ${f}`);
    }
    expect(mismatches).toEqual([]);
  });
});

describe("relics vs corpus", () => {
  test("every implemented relic exists in corpus with matching tier", () => {
    const problems: string[] = [];
    for (const [id, def] of bundle.relics) {
      const r = relicsById.get(id);
      if (!r) {
        problems.push(`${id}: not in corpus`);
        continue;
      }
      if (def.tier !== r.tier) problems.push(`${id}.tier: got ${def.tier}, corpus ${r.tier}`);
    }
    expect(problems).toEqual([]);
  });
});

describe("potions vs corpus", () => {
  test("every implemented potion exists in corpus with matching rarity/target", () => {
    const problems: string[] = [];
    for (const [id, def] of bundle.potions) {
      const p = potionsById.get(id);
      if (!p) {
        problems.push(`${id}: not in corpus`);
        continue;
      }
      if (def.rarity !== String(p.rarity).toLowerCase()) problems.push(`${id}.rarity: got ${def.rarity}, corpus ${p.rarity}`);
      if (def.targeted !== Boolean(p.targeted)) problems.push(`${id}.targeted: got ${def.targeted}, corpus ${p.targeted}`);
    }
    expect(problems).toEqual([]);
  });
});

describe("coverage report", () => {
  test("print implemented/total per category (informational)", () => {
    const cardTotal = cardsById.size;
    const report = [
      `cards: ${bundle.cards.size}/${cardTotal}`,
      `relics: ${bundle.relics.size}/${relicsById.size}`,
      `potions: ${bundle.potions.size}/${potionsById.size}`,
      `monsters: ${bundle.monsters.size}/65`,
      `powers: ${bundle.powers.size}`,
      `events: ${bundle.events.size}/51`,
    ].join("  |  ");
    console.log(`CONTENT COVERAGE - ${report}`);
    expect(true).toBe(true);
  });
});

describe("acts vs bundle", () => {
  test("every act-1 encounter references only implemented monsters", () => {
    const act1 = bundle.acts.find((a) => a.act === 1)!;
    const bad: string[] = [];
    for (const pool of [act1.weakEncounters, act1.strongEncounters, act1.elites]) {
      for (const enc of pool) {
        for (const id of enc.monsters) if (!bundle.monsters.has(id)) bad.push(`${enc.id}: ${id}`);
      }
    }
    for (const b of act1.bosses) if (!bundle.monsters.has(b)) bad.push(`boss: ${b}`);
    expect(bad).toEqual([]);
  });
});
