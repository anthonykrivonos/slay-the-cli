// Table-driven corpus audit: every red / status / curse card in
// data/corpus/cards.json must exist in the ironclad slice exports with exact
// cost/type/rarity/target/values/upgrade values and matching keywords.

import { test, expect, describe } from "bun:test";
import corpus from "../../data/corpus/cards.json";
import type { CardDef } from "../../src/engine/content/defs";
import { ironcladCards, statusCards, curseCards } from "../../src/content/cards/ironclad";

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

const all = corpus as CorpusCard[];
const reds = all.filter((c) => c.color === "red");
const statuses = all.filter((c) => c.type === "status");
const curses = all.filter((c) => c.color === "curse");

const byId = new Map<string, CardDef>();
for (const c of [...ironcladCards, ...statusCards, ...curseCards]) byId.set(c.id, c);

// gameplay-relevant keywords tracked from corpus flags
const MECH = ["exhaust", "ethereal", "innate", "retain", "selfRetain", "purgeOnUse", "strike", "multiUpgrade"];
// subset the corpus upgrade.flags reliably carries (tags are dropped on upgrade)
const MECH_UP = ["exhaust", "ethereal", "innate"];

const pick = (flags: string[], allow: string[]) => new Set(flags.filter((f) => allow.includes(f)));
// CardDef.rarity has no "curse" member; the slice maps corpus "curse" -> "special"
const mapRarity = (r: string) => r; // CardDef.rarity now includes "curse"

const VALUE_KEYS = ["damage", "block", "magic", "hits"] as const;

describe("corpus audit: pool sizes", () => {
  test("75 red / 5 status / 14 curse in the corpus and in the exports", () => {
    expect(reds.length).toBe(75);
    expect(statuses.length).toBe(5);
    expect(curses.length).toBe(14);
    expect(ironcladCards.length).toBe(75);
    expect(statusCards.length).toBe(5);
    expect(curseCards.length).toBe(14);
    expect(ironcladCards.every((c) => c.color === "red")).toBe(true);
    expect(statusCards.every((c) => c.type === "status")).toBe(true);
    expect(curseCards.every((c) => c.color === "curse" && c.type === "curse")).toBe(true);
  });

  test("no duplicate ids across the slice", () => {
    expect(byId.size).toBe(75 + 5 + 14);
  });
});

describe("corpus audit: per-card exact values", () => {
  for (const c of [...reds, ...statuses, ...curses]) {
    test(`${c.id}`, () => {
      const def = byId.get(c.id);
      expect(def).toBeDefined();
      if (!def) return;

      expect(def.name).toBe(c.name);
      expect(def.color).toBe(c.color as CardDef["color"]);
      expect(def.type).toBe(c.type as CardDef["type"]);
      expect(def.rarity).toBe(mapRarity(c.rarity) as CardDef["rarity"]);
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
      // SEEING_RED's corpus upgrade.flags drop "exhaust", but its corpus text
      // has no [base|upgraded] marker around $Exhaust (contrast LIMIT_BREAK,
      // whose "[<br>$Exhaust.|]" marker confirms the drop). V2.3.4 Seeing Red+
      // still Exhausts; adjudicated in favor of the text.
      if (!c.noUpgrade && c.id !== "SEEING_RED") {
        const upKws = def.upgradeKeywords ?? def.keywords;
        expect(pick(upKws, MECH_UP)).toEqual(pick(c.upgrade.flags, MECH_UP));
      }
      if (c.id === "SEEING_RED") {
        expect((def.upgradeKeywords ?? def.keywords).includes("exhaust")).toBe(true);
      }

      // every card must carry behavior or be an inert unplayable
      const inert = c.cost === -2 || c.id === "SLIMED" || c.id === "PRIDE";
      if (!inert) {
        expect(Boolean(def.primitives || def.onPlay)).toBe(true);
      }
    });
  }
});
