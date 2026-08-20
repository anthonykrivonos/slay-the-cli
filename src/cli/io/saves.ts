// File-backed persistence: ~/.slay/save.json (+ save.json.bak) and
// ~/.slay/prefs.json. SLAY_DIR overrides the directory (tests use a tmp dir).
// Writes are atomic (tmp + rename); reads fall back main -> .bak -> null via
// the salvaged structural validator.

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GameState } from "../../engine/game";
import { validateSavedRun, clampAscension, isCharacterId, type UICharacterId } from "../text/runlogic";

export interface Prefs {
  seed?: string;
  character?: UICharacterId;
  ascension?: number;
  color?: boolean;
}

export interface SaveIo {
  dir: string;
  readSave(): GameState | null;
  writeSave(g: GameState): void;
  deleteSave(): void;
  readPrefs(): Prefs;
  writePrefs(p: Prefs): void;
}

export function defaultSaveDir(): string {
  const env = process.env.SLAY_DIR;
  if (env !== undefined && env.trim().length > 0) return env;
  return join(homedir(), ".slay");
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function writeAtomic(path: string, data: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

export function makeSaveIo(dir: string = defaultSaveDir()): SaveIo {
  const savePath = join(dir, "save.json");
  const bakPath = join(dir, "save.json.bak");
  const prefsPath = join(dir, "prefs.json");
  const ensureDir = (): void => {
    mkdirSync(dir, { recursive: true });
  };
  return {
    dir,
    readSave(): GameState | null {
      const main = validateSavedRun(readJson(savePath));
      if (main) return main;
      return validateSavedRun(readJson(bakPath));
    },
    writeSave(g: GameState): void {
      try {
        ensureDir();
        if (existsSync(savePath)) copyFileSync(savePath, bakPath);
        writeAtomic(savePath, JSON.stringify(g));
      } catch {
        // storage unavailable — the game still plays, just unsaved
      }
    },
    deleteSave(): void {
      try {
        rmSync(savePath, { force: true });
        rmSync(bakPath, { force: true });
      } catch {
        /* ignore */
      }
    },
    readPrefs(): Prefs {
      const raw = readJson(prefsPath);
      if (typeof raw !== "object" || raw === null) return {};
      const p = raw as Record<string, unknown>;
      const out: Prefs = {};
      if (typeof p.seed === "string" && p.seed.trim().length > 0) out.seed = p.seed;
      if (isCharacterId(p.character)) out.character = p.character;
      if (p.ascension !== undefined) out.ascension = clampAscension(p.ascension);
      if (typeof p.color === "boolean") out.color = p.color;
      return out;
    },
    writePrefs(p: Prefs): void {
      try {
        ensureDir();
        writeAtomic(prefsPath, JSON.stringify(p));
      } catch {
        /* ignore */
      }
    },
  };
}
