// Table-driven corpus audit: every green card in data/corpus/cards.json must
// exist in the silent slice exports with exact cost/type/rarity/target/values/
// upgrade values and matching keywords.

import { test, expect, describe } from "bun:test";
import corpus from "../../data/corpus/cards.json";
import type { CardDef } from "../../src/engine/content/defs";
import { silentCards, silentBasics, silentCommons, silentUncommons, silentRares } from "../../src/content/cards/silent";

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
  noUpgrade?: boolean;
}

const greens = (corpus as CorpusCard[]).filter((c) => c.color === "green");

const byId = new Map<string, CardDef>();
for (const c of silentCards) byId.set(c.id, c);

// gameplay-relevant keywords tracked from corpus flags
const MECH = ["exhaust", "ethereal", "innate", "retain", "selfRetain", "purgeOnUse", "strike", "multiUpgrade"];
// subset the corpus upgrade.flags reliably carries (tags are dropped on upgrade)
const MECH_UP = ["exhaust", "ethereal", "innate"];

const pick = (flags: string[], allow: string[]) => new Set(flags.filter((f) => allow.includes(f)));

const VALUE_KEYS = ["damage", "block", "magic", "hits"] as const;

describe("corpus audit: pool sizes", () => {
  test("75 green in the corpus and in the exports (4/19/33/19 by rarity)", () => {
    expect(greens.length).toBe(75);
    expect(silentCards.length).toBe(75);
    expect(silentBasics.length).toBe(4);
    expect(silentCommons.length).toBe(19);
    expect(silentUncommons.length).toBe(33);
    expect(silentRares.length).toBe(19);
    expect(silentCards.every((c) => c.color === "green")).toBe(true);
  });

  test("no duplicate ids across the slice", () => {
    expect(byId.size).toBe(75);
  });
});

describe("corpus audit: per-card exact values", () => {
  for (const c of greens) {
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

      // keywords from corpus flags
      expect(pick(def.keywords, MECH)).toEqual(pick(c.flags, MECH));
      // TERROR's corpus upgrade.flags drop "exhaust", but its corpus text has
      // no [base|upgraded] marker around $Exhaust (contrast CALCULATED_GAMBLE,
      // whose "[<br>$Exhaust.|]" marker confirms the drop). V2.3.4 Terror+
      // still Exhausts; adjudicated in favor of the text (SEEING_RED precedent).
      if (!c.noUpgrade && c.id !== "TERROR") {
        const upKws = def.upgradeKeywords ?? def.keywords;
        expect(pick(upKws, MECH_UP)).toEqual(pick(c.upgrade.flags, MECH_UP));
      }
      if (c.id === "TERROR") {
        expect((def.upgradeKeywords ?? def.keywords).includes("exhaust")).toBe(true);
      }

      // every card must carry behavior or be an unplayable self-trigger card
      if (c.cost !== -2) {
        expect(Boolean(def.primitives || def.onPlay)).toBe(true);
      } else {
        // Reflex / Tactician: unplayable, manual-discard self-trigger
        expect(Boolean(def.onManualDiscardThis)).toBe(true);
      }
    });
  }
});
