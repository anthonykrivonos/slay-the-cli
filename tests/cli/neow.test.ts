// Neow's screen: the tier ladder (how much of him fits), the per-feature tint
// (mouth / glowing eyes / tooth edge / eyes / hide), and his name under the art.

import { test, expect, describe } from "bun:test";
import { buildView } from "../../src/cli/state/view";
import { renderFrame } from "../../src/cli/render/frame";
import { tintNeow } from "../../src/cli/render/neow";
import { NEOW_TIERS } from "../../src/cli/render/art";
import { THEME_256, THEME_PLAIN, hexToAnsi256, C } from "../../src/cli/render/theme";
import { stripAnsi } from "../../src/cli/term/ansi";
import { fxNeow, bundle } from "./fixtures";

function frame(cols: number, rows: number, theme = THEME_PLAIN): string[] {
  const f = fxNeow();
  return renderFrame(buildView(f.game, f.ui, bundle), { cols, rows }, theme);
}

const code = (hex: string): string => `38;5;${hexToAnsi256(hex)}`;

describe("neow art ladder", () => {
  test("the biggest tier beside the blessings on a wide terminal", () => {
    const lines = frame(132, 45);
    // the large tier's distinctive double-wide eye and long mouth
    expect(lines.some((l) => l.includes("(  @@  )"))).toBe(true);
    expect(lines.some((l) => l.includes("=".repeat(30)))).toBe(true);
    // ...and he sits beside the buttons, not above them
    const artRow = lines.findIndex((l) => l.includes("(  @@  )"));
    expect(lines[artRow]).toMatch(/\+-\[|\|/); // a blessing box shares the row
  });

  test("a compact tier above the blessings at 100x30", () => {
    const lines = frame(100, 30);
    expect(lines.some((l) => l.includes("( @ )"))).toBe(true);
    expect(lines.some((l) => l.includes("(  @@  )"))).toBe(false);
    // art is centered above the first blessing box
    const artRow = lines.findIndex((l) => l.includes("( @ )"));
    const boxRow = lines.findIndex((l) => l.includes("+-[1]"));
    expect(artRow).toBeGreaterThan(0);
    expect(boxRow).toBeGreaterThan(artRow);
  });

  test("dropped entirely at 80x24, blessings still readable", () => {
    const lines = frame(80, 24);
    expect(lines.some((l) => l.includes("( @ )"))).toBe(false);
    expect(lines.some((l) => l.includes("+-[1]"))).toBe(true);
    expect(lines.join("\n")).toContain("Obtain a random rare card");
  });

  test("his name is Neow", () => {
    expect(frame(132, 45).join("\n")).toContain("Neow");
    expect(frame(132, 45).join("\n")).not.toContain("the Whale");
  });

  test("frames stay exactly cols wide at every size", () => {
    for (const [cols, rows] of [[132, 45], [120, 36], [108, 30], [100, 30], [80, 24]] as [number, number][]) {
      for (const line of frame(cols, rows, THEME_256)) {
        expect(stripAnsi(line).length).toBe(cols);
      }
    }
  });
});

describe("neow tint", () => {
  test("each feature wears its own color, hide the rest", () => {
    const row = tintNeow(" |   * * *  -X-      +-", THEME_256);
    expect(row).toContain(code(C.gold)); // glowing eyes
    expect(row).toContain(code(C.block)); // hide
    expect(stripAnsi(row)).toBe(" |   * * *  -X-      +-");

    const mouth = tintNeow("  \\ ============   _/", THEME_256);
    expect(mouth).toContain(code(C.purple));
    const teeth = tintNeow("   \\    ^^^^^^^^   _/", THEME_256);
    expect(teeth).toContain(code(C.bright));
    const eye = tintNeow(" |   ( @ )   \\       |", THEME_256);
    expect(eye).toContain("\x1b[2m"); // dark hollows read as dim, not a hue
  });

  test("runs are merged, so a row costs a handful of escapes not one per column", () => {
    const row = tintNeow(NEOW_TIERS[1]!.rows.find((r) => r.includes("==="))!, THEME_256);
    expect(row.split("\x1b[").length - 1).toBeLessThanOrEqual(8);
  });

  test("plain theme leaves the art untouched", () => {
    for (const art of NEOW_TIERS) {
      for (const r of art.rows) expect(tintNeow(r, THEME_PLAIN)).toBe(r);
    }
  });
});
