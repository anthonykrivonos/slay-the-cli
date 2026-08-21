// Map renderer unit tests over synthetic MapViews: edge glyph placement
// (| / \ and X on crossings), pick numbering, the boss door, "@", viewport
// clipping, and the act-4 fixed column.

import { test, expect, describe } from "bun:test";
import type { MapView, MapNodeView } from "../../src/cli/state/view";
import { buildMapLines, renderMap, NODE_COL } from "../../src/cli/render/map";
import { THEME_PLAIN } from "../../src/cli/render/theme";

function node(x: number, glyph: string, edges: number[], extra: Partial<MapNodeView> = {}): MapNodeView {
  return { x, glyph, burning: false, current: false, pickKey: null, edges, ...extra };
}

function mkView(overrides: Partial<MapView>): MapView {
  return {
    kind: "map",
    act: 1,
    floor: 1,
    focusPick: null,
    bossName: "Hexaghost",
    bossReachable: false,
    bossPickKey: null,
    hasBossDoor: true,
    nodeRows: [],
    maxY: 0,
    position: null,
    picks: [],
    scroll: 0,
    keysOwned: "---",
    deckCount: 10,
    relicCount: 1,
    seed: "TEST",
    ...overrides,
  };
}

describe("edge glyphs", () => {
  test("straight edge renders | at the node column", () => {
    const rows: (MapNodeView | null)[][] = [];
    rows[0] = [null, null, node(2, "M", [2])];
    rows[1] = [null, null, node(2, "R", [])];
    const v = mkView({ nodeRows: rows, maxY: 1, hasBossDoor: false });
    const { lines } = buildMapLines(v, THEME_PLAIN);
    // lines: [node y1, edge, node y0]
    expect(lines.length).toBe(3);
    expect(lines[1]![NODE_COL(2)]).toBe("|");
  });

  test("diagonals render / and \\ at the midpoint", () => {
    const rows: (MapNodeView | null)[][] = [];
    rows[0] = [null, node(1, "M", [2]), null, node(3, "M", [2])];
    rows[1] = [null, null, node(2, "E", []), null];
    const v = mkView({ nodeRows: rows, maxY: 1, hasBossDoor: false });
    const { lines } = buildMapLines(v, THEME_PLAIN);
    const edge = lines[1]!;
    // 1 -> 2 goes up-right: "/" midway between cols 11 and 17
    expect(edge[Math.round((NODE_COL(1) + NODE_COL(2)) / 2)]).toBe("/");
    // 3 -> 2 goes up-left: "\" midway between cols 23 and 17
    expect(edge[Math.round((NODE_COL(3) + NODE_COL(2)) / 2)]).toBe("\\");
  });

  test("crossing edges render X", () => {
    // 1 -> 2 and 2 -> 1 cross between the columns
    const rows: (MapNodeView | null)[][] = [];
    rows[0] = [null, node(1, "M", [2]), node(2, "M", [1]), null];
    rows[1] = [null, node(1, "R", []), node(2, "R", []), null];
    const v = mkView({ nodeRows: rows, maxY: 1, hasBossDoor: false });
    const { lines } = buildMapLines(v, THEME_PLAIN);
    expect(lines[1]![Math.round((NODE_COL(1) + NODE_COL(2)) / 2)]).toBe("X");
  });
});

describe("nodes, picks, boss", () => {
  test("picks render as n:G, current position as @", () => {
    const rows: (MapNodeView | null)[][] = [];
    rows[0] = [node(0, "M", [0], { current: true }), null, node(2, "$", [], { pickKey: "1" })];
    const v = mkView({ nodeRows: rows, maxY: 0, hasBossDoor: false, position: [0, 0] });
    const { lines } = buildMapLines(v, THEME_PLAIN);
    const row = lines[0]!;
    expect(row[NODE_COL(0)]).toBe("@");
    expect(row.slice(NODE_COL(2) - 2, NODE_COL(2) + 1)).toBe("1:$");
  });

  test("burning elite renders E*", () => {
    const rows: (MapNodeView | null)[][] = [];
    rows[0] = [null, node(1, "E", [], { burning: true })];
    const v = mkView({ nodeRows: rows, maxY: 0, hasBossDoor: false });
    const { lines } = buildMapLines(v, THEME_PLAIN);
    expect(lines[0]!.slice(NODE_COL(1), NODE_COL(1) + 2)).toBe("E*");
  });

  test("boss door renders on top with edges from the whole top row", () => {
    const rows: (MapNodeView | null)[][] = [];
    rows[0] = [node(0, "R", []), null, null, node(3, "R", []), null, null, node(6, "R", [])];
    const v = mkView({ nodeRows: rows, maxY: 0, hasBossDoor: true, bossName: "Hexaghost" });
    const { lines } = buildMapLines(v, THEME_PLAIN);
    expect(lines.length).toBe(3); // boss, edge, node row
    expect(lines[0]).toContain("B Hexaghost");
    const edge = lines[1]!;
    expect(edge[NODE_COL(3)]).toBe("|"); // straight into the door
    expect(edge[Math.round((NODE_COL(0) + NODE_COL(3)) / 2)]).toBe("/");
    expect(edge[Math.round((NODE_COL(6) + NODE_COL(3)) / 2)]).toBe("\\");
  });

  test("reachable boss door renders its pick key", () => {
    const rows: (MapNodeView | null)[][] = [];
    rows[0] = [null, null, null, node(3, "R", [], { current: true })];
    const v = mkView({
      nodeRows: rows,
      maxY: 0,
      hasBossDoor: true,
      bossPickKey: "1",
      bossReachable: true,
      picks: [{ x: 3, y: 15, key: "1", glyph: "B" }],
      position: [3, 0],
    });
    const { lines } = buildMapLines(v, THEME_PLAIN);
    expect(lines[0]).toContain("1:B Hexaghost");
    const rendered = renderMap(v, 100, 20, THEME_PLAIN);
    expect(rendered.some((l) => l.includes("Next: 1:BOSS"))).toBe(true);
  });
});

describe("viewport", () => {
  function tallView(): MapView {
    const rows: (MapNodeView | null)[][] = [];
    for (let y = 0; y <= 14; y++) {
      rows[y] = [null, null, null, node(3, y === 0 ? "M" : "R", y < 14 ? [3] : []), null];
    }
    rows[0]![3]!.pickKey = "1";
    return mkView({
      nodeRows: rows,
      maxY: 14,
      hasBossDoor: true,
      picks: [{ x: 3, y: 0, key: "1", glyph: "M" }],
    });
  }

  test("the full map is 31 lines (boss + edge + 15 node rows + 14 edge rows)", () => {
    const { lines } = buildMapLines(tallView(), THEME_PLAIN);
    expect(lines.length).toBe(31);
  });

  test("window follows the frontier: picks at the bottom keep row 0 visible", () => {
    const v = tallView();
    const out = renderMap(v, 80, 15, THEME_PLAIN);
    expect(out.length).toBe(15);
    // the pick marker (bottom of the full map) must be inside the window
    expect(out.some((l) => l.includes("1:M"))).toBe(true);
    // the boss door (top of the full map) must NOT be
    expect(out.some((l) => l.includes("B Hexaghost"))).toBe(false);
    expect(out[out.length - 1]).toContain("Next: 1:M");
  });

  test("scrolling up moves the window toward the boss", () => {
    const v = { ...tallView(), scroll: -12 };
    const out = renderMap(v, 80, 15, THEME_PLAIN);
    expect(out.some((l) => l.includes("B Hexaghost"))).toBe(true);
  });

  test("every rendered line fits the width", () => {
    const out = renderMap(tallView(), 100, 26, THEME_PLAIN);
    for (const l of out) expect(l.length).toBe(100);
  });

  test("body row 0 is the always-visible boss banner", () => {
    const out = renderMap(tallView(), 80, 15, THEME_PLAIN);
    expect(out[0]).toContain("[ BOSS: HEXAGHOST ]");
    expect(out[0]!.trim().startsWith("=")).toBe(true);
    // even when the boss door itself is scrolled out of the viewport
    expect(out.slice(1).some((l) => l.includes("B Hexaghost"))).toBe(false);
  });

  test("the block is centered, and the banner sits over the map area", () => {
    const out = renderMap(tallView(), 120, 15, THEME_PLAIN);
    const bannerPad = out[0]!.length - out[0]!.trimStart().length;
    // 48-column map plus the legend beside it, centered in 120 columns
    expect(bannerPad).toBeGreaterThan(10);
    const nodePad = out.find((l) => l.includes("1:M"))!.length - out.find((l) => l.includes("1:M"))!.trimStart().length;
    expect(Math.abs(nodePad - bannerPad)).toBeLessThan(NODE_COL(3));
    // narrower terminals drop the legend and center the map alone, further right
    const narrow = renderMap(tallView(), 80, 15, THEME_PLAIN);
    const narrowPad = narrow[0]!.length - narrow[0]!.trimStart().length;
    expect(narrowPad).toBe(Math.floor((80 - 48) / 2));
  });

  test("a clipped map grows a scrollbar; a map that fits does not", () => {
    const short = renderMap(tallView(), 80, 15, THEME_PLAIN);
    expect(short.some((l) => l.includes("#"))).toBe(true); // thumb
    expect(short.some((l) => l.includes(":"))).toBe(true); // track
    expect(short[short.length - 1]).toContain("[up/down] scroll");
    // 31 map lines + banner + Next line fits in 33 rows
    const tall = renderMap(tallView(), 80, 33, THEME_PLAIN);
    expect(tall[tall.length - 1]).not.toContain("scroll");
  });

  test("the highlighted path is marked on the map, not just the Next line", () => {
    const v = { ...tallView(), focusPick: 0 };
    const out = renderMap(v, 80, 15, THEME_PLAIN);
    expect(out.some((l) => l.includes("1>M"))).toBe(true);
    expect(out[out.length - 1]).toContain("Next: >1:M");
    // unfocused it goes back to the plain "n:G" form
    const plain = renderMap(tallView(), 80, 15, THEME_PLAIN);
    expect(plain.some((l) => l.includes("1>M"))).toBe(false);
    expect(plain.some((l) => l.includes("1:M"))).toBe(true);
  });

  test("legend shows the FLOOR gauge at >=96 cols", () => {
    const v = { ...tallView(), floor: 6, position: [3, 5] as [number, number] };
    const out = renderMap(v, 100, 26, THEME_PLAIN);
    expect(out.some((l) => l.includes("FLOOR 6") && l.includes("6/16"))).toBe(true);
  });

  test("the focused pick is cursor-marked on the Next line", () => {
    const v = { ...tallView(), focusPick: 0 };
    const out = renderMap(v, 80, 15, THEME_PLAIN);
    expect(out[out.length - 1]).toContain("Next: >1:M");
  });
});

describe("act 4 column", () => {
  test("fixed column renders without a boss door, boss as a node", () => {
    const rows: (MapNodeView | null)[][] = [];
    rows[0] = [null, null, null, node(3, "R", [3], { current: true }), null];
    rows[1] = [null, null, null, node(3, "$", [3], { pickKey: "1" }), null];
    rows[2] = [null, null, null, node(3, "E", [3]), null];
    rows[3] = [null, null, null, node(3, "B", []), null];
    const v = mkView({
      nodeRows: rows,
      maxY: 3,
      act: 4,
      hasBossDoor: false,
      bossName: "The Heart",
      position: [3, 0],
      picks: [{ x: 3, y: 1, key: "1", glyph: "$" }],
    });
    const { lines } = buildMapLines(v, THEME_PLAIN);
    expect(lines.length).toBe(7); // 4 node rows + 3 edge rows
    expect(lines[0]![NODE_COL(3)]).toBe("B");
    expect(lines[2]![NODE_COL(3)]).toBe("E");
    expect(lines[4]!.slice(NODE_COL(3) - 2, NODE_COL(3) + 1)).toBe("1:$");
    expect(lines[6]![NODE_COL(3)]).toBe("@");
    expect(lines[1]![NODE_COL(3)]).toBe("|");
    expect(lines.join("\n")).not.toContain("Hexaghost");
  });
});
