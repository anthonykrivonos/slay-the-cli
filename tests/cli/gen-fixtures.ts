// Regenerates the checked-in frame snapshot fixtures:
//   bun tests/cli/gen-fixtures.ts
// Inspect the diff before committing — these files ARE the expected UI.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES, bundle } from "./fixtures";
import { buildView } from "../../src/cli/state/view";
import { renderFrame } from "../../src/cli/render/frame";
import { THEME_PLAIN } from "../../src/cli/render/theme";

export const FIXTURE_DIR = join(import.meta.dir, "fixtures");
export const SNAPSHOT_SIZES = [
  { cols: 100, rows: 30 },
  { cols: 80, rows: 24 },
] as const;

export function renderFixture(name: string, cols: number, rows: number): string {
  const build = FIXTURES[name];
  if (!build) throw new Error(`unknown fixture ${name}`);
  const { game, ui } = build();
  const view = buildView(game, ui, bundle);
  return renderFrame(view, { cols, rows }, THEME_PLAIN).join("\n");
}

if (import.meta.main) {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  for (const name of Object.keys(FIXTURES)) {
    for (const { cols, rows } of SNAPSHOT_SIZES) {
      const file = join(FIXTURE_DIR, `${name}.${cols}x${rows}.txt`);
      writeFileSync(file, renderFixture(name, cols, rows) + "\n");
      console.log("wrote", file);
    }
  }
  // the too-small notice, once (any state renders identically)
  const file = join(FIXTURE_DIR, "too-small.79x24.txt");
  writeFileSync(file, renderFixture("map-act1", 79, 24) + "\n");
  console.log("wrote", file);
}
