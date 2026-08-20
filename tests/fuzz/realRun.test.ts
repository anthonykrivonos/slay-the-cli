import { test, expect, describe } from "bun:test";
import { createRun, advance, type Command, type GameState } from "../../src/engine/game";
import type { ContentBundle, EffectCtx } from "../../src/engine/content/defs";
import { buildBaseContentBundle } from "../../src/content/index";
import { buildEventScreen } from "../../src/engine/run/eventRuntime";
import { RngRegistry } from "../../src/engine/core/rngRegistry";
import { ActionQueue } from "../../src/engine/core/queue";
import { mulberry32, assertInvariants, legalCommands } from "./helpers";

// Full-run fuzz with the REAL bundle: Neow -> act 1 -> boss. Acts 2/3 content
// isn't implemented yet, so runs stop when the act-2 map appears (or on death).

const bundle = buildBaseContentBundle();

function runLegalCommands(s: GameState): Command[] {
  const room = s.run.room;
  if (!room || s.outcome) return [];
  switch (room.kind) {
    case "neow":
      return room.options.map((_, i) => ({ cmd: "neowPick", i }) as Command);
    case "map": {
      const map = s.run.map;
      if (!map) return [];
      const out: Command[] = [];
      if (s.run.position === null) {
        map.rows[0]!.forEach((node, x) => {
          if (node && node.edges.length > 0) out.push({ cmd: "mapPick", x, y: 0 });
        });
      } else {
        const [px, py] = s.run.position;
        if (py >= 14) {
          out.push({ cmd: "mapPick", x: 3, y: 15 }); // boss door
        } else {
          const node = map.rows[py]?.[px];
          for (const ex of node?.edges ?? []) out.push({ cmd: "mapPick", x: ex, y: py + 1 });
        }
      }
      return out;
    }
    case "combat":
      return legalCommands(s, bundle);
    case "rewards": {
      const out: Command[] = [{ cmd: "skipRewards" }];
      room.entries.forEach((e, i) => {
        if (!e.taken) {
          // don't try to take potions into a full belt
          if (e.kind === "potion" && s.run.potions.every((p) => p !== null)) return;
          out.push({ cmd: "takeReward", i });
        }
      });
      return out;
    }
    case "shop":
      return [{ cmd: "proceed" }];
    case "rest":
      return room.used ? [{ cmd: "proceed" }] : [{ cmd: "restOption", kind: "rest" }, { cmd: "proceed" }];
    case "treasure":
      return room.chest.opened ? [{ cmd: "proceed" }] : [{ cmd: "openChest" }, { cmd: "proceed" }];
    case "event":
      // real events: enumerate the ENABLED options (was `i: 0` in the stub era)
      return legalEventOptions(s, bundle);
    case "gameOver":
      return [];
  }
}

/** Read-only ctx over live state: build()/enabled() are pure (no rng, no writes). */
function legalEventOptions(s: GameState, b: ContentBundle): Command[] {
  const registry = RngRegistry.fromState(s.rng);
  const ctx: EffectCtx = {
    run: s.run,
    combat: s.combat,
    queue: new ActionQueue(),
    bundle: b,
    rt: { pending: null, currentItem: null, combatOver: null },
    rng: (st) => registry.get(st),
    asc: s.run.ascension,
    emit: () => {},
    requestChoice: () => {},
  };
  const screen = buildEventScreen(ctx);
  if (!screen) return [{ cmd: "eventOption", i: 0 }]; // stub/INVALID rooms: leave
  const out: Command[] = [];
  screen.options.forEach((o, i) => {
    if (o.enabled(ctx)) out.push({ cmd: "eventOption", i });
  });
  return out.length > 0 ? out : [{ cmd: "proceed" }];
}

type CharacterId = "IRONCLAD" | "SILENT" | "DEFECT" | "WATCHER";

function playRun(
  seed: string,
  agentSeed: number,
  policy: "random" | "greedy" = "random",
  maxSteps = 2500,
  character: CharacterId = "IRONCLAD",
): { s: GameState; commands: Command[]; steps: number } {
  const rand = mulberry32(agentSeed);
  let s = createRun({ seed, bundle, character });
  const commands: Command[] = [];
  let steps = 0;
  while (steps < maxSteps) {
    if (s.outcome || s.run.act >= 2 || s.run.room?.kind === "gameOver") break;
    const legal = s.pending ? legalCommands(s, bundle) : runLegalCommands(s);
    if (legal.length === 0) break;
    let cmd: Command;
    if (policy === "greedy") {
      // dump all playable cards before ending turn; take rewards; otherwise first option
      cmd =
        legal.find((c) => c.cmd === "playCard") ??
        legal.find((c) => c.cmd === "takeReward") ??
        legal.find((c) => c.cmd !== "skipRewards" && c.cmd !== "endTurn") ??
        legal[0]!;
    } else {
      cmd = legal[Math.floor(rand() * legal.length)]!;
    }
    s = advance(s, cmd, bundle);
    commands.push(cmd);
    assertInvariants(s);
    steps++;
  }
  return { s, commands, steps };
}

describe("real-bundle full act 1 runs", () => {
  for (let i = 0; i < 6; i++) {
    test(`seed RUN${i}: act 1 completes or dies, replay is byte-identical`, () => {
      const { s, commands, steps } = playRun(`RUN${i}`, 5000 + i);
      expect(steps).toBeGreaterThan(10);
      // outcome: reached act 2, died, or hit the step cap mid-act (rare)
      const reachedAct2 = s.run.act >= 2;
      const died = s.outcome?.kind === "death" || s.run.room?.kind === "gameOver";
      expect(reachedAct2 || died).toBe(true);

      // replay determinism
      let r = createRun({ seed: `RUN${i}`, bundle, character: "IRONCLAD" });
      for (const cmd of commands) r = advance(r, cmd, bundle);
      const strip = (x: GameState) => JSON.stringify({ ...x, eventLog: [] });
      expect(strip(r)).toBe(strip(s));
    });
  }

  test("boosted-HP flow probe: full 3-act traversal to the victory screen", () => {
    // A blind bot can't win honestly (as in the real game) — boost HP to
    // exercise the WHOLE flow: all acts, all bosses, events, shops, rests.
    const boosted = buildBaseContentBundle();
    const ic = boosted.characters.get("IRONCLAD")!;
    boosted.characters.set("IRONCLAD", { ...ic, maxHp: 999 });
    for (let i = 0; i < 8; i++) {
      let s = createRun({ seed: `SANE${i}`, bundle: boosted, character: "IRONCLAD" });
      let steps = 0;
      while (steps++ < 12000 && !s.outcome && s.run.room?.kind !== "gameOver") {
        const legal = s.pending ? legalCommands(s, boosted) : runLegalCommands(s);
        if (legal.length === 0) break;
        const cmd =
          legal.find((c) => c.cmd === "playCard") ??
          legal.find((c) => c.cmd !== "skipRewards" && c.cmd !== "endTurn") ??
          legal[0]!;
        s = advance(s, cmd, boosted);
        assertInvariants(s);
      }
      if (s.outcome?.kind === "victory") {
        // without all three keys the climb ends after the act-3 boss
        expect(s.run.act).toBe(3);
        expect(s.run.floor).toBeGreaterThanOrEqual(34);
        expect(s.run.room).toEqual({ kind: "gameOver", victory: true });
        return; // one full climb is enough
      }
    }
    throw new Error("no boosted run reached the act-3 victory in 8 tries — flow bug");
  });
});


describe("all four characters: random runs + boosted full climbs", () => {
  const CHARS = ["IRONCLAD", "SILENT", "DEFECT", "WATCHER"] as const;

  for (const ch of CHARS) {
    for (let i = 0; i < 3; i++) {
      test(`${ch} seed X${i}: invariants + byte-identical replay`, () => {
        const { s, commands, steps } = playRun(`X${ch}${i}`, 4200 + i, "random", 2500, ch);
        expect(steps).toBeGreaterThan(10);
        const done = s.run.act >= 2 || s.outcome !== null || s.run.room?.kind === "gameOver";
        expect(done).toBe(true);
        let r = createRun({ seed: `X${ch}${i}`, bundle, character: ch });
        for (const cmd of commands) r = advance(r, cmd, bundle);
        const strip = (x: GameState) => JSON.stringify({ ...x, eventLog: [] });
        expect(strip(r)).toBe(strip(s));
      });
    }

    test(`${ch}: boosted full climb to the act-3 victory`, () => {
      const boosted = buildBaseContentBundle();
      const def = boosted.characters.get(ch)!;
      boosted.characters.set(ch, { ...def, maxHp: 999 });
      for (let i = 0; i < 8; i++) {
        let s = createRun({ seed: `CLIMB${ch}${i}`, bundle: boosted, character: ch });
        let steps = 0;
        while (steps++ < 12000 && !s.outcome && s.run.room?.kind !== "gameOver") {
          const legal = s.pending ? legalCommands(s, boosted) : runLegalCommands(s);
          if (legal.length === 0) break;
          const cmd =
            legal.find((c) => c.cmd === "playCard") ??
            legal.find((c) => c.cmd !== "skipRewards" && c.cmd !== "endTurn") ??
            legal[0]!;
          s = advance(s, cmd, boosted);
          assertInvariants(s);
        }
        if (s.outcome?.kind === "victory") {
          expect(s.run.act).toBe(3);
          return;
        }
      }
      throw new Error(`no boosted ${ch} run reached the act-3 victory in 8 tries`);
    });
  }
});
