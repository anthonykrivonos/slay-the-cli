// Monster and hero portraits: every creature in the game has one, the tiers
// are boxed so any shape fits an enemy column, and combat shows them under the
// intent with the creature's own color (dropping them first when rows run out).

import { test, expect, describe } from "bun:test";
import {
  MONSTER_PORTRAITS,
  MONSTER_TIERS,
  monsterPortrait,
  monsterTint,
  sharedMonsterTier,
  HERO_PORTRAITS,
} from "../../src/cli/render/art";
import { renderFrame } from "../../src/cli/render/frame";
import { buildView } from "../../src/cli/state/view";
import { THEME_256, THEME_PLAIN, hexToAnsi256 } from "../../src/cli/render/theme";
import { stripAnsi } from "../../src/cli/term/ansi";
import { CHARACTER_IDS } from "../../src/cli/text/runlogic";
import { bundle, fxCombat, fxCombatCrowd } from "./fixtures";

/** The widest box any tier may use, matching the generator's ladder. */
const BOX = { w: 46, h: 18 };

describe("monster portraits", () => {
  test("every monster in the game has one", () => {
    const missing = [...bundle.monsters.keys()].filter((id) => MONSTER_PORTRAITS[id] === undefined);
    expect(missing).toEqual([]);
    expect(Object.keys(MONSTER_PORTRAITS).length).toBe(bundle.monsters.size);
  });

  test("five tiers, ascending, boxed, pure ASCII", () => {
    for (const [id, tiers] of Object.entries(MONSTER_PORTRAITS)) {
      expect(tiers.length).toBe(MONSTER_TIERS);
      for (let t = 1; t < tiers.length; t++) {
        // each tier is at least as big as the one below it, and grows somewhere
        expect(tiers[t]!.w).toBeGreaterThanOrEqual(tiers[t - 1]!.w);
        expect(tiers[t]!.h).toBeGreaterThanOrEqual(tiers[t - 1]!.h);
        expect(tiers[t]!.w + tiers[t]!.h).toBeGreaterThan(tiers[t - 1]!.w + tiers[t - 1]!.h);
      }
      for (const art of tiers) {
        expect(art.w).toBeLessThanOrEqual(BOX.w);
        expect(art.h).toBeLessThanOrEqual(BOX.h);
        expect(art.h).toBeGreaterThan(0);
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
      // there is ink, not just whitespace
      expect(tiers[MONSTER_TIERS - 1]!.rows.join("").trim().length).toBeGreaterThan(0);
      expect(monsterTint(id)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("each creature wears its own color", () => {
    // the sprites disagree enough that these are all distinct
    expect(monsterTint("RED_LOUSE")).not.toBe(monsterTint("GREEN_LOUSE"));
    expect(monsterTint("ACID_SLIME_L")).not.toBe(monsterTint("BRONZE_AUTOMATON"));
    // an unknown monster still gets a readable default
    expect(monsterTint("NOT_A_MONSTER")).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("sharedMonsterTier picks one tier the whole row can wear", () => {
    const ids = ["RED_LOUSE", "GREEN_LOUSE"];
    const t = sharedMonsterTier(ids, 26, 9);
    expect(t).toBeGreaterThanOrEqual(0);
    for (const id of ids) {
      expect(monsterPortrait(id, t)!.w).toBeLessThanOrEqual(26);
      expect(monsterPortrait(id, t)!.h).toBeLessThanOrEqual(9);
    }
    // a bigger box never picks a smaller tier
    expect(sharedMonsterTier(ids, BOX.w, BOX.h)).toBeGreaterThanOrEqual(t);
    // no room at all
    expect(sharedMonsterTier(ids, 8, 2)).toBe(-1);
    expect(sharedMonsterTier(["NOT_A_MONSTER"], BOX.w, BOX.h)).toBe(-1);
  });

  test("every playable hero has portrait tiers too", () => {
    for (const id of CHARACTER_IDS) {
      expect(HERO_PORTRAITS[id]!.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("portraits in combat", () => {
  const frame = (fx: () => ReturnType<typeof fxCombat>, cols: number, rows: number, theme = THEME_PLAIN): string[] => {
    const f = fx();
    return renderFrame(buildView(f.game, f.ui, bundle), { cols, rows }, theme);
  };

  test("a tall terminal shows the enemies and the hero", () => {
    const lines = frame(fxCombat, 132, 45).map(stripAnsi);
    const body = lines.join("\n");
    // portrait ink inside the enemy panels, above the name row
    const nameRow = lines.findIndex((l) => l.includes("Red Louse"));
    const artRows = lines.slice(2, nameRow).filter((l) => /[=+*#%@]{3}/.test(l));
    expect(artRows.length).toBeGreaterThan(2);
    // the hero panel grew to hold his portrait: the energy-orb border, then
    // rows carrying both portrait ink and his stats
    const orbRow = lines.findIndex((l) => l.includes("( E 3/3 )"));
    expect(orbRow).toBeGreaterThan(0);
    const heroName = lines[orbRow + 1]!;
    expect(heroName).toContain("Ironclad");
    expect(heroName.indexOf("Ironclad")).toBeGreaterThan(4); // art sits to his left
    expect(body).toContain("HP 80/80");
  });

  test("every enemy panel in a row is the same height", () => {
    const lines = frame(fxCombatCrowd, 132, 45).map(stripAnsi);
    // the enemy row draws one border line at the top and one at the bottom;
    // every panel shares them, which is what "same height" means here
    const borders = lines.reduce<number[]>((acc, l, i) => {
      if (/\+-{10,}\+ \+-{10,}\+/.test(l)) acc.push(i);
      return acc;
    }, []);
    expect(borders.length).toBe(2);
    expect(borders[1]! - borders[0]!).toBeGreaterThan(6); // chrome plus portrait rows
  });

  test("80x24 drops the portraits and stays exact", () => {
    for (const theme of [THEME_PLAIN, THEME_256]) {
      const lines = frame(fxCombat, 80, 24, theme);
      for (const l of lines) expect(stripAnsi(l).length).toBe(80);
      const plain = lines.map(stripAnsi);
      const nameRow = plain.findIndex((l) => l.includes("Red Louse"));
      // the row above the name is the intent, not portrait ink
      expect(plain[nameRow - 1]).toContain("/!");
    }
  });

  test("the portraits carry each creature's tint", () => {
    const joined = frame(fxCombat, 132, 45, THEME_256).join("");
    expect(joined).toContain(`38;5;${hexToAnsi256(monsterTint("RED_LOUSE"))}`);
    expect(joined).toContain(`38;5;${hexToAnsi256(monsterTint("GREEN_LOUSE"))}`);
  });
});

describe("empty slots", () => {
  // The Slime Boss leaves a GAP placeholder behind when it splits (slot
  // padding, isEscaped, no monster def). It is not a creature and must never
  // draw a panel titled "Gap" reading "x escaped x".
  test("a GAP slot draws no enemy panel", () => {
    const f = fxCombat();
    const g = structuredClone(f.game!);
    const c = g.combat!;
    const real = c.monsters.length;
    c.monsters.splice(1, 0, {
      id: "GAP",
      idx: 1,
      hp: 0,
      maxHp: 0,
      block: 0,
      powers: [],
      move: null,
      moveHistory: [],
      isDead: false,
      isEscaped: true,
      halfDead: false,
      data: {},
    });
    c.monsters.forEach((m, i) => (m.idx = i));

    const view = buildView(g, f.ui, bundle);
    expect(view.screen.kind).toBe("combat");
    if (view.screen.kind !== "combat") return;
    expect(view.screen.enemies.length).toBe(real);
    expect(view.screen.enemies.some((e) => e.id === "GAP")).toBe(false);

    const frame = renderFrame(view, { cols: 120, rows: 36 }, THEME_PLAIN).join("\n");
    expect(frame).not.toContain("Gap");
    expect(frame).not.toContain("x escaped x");
  });
});
