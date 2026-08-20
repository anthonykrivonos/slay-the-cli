// Keymap tests per input mode: digit auto-target vs targeting entry, pending
// single/multi with min/max, pagination windows, disabled options unmapped
// (they toast instead), and Esc semantics. Views come from buildView over real
// fixture states, so the keymap is tested against exactly what renders.

import { test, expect, describe } from "bun:test";
import type { Key } from "../../src/cli/term/keys";
import { mapKey } from "../../src/cli/input/keymap";
import { buildView } from "../../src/cli/state/view";
import { applyUiAction, initialUiState } from "../../src/cli/state/uiState";
import {
  bundle,
  fxMenu,
  fxMapAct1,
  fxCombat,
  fxCombatOrbs,
  fxCombatTargeting,
  fxChoice,
  fxRewards,
  fxShop,
  fxRest,
  fxGameOverDefeat,
  type Fixture,
} from "./fixtures";

const ch = (c: string): Key => ({ kind: "char", ch: c });
const ESC: Key = { kind: "esc" };
const ENTER: Key = { kind: "enter" };

function viewOf(f: Fixture) {
  return buildView(f.game, f.ui, bundle);
}

describe("menu mode", () => {
  const v = viewOf(fxMenu());
  test("digits select characters", () => {
    expect(mapKey(ch("2"), v)).toEqual({ kind: "ui", act: { type: "menuChar", id: "SILENT" } });
    expect(mapKey(ch("4"), v)).toEqual({ kind: "ui", act: { type: "menuChar", id: "WATCHER" } });
    expect(mapKey(ch("5"), v)).toBeNull();
  });
  test("a/A step ascension", () => {
    expect(mapKey(ch("a"), v)).toEqual({ kind: "ui", act: { type: "menuAsc", delta: 1 } });
    expect(mapKey(ch("A"), v)).toEqual({ kind: "ui", act: { type: "menuAsc", delta: -1 } });
  });
  test("s starts seed entry, n starts a run, q quits", () => {
    expect(mapKey(ch("s"), v)).toEqual({ kind: "ui", act: { type: "seedEditStart" } });
    expect(mapKey(ch("n"), v)).toEqual({ kind: "ui", act: { type: "newRun" } });
    expect(mapKey(ch("q"), v)).toEqual({ kind: "ui", act: { type: "quit" } });
  });
  test("c continues only when a save exists", () => {
    expect(mapKey(ch("c"), v)).toEqual({ kind: "ui", act: { type: "continueRun" } });
    const noSave = fxMenu();
    const v2 = viewOf({ ...noSave, ui: { ...noSave.ui, menuSave: null } });
    expect(mapKey(ch("c"), v2)).toBeNull();
  });
});

describe("text-input mode", () => {
  const f = fxMenu();
  const v = viewOf({ ...f, ui: { ...f.ui, seedEdit: { value: "SPI" } } });
  test("chars, backspace, enter, esc map to seed-edit actions", () => {
    expect(v.mode).toBe("textInput");
    expect(mapKey(ch("x"), v)).toEqual({ kind: "ui", act: { type: "seedEditChar", ch: "x" } });
    expect(mapKey({ kind: "backspace" }, v)).toEqual({ kind: "ui", act: { type: "seedEditBackspace" } });
    expect(mapKey(ENTER, v)).toEqual({ kind: "ui", act: { type: "seedEditCommit" } });
    expect(mapKey(ESC, v)).toEqual({ kind: "ui", act: { type: "seedEditCancel" } });
    // letters do NOT trigger menu actions while typing
    expect(mapKey(ch("q"), v)).toEqual({ kind: "ui", act: { type: "seedEditChar", ch: "q" } });
  });
});

describe("map mode", () => {
  const f = fxMapAct1();
  const v = viewOf(f);
  test("digits travel to the numbered pick", () => {
    const a = mapKey(ch("1"), v);
    expect(a?.kind).toBe("cmd");
    if (a?.kind === "cmd") expect(a.cmd.cmd).toBe("mapPick");
    expect(mapKey(ch("9"), v)).toBeNull(); // only 3 picks on this map
  });
  test("j/k scroll, Esc backs out to the menu, q asks to quit", () => {
    expect(mapKey(ch("j"), v)).toEqual({ kind: "ui", act: { type: "mapScroll", delta: 1 } });
    expect(mapKey(ch("k"), v)).toEqual({ kind: "ui", act: { type: "mapScroll", delta: -1 } });
    expect(mapKey(ESC, v)).toEqual({ kind: "ui", act: { type: "backToMenu" } });
    expect(mapKey(ch("q"), v)).toEqual({ kind: "ui", act: { type: "openOverlay", overlay: { kind: "confirmQuit" } } });
  });
});

describe("combat mode", () => {
  test("digit on a self-targeted card plays it immediately", () => {
    const v = viewOf(fxCombat()); // hand: Defend Defend Strike Strike Strike
    expect(mapKey(ch("1"), v)).toEqual({ kind: "cmd", cmd: { cmd: "playCard", handIdx: 0 } });
  });
  test("digit on a targeted card with several enemies enters targeting", () => {
    const v = viewOf(fxCombat()); // two Louses alive
    expect(mapKey(ch("3"), v)).toEqual({
      kind: "ui",
      act: { type: "setTargeting", targeting: { kind: "card", handIdx: 2 } },
    });
  });
  test("digit on a targeted card with exactly one enemy auto-targets", () => {
    const f = fxCombatOrbs(); // lone Cultist; Strike is hand slot 4 (key '4')
    const v = viewOf(f);
    const strikeKey = v.screen.kind === "combat" ? v.screen.hand.findIndex((h) => h.targeted) : -1;
    const a = mapKey(ch(String(strikeKey + 1)), v);
    expect(a).toEqual({ kind: "cmd", cmd: { cmd: "playCard", handIdx: strikeKey, target: 0 } });
  });
  test("unplayable card toasts instead of advancing", () => {
    const f = fxCombat();
    const g = structuredClone(f.game!);
    g.combat!.player.energy = 0;
    const v = viewOf({ game: g, ui: f.ui });
    const a = mapKey(ch("1"), v);
    expect(a?.kind).toBe("ui");
    if (a?.kind === "ui") expect(a.act.type).toBe("toast");
  });
  test("e ends the turn; piles/deck/relics/potions/inspect open overlays", () => {
    const v = viewOf(fxCombat());
    expect(mapKey(ch("e"), v)).toEqual({ kind: "cmd", cmd: { cmd: "endTurn" } });
    expect(mapKey(ch("w"), v)).toEqual({ kind: "ui", act: { type: "openOverlay", overlay: { kind: "pile", pile: "draw", page: 0 } } });
    expect(mapKey(ch("x"), v)).toEqual({ kind: "ui", act: { type: "openOverlay", overlay: { kind: "pile", pile: "discard", page: 0 } } });
    expect(mapKey(ch("z"), v)).toEqual({ kind: "ui", act: { type: "openOverlay", overlay: { kind: "pile", pile: "exhaust", page: 0 } } });
    expect(mapKey(ch("d"), v)).toEqual({ kind: "ui", act: { type: "openOverlay", overlay: { kind: "deck", mode: "view", page: 0 } } });
    expect(mapKey(ch("r"), v)).toEqual({ kind: "ui", act: { type: "openOverlay", overlay: { kind: "relics", page: 0 } } });
    expect(mapKey(ch("p"), v)).toEqual({ kind: "ui", act: { type: "openOverlay", overlay: { kind: "potions" } } });
    expect(mapKey(ch("i"), v)).toEqual({ kind: "ui", act: { type: "openOverlay", overlay: { kind: "inspect", source: "hand", index: 0 } } });
  });
});

describe("targeting mode", () => {
  const v = viewOf(fxCombatTargeting()); // Strike (handIdx 2) awaiting target
  test("digits pick from the numbered alive list", () => {
    expect(v.mode).toBe("targeting");
    expect(mapKey(ch("1"), v)).toEqual({ kind: "cmd", cmd: { cmd: "playCard", handIdx: 2, target: 0 } });
    expect(mapKey(ch("2"), v)).toEqual({ kind: "cmd", cmd: { cmd: "playCard", handIdx: 2, target: 1 } });
    expect(mapKey(ch("3"), v)).toBeNull();
  });
  test("Esc cancels targeting", () => {
    expect(mapKey(ESC, v)).toEqual({ kind: "ui", act: { type: "setTargeting", targeting: null } });
  });
});

describe("pending-choice mode", () => {
  test("single pick (exactly 1) commits directly on a digit", () => {
    const v = viewOf(fxChoice()); // Neow REMOVE_CARD: cards min 1 max 1
    expect(v.mode).toBe("choice");
    expect(mapKey(ch("3"), v)).toEqual({ kind: "cmd", cmd: { cmd: "choose", indices: [2] } });
  });
  test("Esc without canCancel does nothing", () => {
    const v = viewOf(fxChoice());
    expect(mapKey(ESC, v)).toBeNull();
  });
  test("multi pick toggles, enforces min/max on Enter, Esc cancels when allowed", () => {
    const f = fxChoice();
    const g = structuredClone(f.game!);
    const req = g.pending!.request;
    if (req.kind !== "cards") throw new Error("expected cards request");
    req.min = 1;
    req.max = 2;
    req.canCancel = true;
    let ui = f.ui;
    let v = buildView(g, ui, bundle);
    // digit toggles
    expect(mapKey(ch("1"), v)).toEqual({ kind: "ui", act: { type: "toggleChoice", i: 0, max: 2 } });
    // Enter under min toasts
    const under = mapKey(ENTER, v);
    expect(under?.kind).toBe("ui");
    if (under?.kind === "ui") expect(under.act.type).toBe("toast");
    // select two, Enter commits
    ui = applyUiAction(ui, { type: "toggleChoice", i: 0, max: 2 });
    ui = applyUiAction(ui, { type: "toggleChoice", i: 4, max: 2 });
    v = buildView(g, ui, bundle);
    expect(mapKey(ENTER, v)).toEqual({ kind: "cmd", cmd: { cmd: "choose", indices: [0, 4] } });
    // a third toggle is clamped by the reducer with a toast
    const clamped = applyUiAction(ui, { type: "toggleChoice", i: 5, max: 2 });
    expect(clamped.choiceSel).toEqual([0, 4]);
    expect(clamped.toast).toBe("Select at most 2");
    // Esc cancels (choose nothing)
    expect(mapKey(ESC, v)).toEqual({ kind: "cmd", cmd: { cmd: "choose", indices: [] } });
  });
});

describe("list screens", () => {
  test("rewards: digit takes, disabled entries toast, Enter continues", () => {
    const f = fxRewards();
    const v = viewOf(f);
    expect(mapKey(ch("1"), v)).toEqual({ kind: "cmd", cmd: { cmd: "takeReward", i: 0 } });
    expect(mapKey(ENTER, v)).toEqual({ kind: "cmd", cmd: { cmd: "skipRewards" } });
    // mark the first entry taken: its digit must toast, not advance
    const g = structuredClone(f.game!);
    if (g.run.room?.kind === "rewards") g.run.room.entries[0]!.taken = true;
    const v2 = buildView(g, f.ui, bundle);
    expect(mapKey(ch("1"), v2)).toEqual({ kind: "ui", act: { type: "toast", text: "taken" } });
  });
  test("shop: pagination windows shift what digits map to", () => {
    const f = fxShop();
    const v = viewOf(f); // 15 items -> 2 pages
    expect(mapKey(ch("n"), v)).toEqual({ kind: "ui", act: { type: "page", delta: 1 } });
    const a1 = mapKey(ch("1"), v);
    expect(a1).toEqual({ kind: "cmd", cmd: { cmd: "shopBuy", kind: "card", idx: 0 } });
    const ui2 = applyUiAction(f.ui, { type: "page", delta: 1 });
    const v2 = buildView(f.game, ui2, bundle);
    const a2 = mapKey(ch("1"), v2); // item 10 = first potion slot (7 cards + 3 relics before it)
    expect(a2).toEqual({ kind: "cmd", cmd: { cmd: "shopBuy", kind: "potion", idx: 0 } });
    // p pages back
    expect(mapKey(ch("p"), v2)).toEqual({ kind: "ui", act: { type: "page", delta: -1 } });
  });
  test("rest: smith opens the deck-smith overlay", () => {
    const v = viewOf(fxRest());
    expect(mapKey(ch("2"), v)).toEqual({
      kind: "ui",
      act: { type: "openOverlay", overlay: { kind: "deck", mode: "smith", page: 0 } },
    });
  });
  test("game over: n reruns, m returns to the menu", () => {
    const v = viewOf(fxGameOverDefeat());
    expect(mapKey(ch("n"), v)).toEqual({ kind: "ui", act: { type: "rerun" } });
    expect(mapKey(ch("m"), v)).toEqual({ kind: "ui", act: { type: "backToMenu" } });
    expect(mapKey(ch("1"), v)).toEqual({ kind: "ui", act: { type: "rerun" } });
  });
});

describe("overlay mode", () => {
  test("deck smith overlay: digits smith that deck index, Esc closes", () => {
    const f = fxRest();
    const ui = applyUiAction(f.ui, { type: "openOverlay", overlay: { kind: "deck", mode: "smith", page: 0 } });
    const v = buildView(f.game, ui, bundle);
    expect(v.mode).toBe("overlay");
    expect(mapKey(ch("1"), v)).toEqual({ kind: "cmd", cmd: { cmd: "restOption", kind: "smith", deckIdx: 0 } });
    expect(mapKey(ESC, v)).toEqual({ kind: "ui", act: { type: "closeOverlay" } });
  });
  test("potion menu: use / discard / cancel (targeted needs combat)", () => {
    const f = fxCombat(); // three potions from Neow, in combat
    const slot = f.game!.run.potions.findIndex((p) => p !== null);
    const ui = applyUiAction(f.ui, { type: "openOverlay", overlay: { kind: "potionMenu", slot } });
    const v = buildView(f.game, ui, bundle);
    const use = mapKey(ch("u"), v);
    expect(use).not.toBeNull();
    expect(mapKey(ch("d"), v)).toEqual({ kind: "cmd", cmd: { cmd: "discardPotion", slot } });
    expect(mapKey(ESC, v)).toEqual({ kind: "ui", act: { type: "closeOverlay" } });
  });
  test("confirm-quit: y/Enter/q quit, n/Esc keep playing", () => {
    const f = fxMapAct1();
    const ui = applyUiAction(f.ui, { type: "openOverlay", overlay: { kind: "confirmQuit" } });
    const v = buildView(f.game, ui, bundle);
    expect(mapKey(ch("y"), v)).toEqual({ kind: "ui", act: { type: "quit" } });
    expect(mapKey(ch("q"), v)).toEqual({ kind: "ui", act: { type: "quit" } });
    expect(mapKey(ENTER, v)).toEqual({ kind: "ui", act: { type: "quit" } });
    expect(mapKey(ch("n"), v)).toEqual({ kind: "ui", act: { type: "closeOverlay" } });
    expect(mapKey(ESC, v)).toEqual({ kind: "ui", act: { type: "closeOverlay" } });
  });
});

describe("focus / selection cursor", () => {
  const TAB: Key = { kind: "tab" };
  const DOWN: Key = { kind: "down" };
  const UP: Key = { kind: "up" };

  function withFocus(f: Fixture, scope: string, idx: number): Fixture {
    return { ...f, ui: { ...f.ui, focus: { scope, idx } } };
  }

  test("Tab starts the cursor at 0 and cycles with wrap", () => {
    const f = fxRest();
    const v = viewOf(f);
    expect(v.focusIdx).toBeNull();
    expect(v.focusCount).toBeGreaterThan(0);
    expect(mapKey(TAB, v)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "rest", idx: 0 } });
    const last = viewOf(withFocus(f, "rest", v.focusCount - 1));
    expect(mapKey(TAB, last)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "rest", idx: 0 } });
  });

  test("arrows step the cursor; up from 0 wraps to the end", () => {
    const f = fxRest();
    const v = viewOf(withFocus(f, "rest", 0));
    expect(mapKey(DOWN, v)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "rest", idx: 1 } });
    expect(mapKey(UP, v)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "rest", idx: v.focusCount - 1 } });
  });

  test("Enter activates the focused list item; Esc clears the cursor first", () => {
    const f = fxRest();
    const v = viewOf(withFocus(f, "rest", 0));
    expect(v.focusIdx).toBe(0);
    const a = mapKey(ENTER, v);
    expect(a).toEqual({ kind: "cmd", cmd: { cmd: "restOption", kind: "rest" } });
    expect(mapKey(ESC, v)).toEqual({ kind: "ui", act: { type: "focusClear" } });
    const cleared = viewOf(f);
    expect(mapKey(ESC, cleared)).toEqual({ kind: "ui", act: { type: "backToMenu" } });
  });

  test("Enter on a focused disabled item toasts its note", () => {
    const f = fxRewards();
    const g = structuredClone(f.game!);
    if (g.run.room?.kind === "rewards") g.run.room.entries[0]!.taken = true;
    const v = buildView(g, { ...f.ui, focus: { scope: "rewards", idx: 0 } }, bundle);
    expect(mapKey(ENTER, v)).toEqual({ kind: "ui", act: { type: "toast", text: "taken" } });
  });

  test("menu: arrows select heroes, Enter picks the focused one", () => {
    const f = fxMenu();
    const v0 = viewOf(f);
    expect(mapKey(DOWN, v0)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "menu", idx: 0 } });
    const v2 = viewOf(withFocus(f, "menu", 1));
    expect(mapKey(ENTER, v2)).toEqual({ kind: "ui", act: { type: "menuChar", id: "SILENT" } });
    const vNew = viewOf(withFocus(f, "menu", 4));
    expect(mapKey(ENTER, vNew)).toEqual({ kind: "ui", act: { type: "newRun" } });
    const vCont = viewOf(withFocus(f, "menu", 5));
    expect(mapKey(ENTER, vCont)).toEqual({ kind: "ui", act: { type: "continueRun" } });
    // no cursor: Enter keeps meaning "new run"
    expect(mapKey(ENTER, v0)).toEqual({ kind: "ui", act: { type: "newRun" } });
  });

  test("combat: hover is read-only (Enter does not play) and shows a card tooltip", () => {
    const f = fxCombat();
    const v = viewOf(withFocus(f, "combat", 2));
    expect(v.tooltip?.chip).toBe("CARD");
    expect(v.tooltip?.name).toContain("Strike");
    expect(v.tooltip?.lines.join(" ")).toContain("Deal 6 damage.");
    expect(mapKey(ENTER, v)).toBeNull();
    // Tab past the hand lands on an enemy tooltip
    const hand = v.screen.kind === "combat" ? v.screen.hand.length : 0;
    const vEnemy = viewOf(withFocus(f, "combat", hand));
    expect(vEnemy.tooltip?.chip).toBe("ENEMY");
    expect(vEnemy.tooltip?.lines.length).toBeGreaterThan(0);
  });

  test("targeting auto-focuses target 0; arrows retarget; Enter fires", () => {
    const f = fxCombatTargeting();
    const v = viewOf(f);
    expect(v.mode).toBe("targeting");
    expect(v.focusIdx).toBe(0);
    expect(v.tooltip?.chip).toBe("ENEMY");
    expect(mapKey(ENTER, v)).toEqual({ kind: "cmd", cmd: { cmd: "playCard", handIdx: 2, target: 0 } });
    expect(mapKey(DOWN, v)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "targeting", idx: 1 } });
    const v2 = viewOf(withFocus(f, "targeting", 1));
    expect(mapKey(ENTER, v2)).toEqual({ kind: "cmd", cmd: { cmd: "playCard", handIdx: 2, target: 1 } });
  });

  test("map: Tab cycles picks, Enter travels, unfocused arrows still scroll", () => {
    const f = fxMapAct1();
    const v0 = viewOf(f);
    expect(mapKey(DOWN, v0)).toEqual({ kind: "ui", act: { type: "mapScroll", delta: 1 } });
    expect(mapKey(TAB, v0)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "map", idx: 0 } });
    const v1 = viewOf(withFocus(f, "map", 0));
    expect(v1.tooltip?.chip).toBe("NODE");
    const a = mapKey(ENTER, v1);
    expect(a?.kind).toBe("cmd");
    if (a?.kind === "cmd") expect(a.cmd.cmd).toBe("mapPick");
    expect(mapKey(DOWN, v1)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "map", idx: 1 } });
  });

  test("shop cursor auto-pages: focusing item 12 shows page 2", () => {
    const f = fxShop();
    const v = viewOf(withFocus(f, "shop", 12));
    if (v.screen.kind === "menu" || v.screen.kind === "map" || v.screen.kind === "combat") throw new Error("bad screen");
    expect(v.screen.list.page).toBe(1);
    expect(v.screen.list.focusI).toBe(12);
    expect(v.focusIdx).toBe(12);
  });

  test("shop: focused relic shows corpus text in the tooltip", () => {
    const f = fxShop();
    const v = viewOf(withFocus(f, "shop", 7));
    expect(v.tooltip?.chip).toBe("RELIC");
    expect((v.tooltip?.lines.length ?? 0)).toBeGreaterThan(0);
  });

  test("single pending choice: Enter commits the focused card", () => {
    const f = fxChoice();
    const v = viewOf(withFocus(f, "choice", 3));
    expect(v.mode).toBe("choice");
    expect(v.tooltip?.chip).toBe("CARD");
    expect(mapKey(ENTER, v)).toEqual({ kind: "cmd", cmd: { cmd: "choose", indices: [3] } });
  });

  test("deck overlay: arrows browse, tooltip shows the full card", () => {
    const f = fxMapAct1();
    const ui1 = applyUiAction(f.ui, { type: "openOverlay", overlay: { kind: "deck", mode: "view", page: 0 } });
    const v0 = buildView(f.game, ui1, bundle);
    expect(mapKey(TAB, v0)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "overlay", idx: 0 } });
    const v1 = buildView(f.game, { ...ui1, focus: { scope: "overlay", idx: 0 } }, bundle);
    expect(v1.tooltip?.chip).toBe("CARD");
    expect(v1.tooltip?.lines.length).toBeGreaterThan(0);
  });

  test("stale focus from another screen is ignored", () => {
    const f = fxRest();
    const v = viewOf(withFocus(f, "combat", 3));
    expect(v.focusIdx).toBeNull();
    expect(v.tooltip).toBeNull();
  });

  test("out-of-range focus clamps to the last focusable", () => {
    const f = fxRest();
    const v = viewOf(withFocus(f, "rest", 99));
    expect(v.focusIdx).toBe(v.focusCount - 1);
  });
});

describe("uiState reducer details", () => {
  test("seed editing filters characters and uppercases", () => {
    let ui = initialUiState({ seed: "SPIRE" });
    ui = applyUiAction(ui, { type: "seedEditStart" });
    ui = applyUiAction(ui, { type: "seedEditChar", ch: "x" });
    ui = applyUiAction(ui, { type: "seedEditChar", ch: "!" }); // rejected
    ui = applyUiAction(ui, { type: "seedEditChar", ch: "7" });
    expect(ui.seedEdit?.value).toBe("SPIREX7");
    ui = applyUiAction(ui, { type: "seedEditBackspace" });
    ui = applyUiAction(ui, { type: "seedEditCommit" });
    expect(ui.seed).toBe("SPIREX");
    expect(ui.seedEdit).toBeNull();
  });
  test("ascension clamps to 0..20", () => {
    let ui = initialUiState({ ascension: 0 });
    ui = applyUiAction(ui, { type: "menuAsc", delta: -1 });
    expect(ui.ascension).toBe(0);
    ui = { ...ui, ascension: 20 };
    ui = applyUiAction(ui, { type: "menuAsc", delta: 1 });
    expect(ui.ascension).toBe(20);
  });
  test("ctrl+c always maps to quit", () => {
    const v = viewOf(fxCombat());
    expect(mapKey({ kind: "ctrlC" }, v)).toEqual({ kind: "ui", act: { type: "quit" } });
  });
});
