// Colorless card pool tests:
//   1. corpus table audit — all 51 colorless (non-status) cards present with
//      exact envelopes (cost/type/rarity/target/values/upgrade/keywords);
//   2. local merged-bundle audit — replica of tests/audit/contentAudit.test.ts
//      card checks over buildBaseContentBundle() + the colorless slice, proving
//      envelope exactness before the orchestrator integrates the exports;
//   3. behavior tests for every bespoke card (base AND upgraded), using a local
//      merge of the ironclad test-kit bundle (cardsTestKit is not modified).

import { test, expect, describe } from "bun:test";
import corpus from "../../data/corpus/cards.json";
import type { CardDef, ContentBundle } from "../../src/engine/content/defs";
import type { GameState } from "../../src/engine/game";
import { createCombatGame, advance } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content/index";
import { relicSupportPowers } from "../../src/content/relics/supportPowers";
import {
  colorlessCards,
  colorlessUncommons,
  colorlessRares,
  colorlessSpecials,
  colorlessPowers,
  colorlessEffects,
} from "../../src/content/cards/colorless";
import { ironBundle, handNames, pileNames, choiceIndexOf, monsterHp, playerPower, monsterPower } from "./cardsTestKit";

// ------------------------------------------------------------------------------
// 1. corpus table audit (style of tests/content/cardsIronclad.test.ts)
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
  unobtainable?: boolean;
}

const all = corpus as CorpusCard[];
const colorlessCorpus = all.filter((c) => c.color === "colorless" && c.type !== "status");

const byId = new Map<string, CardDef>();
for (const c of colorlessCards) byId.set(c.id, c);

// gameplay-relevant keywords tracked from corpus flags
const MECH = ["exhaust", "ethereal", "innate", "retain", "selfRetain", "purgeOnUse", "strike", "multiUpgrade"];
// subset the corpus upgrade.flags reliably carries (tags are dropped on upgrade)
const MECH_UP = ["exhaust", "ethereal", "innate"];

const pick = (flags: string[], allow: string[]) => new Set(flags.filter((f) => allow.includes(f)));

const VALUE_KEYS = ["damage", "block", "magic", "hits"] as const;

describe("corpus audit: colorless pool sizes", () => {
  test("51 colorless non-status cards: 20 uncommon / 15 rare / 16 special", () => {
    expect(colorlessCorpus.length).toBe(51);
    expect(colorlessCorpus.filter((c) => c.rarity === "uncommon").length).toBe(20);
    expect(colorlessCorpus.filter((c) => c.rarity === "rare").length).toBe(15);
    expect(colorlessCorpus.filter((c) => c.rarity === "special").length).toBe(16);
    expect(colorlessCards.length).toBe(51);
    expect(colorlessUncommons.length).toBe(20);
    expect(colorlessRares.length).toBe(15);
    expect(colorlessSpecials.length).toBe(16);
    expect(colorlessCards.every((c) => c.color === "colorless")).toBe(true);
    expect(colorlessCards.every((c) => c.type !== "status")).toBe(true);
  });

  test("no duplicate ids across the slice", () => {
    expect(byId.size).toBe(51);
  });

  test("the three unobtainable cards are implemented", () => {
    for (const id of ["BECOME_ALMIGHTY", "FAME_AND_FORTUNE", "LIVE_FOREVER"]) {
      expect(colorlessCorpus.find((c) => c.id === id)?.unobtainable).toBe(true);
      expect(byId.has(id)).toBe(true);
    }
  });
});

describe("corpus audit: per-card exact values", () => {
  for (const c of colorlessCorpus) {
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

      // upgraded values resolve through the deltas. A null corpus upgrade value
      // means "no upgrade value" (even when the base is set — Apparition magic,
      // Ritual Dagger damage): the def must not declare a delta there.
      expect(def.upgradeValues.cost ?? def.cost).toBe(c.upgrade.cost);
      for (const k of VALUE_KEYS) {
        if (c.upgrade[k] !== null) {
          expect(def.upgradeValues[k] ?? def.values[k] ?? null).toBe(c.upgrade[k]);
        } else {
          expect(def.upgradeValues[k] ?? null).toBe(null);
        }
      }

      // keywords from corpus flags
      expect(pick(def.keywords, MECH)).toEqual(pick(c.flags, MECH));
      if (!c.noUpgrade) {
        const upKws = def.upgradeKeywords ?? def.keywords;
        expect(pick(upKws, MECH_UP)).toEqual(pick(c.upgrade.flags, MECH_UP));
      }

      // every card must carry behavior or be an inert unplayable
      const inert = c.cost === -2;
      if (!inert) {
        expect(Boolean(def.primitives || def.onPlay)).toBe(true);
      }
    });
  }
});

// ------------------------------------------------------------------------------
// 2. local merged-bundle audit (replica of tests/audit/contentAudit.test.ts,
//    cards section, over the base bundle + this slice)
// ------------------------------------------------------------------------------

describe("local audit: colorless merged into the base bundle", () => {
  const merged = buildBaseContentBundle();
  for (const c of colorlessCards) merged.cards.set(c.id, c);
  for (const p of colorlessPowers) merged.powers.set(p.id, p);
  for (const [k, v] of colorlessEffects) merged.effects.set(k, v);
  const cardsById = new Map(all.map((c) => [c.id, c]));

  test("every implemented card exists in the corpus", () => {
    const unknown = [...merged.cards.keys()].filter((id) => !cardsById.has(id));
    expect(unknown).toEqual([]);
  });

  test("implemented card envelopes match the corpus exactly", () => {
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
        // corpus upgrade carries resolved values even when unchanged; only compare when the def declares one
        if (got !== null && String(got) !== String(want)) mismatches.push(`${id}.upgrade.${k}: got ${got}, corpus ${want}`);
      }
      const corpusFlags = new Set<string>((c.flags ?? []).filter((f: string) => !f.startsWith("tag:")));
      const defFlags = new Set<string>(def.keywords.filter((f) => !f.startsWith("tag:")));
      for (const f of corpusFlags) if (!defFlags.has(f)) mismatches.push(`${id}: missing keyword ${f}`);
      for (const f of defFlags) if (!corpusFlags.has(f)) mismatches.push(`${id}: extra keyword ${f}`);
    }
    expect(mismatches).toEqual([]);
  });

  test("the shop/neow colorless pools are populated after the merge", () => {
    const uncommon = [...merged.cards.values()].filter((c) => c.color === "colorless" && c.rarity === "uncommon");
    const rare = [...merged.cards.values()].filter((c) => c.color === "colorless" && c.rarity === "rare");
    expect(uncommon.length).toBe(20);
    expect(rare.length).toBe(15);
  });
});

// ------------------------------------------------------------------------------
// 3. behavior tests — local test kit (merged bundle; cardsTestKit unmodified)
// ------------------------------------------------------------------------------

function colorlessBundle(): ContentBundle {
  const b = ironBundle();
  // mirror src/content/index.ts merge order: relic support powers land after
  // the ironclad powers (their LOSE_STRENGTH handles monster owners too)
  for (const p of relicSupportPowers) b.powers.set(p.id, p);
  for (const p of colorlessPowers) b.powers.set(p.id, p);
  for (const c of colorlessCards) b.cards.set(c.id, c);
  for (const [k, v] of colorlessEffects) b.effects.set(k, v);
  return b;
}

const bundle = colorlessBundle();

interface DeckEntry {
  defId: string;
  upgrades?: number;
}

function fight(opts: { deck: (string | DeckEntry)[]; seed?: string; monsters?: string[]; hp?: number }): GameState {
  return createCombatGame({
    seed: opts.seed ?? "CLKIT",
    bundle,
    character: "IRONCLAD",
    deck: opts.deck.map((d) => (typeof d === "string" ? { defId: d } : { defId: d.defId, upgrades: d.upgrades })),
    monsters: opts.monsters ?? ["T_TANK"],
    hp: opts.hp,
  });
}

function play(s: GameState, defId: string, target = 0): GameState {
  const idx = handNames(s).indexOf(defId);
  if (idx === -1) throw new Error(`${defId} not in hand: ${handNames(s)}`);
  return advance(s, { cmd: "playCard", handIdx: idx, target }, bundle);
}

const endTurn = (s: GameState): GameState => advance(s, { cmd: "endTurn" }, bundle);

const choose = (s: GameState, indices: number[]): GameState => advance(s, { cmd: "choose", indices }, bundle);

/** First fight (over a fixed seed list) whose opening hand holds all wanted cards. */
function fightWithInHand(want: string[], opts: Parameters<typeof fight>[0]): GameState {
  for (const seed of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"]) {
    const s = fight({ ...opts, seed });
    const names = handNames(s);
    if (want.every((w) => names.includes(w))) return s;
  }
  throw new Error(`no seed put ${want.join(",")} in the opening hand`);
}

/** First instance of defId in the given pile. */
function instOf(s: GameState, defId: string, pile: "draw" | "hand" | "discard" | "exhaust") {
  const iid = s.combat!.player.piles[pile].find((i) => s.combat!.cards[i]!.defId === defId);
  if (iid === undefined) throw new Error(`${defId} not in ${pile}`);
  return s.combat!.cards[iid]!;
}

const strikes = (n: number) => Array(n).fill("STRIKE_RED") as string[];
const defends = (n: number) => Array(n).fill("DEFEND_RED") as string[];

// --- uncommons ----------------------------------------------------------------

describe("BANDAGE_UP", () => {
  test("heal 4 (6 upgraded), Exhaust", () => {
    for (const [up, heal] of [
      [0, 4],
      [1, 6],
    ] as const) {
      let s = fight({ deck: [{ defId: "BANDAGE_UP", upgrades: up }, ...strikes(4)], hp: 50 });
      s = play(s, "BANDAGE_UP");
      expect(s.run.hp).toBe(50 + heal);
      expect(pileNames(s, "exhaust")).toEqual(["BANDAGE_UP"]);
    }
  });
});

describe("BLIND", () => {
  test("base: 2 Weak on the target only", () => {
    let s = fight({ deck: ["BLIND", ...strikes(4)], monsters: ["T_TANK", "T_GUARD"] });
    s = play(s, "BLIND", 1);
    expect(monsterPower(s, "WEAK", 1)).toBe(2);
    expect(monsterPower(s, "WEAK", 0)).toBeUndefined();
  });

  test("upgraded: 2 Weak on ALL enemies", () => {
    let s = fight({ deck: [{ defId: "BLIND", upgrades: 1 }, ...strikes(4)], monsters: ["T_TANK", "T_GUARD"] });
    s = play(s, "BLIND", 0);
    expect(monsterPower(s, "WEAK", 0)).toBe(2);
    expect(monsterPower(s, "WEAK", 1)).toBe(2);
  });
});

describe("DARK_SHACKLES", () => {
  test("base: -9 Strength this turn, restored at the end of the enemy's turn", () => {
    let s = fight({ deck: ["DARK_SHACKLES", ...strikes(4)] });
    s = play(s, "DARK_SHACKLES", 0);
    expect(monsterPower(s, "STRENGTH", 0)).toBe(-9);
    expect(monsterPower(s, "GENERIC_STRENGTH_UP", 0)).toBe(9);
    expect(pileNames(s, "exhaust")).toEqual(["DARK_SHACKLES"]);
    s = endTurn(s);
    expect(s.run.hp).toBe(79); // tank hits for 10 - 9 = 1
    expect(monsterPower(s, "STRENGTH", 0) ?? 0).toBe(0); // restored
    expect(monsterPower(s, "GENERIC_STRENGTH_UP", 0)).toBeUndefined();
    s = endTurn(s);
    expect(s.run.hp).toBe(69); // full 10 again next turn
  });

  test("upgraded: -15 Strength floors the attack at 0", () => {
    let s = fight({ deck: [{ defId: "DARK_SHACKLES", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "DARK_SHACKLES", 0);
    expect(monsterPower(s, "STRENGTH", 0)).toBe(-15);
    s = endTurn(s);
    expect(s.run.hp).toBe(80);
  });
});

describe("DEEP_BREATH", () => {
  test("shuffle discard into draw, then draw 1 (2 upgraded)", () => {
    for (const [up, n] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "DEEP_BREATH", upgrades: up }, ...strikes(4)] });
      s = play(s, "STRIKE_RED", 0);
      s = play(s, "STRIKE_RED", 0); // discard: 2 strikes
      s = play(s, "DEEP_BREATH");
      expect(handNames(s).length).toBe(2 + n);
      expect(s.combat!.player.piles.draw.length).toBe(2 - n);
      expect(pileNames(s, "discard")).toEqual(["DEEP_BREATH"]); // not shuffled in itself
    }
  });
});

describe("DISCOVERY", () => {
  test("choose 1 of 3 random class cards; it costs 0 this turn; Exhausts (base only)", () => {
    for (const up of [0, 1] as const) {
      let s = fight({ deck: [{ defId: "DISCOVERY", upgrades: up }, ...strikes(4)] });
      s = play(s, "DISCOVERY");
      expect(s.pending?.request.kind).toBe("option");
      const req = s.pending!.request as { options: string[] };
      expect(req.options.length).toBe(3);
      s = choose(s, [0]);
      expect(handNames(s).length).toBe(5); // 4 strikes + the discovered card
      const addedIid = s.combat!.player.piles.hand.find((i) => s.combat!.cards[i]!.defId !== "STRIKE_RED")!;
      const added = s.combat!.cards[addedIid]!;
      const def = bundle.cards.get(added.defId)!;
      expect(def.color).toBe("red"); // class pool
      expect(["common", "uncommon", "rare"]).toContain(def.rarity);
      expect(added.costForTurn).toBe(0);
      if (up) {
        expect(pileNames(s, "discard")).toContain("DISCOVERY");
      } else {
        expect(pileNames(s, "exhaust")).toContain("DISCOVERY");
      }
    }
  });
});

describe("DRAMATIC_ENTRANCE", () => {
  test("Innate; deal 8 (12 upgraded) to ALL; Exhaust", () => {
    for (const [up, dmg] of [
      [0, 8],
      [1, 12],
    ] as const) {
      let s = fight({
        deck: [{ defId: "DRAMATIC_ENTRANCE", upgrades: up }, ...strikes(9)],
        monsters: ["T_TANK", "T_GUARD"],
      });
      expect(handNames(s)).toContain("DRAMATIC_ENTRANCE"); // innate
      s = play(s, "DRAMATIC_ENTRANCE");
      expect(monsterHp(s, 0)).toBe(200 - dmg);
      expect(monsterHp(s, 1)).toBe(200 - dmg);
      expect(pileNames(s, "exhaust")).toEqual(["DRAMATIC_ENTRANCE"]);
    }
  });
});

describe("ENLIGHTENMENT", () => {
  test("base: hand costs reduced to 1 this turn only", () => {
    let s = fight({ deck: ["ENLIGHTENMENT", "BASH", ...strikes(3)] });
    s = play(s, "ENLIGHTENMENT");
    let bash = instOf(s, "BASH", "hand");
    expect(bash.costForTurn).toBe(1);
    expect(bash.cost).toBe(2);
    s = endTurn(s);
    bash = instOf(s, "BASH", "hand"); // 5-card deck redraws everything
    expect(bash.costForTurn).toBe(2); // reset at end of turn
  });

  test("upgraded: hand costs reduced to 1 for the combat", () => {
    let s = fight({ deck: [{ defId: "ENLIGHTENMENT", upgrades: 1 }, "BASH", ...strikes(3)] });
    s = play(s, "ENLIGHTENMENT");
    s = endTurn(s);
    const bash = instOf(s, "BASH", "hand");
    expect(bash.cost).toBe(1);
    expect(bash.costForTurn).toBe(1);
  });
});

describe("FINESSE", () => {
  test("block 2 (4 upgraded) + draw 1", () => {
    for (const [up, blk] of [
      [0, 2],
      [1, 4],
    ] as const) {
      let s = fightWithInHand(["FINESSE"], { deck: [{ defId: "FINESSE", upgrades: up }, ...strikes(9)] });
      s = play(s, "FINESSE");
      expect(s.combat!.player.block).toBe(blk);
      expect(handNames(s).length).toBe(5); // 4 left + 1 drawn
    }
  });
});

describe("FLASH_OF_STEEL", () => {
  test("deal 3 (6 upgraded) + draw 1", () => {
    for (const [up, dmg] of [
      [0, 3],
      [1, 6],
    ] as const) {
      let s = fightWithInHand(["FLASH_OF_STEEL"], { deck: [{ defId: "FLASH_OF_STEEL", upgrades: up }, ...strikes(9)] });
      s = play(s, "FLASH_OF_STEEL", 0);
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(handNames(s).length).toBe(5);
    }
  });
});

describe("FORETHOUGHT", () => {
  test("base: chosen card to the bottom of draw; costs 0 until played", () => {
    let s = fight({ deck: ["FORETHOUGHT", "BASH", ...strikes(3)] });
    s = play(s, "FORETHOUGHT");
    expect(s.pending?.request.kind).toBe("cards");
    s = choose(s, [choiceIndexOf(s, "BASH")]);
    expect(pileNames(s, "draw")).toEqual(["BASH"]);
    expect(instOf(s, "BASH", "draw").freeToPlayOnce).toBe(true);
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "STRIKE_RED", 0); // energy 0
    s = endTurn(s);
    s = play(s, "BASH", 0); // free to play once
    expect(s.combat!.player.energy).toBe(3);
    expect(monsterHp(s)).toBe(200 - 18 - 8);
    expect(instOf(s, "BASH", "discard").freeToPlayOnce).toBe(false); // consumed
  });

  test("upgraded: any number of cards (min 0), all free until played", () => {
    let s = fight({ deck: [{ defId: "FORETHOUGHT", upgrades: 1 }, "BASH", ...strikes(3)] });
    s = play(s, "FORETHOUGHT");
    const req = s.pending!.request as { min: number; max: number };
    expect(req.min).toBe(0);
    expect(req.max).toBe(4);
    s = choose(s, [0, 1]);
    expect(s.combat!.player.piles.draw.length).toBe(2);
    for (const iid of s.combat!.player.piles.draw) {
      expect(s.combat!.cards[iid]!.freeToPlayOnce).toBe(true);
    }
  });
});

describe("GOOD_INSTINCTS", () => {
  test("block 6 (9 upgraded)", () => {
    for (const [up, blk] of [
      [0, 6],
      [1, 9],
    ] as const) {
      let s = fight({ deck: [{ defId: "GOOD_INSTINCTS", upgrades: up }, ...strikes(4)] });
      s = play(s, "GOOD_INSTINCTS");
      expect(s.combat!.player.block).toBe(blk);
    }
  });
});

describe("IMPATIENCE", () => {
  test("no Attacks in hand: draw 2 (3 upgraded)", () => {
    for (const [up, n] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fightWithInHand(["IMPATIENCE"], { deck: [{ defId: "IMPATIENCE", upgrades: up }, ...defends(9)] });
      s = play(s, "IMPATIENCE");
      expect(handNames(s).length).toBe(4 + n);
    }
  });

  test("an Attack in hand: no draw", () => {
    let s = fight({ deck: ["IMPATIENCE", "BASH", ...defends(3)] });
    s = play(s, "IMPATIENCE");
    expect(handNames(s).length).toBe(4);
  });
});

describe("JACK_OF_ALL_TRADES", () => {
  test("add 1 (2 upgraded) random Colorless cards to hand; Exhaust", () => {
    for (const [up, n] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "JACK_OF_ALL_TRADES", upgrades: up }, ...strikes(4)] });
      s = play(s, "JACK_OF_ALL_TRADES");
      expect(handNames(s).length).toBe(4 + n);
      const added = s.combat!.player.piles.hand.filter((i) => s.combat!.cards[i]!.defId !== "STRIKE_RED");
      expect(added.length).toBe(n);
      for (const iid of added) {
        const def = bundle.cards.get(s.combat!.cards[iid]!.defId)!;
        expect(def.color).toBe("colorless");
        expect(["uncommon", "rare"]).toContain(def.rarity); // obtainable pool only
      }
      expect(pileNames(s, "exhaust")).toEqual(["JACK_OF_ALL_TRADES"]);
    }
  });
});

describe("MADNESS", () => {
  test("base (cost 1): a random cost>0 card in hand costs 0 for the combat", () => {
    let s = fight({ deck: ["MADNESS", "BASH", "GOOD_INSTINCTS", "GOOD_INSTINCTS", "GOOD_INSTINCTS"] });
    s = play(s, "MADNESS");
    expect(s.combat!.player.energy).toBe(2);
    let bash = instOf(s, "BASH", "hand"); // only eligible card (others cost 0)
    expect(bash.cost).toBe(0);
    expect(bash.costForTurn).toBe(0);
    s = endTurn(s);
    bash = instOf(s, "BASH", "hand");
    expect(bash.costForTurn).toBe(0); // permanent for the combat
  });

  test("upgraded costs 0", () => {
    let s = fight({ deck: [{ defId: "MADNESS", upgrades: 1 }, "BASH", "GOOD_INSTINCTS", "GOOD_INSTINCTS", "GOOD_INSTINCTS"] });
    s = play(s, "MADNESS");
    expect(s.combat!.player.energy).toBe(3);
    expect(instOf(s, "BASH", "hand").cost).toBe(0);
  });
});

describe("MIND_BLAST", () => {
  test("Innate; damage = draw pile size; cost 2 (1 upgraded)", () => {
    for (const [up, left] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "MIND_BLAST", upgrades: up }, ...strikes(9)] });
      expect(handNames(s)).toContain("MIND_BLAST"); // innate
      s = play(s, "MIND_BLAST", 0);
      expect(monsterHp(s)).toBe(200 - 5); // 5 cards in draw
      expect(s.combat!.player.energy).toBe(left);
    }
  });
});

describe("PANACEA", () => {
  test("gain 1 (2 upgraded) Artifact; Exhaust", () => {
    for (const [up, n] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "PANACEA", upgrades: up }, ...strikes(4)] });
      s = play(s, "PANACEA");
      expect(playerPower(s, "ARTIFACT")).toBe(n);
      expect(pileNames(s, "exhaust")).toEqual(["PANACEA"]);
    }
  });
});

describe("PANIC_BUTTON / NO_BLOCK", () => {
  test("block 30 (40 upgraded); no card block this turn and next", () => {
    for (const [up, blk] of [
      [0, 30],
      [1, 40],
    ] as const) {
      let s = fight({
        deck: [{ defId: "PANIC_BUTTON", upgrades: up }, "GOOD_INSTINCTS", "DEFEND_RED", "STRIKE_RED", "STRIKE_RED"],
      });
      s = play(s, "PANIC_BUTTON");
      expect(s.combat!.player.block).toBe(blk);
      expect(playerPower(s, "NO_BLOCK")).toBe(2);
      s = play(s, "GOOD_INSTINCTS");
      expect(s.combat!.player.block).toBe(blk); // no gain
      s = endTurn(s);
      expect(s.run.hp).toBe(80); // fully blocked
      s = play(s, "DEFEND_RED"); // turn 2: still blocked
      expect(s.combat!.player.block).toBe(0);
      expect(playerPower(s, "NO_BLOCK")).toBe(1);
      s = endTurn(s);
      expect(s.run.hp).toBe(70);
      s = play(s, "DEFEND_RED"); // turn 3: expired
      expect(s.combat!.player.block).toBe(5);
      expect(playerPower(s, "NO_BLOCK")).toBeUndefined();
    }
  });
});

describe("PURITY", () => {
  test("exhaust up to 3 (5 upgraded) chosen cards", () => {
    let s = fight({ deck: ["PURITY", ...strikes(4)] });
    s = play(s, "PURITY");
    const req = s.pending!.request as { min: number; max: number };
    expect(req.min).toBe(0);
    expect(req.max).toBe(3);
    s = choose(s, [0, 1]);
    expect(pileNames(s, "exhaust").length).toBe(3); // 2 chosen + Purity itself
    expect(handNames(s).length).toBe(2);

    let u = fight({ deck: [{ defId: "PURITY", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "PURITY");
    expect((u.pending!.request as { max: number }).max).toBe(5);
    u = choose(u, [0, 1, 2, 3]);
    expect(pileNames(u, "exhaust").length).toBe(5);
    expect(handNames(u).length).toBe(0);
  });
});

describe("SWIFT_STRIKE", () => {
  test("deal 7 (10 upgraded)", () => {
    for (const [up, dmg] of [
      [0, 7],
      [1, 10],
    ] as const) {
      let s = fight({ deck: [{ defId: "SWIFT_STRIKE", upgrades: up }, ...strikes(4)] });
      s = play(s, "SWIFT_STRIKE", 0);
      expect(monsterHp(s)).toBe(200 - dmg);
    }
  });
});

describe("TRIP", () => {
  test("base: 2 Vulnerable on the target; upgraded: ALL enemies", () => {
    let s = fight({ deck: ["TRIP", ...strikes(4)], monsters: ["T_TANK", "T_GUARD"] });
    s = play(s, "TRIP", 1);
    expect(monsterPower(s, "VULNERABLE", 1)).toBe(2);
    expect(monsterPower(s, "VULNERABLE", 0)).toBeUndefined();

    let u = fight({ deck: [{ defId: "TRIP", upgrades: 1 }, ...strikes(4)], monsters: ["T_TANK", "T_GUARD"] });
    u = play(u, "TRIP", 0);
    expect(monsterPower(u, "VULNERABLE", 0)).toBe(2);
    expect(monsterPower(u, "VULNERABLE", 1)).toBe(2);
  });
});

// --- rares ----------------------------------------------------------------------

describe("APOTHEOSIS", () => {
  test("upgrades every card in every pile for the combat; cost 2 (1 upgraded)", () => {
    for (const [up, energyLeft] of [
      [0, 0],
      [1, 1],
    ] as const) {
      let s = fight({ deck: [{ defId: "APOTHEOSIS", upgrades: up }, ...strikes(4)] });
      s = play(s, "STRIKE_RED", 0); // 6 dmg, one strike into discard
      s = play(s, "APOTHEOSIS");
      expect(s.combat!.player.energy).toBe(energyLeft);
      for (const pile of ["hand", "discard"] as const) {
        for (const iid of s.combat!.player.piles[pile]) {
          expect(s.combat!.cards[iid]!.upgrades).toBe(1);
        }
      }
      expect(instOf(s, "APOTHEOSIS", "exhaust").upgrades).toBe(up); // itself untouched (limbo)
      s = endTurn(s);
      s = play(s, "STRIKE_RED", 0); // upgraded strike now deals 9
      expect(monsterHp(s)).toBe(200 - 6 - 9);
    }
  });
});

describe("CHRYSALIS", () => {
  test("shuffle 3 (5 upgraded) random class Skills into draw, cost 0 this combat", () => {
    for (const [up, n] of [
      [0, 3],
      [1, 5],
    ] as const) {
      let s = fight({ deck: [{ defId: "CHRYSALIS", upgrades: up }, ...strikes(4)] });
      s = play(s, "CHRYSALIS");
      const draw = s.combat!.player.piles.draw;
      expect(draw.length).toBe(n);
      for (const iid of draw) {
        const c = s.combat!.cards[iid]!;
        const def = bundle.cards.get(c.defId)!;
        expect(def.type).toBe("skill");
        expect(def.color).toBe("red"); // class pool
        expect(["common", "uncommon", "rare"]).toContain(def.rarity);
        expect(c.cost).toBe(0);
        expect(c.costForTurn).toBe(0);
      }
    }
  });
});

describe("HAND_OF_GREED", () => {
  test("deal 20 (25); gold on fatal", () => {
    for (const [up, dmg] of [
      [0, 20],
      [1, 25],
    ] as const) {
      let s = fight({ deck: [{ defId: "HAND_OF_GREED", upgrades: up }, ...strikes(4)], monsters: ["T_FRAIL"] });
      s = play(s, "HAND_OF_GREED", 0);
      expect(s.combat!.monsters[0]!.isDead).toBe(true);
      expect(s.run.gold).toBe(99 + dmg); // gold == magic == damage numbers
    }
  });

  test("no gold when not fatal", () => {
    let s = fight({ deck: ["HAND_OF_GREED", ...strikes(4)] });
    s = play(s, "HAND_OF_GREED", 0);
    expect(monsterHp(s)).toBe(180);
    expect(s.run.gold).toBe(99);
  });
});

describe("MAGNETISM", () => {
  test("start of turn: add a random Colorless card to hand; cost 2 (1 upgraded)", () => {
    for (const [up, energyLeft] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fightWithInHand(["MAGNETISM"], { deck: [{ defId: "MAGNETISM", upgrades: up }, ...strikes(9)] });
      s = play(s, "MAGNETISM");
      expect(s.combat!.player.energy).toBe(energyLeft);
      expect(playerPower(s, "MAGNETISM")).toBe(1);
      s = endTurn(s);
      expect(handNames(s).length).toBe(6); // 5 drawn + 1 magnetism card
      const added = s.combat!.player.piles.hand.filter(
        (i) => bundle.cards.get(s.combat!.cards[i]!.defId)!.color === "colorless",
      );
      expect(added.length).toBe(1);
    }
  });
});

describe("MASTER_OF_STRATEGY", () => {
  test("draw 3 (4 upgraded); Exhaust", () => {
    for (const [up, n] of [
      [0, 3],
      [1, 4],
    ] as const) {
      let s = fightWithInHand(["MASTER_OF_STRATEGY"], {
        deck: [{ defId: "MASTER_OF_STRATEGY", upgrades: up }, ...strikes(9)],
      });
      s = play(s, "MASTER_OF_STRATEGY");
      expect(handNames(s).length).toBe(4 + n);
      expect(pileNames(s, "exhaust")).toEqual(["MASTER_OF_STRATEGY"]);
    }
  });
});

describe("MAYHEM", () => {
  test("start of turn: play the top card of the draw pile (not exhausted)", () => {
    let s = fightWithInHand(["MAYHEM"], { deck: ["MAYHEM", ...strikes(9)] });
    s = play(s, "MAYHEM");
    s = endTurn(s);
    expect(monsterHp(s)).toBe(194); // an auto-played Strike
    expect(pileNames(s, "discard")).toEqual(["STRIKE_RED"]);
    expect(pileNames(s, "exhaust").length).toBe(0);
    expect(handNames(s).length).toBe(5); // the auto-play doesn't consume the hand
  });

  test("upgraded costs 1", () => {
    let s = fightWithInHand(["MAYHEM"], { deck: [{ defId: "MAYHEM", upgrades: 1 }, ...strikes(9)] });
    s = play(s, "MAYHEM");
    expect(s.combat!.player.energy).toBe(2);
  });
});

describe("METAMORPHOSIS", () => {
  test("shuffle 3 (5 upgraded) random class Attacks into draw, cost 0 this combat", () => {
    for (const [up, n] of [
      [0, 3],
      [1, 5],
    ] as const) {
      let s = fight({ deck: [{ defId: "METAMORPHOSIS", upgrades: up }, ...strikes(4)] });
      s = play(s, "METAMORPHOSIS");
      const draw = s.combat!.player.piles.draw;
      expect(draw.length).toBe(n);
      for (const iid of draw) {
        const c = s.combat!.cards[iid]!;
        const def = bundle.cards.get(c.defId)!;
        expect(def.type).toBe("attack");
        expect(def.color).toBe("red");
        expect(c.cost).toBe(0);
        expect(c.costForTurn).toBe(0);
      }
    }
  });
});

describe("PANACHE", () => {
  test("every 5 cards played in a turn deal 10 (14 upgraded) to ALL; counter resets each turn", () => {
    for (const [up, dmg] of [
      [0, 10],
      [1, 14],
    ] as const) {
      let s = fight({
        deck: [{ defId: "PANACHE", upgrades: up }, "GOOD_INSTINCTS", "GOOD_INSTINCTS", "GOOD_INSTINCTS", "GOOD_INSTINCTS"],
      });
      s = play(s, "PANACHE"); // counts as card 1 of 5
      s = play(s, "GOOD_INSTINCTS");
      s = play(s, "GOOD_INSTINCTS");
      s = play(s, "GOOD_INSTINCTS");
      expect(monsterHp(s)).toBe(200); // 4 played, counter at 1
      s = play(s, "GOOD_INSTINCTS"); // 5th card
      expect(monsterHp(s)).toBe(200 - dmg);
      s = endTurn(s);
      // counter reset: 4 more plays don't proc
      s = play(s, "GOOD_INSTINCTS");
      s = play(s, "GOOD_INSTINCTS");
      s = play(s, "GOOD_INSTINCTS");
      s = play(s, "GOOD_INSTINCTS");
      expect(monsterHp(s)).toBe(200 - dmg);
    }
  });
});

describe("SADISTIC_NATURE / SADISTIC", () => {
  test("applying a debuff to an enemy deals 5 (7 upgraded) to it", () => {
    for (const [up, x] of [
      [0, 5],
      [1, 7],
    ] as const) {
      let s = fight({ deck: [{ defId: "SADISTIC_NATURE", upgrades: up }, "BASH", ...strikes(3)] });
      s = play(s, "SADISTIC_NATURE");
      expect(playerPower(s, "SADISTIC")).toBe(x);
      s = play(s, "BASH", 0); // 8 damage + Vulnerable -> Sadistic proc (thorns, unmodified)
      expect(monsterPower(s, "VULNERABLE", 0)).toBe(2);
      expect(monsterHp(s)).toBe(200 - 8 - x);
    }
  });
});

describe("SECRET_TECHNIQUE", () => {
  test("put a Skill from the draw pile into your hand (auto-resolves 1 candidate)", () => {
    for (const up of [0, 1] as const) {
      let s = fightWithInHand(["SECRET_TECHNIQUE"], {
        deck: [{ defId: "SECRET_TECHNIQUE", upgrades: up }, ...defends(5)],
      });
      s = play(s, "SECRET_TECHNIQUE"); // exactly 1 skill in draw -> auto
      expect(handNames(s).filter((n) => n === "DEFEND_RED").length).toBe(5);
      expect(s.combat!.player.piles.draw.length).toBe(0);
      if (up) {
        expect(pileNames(s, "discard")).toContain("SECRET_TECHNIQUE");
      } else {
        expect(pileNames(s, "exhaust")).toContain("SECRET_TECHNIQUE");
      }
    }
  });

  test("multiple candidates pause for a choice", () => {
    let s = fightWithInHand(["SECRET_TECHNIQUE"], { deck: ["SECRET_TECHNIQUE", ...defends(9)] });
    s = play(s, "SECRET_TECHNIQUE");
    expect(s.pending?.request.kind).toBe("cards");
    s = choose(s, [0]);
    expect(handNames(s).length).toBe(5); // 4 + fetched
  });
});

describe("SECRET_WEAPON", () => {
  test("put an Attack from the draw pile into your hand", () => {
    for (const up of [0, 1] as const) {
      let s = fightWithInHand(["SECRET_WEAPON"], { deck: [{ defId: "SECRET_WEAPON", upgrades: up }, ...strikes(5)] });
      s = play(s, "SECRET_WEAPON"); // exactly 1 attack in draw -> auto
      expect(handNames(s).filter((n) => n === "STRIKE_RED").length).toBe(5);
      if (up) {
        expect(pileNames(s, "discard")).toContain("SECRET_WEAPON");
      } else {
        expect(pileNames(s, "exhaust")).toContain("SECRET_WEAPON");
      }
    }
  });
});

describe("THE_BOMB", () => {
  test("deal 40 (50 upgraded) to ALL at the end of the 3rd turn", () => {
    for (const [up, dmg] of [
      [0, 40],
      [1, 50],
    ] as const) {
      let s = fight({ deck: [{ defId: "THE_BOMB", upgrades: up }, ...strikes(4)] });
      s = play(s, "THE_BOMB");
      expect(playerPower(s, "THE_BOMB")).toBe(3);
      s = endTurn(s);
      expect(monsterHp(s)).toBe(200);
      s = endTurn(s);
      expect(monsterHp(s)).toBe(200);
      s = endTurn(s);
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(playerPower(s, "THE_BOMB")).toBeUndefined();
    }
  });

  test("two Bombs keep independent fuses", () => {
    let s = fight({ deck: ["THE_BOMB", "THE_BOMB", ...strikes(3)] });
    s = play(s, "THE_BOMB"); // turn 1
    s = endTurn(s);
    s = play(s, "THE_BOMB"); // turn 2
    s = endTurn(s); // bomb1 at 1, bomb2 at 2
    s = endTurn(s); // end of turn 3: bomb1 explodes
    expect(monsterHp(s)).toBe(160);
    expect(playerPower(s, "THE_BOMB")).toBe(1); // bomb2 still ticking
    s = endTurn(s); // end of turn 4: bomb2 explodes
    expect(monsterHp(s)).toBe(120);
    expect(playerPower(s, "THE_BOMB")).toBeUndefined();
  });
});

describe("THINKING_AHEAD", () => {
  test("draw 2, then put a hand card on top of the draw pile", () => {
    for (const up of [0, 1] as const) {
      let s = fightWithInHand(["THINKING_AHEAD"], {
        deck: [{ defId: "THINKING_AHEAD", upgrades: up }, "BASH", ...strikes(5)],
      });
      s = play(s, "THINKING_AHEAD"); // draws the whole remaining draw pile (2)
      expect(s.pending?.request.kind).toBe("cards");
      s = choose(s, [choiceIndexOf(s, "BASH")]);
      expect(s.combat!.cards[s.combat!.player.piles.draw[0]!]!.defId).toBe("BASH");
      expect(handNames(s).length).toBe(5);
      if (up) {
        expect(pileNames(s, "discard")).toContain("THINKING_AHEAD");
      } else {
        expect(pileNames(s, "exhaust")).toContain("THINKING_AHEAD");
      }
    }
  });
});

describe("TRANSMUTATION", () => {
  test("X random Colorless cards to hand, cost 0 this turn", () => {
    let s = fight({ deck: ["TRANSMUTATION", ...strikes(4)] });
    s = play(s, "TRANSMUTATION"); // X = 3
    expect(s.combat!.player.energy).toBe(0);
    const added = s.combat!.player.piles.hand.filter((i) => s.combat!.cards[i]!.defId !== "STRIKE_RED");
    expect(added.length).toBe(3);
    for (const iid of added) {
      const c = s.combat!.cards[iid]!;
      expect(bundle.cards.get(c.defId)!.color).toBe("colorless");
      expect(c.costForTurn).toBe(0);
      expect(c.upgrades).toBe(0);
    }
    expect(pileNames(s, "exhaust")).toEqual(["TRANSMUTATION"]);
  });

  test("upgraded: the X cards are Upgraded (with synced costs)", () => {
    let s = fight({ deck: [{ defId: "TRANSMUTATION", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "TRANSMUTATION");
    const added = s.combat!.player.piles.hand.filter((i) => s.combat!.cards[i]!.defId !== "STRIKE_RED");
    expect(added.length).toBe(3);
    for (const iid of added) {
      const c = s.combat!.cards[iid]!;
      expect(c.upgrades).toBe(1);
      expect(c.costForTurn).toBe(0);
      const def = bundle.cards.get(c.defId)!;
      expect(c.cost).toBe(def.upgradeValues.cost ?? def.cost);
    }
  });
});

describe("VIOLENCE", () => {
  test("put 3 (4 upgraded) random Attacks from draw into hand; Exhaust", () => {
    for (const [up, n] of [
      [0, 3],
      [1, 4],
    ] as const) {
      let s = fightWithInHand(["VIOLENCE"], { deck: [{ defId: "VIOLENCE", upgrades: up }, ...strikes(9)] });
      s = play(s, "VIOLENCE");
      expect(handNames(s).length).toBe(4 + n);
      expect(s.combat!.player.piles.draw.length).toBe(5 - n);
      expect(pileNames(s, "exhaust")).toEqual(["VIOLENCE"]);
    }
  });
});

// --- specials -------------------------------------------------------------------

describe("SHIV", () => {
  test("deal 4 (6 upgraded); Exhaust", () => {
    for (const [up, dmg] of [
      [0, 4],
      [1, 6],
    ] as const) {
      let s = fight({ deck: [{ defId: "SHIV", upgrades: up }, ...strikes(4)] });
      s = play(s, "SHIV", 0);
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(pileNames(s, "exhaust")).toEqual(["SHIV"]);
    }
  });
});

describe("MIRACLE", () => {
  test("gain 1 (2 upgraded) energy; Exhaust", () => {
    for (const [up, e] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "MIRACLE", upgrades: up }, ...strikes(4)] });
      s = play(s, "MIRACLE");
      expect(s.combat!.player.energy).toBe(3 + e);
      expect(pileNames(s, "exhaust")).toEqual(["MIRACLE"]);
    }
  });
});

describe("INSIGHT", () => {
  test("draw 2 (3 upgraded); Exhaust", () => {
    for (const [up, n] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fightWithInHand(["INSIGHT"], { deck: [{ defId: "INSIGHT", upgrades: up }, ...strikes(9)] });
      s = play(s, "INSIGHT");
      expect(handNames(s).length).toBe(4 + n);
      expect(pileNames(s, "exhaust")).toEqual(["INSIGHT"]);
    }
  });
});

describe("SMITE / SAFETY / THROUGH_VIOLENCE", () => {
  test("SMITE deals 12 (16 upgraded)", () => {
    for (const [up, dmg] of [
      [0, 12],
      [1, 16],
    ] as const) {
      let s = fight({ deck: [{ defId: "SMITE", upgrades: up }, ...strikes(4)] });
      s = play(s, "SMITE", 0);
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(pileNames(s, "exhaust")).toEqual(["SMITE"]);
    }
  });

  test("SAFETY blocks 12 (16 upgraded)", () => {
    for (const [up, blk] of [
      [0, 12],
      [1, 16],
    ] as const) {
      let s = fight({ deck: [{ defId: "SAFETY", upgrades: up }, ...strikes(4)] });
      s = play(s, "SAFETY");
      expect(s.combat!.player.block).toBe(blk);
      expect(pileNames(s, "exhaust")).toEqual(["SAFETY"]);
    }
  });

  test("THROUGH_VIOLENCE deals 20 (30 upgraded)", () => {
    for (const [up, dmg] of [
      [0, 20],
      [1, 30],
    ] as const) {
      let s = fight({ deck: [{ defId: "THROUGH_VIOLENCE", upgrades: up }, ...strikes(4)] });
      s = play(s, "THROUGH_VIOLENCE", 0);
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(pileNames(s, "exhaust")).toEqual(["THROUGH_VIOLENCE"]);
    }
  });

  test("the Retain tokens survive end of turn in hand", () => {
    let s = fight({ deck: ["MIRACLE", "SMITE", "SAFETY", "THROUGH_VIOLENCE", "INSIGHT"] });
    s = endTurn(s);
    expect([...handNames(s)].sort()).toEqual(["INSIGHT", "MIRACLE", "SAFETY", "SMITE", "THROUGH_VIOLENCE"]);
  });
});

describe("BETA / OMEGA", () => {
  test("BETA shuffles an Omega (Omega+ when upgraded) into the draw pile", () => {
    for (const up of [0, 1] as const) {
      let s = fight({ deck: [{ defId: "BETA", upgrades: up }, ...strikes(4)] });
      s = play(s, "BETA");
      expect(pileNames(s, "draw")).toEqual(["OMEGA"]);
      expect(instOf(s, "OMEGA", "draw").upgrades).toBe(up);
      expect(pileNames(s, "exhaust")).toEqual(["BETA"]);
    }
  });

  test("OMEGA deals 50 (60 upgraded) to ALL at end of turn", () => {
    for (const [up, dmg] of [
      [0, 50],
      [1, 60],
    ] as const) {
      let s = fight({ deck: [{ defId: "OMEGA", upgrades: up }, ...strikes(4)], monsters: ["T_TANK", "T_GUARD"] });
      s = play(s, "OMEGA"); // cost 3
      expect(playerPower(s, "OMEGA")).toBe(dmg);
      s = endTurn(s);
      expect(monsterHp(s, 0)).toBe(200 - dmg);
      expect(monsterHp(s, 1)).toBe(200 - dmg);
    }
  });
});

describe("EXPUNGER", () => {
  test("deals 9 (15 upgraded) X times, X carried in card.misc", () => {
    for (const [up, per] of [
      [0, 9],
      [1, 15],
    ] as const) {
      const s0 = fight({ deck: [{ defId: "EXPUNGER", upgrades: up }, ...strikes(4)] });
      const iid = s0.combat!.player.piles.hand.find((i) => s0.combat!.cards[i]!.defId === "EXPUNGER")!;
      s0.combat!.cards[iid]!.misc = 3; // Conjure Blade stores X in misc
      const s = play(s0, "EXPUNGER", 0);
      expect(monsterHp(s)).toBe(200 - 3 * per);
    }
  });

  test("misc 0 deals nothing", () => {
    let s = fight({ deck: ["EXPUNGER", ...strikes(4)] });
    s = play(s, "EXPUNGER", 0);
    expect(monsterHp(s)).toBe(200);
  });
});

describe("RITUAL_DAGGER", () => {
  test("fatal: permanently +3 (+5 upgraded) via card.misc AND the master deck", () => {
    for (const [up, bonus] of [
      [0, 3],
      [1, 5],
    ] as const) {
      let s = fight({ deck: [{ defId: "RITUAL_DAGGER", upgrades: up }, ...strikes(4)], monsters: ["T_FRAIL"] });
      s = play(s, "RITUAL_DAGGER", 0);
      expect(s.combat!.monsters[0]!.isDead).toBe(true);
      expect(instOf(s, "RITUAL_DAGGER", "exhaust").misc).toBe(bonus);
      expect(s.run.deck[0]!.misc).toBe(bonus); // masterIdx link
    }
  });

  test("non-fatal: base damage 15 + misc, no growth", () => {
    const s0 = fight({ deck: ["RITUAL_DAGGER", ...strikes(4)] });
    const iid = s0.combat!.player.piles.hand.find((i) => s0.combat!.cards[i]!.defId === "RITUAL_DAGGER")!;
    s0.combat!.cards[iid]!.misc = 6; // accumulated growth from earlier kills
    const s = play(s0, "RITUAL_DAGGER", 0);
    expect(monsterHp(s)).toBe(200 - 21);
    expect(instOf(s, "RITUAL_DAGGER", "exhaust").misc).toBe(6);
    expect(s.run.deck[0]!.misc).toBe(0);
  });
});

describe("APPARITION", () => {
  test("base: gain 1 Intangible; Ethereal; Exhaust", () => {
    let s = fight({ deck: ["APPARITION", "APPARITION", ...strikes(3)] });
    s = play(s, "APPARITION");
    expect(playerPower(s, "INTANGIBLE")).toBe(1);
    s = endTurn(s);
    expect(s.run.hp).toBe(79); // 10 -> 1 through Intangible
    expect(playerPower(s, "INTANGIBLE")).toBeUndefined(); // ticked at end of round
    expect([...pileNames(s, "exhaust")].sort()).toEqual(["APPARITION", "APPARITION"]); // played + ethereal copy
  });

  test("upgraded: no longer Ethereal", () => {
    let s = fight({
      deck: [{ defId: "APPARITION", upgrades: 1 }, { defId: "APPARITION", upgrades: 1 }, ...strikes(3)],
    });
    s = play(s, "APPARITION");
    expect(playerPower(s, "INTANGIBLE")).toBe(1); // still 1 (upgrade changes only Ethereal)
    s = endTurn(s);
    expect(pileNames(s, "exhaust")).toEqual(["APPARITION"]); // only the played copy
    expect(handNames(s)).toContain("APPARITION"); // survivor was discarded, then redrawn turn 2
  });
});

describe("JAX", () => {
  test("lose 3 HP, gain 2 (3 upgraded) Strength", () => {
    for (const [up, str] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fight({ deck: [{ defId: "JAX", upgrades: up }, ...strikes(4)] });
      s = play(s, "JAX");
      expect(s.run.hp).toBe(77);
      expect(playerPower(s, "STRENGTH")).toBe(str);
    }
  });
});

describe("BITE", () => {
  test("deal 7 (8 upgraded), heal 2 (3 upgraded)", () => {
    for (const [up, dmg, heal] of [
      [0, 7, 2],
      [1, 8, 3],
    ] as const) {
      let s = fight({ deck: [{ defId: "BITE", upgrades: up }, ...strikes(4)], hp: 50 });
      s = play(s, "BITE", 0);
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(s.run.hp).toBe(50 + heal);
    }
  });
});

describe("unobtainable specials", () => {
  test("BECOME_ALMIGHTY / FAME_AND_FORTUNE / LIVE_FOREVER are unplayable (cost -2)", () => {
    const s = fight({ deck: ["BECOME_ALMIGHTY", "FAME_AND_FORTUNE", "LIVE_FOREVER", ...strikes(2)] });
    for (const id of ["BECOME_ALMIGHTY", "FAME_AND_FORTUNE", "LIVE_FOREVER"]) {
      expect(() => play(s, id)).toThrow("unplayable");
    }
  });
});
