#!/usr/bin/env bun
// Slay the CLI - Slay the Spire, adapted to the terminal. Entry point: argv parsing, TTY guard,
// terminal-restore safety nets, then the app loop. Run with: bun src/cli/main.ts
//   --seed FOO         starting seed
//   --character SILENT IRONCLAD | SILENT | DEFECT | WATCHER
//   --ascension 20     0..20
//   --no-color         plain output (NO_COLOR env works too)

import { realTerminal } from "./term/terminal";
import { runApp, type AppOptions } from "./app";
import { makeSaveIo } from "./io/saves";
import { clampAscension, isCharacterId } from "./text/runlogic";

function parseArgv(argv: string[]): AppOptions | { error: string } {
  const opts: AppOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const eq = arg.indexOf("=");
    const name = eq >= 0 ? arg.slice(0, eq) : arg;
    const inlineValue = eq >= 0 ? arg.slice(eq + 1) : null;
    const takeValue = (): string | null => {
      if (inlineValue !== null) return inlineValue;
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) return null;
      i += 1;
      return next;
    };
    switch (name) {
      case "--seed": {
        const v = takeValue();
        if (v === null || v.trim().length === 0) return { error: "--seed needs a value" };
        opts.seed = v.trim().toUpperCase();
        break;
      }
      case "--character": {
        const v = takeValue();
        const up = v?.trim().toUpperCase();
        if (!isCharacterId(up)) return { error: "--character must be IRONCLAD, SILENT, DEFECT or WATCHER" };
        opts.character = up;
        break;
      }
      case "--ascension": {
        const v = takeValue();
        if (v === null) return { error: "--ascension needs a value (0-20)" };
        opts.ascension = clampAscension(v);
        break;
      }
      case "--no-color":
        opts.noColor = true;
        break;
      case "--help":
      case "-h":
        return { error: "__help__" };
      default:
        return { error: `unknown option ${name}` };
    }
  }
  return opts;
}

const USAGE = `Slay the CLI - the whole Spire, played in a terminal

usage: bun src/cli/main.ts [--seed FOO] [--character IRONCLAD] [--ascension 0] [--no-color]

Saves live in ~/.slay (override with SLAY_DIR). The run is saved after every
action; Ctrl+C or q quits safely and "continue" resumes.`;

const parsed = parseArgv(process.argv.slice(2));
if ("error" in parsed) {
  if (parsed.error === "__help__") {
    console.log(USAGE);
    process.exit(0);
  }
  console.error(`slay: ${parsed.error}\n\n${USAGE}`);
  process.exit(2);
}

const term = realTerminal();
if (!term.isTTY()) {
  console.error("slay: needs an interactive terminal (stdin and stdout must be TTYs).");
  process.exit(1);
}

if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") {
  parsed.noColor = true;
}

// terminal restoration must survive every exit path (idempotent restore)
const restore = (): void => {
  try {
    term.restore();
  } catch {
    /* ignore */
  }
};
process.on("exit", restore);
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restore();
  process.exit(143);
});
process.on("uncaughtException", (e) => {
  // leave the alt screen FIRST so the stack trace lands in the scrollback
  restore();
  console.error(e);
  process.exit(1);
});

await runApp({ term, saves: makeSaveIo(), options: parsed });
process.exit(0);
