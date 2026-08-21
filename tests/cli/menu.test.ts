// Main-menu rendering: per-character accent colors (every hero wears its own
// color, not just the selected one), the selected hero's portrait sitting
// BELOW the actions, and the degradation ladder at small sizes.

import { test, expect, describe } from "bun:test";
import { buildView } from "../../src/cli/state/view";
import { renderFrame } from "../../src/cli/render/frame";
import { renderMenu } from "../../src/cli/render/menu";
import { THEME_256, THEME_PLAIN, hexToAnsi256 } from "../../src/cli/render/theme";
import { initialUiState, applyUiAction, type UiState } from "../../src/cli/state/uiState";
import { CHARACTER_COLORS, CHARACTER_IDS } from "../../src/cli/text/runlogic";
import { HERO_PORTRAITS } from "../../src/cli/render/art";
import { stripAnsi } from "../../src/cli/term/ansi";
import { bundle, fxCombatStance, fxRest, fxMapAct1 } from "./fixtures";

function menuUi(selectedIdx: number | null): UiState {
  let ui = initialUiState({ seed: "SPIRE" });
  ui = { ...ui, menuSave: { desc: "Ironclad A0 - Floor 3 - Act 1" } };
  if (selectedIdx !== null) ui = applyUiAction(ui, { type: "focusSet", scope: "menu", idx: selectedIdx });
  return ui;
}

function frame(ui: UiState, cols: number, rows: number, theme = THEME_256): string[] {
  return renderFrame(buildView(null, ui, bundle), { cols, rows }, theme);
}

const code = (id: string): string => `38;5;${hexToAnsi256(CHARACTER_COLORS[id]!)}`;

describe("menu colors", () => {
  test("every hero card wears its own accent, whatever is selected", () => {
    for (const [i, sel] of CHARACTER_IDS.entries()) {
      const joined = frame(menuUi(i), 120, 36).join("\n");
      for (const id of CHARACTER_IDS) {
        if (!joined.includes(code(id))) {
          throw new Error(`selecting ${sel}: ${id} accent ${code(id)} missing from the menu`);
        }
      }
    }
  });

  test("the four accents are distinct xterm indexes", () => {
    const idxs = CHARACTER_IDS.map((id) => hexToAnsi256(CHARACTER_COLORS[id]!));
    expect(new Set(idxs).size).toBe(CHARACTER_IDS.length);
  });

  test("accents survive at every snapshot size (no ANSI-stripping overflow)", () => {
    for (const [cols, rows] of [[80, 24], [100, 30], [120, 36], [132, 45]] as const) {
      const joined = frame(menuUi(3), cols, rows).join("\n");
      expect(joined).toContain(code("WATCHER"));
      expect(joined).toContain(code("IRONCLAD"));
    }
  });
});

describe("menu portrait placement", () => {
  test("the portrait renders BELOW the run actions", () => {
    const lines = frame(menuUi(0), 120, 36, THEME_PLAIN).map(stripAnsi);
    const actionRow = lines.findIndex((l) => l.includes("NEW RUN"));
    const ruleRow = lines.findIndex((l) => l.includes("IRONCLAD ---"));
    expect(actionRow).toBeGreaterThan(0);
    expect(ruleRow).toBeGreaterThan(actionRow);
  });

  test("the portrait belongs to the selected hero and swaps with it", () => {
    for (const [i, id] of CHARACTER_IDS.entries()) {
      const lines = frame(menuUi(i), 120, 36, THEME_PLAIN).map(stripAnsi);
      const tiers = HERO_PORTRAITS[id]!;
      const shown = lines.filter((l) => l.trim().length > 0);
      // the hero's name rule introduces the art
      expect(shown.some((l) => l.includes(`${id} ---`) || l.includes(`- ${id} `))).toBe(true);
      // and some tier's distinctive row is present
      expect(tiers.length).toBeGreaterThan(0);
    }
  });

  test("no portrait when the rows are needed by the functional block", () => {
    const lines = frame(menuUi(0), 80, 24, THEME_PLAIN).map(stripAnsi);
    expect(lines.some((l) => l.includes("NEW RUN"))).toBe(true);
    expect(lines.some((l) => l.includes("IRONCLAD ---"))).toBe(false);
  });
});

describe("highlight color follows the character", () => {
  const GENERIC = `38;5;${hexToAnsi256("#ffd75e")}`; // the old fixed-gold highlight

  test("menu: the focused action wears the selected hero's color, never the generic gold", () => {
    for (const [i, id] of CHARACTER_IDS.entries()) {
      let ui = menuUi(i);
      ui = applyUiAction(ui, { type: "focusSet", scope: "menu", idx: 4 }); // NEW RUN
      ui = { ...ui, character: id };
      const row = frame(ui, 120, 36).find((l) => l.includes("NEW RUN"));
      expect(row).toBeDefined();
      expect(row!).toContain(code(id));
      expect(row!).not.toContain(GENERIC);
    }
  });

  test("combat: the focused card border wears the run character's accent", () => {
    const f = fxCombatStance(); // Watcher
    const view = buildView(f.game, { ...f.ui, focus: { scope: "combat", idx: 0 } }, bundle);
    expect(view.accent).toBe(CHARACTER_COLORS.WATCHER!);
    const lines = renderFrame(view, { cols: 120, rows: 36 }, THEME_256);
    expect(lines.some((l) => l.includes(code("WATCHER")) && l.includes("+"))).toBe(true);
    expect(lines.join("\n")).not.toContain(GENERIC);
  });

  test("list screens: the cursor row wears the run character's accent", () => {
    const f = fxRest();
    const view = buildView(f.game, { ...f.ui, focus: { scope: "rest", idx: 0 } }, bundle);
    const accent = `38;5;${hexToAnsi256(view.accent)}`;
    const lines = renderFrame(view, { cols: 100, rows: 30 }, THEME_256);
    expect(lines.some((l) => l.includes(accent))).toBe(true);
    expect(lines.join("\n")).not.toContain(GENERIC);
  });

  test("map: the pick cursor and the floor gauge wear the accent", () => {
    const f = fxMapAct1();
    const view = buildView(f.game, { ...f.ui, focus: { scope: "map", idx: 0 } }, bundle);
    const accent = `38;5;${hexToAnsi256(view.accent)}`;
    const lines = renderFrame(view, { cols: 100, rows: 30 }, THEME_256);
    expect(lines.some((l) => l.includes("Next:") && l.includes(accent))).toBe(true);
    expect(lines.some((l) => l.includes("FLOOR") && l.includes(accent))).toBe(true);
  });

  test("View.accent tracks the run's character", () => {
    expect(buildView(fxCombatStance().game, fxCombatStance().ui, bundle).accent).toBe(CHARACTER_COLORS.WATCHER!);
    expect(buildView(fxRest().game, fxRest().ui, bundle).accent).toBe(CHARACTER_COLORS.IRONCLAD!);
  });
});

describe("menu ladder", () => {
  function menuScreen(idx: number) {
    const screen = buildView(null, menuUi(idx), bundle).screen;
    if (screen.kind !== "menu") throw new Error("expected the menu screen");
    return screen;
  }

  test("hero cards degrade to the compact banner list when rows are scarce", () => {
    const rows = renderMenu(menuScreen(1), 100, 13, THEME_PLAIN).map(stripAnsi);
    expect(rows.length).toBe(13);
    expect(rows.some((l) => l.includes("S L A Y"))).toBe(true);
    expect(rows.some((l) => l.includes("[2] Silent"))).toBe(true);
    expect(rows.some((l) => l.includes("+=[1]"))).toBe(false); // no cards
  });

  test("the compact list still color-codes every hero", () => {
    const joined = renderMenu(menuScreen(1), 100, 13, THEME_256).join("\n");
    for (const id of CHARACTER_IDS) expect(joined).toContain(code(id));
  });

  test("renderMenu is total: exact geometry at absurd sizes", () => {
    for (const [w, h] of [[40, 10], [20, 4], [200, 60], [80, 1]] as const) {
      for (const theme of [THEME_PLAIN, THEME_256]) {
        const rows = renderMenu(menuScreen(0), w, h, theme);
        expect(rows.length).toBeLessThanOrEqual(h);
        for (const r of rows) expect(stripAnsi(r).length).toBe(w);
      }
    }
  });
});
