// io/saves.ts: SLAY_DIR-scoped round trips, atomic writes with .bak fallback,
// corrupt-save recovery, deletion, and prefs.

import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRun, advance } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content";
import { makeSaveIo, defaultSaveDir } from "../../src/cli/io/saves";

const bundle = buildBaseContentBundle();

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "slay-test-"));
}

describe("saves", () => {
  test("SLAY_DIR overrides the default directory", () => {
    const prev = process.env.SLAY_DIR;
    process.env.SLAY_DIR = "/tmp/slay-env-test";
    try {
      expect(defaultSaveDir()).toBe("/tmp/slay-env-test");
    } finally {
      if (prev === undefined) delete process.env.SLAY_DIR;
      else process.env.SLAY_DIR = prev;
    }
    expect(defaultSaveDir()).not.toBe("/tmp/slay-env-test");
  });

  test("round trip: write then read returns an equivalent state", () => {
    const dir = tempDir();
    const io = makeSaveIo(dir);
    const s = createRun({ seed: "SAVEIO", bundle, character: "SILENT", ascension: 3 });
    io.writeSave(s);
    const back = io.readSave();
    expect(back).not.toBeNull();
    expect(JSON.stringify(back)).toBe(JSON.stringify(s));
    rmSync(dir, { recursive: true, force: true });
  });

  test("writes are atomic: no .tmp file survives, second write keeps a .bak", () => {
    const dir = tempDir();
    const io = makeSaveIo(dir);
    const s1 = createRun({ seed: "ATOMIC", bundle, character: "IRONCLAD" });
    io.writeSave(s1);
    expect(existsSync(join(dir, "save.json"))).toBe(true);
    expect(existsSync(join(dir, "save.json.tmp"))).toBe(false);
    expect(existsSync(join(dir, "save.json.bak"))).toBe(false);
    const s2 = advance(s1, { cmd: "neowPick", i: 1 }, bundle);
    io.writeSave(s2);
    expect(existsSync(join(dir, "save.json.bak"))).toBe(true);
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
    // main has the new state, bak the previous one
    expect(JSON.parse(readFileSync(join(dir, "save.json"), "utf8")).run.room.kind).toBe("map");
    expect(JSON.parse(readFileSync(join(dir, "save.json.bak"), "utf8")).run.room.kind).toBe("neow");
    rmSync(dir, { recursive: true, force: true });
  });

  test("corrupt main save falls back to .bak, then to null", () => {
    const dir = tempDir();
    const io = makeSaveIo(dir);
    const s1 = createRun({ seed: "CORRUPT", bundle, character: "IRONCLAD" });
    io.writeSave(s1);
    const s2 = advance(s1, { cmd: "neowPick", i: 1 }, bundle);
    io.writeSave(s2); // bak = s1
    writeFileSync(join(dir, "save.json"), "{ not json !!!");
    const back = io.readSave();
    expect(back).not.toBeNull();
    expect(back!.run.room?.kind).toBe("neow"); // recovered from .bak
    writeFileSync(join(dir, "save.json.bak"), JSON.stringify({ version: 99 }));
    expect(io.readSave()).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("structurally invalid saves are rejected", () => {
    const dir = tempDir();
    const io = makeSaveIo(dir);
    writeFileSync(join(dir, "save.json"), JSON.stringify({ version: 1, seed: "X" })); // no rng/run
    expect(io.readSave()).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("deleteSave removes both the save and its backup", () => {
    const dir = tempDir();
    const io = makeSaveIo(dir);
    const s1 = createRun({ seed: "DELETE", bundle, character: "IRONCLAD" });
    io.writeSave(s1);
    io.writeSave(advance(s1, { cmd: "neowPick", i: 1 }, bundle));
    io.deleteSave();
    expect(existsSync(join(dir, "save.json"))).toBe(false);
    expect(existsSync(join(dir, "save.json.bak"))).toBe(false);
    expect(io.readSave()).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  test("prefs round trip with clamping and validation", () => {
    const dir = tempDir();
    const io = makeSaveIo(dir);
    expect(io.readPrefs()).toEqual({});
    io.writePrefs({ seed: "MYSEED", character: "WATCHER", ascension: 12, color: false, vimKeys: true });
    expect(io.readPrefs()).toEqual({ seed: "MYSEED", character: "WATCHER", ascension: 12, color: false, vimKeys: true });
    writeFileSync(join(dir, "prefs.json"), JSON.stringify({ seed: "OK", character: "NOPE", ascension: 99 }));
    expect(io.readPrefs()).toEqual({ seed: "OK", ascension: 20 });
    // a non-boolean vimKeys is dropped like any other bad field
    writeFileSync(join(dir, "prefs.json"), JSON.stringify({ seed: "OK", vimKeys: "yes" }));
    expect(io.readPrefs()).toEqual({ seed: "OK" });
    writeFileSync(join(dir, "prefs.json"), "garbage");
    expect(io.readPrefs()).toEqual({});
    rmSync(dir, { recursive: true, force: true });
  });
});
