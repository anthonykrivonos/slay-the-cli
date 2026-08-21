import { test, expect, describe } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Engine purity: src/engine must be deterministic, DOM-free, framework-free,
// and must never import concrete content. These greps are the enforcement.

const ROOT = join(import.meta.dir, "../..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const engineFiles = walk(join(ROOT, "src/engine"));

describe("engine purity", () => {
  test("engine has files", () => {
    expect(engineFiles.length).toBeGreaterThan(5);
  });

  const banned: [string, RegExp][] = [
    ["react import", /from\s+["']react/],
    ["three import", /from\s+["']three/],
    ["DOM document", /\bdocument\./],
    ["DOM window", /\bwindow\./],
    ["Bun API", /\bBun\./],
    ["Math.random", /\bMath\.random\b/],
    ["Date.now", /\bDate\.now\b/],
    ["setTimeout", /\bsetTimeout\b/],
    ["localStorage", /\blocalStorage\b/],
    ["import from src/content", /from\s+["'][^"']*\.\.\/\.\.\/content\//],
    ["import from ui", /from\s+["'][^"']*\/ui\//],
  ];

  for (const [label, re] of banned) {
    test(`engine contains no ${label}`, () => {
      const offenders = engineFiles.filter((f) => re.test(readFileSync(f, "utf8")));
      expect(offenders.map((f) => f.replace(ROOT, ""))).toEqual([]);
    });
  }
});

describe("state serializability", () => {
  test("combatState/runState define no methods or class state", () => {
    for (const f of ["src/engine/combat/combatState.ts", "src/engine/run/runState.ts"]) {
      const src = readFileSync(join(ROOT, f), "utf8")
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      expect(src).not.toMatch(/\bclass\s/);
      expect(src).not.toMatch(/=>/); // interfaces only - no function-typed fields
    }
  });
});
