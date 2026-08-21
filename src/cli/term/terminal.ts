// Terminal driver. realTerminal() owns the OS side: raw mode, the alternate
// screen buffer, cursor visibility, and resize notification (SIGWINCH + the
// stream's own "resize" event; size is re-read on every draw anyway).
// fakeTerminal() is the deterministic double for headless tests.

import {
  ENTER_ALT_SCREEN,
  LEAVE_ALT_SCREEN,
  HIDE_CURSOR,
  SHOW_CURSOR,
  RESET,
  SET_TITLE,
  PUSH_TITLE,
  POP_TITLE,
} from "./ansi";

export interface TerminalPort {
  isTTY(): boolean;
  /** columns right now (0/undefined-safe: callers get >= 1, default 80) */
  cols(): number;
  rows(): number;
  write(s: string): void;
  onData(cb: (chunk: Uint8Array) => void): void;
  onResize(cb: () => void): void;
  /** enter raw mode + alt screen + hide cursor (idempotent) */
  setup(): void;
  /** leave alt screen + show cursor + cooked mode (idempotent) */
  restore(): void;
}

export function realTerminal(): TerminalPort {
  const stdin = process.stdin;
  const stdout = process.stdout;
  let active = false;
  return {
    isTTY: () => Boolean(stdin.isTTY && stdout.isTTY),
    cols: () => stdout.columns || 80,
    rows: () => stdout.rows || 24,
    write: (s) => {
      stdout.write(s);
    },
    onData: (cb) => {
      stdin.on("data", (d: Buffer) => cb(new Uint8Array(d)));
    },
    onResize: (cb) => {
      process.on("SIGWINCH", cb);
      stdout.on("resize", cb);
    },
    setup: () => {
      if (active) return;
      active = true;
      if (typeof stdin.setRawMode === "function") stdin.setRawMode(true);
      stdin.resume();
      stdout.write(ENTER_ALT_SCREEN + HIDE_CURSOR + PUSH_TITLE + SET_TITLE);
    },
    restore: () => {
      if (!active) return;
      active = false;
      stdout.write(RESET + SHOW_CURSOR + POP_TITLE + LEAVE_ALT_SCREEN);
      if (typeof stdin.setRawMode === "function") stdin.setRawMode(false);
      stdin.pause();
    },
  };
}

// --- test double -------------------------------------------------------------

export interface FakeTerminal extends TerminalPort {
  /** every write(), in order */
  output: string[];
  /** deliver bytes to the app as one stdin chunk */
  feed(s: string): void;
  /** change the reported size and fire resize callbacks */
  resize(cols: number, rows: number): void;
  setupCount: number;
  restoreCount: number;
}

export function fakeTerminal(opts: { cols?: number; rows?: number; script?: string[] } = {}): FakeTerminal {
  let cols = opts.cols ?? 100;
  let rows = opts.rows ?? 30;
  const script = [...(opts.script ?? [])];
  let dataCb: ((chunk: Uint8Array) => void) | null = null;
  const resizeCbs: (() => void)[] = [];
  const encode = (s: string): Uint8Array => {
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
    return arr;
  };
  const term: FakeTerminal = {
    output: [],
    setupCount: 0,
    restoreCount: 0,
    isTTY: () => true,
    cols: () => cols,
    rows: () => rows,
    write: (s) => {
      term.output.push(s);
    },
    onData: (cb) => {
      dataCb = cb;
      // scripted keys play synchronously as soon as the app starts listening
      while (script.length > 0) {
        const chunk = script.shift()!;
        cb(encode(chunk));
      }
    },
    onResize: (cb) => {
      resizeCbs.push(cb);
    },
    setup: () => {
      term.setupCount += 1;
    },
    restore: () => {
      term.restoreCount += 1;
      term.output.push(RESET + SHOW_CURSOR + POP_TITLE + LEAVE_ALT_SCREEN);
    },
    feed: (s) => {
      dataCb?.(encode(s));
    },
    resize: (c, r) => {
      cols = c;
      rows = r;
      for (const cb of resizeCbs) cb();
    },
  };
  return term;
}
