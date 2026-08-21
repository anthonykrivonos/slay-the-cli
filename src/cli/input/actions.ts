// Action vocabulary. mapKey (input/keymap.ts) turns a Key + View into a
// KeyAction: either an engine Command (dispatched through advance) or a
// UiAction. UiActions split into the pure subset (state/uiState.ts reducer)
// and app-effectful ones (new run, continue, quit... handled by app.ts).

import type { Command } from "../../engine/game";
import type { Overlay, Targeting } from "../state/uiState";

export type PureUiAction =
  | { type: "openOverlay"; overlay: Overlay }
  | { type: "closeOverlay" }
  | { type: "closeAllOverlays" }
  | { type: "page"; delta: 1 | -1 }
  | { type: "choicePage"; delta: 1 | -1 }
  | { type: "mapScroll"; delta: number }
  | { type: "toggleChoice"; i: number; max: number }
  | { type: "setTargeting"; targeting: Targeting | null }
  | { type: "inspectMove"; delta: 1 | -1; count: number }
  | { type: "focusSet"; scope: string; idx: number }
  | { type: "focusClear" }
  | { type: "menuChar"; id: string }
  | { type: "menuAsc"; delta: 1 | -1 }
  | { type: "seedEditStart" }
  | { type: "seedEditChar"; ch: string }
  | { type: "seedEditBackspace" }
  | { type: "seedEditCommit" }
  | { type: "seedEditCancel" }
  | { type: "toast"; text: string };

export type AppUiAction =
  | { type: "newRun" }
  | { type: "continueRun" }
  | { type: "backToMenu" }
  | { type: "rerun" } // game-over "new run": bumped seed, same character/ascension
  | { type: "quit" };

export type UiAction = PureUiAction | AppUiAction;

export type KeyAction = { kind: "cmd"; cmd: Command } | { kind: "ui"; act: UiAction };

export function isAppAction(act: UiAction): act is AppUiAction {
  return (
    act.type === "newRun" ||
    act.type === "continueRun" ||
    act.type === "backToMenu" ||
    act.type === "rerun" ||
    act.type === "quit"
  );
}

export const cmd = (c: Command): KeyAction => ({ kind: "cmd", cmd: c });
export const ui = (act: UiAction): KeyAction => ({ kind: "ui", act });
