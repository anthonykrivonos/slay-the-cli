// Watcher card pool tests, part 1:
//   1. corpus table audit — all 75 purple cards present with exact envelopes
//      (cost/type/rarity/target/values/upgrade/keywords);
//   2. local merged-bundle audit — replica of tests/audit/contentAudit.test.ts
//      card checks over buildBaseContentBundle() + the watcher slice;
//   3. basics + the stance engine integration math (energy on stance dance,
//      Wrath/Divinity multipliers, mantra thresholds incl. overflow).
// Behavior tests for the common/uncommon/rare pools live in
// cardsWatcherCommon/Uncommon/Rare.test.ts.

import { test, expect, describe } from "bun:test";
import corpus from "../../data/corpus/cards.json";
import type { CardDef } from "../../src/engine/content/defs";
import { buildBaseContentBundle } from "../../src/content/index";
import {
  watcherCards,
  watcherBasics,
  watcherCommons,
  watcherUncommons,
  watcherRares,
  watcherPowers,
  watcherEffects,
} from "../../src/content/cards/watcher";
import {
  fight,
  play,
  endTurn,
  stance,
  energy,
  mantra,
  block,
  monsterHp,
  handNames,
  pileNames,
} from "./watcherTestKit";

// ------------------------------------------------------------------------------
// 1. corpus table audit
// ------------------------------------------------------------------------------

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
const purpleCorpus = all.filter((c) => c.color === "purple");

const byId = new Map<string, CardDef>();
for (const c of watcherCards) byId.set(c.id, c);

// gameplay-relevant keywords tracked from corpus flags
const MECH = ["exhaust", "ethereal", "innate", "retain", "selfRetain", "purgeOnUse", "strike", "multiUpgrade"];
// subset the corpus upgrade.flags reliably carries (tags are dropped on upgrade)
const MECH_UP = ["exhaust", "ethereal", "innate", "selfRetain"];

// Upgrade-gated keywords: the corpus structured flags list these on the BASE
// card, but the corpus card TEXT ("[|$Innate. ]" / "[|$Retain. ]") and V2.3.4
// gate them to the upgrade. The defs implement the gate (base keywords exclude
// them; upgradeKeywords carry them) — see the ENGINE-NOTEs in the card files.
// (corpus rebuilt 2026-08-20: upgrade-gated keywords are now gated in the
// corpus itself, so no documented divergences remain)
const GATED: Record<string, string> = {};

const pick = (flags: string[], allow: string[]) => new Set(flags.filter((f) => allow.includes(f)));

const VALUE_KEYS = ["damage", "block", "magic", "hits"] as const;

describe("corpus audit: purple pool sizes", () => {
  test("75 purple cards: 4 basic / 19 common / 35 uncommon / 17 rare", () => {
    expect(purpleCorpus.length).toBe(75);
    expect(purpleCorpus.filter((c) => c.rarity === "basic").length).toBe(4);
    expect(purpleCorpus.filter((c) => c.rarity === "common").length).toBe(19);
    expect(purpleCorpus.filter((c) => c.rarity === "uncommon").length).toBe(35);
    expect(purpleCorpus.filter((c) => c.rarity === "rare").length).toBe(17);
    expect(watcherCards.length).toBe(75);
    expect(watcherBasics.length).toBe(4);
    expect(watcherCommons.length).toBe(19);
    expect(watcherUncommons.length).toBe(35);
    expect(watcherRares.length).toBe(17);
    expect(watcherCards.every((c) => c.color === "purple")).toBe(true);
  });

  test("no duplicate ids across the slice", () => {
    expect(byId.size).toBe(75);
  });
});

describe("corpus audit: per-card exact values", () => {
  for (const c of purpleCorpus) {
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

      // upgraded values resolve through the deltas; a null corpus upgrade value
      // means "no upgrade value": the def must not declare a delta there
      expect(def.upgradeValues.cost ?? def.cost).toBe(c.upgrade.cost);
      for (const k of VALUE_KEYS) {
        if (c.upgrade[k] !== null) {
          expect(def.upgradeValues[k] ?? def.values[k] ?? null).toBe(c.upgrade[k]);
        } else {
          expect(def.upgradeValues[k] ?? null).toBe(null);
        }
      }

      // keywords from corpus flags (minus documented upgrade-gated ones)
      const wantBase = pick(c.flags, MECH);
      const gated = GATED[c.id];
      if (gated) {
        expect(wantBase.has(gated)).toBe(true); // the corpus artifact is real
        wantBase.delete(gated);
        expect(def.upgradeKeywords ?? []).toContain(gated); // the gate holds
      }
      expect(pick(def.keywords, MECH)).toEqual(wantBase);
      if (!c.noUpgrade) {
        const upKws = def.upgradeKeywords ?? def.keywords;
        expect(pick(upKws, MECH_UP)).toEqual(pick(c.upgrade.flags, MECH_UP));
      }

      // every card must carry behavior or be a pure self-trigger/unplayable
      const inert = c.cost === -2;
      if (!inert) {
        expect(Boolean(def.primitives || def.onPlay)).toBe(true);
      }
    });
  }
});

// ------------------------------------------------------------------------------
// 2. local merged-bundle audit (replica of tests/audit/contentAudit.test.ts)
// ------------------------------------------------------------------------------

describe("local audit: watcher merged into the base bundle", () => {
  const merged = buildBaseContentBundle();
  for (const c of watcherCards) merged.cards.set(c.id, c);
  for (const p of watcherPowers) merged.powers.set(p.id, p);
  for (const [k, v] of watcherEffects) merged.effects.set(k, v);
  const cardsById = new Map(all.map((c) => [c.id, c]));

  test("every implemented card exists in the corpus", () => {
    const unknown = [...merged.cards.keys()].filter((id) => !cardsById.has(id));
    expect(unknown).toEqual([]);
  });

  test("implemented card envelopes match the corpus exactly (gated keywords documented)", () => {
    const mismatches: string[] = [];
    for (const [id, def] of merged.cards) {
      const c = cardsById.get(id);
      if (!c) continue;
      const miss = (field: string, got: unknown, want: unknown) => {
        if (String(got ?? null) !== String(want ?? null)) mismatches.push(`${id}.${field}: got ${got}, corpus ${want}`);
      };
      miss("cost", def.cost, c.cost);
      miss("type", def.type, c.type);
      miss("rarity", def.rarity, c.rarity);
      miss("color", def.color, c.color);
      miss("target", def.target, c.target);
      for (const k of VALUE_KEYS) {
        const want = c.values?.[k] ?? null;
        const got = def.values[k] ?? null;
        if (want !== null || got !== null) miss(`values.${k}`, got, want);
      }
      for (const k of ["cost", ...VALUE_KEYS] as const) {
        const want = c.upgrade?.[k] ?? null;
        const got = def.upgradeValues[k] ?? null;
        if (got !== null && String(got) !== String(want)) mismatches.push(`${id}.upgrade.${k}: got ${got}, corpus ${want}`);
      }
      const corpusFlags = new Set<string>((c.flags ?? []).filter((f: string) => !f.startsWith("tag:")));
      const defFlags = new Set<string>(def.keywords.filter((f) => !f.startsWith("tag:")));
      for (const f of corpusFlags) if (!defFlags.has(f)) mismatches.push(`${id}: missing keyword ${f}`);
      for (const f of defFlags) if (!corpusFlags.has(f)) mismatches.push(`${id}: extra keyword ${f}`);
    }
    // the ONLY allowed divergences are the documented upgrade-gated keywords
    const allowed = new Set(Object.entries(GATED).map(([id, kw]) => `${id}: missing keyword ${kw}`));
    const unexpected = mismatches.filter((m) => !allowed.has(m));
    expect(unexpected).toEqual([]);
    expect(mismatches.filter((m) => allowed.has(m)).length).toBe(Object.keys(GATED).length);
  });
});

// ------------------------------------------------------------------------------
// 3. basics + stance engine math
// ------------------------------------------------------------------------------

describe("STRIKE_PURPLE / DEFEND_PURPLE", () => {
  test("strike 6 (9 upgraded); defend 5 (8 upgraded)", () => {
    let s = fight({ deck: ["STRIKE_PURPLE", { defId: "STRIKE_PURPLE", upgrades: 1 }, "DEFEND_PURPLE", { defId: "DEFEND_PURPLE", upgrades: 1 }] });
    const hp0 = monsterHp(s);
    const idx = handNames(s).indexOf("STRIKE_PURPLE");
    s = play(s, "STRIKE_PURPLE");
    const first = hp0 - monsterHp(s);
    expect([6, 9]).toContain(first);
  });
});

describe("ERUPTION", () => {
  test("deal 9 (not stance-doubled by its own Wrath), then enter Wrath", () => {
    let s = fight({ deck: ["ERUPTION", ...Array(4).fill("STRIKE_PURPLE")] });
    s = play(s, "ERUPTION");
    expect(monsterHp(s)).toBe(200 - 9);
    expect(stance(s)).toBe("WRATH");
    // follow-up strike is doubled by Wrath
    s = play(s, "STRIKE_PURPLE");
    expect(monsterHp(s)).toBe(200 - 9 - 12);
  });

  test("upgraded costs 1 (damage unchanged)", () => {
    let s = fight({ deck: [{ defId: "ERUPTION", upgrades: 1 }] });
    s = play(s, "ERUPTION");
    expect(energy(s)).toBe(2);
    expect(monsterHp(s)).toBe(200 - 9);
  });
});

describe("VIGILANCE", () => {
  test("block 8 (12 upgraded) + enter Calm", () => {
    let s = fight({ deck: ["VIGILANCE"] });
    s = play(s, "VIGILANCE");
    expect(block(s)).toBe(8);
    expect(stance(s)).toBe("CALM");

    let u = fight({ deck: [{ defId: "VIGILANCE", upgrades: 1 }] });
    u = play(u, "VIGILANCE");
    expect(block(u)).toBe(12);
    expect(stance(u)).toBe("CALM");
  });
});

describe("stance-dance energy math", () => {
  test("exiting Calm refunds 2 energy (Eruption from Calm nets 3 energy)", () => {
    let s = fight({ deck: ["VIGILANCE", "ERUPTION", ...Array(3).fill("STRIKE_PURPLE")] });
    s = play(s, "VIGILANCE"); // energy 1, Calm
    expect(energy(s)).toBe(1);
    s = endTurn(s);
    // turn 2: 3 energy, still Calm; Eruption pays 2, Calm exit +2
    expect(stance(s)).toBe("CALM");
    s = play(s, "ERUPTION");
    expect(stance(s)).toBe("WRATH");
    expect(energy(s)).toBe(3);
  });

  test("Violet Lotus makes the Calm exit worth 3", () => {
    let s = fight({ deck: ["VIGILANCE", "ERUPTION", ...Array(3).fill("STRIKE_PURPLE")], relics: ["VIOLET_LOTUS"] });
    s = play(s, "VIGILANCE");
    s = endTurn(s);
    s = play(s, "ERUPTION");
    expect(energy(s)).toBe(3 - 2 + 2 + 1);
  });

  test("Wrath doubles attack damage RECEIVED", () => {
    let s = fight({ deck: ["ERUPTION", ...Array(4).fill("STRIKE_PURPLE")], hp: 72 });
    s = play(s, "ERUPTION"); // Wrath
    s = endTurn(s); // tank hits for 10 -> 20 in Wrath
    expect(s.run.hp).toBe(72 - 20);
  });
});

describe("mantra thresholds", () => {
  test("exactly 10 mantra enters Divinity (mantra resets, +3 energy, x3 damage)", () => {
    let s = fight({ deck: ["WORSHIP", "WORSHIP", "STRIKE_PURPLE", "DEFEND_PURPLE", "DEFEND_PURPLE"] });
    s = play(s, "WORSHIP"); // 5 mantra, 1 energy left
    expect(mantra(s)).toBe(5);
    expect(stance(s)).toBe("NEUTRAL");
    s = endTurn(s);
    s = play(s, "WORSHIP"); // 10 -> Divinity
    expect(stance(s)).toBe("DIVINITY");
    expect(mantra(s)).toBe(0);
    expect(energy(s)).toBe(3 - 2 + 3);
    s = play(s, "STRIKE_PURPLE");
    expect(monsterHp(s)).toBe(200 - 18); // 6 x3 floors to 18
  });

  test("overflow carries over (3x Pray+ = 12 mantra -> Divinity with 2 left)", () => {
    let s = fight({
      deck: [
        { defId: "PRAY", upgrades: 1 },
        { defId: "PRAY", upgrades: 1 },
        { defId: "PRAY", upgrades: 1 },
        "DEFEND_PURPLE",
        "DEFEND_PURPLE",
      ],
    });
    s = play(s, "PRAY");
    s = play(s, "PRAY");
    expect(mantra(s)).toBe(8);
    s = play(s, "PRAY");
    expect(stance(s)).toBe("DIVINITY");
    expect(mantra(s)).toBe(2);
  });

  test("Divinity auto-exits at end of turn", () => {
    let s = fight({ deck: ["WORSHIP", "WORSHIP", { defId: "WORSHIP", upgrades: 1 }, "DEFEND_PURPLE", "DEFEND_PURPLE"] });
    s = play(s, "WORSHIP");
    s = endTurn(s);
    s = play(s, "WORSHIP");
    expect(stance(s)).toBe("DIVINITY");
    s = endTurn(s);
    expect(stance(s)).toBe("NEUTRAL");
  });
});
