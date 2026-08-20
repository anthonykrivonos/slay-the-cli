// Headless autoplay smoke: runApp over a fakeTerminal with scripted keys
// plays menu -> new run -> Neow -> map -> combat (plays a card) -> quit on a
// known seed. Asserts frames were produced, the save exists mid-run, and the
// terminal-restore sequence is emitted on quit.

import { test, expect, describe } from "bun:test";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runApp } from "../../src/cli/app";
import { fakeTerminal } from "../../src/cli/term/terminal";
import { makeSaveIo } from "../../src/cli/io/saves";
import { LEAVE_ALT_SCREEN, SHOW_CURSOR, stripAnsi } from "../../src/cli/term/ansi";

describe("headless autoplay", () => {
  test("menu -> new run -> neow -> map -> combat -> quit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "slay-autoplay-"));
    const saves = makeSaveIo(dir);
    const term = fakeTerminal({
      cols: 100,
      rows: 30,
      // n: new run · 2: Neow option 1 (bonus-only) · 1: first map pick (combat
      // on UISMOKE) · then three 1s: play card / enter targeting / target —
      // whatever the hand order, at least one card resolves · q,y: quit
      script: ["n", "2", "1", "1", "1", "1", "q", "y"],
    });

    const result = await runApp({ term, saves, options: { seed: "UISMOKE", character: "IRONCLAD", noColor: true } });

    // it quit cleanly and restored the terminal
    expect(term.setupCount).toBe(1);
    expect(term.restoreCount).toBe(1);
    const allOutput = term.output.join("");
    expect(allOutput).toContain(LEAVE_ALT_SCREEN);
    expect(allOutput).toContain(SHOW_CURSOR);

    // frames were produced (one per keypress + the initial paint)
    const frames = term.output.filter((o) => o.includes("\x1b[H"));
    expect(frames.length).toBeGreaterThanOrEqual(5);
    // the last painted frame was the combat screen with the quit confirmation
    const lastFrame = stripAnsi(frames[frames.length - 1]!);
    expect(lastFrame).toContain("COMBAT");
    expect(lastFrame).toContain("Quit?");

    // the run reached combat and a card was actually played
    expect(result.game).not.toBeNull();
    expect(result.game!.run.room?.kind).toBe("combat");
    expect(result.game!.combat!.combatFlags.cardsPlayedThisCombat).toBeGreaterThanOrEqual(1);

    // the save exists mid-run and validates
    expect(existsSync(join(dir, "save.json"))).toBe(true);
    const saved = saves.readSave();
    expect(saved).not.toBeNull();
    expect(saved!.run.room?.kind).toBe("combat");
    expect(saved!.seed).toBe(result.game!.seed);

    rmSync(dir, { recursive: true, force: true });
  });

  test("continue resumes the saved run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "slay-continue-"));
    const saves = makeSaveIo(dir);
    // first session: start a run and quit on the map
    const t1 = fakeTerminal({ cols: 100, rows: 30, script: ["n", "2", "q", "y"] });
    const r1 = await runApp({ term: t1, saves, options: { seed: "UISMOKE", noColor: true } });
    expect(r1.game!.run.room?.kind).toBe("map");
    // second session: continue from the menu
    const t2 = fakeTerminal({ cols: 100, rows: 30, script: ["c", "q", "y"] });
    const r2 = await runApp({ term: t2, saves, options: { noColor: true } });
    expect(r2.game).not.toBeNull();
    expect(r2.game!.run.room?.kind).toBe("map");
    expect(r2.game!.seed).toBe(r1.game!.seed);
    rmSync(dir, { recursive: true, force: true });
  });

  test("ctrl+c quits instantly and restores the terminal", async () => {
    const dir = mkdtempSync(join(tmpdir(), "slay-ctrlc-"));
    const saves = makeSaveIo(dir);
    const term = fakeTerminal({ cols: 100, rows: 30, script: ["n", "\x03"] });
    await runApp({ term, saves, options: { seed: "UISMOKE", noColor: true } });
    expect(term.restoreCount).toBe(1);
    expect(saves.readSave()).not.toBeNull(); // save-per-advance means no loss
    rmSync(dir, { recursive: true, force: true });
  });

  test("deterministic monkey: 400 pseudo-random keys never crash the loop", async () => {
    const dir = mkdtempSync(join(tmpdir(), "slay-monkey-"));
    const saves = makeSaveIo(dir);
    // mulberry32-style deterministic key stream over the full key vocabulary
    let a = 0xbadc0de;
    const rand = (): number => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pool = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "e", "i", "l", "w", "x", "z", "d", "r", "p", "j", "k", "n", "c", "u", "m", "\r", "\x1b", "\x1b[A", "\x1b[B", "\t", "\x1b[Z"];
    const script: string[] = ["n"];
    for (let i = 0; i < 400; i++) script.push(pool[Math.floor(rand() * pool.length)]!);
    script.push("\x03");
    const term = fakeTerminal({ cols: 100, rows: 30, script });
    await runApp({ term, saves, options: { seed: "MONKEY", noColor: true } });
    expect(term.restoreCount).toBe(1);
    // every painted frame stayed inside the geometry contract
    for (const frame of term.output) {
      if (!frame.includes("\x1b[H")) continue;
      const lines = stripAnsi(frame).split("\r\n");
      expect(lines.length).toBe(30);
    }
    rmSync(dir, { recursive: true, force: true });
  });

  test("resize repaints and the too-small notice recovers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "slay-resize-"));
    const saves = makeSaveIo(dir);
    const term = fakeTerminal({ cols: 100, rows: 30 });
    const done = runApp({ term, saves, options: { seed: "UISMOKE", noColor: true } });
    term.resize(60, 20);
    const small = stripAnsi(term.output[term.output.length - 1]!);
    expect(small).toContain("Terminal too small");
    term.resize(100, 30);
    const big = stripAnsi(term.output[term.output.length - 1]!);
    expect(big).toContain("NEW RUN");
    term.feed("q"); // menu 'q' quits directly
    await done;
    rmSync(dir, { recursive: true, force: true });
  });
});
