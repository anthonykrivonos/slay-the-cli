// "Upon pickup" boss relics (src/content/relics/pickup.ts): the effects that
// fire the moment the relic is obtained. Driver: createRun, then inject
// run.room = {kind:"rewards", ...} with a bossRelic entry (legitimate test
// surgery on plain state) and take it through the real command path, so
// addRelic -> onEquip runs exactly as it does after a boss fight.

import { test, expect, describe } from "bun:test";
import { createRun, advance, type GameState } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content/index";
import type { CharacterId } from "../../src/engine/core/ids";
import type { RewardEntry } from "../../src/engine/run/runState";

const bundle = buildBaseContentBundle();

function rewardsOf(s: GameState): RewardEntry[] {
  const room = s.run.room!;
  if (room.kind !== "rewards") throw new Error(`expected a rewards screen, got ${room.kind}`);
  return room.entries;
}

const deckIds = (s: GameState): string[] => s.run.deck.map((c) => c.defId);
const upgradeCount = (s: GameState): number => s.run.deck.reduce((n, c) => n + c.upgrades, 0);

/** Take a boss relic off a boss reward screen (the act-1 boss chest path). */
function takeBossRelic(
  seed: string,
  id: string,
  opts?: { character?: CharacterId; mutate?: (s: GameState) => void },
): GameState {
  const s = createRun({ seed, bundle, character: opts?.character ?? "IRONCLAD" });
  opts?.mutate?.(s);
  s.run.room = { kind: "rewards", entries: [{ kind: "bossRelic", group: 0, id, taken: false }], source: "boss" };
  return advance(s, { cmd: "takeReward", i: 0 }, bundle);
}

/** Take the Neow boss swap (option 3 is always BOSS_RELIC / LOSE_STARTER_RELIC). */
function neowBossSwap(seed: string, id: string): GameState {
  const s = createRun({ seed, bundle, character: "IRONCLAD" });
  s.run.pools.bossRelics.unshift(id);
  return advance(s, { cmd: "neowPick", i: 3 }, bundle);
}

describe("Empty Cage", () => {
  test("asks for exactly 2 removals and removes the chosen cards", () => {
    let s = takeBossRelic("PICK1", "EMPTY_CAGE");
    const req = s.pending!.request;
    expect(req.kind).toBe("cards");
    if (req.kind !== "cards") throw new Error("unreachable");
    expect(req.min).toBe(2);
    expect(req.max).toBe(2);
    expect(req.canCancel).toBe(false);
    expect(req.iids).toEqual(s.run.deck.map((_, i) => i)); // nothing bottled yet

    s = advance(s, { cmd: "choose", indices: [0, 9] }, bundle);
    expect(s.pending).toBeNull();
    expect(s.run.deck.length).toBe(8);
    expect(deckIds(s)).not.toContain("BASH"); // deck index 9
    expect(deckIds(s).filter((id) => id === "STRIKE_RED").length).toBe(4);
  });

  test("the pick skips bottled cards, and the choice indexes the offered list", () => {
    let s = takeBossRelic("PICK2", "EMPTY_CAGE", { mutate: (g) => (g.run.deck[0]!.bottled = true) });
    const req = s.pending!.request;
    if (req.kind !== "cards") throw new Error("unreachable");
    expect(req.iids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    s = advance(s, { cmd: "choose", indices: [0, 1] }, bundle); // the first two OFFERED
    expect(s.run.deck.length).toBe(8);
    expect(s.run.deck[0]!.bottled).toBe(true); // the bottled Strike survived
    expect(deckIds(s).filter((id) => id === "STRIKE_RED").length).toBe(3);
  });

  test("a deck with nothing removable is a silent no-op", () => {
    const s = takeBossRelic("PICK3", "EMPTY_CAGE", { mutate: (g) => (g.run.deck = []) });
    expect(s.pending).toBeNull();
    expect(s.run.relics.map((r) => r.defId)).toContain("EMPTY_CAGE");
  });
});

describe("Astrolabe", () => {
  test("transforms 3 chosen cards and upgrades the replacements", () => {
    let s = takeBossRelic("PICK4", "ASTROLABE");
    const req = s.pending!.request;
    if (req.kind !== "cards") throw new Error("unreachable");
    expect(req.min).toBe(3);
    expect(req.max).toBe(3);

    const before = deckIds(s).length;
    s = advance(s, { cmd: "choose", indices: [0, 1, 9] }, bundle);
    expect(s.run.deck.length).toBe(before);
    expect(deckIds(s)).not.toContain("BASH");
    // the 3 replacements are upgraded class cards (transform draws the class
    // pool at every rarity)
    const fresh = s.run.deck.slice(-3);
    expect(fresh.every((c) => c.upgrades === 1)).toBe(true);
    for (const c of fresh) {
      const def = bundle.cards.get(c.defId)!;
      expect(def.color).toBe("red");
      expect(["common", "uncommon", "rare"]).toContain(def.rarity);
    }
  });
});

describe("Calling Bell", () => {
  test("obtains Curse of the Bell and 3 relics onto the same screen", () => {
    const s = takeBossRelic("PICK5", "CALLING_BELL");
    expect(deckIds(s)).toContain("CURSE_OF_THE_BELL");

    const relics = rewardsOf(s).filter((e) => e.kind === "relic");
    expect(relics.length).toBe(3);
    const tiers = relics.map((e) => bundle.relics.get((e as { id: string }).id)!.tier);
    expect(tiers).toEqual(["common", "uncommon", "rare"]);
    // the boss screen is kept (leaving it still runs the act transition)
    const room = s.run.room!;
    expect(room.kind === "rewards" && room.source).toBe("boss");
  });

  test("relics come off the run-start pools, and bottles are rerolled past", () => {
    let uncommonBefore = 0;
    const s = takeBossRelic("PICK6", "CALLING_BELL", {
      mutate: (g) => {
        g.run.pools.uncommonRelics.unshift("BOTTLED_FLAME");
        uncommonBefore = g.run.pools.uncommonRelics.length;
      },
    });
    const ids = rewardsOf(s)
      .filter((e) => e.kind === "relic")
      .map((e) => (e as { id: string }).id);
    expect(ids).not.toContain("BOTTLED_FLAME"); // needs a screen of its own
    // the rerolled bottle is consumed too, so the pool loses two
    expect(s.run.pools.uncommonRelics.length).toBe(uncommonBefore - 2);
    expect(s.run.pools.commonRelics.length).toBe(createRun({ seed: "PICK6", bundle, character: "IRONCLAD" }).run.pools.commonRelics.length - 1);
  });
});

describe("Pandora's Box", () => {
  test("transforms every starter Strike and Defend, and nothing else", () => {
    const s = takeBossRelic("PICK7", "PANDORAS_BOX");
    const ids = deckIds(s);
    expect(ids.length).toBe(10);
    expect(ids).toContain("BASH");
    expect(ids).not.toContain("STRIKE_RED");
    expect(ids).not.toContain("DEFEND_RED");
    for (const c of s.run.deck) {
      const def = bundle.cards.get(c.defId)!;
      expect(def.color).toBe("red");
      expect(c.upgrades).toBe(0); // Pandora's replacements are not upgraded
    }
  });

  test("runs for every class off that class's pool", () => {
    for (const [character, color] of [
      ["SILENT", "green"],
      ["DEFECT", "blue"],
      ["WATCHER", "purple"],
    ] as const) {
      const s = takeBossRelic("PICK8", "PANDORAS_BOX", { character });
      const starters = deckIds(s).filter((id) => id.startsWith("STRIKE_") || id.startsWith("DEFEND_"));
      expect(starters).toEqual([]);
      for (const c of s.run.deck) {
        const def = bundle.cards.get(c.defId)!;
        if (def.rarity === "basic") continue; // the class's non-strike starters
        expect(def.color).toBe(color);
      }
    }
  });
});

describe("Tiny House", () => {
  test("upgrades 1 card, raises max HP by 5, and adds gold, a potion and a card group", () => {
    const before = createRun({ seed: "PICK9", bundle, character: "IRONCLAD" });
    const s = takeBossRelic("PICK9", "TINY_HOUSE", { mutate: (g) => (g.run.hp = 50) });

    expect(s.run.maxHp).toBe(before.run.maxHp + 5);
    expect(s.run.hp).toBe(55); // playerIncreaseMaxHp heals the same amount
    expect(upgradeCount(s)).toBe(1);

    const entries = rewardsOf(s);
    expect(entries.filter((e) => e.kind === "gold")).toEqual([{ kind: "gold", amount: 50, taken: false }]);
    expect(entries.filter((e) => e.kind === "potion").length).toBe(1);
    const cards = entries.filter((e) => e.kind === "card");
    expect(cards.length).toBe(3);
    // a fresh group id: taking a card must not mark the boss relic group taken
    expect(cards.every((e) => (e as { group: number }).group !== 0)).toBe(true);
    expect(s.run.potions).toEqual([null, null, null]); // the potion is a reward, not a grant
  });

  test("the potion is a uniform miscRng draw, not the potionRng reward roll", () => {
    const before = createRun({ seed: "PICKA", bundle, character: "IRONCLAD" });
    const s = takeBossRelic("PICKA", "TINY_HOUSE");
    expect(s.rng.run.potionRng.counter).toBe(before.rng.run.potionRng.counter);
    expect(s.rng.floor.miscRng.counter).toBeGreaterThan(before.rng.floor.miscRng.counter);
  });
});

describe("boss relics that replace a starter", () => {
  const cases = [
    ["BLACK_BLOOD", "BURNING_BLOOD", "IRONCLAD"],
    ["RING_OF_THE_SERPENT", "RING_OF_THE_SNAKE", "SILENT"],
    ["FROZEN_CORE", "CRACKED_CORE", "DEFECT"],
    ["HOLY_WATER", "PURE_WATER", "WATCHER"],
  ] as const;

  for (const [relic, starter, character] of cases) {
    test(`${relic} removes ${starter} on pickup`, () => {
      const s = takeBossRelic("PICKB", relic, { character });
      const ids = s.run.relics.map((r) => r.defId);
      expect(ids).toContain(relic);
      expect(ids).not.toContain(starter);
    });
  }
});

describe("Neow's boss swap", () => {
  // github.com/anthonykrivonos/slay-the-cli/issues/4: the swap pushed the relic
  // straight onto the bar, so no "Upon pickup" line ever fired.
  test("fires the pickup and keeps the screen it opened", () => {
    const s = neowBossSwap("SPIRE2", "CALLING_BELL");
    expect(s.run.relics.map((r) => r.defId)).toEqual(["CALLING_BELL"]); // starter swapped out
    expect(deckIds(s)).toContain("CURSE_OF_THE_BELL");
    expect(rewardsOf(s).filter((e) => e.kind === "relic").length).toBe(3);
    const room = s.run.room!;
    expect(room.kind === "rewards" && room.source).toBe("relic"); // leaving goes to the map
  });

  test("a pickup that asks for a pick pauses at Neow", () => {
    let s = neowBossSwap("SPIRE2", "EMPTY_CAGE");
    expect(s.pending?.request.kind).toBe("cards");
    s = advance(s, { cmd: "choose", indices: [0, 1] }, bundle);
    expect(s.run.deck.length).toBe(8);
    expect(s.run.room!.kind).toBe("map");
  });

  test("a screenless pickup still leaves for the map", () => {
    const s = neowBossSwap("SPIRE2", "SNECKO_EYE");
    expect(s.run.room!.kind).toBe("map");
  });

  test("the common and rare relic bonuses equip too", () => {
    // Strawberry is +7 max HP on pickup; Mango is +14.
    for (const [bonus, relic, gain] of [
      ["RANDOM_COMMON_RELIC", "STRAWBERRY", 7],
      ["ONE_RARE_RELIC", "MANGO", 14],
    ] as const) {
      const base = createRun({ seed: "PICKC", bundle, character: "IRONCLAD" });
      const room = base.run.room!;
      if (room.kind !== "neow") throw new Error("expected Neow");
      room.options[1] = { bonus, drawback: "NONE" };
      base.run.pools.commonRelics.unshift(relic);
      base.run.pools.rareRelics.unshift(relic);
      const s = advance(base, { cmd: "neowPick", i: 1 }, bundle);
      expect(s.run.relics.map((r) => r.defId)).toContain(relic);
      expect(s.run.maxHp).toBe(base.run.maxHp + gain);
      expect(s.run.hp).toBe(base.run.hp + gain);
    }
  });
});
