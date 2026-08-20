// The hook vocabulary and THE single source of trigger ordering.
//
// Ordering rules (mirroring the game):
//   Player-side sites: player powers in application order -> stance -> relics
//   in obtain order. Monster-side sites: that monster's powers in application
//   order. Value-modifying hooks fold left through the same order.
//
// Every engine call site fires hooks through the functions at the bottom of
// this file — never by iterating powers/relics itself.

import type { ActorRef, CardId } from "./ids";
import type { CardInstance, MonsterState, PowerInstance } from "../combat/combatState";
import type { DamageInfo } from "./actions";
import type { EffectCtx } from "../content/defs";

/** Context passed to hooks; `self` identifies the power instance / relic firing. */
export interface HookCtx extends EffectCtx {
  /** actor owning the firing hook */
  owner: ActorRef;
  /** the power instance firing (undefined for relic/stance hooks) */
  power?: PowerInstance;
  /** relic counter accessor (undefined for power/stance hooks) */
  relicCounter?: { get(): number; set(n: number): void };
}

export interface Hooks {
  // --- turn structure ---
  atBattleStartPreDraw?(ctx: HookCtx): void;
  atBattleStart?(ctx: HookCtx): void;
  atStartOfTurn?(ctx: HookCtx): void; // pre-draw
  atStartOfTurnPostDraw?(ctx: HookCtx): void;
  /** fold: how much block survives the start of the player's turn (default 0; Barricade all, Calipers -15) */
  modifyBlockRetention?(ctx: HookCtx, block: number): number;
  /** any source returning true keeps unspent energy across turns (Ice Cream, Conserve) */
  retainsEnergy?(ctx: HookCtx): boolean;
  /** fold: cards drawn at start of turn (base 5; Snecko Eye +2) */
  modifyDrawPerTurn?(ctx: HookCtx, n: number): number;
  /** any source returning true skips the end-of-turn hand discard (Runic Pyramid) */
  retainsHand?(ctx: HookCtx): boolean;
  atEndOfTurnPreEndOfTurnCards?(ctx: HookCtx): void; // before Burn/Regret self-triggers
  atEndOfTurn?(ctx: HookCtx, isPlayerTurn: boolean): void;
  atEndOfRound?(ctx: HookCtx): void; // duration ticks happen here
  onEnergyRecharge?(ctx: HookCtx): void;
  // --- card lifecycle ---
  canPlayCard?(ctx: HookCtx, card: CardInstance): boolean; // Velvet Choker, Normality, Entangled
  /** fold: (ctx, cost, card) — value-first like all fold hooks */
  modifyCardCost?(ctx: HookCtx, cost: number, card: CardInstance): number; // Corruption
  onUseCard?(ctx: HookCtx, card: CardInstance, target: number | null): void; // during resolution
  onAfterCardPlayed?(ctx: HookCtx, card: CardInstance): void; // Time Eater counter site
  onDraw?(ctx: HookCtx, card: CardInstance): void; // Confused rolls, Void
  onManualDiscard?(ctx: HookCtx, card: CardInstance): void; // Tingsha, Tough Bandages
  onEndOfTurnDiscard?(ctx: HookCtx, card: CardInstance): void;
  onExhaust?(ctx: HookCtx, card: CardInstance): void; // Dead Branch, Feel No Pain, Dark Embrace
  onShuffle?(ctx: HookCtx): void; // Sundial, The Abacus
  onScry?(ctx: HookCtx, n: number): void; // Nirvana
  onRetain?(ctx: HookCtx, card: CardInstance): void;
  // --- damage pipeline (value-modifying; float32 discipline at call sites) ---
  atDamageGive?(ctx: HookCtx, damage: number, type: "attack", card: CardInstance | null): number;
  atDamageFinalGive?(ctx: HookCtx, damage: number, type: "attack"): number;
  atDamageReceive?(ctx: HookCtx, damage: number, type: "attack"): number;
  atDamageFinalReceive?(ctx: HookCtx, damage: number, type: "attack"): number;
  /** post-block, pre-HP-loss adjustment (Torii, Tungsten Rod via onLoseHp) */
  onAttackedToChangeDamage?(ctx: HookCtx, info: DamageInfo, damage: number): number;
  onAttack?(ctx: HookCtx, target: ActorRef, info: DamageInfo, unblocked: number): void;
  onAttacked?(ctx: HookCtx, info: DamageInfo, damageTaken: number): void; // Flame Barrier, Thorns
  onLoseHp?(ctx: HookCtx, amount: number): number; // Tungsten Rod / Intangible clamp handled at site
  wasHPLost?(ctx: HookCtx, info: DamageInfo, amount: number): void; // Rupture, Centennial Puzzle
  // --- block ---
  modifyBlock?(ctx: HookCtx, block: number, card: CardInstance | null): number; // Dex, Frail
  onGainedBlock?(ctx: HookCtx, amount: number): void; // Juggernaut
  // --- powers ---
  onApplyPower?(ctx: HookCtx, powerId: string, target: ActorRef, source: ActorRef | null): boolean | void; // Artifact veto (return false)
  /** fold: upgrade count for cards created mid-combat (Master Reality -> max(n,1)) */
  modifyCreatedCardUpgrades?(ctx: HookCtx, upgrades: number, defId: CardId): number;
  onSpecificTrigger?(ctx: HookCtx): void;
  // --- life & death ---
  onHeal?(ctx: HookCtx, amount: number): number; // Magic Flower, Mark of the Bloom
  onMonsterDeath?(ctx: HookCtx, m: MonsterState): void; // Gremlin Horn, Corpse Explosion
  onVictory?(ctx: HookCtx): void; // Burning Blood, Meat on the Bone
  onBloodied?(ctx: HookCtx): void; // Red Skull (<=50%)
  onNotBloodied?(ctx: HookCtx): void;
  // --- defect ---
  onChannel?(ctx: HookCtx, orbId: string): void; // Storm counting via power
  onEvoke?(ctx: HookCtx, orbId: string): void;
  modifyFocus?(ctx: HookCtx, focus: number): number;
  // --- watcher ---
  onChangeStance?(ctx: HookCtx, from: string, to: string): void; // Mental Fortress, Rushdown
  // --- run-level (relics only) ---
  onGainGold?(ctx: HookCtx, amount: number): number;
  onObtainCard?(ctx: HookCtx, defId: CardId): boolean | void; // Omamori veto for curses
  onEnterRoom?(ctx: HookCtx, roomKind: string): void;
  onEnterRestSite?(ctx: HookCtx): void;
  onRest?(ctx: HookCtx): void;
  onSmith?(ctx: HookCtx): void;
  onChestOpen?(ctx: HookCtx, isBossChest: boolean): void;
  onUsePotion?(ctx: HookCtx): void; // Toy Ornithopter
  modifyRewards?(ctx: HookCtx, rewards: unknown): void; // Question Card, Busted Crown
  modifyPrice?(ctx: HookCtx, basePrice: number): number; // Membership Card, Courier
}

export type HookName = keyof Hooks;

// ------------------------------------------------------------------------------
// Firing helpers. These encode order; call sites never iterate sources directly.
// ------------------------------------------------------------------------------

import type { ContentBundle } from "../content/defs";

interface HookSource {
  hooks: Hooks;
  hookCtx: HookCtx;
}

/** Collect a player's hook sources in canonical order: powers -> stance -> relics. */
function playerSources(ctx: EffectCtx): HookSource[] {
  const out: HookSource[] = [];
  const combat = ctx.combat;
  if (combat) {
    for (const p of combat.player.powers) {
      const def = ctx.bundle.powers.get(p.id);
      if (def) out.push({ hooks: def.hooks, hookCtx: { ...ctx, owner: { kind: "player" }, power: p } });
    }
    const stanceDef = ctx.bundle.stances.get(combat.player.stance);
    if (stanceDef) {
      // stances expose enter/exit/multipliers, not general hooks — placeholder for parity
    }
  }
  for (const r of ctx.run.relics) {
    const def = ctx.bundle.relics.get(r.defId);
    if (def)
      out.push({
        hooks: def.hooks,
        hookCtx: {
          ...ctx,
          owner: { kind: "player" },
          relicCounter: { get: () => r.counter, set: (n: number) => (r.counter = n) },
        },
      });
  }
  return out;
}

function monsterSources(ctx: EffectCtx, idx: number): HookSource[] {
  const out: HookSource[] = [];
  const m = ctx.combat?.monsters[idx];
  if (!m) return out;
  for (const p of m.powers) {
    const def = ctx.bundle.powers.get(p.id);
    if (def) out.push({ hooks: def.hooks, hookCtx: { ...ctx, owner: { kind: "monster", idx }, power: p } });
  }
  return out;
}

function sourcesFor(ctx: EffectCtx, actor: ActorRef): HookSource[] {
  return actor.kind === "player" ? playerSources(ctx) : monsterSources(ctx, actor.idx);
}

/** Player relic sources only, in obtain order (damage staging folds these separately). */
function relicSources(ctx: EffectCtx): HookSource[] {
  const out: HookSource[] = [];
  for (const r of ctx.run.relics) {
    const def = ctx.bundle.relics.get(r.defId);
    if (def)
      out.push({
        hooks: def.hooks,
        hookCtx: {
          ...ctx,
          owner: { kind: "player" },
          relicCounter: { get: () => r.counter, set: (n: number) => (r.counter = n) },
        },
      });
  }
  return out;
}

/** Power sources only (application order) for either actor. */
function powerSources(ctx: EffectCtx, actor: ActorRef): HookSource[] {
  const powers =
    actor.kind === "player" ? (ctx.combat?.player.powers ?? []) : (ctx.combat?.monsters[actor.idx]?.powers ?? []);
  const out: HookSource[] = [];
  for (const p of powers) {
    const def = ctx.bundle.powers.get(p.id);
    if (def) out.push({ hooks: def.hooks, hookCtx: { ...ctx, owner: actor, power: p } });
  }
  return out;
}

type SourceScope = "all" | "powers" | "relics";

function scopedSources(ctx: EffectCtx, actor: ActorRef, scope: SourceScope): HookSource[] {
  if (scope === "powers") return powerSources(ctx, actor);
  if (scope === "relics") return actor.kind === "player" ? relicSources(ctx) : [];
  return sourcesFor(ctx, actor);
}

/** Fire a void hook on an actor's sources in canonical order. */
export function fireHook<K extends HookName>(
  ctx: EffectCtx,
  actor: ActorRef,
  name: K,
  ...args: unknown[]
): void {
  for (const src of sourcesFor(ctx, actor)) {
    const fn = src.hooks[name] as ((...a: unknown[]) => unknown) | undefined;
    if (fn) fn(src.hookCtx, ...args);
  }
}

/** Fold a numeric value through a value-modifying hook chain. */
export function foldHook<K extends HookName>(
  ctx: EffectCtx,
  actor: ActorRef,
  name: K,
  value: number,
  ...args: unknown[]
): number {
  return foldHookScoped(ctx, actor, "all", name, value, ...args);
}

/** Fold restricted to powers-only or relics-only (damage pipeline staging). */
export function foldHookScoped<K extends HookName>(
  ctx: EffectCtx,
  actor: ActorRef,
  scope: SourceScope,
  name: K,
  value: number,
  ...args: unknown[]
): number {
  let v = value;
  for (const src of scopedSources(ctx, actor, scope)) {
    const fn = src.hooks[name] as ((...a: unknown[]) => number) | undefined;
    if (fn) v = fn(src.hookCtx, v, ...args);
  }
  return v;
}

/** true if any source's hook returns true (Runic Pyramid / Ice Cream style). */
export function anyHook<K extends HookName>(
  ctx: EffectCtx,
  actor: ActorRef,
  name: K,
  ...args: unknown[]
): boolean {
  for (const src of sourcesFor(ctx, actor)) {
    const fn = src.hooks[name] as ((...a: unknown[]) => unknown) | undefined;
    if (fn && fn(src.hookCtx, ...args) === true) return true;
  }
  return false;
}

/** true unless any source vetoes (returns false). */
export function vetoHook<K extends HookName>(
  ctx: EffectCtx,
  actor: ActorRef,
  name: K,
  ...args: unknown[]
): boolean {
  for (const src of sourcesFor(ctx, actor)) {
    const fn = src.hooks[name] as ((...a: unknown[]) => unknown) | undefined;
    if (fn && fn(src.hookCtx, ...args) === false) return false;
  }
  return true;
}
