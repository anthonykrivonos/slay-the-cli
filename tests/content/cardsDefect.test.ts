// Table-driven corpus audit: every blue card in data/corpus/cards.json must
// exist in the defect slice exports with exact cost/type/rarity/target/values/
// upgrade values and matching keywords.

import { test, expect, describe } from "bun:test";
import corpus from "../../data/corpus/cards.json";
import type { CardDef } from "../../src/engine/content/defs";
import { defectCards, defectBasics, defectCommons, defectUncommons, defectRares } from "../../src/content/cards/defect";

interface CorpusCard {
  id: string;
  name: string;
  color: string;
  type: string;
  rarity: string;
  cost: number;
  target: string;
  values: { damage: number | null; block: number | null; magic: number | null; hits: number | null };
  flags: string[];
  upgrade: {
    cost: number;
    damage: number | null;
    block: number | null;
    magic: number | null;
    hits: number | null;
    flags: string[];
  };
}

const blues = (corpus as CorpusCard[]).filter((c) => c.color === "blue");

const byId = new Map<string, CardDef>();
for (const c of defectCards) byId.set(c.id, c);

// gameplay-relevant keywords tracked from corpus flags
const MECH = ["exhaust", "ethereal", "innate", "retain", "selfRetain", "purgeOnUse", "strike", "multiUpgrade"];
// subset the corpus upgrade.flags reliably carries (tags are dropped on upgrade)
const MECH_UP = ["exhaust", "ethereal", "innate"];

const pick = (flags: string[], allow: string[]) => new Set(flags.filter((f) => allow.includes(f)));

// CHILL / STORM / HELLO_WORLD / MACHINE_LEARNING gain Innate on upgrade only
// (corpus TEXT "[|$Innate.  // ]...", V2.3.4 behavior). The corpus base `flags`
// originally listed "innate" on these; the corpus has since been re-gated to
// carry it in upgrade.flags only, so the exception set below is normally a
// no-op - kept so the audit stays correct against either corpus revision.
const INNATE_ON_UPGRADE_ONLY = new Set(["CHILL", "STORM", "HELLO_WORLD", "MACHINE_LEARNING"]);

const VALUE_KEYS = ["damage", "block", "magic", "hits"] as const;

describe("corpus audit: blue pool sizes", () => {
  test("75 blue cards in the corpus and in the exports", () => {
    expect(blues.length).toBe(75);
    expect(defectCards.length).toBe(75);
    expect(defectBasics.length).toBe(4);
    expect(defectCommons.length).toBe(18);
    expect(defectUncommons.length).toBe(36);
    expect(defectRares.length).toBe(17);
    expect(defectCards.every((c) => c.color === "blue")).toBe(true);
  });

  test("no duplicate ids in the slice", () => {
    expect(byId.size).toBe(75);
  });
});

describe("corpus audit: per-card exact values", () => {
  for (const c of blues) {
    test(`${c.id}`, () => {
      const def = byId.get(c.id);
      expect(def).toBeDefined();
      if (!def) return;

      expect(def.name).toBe(c.name);
      expect(def.color).toBe(c.color as CardDef["color"]);
      expect(def.type).toBe(c.type as CardDef["type"]);
      expect(def.rarity).toBe(c.rarity as CardDef["rarity"]);
      expect(def.cost).toBe(c.cost);
      expect(def.target).toBe(c.target as CardDef["target"]);

      // base values: null in the corpus means "no such value"
      for (const k of VALUE_KEYS) {
        expect(def.values[k] ?? null).toBe(c.values[k]);
      }

      // upgraded values resolve through the deltas (undefined = unchanged)
      expect(def.upgradeValues.cost ?? def.cost).toBe(c.upgrade.cost);
      for (const k of VALUE_KEYS) {
        expect(def.upgradeValues[k] ?? def.values[k] ?? null).toBe(c.upgrade[k]);
      }

      // keywords from corpus flags (base + upgrade)
      const wantBase = pick(c.flags, MECH);
      if (INNATE_ON_UPGRADE_ONLY.has(c.id)) wantBase.delete("innate");
      expect(pick(def.keywords, MECH)).toEqual(wantBase);
      const upKws = def.upgradeKeywords ?? def.keywords;
      expect(pick(upKws, MECH_UP)).toEqual(pick(c.upgrade.flags, MECH_UP));
      if (INNATE_ON_UPGRADE_ONLY.has(c.id)) {
        expect(upKws.includes("innate")).toBe(true);
      }

      // every blue card is playable and must carry behavior
      expect(Boolean(def.primitives || def.onPlay)).toBe(true);
    });
  }
});
