// CLI purity boundaries: render/, input/, state/, text/ plus the two pure
// term files (ansi.ts, keys.ts) must never touch the OS — no process, no
// Bun.*, no node: imports, no DOM. Only term/terminal.ts, io/, app.ts and
// main.ts may. This keeps renderFrame/buildView/mapKey snapshot-testable and
// portable. (Engine purity has its own suite in tests/architecture/.)

import { test, expect, describe } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CLI_ROOT = join(import.meta.dir, "../../src/cli");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

const PURE_FILES = [
  ...walk(join(CLI_ROOT, "render")),
  ...walk(join(CLI_ROOT, "input")),
  ...walk(join(CLI_ROOT, "state")),
  ...walk(join(CLI_ROOT, "text")),
  join(CLI_ROOT, "term/ansi.ts"),
  join(CLI_ROOT, "term/keys.ts"),
];

function stripComments(src: string): string {
  return src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("cli purity", () => {
  test("pure layers exist", () => {
    expect(PURE_FILES.length).toBeGreaterThan(15);
  });

  const banned: [string, RegExp][] = [
    ["process global", /\bprocess\./],
    ["Bun API", /\bBun\./],
    ["node: import", /from\s+["']node:/],
    ["dynamic require", /\brequire\s*\(/],
    ["DOM document", /\bdocument\./],
    ["DOM window", /\bwindow\./],
    ["localStorage", /\blocalStorage\b/],
    ["Math.random", /\bMath\.random\b/],
    ["Date.now", /\bDate\.now\b/],
    ["setTimeout", /\bsetTimeout\b/],
    ["three import", /from\s+["']three/],
    ["react import", /from\s+["']react/],
  ];

  for (const [label, re] of banned) {
    test(`pure cli layers contain no ${label}`, () => {
      const offenders = PURE_FILES.filter((f) => re.test(stripComments(readFileSync(f, "utf8"))));
      expect(offenders.map((f) => f.replace(CLI_ROOT, "src/cli"))).toEqual([]);
    });
  }

  test("pure layers never import the impure ones (terminal/io/app/main)", () => {
    const re = /from\s+["'][^"']*(terminal|\/io\/|\.\.\/app|\.\.\/main)[^"']*["']/;
    const offenders = PURE_FILES.filter((f) => re.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.replace(CLI_ROOT, "src/cli"))).toEqual([]);
  });

  test("only the view layer (and text/) consult the content bundle", () => {
    // render/ and input/ operate on the View alone; type-only imports of
    // engine shapes (e.g. the Command union) are fine — no runtime coupling
    const files = [...walk(join(CLI_ROOT, "render")), ...walk(join(CLI_ROOT, "input"))];
    const re = /^import\s+(?!type\b)[^;]*from\s+["'][^"']*\/(content|engine)\//m;
    const offenders = files.filter((f) => re.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.replace(CLI_ROOT, "src/cli"))).toEqual([]);
  });

  test("cli never imports the legacy web UI", () => {
    const all = walk(CLI_ROOT);
    const re = /from\s+["'][^"']*\/ui\//;
    const offenders = all.filter((f) => re.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.replace(CLI_ROOT, "src/cli"))).toEqual([]);
  });
});
