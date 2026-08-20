// Headless smoke of the full-parity UI surface: character/ascension menu
// logic, all-4-characters run starts (asc 0 and 20) through neow -> map ->
// first fight via the screen-level command builders, the real event screen
// view (buildEventScreen over a read-only ctx), stance/mantra/orb readouts,
// keys + recall, and the game-over banner text.

import { test, expect, describe } from "bun:test";
import { createRun, createCombatGame, advance, type GameState } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content";
import {
  CHARACTER_IDS,
  type UICharacterId,
  isCharacterId,
  CHARACTER_COLORS,
  characterSummary,
  MAX_ASCENSION,
  clampAscension,
  ASCENSION_LABELS,
  ascensionLabel,
  legalMapPicks,
  buildEventView,
  stanceColor,
  orbColor,
  playerFocus,
  orbDisplayValue,
  orbName,
  keyViews,
  canRecall,
  gameOverTitle,
  gameOverSubtitle,
  gameOverStats,
  MENU_SEED_KEY,
  MENU_CHARACTER_KEY,
  MENU_ASCENSION_KEY,
  RUN_SAVE_KEY,
} from "../../src/ui/runlogic";

const bundle = buildBaseContentBundle();

describe("menu: characters + ascension", () => {
  test("all four characters summarize with name, HP, and starting relic", () => {
    expect(CHARACTER_IDS).toEqual(["IRONCLAD", "SILENT", "DEFECT", "WATCHER"]);
    const expected: Record<UICharacterId, [string, number, string]> = {
      IRONCLAD: ["Ironclad", 80, "Burning Blood"],
      SILENT: ["Silent", 70, "Ring of the Snake"],
      DEFECT: ["Defect", 75, "Cracked Core"],
      WATCHER: ["Watcher", 72, "Pure Water"],
    };
    for (const id of CHARACTER_IDS) {
      const s = characterSummary(bundle, id);
      expect(s.name).toBe(expected[id][0]);
      expect(s.maxHp).toBe(expected[id][1]);
      expect(s.relic).toBe(expected[id][2]);
      expect(CHARACTER_COLORS[id]).toMatch(/^#/);
    }
    expect(isCharacterId("DEFECT")).toBe(true);
    expect(isCharacterId("defect")).toBe(false);
    expect(isCharacterId(null)).toBe(false);
  });

  test("ascension labels cover 0..20 and clamp parses stored strings", () => {
    expect(MAX_ASCENSION).toBe(20);
    expect(ASCENSION_LABELS.length).toBe(21);
    for (const label of ASCENSION_LABELS) expect(label.length).toBeGreaterThan(0);
    expect(ascensionLabel(0)).toBe("The standard climb");
    expect(ascensionLabel(20)).toBe("Face two bosses at the end of Act 3");
    expect(clampAscension("7")).toBe(7);
    expect(clampAscension(25)).toBe(20);
    expect(clampAscension(-3)).toBe(0);
    expect(clampAscension("garbage")).toBe(0);
    expect(clampAscension(null)).toBe(0);
    expect(ascensionLabel(99)).toBe(ascensionLabel(20)); // out-of-range clamps
  });

  test("menu pref keys are distinct from the run save key", () => {
    const keys = [MENU_SEED_KEY, MENU_CHARACTER_KEY, MENU_ASCENSION_KEY, RUN_SAVE_KEY];
    expect(new Set(keys).size).toBe(4);
    expect(RUN_SAVE_KEY).toBe("slay.run.save"); // save key must not change
  });
});

describe("run start: every character at asc 0 and asc 20 reaches the first fight", () => {
  function throughFirstFight(character: UICharacterId, ascension: number): GameState {
    let s = createRun({ seed: `UI-${character}-${ascension}`, bundle, character, ascension });
    expect(s.run.character).toBe(character);
    expect(s.run.ascension).toBe(ascension);
    expect(s.run.room?.kind).toBe("neow");

    // option 1 is a bonus-only tier-1 pick, but stay robust to follow-ups
    s = advance(s, { cmd: "neowPick", i: 1 }, bundle);
    let guard = 0;
    while (s.run.room?.kind !== "map" && guard++ < 10) {
      if (s.pending) {
        const req = s.pending.request;
        const min = req.kind === "cards" ? req.min : 1;
        s = advance(s, { cmd: "choose", indices: Array.from({ length: min }, (_, i) => i) }, bundle);
      } else if (s.run.room?.kind === "rewards") {
        s = advance(s, { cmd: "skipRewards" }, bundle);
      } else {
        break;
      }
    }
    expect(s.run.room?.kind).toBe("map");

    const picks = legalMapPicks(s.run);
    expect(picks.length).toBeGreaterThan(0);
    s = advance(s, { cmd: "mapPick", ...picks[0]! }, bundle);
    expect(s.run.room?.kind).toBe("combat");
    expect(s.combat).not.toBeNull();
    return s;
  }

  for (const character of CHARACTER_IDS) {
    for (const ascension of [0, 20]) {
      test(`${character} asc ${ascension}`, () => {
        const s = throughFirstFight(character, ascension);
        const p = s.combat!.player;
        expect(p.stance).toBe("NEUTRAL"); // everyone starts Neutral
        expect(p.mantra).toBe(0);
        if (character === "DEFECT") {
          expect(p.orbSlots).toBe(3);
          // Cracked Core channels a Lightning at battle start
          expect(p.orbs.length).toBeGreaterThanOrEqual(1);
          expect(p.orbs[0]!.id).toBe("LIGHTNING");
        } else {
          expect(p.orbSlots).toBe(0);
        }
        if (ascension >= 11) expect(s.run.potions.length).toBe(2); // A11 slot loss
        if (ascension >= 14) {
          const def = bundle.characters.get(character)!;
          expect(s.run.maxHp).toBe(def.maxHp - def.a14HpLoss); // A14 max HP loss
        }
        if (ascension >= 10) {
          expect(s.run.deck.some((mc) => mc.defId === "ASCENDERS_BANE")).toBe(true);
        }
      });
    }
  }
});

describe("event screen view (buildEventScreen over a read-only ctx)", () => {
  test("Big Fish renders summary + 3 enabled options; view is read-only", () => {
    const s = createRun({ seed: "EVTFISH", bundle, character: "IRONCLAD" });
    s.run.room = { kind: "event", eventId: "BIG_FISH" };
    const before = JSON.stringify(s);
    const view = buildEventView(s, bundle);
    expect(JSON.stringify(s)).toBe(before); // pure render
    expect(view).not.toBeNull();
    expect(view!.summary.length).toBeGreaterThan(10);
    expect(view!.options.length).toBe(3);
    for (const o of view!.options) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.enabled).toBe(true);
    }
    // choosing "Donut" applies the outcome and ends the event
    const maxHp = s.run.maxHp;
    const after = advance(s, { cmd: "eventOption", i: 1 }, bundle);
    expect(after.run.maxHp).toBe(maxHp + 5);
    expect(after.run.room?.kind).toBe("map");
  });

  test("The Cleric disables unaffordable options via enabled(ctx)", () => {
    const s = createRun({ seed: "EVTCLERIC", bundle, character: "IRONCLAD" });
    s.run.room = { kind: "event", eventId: "THE_CLERIC" };
    s.run.gold = 0;
    const view = buildEventView(s, bundle)!;
    expect(view.options.length).toBe(3);
    expect(view.options[0]!.enabled).toBe(false); // heal costs 35
    expect(view.options[1]!.enabled).toBe(false); // purify costs 50+
    expect(view.options[2]!.enabled).toBe(true); // leave
  });

  test("Golden Idol chains to its trap screen via room.screen (multi-screen)", () => {
    let s = createRun({ seed: "EVTIDOL", bundle, character: "IRONCLAD" });
    s.run.room = { kind: "event", eventId: "GOLDEN_IDOL" };
    const first = buildEventView(s, bundle)!;
    expect(first.options.filter((o) => o.enabled).length).toBe(2); // take / leave
    s = advance(s, { cmd: "eventOption", i: 0 }, bundle); // take the idol
    expect(s.run.relics.some((r) => r.defId === "GOLDEN_IDOL")).toBe(true);
    expect(s.run.room?.kind).toBe("event"); // still in the event: trap screen
    const trap = buildEventView(s, bundle)!;
    expect(trap.options[0]!.enabled).toBe(false); // can't take twice
    const trapChoices = trap.options.map((o, i) => ({ o, i })).filter((x) => x.o.enabled);
    expect(trapChoices.length).toBe(3); // outrun / smash / hide
    s = advance(s, { cmd: "eventOption", i: trapChoices[0]!.i }, bundle); // outrun
    expect(s.run.deck.some((mc) => mc.defId === "INJURY")).toBe(true);
    expect(s.run.room?.kind).toBe("map");
  });

  test("stub rooms (null / unknown event id) return null and keep the leave flow", () => {
    const s = createRun({ seed: "EVTSTUB", bundle, character: "IRONCLAD" });
    s.run.room = { kind: "event", eventId: null };
    expect(buildEventView(s, bundle)).toBeNull();
    const after = advance(s, { cmd: "eventOption", i: 0 }, bundle);
    expect(after.run.room?.kind).toBe("map");
  });
});

describe("combat readouts: stance, mantra, orbs", () => {
  test("Watcher's Eruption enters Wrath; stance colors match spec", () => {
    let s = createCombatGame({
      seed: "WRATH",
      bundle,
      character: "WATCHER",
      deck: [{ defId: "ERUPTION" }],
      monsters: ["JAW_WORM"],
    });
    expect(s.combat!.player.stance).toBe("NEUTRAL");
    s = advance(s, { cmd: "playCard", handIdx: 0, target: 0 }, bundle);
    expect(s.combat!.player.stance).toBe("WRATH");
    expect(stanceColor("CALM")).toBe("#7db8f0");
    expect(stanceColor("WRATH")).toBe("#e06a7a");
    expect(stanceColor("DIVINITY")).toBe("#ffd75e");
    expect(bundle.stances.get("WRATH")!.name).toBe("Wrath");
  });

  test("Defect's Zap channels Lightning; orb display values track Focus", () => {
    let s = createCombatGame({
      seed: "ORBS",
      bundle,
      character: "DEFECT",
      deck: [{ defId: "ZAP" }],
      monsters: ["JAW_WORM"],
    });
    expect(s.combat!.player.orbSlots).toBe(3);
    s = advance(s, { cmd: "playCard", handIdx: 0 }, bundle);
    const p = s.combat!.player;
    expect(p.orbs.length).toBe(1);
    expect(p.orbs[0]!.id).toBe("LIGHTNING");
    const focus = playerFocus(p.powers);
    expect(focus).toBe(0);
    expect(orbDisplayValue(bundle, p.orbs[0]!, focus)).toBe(3); // Lightning passive
    expect(orbName(bundle, "LIGHTNING")).toBe("Lightning");
  });

  test("orb display values: Frost/Lightning use Focus, Dark stores, Plasma is flat", () => {
    expect(orbDisplayValue(bundle, { id: "FROST", amount: 0 }, 2)).toBe(4); // 2 + focus
    expect(orbDisplayValue(bundle, { id: "LIGHTNING", amount: 0 }, -5)).toBe(0); // floored at 0
    expect(orbDisplayValue(bundle, { id: "DARK", amount: 14 }, 3)).toBe(14); // stored total
    expect(orbDisplayValue(bundle, { id: "PLASMA", amount: 0 }, 5)).toBe(1); // Focus never applies
    expect(orbDisplayValue(bundle, { id: "NOT_AN_ORB", amount: 0 }, 0)).toBeNull();
    for (const id of ["LIGHTNING", "FROST", "DARK", "PLASMA"]) {
      expect(orbColor(id)).toMatch(/^#/);
    }
  });

  test("focus reads the FOCUS power amount", () => {
    expect(playerFocus([])).toBe(0);
    expect(playerFocus([{ id: "FOCUS", amount: 3, justApplied: false, data: null }])).toBe(3);
  });
});

describe("act 4 map", () => {
  test("legalMapPicks walks the fixed rest/shop/elite/boss column", () => {
    const s = createRun({ seed: "ACT4MAP", bundle, character: "IRONCLAD" });
    const run = structuredClone(s.run);
    // mirror runFlow's act4ActMap: 15 empty rows, nodes at x=3 rows 0-3
    const rows: (import("../../src/engine/run/runState").MapNode | null)[][] = Array.from(
      { length: 15 },
      () => new Array<import("../../src/engine/run/runState").MapNode | null>(7).fill(null),
    );
    const kinds = ["rest", "shop", "elite", "boss"] as const;
    kinds.forEach((kind, y) => {
      rows[y]![3] = { x: 3, y, kind, edges: y < 3 ? [3] : [], burningElite: false, emeraldKey: false };
    });
    run.act = 4;
    run.map = { act: 4, rows, bossId: "THE_HEART" };
    run.position = null;
    expect(legalMapPicks(run)).toEqual([{ x: 3, y: 0 }]); // the rest site
    run.position = [3, 0];
    expect(legalMapPicks(run)).toEqual([{ x: 3, y: 1 }]); // shop
    run.position = [3, 2];
    expect(legalMapPicks(run)).toEqual([{ x: 3, y: 3 }]); // the Heart is a node, not a door
    run.position = [3, 3];
    expect(legalMapPicks(run)).toEqual([]); // nothing above the Heart
  });
});

describe("keys + recall + game over", () => {
  test("keyViews reflect ownership; recall takes the ruby key and uses the site", () => {
    let s = createRun({ seed: "RECALL", bundle, character: "IRONCLAD" });
    expect(keyViews(s.run).every((k) => !k.owned)).toBe(true);
    expect(keyViews(s.run).map((k) => k.key)).toEqual(["emerald", "ruby", "sapphire"]);

    s.run.room = { kind: "rest", used: false };
    expect(canRecall(s.run, false)).toBe(true);
    s = advance(s, { cmd: "restOption", kind: "recall" }, bundle);
    expect(s.run.keys.ruby).toBe(true);
    const room = s.run.room;
    if (room?.kind !== "rest") throw new Error("expected rest room");
    expect(room.used).toBe(true); // recall consumes the site
    expect(canRecall(s.run, room.used)).toBe(false);
    const ruby = keyViews(s.run).find((k) => k.key === "ruby")!;
    expect(ruby.owned).toBe(true);

    // once owned, a fresh unused site no longer offers recall
    expect(canRecall(s.run, false)).toBe(false);
  });

  test("game-over banner distinguishes the Heart from the act-3 door", () => {
    expect(gameOverTitle(true, 4)).toBe("THE HEART FALLS");
    expect(gameOverTitle(true, 3)).toBe("VICTORY");
    expect(gameOverTitle(false, 2)).toBe("DEFEAT");
    expect(gameOverSubtitle(true, 4)).toContain("Heart");
    expect(gameOverSubtitle(true, 3)).toContain("Act 3");
    const s = createRun({ seed: "GOSTATS", bundle, character: "WATCHER", ascension: 17 });
    const stats = gameOverStats(s, bundle);
    expect(stats).toContain("Watcher");
    expect(stats).toContain("Ascension 17");
    expect(stats).toContain(`seed ${s.seed}`);
  });
});
