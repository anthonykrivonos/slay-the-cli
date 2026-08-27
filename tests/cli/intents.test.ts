// Intent display: the panel row says how hard you are about to be hit and what
// the buff or debuff actually is, the INFO panel says it in words, and both
// degrade in a sensible order when the panel is narrow.

import { test, expect, describe } from "bun:test";
import { createCombatGame, advance, type GameState } from "../../src/engine/game";
import { getIntents } from "../../src/engine/combat/intents";
import { buildView } from "../../src/cli/state/view";
import { renderFrame } from "../../src/cli/render/frame";
import { enemyPanel, INTENT_COLORS, type EnemyPanelData } from "../../src/cli/render/panels";
import { THEME_PLAIN, THEME_256, hexToAnsi256, C } from "../../src/cli/render/theme";
import { initialUiState } from "../../src/cli/state/uiState";
import { stripAnsi } from "../../src/cli/term/ansi";
import { bundle } from "./fixtures";

const starter = [...Array(9).fill({ defId: "STRIKE_RED" }), { defId: "BASH" }];

/** A one-monster fight parked in a combat room, ready for buildView. */
function fight(monster: string, seed: string): GameState {
  const s = createCombatGame({ seed, bundle, character: "IRONCLAD", deck: starter, monsters: [monster] });
  s.run.room = { kind: "combat", roomKind: "monster", encounterId: monster, burningElite: false } as never;
  return s;
}

const runUi = (extra: Record<string, unknown> = {}) => ({
  ...initialUiState({ seed: "INTENT" }),
  screen: "run" as const,
  ...extra,
});

/** The rendered intent row for a monster on the turn it plays `moveId`. */
function intentRow(monster: string, moveId: string, w = 44, theme = THEME_PLAIN): string {
  let s = fight(monster, `ROW_${monster}`);
  for (let turn = 0; turn < 12 && !s.outcome; turn++) {
    if (getIntents(s, bundle)[0]?.moveId === moveId) {
      const v = buildView(s, runUi(), bundle);
      if (v.screen.kind !== "combat") throw new Error("not a combat view");
      const e = v.screen.enemies[0]!;
      const data: EnemyPanelData = {
        key: e.key,
        name: e.name,
        hp: e.hp,
        maxHp: e.maxHp,
        block: e.block,
        intentGlyph: e.intent?.glyph ?? "??",
        intentKind: e.intent?.color ?? "other",
        intentTotal: e.intent?.total ?? null,
        intentParts: e.intent?.parts ?? [],
        move: e.move,
        powers: e.powers,
        gone: e.gone,
        art: [],
        tint: "#ffffff",
      };
      return enemyPanel(data, w, theme)[1]!;
    }
    s = advance(s, { cmd: "endTurn" }, bundle);
  }
  throw new Error(`never saw ${moveId} in 12 turns`);
}

/** The INFO panel's first line for a monster on the turn it plays `moveId`. */
function intentTip(monster: string, moveId: string): string {
  let s = fight(monster, `TIP_${monster}`);
  for (let turn = 0; turn < 12 && !s.outcome; turn++) {
    if (getIntents(s, bundle)[0]?.moveId === moveId) {
      // focus past the hand cards, onto the only enemy
      const ui = runUi({ focus: { scope: "combat", idx: 10 } });
      const lines = renderFrame(buildView(s, ui, bundle), { cols: 132, rows: 45 }, THEME_PLAIN).map(stripAnsi);
      const info = lines.findIndex((l) => l.includes("-- INFO"));
      return lines[info + 2]!.trim();
    }
    s = advance(s, { cmd: "endTurn" }, bundle);
  }
  throw new Error(`never saw ${moveId} in 12 turns`);
}

describe("intent rows", () => {
  test("a multi-hit attack shows the per-hit damage AND the total", () => {
    const row = stripAnsi(intentRow("HEXAGHOST", "HEXAGHOST_DIVIDER", 46));
    expect(row).toContain("/! 7 x6");
    expect(row).toContain("= 42");
  });

  test("a single hit shows no total (there is nothing to add up)", () => {
    const row = stripAnsi(intentRow("JAW_WORM", "JAW_WORM_CHOMP"));
    expect(row).toContain("/! 11");
    expect(row).not.toContain("=");
  });

  test("a buff says which buff and how much", () => {
    expect(stripAnsi(intentRow("JAW_WORM", "JAW_WORM_BELLOW"))).toContain("^ Str +3");
    expect(stripAnsi(intentRow("CULTIST", "CULTIST_INCANTATION"))).toContain("^ Ritual +3");
  });

  test("a debuff says which debuff and how much, without doubling the marker", () => {
    const row = stripAnsi(intentRow("ACID_SLIME_M", "ACID_SLIME_M_LICK"));
    expect(row).toContain("v Weak 1");
    expect(row).not.toContain("v  v");
  });

  test("drained stats read as a loss", () => {
    const row = stripAnsi(intentRow("LAGAVULIN", "LAGAVULIN_SIPHON_SOUL", 46));
    expect(row).toContain("v Str -1");
    expect(row).toContain("v Dex -1");
  });

  test("statuses headed for your deck are counted", () => {
    expect(stripAnsi(intentRow("SENTRY", "SENTRY_BOLT"))).toContain("+2 Dazed");
    expect(stripAnsi(intentRow("TASKMASTER", "TASKMASTER_SCOURING_WHIP"))).toContain("+1 Wound");
  });

  test("attack plus block shows both numbers", () => {
    const row = stripAnsi(intentRow("JAW_WORM", "JAW_WORM_THRASH"));
    expect(row).toMatch(/\/! \d+ \[\+5\]/);
  });

  test("a narrow panel keeps what matters and sheds the rest in order", () => {
    const wide = stripAnsi(intentRow("THE_GUARDIAN", "THE_GUARDIAN_VENT_STEAM", 46));
    expect(wide).toContain("v Vuln 2");
    expect(wide).toContain("v Weak 2");
    expect(wide).toContain("Vent Steam");
    // at 22 columns the name goes first, then the second debuff, and the one
    // that tells you the most survives
    const narrow = stripAnsi(intentRow("THE_GUARDIAN", "THE_GUARDIAN_VENT_STEAM", 22));
    expect(narrow).toContain("v Vuln 2");
    expect(narrow).not.toContain("Vent Steam");
  });

  test("intent colors: attacks orange, buffs green, debuffs red", () => {
    const code = (hex: string) => `38;5;${hexToAnsi256(hex)}`;
    expect(intentRow("JAW_WORM", "JAW_WORM_CHOMP", 44, THEME_256)).toContain(code(INTENT_COLORS.attack));
    expect(intentRow("CULTIST", "CULTIST_INCANTATION", 44, THEME_256)).toContain(code(C.good));
    expect(intentRow("ACID_SLIME_M", "ACID_SLIME_M_LICK", 44, THEME_256)).toContain(code(C.bad));
  });

  test("every panel row stays exactly as wide as the panel", () => {
    for (const w of [22, 30, 46]) {
      const row = intentRow("HEXAGHOST", "HEXAGHOST_DIVIDER", w, THEME_256);
      expect(stripAnsi(row).length).toBe(w);
    }
  });
});

describe("intent sentences in the INFO panel", () => {
  test("multi-hit attacks spell out the total", () => {
    expect(intentTip("HEXAGHOST", "HEXAGHOST_DIVIDER")).toBe(
      "Divider: intends to attack for 7 x 6 (42 in total).",
    );
  });

  test("several debuffs share one clause", () => {
    expect(intentTip("THE_GUARDIAN", "THE_GUARDIAN_VENT_STEAM")).toBe(
      "Vent Steam: intends to apply 2 Vulnerable and 2 Weak to you.",
    );
  });

  test("block and a buff share the verb", () => {
    expect(intentTip("JAW_WORM", "JAW_WORM_BELLOW")).toBe("Bellow: intends to gain 6 Block and 3 Strength.");
  });

  test("statuses name the pile they land in", () => {
    expect(intentTip("SENTRY", "SENTRY_BOLT")).toBe("Bolt: intends to put 2 Dazed in your discard pile.");
  });

  test("a partial preview admits there is more", () => {
    expect(intentTip("CORRUPT_HEART", "CORRUPT_HEART_DEBILITATE")).toContain("and more it will not show");
  });

  test("a move that does nothing to you says so instead of inventing numbers", () => {
    expect(intentTip("LAGAVULIN", "LAGAVULIN_SLEEP")).toContain("sleep");
  });
});

// Issue #12: Runic Dome says "You can no longer see enemy intents", but the
// panel, the move name and the INCOMING total are three reads of the same
// thing - hiding one and printing the others hides nothing.
describe("Runic Dome", () => {
  const domed = (): GameState => {
    const s = fight("JAW_WORM", "DOME");
    s.run.relics.push({ defId: "RUNIC_DOME", counter: 0 });
    return s;
  };

  test("the intent, the move name and the incoming total all go dark", () => {
    const withDome = buildView(domed(), runUi(), bundle);
    expect(withDome.screen.kind).toBe("combat");
    if (withDome.screen.kind !== "combat") return;
    for (const e of withDome.screen.enemies) {
      expect(e.intent).toBeNull();
      expect(e.move).toBeNull();
    }
    expect(withDome.screen.threat.incoming).toBeNull();

    const frame = renderFrame(withDome, { cols: 120, rows: 36 }, THEME_PLAIN).join("\n");
    expect(frame).toContain("INCOMING ??");
    expect(frame).not.toContain("NET");
  });

  test("without it the same fight shows everything", () => {
    const plain = buildView(fight("JAW_WORM", "DOME"), runUi(), bundle);
    if (plain.screen.kind !== "combat") throw new Error("expected combat");
    expect(plain.screen.enemies[0]!.intent).not.toBeNull();
    expect(plain.screen.enemies[0]!.move).not.toBeNull();
    expect(plain.screen.threat.incoming).not.toBeNull();
  });
});
