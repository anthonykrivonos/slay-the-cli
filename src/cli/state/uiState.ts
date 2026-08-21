// UI-only state (never serialized into the run save) + the pure reducer over
// UiAction. The app owns one UiState next to the GameState; buildView folds
// both into the render-ready View.

import type { UICharacterId } from "../text/runlogic";
import { clampAscension, MAX_ASCENSION, isCharacterId, CHARACTER_IDS } from "../text/runlogic";
import type { PureUiAction } from "../input/actions";

export type PileName = "draw" | "discard" | "exhaust";
export type DeckOverlayMode = "view" | "smith" | "remove";

export type Overlay =
  | { kind: "deck"; mode: DeckOverlayMode; page: number }
  | { kind: "relics"; page: number }
  | { kind: "pile"; pile: PileName; page: number }
  | { kind: "potions" }
  | { kind: "potionMenu"; slot: number }
  /** index is a position within the source: hand slot, deck slot, or which of
   *  the offered reward cards */
  | { kind: "inspect"; source: "hand" | "deck" | "reward"; index: number }
  | { kind: "log" }
  | { kind: "confirmQuit" };

export type Targeting =
  | { kind: "card"; handIdx: number }
  | { kind: "potion"; slot: number };

export const LOG_LIMIT = 200;

export interface UiState {
  screen: "menu" | "run";
  // menu selections (persisted in prefs.json by the app)
  seed: string;
  character: UICharacterId;
  ascension: number;
  /** seed text-entry buffer; null = not editing */
  seedEdit: { value: string } | null;
  /** menu "continue" line, refreshed by the app from the save file */
  menuSave: { desc: string } | null;
  // run-screen UI
  overlays: Overlay[];
  targeting: Targeting | null;
  /** read-only hover focus for the bottom info panel: which focusable the
   *  tooltip describes. Scoped by view mode so a stale index from another
   *  screen never leaks (buildView ignores mismatched scopes and clamps). */
  focus: { scope: string; idx: number } | null;
  choiceSel: number[];
  /** pagination for the active screen list (shop/event/rewards...) */
  page: number;
  /** pagination for a pending-choice picker */
  choicePage: number;
  /** map viewport offset in node rows, relative to the auto-follow anchor */
  mapScroll: number;
  /** rolling formatted engine-event log (ring of LOG_LIMIT) */
  log: string[];
  toast: string | null;
  /** treasure-room open result (display only) */
  lastLoot: string | null;
}

export function initialUiState(opts: {
  seed?: string;
  character?: UICharacterId;
  ascension?: number;
} = {}): UiState {
  return {
    screen: "menu",
    seed: opts.seed ?? "SPIRE",
    character: opts.character ?? "IRONCLAD",
    ascension: clampAscension(opts.ascension ?? 0),
    seedEdit: null,
    menuSave: null,
    overlays: [],
    targeting: null,
    focus: null,
    choiceSel: [],
    page: 0,
    choicePage: 0,
    mapScroll: 0,
    log: [],
    toast: null,
    lastLoot: null,
  };
}

/** Clear the transient run-screen UI (on new run / continue / back to menu). */
export function resetRunUi(ui: UiState): UiState {
  return {
    ...ui,
    overlays: [],
    targeting: null,
    focus: null,
    choiceSel: [],
    page: 0,
    choicePage: 0,
    mapScroll: 0,
    toast: null,
    lastLoot: null,
    seedEdit: null,
  };
}

export function pushLog(ui: UiState, lines: string[]): UiState {
  if (lines.length === 0) return ui;
  const log = [...ui.log, ...lines];
  if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
  return { ...ui, log };
}

/** Pure reducer over the UI-only actions (engine commands and app-effectful
 *  actions are handled by app.ts). */
export function applyUiAction(ui: UiState, act: PureUiAction): UiState {
  switch (act.type) {
    case "openOverlay":
      return { ...ui, overlays: [...ui.overlays, act.overlay], targeting: null, focus: null };
    case "closeOverlay":
      return { ...ui, overlays: ui.overlays.slice(0, -1), focus: null };
    case "closeAllOverlays":
      return { ...ui, overlays: [], focus: null };
    case "page": {
      // pages the top overlay's list when one is open, else the screen list
      const top = ui.overlays[ui.overlays.length - 1];
      if (top && "page" in top) {
        const overlays = [...ui.overlays];
        overlays[overlays.length - 1] = { ...top, page: Math.max(0, top.page + act.delta) };
        return { ...ui, overlays };
      }
      return { ...ui, page: Math.max(0, ui.page + act.delta) };
    }
    case "choicePage":
      return { ...ui, choicePage: Math.max(0, ui.choicePage + act.delta) };
    case "mapScroll":
      return { ...ui, mapScroll: ui.mapScroll + act.delta };
    case "toggleChoice": {
      const at = ui.choiceSel.indexOf(act.i);
      if (at >= 0) return { ...ui, choiceSel: ui.choiceSel.filter((v) => v !== act.i) };
      if (ui.choiceSel.length >= act.max) {
        if (act.max === 1) return { ...ui, choiceSel: [act.i] };
        return { ...ui, toast: `Select at most ${act.max}` };
      }
      return { ...ui, choiceSel: [...ui.choiceSel, act.i] };
    }
    case "setTargeting":
      // entering targeting auto-focuses the first candidate target
      return {
        ...ui,
        targeting: act.targeting,
        overlays: act.targeting ? [] : ui.overlays,
        focus: act.targeting ? { scope: "targeting", idx: 0 } : null,
      };
    case "focusSet": {
      const next = { ...ui, focus: { scope: act.scope, idx: Math.max(0, act.idx) } };
      // on the menu, the cursor IS the character selection: pointing at a
      // hero row selects that hero (one unified highlight)
      if (act.scope === "menu" && act.idx < CHARACTER_IDS.length) {
        next.character = CHARACTER_IDS[act.idx]!;
      }
      return next;
    }
    case "focusClear":
      return { ...ui, focus: null };
    case "inspectMove": {
      const top = ui.overlays[ui.overlays.length - 1];
      if (!top || top.kind !== "inspect") return ui;
      const overlays = [...ui.overlays];
      const next = Math.max(0, Math.min(Math.max(0, act.count - 1), top.index + act.delta));
      overlays[overlays.length - 1] = { ...top, index: next };
      return { ...ui, overlays };
    }
    case "menuChar":
      return isCharacterId(act.id) ? { ...ui, character: act.id } : ui;
    case "menuAsc":
      return { ...ui, ascension: Math.max(0, Math.min(MAX_ASCENSION, ui.ascension + act.delta)) };
    case "seedEditStart":
      return { ...ui, seedEdit: { value: ui.seed } };
    case "seedEditChar": {
      if (!ui.seedEdit) return ui;
      if (ui.seedEdit.value.length >= 24) return ui;
      const ch = act.ch.toUpperCase();
      if (!/^[A-Z0-9 _-]$/.test(ch)) return ui;
      return { ...ui, seedEdit: { value: ui.seedEdit.value + ch } };
    }
    case "seedEditBackspace":
      return ui.seedEdit ? { ...ui, seedEdit: { value: ui.seedEdit.value.slice(0, -1) } } : ui;
    case "seedEditCommit": {
      if (!ui.seedEdit) return ui;
      const v = ui.seedEdit.value.trim();
      return { ...ui, seed: v.length > 0 ? v : ui.seed, seedEdit: null };
    }
    case "seedEditCancel":
      return { ...ui, seedEdit: null };
    case "toast":
      return { ...ui, toast: act.text };
  }
}
