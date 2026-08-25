// UI-only state (never serialized into the run save) + the pure reducer over
// UiAction. The app owns one UiState next to the GameState; buildView folds
// both into the render-ready View.

import type { UICharacterId } from "../text/runlogic";
import { clampAscension, MAX_ASCENSION, isCharacterId, CHARACTER_IDS } from "../text/runlogic";
import type { PureUiAction } from "../input/actions";
import type { GameEvent } from "../../engine/game";
import type { ContentBundle } from "../../engine/content/defs";
import { formatEvent } from "../text/logfmt";

export type PileName = "draw" | "discard" | "exhaust";
export type DeckOverlayMode = "view" | "smith" | "remove";

/** A collection of inspectable things (cards, relics, potions), named rather
 *  than captured: buildView resolves it against the live game state every
 *  frame, so an inspect overlay can never hold a stale item. */
export type InspectSource =
  | { of: "hand" }
  | { of: "deck" }
  | { of: "pile"; pile: PileName }
  | { of: "relics" }
  | { of: "potions" }
  | { of: "reward" }
  | { of: "shop" }
  | { of: "choice" };

export type Overlay =
  | { kind: "deck"; mode: DeckOverlayMode; page: number }
  | { kind: "relics"; page: number }
  | { kind: "pile"; pile: PileName; page: number }
  | { kind: "potions" }
  | { kind: "potionMenu"; slot: number }
  /** index is a position within the source, in the order the source lists it */
  | { kind: "inspect"; source: InspectSource; index: number }
  | { kind: "log" }
  | { kind: "settings" }
  | { kind: "confirmQuit" };

export type Targeting =
  | { kind: "card"; handIdx: number }
  | { kind: "potion"; slot: number };

export const LOG_LIMIT = 200;

/** One log line, stamped with the combat it belongs to: era 0 is everything
 *  before the first fight, and every combatStarted bumps it. The UI reads it to
 *  keep the fight you are in separate from the ones behind you. */
export interface LogLine {
  text: string;
  era: number;
}

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
  /** how far behind origin/main the checkout is, from the startup update check
   *  (io/update.ts). null when repo-less, offline, or opted out. */
  update: { behind: number } | null;
  /** hjkl move the cursor instead of typing (persisted in prefs.json). Off by
   *  default; the settings overlay flips it. */
  vimKeys: boolean;
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
  log: LogLine[];
  /** current combat counter; log lines are stamped with it */
  logEra: number;
  toast: string | null;
  /** treasure-room open result (display only) */
  lastLoot: string | null;
}

export function initialUiState(opts: {
  seed?: string;
  character?: UICharacterId;
  ascension?: number;
  update?: { behind: number } | null;
  vimKeys?: boolean;
} = {}): UiState {
  return {
    screen: "menu",
    seed: opts.seed ?? "SPIRE",
    character: opts.character ?? "IRONCLAD",
    ascension: clampAscension(opts.ascension ?? 0),
    seedEdit: null,
    menuSave: null,
    update: opts.update ?? null,
    vimKeys: opts.vimKeys ?? false,
    overlays: [],
    targeting: null,
    focus: null,
    choiceSel: [],
    page: 0,
    choicePage: 0,
    mapScroll: 0,
    log: [],
    logEra: 0,
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

/** Append already-formatted lines to the current era (synthetic UI notes). */
export function pushLogLines(ui: UiState, lines: string[]): UiState {
  if (lines.length === 0) return ui;
  const log = [...ui.log, ...lines.map((text) => ({ text, era: ui.logEra }))];
  if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
  return { ...ui, log };
}

/** Format and append an engine event batch. The era bump lives here so every
 *  caller (app, fixtures, tests) splits combats the same way. */
export function pushLog(ui: UiState, events: GameEvent[], bundle: ContentBundle): UiState {
  let next = ui;
  for (const ev of events) {
    if (ev.event === "combatStarted") next = { ...next, logEra: next.logEra + 1 };
    next = pushLogLines(next, [formatEvent(ev, bundle)]);
  }
  return next;
}

/** Index of the first line of the current era (where the log overlay stops
 *  dimming). log.length when the current era has no lines yet. */
export function currentEraStart(ui: UiState): number {
  let i = ui.log.length;
  while (i > 0 && ui.log[i - 1]!.era === ui.logEra) i--;
  return i;
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
    case "toggleVimKeys":
      return { ...ui, vimKeys: !ui.vimKeys };
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
