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

/** Move the hover/selection focus by delta (wrapping). Null when the mode
 *  exposes nothing to focus. */
function focusStep(view: View, delta: 1 | -1): KeyAction | null {
  if (view.focusCount <= 0) return null;
  const cur = view.focusIdx;
  const next =
    cur === null
      ? delta === 1
        ? 0
        : view.focusCount - 1
      : (cur + delta + view.focusCount) % view.focusCount;
  return ui({ type: "focusSet", scope: view.mode, idx: next });
}

/** Tab cycles (Shift-Tab back); arrows step (Up/Left back, Down/Right fwd). */
function focusKeys(key: Key, view: View): KeyAction | null {
  if (key.kind === "tab") return focusStep(view, 1);
  if (key.kind === "shiftTab") return focusStep(view, -1);
  if (key.kind === "down" || key.kind === "right") return focusStep(view, 1);
  if (key.kind === "up" || key.kind === "left") return focusStep(view, -1);
  return null;
}

/** The list item the focus cursor points at (list screens + list overlays). */
function focusedItem(items: ListItemView[], view: View): ListItemView | null {
  if (view.focusIdx === null) return null;
  return items.find((it) => it.i === view.focusIdx) ?? null;
}

/** [i] opens whatever the view says is under the cursor. buildView resolves
 *  the target (state/view.ts inspectAt), so the keymap never indexes items
 *  itself - that is what used to let [i] and the cursor disagree. Null means
 *  there is nothing here to read, and the hint bar has already said so by
 *  leaving [i] out. */
function inspectKey(view: View): KeyAction | null {
  if (!view.inspect) return null;
  return ui({ type: "openOverlay", overlay: { kind: "inspect", ...view.inspect } });
}

/** Keys available on every non-overlay run screen. */
function globalRunKeys(ch: string, view: View): KeyAction | null {
  switch (ch) {
    case "i":
      return inspectKey(view);
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
      if (key.kind === "enter") {
        // Enter activates the focus cursor: the pointed-at hero is already
        // selected (cursor = selection on the menu), so hero rows and NEW
        // RUN both confirm into a run; CONTINUE resumes. Without a cursor
        // Enter keeps its historical meaning: start a run.
        const f = view.focusIdx;
        const m = view.screen;
        if (f !== null && m.kind === "menu") {
          if (f <= 4) return ui({ type: "newRun" });
          return m.continueDesc !== null ? ui({ type: "continueRun" }) : null;
        }
        return ui({ type: "newRun" });
      }
      const focus = focusKeys(key, view);
      if (focus) return focus;
      if (key.kind === "esc") return view.focusIdx !== null ? ui({ type: "focusClear" }) : null;
      if (key.kind !== "char") return null;
      const ch = key.ch;
      const d = digitIndex(ch);
      if (d !== null && d < 4) {
        // digits drive the same unified cursor+selection as the arrows
        return ui({ type: "focusSet", scope: "menu", idx: d });
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
        if (key.kind !== "char" && key.kind !== "enter") return null;
        if (key.kind === "char" && key.ch === "d") return cmd({ cmd: "discardPotion", slot: o.slot });
        // drinking it is the point of opening this, so Enter drinks it
        if (key.kind === "enter" || key.ch === "u") {
          if (!o.targeted) return cmd({ cmd: "usePotion", slot: o.slot });
          // targeted potions need a combat target
          if (view.screen.kind === "combat") {
            return ui({ type: "setTargeting", targeting: { kind: "potion", slot: o.slot } });
          }
          return ui({ type: "toast", text: "That potion needs a target - use it in combat" });
        }
        return null;
      }
      if (o.kind === "log") {
        if (key.kind === "esc") return ui({ type: "closeOverlay" });
        if (key.kind === "char" && key.ch === "l") return ui({ type: "closeOverlay" });
        return null;
      }
      if (o.kind === "inspect") {
        if (key.kind === "esc") return ui({ type: "closeOverlay" });
        if (key.kind === "char" && key.ch === "i") return ui({ type: "closeOverlay" });
        // Enter does whatever the thing's own row does: take the reward, buy
        // the shop item, open the potion menu
        if (key.kind === "enter" && o.source.of !== "hand" && o.enter !== null) return o.enter;
        // a card you are looking at in your hand is a card you can play
        if (key.kind === "enter" && o.source.of === "hand" && view.screen.kind === "combat") {
          const h = view.screen.hand[o.index];
          if (!h) return null;
          if (!h.playable) {
            return ui({ type: "toast", text: h.cost === "-" ? `${h.name} is unplayable` : `Not enough energy for ${h.name}` });
          }
          if (h.targeted) {
            const alive = view.screen.enemies.filter((e) => e.gone === null);
            if (alive.length === 1) {
              const idx = view.screen.enemies.findIndex((e) => e.gone === null);
              return cmd({ cmd: "playCard", handIdx: o.index, target: idx });
            }
            return ui({ type: "setTargeting", targeting: { kind: "card", handIdx: o.index } });
          }
          return cmd({ cmd: "playCard", handIdx: o.index });
        }
        if ((key.kind === "char" && key.ch === "j") || key.kind === "down" || key.kind === "right") {
          return ui({ type: "inspectMove", delta: 1, count: o.count });
        }
        if ((key.kind === "char" && key.ch === "k") || key.kind === "up" || key.kind === "left") {
          return ui({ type: "inspectMove", delta: -1, count: o.count });
        }
        return null;
      }
      // paged lists: deck / relics / pile / potions
      const focus = focusKeys(key, view);
      if (focus) return focus;
      if (key.kind === "enter") return selectItem(focusedItem(o.list.items, view));
      if (key.kind === "esc") return ui({ type: "closeOverlay" });
      if (key.kind !== "char") return null;
      if (key.ch === "i") return inspectKey(view);
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
        // Esc only cancels when the engine allows it (canCancel);
        // otherwise it clears the focus cursor
        if (o.canCancel) return cmd({ cmd: "choose", indices: [] });
        return view.focusIdx !== null ? ui({ type: "focusClear" }) : null;
      }
      if (key.kind === "enter") {
        if (o.single) {
          // singles commit via digits or the focus cursor
          const item = focusedItem(o.list.items, view);
          return item !== null ? cmd({ cmd: "choose", indices: [item.i] }) : null;
        }
        if (o.selected.length < o.min) return ui({ type: "toast", text: `Select at least ${o.min}` });
        if (o.selected.length > o.max) return ui({ type: "toast", text: `Select at most ${o.max}` });
        return cmd({ cmd: "choose", indices: [...o.selected] });
      }
      const focus = focusKeys(key, view);
      if (focus) return focus;
      if (key.kind !== "char") return null;
      if (key.ch === "i") return inspectKey(view);
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
      const focus = focusKeys(key, view);
      if (focus) return focus;
      if (key.kind === "enter") {
        // Enter fires at the auto-focused candidate target
        const t = view.targeting?.targets[view.targeting.focusIdx];
        return t ? t.action : null;
      }
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
      if (key.kind === "esc") {
        if (view.focusIdx !== null) return ui({ type: "focusClear" });
        return ui({ type: "backToMenu" }); // run is saved per-advance
      }
      // playing a card is the same act whether a digit or Enter asked for it
      const playCard = (handIdx: number): KeyAction | null => {
        const h = s.hand[handIdx];
        if (!h) return null;
        if (!h.playable) {
          return ui({ type: "toast", text: h.cost === "-" ? `${h.name} is unplayable` : `Not enough energy for ${h.name}` });
        }
        if (h.targeted) {
          // exactly one alive enemy: auto-target; otherwise enter targeting
          const alive = s.enemies.filter((e) => e.gone === null);
          if (alive.length === 1) {
            const idx = s.enemies.findIndex((e) => e.gone === null);
            return cmd({ cmd: "playCard", handIdx, target: idx });
          }
          return ui({ type: "setTargeting", targeting: { kind: "card", handIdx } });
        }
        return cmd({ cmd: "playCard", handIdx });
      };
      // Enter always does the obvious thing to whatever is highlighted
      if (key.kind === "enter") {
        if (s.focusHand !== null) return playCard(s.focusHand);
        if (s.focusPotionSlot !== null) {
          return ui({ type: "openOverlay", overlay: { kind: "potionMenu", slot: s.focusPotionSlot } });
        }
        if (s.focusEnemy !== null) return ui({ type: "toast", text: "Pick a card to aim at it" });
        return null;
      }
      const focus = focusKeys(key, view);
      if (focus) return focus;
      if (key.kind !== "char") return null;
      const ch = key.ch;
      const d = digitIndex(ch);
      if (d !== null) return playCard(d);
      if (ch === "e") return cmd({ cmd: "endTurn" });
      if (ch === "l") return ui({ type: "openOverlay", overlay: { kind: "log" } });
      if (ch === "w") return ui({ type: "openOverlay", overlay: { kind: "pile", pile: "draw", page: 0 } });
      if (ch === "x") return ui({ type: "openOverlay", overlay: { kind: "pile", pile: "discard", page: 0 } });
      if (ch === "z") return ui({ type: "openOverlay", overlay: { kind: "pile", pile: "exhaust", page: 0 } });
      return globalRunKeys(ch, view);
    }

    case "map": {
      const s = view.screen;
      if (s.kind !== "map") return null;
      if (key.kind === "esc") {
        if (view.focusIdx !== null) return ui({ type: "focusClear" });
        return ui({ type: "backToMenu" });
      }
      const travel = (pick: { x: number; y: number } | undefined): KeyAction | null =>
        pick ? cmd({ cmd: "mapPick", x: pick.x, y: pick.y }) : null;
      if (key.kind === "enter") {
        // the highlighted path, or the only path there is
        if (view.focusIdx !== null) return travel(s.picks[view.focusIdx]);
        return s.picks.length === 1 ? travel(s.picks[0]) : null;
      }
      // The paths sit side by side, so left/right choose between them and take
      // the cursor on first press; up/down are the scroll axis (so is j/k).
      if (key.kind === "left" || key.kind === "right") {
        const n = s.picks.length;
        if (n === 0) return null;
        const step = key.kind === "right" ? 1 : -1;
        const next = view.focusIdx === null ? (step === 1 ? 0 : n - 1) : (view.focusIdx + step + n) % n;
        return ui({ type: "focusSet", scope: "map", idx: next });
      }
      if (key.kind === "tab" || key.kind === "shiftTab") {
        const focus = focusKeys(key, view);
        if (focus) return focus;
      }
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
      return globalRunKeys(ch, view);
    }

    case "neow":
    case "rewards":
    case "shop":
    case "rest":
    case "treasure":
    case "event":
    case "gameOver": {
      const s = view.screen;
      if (s.kind === "menu" || s.kind === "map" || s.kind === "combat") return null;
      if (key.kind === "esc") {
        if (view.focusIdx !== null) return ui({ type: "focusClear" });
        return ui({ type: "backToMenu" });
      }
      if (key.kind === "enter") {
        // Enter activates the focus cursor; without one it keeps its
        // historical per-screen meaning
        const item = focusedItem(s.list.items, view);
        if (item !== null) return selectItem(item);
        if (view.mode === "rewards") return cmd({ cmd: "skipRewards" });
        if (view.mode === "shop") return cmd({ cmd: "proceed" });
        return null;
      }
      const focus = focusKeys(key, view);
      if (focus) return focus;
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
      return globalRunKeys(ch, view);
    }
  }
}
