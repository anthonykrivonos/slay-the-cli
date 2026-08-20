// Deterministic fixture states for the frame snapshot tests. Every fixture is
// built by scripted advance() calls on a fixed seed (plus two synthetic states
// for screens that need a full 3-act climb to reach organically). Shared by
// frame.test.ts and gen-fixtures.ts so the two can never drift.

import { createRun, advance, type GameState, type Command } from "../../src/engine/game";
import { buildBaseContentBundle } from "../../src/content";
import type { ContentBundle } from "../../src/engine/content/defs";
import type { ActMap, MapNode } from "../../src/engine/run/runState";
import { legalCommands } from "../fuzz/helpers";
import { legalMapPicks, buildEventView } from "../../src/cli/text/runlogic";
import { formatEvent } from "../../src/cli/text/logfmt";
import { initialUiState, pushLog, type UiState } from "../../src/cli/state/uiState";

export const bundle: ContentBundle = buildBaseContentBundle();

export interface Fixture {
  game: GameState | null;
  ui: UiState;
}

interface Walk {
  s: GameState;
  ui: UiState;
}

function freshUi(): UiState {
  return { ...initialUiState({ seed: "SPIRE" }), screen: "run" };
}

function absorb(w: Walk): void {
  w.ui = pushLog(w.ui, w.s.eventLog.map((ev) => formatEvent(ev, bundle)));
}

function step(w: Walk, cmd: Command): void {
  w.s = advance(w.s, cmd, bundle);
  absorb(w);
}

function start(seed: string, character: "IRONCLAD" | "SILENT" | "DEFECT" | "WATCHER" = "IRONCLAD"): Walk {
  const w: Walk = { s: createRun({ seed, bundle, character }), ui: freshUi() };
  absorb(w);
  return w;
}

/** Deterministic greedy step used to walk toward a target room kind. */
function policyStep(w: Walk, wantKind: string | null): boolean {
  const s = w.s;
  if (s.outcome) return false;
  if (s.pending) {
    const req = s.pending.request;
    const n = req.kind === "cards" ? Math.min(Math.max(req.min, 1), req.max, req.iids.length) : 1;
    const indices = req.kind === "option" ? [0] : req.iids.slice(0, n).map((_, i) => i);
    step(w, { cmd: "choose", indices });
    return true;
  }
  const room = s.run.room;
  if (!room) return false;
  switch (room.kind) {
    case "neow":
      step(w, { cmd: "neowPick", i: 1 }); // always a bonus-only tier-1 pick
      return true;
    case "map": {
      const picks = legalMapPicks(s.run);
      if (picks.length === 0) return false;
      const kindOf = (p: { x: number; y: number }): string => s.run.map?.rows[p.y]?.[p.x]?.kind ?? "boss";
      const preferred =
        (wantKind !== null ? picks.find((p) => kindOf(p) === wantKind) : undefined) ??
        (wantKind === "event" ? picks.find((p) => kindOf(p) === "unknown") : undefined) ??
        picks[0]!;
      step(w, { cmd: "mapPick", x: preferred.x, y: preferred.y });
      return true;
    }
    case "combat": {
      const legal = legalCommands(s, bundle);
      if (legal.length === 0) return false;
      const cmd = legal.find((c) => c.cmd === "playCard") ?? legal[0]!;
      step(w, cmd);
      return true;
    }
    case "rewards":
      step(w, { cmd: "skipRewards" });
      return true;
    case "shop":
      step(w, { cmd: "proceed" });
      return true;
    case "rest":
      step(w, { cmd: "proceed" });
      return true;
    case "treasure":
      step(w, { cmd: "proceed" });
      return true;
    case "event": {
      const view = buildEventView(s, bundle);
      const i = view ? Math.max(0, view.options.findIndex((o) => o.enabled)) : 0;
      step(w, { cmd: "eventOption", i });
      return true;
    }
    case "gameOver":
      return false;
  }
}

function walkToRoom(seed: string, want: "shop" | "rest" | "treasure" | "event", maxSteps = 400): Walk {
  const w = start(seed);
  let guard = 0;
  while (w.s.run.room?.kind !== want && guard++ < maxSteps) {
    if (!policyStep(w, want)) break;
  }
  if (w.s.run.room?.kind !== want) {
    throw new Error(`fixture walk for "${want}" on seed ${seed} ended on ${w.s.run.room?.kind ?? "nothing"}`);
  }
  return w;
}

// --- fixtures --------------------------------------------------------------------

export function fxMenu(): Fixture {
  const ui = initialUiState({ seed: "SPIRE" });
  return { game: null, ui: { ...ui, menuSave: { desc: "Ironclad A0 - Floor 3 - Act 1" } } };
}

export function fxNeow(): Fixture {
  const w = start("UISMOKE");
  return { game: w.s, ui: w.ui };
}

export function fxMapAct1(): Fixture {
  const w = start("UISMOKE");
  step(w, { cmd: "neowPick", i: 1 });
  return { game: w.s, ui: w.ui };
}

export function fxCombat(): Fixture {
  const w = start("UISMOKE");
  step(w, { cmd: "neowPick", i: 1 });
  const pick = legalMapPicks(w.s.run)[0]!;
  step(w, { cmd: "mapPick", x: pick.x, y: pick.y });
  if (w.s.run.room?.kind !== "combat") throw new Error("fxCombat: expected combat");
  return { game: w.s, ui: w.ui };
}

export function fxCombatTargeting(): Fixture {
  const f = fxCombat();
  const c = f.game!.combat!;
  const handIdx = c.player.piles.hand.findIndex((iid) => {
    const card = c.cards[iid]!;
    return bundle.cards.get(card.defId)?.target === "enemy";
  });
  if (handIdx < 0) throw new Error("fxCombatTargeting: no targeted card in hand");
  return { game: f.game, ui: { ...f.ui, targeting: { kind: "card", handIdx } } };
}

/** Defect: ZAP verified in the opening hand on seed DFX0 -> Lightning orb. */
export function fxCombatOrbs(): Fixture {
  const w = start("DFX0", "DEFECT");
  step(w, { cmd: "neowPick", i: 1 });
  const picks = legalMapPicks(w.s.run);
  const pick = picks.find((p) => w.s.run.map?.rows[p.y]?.[p.x]?.kind === "monster") ?? picks[0]!;
  step(w, { cmd: "mapPick", x: pick.x, y: pick.y });
  if (w.s.run.room?.kind !== "combat") throw new Error("fxCombatOrbs: expected combat");
  const c = w.s.combat!;
  const zapIdx = c.player.piles.hand.findIndex((iid) => c.cards[iid]!.defId === "ZAP");
  if (zapIdx < 0) throw new Error("fxCombatOrbs: ZAP not in opening hand");
  step(w, { cmd: "playCard", handIdx: zapIdx });
  return { game: w.s, ui: w.ui };
}

/** Watcher: VIGILANCE verified in the opening hand on seed WTX0 -> Calm. */
export function fxCombatStance(): Fixture {
  const w = start("WTX0", "WATCHER");
  step(w, { cmd: "neowPick", i: 1 });
  const picks = legalMapPicks(w.s.run);
  const pick = picks.find((p) => w.s.run.map?.rows[p.y]?.[p.x]?.kind === "monster") ?? picks[0]!;
  step(w, { cmd: "mapPick", x: pick.x, y: pick.y });
  if (w.s.run.room?.kind !== "combat") throw new Error("fxCombatStance: expected combat");
  const c = w.s.combat!;
  const vigIdx = c.player.piles.hand.findIndex((iid) => c.cards[iid]!.defId === "VIGILANCE");
  if (vigIdx < 0) throw new Error("fxCombatStance: VIGILANCE not in opening hand");
  step(w, { cmd: "playCard", handIdx: vigIdx });
  return { game: w.s, ui: w.ui };
}

/** Pending-choice picker: NW0's first Neow option is REMOVE_CARD (verified). */
export function fxChoice(): Fixture {
  const w = start("NW0");
  step(w, { cmd: "neowPick", i: 0 });
  if (!w.s.pending) throw new Error("fxChoice: expected a pending choice");
  return { game: w.s, ui: w.ui };
}

export function fxRewards(): Fixture {
  const w = start("UISMOKE");
  step(w, { cmd: "neowPick", i: 1 });
  const pick = legalMapPicks(w.s.run)[0]!;
  step(w, { cmd: "mapPick", x: pick.x, y: pick.y });
  let guard = 0;
  while (w.s.run.room?.kind === "combat" && !w.s.outcome && guard++ < 300) {
    const legal = legalCommands(w.s, bundle);
    const cmd = legal.find((c) => c.cmd === "playCard") ?? legal[0]!;
    step(w, cmd);
  }
  if (w.s.run.room?.kind !== "rewards") throw new Error("fxRewards: expected rewards");
  return { game: w.s, ui: w.ui };
}

export function fxShop(): Fixture {
  const w = walkToRoom("SPIRE", "shop");
  return { game: w.s, ui: w.ui };
}

export function fxRest(): Fixture {
  const w = walkToRoom("FXREST0", "rest"); // seed verified: greedy walk survives to a rest site
  return { game: w.s, ui: w.ui };
}

export function fxTreasure(): Fixture {
  const w = walkToRoom("FXTREASURE8", "treasure"); // seed verified: survives to the chest row
  return { game: w.s, ui: w.ui };
}

export function fxEvent(): Fixture {
  const w = walkToRoom("UISMOKE", "event");
  return { game: w.s, ui: w.ui };
}

export function fxDeckOverlay(): Fixture {
  const f = fxMapAct1();
  return { game: f.game, ui: { ...f.ui, overlays: [{ kind: "deck", mode: "view", page: 0 }] } };
}

/** Info panel: a hand card holds the hover focus (first Strike, idx 2). */
export function fxCombatTooltip(): Fixture {
  const f = fxCombat();
  return { game: f.game, ui: { ...f.ui, focus: { scope: "combat", idx: 2 } } };
}

/** Info panel: the first shop relic holds the selection cursor (item 7). */
export function fxShopTooltip(): Fixture {
  const f = fxShop();
  return { game: f.game, ui: { ...f.ui, focus: { scope: "shop", idx: 7 } } };
}

/** Synthetic: a lost run (organic defeat needs a scripted throw-away fight). */
export function fxGameOverDefeat(): Fixture {
  const f = fxCombat();
  const g = structuredClone(f.game!);
  g.run.room = { kind: "gameOver", victory: false };
  g.run.hp = 0;
  g.combat = null;
  g.pending = null;
  g.outcome = { kind: "death" };
  return { game: g, ui: f.ui };
}

/** Synthetic: the act-3 victory screen. */
export function fxGameOverVictory(): Fixture {
  const f = fxCombat();
  const g = structuredClone(f.game!);
  g.run.room = { kind: "gameOver", victory: true };
  g.run.act = 3;
  g.run.floor = 34;
  g.combat = null;
  g.pending = null;
  g.outcome = { kind: "victory" };
  return { game: g, ui: f.ui };
}

/** Synthetic act-4 column, mirroring runFlow's act4ActMap exactly. */
export function fxMapAct4(): Fixture {
  const f = fxMapAct1();
  const g = structuredClone(f.game!);
  const rows: (MapNode | null)[][] = Array.from({ length: 15 }, () => new Array<MapNode | null>(7).fill(null));
  const kinds: MapNode["kind"][] = ["rest", "shop", "elite", "boss"];
  kinds.forEach((kind, y) => {
    rows[y]![3] = { x: 3, y, kind, edges: y < 3 ? [3] : [], burningElite: false, emeraldKey: false };
  });
  const map: ActMap = { act: 4, rows, bossId: "THE_HEART", burningEliteBuff: -1 };
  g.run.act = 4;
  g.run.floor = 52;
  g.run.map = map;
  g.run.position = [3, 0];
  g.run.room = { kind: "map" };
  g.run.keys = { emerald: true, ruby: true, sapphire: true };
  return { game: g, ui: f.ui };
}

export const FIXTURES: Record<string, () => Fixture> = {
  menu: fxMenu,
  neow: fxNeow,
  "map-act1": fxMapAct1,
  "map-act4": fxMapAct4,
  combat: fxCombat,
  "combat-targeting": fxCombatTargeting,
  "combat-orbs": fxCombatOrbs,
  "combat-stance": fxCombatStance,
  choice: fxChoice,
  rewards: fxRewards,
  shop: fxShop,
  rest: fxRest,
  treasure: fxTreasure,
  event: fxEvent,
  "deck-overlay": fxDeckOverlay,
  "combat-tooltip": fxCombatTooltip,
  "shop-tooltip": fxShopTooltip,
  "gameover-defeat": fxGameOverDefeat,
  "gameover-victory": fxGameOverVictory,
};
