// PURE key dispatch: mapKey(key, view) -> KeyAction | null. The mode is
// computed per keypress by buildView (never stored): overlay-top > pending
// choice > targeting > text-input > room kind. Digits act on the numbered
// items the View exposes, so the keymap and the renderer can never disagree.

import type { Key } from "../term/keys";
import type { View, ListItemView } from "../state/view";
import { cmd, ui, type KeyAction } from "./actions";

/** '1'..'9' -> 0..8, '0' -> 9 (matching keyFor). */
export function digitIndex(ch: string): number | null {
  if (ch >= "1" && ch <= "9") return ch.charCodeAt(0) - 49;
  if (ch === "0") return 9;
  return null;
}

function itemAt(items: ListItemView[], d: number): ListItemView | null {
  return items[d] ?? null;
}

/** Selecting a list item: fires its action, or toasts why it's blocked. */
function selectItem(item: ListItemView | null): KeyAction | null {
  if (!item) return null;
  if (!item.enabled) {
    return item.note !== null ? ui({ type: "toast", text: item.note }) : null;
  }
  return item.action;
}

function pageKeys(ch: string, pages: number, forChoice: boolean): KeyAction | null {
  if (pages <= 1) return null;
  if (ch === "n") return ui(forChoice ? { type: "choicePage", delta: 1 } : { type: "page", delta: 1 });
  if (ch === "p") return ui(forChoice ? { type: "choicePage", delta: -1 } : { type: "page", delta: -1 });
  return null;
}

/** Keys available on every non-overlay run screen. */
function globalRunKeys(ch: string): KeyAction | null {
  switch (ch) {
    case "q":
      return ui({ type: "openOverlay", overlay: { kind: "confirmQuit" } });
    case "d":
      return ui({ type: "openOverlay", overlay: { kind: "deck", mode: "view", page: 0 } });
    case "r":
      return ui({ type: "openOverlay", overlay: { kind: "relics", page: 0 } });
    case "p":
      return ui({ type: "openOverlay", overlay: { kind: "potions" } });
    default:
      return null;
  }
}

export function mapKey(key: Key, view: View): KeyAction | null {
  if (key.kind === "ctrlC") return ui({ type: "quit" });

  switch (view.mode) {
    case "textInput": {
      if (key.kind === "char") return ui({ type: "seedEditChar", ch: key.ch });
      if (key.kind === "backspace") return ui({ type: "seedEditBackspace" });
      if (key.kind === "enter") return ui({ type: "seedEditCommit" });
      if (key.kind === "esc") return ui({ type: "seedEditCancel" });
      return null;
    }

    case "menu": {
      if (key.kind === "enter") return ui({ type: "newRun" });
      if (key.kind !== "char") return null;
      const ch = key.ch;
      const d = digitIndex(ch);
      if (d !== null && d < 4) {
        const m = view.screen;
        if (m.kind === "menu") return ui({ type: "menuChar", id: m.characters[d]!.id });
      }
      if (ch === "a") return ui({ type: "menuAsc", delta: 1 });
      if (ch === "A") return ui({ type: "menuAsc", delta: -1 });
      if (ch === "+" || ch === "=") return ui({ type: "menuAsc", delta: 1 });
      if (ch === "-") return ui({ type: "menuAsc", delta: -1 });
      if (ch === "s") return ui({ type: "seedEditStart" });
      if (ch === "n") return ui({ type: "newRun" });
      if (ch === "c") {
        const m = view.screen;
        if (m.kind === "menu" && m.continueDesc !== null) return ui({ type: "continueRun" });
        return null;
      }
      if (ch === "q") return ui({ type: "quit" });
      return null;
    }

    case "overlay": {
      const o = view.overlay;
      if (!o) return null;
      if (o.kind === "confirmQuit") {
        if (key.kind === "enter") return ui({ type: "quit" });
        if (key.kind === "esc") return ui({ type: "closeOverlay" });
        if (key.kind === "char" && (key.ch === "y" || key.ch === "q")) return ui({ type: "quit" });
        if (key.kind === "char" && key.ch === "n") return ui({ type: "closeOverlay" });
        return null;
      }
      if (o.kind === "potionMenu") {
        if (key.kind === "esc") return ui({ type: "closeOverlay" });
        if (key.kind !== "char") return null;
        if (key.ch === "d") return cmd({ cmd: "discardPotion", slot: o.slot });
        if (key.ch === "u") {
          if (!o.targeted) return cmd({ cmd: "usePotion", slot: o.slot });
          // targeted potions need a combat target
          if (view.screen.kind === "combat") {
            return ui({ type: "setTargeting", targeting: { kind: "potion", slot: o.slot } });
          }
          return ui({ type: "toast", text: "That potion needs a target - use it in combat" });
        }
        return null;
      }
      if (o.kind === "inspect") {
        if (key.kind === "esc") return ui({ type: "closeOverlay" });
        if (key.kind === "char" && key.ch === "i") return ui({ type: "closeOverlay" });
        if ((key.kind === "char" && key.ch === "j") || key.kind === "down" || key.kind === "right") {
          return ui({ type: "inspectMove", delta: 1, count: o.count });
        }
        if ((key.kind === "char" && key.ch === "k") || key.kind === "up" || key.kind === "left") {
          return ui({ type: "inspectMove", delta: -1, count: o.count });
        }
        return null;
      }
      // paged lists: deck / relics / pile / potions
      if (key.kind === "esc") return ui({ type: "closeOverlay" });
      if (key.kind !== "char") return null;
      const paging = pageKeys(key.ch, o.list.pages, false);
      if (paging) return paging;
      const d = digitIndex(key.ch);
      if (d !== null) return selectItem(itemAt(o.list.items, d));
      return null;
    }

    case "choice": {
      const o = view.overlay;
      if (o?.kind !== "choice") return null;
      if (key.kind === "esc") {
        // Esc only cancels when the engine allows it (canCancel)
        return o.canCancel ? cmd({ cmd: "choose", indices: [] }) : null;
      }
      if (key.kind === "enter") {
        if (o.single) return null; // singles commit via digits
        if (o.selected.length < o.min) return ui({ type: "toast", text: `Select at least ${o.min}` });
        if (o.selected.length > o.max) return ui({ type: "toast", text: `Select at most ${o.max}` });
        return cmd({ cmd: "choose", indices: [...o.selected] });
      }
      if (key.kind !== "char") return null;
      if (key.ch === "q") return ui({ type: "openOverlay", overlay: { kind: "confirmQuit" } });
      const paging = pageKeys(key.ch, o.list.pages, true);
      if (paging) return paging;
      const d = digitIndex(key.ch);
      if (d !== null) {
        const item = itemAt(o.list.items, d);
        if (!item) return null;
        if (o.single) return cmd({ cmd: "choose", indices: [item.i] });
        return ui({ type: "toggleChoice", i: item.i, max: o.max });
      }
      return null;
    }

    case "targeting": {
      if (key.kind === "esc") return ui({ type: "setTargeting", targeting: null });
      if (key.kind !== "char") return null;
      if (key.ch === "q") return ui({ type: "openOverlay", overlay: { kind: "confirmQuit" } });
      const d = digitIndex(key.ch);
      if (d !== null) {
        const t = view.targeting?.targets[d];
        return t ? t.action : null;
      }
      return null;
    }

    case "combat": {
      const s = view.screen;
      if (s.kind !== "combat") return null;
      if (key.kind === "esc") return ui({ type: "backToMenu" }); // run is saved per-advance
      if (key.kind !== "char") return null;
      const ch = key.ch;
      const d = digitIndex(ch);
      if (d !== null) {
        const h = s.hand[d];
        if (!h) return null;
        if (!h.playable) {
          return ui({ type: "toast", text: h.cost === "-" ? `${h.name} is unplayable` : `Not enough energy for ${h.name}` });
        }
        if (h.targeted) {
          // exactly one alive enemy: auto-target; otherwise enter targeting
          const alive = s.enemies.filter((e) => e.gone === null);
          if (alive.length === 1) {
            const idx = s.enemies.findIndex((e) => e.gone === null);
            return cmd({ cmd: "playCard", handIdx: d, target: idx });
          }
          return ui({ type: "setTargeting", targeting: { kind: "card", handIdx: d } });
        }
        return cmd({ cmd: "playCard", handIdx: d });
      }
      if (ch === "e") return cmd({ cmd: "endTurn" });
      if (ch === "i") return ui({ type: "openOverlay", overlay: { kind: "inspect", source: "hand", index: 0 } });
      if (ch === "w") return ui({ type: "openOverlay", overlay: { kind: "pile", pile: "draw", page: 0 } });
      if (ch === "x") return ui({ type: "openOverlay", overlay: { kind: "pile", pile: "discard", page: 0 } });
      if (ch === "z") return ui({ type: "openOverlay", overlay: { kind: "pile", pile: "exhaust", page: 0 } });
      return globalRunKeys(ch);
    }

    case "map": {
      if (key.kind === "esc") return ui({ type: "backToMenu" });
      const s = view.screen;
      if (s.kind !== "map") return null;
      if (key.kind === "down") return ui({ type: "mapScroll", delta: 1 });
      if (key.kind === "up") return ui({ type: "mapScroll", delta: -1 });
      if (key.kind !== "char") return null;
      const ch = key.ch;
      if (ch === "j") return ui({ type: "mapScroll", delta: 1 });
      if (ch === "k") return ui({ type: "mapScroll", delta: -1 });
      const d = digitIndex(ch);
      if (d !== null) {
        const pick = s.picks[d];
        return pick ? cmd({ cmd: "mapPick", x: pick.x, y: pick.y }) : null;
      }
      return globalRunKeys(ch);
    }

    case "neow":
    case "rewards":
    case "shop":
    case "rest":
    case "treasure":
    case "event":
    case "gameOver": {
      if (key.kind === "esc") return ui({ type: "backToMenu" });
      const s = view.screen;
      if (s.kind === "menu" || s.kind === "map" || s.kind === "combat") return null;
      if (key.kind === "enter") {
        if (view.mode === "rewards") return cmd({ cmd: "skipRewards" });
        if (view.mode === "shop") return cmd({ cmd: "proceed" });
        return null;
      }
      if (key.kind !== "char") return null;
      const ch = key.ch;
      const paging = pageKeys(ch, s.list.pages, false);
      if (paging) return paging;
      const d = digitIndex(ch);
      if (d !== null) return selectItem(itemAt(s.list.items, d));
      if (view.mode === "rewards" && ch === "c") return cmd({ cmd: "skipRewards" });
      if (view.mode === "shop" && ch === "c") return cmd({ cmd: "proceed" });
      if (view.mode === "gameOver") {
        if (ch === "n") return ui({ type: "rerun" });
        if (ch === "m") return ui({ type: "backToMenu" });
      }
      return globalRunKeys(ch);
    }
  }
}
