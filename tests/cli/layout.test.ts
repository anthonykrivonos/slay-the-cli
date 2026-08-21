// Unit tests for the fluid-layout plumbing: layout math, the 5x5 big font,
// the scene art constraints, card/button boxes, and the actor panels. All
// pure — geometry is asserted exactly (visible width via stripAnsi).

import { test, expect, describe } from "bun:test";
import { clamp, fits, rowWidth, rowGap, joinBlocks, flexFill, tipHeight } from "../../src/cli/render/layout";
import { bigWord, bigWordWidth, canBigWord, BIG_ROWS } from "../../src/cli/render/bigfont";
import {
  ART_CAMPFIRE,
  ART_WHALE,
  ART_CHEST,
  ART_MERCHANT,
  ART_SPIRE,
  HERO_PORTRAITS,
  pickPortrait,
  type Art,
} from "../../src/cli/render/art";
import {
  cardBox,
  cardBoxWidth,
  cardBoxHeight,
  buttonBox,
  buttonBoxWidth,
  buttonBoxHeight,
  type CardBoxData,
} from "../../src/cli/render/cardbox";
import {
  enemyPanel,
  enemyPanelWidth,
  playerPanel,
  playerPanelWidth,
  playerPanelHeight,
  ENEMY_PANEL_H,
  type EnemyPanelData,
  type PlayerPanelData,
} from "../../src/cli/render/panels";
import { THEME_PLAIN, THEME_256 } from "../../src/cli/render/theme";
import { stripAnsi } from "../../src/cli/term/ansi";

function widths(lines: string[]): number[] {
  return lines.map((l) => stripAnsi(l).length);
}

describe("layout math", () => {
  test("clamp", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
  test("fits / rowWidth / rowGap", () => {
    expect(fits(5, 15, 1, 79)).toBe(true); // 5*15+4 = 79
    expect(fits(5, 15, 1, 78)).toBe(false);
    expect(rowWidth(5, 15, 1)).toBe(79);
    expect(rowWidth(0, 15, 1)).toBe(0);
    expect(rowGap(5, 15, 79)).toBe(1);
    expect(rowGap(5, 15, 78)).toBe(0);
  });
  test("joinBlocks pads, aligns and left-pads", () => {
    const a = ["aa", "a"];
    const b = ["bbb"];
    const out = joinBlocks([a, b], [4, 5], 2, 3);
    expect(out).toEqual(["   aa    bbb  ", "   a          "]);
  });
  test("flexFill distributes leftover by weight, remainder to heaviest", () => {
    expect(flexFill(30, 25, [3, 1])).toEqual([4, 1]);
    expect(flexFill(30, 30, [3, 1])).toEqual([0, 0]);
    expect(flexFill(10, 20, [3, 1])).toEqual([0, 0]); // overflow: never negative
    expect(flexFill(27, 24, [1, 1, 1])).toEqual([1, 1, 1]);
  });
  test("tipHeight ladder", () => {
    expect(tipHeight(21)).toBe(0); // 80x24
    expect(tipHeight(24)).toBe(3);
    expect(tipHeight(27)).toBe(3); // 100x30
    expect(tipHeight(33)).toBe(4); // 120x36
    expect(tipHeight(42)).toBe(4); // 132x45
  });
});

describe("bigfont", () => {
  test("every glyph is 5 rows of 5 columns", () => {
    for (const word of ["SLAY", "VICTORY", "DEFEAT", "THE HEART FALLS", "NEW RUN"]) {
      expect(canBigWord(word)).toBe(true);
      const rows = bigWord(word)!;
      expect(rows.length).toBe(BIG_ROWS);
      for (const r of rows) expect(r.length).toBe(bigWordWidth(word));
    }
  });
  test("word widths match the 6n-1 formula", () => {
    expect(bigWordWidth("SLAY")).toBe(23);
    expect(bigWordWidth("VICTORY")).toBe(41);
    expect(bigWordWidth("DEFEAT")).toBe(35);
    expect(bigWordWidth("THE HEART FALLS")).toBe(89);
  });
  test("unknown glyphs return null", () => {
    expect(bigWord("Q!")).toBeNull();
    expect(canBigWord("")).toBe(false);
  });
  test("pixels are only '#' and spaces", () => {
    for (const r of bigWord("SLAY VICTORY DEFEAT")!) {
      expect(/^[# ]+$/.test(r)).toBe(true);
    }
  });
});

describe("art", () => {
  const pieces: [string, Art][] = [
    ["campfire", ART_CAMPFIRE],
    ["whale", ART_WHALE],
    ["chest", ART_CHEST],
    ["merchant", ART_MERCHANT],
    ["spire", ART_SPIRE],
  ];
  for (const [name, art] of pieces) {
    test(`${name}: <=8 rows, uniform width, pure ASCII`, () => {
      expect(art.h).toBeLessThanOrEqual(8);
      expect(art.rows.length).toBe(art.h);
      for (const r of art.rows) {
        expect(r.length).toBe(art.w);
        for (let i = 0; i < r.length; i++) {
          const code = r.charCodeAt(i);
          expect(code).toBeGreaterThanOrEqual(0x20);
          expect(code).toBeLessThan(0x80);
        }
      }
    });
  }

  test("hero portraits: four heroes, ascending tiers, uniform width, pure ASCII", () => {
    expect(Object.keys(HERO_PORTRAITS).sort()).toEqual(["DEFECT", "IRONCLAD", "SILENT", "WATCHER"]);
    for (const tiers of Object.values(HERO_PORTRAITS)) {
      expect(tiers.length).toBeGreaterThanOrEqual(3);
      for (let t = 1; t < tiers.length; t++) expect(tiers[t]!.w).toBeGreaterThan(tiers[t - 1]!.w);
      for (const art of tiers) {
        expect(art.rows.length).toBe(art.h);
        for (const r of art.rows) {
          expect(r.length).toBe(art.w);
          for (let i = 0; i < r.length; i++) {
            const code = r.charCodeAt(i);
            expect(code).toBeGreaterThanOrEqual(0x20);
            expect(code).toBeLessThan(0x80);
          }
        }
      }
    }
  });

  test("pickPortrait returns the largest fitting tier (or null)", () => {
    const tiers = HERO_PORTRAITS.IRONCLAD!;
    const big = pickPortrait("IRONCLAD", 999, 999)!;
    expect(big.w).toBe(tiers[tiers.length - 1]!.w);
    const small = pickPortrait("IRONCLAD", tiers[0]!.w, tiers[0]!.h)!;
    expect(small.w).toBe(tiers[0]!.w);
    expect(pickPortrait("IRONCLAD", 5, 5)).toBeNull();
    expect(pickPortrait("NOBODY", 999, 999)).toBeNull();
  });
});

describe("card boxes", () => {
  const card: CardBoxData = {
    key: "3",
    cost: "1",
    name: "Strike",
    color: "#c25454",
    type: "Attack",
    targeted: true,
    rules: ["Deal 6 damage."],
    dim: false,
  };
  test("width/height ladders", () => {
    expect(cardBoxWidth(120, 5)).toBe(22);
    expect(cardBoxWidth(80, 5)).toBe(15);
    expect(cardBoxWidth(80, 7)).toBe(12); // clamped floor
    expect(cardBoxHeight(33)).toBe(7);
    expect(cardBoxHeight(24)).toBe(6);
    expect(cardBoxHeight(21)).toBe(5);
  });
  for (const h of [5, 6, 7]) {
    test(`h${h} box is exactly ${h} rows x w cols in both themes`, () => {
      for (const theme of [THEME_PLAIN, THEME_256]) {
        for (const w of [12, 15, 22]) {
          const rows = cardBox(card, w, h, theme);
          expect(rows.length).toBe(h);
          expect(widths(rows)).toEqual(new Array(h).fill(w));
        }
      }
    });
  }
  test("cost sits in the top border, key in the bottom border", () => {
    const rows = cardBox(card, 15, 6, THEME_PLAIN);
    expect(rows[0]).toBe("+(1)----------+");
    expect(rows[5]).toBe("+-----[3]-----+");
    expect(stripAnsi(rows[1]!)).toContain("Strike");
    expect(stripAnsi(rows[2]!)).toContain("Attack");
    expect(stripAnsi(rows[2]!)).toContain(">"); // target mark on the type row
  });
  test("h5 joins the target mark to the name row", () => {
    const rows = cardBox(card, 15, 5, THEME_PLAIN);
    expect(stripAnsi(rows[1]!)).toContain(">");
    expect(rows.join("\n")).not.toContain("Attack");
  });
  test("dim box carries no cost/key highlight and long rules wrap", () => {
    const rows = cardBox(
      { ...card, dim: true, rules: ["Deal 6 damage. Apply 2 Vulnerable. Draw 1 card."] },
      14,
      7,
      THEME_PLAIN,
    );
    expect(rows.length).toBe(7);
    expect(widths(rows)).toEqual(new Array(7).fill(14));
  });
});

describe("button boxes", () => {
  test("width ladder", () => {
    expect(buttonBoxWidth(80, 4)).toBe(19);
    expect(buttonBoxWidth(132, 4)).toBe(30);
    expect(buttonBoxWidth(80, 5)).toBe(18); // clamped floor
  });
  test("height = 3 + tallest sub stack (disabled note counts)", () => {
    const a = { key: "1", label: "REST", subs: ["heal 24 HP"], enabled: true, note: null };
    const b = { key: "2", label: "SMITH", subs: [], enabled: false, note: "nothing to upgrade" };
    expect(buttonBoxHeight([a, b])).toBe(4);
    expect(buttonBoxHeight([{ ...a, subs: [] }])).toBe(3);
  });
  test("exact geometry, key in top border, disabled goes dim with note", () => {
    const b = { key: "2", label: "SMITH", subs: [], enabled: false, note: "nothing to upgrade" };
    const rows = buttonBox(b, 24, 4, THEME_PLAIN);
    expect(rows.length).toBe(4);
    expect(widths(rows)).toEqual([24, 24, 24, 24]);
    expect(rows[0]).toBe("+-[2]------------------+");
    expect(stripAnsi(rows[2]!)).toContain("(nothing to upgrade)");
  });
});

describe("enemy panels", () => {
  const enemy: EnemyPanelData = {
    key: "1",
    name: "Jaw Worm",
    hp: 42,
    maxHp: 44,
    block: 5,
    intentGlyph: "/! 11",
    intentKind: "attack",
    move: "Chomp",
    powers: [
      { name: "Strength", amount: 3, kind: "buff" },
      { name: "Vulnerable", amount: 2, kind: "debuff" },
      { name: "Weak", amount: 1, kind: "debuff" },
    ],
    gone: null,
  };
  test("width ladder", () => {
    expect(enemyPanelWidth(120, 5)).toBe(22);
    expect(enemyPanelWidth(80, 2)).toBe(30);
    expect(enemyPanelWidth(80, 5)).toBe(18); // clamped floor -> line fallback territory
  });
  test("exact 6-row geometry at several widths in both themes", () => {
    for (const theme of [THEME_PLAIN, THEME_256]) {
      for (const w of [18, 24, 30]) {
        const rows = enemyPanel(enemy, w, theme);
        expect(rows.length).toBe(ENEMY_PANEL_H);
        expect(widths(rows)).toEqual(new Array(ENEMY_PANEL_H).fill(w));
      }
    }
  });
  test("intent row holds the glyph and the right-aligned key", () => {
    const rows = enemyPanel(enemy, 26, THEME_PLAIN);
    const intent = stripAnsi(rows[1]!);
    expect(intent).toContain("/! 11");
    expect(intent.trimEnd().endsWith("[1] |")).toBe(true);
    expect(stripAnsi(rows[3]!)).toContain("42/44");
    expect(stripAnsi(rows[3]!)).toContain("B5");
    expect(stripAnsi(rows[4]!)).toContain("^ Strength 3");
    expect(stripAnsi(rows[4]!)).toContain("+"); // power overflow counter
  });
  test("dead enemies render a dim stub of the same size", () => {
    const rows = enemyPanel({ ...enemy, gone: "dead" }, 24, THEME_PLAIN);
    expect(rows.length).toBe(ENEMY_PANEL_H);
    expect(widths(rows)).toEqual(new Array(ENEMY_PANEL_H).fill(24));
    expect(rows.join("\n")).toContain("x dead x");
  });
});

describe("player panel", () => {
  const player: PlayerPanelData = {
    name: "YOU  Watcher",
    hp: 61,
    maxHp: 72,
    block: 8,
    energy: 3,
    energyMax: 3,
    stance: "WRATH",
    stanceColor: "#e06a7a",
    mantra: "6/10",
    orbs: [
      { text: "(L:3)", empty: false, color: "#ffd75e" },
      { text: "( - )", empty: true, color: null },
    ],
    powers: [{ name: "Vigor", amount: 8, kind: "buff" }],
  };
  test("width formula", () => {
    expect(playerPanelWidth(80)).toBe(36);
    expect(playerPanelWidth(120)).toBe(52);
    expect(playerPanelWidth(60)).toBe(34);
  });
  test("height tracks optional rows", () => {
    expect(playerPanelHeight(player)).toBe(6);
    expect(playerPanelHeight({ ...player, orbs: null, mantra: null })).toBe(5);
    expect(playerPanelHeight({ ...player, orbs: null, mantra: null, powers: [] })).toBe(4);
  });
  test("exact geometry; energy orb sits in the top border", () => {
    for (const theme of [THEME_PLAIN, THEME_256]) {
      const rows = playerPanel(player, 40, theme);
      expect(rows.length).toBe(6);
      expect(widths(rows)).toEqual(new Array(6).fill(40));
    }
    const plain = playerPanel(player, 40, THEME_PLAIN);
    expect(stripAnsi(plain[0]!)).toBe(`+==( 3/3 )${"=".repeat(29)}+`);
    expect(stripAnsi(plain[1]!)).toContain("[WRATH]");
    expect(stripAnsi(plain[2]!)).toContain("HP 61/72");
    expect(stripAnsi(plain[3]!)).toContain("Mantra 6/10");
    expect(stripAnsi(plain[3]!)).toContain("(L:3)( - )");
    expect(stripAnsi(plain[4]!)).toContain("^ Vigor 8");
  });
});
