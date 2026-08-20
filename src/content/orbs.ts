// The Defect's four orbs (exact V2.3.4 behavior). Values audited against
// data/corpus/orbs.json:
//   LIGHTNING passive 3 / evoke 8 (+Focus)  — damage to a random enemy
//                                             (ALL enemies with the Electro power)
//   FROST     passive 2 / evoke 5 (+Focus)  — Block (no Dexterity)
//   DARK      passive 6 (+Focus) growth; evoke deals the stored total (starts at
//             6; Focus modifies the per-turn growth, NOT the initial 6 and NOT
//             the evoke) to the enemy with the lowest HP
//   PLASMA    passive 1 / evoke 2           — Energy; Focus never applies; its
//             passive fires at the START of the turn (engine handles the timing)
//
// Orb damage is NOT an attack: it bypasses Strength/Weak/Vulnerable ("thorns"
// type through the engine's damage application, which skips the attack calc
// pipeline). Lock-On multiplies Lightning/Dark orb damage on the marked enemy
// by 1.5 (int-truncated, i.e. floor for positive amounts) — applied explicitly
// here. Targets are rolled when the damage ACTION resolves (cardRandomRng),
// matching the game's *(OrbPassive)Action timing.

import type { EffectCtx, EffectFn, OrbDef } from "../engine/content/defs";
import type { OrbInstance } from "../engine/combat/combatState";
import { channelOrb, evokeOrb, orbValue } from "../engine/combat/orbRuntime";
import { applyPower, getPower, getPowerAmount } from "../engine/combat/powerRuntime";
import { PLAYER, monster } from "../engine/core/ids";

// ------------------------------------------------------------------------------
// evoke bookkeeping for DARK
// ------------------------------------------------------------------------------
// ENGINE-GAP workaround: the engine's evokeOrb() shifts the orb instance out of
// player.orbs BEFORE calling OrbDef.onEvoke, so a Dark orb cannot read its own
// accumulated amount at evoke time. All content-driven channels/evokes therefore
// go through trackedChannel/trackedEvoke below, which snapshot the about-to-be-
// evoked orb's stored amount into a transient module slot (set and cleared
// synchronously inside a single advance(), never serialized). Engine-raw channel
// actions (Cracked Core / Nuclear Battery / Symbiotic Virus at battle start,
// Frozen Core's empty-slot frost) can never overflow-evoke, so they are safe
// without tracking; the one untracked overflow source (Essence of Darkness
// channeling into full slots) would evoke a grown Dark at its base 6.
let pendingEvokeAmount: number | null = null;

/** Stored amount of the orb currently being evoked (Dark growth), if known. */
function evokingOrbAmount(): number {
  return pendingEvokeAmount ?? 0;
}

/**
 * Channel with evoke tracking + channel tally. Content code (cards, Storm,
 * Static Discharge) must use this instead of raw {kind:"channelOrb"} actions.
 */
export function trackedChannel(ctx: EffectCtx, orbId: string): void {
  ensureChannelTally(ctx);
  const player = ctx.combat!.player;
  const willOverflow = player.orbSlots > 0 && player.orbs.length >= player.orbSlots;
  if (willOverflow) pendingEvokeAmount = player.orbs[0]?.amount ?? null;
  try {
    channelOrb(ctx, orbId);
  } finally {
    pendingEvokeAmount = null;
  }
}

/** Evoke the oldest orb `times` times with Dark-amount tracking. */
export function trackedEvoke(ctx: EffectCtx, times: number): void {
  if (times <= 0) return;
  ensureChannelTally(ctx);
  pendingEvokeAmount = ctx.combat!.player.orbs[0]?.amount ?? null;
  try {
    evokeOrb(ctx, times);
  } finally {
    pendingEvokeAmount = null;
  }
}

// ------------------------------------------------------------------------------
// per-combat channel tally (Blizzard / Thunder Strike)
// ------------------------------------------------------------------------------
// Hidden helper power CHANNEL_TALLY (defined in powers/defect.ts) counts every
// channel via its onChannel hook. Because powers cannot exist at battle start,
// the first content-driven orb operation creates it and seeds the counts from
// the orbs currently in play — battle-start relic channels (Cracked Core etc.)
// are still sitting in the orb row at that point, so they are counted exactly.

export function ensureChannelTally(ctx: EffectCtx): void {
  if (getPower(ctx, PLAYER, "CHANNEL_TALLY")) return;
  applyPower(ctx, PLAYER, PLAYER, "CHANNEL_TALLY", 1);
  const p = getPower(ctx, PLAYER, "CHANNEL_TALLY");
  if (!p) return;
  const counts: Record<string, number> = {};
  for (const orb of ctx.combat!.player.orbs) counts[orb.id] = (counts[orb.id] ?? 0) + 1;
  p.data = { counts };
}

/** Number of `orbId` orbs channeled this combat (creates the tally lazily). */
export function channeledCount(ctx: EffectCtx, orbId: string): number {
  ensureChannelTally(ctx);
  const p = getPower(ctx, PLAYER, "CHANNEL_TALLY");
  const counts = (p?.data?.counts as Record<string, number> | undefined) ?? {};
  return counts[orbId] ?? 0;
}

// ------------------------------------------------------------------------------
// orb damage effects (targets roll at action-resolve time)
// ------------------------------------------------------------------------------

function aliveMonsters(ctx: EffectCtx) {
  return ctx.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped);
}

function randomAliveIdx(ctx: EffectCtx): number | null {
  const alive = aliveMonsters(ctx);
  if (alive.length === 0) return null;
  return alive[ctx.rng("cardRandomRng").random(alive.length - 1)]!.idx;
}

/** Lock-On: Lightning/Dark orb damage x1.5 (int truncation) on the marked enemy. */
function lockOnAdjust(ctx: EffectCtx, idx: number, amount: number): number {
  return getPowerAmount(ctx, monster(idx), "LOCK_ON") > 0 ? Math.floor(amount * 1.5) : amount;
}

function hasElectro(ctx: EffectCtx): boolean {
  return getPower(ctx, PLAYER, "ELECTRO") !== undefined;
}

/** Lightning passive/evoke hit: random enemy, or ALL enemies with Electro. */
function lightningHit(ctx: EffectCtx, args: unknown): void {
  const { amount } = args as { amount: number };
  if (hasElectro(ctx)) {
    const amounts = ctx.combat!.monsters.map((m) => lockOnAdjust(ctx, m.idx, amount));
    ctx.queue.addToTop({ kind: "damageAllMonsters", amounts, info: { type: "thorns", source: PLAYER } });
    return;
  }
  const idx = randomAliveIdx(ctx);
  if (idx === null) return;
  ctx.queue.addToTop({
    kind: "damage",
    target: monster(idx),
    info: { type: "thorns", source: PLAYER, amount: lockOnAdjust(ctx, idx, amount) },
  });
}

/** Dark evoke: stored damage to the enemy with the lowest HP (first on ties). */
function darkEvokeHit(ctx: EffectCtx, args: unknown): void {
  const { amount } = args as { amount: number };
  let best: { idx: number; hp: number } | null = null;
  for (const m of aliveMonsters(ctx)) {
    if (best === null || m.hp < best.hp) best = { idx: m.idx, hp: m.hp };
  }
  if (best === null) return;
  ctx.queue.addToTop({
    kind: "damage",
    target: monster(best.idx),
    info: { type: "thorns", source: PLAYER, amount: lockOnAdjust(ctx, best.idx, amount) },
  });
}

export const orbEffects: Map<string, EffectFn> = new Map<string, EffectFn>([
  ["orb/lightningHit", lightningHit],
  ["orb/darkEvokeHit", darkEvokeHit],
]);

// ------------------------------------------------------------------------------
// orb definitions
// ------------------------------------------------------------------------------

const LIGHTNING: OrbDef = {
  id: "LIGHTNING",
  name: "Lightning",
  passiveBase: 3,
  evokeBase: 8,
  usesFocus: true,
  onPassive(ctx, slotIdx) {
    const orb = ctx.combat!.player.orbs[slotIdx];
    if (!orb) return;
    const amount = orbValue(ctx, orb, "passive");
    ctx.queue.addToBottom({ kind: "effect", ref: "orb/lightningHit", args: { amount } });
  },
  onEvoke(ctx) {
    // the orb is already off the row; evoke value = base + Focus (floored at 0)
    const stub: OrbInstance = { id: "LIGHTNING", amount: 0 };
    const amount = orbValue(ctx, stub, "evoke");
    ctx.queue.addToBottom({ kind: "effect", ref: "orb/lightningHit", args: { amount } });
  },
};

const FROST: OrbDef = {
  id: "FROST",
  name: "Frost",
  passiveBase: 2,
  evokeBase: 5,
  usesFocus: true,
  onPassive(ctx, slotIdx) {
    const orb = ctx.combat!.player.orbs[slotIdx];
    if (!orb) return;
    // plain block gain: orb block ignores Dexterity/Frail (fromCard false)
    ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: orbValue(ctx, orb, "passive"), fromCard: false });
  },
  onEvoke(ctx) {
    const stub: OrbInstance = { id: "FROST", amount: 0 };
    ctx.queue.addToBottom({ kind: "gainBlock", target: PLAYER, amount: orbValue(ctx, stub, "evoke"), fromCard: false });
  },
};

const DARK: OrbDef = {
  id: "DARK",
  name: "Dark",
  passiveBase: 6,
  evokeBase: 6,
  usesFocus: true, // Focus applies to the per-turn GROWTH only (orbValue "passive")
  onPassive(ctx, slotIdx) {
    // grow the stored evoke damage by 6 + Focus (floored at 0); no queue action
    const orb = ctx.combat!.player.orbs[slotIdx];
    if (!orb || orb.id !== "DARK") return;
    orb.amount += orbValue(ctx, orb, "passive");
    ctx.emit("darkOrbGrew", { slotIdx, amount: orb.amount });
  },
  onEvoke(ctx) {
    // stored total = initial 6 (never Focus-modified) + accumulated growth.
    // orb.amount holds the growth; the evoked instance was snapshot by
    // trackedChannel/trackedEvoke (see pendingEvokeAmount above).
    const amount = 6 + evokingOrbAmount();
    ctx.queue.addToBottom({ kind: "effect", ref: "orb/darkEvokeHit", args: { amount } });
  },
};

const PLASMA: OrbDef = {
  id: "PLASMA",
  name: "Plasma",
  passiveBase: 1,
  evokeBase: 2,
  usesFocus: false, // Focus never applies to Plasma
  onPassive(ctx) {
    // the engine calls PLASMA passives at the START of the player's turn
    ctx.queue.addToBottom({ kind: "gainEnergy", n: 1 });
  },
  onEvoke(ctx) {
    ctx.queue.addToBottom({ kind: "gainEnergy", n: 2 });
  },
};

export const allOrbs: OrbDef[] = [LIGHTNING, FROST, DARK, PLASMA];
