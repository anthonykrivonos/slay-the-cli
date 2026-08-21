// The app loop: owns the GameState + UiState pair, turns key bytes into
// actions (keymap), engine Commands into advance() + save-per-advance, and
// repaints a full frame per keypress (synchronized output, no diffing).

import { createRun, advance, type GameState, type Command, type GameEvent } from "../engine/game";
import { buildBaseContentBundle } from "../content";
import type { ContentBundle } from "../engine/content/defs";
import type { TerminalPort } from "./term/terminal";
import { parseKeys } from "./term/keys";
import { SYNC_START, SYNC_END, CURSOR_HOME, CLEAR_TO_EOL } from "./term/ansi";
import { renderFrame } from "./render/frame";
import { THEME_256, THEME_PLAIN, type Theme } from "./render/theme";
import { buildView } from "./state/view";
import { initialUiState, resetRunUi, pushLog, applyUiAction, type UiState } from "./state/uiState";
import { mapKey } from "./input/keymap";
import { isAppAction, type AppUiAction } from "./input/actions";
import {
  bumpSeed,
  chestLootSummary,
  clampAscension,
  isCharacterId,
  type UICharacterId,
} from "./text/runlogic";
import { formatEvent } from "./text/logfmt";
import type { SaveIo } from "./io/saves";

export interface AppOptions {
  seed?: string;
  character?: UICharacterId;
  ascension?: number;
  noColor?: boolean;
}

export interface AppDeps {
  term: TerminalPort;
  saves: SaveIo;
  options?: AppOptions;
  bundle?: ContentBundle;
  /** startup update check result (main.ts does the io; see io/update.ts) */
  update?: { behind: number } | null;
}

export interface AppResult {
  game: GameState | null;
  ui: UiState;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function runApp(deps: AppDeps): Promise<AppResult> {
  const { term, saves } = deps;
  const options = deps.options ?? {};
  const bundle = deps.bundle ?? buildBaseContentBundle();
  const prefs = saves.readPrefs();
  const theme: Theme = options.noColor === true || prefs.color === false ? THEME_PLAIN : THEME_256;
  let game: GameState | null = null;
  let ui: UiState = initialUiState({
    seed: options.seed ?? prefs.seed,
    character: options.character ?? prefs.character,
    ascension: options.ascension ?? prefs.ascension,
    update: deps.update ?? null,
  });

  const refreshMenuSave = (): void => {
    const saved = saves.readSave();
    if (!saved) {
      ui = { ...ui, menuSave: null };
      return;
    }
    const name = bundle.characters.get(saved.run.character)?.name ?? saved.run.character;
    const desc =
      saved.run.room?.kind === "gameOver"
        ? "run over"
        : `${name} A${saved.run.ascension} - Floor ${saved.run.floor} - Act ${saved.run.act}`;
    ui = { ...ui, menuSave: { desc } };
  };
  refreshMenuSave();

  const absorbEvents = (events: GameEvent[]): void => {
    ui = pushLog(ui, events.map((ev) => formatEvent(ev, bundle)));
  };

  const paint = (): void => {
    const cols = term.cols() || 80;
    const rows = term.rows() || 24;
    const view = buildView(game, ui, bundle);
    const lines = renderFrame(view, { cols, rows }, theme);
    const frame = SYNC_START + CURSOR_HOME + lines.map((l) => l + CLEAR_TO_EOL).join("\r\n") + SYNC_END;
    term.write(frame);
  };

  const doAdvance = (cmd: Command): void => {
    if (!game) return;
    const prev = game;
    ui = { ...ui, targeting: null };
    try {
      const next = advance(game, cmd, bundle);
      game = next;
      // overlays are the means of picking a command - a successful advance
      // closes them (the web UI closed its menus before advancing too)
      ui = { ...ui, choiceSel: [], choicePage: 0, overlays: [] };
      absorbEvents(next.eventLog);
      if (cmd.cmd === "openChest" || cmd.cmd === "takeSapphireKey") {
        ui = { ...ui, lastLoot: chestLootSummary(prev, next, bundle) };
      } else if (cmd.cmd === "proceed" || cmd.cmd === "mapPick") {
        ui = { ...ui, lastLoot: null };
      }
      if (prev.run.room?.kind !== next.run.room?.kind) {
        ui = { ...ui, page: 0, mapScroll: 0, focus: null };
      }
      if (next.run.room?.kind === "gameOver") {
        saves.deleteSave();
      } else {
        saves.writeSave(next);
      }
    } catch (e) {
      const msg = errMsg(e);
      ui = { ...ui, toast: /invariant/i.test(msg) ? "That can't be used right now" : msg };
    }
  };

  const newRun = (): void => {
    saves.writePrefs({ seed: ui.seed, character: ui.character, ascension: ui.ascension, color: theme !== THEME_PLAIN });
    let created: GameState;
    try {
      created = createRun({ seed: ui.seed, bundle, character: ui.character, ascension: ui.ascension });
    } catch (e) {
      ui = { ...ui, toast: errMsg(e) };
      return;
    }
    game = created;
    ui = resetRunUi({ ...ui, screen: "run", log: [] });
    absorbEvents(created.eventLog);
    saves.writeSave(created);
  };

  const continueRun = (): void => {
    const restored = saves.readSave();
    if (!restored) {
      ui = { ...ui, toast: "No valid saved run found" };
      return;
    }
    const prevGame = game;
    const prevUi = ui;
    game = restored;
    ui = resetRunUi({
      ...ui,
      screen: "run",
      seed: restored.seed,
      character: isCharacterId(restored.run.character) ? restored.run.character : ui.character,
      ascension: clampAscension(restored.run.ascension),
    });
    ui = pushLog(ui, ["(restored saved run)"]);
    try {
      // stale/incompatible saves from an older engine build blow up on first
      // render - probe once, discard and recover to the menu if so
      renderFrame(buildView(game, ui, bundle), { cols: 100, rows: 30 }, THEME_PLAIN);
    } catch {
      saves.deleteSave();
      game = prevGame;
      ui = { ...prevUi, screen: "menu", menuSave: null, toast: "Saved run was from an older version - it was discarded" };
    }
  };

  const backToMenu = (): void => {
    ui = resetRunUi({ ...ui, screen: "menu" });
    refreshMenuSave();
  };

  const rerun = (): void => {
    if (!game) return;
    ui = {
      ...ui,
      seed: bumpSeed(game.seed),
      character: isCharacterId(game.run.character) ? game.run.character : ui.character,
      ascension: clampAscension(game.run.ascension),
    };
    newRun();
  };

  return new Promise<AppResult>((resolve) => {
    let done = false;
    const quit = (): void => {
      if (done) return;
      done = true;
      term.restore();
      resolve({ game, ui });
    };

    const handleAppAction = (act: AppUiAction): void => {
      switch (act.type) {
        case "newRun":
          newRun();
          break;
        case "continueRun":
          continueRun();
          break;
        case "backToMenu":
          backToMenu();
          break;
        case "rerun":
          rerun();
          break;
        case "quit":
          quit();
          break;
      }
    };

    term.setup();
    paint();

    term.onResize(() => {
      if (!done) paint();
    });

    // NOTE: a scripted fakeTerminal delivers its keys synchronously inside
    // this registration, so everything the handler needs exists already.
    term.onData((chunk) => {
      if (done) return;
      for (const key of parseKeys(chunk)) {
        if (done) break;
        ui = { ...ui, toast: null }; // toasts live until the next keypress
        if (key.kind === "ctrlC") {
          quit(); // save is per-advance, so Ctrl+C is always a safe exit
          break;
        }
        const view = buildView(game, ui, bundle);
        const action = mapKey(key, view);
        if (!action) continue;
        if (action.kind === "cmd") {
          doAdvance(action.cmd);
        } else if (isAppAction(action.act)) {
          handleAppAction(action.act);
        } else {
          ui = applyUiAction(ui, action.act);
        }
      }
      if (!done) paint();
    });
  });
}
