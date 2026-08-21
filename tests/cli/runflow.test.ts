// Headless smoke of the run UI's screen-level logic: the pure command
// builders / legality helpers in src/cli/text/runlogic.ts drive a scripted run
// through neow -> map -> combat -> rewards -> map with the real engine.
// (Ported from tests/ui/runflow.test.ts with import paths only; the
// seedFromSearch assertions went with the web UI's URL parsing.)

import { test, expect, describe } from "bun:test";
import { createRun, advance, type GameState } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content";
import { getIntents } from "../../src/engine/combat/intents";
import { legalCommands } from "../fuzz/helpers";
import {
  PRESET_SEEDS,
  cycleSeed,
  bumpSeed,
  validateSavedRun,
  legalMapPicks,
  BOSS_DOOR_Y,
  mapGlyph,
  costText,
  masterCardCost,
  canSmithMaster,
  smithableDeckIndices,
  restHealPreview,
  rewardLabel,
  rewardBlocked,
  rewardRows,
  neowBonusText,
  neowDrawbackText,
  describeChoiceReason,
  chestLootSummary,
  chestTitle,
  titleCase,
} from "../../src/cli/text/runlogic";

const bundle = buildBaseContentBundle();

describe("pure helpers", () => {
  test("seed handling", () => {
    expect(PRESET_SEEDS.length).toBeGreaterThan(2);
    expect(cycleSeed(PRESET_SEEDS[0]!)).toBe(PRESET_SEEDS[1]!);
    expect(cycleSeed("SOMETHING_CUSTOM")).toBe(PRESET_SEEDS[0]!); // custom cycles into presets
    expect(cycleSeed(PRESET_SEEDS[PRESET_SEEDS.length - 1]!)).toBe(PRESET_SEEDS[0]!);
    expect(bumpSeed("SPIRE")).toBe("SPIRE-2");
    expect(bumpSeed("SPIRE-2")).toBe("SPIRE-3");
  });

  test("display helpers", () => {
    expect(mapGlyph("monster")).toBe("M");
    expect(mapGlyph("elite")).toBe("E");
    expect(mapGlyph("shop")).toBe("$");
    expect(mapGlyph("rest")).toBe("R");
    expect(mapGlyph("treasure")).toBe("T");
    expect(mapGlyph("unknown")).toBe("?");
    expect(costText(-1)).toBe("X");
    expect(costText(-2)).toBe("-");
    expect(costText(2)).toBe("2");
    expect(titleCase("JAW_WORM")).toBe("Jaw Worm");
    expect(chestTitle("small")).toBe("Small Chest");
    expect(neowBonusText("HUNDRED_GOLD")).toBe("Gain 100 gold");
    expect(neowDrawbackText("NO_GOLD")).toBe("Lose all of your gold");
    expect(neowDrawbackText("NONE")).toBe("");
    expect(describeChoiceReason("neow:remove")).toBe("Choose cards to remove");
    expect(describeChoiceReason("Warcry")).toBe("Warcry"); // combat reasons pass through
  });

  test("master card cost respects upgrade cost deltas", () => {
    const bash = bundle.cards.get("BASH")!;
    expect(masterCardCost(bash, 0)).toBe(bash.cost);
    // BODY_SLAM upgrades 1 -> 0 cost in the corpus
    const bodySlam = bundle.cards.get("BODY_SLAM");
    if (bodySlam && bodySlam.upgradeValues.cost !== undefined) {
      expect(masterCardCost(bodySlam, 1)).toBe(bodySlam.upgradeValues.cost);
    }
  });

  test("save validation is structural", () => {
    expect(validateSavedRun(null)).toBeNull();
    expect(validateSavedRun({})).toBeNull();
    expect(validateSavedRun({ version: 1 })).toBeNull();
    expect(validateSavedRun("nope")).toBeNull();
    const s = createRun({ seed: "SAVECHK", bundle, character: "IRONCLAD" });
    const roundTripped: unknown = JSON.parse(JSON.stringify(s));
    expect(validateSavedRun(roundTripped)).not.toBeNull();
    // single-combat demo saves (no run.room) are rejected
    const demoish = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete (demoish["run"] as Record<string, unknown>)["room"];
    expect(validateSavedRun(demoish)).toBeNull();
  });

  test("rest heal preview: 30% of max, capped by missing HP", () => {
    const s = createRun({ seed: "RESTCHK", bundle, character: "IRONCLAD" });
    // fresh Ironclad at full HP heals 0
    expect(restHealPreview(s.run)).toBe(0);
    const hurt = structuredClone(s.run);
    hurt.hp = 50;
    expect(restHealPreview(hurt)).toBe(24); // floor(80*0.3)
    hurt.hp = 79;
    expect(restHealPreview(hurt)).toBe(1);
  });

  test("smith helpers mirror engine canSmith", () => {
    const s = createRun({ seed: "SMITHCHK", bundle, character: "IRONCLAD" });
    const idxs = smithableDeckIndices(s.run, bundle);
    expect(idxs.length).toBe(s.run.deck.length); // starter deck: all upgradeable
    const upgraded = structuredClone(s.run.deck[0]!);
    upgraded.upgrades = 1;
    expect(canSmithMaster(bundle, upgraded)).toBe(false); // strikes don't multi-upgrade
  });

  test("chest loot summary diffs run state", () => {
    const before = createRun({ seed: "LOOTCHK", bundle, character: "IRONCLAD" });
    const after = structuredClone(before);
    after.run.gold += 25;
    after.run.relics.push({ defId: "ANCHOR", counter: 0 });
    expect(chestLootSummary(before, after, bundle)).toBe("Found: 25 gold, Anchor");
    const keyed = structuredClone(before);
    keyed.run.keys.sapphire = true;
    expect(chestLootSummary(before, keyed, bundle)).toBe("Found: the Sapphire Key");
    expect(chestLootSummary(before, structuredClone(before), bundle)).toBe("The chest was empty.");
  });
});

describe("scripted run: neow -> map -> combat -> rewards -> map", () => {
  test("UI command builders drive the engine through the loop", () => {
    let s = createRun({ seed: "UISMOKE", bundle, character: "IRONCLAD" });
    expect(s.run.room?.kind).toBe("neow");
    const neow = s.run.room!;
    if (neow.kind !== "neow") throw new Error("expected neow");
    expect(neow.options.length).toBe(4);
    for (const opt of neow.options) {
      expect(neowBonusText(opt.bonus).length).toBeGreaterThan(0); // words, not enum ids
      expect(neowBonusText(opt.bonus)).not.toContain("_");
    }

    // option 1 is always a bonus-only tier-1 pick (no follow-up choice)
    s = advance(s, { cmd: "neowPick", i: 1 }, bundle);
    expect(s.run.room?.kind).toBe("map");

    // map legality: fresh position offers only row-0 nodes
    const picks = legalMapPicks(s.run);
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) expect(p.y).toBe(0);

    s = advance(s, { cmd: "mapPick", ...picks[0]! }, bundle);
    expect(s.run.room?.kind).toBe("combat");
    expect(s.run.floor).toBe(1);

    // the combat screen's intent readout has live numbers for attack moves
    const intents = getIntents(s, bundle);
    expect(intents.length).toBe(s.combat!.monsters.length);
    for (const info of intents) {
      if (!info) continue;
      expect(typeof info.kind).toBe("string");
      if (info.damage !== null) {
        expect(info.damage).toBeGreaterThanOrEqual(0);
        expect(info.hits).toBeGreaterThanOrEqual(1);
      }
    }
    const before = JSON.stringify(s);
    getIntents(s, bundle); // must be read-only for the render loop
    expect(JSON.stringify(s)).toBe(before);

    // drive the fight greedily (mirrors the combat screen's tap flow)
    let guard = 0;
    while (s.run.room?.kind === "combat" && !s.outcome && guard++ < 300) {
      const legal = legalCommands(s, bundle);
      const cmd = legal.find((c) => c.cmd === "playCard") ?? legal[0]!;
      s = advance(s, cmd, bundle);
    }
    expect(s.run.room?.kind).toBe("rewards");
    const rewards = s.run.room!;
    if (rewards.kind !== "rewards") throw new Error("expected rewards");

    // reward rows group the card choice; labels resolve to names
    const rows = rewardRows(rewards.entries);
    const group = rows.find((r) => r.type === "group");
    expect(group).toBeDefined();
    if (group && group.type === "group") expect(group.items.length).toBe(3);
    for (const e of rewards.entries) expect(rewardLabel(e, bundle).length).toBeGreaterThan(0);

    // take everything takeable (gold, potion if room, one card of the group)
    for (let i = 0; i < rewards.entries.length; i++) {
      const room = s.run.room;
      if (room?.kind !== "rewards") break;
      const e = room.entries[i]!;
      if (rewardBlocked(e, s.run) !== null) continue;
      s = advance(s, { cmd: "takeReward", i }, bundle);
    }
    const roomAfter = s.run.room;
    if (roomAfter?.kind === "rewards") {
      for (const e of roomAfter.entries) {
        // everything left is taken or legitimately blocked (e.g. full belt)
        expect(rewardBlocked(e, s.run)).not.toBeNull();
      }
    }
    expect(s.run.deck.length).toBe(11); // starter 10 + 1 reward card

    s = advance(s, { cmd: "skipRewards" }, bundle);
    expect(s.run.room?.kind).toBe("map");

    // next legal picks come from the current node's edges, one row up
    const next = legalMapPicks(s.run);
    expect(next.length).toBeGreaterThan(0);
    for (const p of next) expect(p.y).toBe(1);

    // save round trip of the mid-run state
    expect(validateSavedRun(JSON.parse(JSON.stringify(s)))).not.toBeNull();
  });

  test("neow deck-choice flows surface as custom-pile pendings", () => {
    // NW0's first option is REMOVE_CARD (verified deterministic)
    let s = createRun({ seed: "NW0", bundle, character: "IRONCLAD" });
    const room = s.run.room!;
    if (room.kind !== "neow") throw new Error("expected neow");
    expect(room.options[0]!.bonus).toBe("REMOVE_CARD");
    const before = s.run.deck.length;
    s = advance(s, { cmd: "neowPick", i: 0 }, bundle);
    expect(s.pending?.request.kind).toBe("cards");
    const req = s.pending!.request;
    if (req.kind !== "cards") throw new Error("expected cards request");
    expect(req.pile).toBe("custom"); // deck indices, not combat iids
    expect(describeChoiceReason(req.reason)).toBe("Choose cards to remove");
    s = advance(s, { cmd: "choose", indices: [0] }, bundle);
    expect(s.pending).toBeNull();
    expect(s.run.deck.length).toBe(before - 1);
    expect(s.run.room?.kind).toBe("map");
  });

  test("boss door pick appears only from the top row", () => {
    const s = createRun({ seed: "DOOR", bundle, character: "IRONCLAD" });
    const run = structuredClone(s.run);
    run.position = [3, 14];
    const picks = legalMapPicks(run);
    expect(picks).toEqual([{ x: 3, y: BOSS_DOOR_Y }]);
    run.position = [3, 7];
    for (const p of legalMapPicks(run)) expect(p.y).toBe(8);
  });
});
