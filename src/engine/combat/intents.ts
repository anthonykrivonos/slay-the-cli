// Intent display numbers - exactly what the game shows: the move's damage run
// through the live calc pipeline (Strength, Weak, Vulnerable-on-player, etc.).
//
// Rather than duplicating per-move damage tables, we DRY-RUN the move's
// execute() against a structuredClone of the state with a throwaway queue and
// a poisoned RNG, then read the enqueued actions without applying them.
// Moves whose preview would need randomness or a choice fall back to
// category-only (the game shows those as plain intents too).

import type { ContentBundle, EffectCtx } from "../content/defs";
import { ActionQueue } from "../core/queue";

/** A power the move will apply, and to whom. */
export interface IntentPower {
  powerId: string;
  amount: number;
  target: "you" | "self" | "ally";
}

/** Cards the move will put into your deck (Burn, Slimed, Dazed, Void...). */
export interface IntentCards {
  defId: string;
  n: number;
  dest: string;
}

export interface IntentInfo {
  kind: string; // MonsterMoveDef.intent category
  moveId: string;
  /** per-hit attack damage aimed at the player (null = not an attack preview) */
  damage: number | null;
  hits: number;
  /** block the monster will gain for itself */
  block: number;
  /** block it hands to another monster (Shield Gremlin) */
  allyBlock: number;
  /** powers it applies, in the order the move queues them */
  powers: IntentPower[];
  /** status/curse cards it adds to your piles */
  cards: IntentCards[];
  /** HP it restores to itself or an ally */
  heal: number;
  /** monsters it summons */
  summons: string[];
  /** HP it takes from you outside an attack */
  hpLoss: number;
  /** the preview stopped early (the move rolls dice or asks a question part
   *  way through), so what is here is what it does FIRST, not all of it */
  partial: boolean;
}

export function computeIntent(ctx: EffectCtx, idx: number): IntentInfo | null {
  const combat = ctx.combat;
  if (!combat) return null;
  const m = combat.monsters[idx];
  if (!m || m.isDead || m.isEscaped || m.halfDead || !m.move) return null;
  const def = ctx.bundle.monsters.get(m.id);
  const move = def?.moves[m.move];
  if (!move) return null;

  const fallback: IntentInfo = {
    kind: move.intent,
    moveId: m.move,
    damage: null,
    hits: 0,
    block: 0,
    allyBlock: 0,
    powers: [],
    cards: [],
    heal: 0,
    summons: [],
    hpLoss: 0,
    partial: true,
  };
  try {
    const combatClone = structuredClone(combat);
    const runClone = structuredClone(ctx.run);
    const queue = new ActionQueue();
    const dryCtx: EffectCtx = {
      ...ctx,
      run: runClone,
      combat: combatClone,
      queue,
      rng: (() => {
        throw new Error("rng not available in intent dry-run");
      }) as never,
      rt: { pending: null, currentItem: null, combatOver: null },
      emit: () => {},
      requestChoice: () => {
        throw new Error("choice not available in intent dry-run");
      },
    };
    // Powers are applied straight to the target rather than queued, so read
    // them by diffing the clone the dry-run mutated. That also means the
    // preview accounts for Artifact eating a debuff, exactly as the turn will.
    const snapshot = (list: { id: string; amount: number }[]): Map<string, number> =>
      new Map(list.map((p) => [p.id, p.amount]));
    const playerBefore = snapshot(combatClone.player.powers);
    const monsterBefore = combatClone.monsters.map((mm) => snapshot(mm.powers));
    const monsterHpBefore = combatClone.monsters.map((mm) => mm.hp);
    const playerHpBefore = runClone.hp;

    // A move that rolls dice or asks a question part way through stops there;
    // whatever it did first is still in the queue and the clone, and showing
    // that beats showing nothing (the Corrupt Heart's Debilitate applies its
    // three debuffs before it starts shuffling statuses into your deck).
    let partial = false;
    try {
      move.execute(dryCtx, combatClone.monsters[idx]!);
    } catch {
      partial = true;
    }

    let damage: number | null = null;
    let hits = 0;
    let block = 0;
    let allyBlock = 0;
    let heal = 0;
    let hpLoss = 0;
    const powers: IntentPower[] = [];
    const cards: IntentCards[] = [];
    const summons: string[] = [];
    for (let a = queue.pop(); a !== undefined; a = queue.pop()) {
      if (a.kind === "damage" && a.target.kind === "player" && a.info.type === "attack") {
        damage = a.info.amount;
        hits++;
      } else if (a.kind === "gainBlock" && a.target.kind === "monster") {
        if (a.target.idx === idx) block += a.amount;
        else allyBlock += a.amount;
      } else if (a.kind === "applyPower") {
        const target =
          a.target.kind === "player" ? "you" : a.target.kind === "monster" && a.target.idx === idx ? "self" : "ally";
        // the same power queued twice (once per hit, say) reads as one number
        const seen = powers.find((p) => p.powerId === a.powerId && p.target === target);
        if (seen) seen.amount += a.amount;
        else powers.push({ powerId: a.powerId, amount: a.amount, target });
      } else if (a.kind === "makeTempCard") {
        const seen = cards.find((c) => c.defId === a.defId && c.dest === a.dest);
        if (seen) seen.n += a.n;
        else cards.push({ defId: a.defId, n: a.n, dest: a.dest });
      } else if (a.kind === "heal" && a.target.kind === "monster") {
        heal += a.amount;
      } else if (a.kind === "loseHp" && a.target.kind === "player") {
        hpLoss += a.amount;
      } else if (a.kind === "spawnMonster") {
        summons.push(a.monsterId);
      }
    }

    // ...then the powers, healing and HP loss the move already applied
    const addPower = (powerId: string, delta: number, target: IntentPower["target"]): void => {
      if (delta === 0) return;
      const seen = powers.find((p) => p.powerId === powerId && p.target === target);
      if (seen) seen.amount += delta;
      else powers.push({ powerId, amount: delta, target });
    };
    const diff = (before: Map<string, number>, after: { id: string; amount: number }[], target: IntentPower["target"]): void => {
      for (const p of after) addPower(p.id, p.amount - (before.get(p.id) ?? 0), target);
      for (const [id, amount] of before) {
        if (!after.some((p) => p.id === id)) addPower(id, -amount, target);
      }
    };
    diff(playerBefore, combatClone.player.powers, "you");
    combatClone.monsters.forEach((mm, i) => {
      diff(monsterBefore[i] ?? new Map(), mm.powers, i === idx ? "self" : "ally");
      heal += Math.max(0, mm.hp - (monsterHpBefore[i] ?? mm.hp));
    });
    hpLoss += Math.max(0, playerHpBefore - runClone.hp);

    return {
      kind: move.intent,
      moveId: m.move,
      damage,
      hits,
      block,
      allyBlock,
      powers,
      cards,
      heal,
      summons,
      hpLoss,
      partial,
    };
  } catch {
    return fallback; // could not even clone the state: category only, like the game
  }
}

/**
 * UI entry point: intent for every monster slot, computed from a bare
 * GameState (no live RNG needed - the dry-run never rolls).
 */
export function getIntents(
  state: { run: EffectCtx["run"]; combat: EffectCtx["combat"] },
  bundle: ContentBundle,
): (IntentInfo | null)[] {
  if (!state.combat) return [];
  const ctx: EffectCtx = {
    run: state.run,
    combat: state.combat,
    queue: new ActionQueue(),
    bundle,
    rt: { pending: null, currentItem: null, combatOver: null },
    rng: (() => {
      throw new Error("rng not available in intent computation");
    }) as never,
    asc: state.run.ascension,
    emit: () => {},
    requestChoice: () => {
      throw new Error("choice not available in intent computation");
    },
  };
  return state.combat.monsters.map((_, i) => computeIntent(ctx, i));
}
