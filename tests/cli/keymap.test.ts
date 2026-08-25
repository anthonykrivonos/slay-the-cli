// Keymap tests per input mode: digit auto-target vs targeting entry, pending
// single/multi with min/max, pagination windows, disabled options unmapped
// (they toast instead), and Esc semantics. Views come from buildView over real
// fixture states, so the keymap is tested against exactly what renders.

import { test, expect, describe } from "bun:test";
import type { Key } from "../../src/cli/term/keys";
import { mapKey } from "../../src/cli/input/keymap";
import { buildView } from "../../src/cli/state/view";
import { applyUiAction, initialUiState, type Overlay, type InspectSource, type UiState } from "../../src/cli/state/uiState";
import { isAppAction, type KeyAction } from "../../src/cli/input/actions";
import { advance } from "../../src/engine/game";
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
  test("digits drive the unified cursor+selection", () => {
    expect(mapKey(ch("2"), v)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "menu", idx: 1 } });
    expect(mapKey(ch("4"), v)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "menu", idx: 3 } });
    expect(mapKey(ch("5"), v)).toBeNull();
  });
  test("focusSet on a hero row selects that character (cursor = highlight)", () => {
    let ui = initialUiState({ seed: "SPIRE" });
    ui = applyUiAction(ui, { type: "focusSet", scope: "menu", idx: 2 });
    expect(ui.character).toBe("DEFECT");
    expect(ui.focus).toEqual({ scope: "menu", idx: 2 });
    // non-hero rows leave the selection alone
    ui = applyUiAction(ui, { type: "focusSet", scope: "menu", idx: 4 });
    expect(ui.character).toBe("DEFECT");
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
    expect(mapKey(ch("i"), v)).toEqual({ kind: "ui", act: { type: "openOverlay", overlay: { kind: "inspect", source: { of: "hand" }, index: 0 } } });
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
    // Enter drinks it, the same as u: that is what you opened this for
    expect(mapKey(ENTER, v)).toEqual(use);
    expect(mapKey(ch("d"), v)).toEqual({ kind: "cmd", cmd: { cmd: "discardPotion", slot } });
    expect(mapKey(ESC, v)).toEqual({ kind: "ui", act: { type: "closeOverlay" } });
  });
  test("rewards: [i] inspects the offer, Enter takes the inspected card", () => {
    const f = fxRewards();
    const v = buildView(f.game, f.ui, bundle);
    if (v.screen.kind !== "rewards") throw new Error("expected rewards");
    const offers = v.screen.rows.flatMap((r) => (r.type === "group" && r.kind === "card" ? r.items : []));
    expect(offers.length).toBeGreaterThan(1);

    // no cursor: inspection starts on the first card on offer
    expect(mapKey(ch("i"), v)).toEqual({
      kind: "ui",
      act: { type: "openOverlay", overlay: { kind: "inspect", source: { of: "reward" }, index: 0 } },
    });
    // with the cursor on the second card, inspection starts there
    const uiFocus = applyUiAction(f.ui, { type: "focusSet", scope: "rewards", idx: offers[1]!.i });
    const vFocus = buildView(f.game, uiFocus, bundle);
    expect(mapKey(ch("i"), vFocus)).toEqual({
      kind: "ui",
      act: { type: "openOverlay", overlay: { kind: "inspect", source: { of: "reward" }, index: 1 } },
    });

    // inside the overlay the full rules text is there, and Enter takes it
    const uiOpen = applyUiAction(f.ui, { type: "openOverlay", overlay: { kind: "inspect", source: { of: "reward" }, index: 0 } });
    const vOpen = buildView(f.game, uiOpen, bundle);
    if (vOpen.overlay?.kind !== "inspect") throw new Error("expected inspect overlay");
    expect(vOpen.overlay.count).toBe(offers.length);
    expect(vOpen.overlay.enter).toEqual({ kind: "cmd", cmd: { cmd: "takeReward", i: offers[0]!.i } });
    expect(vOpen.hint).toContain("[Enter] take");
    expect(mapKey(ENTER, vOpen)).toEqual({ kind: "cmd", cmd: { cmd: "takeReward", i: offers[0]!.i } });
    // and the box in the panel had to cut that text short
    expect(offers[0]!.rules.join(" ").length).toBeGreaterThan(0);
  });

  test("inspect overlay: Enter plays a card from hand, but not one from the deck", () => {
    const f = fxCombat();
    const inHand = applyUiAction(f.ui, { type: "openOverlay", overlay: { kind: "inspect", source: { of: "hand" }, index: 0 } });
    const vHand = buildView(f.game, inHand, bundle);
    expect(mapKey(ENTER, vHand)).toEqual({ kind: "cmd", cmd: { cmd: "playCard", handIdx: 0 } });
    expect(vHand.hint).toContain("[Enter] play");

    const inDeck = applyUiAction(f.ui, { type: "openOverlay", overlay: { kind: "inspect", source: { of: "deck" }, index: 0 } });
    const vDeck = buildView(f.game, inDeck, bundle);
    expect(mapKey(ENTER, vDeck)).toBeNull();
    expect(vDeck.hint).not.toContain("[Enter] play");
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

describe("vim keys", () => {
  const DOWN: Key = { kind: "down" };
  const UP: Key = { kind: "up" };
  const LEFT: Key = { kind: "left" };
  const RIGHT: Key = { kind: "right" };

  /** the same fixture with vim bindings on, and optionally a cursor */
  function vim(f: Fixture, scope?: string, idx = 0): Fixture {
    const focus = scope !== undefined ? { scope, idx } : f.ui.focus;
    return { ...f, ui: { ...f.ui, vimKeys: true, focus } };
  }

  test("hjkl are the arrow keys, on every screen that has a cursor", () => {
    for (const [f, scope] of [
      [fxRest(), "rest"],
      [fxRewards(), "rewards"],
      [fxMenu(), "menu"],
    ] as const) {
      const v = viewOf(vim(f, scope, 0));
      expect(mapKey(ch("j"), v)).toEqual(mapKey(DOWN, v));
      expect(mapKey(ch("k"), v)).toEqual(mapKey(UP, v));
      expect(mapKey(ch("l"), v)).toEqual(mapKey(RIGHT, v));
      expect(mapKey(ch("h"), v)).toEqual(mapKey(LEFT, v));
      // and they actually move: down from 0 lands on 1
      expect(mapKey(ch("j"), v)).toEqual({ kind: "ui", act: { type: "focusSet", scope, idx: 1 } });
    }
  });

  test("on the map, h/l pick the path and j/k scroll (unchanged meanings)", () => {
    const plain = viewOf(fxMapAct1());
    const v = viewOf(vim(fxMapAct1()));
    // j/k already scrolled before vim mode; they still do
    expect(mapKey(ch("j"), v)).toEqual({ kind: "ui", act: { type: "mapScroll", delta: 1 } });
    expect(mapKey(ch("k"), v)).toEqual({ kind: "ui", act: { type: "mapScroll", delta: -1 } });
    expect(mapKey(ch("j"), plain)).toEqual(mapKey(ch("j"), v));
    // h/l were unbound/unused here and now choose between the paths
    expect(mapKey(ch("l"), v)).toEqual(mapKey(RIGHT, v));
    expect(mapKey(ch("h"), v)).toEqual(mapKey(LEFT, v));
  });

  test("in the inspect overlay j/k still step, because that was already vim", () => {
    const f = fxCombat();
    const open: Overlay = { kind: "inspect", source: { of: "hand" } as InspectSource, index: 0 };
    const withOverlay = { ...f, ui: { ...f.ui, overlays: [open] } };
    const plain = viewOf(withOverlay);
    const v = viewOf({ ...withOverlay, ui: { ...withOverlay.ui, vimKeys: true } });
    expect(mapKey(ch("j"), plain)).toEqual({ kind: "ui", act: { type: "inspectMove", delta: 1, count: expect.any(Number) } });
    expect(mapKey(ch("j"), v)).toEqual(mapKey(ch("j"), plain));
    expect(mapKey(ch("k"), v)).toEqual(mapKey(ch("k"), plain));
  });

  test("the combat log is displaced from [l] to [L]", () => {
    const openLog: KeyAction = { kind: "ui", act: { type: "openOverlay", overlay: { kind: "log" } } };
    const plain = viewOf(fxCombat());
    // vim off: both keys reach the log
    expect(mapKey(ch("l"), plain)).toEqual(openLog);
    expect(mapKey(ch("L"), plain)).toEqual(openLog);
    // vim on: [l] is movement, [L] is the log
    const v = viewOf(vim(fxCombat()));
    expect(mapKey(ch("L"), v)).toEqual(openLog);
    expect(mapKey(ch("l"), v)).not.toEqual(openLog);
    expect(mapKey(ch("l"), v)).toEqual(mapKey(RIGHT, v));
  });

  test("[L] closes the log overlay too", () => {
    const f = fxCombat();
    const withLog = { ...f, ui: { ...f.ui, vimKeys: true, overlays: [{ kind: "log" } as Overlay] } };
    expect(mapKey(ch("L"), viewOf(withLog))).toEqual({ kind: "ui", act: { type: "closeOverlay" } });
  });

  test("seed entry still spells hjkl (chars stay literal in text input)", () => {
    const editing = { ...fxMenu(), ui: { ...fxMenu().ui, vimKeys: true, seedEdit: { value: "" } } };
    const v = viewOf(editing);
    expect(v.mode).toBe("textInput");
    for (const c of ["h", "j", "k", "l"]) {
      expect(mapKey(ch(c), v)).toEqual({ kind: "ui", act: { type: "seedEditChar", ch: c } });
    }
  });

  test("the hint bar prints the keys that are actually live", () => {
    expect(viewOf(fxCombat()).hint).toContain("[l] log");
    expect(viewOf(vim(fxCombat())).hint).toContain("[L] log");
    expect(viewOf(fxMapAct1()).hint).toContain("[up/dn] scroll");
    expect(viewOf(vim(fxMapAct1())).hint).toContain("[j/k] scroll");
  });
});

describe("settings", () => {
  const openSettings: KeyAction = { kind: "ui", act: { type: "openOverlay", overlay: { kind: "settings" } } };

  test("[S] opens it from the menu and from any run screen", () => {
    expect(mapKey(ch("S"), viewOf(fxMenu()))).toEqual(openSettings);
    expect(mapKey(ch("S"), viewOf(fxCombat()))).toEqual(openSettings);
    expect(mapKey(ch("S"), viewOf(fxMapAct1()))).toEqual(openSettings);
    expect(mapKey(ch("S"), viewOf(fxRest()))).toEqual(openSettings);
  });

  test("the menu SETTINGS row sits last and Enter opens it", () => {
    const f = fxMenu();
    const m = viewOf(f).screen;
    if (m.kind !== "menu") throw new Error("expected the menu");
    // with a save present: 4 heroes, NEW RUN, CONTINUE, SETTINGS
    expect(m.settingsIdx).toBe(6);
    expect(viewOf(f).focusCount).toBe(7);
    const onSettings = { ...f, ui: { ...f.ui, focus: { scope: "menu", idx: m.settingsIdx } } };
    expect(mapKey(ENTER, viewOf(onSettings))).toEqual(openSettings);
  });

  test("without a save the row moves up, and NEW RUN keeps index 4", () => {
    const f = fxMenu();
    const noSave = { ...f, ui: { ...f.ui, menuSave: null } };
    const m = viewOf(noSave).screen;
    if (m.kind !== "menu") throw new Error("expected the menu");
    expect(m.settingsIdx).toBe(5);
    expect(viewOf(noSave).focusCount).toBe(6);
    const onNewRun = { ...noSave, ui: { ...noSave.ui, focus: { scope: "menu", idx: 4 } } };
    expect(mapKey(ENTER, viewOf(onNewRun))).toEqual({ kind: "ui", act: { type: "newRun" } });
  });

  test("the overlay opens over the menu, which has no run behind it", () => {
    const f = fxMenu();
    const open = { ...f, ui: { ...f.ui, overlays: [{ kind: "settings" } as Overlay] } };
    const v = viewOf(open);
    expect(v.mode).toBe("overlay");
    expect(v.overlay?.kind).toBe("list");
    expect(v.focusCount).toBe(1);
  });

  test("Enter and [1] both toggle, and Esc closes", () => {
    const f = fxMenu();
    const open = { ...f, ui: { ...f.ui, overlays: [{ kind: "settings" } as Overlay] } };
    const v = viewOf(open);
    const toggle: KeyAction = { kind: "ui", act: { type: "toggleVimKeys" } };
    expect(mapKey(ENTER, v)).toEqual(toggle);
    expect(mapKey(ch("1"), v)).toEqual(toggle);
    expect(mapKey(ESC, v)).toEqual({ kind: "ui", act: { type: "closeOverlay" } });
  });

  test("toggling flips the flag, and the row redraws to match", () => {
    const f = fxMenu();
    const open: UiState = { ...f.ui, overlays: [{ kind: "settings" }] };
    expect(viewOf({ game: null, ui: open }).overlay).toMatchObject({
      list: { items: [{ label: "Vim keys  [ ]" }] },
    });
    const flipped = applyUiAction(open, { type: "toggleVimKeys" });
    expect(flipped.vimKeys).toBe(true);
    expect(viewOf({ game: null, ui: flipped }).overlay).toMatchObject({
      list: { items: [{ label: "Vim keys  [x]" }] },
    });
  });
});

describe("focus / selection cursor", () => {
  const TAB: Key = { kind: "tab" };
  const DOWN: Key = { kind: "down" };
  const UP: Key = { kind: "up" };
  const LEFT: Key = { kind: "left" };
  const RIGHT: Key = { kind: "right" };

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

  test("Shift-Tab cycles backwards (starts at the end when unfocused)", () => {
    const f = fxRest();
    const SHIFT_TAB: Key = { kind: "shiftTab" };
    const v0 = viewOf(f);
    expect(mapKey(SHIFT_TAB, v0)).toEqual({
      kind: "ui",
      act: { type: "focusSet", scope: "rest", idx: v0.focusCount - 1 },
    });
    const v1 = viewOf(withFocus(f, "rest", 1));
    expect(mapKey(SHIFT_TAB, v1)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "rest", idx: 0 } });
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

  test("menu: arrows move the cursor, Enter confirms into a run", () => {
    const f = fxMenu();
    const v0 = viewOf(f);
    expect(mapKey(DOWN, v0)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "menu", idx: 0 } });
    // the cursor already selected the hero, so Enter on a hero row confirms
    const v2 = viewOf(withFocus(f, "menu", 1));
    expect(mapKey(ENTER, v2)).toEqual({ kind: "ui", act: { type: "newRun" } });
    const vNew = viewOf(withFocus(f, "menu", 4));
    expect(mapKey(ENTER, vNew)).toEqual({ kind: "ui", act: { type: "newRun" } });
    const vCont = viewOf(withFocus(f, "menu", 5));
    expect(mapKey(ENTER, vCont)).toEqual({ kind: "ui", act: { type: "continueRun" } });
    // no cursor: Enter keeps meaning "new run"
    expect(mapKey(ENTER, v0)).toEqual({ kind: "ui", act: { type: "newRun" } });
  });

  test("combat: Enter plays the highlighted card, like its digit would", () => {
    const f = fxCombat();
    const v = viewOf(withFocus(f, "combat", 2));
    expect(v.tooltip?.chip).toBe("CARD");
    expect(v.tooltip?.name).toContain("Strike");
    expect(v.tooltip?.lines.join(" ")).toContain("Deal 6 damage.");
    // hand index 2 is a Strike: targeted, and this fight has two enemies, so
    // both the digit and Enter open targeting
    const viaDigit = mapKey({ kind: "char", ch: "3" }, v);
    expect(mapKey(ENTER, v)).toEqual(viaDigit);
    expect(mapKey(ENTER, v)).toEqual({
      kind: "ui",
      act: { type: "setTargeting", targeting: { kind: "card", handIdx: 2 } },
    });
  });

  test("combat: Enter on an untargeted card plays it outright", () => {
    const f = fxCombat();
    const v = viewOf(withFocus(f, "combat", 0)); // Defend
    expect(v.tooltip?.name).toContain("Defend");
    expect(mapKey(ENTER, v)).toEqual({ kind: "cmd", cmd: { cmd: "playCard", handIdx: 0 } });
  });

  test("combat: Enter on an enemy says how to aim, and Tab still shows its tooltip", () => {
    const f = fxCombat();
    const hand = viewOf(f).screen.kind === "combat" ? (viewOf(f).screen as { hand: unknown[] }).hand.length : 0;
    const vEnemy = viewOf(withFocus(f, "combat", hand));
    expect(vEnemy.tooltip?.chip).toBe("ENEMY");
    expect(vEnemy.tooltip?.lines.length).toBeGreaterThan(0);
    expect(mapKey(ENTER, vEnemy)).toEqual({ kind: "ui", act: { type: "toast", text: "Pick a card to aim at it" } });
  });

  test("combat: Enter on a potion opens its use/discard menu", () => {
    const f = fxCombat();
    const v0 = viewOf(f);
    if (v0.screen.kind !== "combat") throw new Error("expected combat");
    const relics = v0.screen.relics.length;
    const potionSlot = v0.screen.potions.findIndex((p) => p !== null);
    const idx = v0.screen.hand.length + v0.screen.enemies.filter((e) => e.gone === null).length + relics;
    const v = viewOf(withFocus(f, "combat", idx));
    expect(v.tooltip?.chip).toBe("POTION");
    expect(mapKey(ENTER, v)).toEqual({
      kind: "ui",
      act: { type: "openOverlay", overlay: { kind: "potionMenu", slot: potionSlot } },
    });
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

  test("map: left/right choose the path, up/down scroll, Enter travels", () => {
    const f = fxMapAct1();
    const v0 = viewOf(f);
    // vertical is the scroll axis, whether or not a path is highlighted
    expect(mapKey(DOWN, v0)).toEqual({ kind: "ui", act: { type: "mapScroll", delta: 1 } });
    expect(mapKey(UP, v0)).toEqual({ kind: "ui", act: { type: "mapScroll", delta: -1 } });
    // right takes the cursor from nothing, without needing Tab first
    expect(mapKey(RIGHT, v0)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "map", idx: 0 } });
    expect(mapKey(TAB, v0)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "map", idx: 0 } });

    const v1 = viewOf(withFocus(f, "map", 0));
    expect(v1.tooltip?.chip).toBe("NODE");
    expect(mapKey(RIGHT, v1)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "map", idx: 1 } });
    expect(mapKey(DOWN, v1)).toEqual({ kind: "ui", act: { type: "mapScroll", delta: 1 } });
    const a = mapKey(ENTER, v1);
    expect(a?.kind).toBe("cmd");
    if (a?.kind === "cmd") expect(a.cmd.cmd).toBe("mapPick");

    // left from nothing wraps to the last path
    const picks = v0.screen.kind === "map" ? v0.screen.picks.length : 0;
    expect(mapKey(LEFT, v0)).toEqual({ kind: "ui", act: { type: "focusSet", scope: "map", idx: picks - 1 } });
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

// --- [i] --------------------------------------------------------------------------

describe("[i] inspects whatever the cursor is on", () => {
  const I = ch("i");
  const opens = (source: InspectSource, index: number): KeyAction => ({
    kind: "ui",
    act: { type: "openOverlay", overlay: { kind: "inspect", source, index } },
  });
  /** the fixture with the cursor parked on one focusable of `scope` */
  function withCursor(f: Fixture, scope: string, idx: number) {
    return buildView(f.game, applyUiAction(f.ui, { type: "focusSet", scope, idx }), bundle);
  }
  function withOverlay(f: Fixture, overlay: Overlay) {
    return buildView(f.game, applyUiAction(f.ui, { type: "openOverlay", overlay }), bundle);
  }
  /** apply a keymap result that must be a pure UI action */
  function apply(ui: UiState, act: KeyAction | null): UiState {
    if (act === null || act.kind !== "ui" || isAppAction(act.act)) throw new Error("expected a pure ui action");
    return applyUiAction(ui, act.act);
  }

  test("shop: no cursor starts at the first thing, a cursor starts where it is", () => {
    const f = fxShop();
    // 7 cards then 3 relics then 3 potions, the order the cursor walks them
    expect(mapKey(I, viewOf(f))).toEqual(opens({ of: "shop" }, 0));
    expect(mapKey(I, withCursor(f, "shop", 7))).toEqual(opens({ of: "shop" }, 7));
    expect(mapKey(I, withCursor(f, "shop", 10))).toEqual(opens({ of: "shop" }, 10));
    // the removal button and Leave are not things you can read
    const v = withCursor(f, "shop", 13);
    if (v.screen.kind !== "shop") throw new Error("expected shop");
    expect(v.inspect).toEqual({ source: { of: "shop" }, index: 0 });
  });

  test("the shop hint advertises it, and the inspector buys", () => {
    const f = fxShop();
    expect(viewOf(f).hint).toContain("[i] inspect");
    const v = withOverlay(f, { kind: "inspect", source: { of: "shop" }, index: 0 });
    if (v.overlay?.kind !== "inspect") throw new Error("expected inspect");
    expect(v.overlay.chip).toBe("CARD");
    expect(v.hint).toContain("[Enter] buy");
    expect(mapKey(ENTER, v)).toEqual({ kind: "cmd", cmd: { cmd: "shopBuy", kind: "card", idx: 0 } });
  });

  test("a sold shop slot refuses from the inspector too", () => {
    const f = fxShop();
    const g = structuredClone(f.game!);
    if (g.run.room?.kind !== "shop") throw new Error("expected shop");
    g.run.room.shop.cards[0]!.sold = true;
    const sold: Fixture = { game: g, ui: f.ui };
    const v = withOverlay(sold, { kind: "inspect", source: { of: "shop" }, index: 0 });
    if (v.overlay?.kind !== "inspect") throw new Error("expected inspect");
    expect(mapKey(ENTER, v)).toEqual({ kind: "ui", act: { type: "toast", text: "sold" } });
    // ...but you can still read what it was
    expect(v.overlay.rules.join(" ").length).toBeGreaterThan(0);
  });

  test("relics and potions are inspectable, which they never were before", () => {
    const f = fxShop(); // mid-run: has a relic and full potion slots
    const relics = withOverlay(f, { kind: "relics", page: 0 });
    expect(mapKey(I, relics)).toEqual(opens({ of: "relics" }, 0));
    const potions = withOverlay(f, { kind: "potions" });
    expect(mapKey(I, potions)).toEqual(opens({ of: "potions" }, 0));

    const vr = withOverlay(f, { kind: "inspect", source: { of: "relics" }, index: 0 });
    if (vr.overlay?.kind !== "inspect") throw new Error("expected inspect");
    expect(vr.overlay.chip).toBe("RELIC");
    expect(vr.overlay.cost).toBeNull();
    expect(vr.overlay.type).toStartWith("Relic - ");
    expect(vr.overlay.rules.join(" ").length).toBeGreaterThan(0);

    const vp = withOverlay(f, { kind: "inspect", source: { of: "potions" }, index: 0 });
    if (vp.overlay?.kind !== "inspect") throw new Error("expected inspect");
    expect(vp.overlay.chip).toBe("POTION");
    expect(vp.hint).toContain("[Enter] use");
    expect(mapKey(ENTER, vp)).toEqual({
      kind: "ui",
      act: { type: "openOverlay", overlay: { kind: "potionMenu", slot: 0 } },
    });
  });

  test("combat: the piles and the relic/potion strip, not just the hand", () => {
    const f = fxCombat();
    expect(mapKey(I, viewOf(f))).toEqual(opens({ of: "hand" }, 0));
    const draw = withOverlay(f, { kind: "pile", pile: "draw", page: 0 });
    expect(mapKey(I, draw)).toEqual(opens({ of: "pile", pile: "draw" }, 0));
    // the combat cursor walks hand, then enemies, then relics
    const v = viewOf(f);
    if (v.screen.kind !== "combat") throw new Error("expected combat");
    const relicIdx = v.screen.hand.length + v.screen.enemies.filter((e) => e.gone === null).length;
    expect(mapKey(I, withCursor(f, "combat", relicIdx))).toEqual(opens({ of: "relics" }, 0));
  });

  test("a pending card choice is inspectable before you commit to it", () => {
    const f = fxChoice(); // Neow's REMOVE_CARD picker over the starting deck
    expect(mapKey(I, viewOf(f))).toEqual(opens({ of: "choice" }, 0));
    expect(mapKey(I, withCursor(f, "choice", 3))).toEqual(opens({ of: "choice" }, 3));
    expect(viewOf(f).hint).toContain("[i] inspect");
  });

  test("rewards: the cursor and [i] agree after a card has been taken", () => {
    // the regression: the keymap used to count offers including taken ones
    // while the overlay excluded them, so [i] opened the next card along
    const f = fxRewards();
    const cardIdx = f.game!.run.room!.kind === "rewards" ? 1 : -1;
    const after = advance(f.game!, { cmd: "takeReward", i: cardIdx }, bundle);
    const taken: Fixture = { game: after, ui: f.ui };
    const v = withCursor(taken, "rewards", 2); // the second card on offer
    if (v.screen.kind !== "rewards") throw new Error("expected rewards");
    const focused = v.screen.rows.flatMap((r) => (r.type === "group" ? r.items : [])).find((it) => it.i === 2)!;
    const opened = buildView(after, apply(taken.ui, mapKey(I, v)), bundle);
    if (opened.overlay?.kind !== "inspect") throw new Error("expected inspect");
    // the old code filtered taken entries out of the overlay but not out of
    // the keymap's count, so this used to open a different card (and, once the
    // whole group went with the pick, nothing at all)
    expect(opened.overlay.name).toBe(focused.name);
    // and Enter refuses exactly the way the row does, rather than firing
    expect(opened.overlay.enter).toEqual({ kind: "ui", act: { type: "toast", text: "taken" } });
    expect(mapKey(ENTER, opened)).toEqual({ kind: "ui", act: { type: "toast", text: "taken" } });
  });

  test("Esc pops the inspector off the list it was opened from", () => {
    const f = fxMapAct1();
    let ui = applyUiAction(f.ui, { type: "openOverlay", overlay: { kind: "deck", mode: "view", page: 3 } });
    const list = buildView(f.game, ui, bundle);
    expect(mapKey(I, list)).toEqual(opens({ of: "deck" }, 0));
    ui = apply(ui, mapKey(I, list));
    const inspecting = buildView(f.game, ui, bundle);
    expect(inspecting.overlay?.kind).toBe("inspect");
    expect(ui.overlays).toHaveLength(2); // pushed on top, the list is still there
    ui = applyUiAction(ui, { type: "closeOverlay" });
    const back = buildView(f.game, ui, bundle);
    if (back.overlay?.kind !== "list") throw new Error("expected the deck list back");
    expect(back.overlay.id).toBe("deck");
    expect(ui.overlays).toEqual([{ kind: "deck", mode: "view", page: 3 }]); // untouched
  });

  test("where there is nothing to read, [i] does nothing and the hint says so", () => {
    const v = viewOf(fxMapAct1());
    expect(v.inspect).toBeNull();
    expect(mapKey(I, v)).toBeNull();
    expect(v.hint).not.toContain("[i]");
  });
});
