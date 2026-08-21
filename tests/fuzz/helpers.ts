// Shared fuzz driver: a seeded random agent that plays legal commands and
// asserts engine invariants after every advance.

import { advance, type Command, type GameState } from "../../src/engine/game";
import type { ContentBundle, EffectCtx } from "../../src/engine/content/defs";
import { ActionQueue } from "../../src/engine/core/queue";
import { effectiveCost } from "../../src/engine/combat/interpreter";
import { vetoHook } from "../../src/engine/core/hooks";
import { PLAYER } from "../../src/engine/core/ids";

/** Small deterministic PRNG for the AGENT's choices (unrelated to game RNG). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function legalCommands(s: GameState, bundle: ContentBundle): Command[] {
  const out: Command[] = [];
  if (s.outcome) return out;
  if (s.pending) {
    const req = s.pending.request;
    if (req.kind === "cards") {
      const n = Math.min(Math.max(req.min, 1), req.max, req.iids.length);
      out.push({ cmd: "choose", indices: req.iids.slice(0, n).map((_, i) => i) });
      if (req.canCancel || req.min === 0) out.push({ cmd: "choose", indices: [] });
    } else if (req.kind === "scry") {
      out.push({ cmd: "choose", indices: [] });
      if (req.iids.length > 0) out.push({ cmd: "choose", indices: [0] });
    } else {
      req.options.forEach((_, i) => out.push({ cmd: "choose", indices: [i] }));
    }
    return out;
  }
  const combat = s.combat;
  if (!combat) return out;
  // read-only fold ctx mirroring the engine's playability gate (vetoes + dynamic costs)
  const ctx: EffectCtx = {
    run: s.run,
    combat,
    queue: new ActionQueue(),
    bundle,
    rt: { pending: null, currentItem: null, combatOver: null },
    rng: (() => {
      throw new Error("rng not available in fuzz legality probe");
    }) as never,
    asc: s.run.ascension,
    emit: () => {},
    requestChoice: () => {},
  };
  const aliveMonsters = combat.monsters.filter((m) => !m.isDead && !m.isEscaped).map((m) => m.idx);
  combat.player.piles.hand.forEach((iid, handIdx) => {
    const c = combat.cards[iid]!;
    const def = bundle.cards.get(c.defId);
    if (!def || c.cost === -2) return;
    let cost: number;
    try {
      cost = c.cost === -1 ? 0 : effectiveCost(ctx, c);
    } catch {
      return; // dynamicCost needing rng etc: skip
    }
    if (combat.player.energy < cost && !c.freeToPlayOnce) return;
    if (def.canUse) return; // conservative: skip conditional cards in the fuzz driver
    if (!vetoHook(ctx, PLAYER, "canPlayCard", c)) return; // Normality/Velvet Choker/Entangled
    if (def.target === "enemy") {
      for (const t of aliveMonsters) out.push({ cmd: "playCard", handIdx, target: t });
    } else {
      out.push({ cmd: "playCard", handIdx });
    }
  });
  out.push({ cmd: "endTurn" });
  return out;
}

export function assertInvariants(s: GameState): void {
  if (s.combat) {
    const { player, cards } = s.combat;
    if (player.energy < 0) throw new Error(`energy negative: ${player.energy}`);
    if (player.block < 0 || player.block > 999) throw new Error(`block out of range: ${player.block}`);
    // card conservation: multiset union of piles == keys(cards), no duplicates
    const seen = new Set<number>();
    for (const pile of Object.values(player.piles)) {
      for (const iid of pile) {
        if (seen.has(iid)) throw new Error(`card ${iid} appears in two piles`);
        seen.add(iid);
        if (!cards[iid]) throw new Error(`pile references unknown card ${iid}`);
      }
    }
    // cards legitimately held OUTSIDE the piles: a Bronze Orb's Stasis stores
    // the stolen card's iid on the orb until it dies (returned on death)
    for (const m of s.combat.monsters) {
      const held = (m.data as Record<string, unknown> | undefined)?.stasisCardIid;
      if (typeof held === "number" && !m.isDead) seen.add(held);
    }
    for (const iid of Object.keys(cards)) {
      if (!seen.has(Number(iid))) throw new Error(`card ${iid} not in any pile`);
    }
    for (const m of s.combat.monsters) {
      if (m.hp < 0 || m.hp > m.maxHp) throw new Error(`monster hp out of range: ${m.id} ${m.hp}/${m.maxHp}`);
      if (m.block < 0) throw new Error(`monster block negative`);
    }
  }
  if (s.run.hp < 0 || s.run.hp > s.run.maxHp) throw new Error(`player hp out of range: ${s.run.hp}/${s.run.maxHp}`);
}

export interface FuzzResult {
  steps: number;
  commands: Command[];
  finalState: GameState;
  outcome: string | null;
}

export function fuzzOne(
  initial: GameState,
  bundle: ContentBundle,
  agentSeed: number,
  maxSteps = 400,
): FuzzResult {
  const rand = mulberry32(agentSeed);
  let s = initial;
  const commands: Command[] = [];
  assertInvariants(s);
  let steps = 0;
  while (!s.outcome && steps < maxSteps) {
    const legal = legalCommands(s, bundle);
    if (legal.length === 0) break;
    const cmd = legal[Math.floor(rand() * legal.length)]!;
    s = advance(s, cmd, bundle);
    commands.push(cmd);
    assertInvariants(s);
    steps++;
    if (s.eventLog.some((e) => e.event === "combatEnded")) break; // single-combat games end here
  }
  return { steps, commands, finalState: s, outcome: s.outcome?.kind ?? null };
}

/** Replay a command list from a fresh initial state; must be byte-identical. */
export function replayMatches(initial: GameState, commands: Command[], bundle: ContentBundle, expected: GameState): boolean {
  let s = initial;
  for (const cmd of commands) s = advance(s, cmd, bundle);
  const strip = (x: GameState) => JSON.stringify({ ...x, eventLog: [] });
  return strip(s) === strip(expected);
}
