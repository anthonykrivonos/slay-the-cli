// Shared helpers for the relics & potions workstream.
//
// Conventions:
//  - Relic/potion damage uses DamageInfo type "thorns" with source null (the
//    game's THORNS damage type): no Strength/Vulnerable scaling, no Curl Up /
//    Thorns retaliation, block still absorbs. Matches Fire Potion, Mercury
//    Hourglass, Letter Opener, Charon's Ashes, Stone Calendar.
//  - Victory-time heals mutate directly through healPlayer(): checkVictory sets
//    combatOver right after firing onVictory, which halts the interpreter loop,
//    so queued heal actions would never execute.
//  - Choice continuations are registered lazily into ctx.bundle.effects via
//    ensureContentEffects() (idempotent) AND exported as `contentEffects` so the
//    bundle assembler can merge them statically (required for save/resume across
//    processes).

import type { CardDef, EffectCtx, EffectFn } from "../../engine/content/defs";
import type { CardInstance, Pile } from "../../engine/combat/combatState";
import type { CharacterId } from "../../engine/core/ids";
import type { HookCtx } from "../../engine/core/hooks";
import { foldHook, fireHook } from "../../engine/core/hooks";
import { PLAYER, monster } from "../../engine/core/ids";
import { makeTempCard } from "../../engine/combat/interpreter";
import { moveCard } from "../../engine/combat/piles";

/** Relic counter accessor shorthand (relic hooks always receive one). */
export const cnt = (ctx: HookCtx) => ctx.relicCounter!;

export function aliveMonsterIdxs(ctx: EffectCtx): number[] {
  return ctx.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped).map((m) => m.idx);
}

/** Enqueue relic/potion damage to one monster slot (THORNS-type, no attacker). */
export function relicDamage(ctx: EffectCtx, idx: number, amount: number): void {
  ctx.queue.addToBottom({
    kind: "damage",
    target: monster(idx),
    info: { type: "thorns", source: null, amount },
  });
}

/** Enqueue relic/potion damage to ALL enemies (THORNS-type, no attacker). */
export function relicDamageAll(ctx: EffectCtx, amount: number): void {
  ctx.queue.addToBottom({
    kind: "damageAllMonsters",
    amounts: ctx.combat!.monsters.map(() => amount),
    info: { type: "thorns", source: null },
  });
}

/**
 * Direct player heal mirroring the interpreter's heal path (onHeal fold, floor,
 * clamp, onNotBloodied). Needed wherever queued actions would not drain
 * (onVictory) and for out-of-combat healing.
 */
export function healPlayer(ctx: EffectCtx, amount: number): void {
  const healed = Math.floor(foldHook(ctx, PLAYER, "onHeal", amount));
  const was = ctx.run.hp;
  ctx.run.hp = Math.min(ctx.run.maxHp, ctx.run.hp + healed);
  if (was <= ctx.run.maxHp / 2 && ctx.run.hp > ctx.run.maxHp / 2) fireHook(ctx, PLAYER, "onNotBloodied");
}

/** Gold gain folded through onGainGold (Ectoplasm zeroes it, Bloody Idol heals). */
export function gainGold(ctx: EffectCtx, amount: number): void {
  const n = Math.floor(foldHook(ctx, PLAYER, "onGainGold", amount));
  if (n > 0) ctx.run.gold += n;
}

export function charColor(character: CharacterId): "red" | "green" | "blue" | "purple" {
  switch (character) {
    case "IRONCLAD":
      return "red";
    case "SILENT":
      return "green";
    case "DEFECT":
      return "blue";
    case "WATCHER":
      return "purple";
  }
}

/** Keyword set effective for this instance (upgrade may change keywords). */
export function effectiveKeywords(def: CardDef, c: CardInstance): string[] {
  return c.upgrades > 0 && def.upgradeKeywords ? def.upgradeKeywords : def.keywords;
}

/**
 * The character's obtainable in-combat pool (Dead Branch, Enchiridion,
 * Attack/Skill/Power potions): class color, common/uncommon/rare, real cards.
 * DEPENDS: result quality scales with how much of the card pool has landed.
 */
export function classPoolFilter(ctx: EffectCtx, type?: "attack" | "skill" | "power"): (d: CardDef) => boolean {
  const color = charColor(ctx.run.character);
  return (d) =>
    d.color === color &&
    (type ? d.type === type : d.type === "attack" || d.type === "skill" || d.type === "power") &&
    (d.rarity === "common" || d.rarity === "uncommon" || d.rarity === "rare");
}

/** Colorless obtainable pool (Toolbox, Colorless Potion). DEPENDS: colorless cards. */
export function colorlessPoolFilter(): (d: CardDef) => boolean {
  return (d) => d.color === "colorless" && (d.rarity === "uncommon" || d.rarity === "rare");
}

/**
 * n DISTINCT random card defs from the bundle pool via cardRandomRng.
 * Pool order = bundle insertion order (deterministic per bundle assembly).
 */
export function randomCardDefs(ctx: EffectCtx, n: number, pred: (d: CardDef) => boolean): CardDef[] {
  const pool = [...ctx.bundle.cards.values()].filter(pred);
  const out: CardDef[] = [];
  const rng = ctx.rng("cardRandomRng");
  while (out.length < n && pool.length > 0) {
    const idx = rng.random(pool.length - 1);
    out.push(pool.splice(idx, 1)[0]!);
  }
  return out;
}

/** Create a temp card immediately and return its instance (engine helper returns void). */
export function makeCardInstance(ctx: EffectCtx, defId: string, upgrades: number, dest: Pile): CardInstance | null {
  const iid = ctx.combat!.nextCardInstanceId;
  makeTempCard(ctx, defId, upgrades, dest);
  return ctx.combat!.cards[iid] ?? null;
}

/** Can this instance be upgraded in combat (Warped Tongs / Blessing of the Forge)? */
export function canUpgradeInCombat(ctx: EffectCtx, c: CardInstance): boolean {
  const def = ctx.bundle.cards.get(c.defId);
  if (!def) return false;
  if (def.type === "curse" || def.type === "status") return false;
  return c.upgrades === 0 || def.keywords.includes("multiUpgrade");
}

/** Upgrade an in-combat instance for the rest of combat (values resolve via upgrades>0). */
export function upgradeInCombat(ctx: EffectCtx, c: CardInstance): void {
  const def = ctx.bundle.cards.get(c.defId);
  if (!def) return;
  c.upgrades++;
  if (def.upgradeValues.cost !== undefined && c.upgrades === 1) {
    const newCost = def.upgradeValues.cost;
    c.costForTurn = Math.min(c.costForTurn, newCost);
    c.cost = newCost;
  }
}

// ------------------------------------------------------------------------------
// Registered continuations for choice-based relics/potions.
// `chosen` is the index array into the request's iids/options list.
// ------------------------------------------------------------------------------

const exhaustChosen: EffectFn = (ctx, args) => {
  const { iids, chosen } = args as { iids: number[]; chosen: number[] };
  for (const i of chosen) {
    const iid = iids[i];
    if (iid !== undefined) ctx.queue.addToBottom({ kind: "exhaust", sel: { kind: "iid", iid } });
  }
};

// Adjudication: these discards are not "manual" (the game's GamblingChipAction
// moves cards directly without firing discard triggers).
const discardChosenThenDraw: EffectFn = (ctx, args) => {
  const { iids, chosen } = args as { iids: number[]; chosen: number[] };
  let n = 0;
  for (const i of chosen) {
    const iid = iids[i];
    if (iid !== undefined) {
      ctx.queue.addToBottom({ kind: "discard", sel: { kind: "iid", iid }, manual: false });
      n++;
    }
  }
  if (n > 0) ctx.queue.addToBottom({ kind: "draw", n });
};

const returnChosenToHandFree: EffectFn = (ctx, args) => {
  const { iids, chosen } = args as { iids: number[]; chosen: number[] };
  for (const i of chosen) {
    const iid = iids[i];
    if (iid === undefined) continue;
    if (ctx.combat!.player.piles.hand.length >= 10) break; // hand full: remaining stay put
    moveCard(ctx, iid, "hand");
    const c = ctx.combat!.cards[iid];
    if (c) c.costForTurn = 0;
  }
};

const stanceChosen: EffectFn = (ctx, args) => {
  const { stances, chosen } = args as { stances: string[]; chosen: number[] };
  const s = stances[chosen[0] ?? 0];
  if (s) ctx.queue.addToBottom({ kind: "changeStance", stanceId: s });
};

const addChosenCardToHand: EffectFn = (ctx, args) => {
  const { defIds, copies, costZero, chosen } = args as {
    defIds: string[];
    copies: number;
    costZero: boolean;
    chosen: number[];
  };
  const defId = defIds[chosen[0] ?? 0]; // "Skip" option indexes past defIds -> undefined
  if (!defId) return;
  for (let k = 0; k < copies; k++) {
    const c = makeCardInstance(ctx, defId, 0, "hand");
    if (c && costZero) c.costForTurn = 0;
  }
};

const shuffleChosenIntoDraw: EffectFn = (ctx, args) => {
  const { defIds, chosen } = args as { defIds: string[]; chosen: number[] };
  const defId = defIds[chosen[0] ?? 0];
  if (!defId) return; // "Skip"
  ctx.queue.addToBottom({ kind: "makeTempCard", defId, upgrades: 0, dest: "draw", n: 1 });
};

export const contentEffects: ReadonlyArray<readonly [string, EffectFn]> = [
  ["content:exhaustChosen", exhaustChosen],
  ["content:discardChosenThenDraw", discardChosenThenDraw],
  ["content:returnChosenToHandFree", returnChosenToHandFree],
  ["content:stanceChosen", stanceChosen],
  ["content:addChosenCardToHand", addChosenCardToHand],
  ["content:shuffleChosenIntoDraw", shuffleChosenIntoDraw],
];

/** Lazily register the continuations into the live bundle (idempotent). */
export function ensureContentEffects(ctx: EffectCtx): void {
  for (const [id, fn] of contentEffects) {
    if (!ctx.bundle.effects.has(id)) ctx.bundle.effects.set(id, fn);
  }
}

/** Enqueue a "pick 1 of N generated cards" choice (Discovery-style). */
export function requestCardPick(
  ctx: EffectCtx,
  opts: {
    defIds: string[];
    copies: number;
    costZero: boolean;
    reason: string;
    skippable?: boolean;
    dest: "hand" | "draw";
  },
): void {
  if (opts.defIds.length === 0) return; // pool empty (DEPENDS on landed card pool)
  ensureContentEffects(ctx);
  const names = opts.defIds.map((id) => ctx.bundle.cards.get(id)?.name ?? id);
  const options = opts.skippable ? [...names, "Skip"] : names;
  ctx.queue.addToBottom({
    kind: "choice",
    request: { kind: "option", options, reason: opts.reason },
    resume: opts.dest === "hand" ? "content:addChosenCardToHand" : "content:shuffleChosenIntoDraw",
    resumeArgs: { defIds: opts.defIds, copies: opts.copies, costZero: opts.costZero },
  });
}
