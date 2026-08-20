// Event-room integration over the REAL bundle: deterministic replay through
// ?-rooms and events, pool consumption / one-time uniqueness, combat-event
// round trips, and save/resume across a pending event choice.

import { test, expect, describe } from "bun:test";
import { createRun, advance, type Command, type GameState } from "../../src/engine/game";
import type { EffectCtx } from "../../src/engine/content/defs";
import { buildBaseContentBundle } from "../../src/content/index";
import { generateEventId } from "../../src/engine/run/runFlow";
import { buildEventScreen } from "../../src/engine/run/eventRuntime";
import { makeTestCtx, runSignature } from "./runCtx";
import { MAP_HEIGHT } from "../../src/engine/run/mapGen";

const bundle = buildBaseContentBundle();

// --- a deterministic full-walk policy that engages events for real ------------------

function eventScreenCtx(s: GameState): EffectCtx {
  return makeTestCtx(s, bundle).ctx; // read-only use: build()/enabled() are pure
}

/** First enabled event option (events always keep at least one enabled). */
function firstEnabledOption(s: GameState): number {
  const screen = buildEventScreen(eventScreenCtx(s));
  if (!screen) return 0; // stub/INVALID: leave
  const i = screen.options.findIndex((o) => o.enabled(eventScreenCtx(s)));
  if (i === -1) throw new Error("event with no enabled options");
  return i;
}

function policyStep(s: GameState): GameState {
  if (s.pending) {
    const req = s.pending.request;
    const picks = req.kind === "cards" ? req.iids.slice(0, req.min) : [0];
    return advance(s, { cmd: "choose", indices: picks }, bundle);
  }
  const room = s.run.room!;
  switch (room.kind) {
    case "neow":
      return advance(s, { cmd: "neowPick", i: 1 }, bundle);
    case "map": {
      if (s.run.position === null) {
        const x = s.run.map!.rows[0]!.findIndex((n) => n !== null);
        return advance(s, { cmd: "mapPick", x, y: 0 }, bundle);
      }
      const [px, py] = s.run.position;
      if (py === MAP_HEIGHT - 1) return advance(s, { cmd: "mapPick", x: 3, y: MAP_HEIGHT }, bundle);
      return advance(s, { cmd: "mapPick", x: s.run.map!.rows[py]![px]!.edges[0]!, y: py + 1 }, bundle);
    }
    case "combat": {
      // tolerant attack bot (handles Entangled etc.)
      const target = s.combat!.monsters.findIndex((m) => !m.isDead && !m.isEscaped);
      const energy = s.combat!.player.energy;
      const atkIdx = s.combat!.player.piles.hand.findIndex((iid) => {
        const def = bundle.cards.get(s.combat!.cards[iid]!.defId)!;
        return def.type === "attack" && def.cost >= 0 && def.cost <= energy;
      });
      if (atkIdx !== -1 && target !== -1) {
        try {
          return advance(s, { cmd: "playCard", handIdx: atkIdx, target }, bundle);
        } catch {
          /* blocked: end turn */
        }
      }
      return advance(s, { cmd: "endTurn" }, bundle);
    }
    case "rewards":
      return advance(s, { cmd: "skipRewards" }, bundle);
    case "rest":
    case "shop":
      return advance(s, { cmd: "proceed" }, bundle);
    case "treasure":
      return room.chest.opened ? advance(s, { cmd: "proceed" }, bundle) : advance(s, { cmd: "openChest" }, bundle);
    case "event":
      return advance(s, { cmd: "eventOption", i: firstEnabledOption(s) }, bundle);
    case "gameOver":
      throw new Error("run over");
  }
}

function bigRun(seed: string): GameState {
  const boosted = buildBaseContentBundle();
  const ic = boosted.characters.get("IRONCLAD")!;
  boosted.characters.set("IRONCLAD", { ...ic, maxHp: 999 });
  return createRun({ seed, bundle: boosted, character: "IRONCLAD" });
}

describe("determinism through real events", () => {
  test("two identical walks stay byte-identical at every step (act 1)", () => {
    let a = createRun({ seed: "EVWALK", bundle, character: "IRONCLAD" });
    let b = createRun({ seed: "EVWALK", bundle, character: "IRONCLAD" });
    for (let i = 0; i < 250; i++) {
      if (a.outcome || a.run.act >= 2) break;
      a = policyStep(a);
      b = policyStep(b);
      expect(runSignature(a)).toBe(runSignature(b));
    }
  });

  test("JSON round-trip mid-event (pending deck choice) resumes identically", () => {
    let s = createRun({ seed: "EVSAVE", bundle, character: "IRONCLAD" });
    s.run.room = { kind: "event", eventId: "PURIFIER" };
    s = advance(s, { cmd: "eventOption", i: 0 }, bundle);
    expect(s.pending?.request.kind).toBe("cards");
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    const a = advance(s, { cmd: "choose", indices: [1] }, bundle);
    const b = advance(restored, { cmd: "choose", indices: [1] }, bundle);
    expect(runSignature(a)).toBe(runSignature(b));
    expect(a.run.deck.length).toBe(9);
  });
});

describe("event pools", () => {
  test("every generated event is unique and removed from its pool; INVALID after exhaustion", () => {
    const s = createRun({ seed: "EVPOOL", bundle, character: "IRONCLAD" });
    s.run.floor = 8; // opens the minFloor-gated act-1 events
    const { ctx, saveRng } = makeTestCtx(s, bundle);
    const seen: string[] = [];
    for (let guard = 0; guard < 100; guard++) {
      const id = generateEventId(ctx);
      if (id === null) break;
      seen.push(id);
    }
    saveRng();
    expect(seen.length).toBeGreaterThanOrEqual(11); // full act-1 pool + shrines at least
    expect(new Set(seen).size).toBe(seen.length); // never repeats
    expect(s.run.history.seenEvents).toEqual(seen);
    // the act-1 pool fully drains (all 11 spawnable at floor 8 with 99 gold)
    expect(s.run.pools.eventList.length).toBe(0);
    expect(s.run.pools.shrineList.length).toBe(0);
    // act-gated one-time events can never spawn in act 1 and stay in the pool
    for (const id of ["DESIGNER_IN_SPIRE", "KNOWING_SKULL", "NLOTH", "SECRET_PORTAL", "THE_JOUST", "DUPLICATOR"]) {
      expect(s.run.pools.oneTimeEventList).toContain(id);
      expect(seen).not.toContain(id);
    }
  });

  test("A15+ drops NOTE_FOR_YOURSELF from the one-time pool", () => {
    const s = createRun({ seed: "EVA15", bundle, character: "IRONCLAD", ascension: 15 });
    expect(s.run.pools.oneTimeEventList).not.toContain("NOTE_FOR_YOURSELF");
    const s0 = createRun({ seed: "EVA0", bundle, character: "IRONCLAD" });
    expect(s0.run.pools.oneTimeEventList).toContain("NOTE_FOR_YOURSELF");
  });

  test("?-room entry runs EventDef.onEnter (setup rolls land in room.data)", () => {
    // walk a boosted run until a ?-room resolves to a real event
    for (const seed of ["EVQ1", "EVQ2", "EVQ3", "EVQ4"]) {
      let s = bigRun(seed);
      const boosted = buildBaseContentBundle();
      const ic = boosted.characters.get("IRONCLAD")!;
      boosted.characters.set("IRONCLAD", { ...ic, maxHp: 999 });
      for (let i = 0; i < 200 && !s.outcome && s.run.act < 2; i++) {
        if (s.run.room!.kind === "event") {
          const room = s.run.room!;
          if (room.kind !== "event" || room.eventId === null) break;
          const def = boosted.events.get(room.eventId);
          expect(def).toBeDefined();
          if (def!.onEnter) expect(room.data).toBeDefined(); // setup ran on entry
          return;
        }
        s = policyStep(s);
      }
    }
    throw new Error("no event room reached in 4 seeds");
  });
});

describe("combat events round-trip", () => {
  test("Mushrooms: event -> combat -> event rewards -> map; bookkeeping matches normal fights", () => {
    let s = createRun({ seed: "EVMUSH", bundle, character: "IRONCLAD" });
    s.run.maxHp = 999;
    s.run.hp = 999;
    s.run.room = { kind: "event", eventId: "HYPNOTIZING_COLORED_MUSHROOMS" };
    const combatsBefore = s.run.history.combatsThisAct;
    s = advance(s, { cmd: "eventOption", i: 0 }, bundle);
    expect(s.run.room!.kind).toBe("combat");
    expect(s.combat).not.toBeNull();
    let guard = 0;
    while (s.combat && !s.outcome && guard++ < 400) {
      const target = s.combat.monsters.findIndex((m) => !m.isDead && !m.isEscaped);
      const energy = s.combat.player.energy;
      const atkIdx = s.combat.player.piles.hand.findIndex((iid) => {
        const def = bundle.cards.get(s.combat!.cards[iid]!.defId)!;
        return def.type === "attack" && def.cost >= 0 && def.cost <= energy;
      });
      s = atkIdx !== -1 && target !== -1 ? advance(s, { cmd: "playCard", handIdx: atkIdx, target }, bundle) : advance(s, { cmd: "endTurn" }, bundle);
    }
    expect(s.combat).toBeNull();
    expect(s.run.history.combatsThisAct).toBe(combatsBefore + 1);
    const rw = s.run.room!;
    if (rw.kind !== "rewards") throw new Error("expected event rewards");
    expect(rw.source).toBe("event");
    s = advance(s, { cmd: "skipRewards" }, bundle);
    expect(s.run.room!.kind).toBe("map");
    expect(s.outcome).toBeNull();
  });

  test("eventOption validates: unknown option and disabled option both throw", () => {
    let s = createRun({ seed: "EVVAL", bundle, character: "IRONCLAD" });
    s.run.room = { kind: "event", eventId: "GOLDEN_IDOL" };
    expect(() => advance(s, { cmd: "eventOption", i: 99 }, bundle)).toThrow("no event option");
    expect(() => advance(s, { cmd: "eventOption", i: 2 }, bundle)).toThrow("unavailable");
    s = advance(s, { cmd: "eventOption", i: 1 }, bundle); // leave
    expect(s.run.room!.kind).toBe("map");
  });
});
