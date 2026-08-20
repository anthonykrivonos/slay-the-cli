// Long-run fuzzing: bun tools/fuzz.ts --seeds 500
// Random-agent combat playouts with invariant + replay checks (see tests/fuzz/helpers.ts).

import { createCombatGame } from "../src/engine/game";
import { buildBaseContentBundle } from "../src/content/index";
import { fuzzOne, replayMatches } from "../tests/fuzz/helpers";

const seedCount = Number(process.argv[process.argv.indexOf("--seeds") + 1] || 100);
const bundle = buildBaseContentBundle();
const deck = [
  ...Array(5).fill({ defId: "STRIKE_RED" }),
  ...Array(4).fill({ defId: "DEFEND_RED" }),
  { defId: "BASH" },
];

let failures = 0;
const outcomes: Record<string, number> = {};
const start = performance.now();

for (let i = 0; i < seedCount; i++) {
  const seed = `LONGFUZZ${i}`;
  const make = () =>
    createCombatGame({ seed, bundle, character: "IRONCLAD", deck, monsters: ["JAW_WORM"] });
  try {
    const result = fuzzOne(make(), bundle, 900000 + i);
    const key = result.outcome ?? (result.finalState.eventLog.length >= 0 ? "victoryOrTimeout" : "?");
    outcomes[key] = (outcomes[key] ?? 0) + 1;
    if (!replayMatches(make(), result.commands, bundle, result.finalState)) {
      failures++;
      console.error(`REPLAY MISMATCH seed=${seed}`);
    }
  } catch (e) {
    failures++;
    console.error(`FAIL seed=${seed}: ${e}`);
  }
  if ((i + 1) % 50 === 0) console.log(`${i + 1}/${seedCount}...`);
}

const secs = ((performance.now() - start) / 1000).toFixed(1);
console.log(`\n${seedCount} playouts in ${secs}s — outcomes: ${JSON.stringify(outcomes)} — failures: ${failures}`);
process.exit(failures > 0 ? 1 : 0);
