// Frame snapshots + hard frame invariants.
//
// Snapshots: every fixture screen, rendered with THEME_PLAIN at 100x30 and
// 80x24 (plus one 79x24 too-small case), compared byte-for-byte against the
// checked-in .txt frames. Regenerate deliberately with:
//   bun tests/cli/gen-fixtures.ts
//
// Invariants (every fixture + a deterministic multi-seed sweep): exactly
// `rows` lines, ANSI-stripped width exactly `cols`, pure ASCII, no tabs -
// in both THEME_PLAIN and THEME_256.

import { test, expect, describe } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRun, advance, type GameState, type Command } from "../../src/engine/game";
import { legalCommands } from "../fuzz/helpers";
import { FIXTURES, bundle } from "./fixtures";
import { FIXTURE_DIR, SNAPSHOT_SIZES, renderFixture } from "./gen-fixtures";
import { buildView } from "../../src/cli/state/view";
import { renderFrame } from "../../src/cli/render/frame";
import { renderOverlay } from "../../src/cli/render/overlays";
import { THEME_PLAIN, THEME_256 } from "../../src/cli/render/theme";
import { stripAnsi } from "../../src/cli/term/ansi";
import { initialUiState, pushLog, type UiState, type Overlay } from "../../src/cli/state/uiState";
import { legalMapPicks, buildEventView } from "../../src/cli/text/runlogic";
import { formatEvent } from "../../src/cli/text/logfmt";

function readFixture(file: string): string {
  const path = join(FIXTURE_DIR, file);
  if (!existsSync(path)) {
    throw new Error(`missing fixture ${file} - run: bun tests/cli/gen-fixtures.ts`);
  }
  return readFileSync(path, "utf8").replace(/\n$/, "");
}

describe("frame snapshots", () => {
  for (const name of Object.keys(FIXTURES)) {
    for (const { cols, rows } of SNAPSHOT_SIZES) {
      test(`${name} @ ${cols}x${rows}`, () => {
        expect(renderFixture(name, cols, rows)).toBe(readFixture(`${name}.${cols}x${rows}.txt`));
      });
    }
  }
  test("too small @ 79x24", () => {
    expect(renderFixture("map-act1", 79, 24)).toBe(readFixture("too-small.79x24.txt"));
  });
});

// --- the inspect upgrade preview ------------------------------------------------
//
// github.com/anthonykrivonos/slay-the-cli/issues/17: a card reads as both of
// its printed states, current beside the other one.

describe("inspect: both upgrade states", () => {
  /** The inspect overlay for one deck card, with an optional deck edit first. */
  function inspectDeck(index: number, mutate?: (g: GameState) => void) {
    const { game, ui } = FIXTURES["map-act1"]!();
    const g = structuredClone(game!);
    mutate?.(g);
    const overlays: Overlay[] = [{ kind: "inspect", source: { of: "deck" }, index }];
    const overlay = buildView(g, { ...ui, overlays }, bundle).overlay;
    if (overlay?.kind !== "inspect") throw new Error("expected an inspect overlay");
    return overlay;
  }

  test("an un-upgraded card puts the upgrade on the right", () => {
    const o = inspectDeck(9); // Bash
    expect(o.name).toBe("Bash");
    expect(o.rules.join(" ")).toContain("Deal 8 damage.");
    expect(o.alt?.side).toBe("right");
    expect(o.alt?.name).toBe("Bash+");
    expect(o.alt?.rules.join(" ")).toContain("Deal 10 damage.");
  });

  test("an upgraded card is the right-hand box, and the base card the left", () => {
    const o = inspectDeck(9, (g) => (g.run.deck[9]!.upgrades = 1));
    expect(o.name).toBe("Bash+");
    expect(o.alt?.side).toBe("left");
    expect(o.alt?.name).toBe("Bash");
    expect(o.alt?.rules.join(" ")).toContain("Deal 8 damage.");
  });

  test("the alt carries the other state's printed cost", () => {
    // Body Slam upgrades 1 -> 0
    const o = inspectDeck(10, (g) => g.run.deck.push({ defId: "BODY_SLAM", upgrades: 0, misc: 0, bottled: false }));
    expect(o.cost).toBe("1");
    expect(o.alt?.cost).toBe("0");
  });

  test("the glossary follows the upgrade too", () => {
    const o = inspectDeck(9);
    expect(o.keywords.find((k) => k.name === "Vulnerable")?.text).toContain("2 turns");
    expect(o.alt?.keywords.find((k) => k.name === "Vulnerable")?.text).toContain("3 turns");
  });

  test("a curse has no second state, and neither does a relic", () => {
    const curse = inspectDeck(10, (g) => g.run.deck.push({ defId: "REGRET", upgrades: 0, misc: 0, bottled: false }));
    expect(curse.alt).toBeNull();

    const { game, ui } = FIXTURES["inspect-relic"]!();
    const relic = buildView(game!, ui, bundle).overlay;
    expect(relic?.kind === "inspect" && relic.alt).toBeNull();
  });

  test("both boxes fit 80 columns; a narrow one keeps the current card alone", () => {
    const o = inspectDeck(9);
    const at = (cols: number) => renderOverlay(o, cols, 24, THEME_PLAIN).join("\n");
    expect(at(80)).toContain("Bash+");
    expect(at(80)).toContain("current");
    // below the pair threshold only the card you are holding is drawn
    expect(at(52)).toContain("Bash");
    expect(at(52)).not.toContain("Bash+");
    expect(at(52)).not.toContain("current");
  });
});

// --- invariants -----------------------------------------------------------------

function assertFrameInvariants(lines: string[], cols: number, rows: number, label: string): void {
  expect(lines.length).toBe(rows);
  for (const line of lines) {
    const plain = stripAnsi(line);
    if (plain.length !== cols) {
      throw new Error(`${label}: line width ${plain.length} != ${cols}: ${JSON.stringify(plain)}`);
    }
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i);
      if (code >= 0x80) throw new Error(`${label}: non-ASCII char 0x${code.toString(16)} in ${JSON.stringify(line)}`);
      if (code === 0x09) throw new Error(`${label}: tab character in ${JSON.stringify(line)}`);
    }
  }
}

const INVARIANT_SIZES = [
  { cols: 100, rows: 30 },
  { cols: 80, rows: 24 },
  { cols: 79, rows: 24 },
  { cols: 40, rows: 10 },
  { cols: 120, rows: 36 },
  { cols: 132, rows: 45 },
] as const;

describe("frame invariants: fixtures", () => {
  for (const [name, build] of Object.entries(FIXTURES)) {
    test(name, () => {
      const { game, ui } = build();
      const view = buildView(game, ui, bundle);
      for (const { cols, rows } of INVARIANT_SIZES) {
        for (const theme of [THEME_PLAIN, THEME_256]) {
          const lines = renderFrame(view, { cols, rows }, theme);
          assertFrameInvariants(lines, cols, rows, `${name} ${cols}x${rows}`);
        }
      }
    });
  }
});

// deterministic greedy sweep across seeds/characters: render every state the
// walk visits (including with overlays force-opened) and check the invariants
describe("frame invariants: state sweep", () => {
  const CHARS = ["IRONCLAD", "SILENT", "DEFECT", "WATCHER"] as const;

  function nextCommand(s: GameState): Command | null {
    if (s.outcome) return null;
    if (s.pending) return legalCommands(s, bundle)[0] ?? null;
    const room = s.run.room;
    if (!room) return null;
    switch (room.kind) {
      case "neow":
        return { cmd: "neowPick", i: 0 }; // tier-1 option 0 exercises follow-up choices
      case "map": {
        const picks = legalMapPicks(s.run);
        const pick = picks[s.run.floor % Math.max(1, picks.length)];
        return pick ? { cmd: "mapPick", x: pick.x, y: pick.y } : null;
      }
      case "combat": {
        const legal = legalCommands(s, bundle);
        return legal.find((c) => c.cmd === "playCard") ?? legal[0] ?? null;
      }
      case "rewards": {
        const takeable = room.entries.findIndex(
          (e) => !e.taken && !(e.kind === "potion" && s.run.potions.every((p) => p !== null)),
        );
        return takeable >= 0 ? { cmd: "takeReward", i: takeable } : { cmd: "skipRewards" };
      }
      case "shop":
      case "rest":
        return { cmd: "proceed" };
      case "treasure":
        return room.chest.opened ? { cmd: "proceed" } : { cmd: "openChest" };
      case "event": {
        const view = buildEventView(s, bundle);
        const i = view ? Math.max(0, view.options.findIndex((o) => o.enabled)) : 0;
        return { cmd: "eventOption", i };
      }
      case "gameOver":
        return null;
    }
  }

  // every inspect source is in here so the resolver is exercised against real
  // run state on every screen, including the ones where it resolves to
  // nothing (inspecting a shop from the map, a reward mid-combat...)
  const OVERLAYS: Overlay[] = [
    { kind: "deck", mode: "view", page: 0 },
    { kind: "relics", page: 0 },
    { kind: "potions" },
    { kind: "confirmQuit" },
    { kind: "inspect", source: { of: "hand" }, index: 0 },
    { kind: "inspect", source: { of: "deck" }, index: 1 },
    { kind: "inspect", source: { of: "pile", pile: "discard" }, index: 0 },
    { kind: "inspect", source: { of: "relics" }, index: 0 },
    { kind: "inspect", source: { of: "potions" }, index: 0 },
    { kind: "inspect", source: { of: "reward" }, index: 0 },
    { kind: "inspect", source: { of: "shop" }, index: 2 },
    { kind: "inspect", source: { of: "choice" }, index: 0 },
  ];

  for (const ch of CHARS) {
    test(`${ch} sweep`, () => {
      let s = createRun({ seed: `SWEEP${ch}`, bundle, character: ch });
      let ui: UiState = { ...initialUiState({ seed: `SWEEP${ch}` }), screen: "run" };
      for (let step = 0; step < 120; step++) {
        ui = pushLog(ui, s.eventLog, bundle);
        const view = buildView(s, ui, bundle);
        for (const { cols, rows } of INVARIANT_SIZES) {
          assertFrameInvariants(renderFrame(view, { cols, rows }, THEME_256), cols, rows, `${ch} step ${step}`);
        }
        if (step % 10 === 0 && !s.pending) {
          const overlay = OVERLAYS[(step / 10) % OVERLAYS.length]!;
          const overlayView = buildView(s, { ...ui, overlays: [overlay] }, bundle);
          assertFrameInvariants(
            renderFrame(overlayView, { cols: 100, rows: 30 }, THEME_256),
            100,
            30,
            `${ch} step ${step} overlay ${overlay.kind}`,
          );
        }
        const cmd = nextCommand(s);
        if (!cmd) break;
        s = advance(s, cmd, bundle);
      }
    });
  }
});
