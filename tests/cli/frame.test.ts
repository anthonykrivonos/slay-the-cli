// Frame snapshots + hard frame invariants.
//
// Snapshots: every fixture screen, rendered with THEME_PLAIN at 100x30 and
// 80x24 (plus one 79x24 too-small case), compared byte-for-byte against the
// checked-in .txt frames. Regenerate deliberately with:
//   bun tests/cli/gen-fixtures.ts
//
// Invariants (every fixture + a deterministic multi-seed sweep): exactly
// `rows` lines, ANSI-stripped width exactly `cols`, pure ASCII, no tabs —
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
import { THEME_PLAIN, THEME_256 } from "../../src/cli/render/theme";
import { stripAnsi } from "../../src/cli/term/ansi";
import { initialUiState, pushLog, type UiState, type Overlay } from "../../src/cli/state/uiState";
import { legalMapPicks, buildEventView } from "../../src/cli/text/runlogic";
import { formatEvent } from "../../src/cli/text/logfmt";

function readFixture(file: string): string {
  const path = join(FIXTURE_DIR, file);
  if (!existsSync(path)) {
    throw new Error(`missing fixture ${file} — run: bun tests/cli/gen-fixtures.ts`);
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

  const OVERLAYS: Overlay[] = [
    { kind: "deck", mode: "view", page: 0 },
    { kind: "relics", page: 0 },
    { kind: "potions" },
    { kind: "confirmQuit" },
  ];

  for (const ch of CHARS) {
    test(`${ch} sweep`, () => {
      let s = createRun({ seed: `SWEEP${ch}`, bundle, character: ch });
      let ui: UiState = { ...initialUiState({ seed: `SWEEP${ch}` }), screen: "run" };
      for (let step = 0; step < 120; step++) {
        ui = pushLog(ui, s.eventLog.map((ev) => formatEvent(ev, bundle)));
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
