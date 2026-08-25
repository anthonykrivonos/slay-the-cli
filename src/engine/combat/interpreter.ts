// The combat interpreter: executes GameActions synchronously, drains the card
// queue between actions (GameActionManager semantics), and owns the turn flow.
// Execution halts when a PendingChoice is requested or combat ends; the queue
// is empty at every player-input point by construction.

import type { EffectCtx, CardCtx, ContentBundle } from "../content/defs";
import type { GameAction, DamageInfo, CardSelector } from "../core/actions";
import type { CardInstance, CardQueueItem, MonsterState, Pile } from "./combatState";
import { fireHook, foldHook, foldHookScoped, anyHook } from "../core/hooks";
import { PLAYER, monster, type ActorRef } from "../core/ids";
import { applyPower, reducePower, removePower, getPowerAmount, tickTurnBasedPowers } from "./powerRuntime";
import { calcMonsterBlock } from "./damageCalc";
import { card, drawCards, moveCard, pileOf, reshuffleDiscardIntoDraw, shuffleDrawPile } from "./piles";
import { channelOrb, evokeOrb, changeOrbSlots, triggerEndOfTurnOrbs, triggerStartOfTurnOrbs } from "./orbRuntime";
import { changeStance, gainMantra, stanceAtEndOfTurn } from "./stanceRuntime";

const ITERATION_CAP = 20000; // infinite-combo guard (Dead Branch + Corruption loops)

// ------------------------------------------------------------------------------
// main loop
// ------------------------------------------------------------------------------

export function runQueue(ctx: EffectCtx): void {
  let iterations = 0;
  for (;;) {
    // defeat and pending choices halt immediately; VICTORY keeps draining the
    // action queue (the game finishes in-flight actions - Feed/Reaper resolve)
    // but pulls no further card plays.
    if (ctx.rt.pending || ctx.rt.combatOver === "defeat") return;
    if (++iterations > ITERATION_CAP) {
      throw new Error(`interpreter iteration cap exceeded - likely infinite combo loop`);
    }
    const action = ctx.queue.pop();
    if (action) {
      executeAction(ctx, action);
      continue;
    }
    if (ctx.rt.combatOver) return; // victory + queue drained
    // action queue empty: drain next card play
    const item = ctx.combat!.cardQueue.shift();
    if (item) {
      resolveCardPlay(ctx, item);
      continue;
    }
    return; // both queues empty: player input point
  }
}

// ------------------------------------------------------------------------------
// action execution
// ------------------------------------------------------------------------------

export function executeAction(ctx: EffectCtx, a: GameAction): void {
  switch (a.kind) {
    case "damage":
      applyDamage(ctx, a.target, a.info);
      break;
    case "damageAllMonsters": {
      for (let i = 0; i < ctx.combat!.monsters.length; i++) {
        const amount = a.amounts[i] ?? a.amounts[0] ?? 0;
        applyDamage(ctx, monster(i), { ...a.info, amount });
      }
      break;
    }
    case "loseHp":
      applyHpLoss(ctx, a.target, a.amount);
      break;
    case "heal":
      applyHeal(ctx, a.target, a.amount);
      break;
    case "gainBlock":
      applyBlockGain(ctx, a.target, a.amount, a.fromCard);
      break;
    case "applyPower":
      applyPower(ctx, a.source, a.target, a.powerId, a.amount);
      break;
    case "reducePower":
      reducePower(ctx, a.target, a.powerId, a.amount);
      break;
    case "removePower":
      removePower(ctx, a.target, a.powerId);
      break;
    case "draw":
      drawCards(ctx, a.n);
      break;
    case "discard":
      for (const iid of selectCards(ctx, a.sel)) discardCard(ctx, iid, a.manual);
      break;
    case "exhaust":
      for (const iid of selectCards(ctx, a.sel)) exhaustCard(ctx, iid);
      break;
    case "moveCard":
      moveCard(ctx, a.iid, a.to, a.position ?? "top");
      break;
    case "makeTempCard":
      for (let i = 0; i < a.n; i++) makeTempCard(ctx, a.defId, a.upgrades, a.dest);
      break;
    case "shuffleDiscardIntoDraw":
      reshuffleDiscardIntoDraw(ctx);
      break;
    case "emptyHandToDiscardEndOfTurn":
      endOfTurnDiscard(ctx);
      break;
    case "gainEnergy":
      ctx.combat!.player.energy += a.n;
      break;
    case "loseEnergy":
      ctx.combat!.player.energy = Math.max(0, ctx.combat!.player.energy - a.n);
      break;
    case "channelOrb":
      channelOrb(ctx, a.orbId);
      break;
    case "evokeOrb":
      evokeOrb(ctx, a.times);
      break;
    case "changeOrbSlots":
      changeOrbSlots(ctx, a.delta);
      break;
    case "changeStance":
      changeStance(ctx, a.stanceId);
      break;
    case "gainMantra":
      gainMantra(ctx, a.n);
      break;
    case "scry":
      startScry(ctx, a.n);
      break;
    case "startPlayerTurn":
      startPlayerTurn(ctx);
      break;
    case "endPlayerTurn":
      onTurnEnding(ctx);
      break;
    case "monsterTurn":
      monsterTurn(ctx);
      break;
    case "endRound":
      endRound(ctx);
      break;
    case "spawnMonster":
      spawnMonster(ctx, a.monsterId, a.slot, a.hp, a.rollFirstMove);
      break;
    case "monsterEscape": {
      const m = ctx.combat!.monsters[a.idx];
      if (m && !m.isDead) {
        m.isEscaped = true;
        ctx.emit("monsterEscaped", { idx: a.idx });
        checkVictory(ctx);
      }
      break;
    }
    case "useCard":
      break; // drain marker handled by main loop
    case "monsterMove":
      executeMonsterMove(ctx, a.idx);
      break;
    case "effect": {
      const fn = ctx.bundle.effects.get(a.ref);
      if (!fn) throw new Error(`unknown effect ref: ${a.ref}`);
      fn(ctx, a.args);
      break;
    }
    case "choice":
      // choices are moot once combat has resolved (victory drain keeps executing
      // queued actions; a dead fight must never leave a pending pick behind)
      if (!ctx.rt.combatOver) {
        ctx.requestChoice({ request: a.request, resume: a.resume, resumeArgs: a.resumeArgs });
      }
      break;
  }
}

// ------------------------------------------------------------------------------
// damage / hp / block application
// ------------------------------------------------------------------------------

function applyDamage(ctx: EffectCtx, target: ActorRef, info: DamageInfo): void {
  let d = info.amount;

  if (target.kind === "monster") {
    const m = ctx.combat!.monsters[target.idx];
    if (!m || m.isDead || m.isEscaped) return;
    if (info.type !== "hpLoss" && m.block > 0) {
      const blocked = Math.min(m.block, d);
      m.block -= blocked;
      d -= blocked;
    }
    d = foldHookScoped(ctx, target, "powers", "onAttackedToChangeDamage", d, info);
    d = Math.max(0, Math.floor(foldHookScoped(ctx, target, "powers", "onLoseHp", d))); // Invincible cap
    if (d > 0) {
      m.hp = Math.max(0, m.hp - d);
      fireHook(ctx, target, "wasHPLost", info, d);
    }
    fireHook(ctx, target, "onAttacked", info, d);
    if (info.source?.kind === "player") fireHook(ctx, PLAYER, "onAttack", target, info, d);
    ctx.emit("damaged", { target, amount: d });
    if (m.hp <= 0 && !m.isDead) monsterDeath(ctx, m);
    return;
  }

  // player target
  if (info.type !== "hpLoss" && ctx.combat!.player.block > 0) {
    const blocked = Math.min(ctx.combat!.player.block, d);
    ctx.combat!.player.block -= blocked;
    d -= blocked;
  }
  d = foldHook(ctx, PLAYER, "onAttackedToChangeDamage", d, info); // powers then relics (Torii)
  d = foldHook(ctx, PLAYER, "onLoseHp", d); // Tungsten Rod
  if (d > 0) {
    ctx.run.hp = Math.max(0, ctx.run.hp - d);
    ctx.combat!.combatFlags.hpLostThisCombat += d;
    fireHook(ctx, PLAYER, "wasHPLost", info, d);
    checkBloodied(ctx);
  }
  fireHook(ctx, PLAYER, "onAttacked", info, d);
  if (info.source?.kind === "monster") fireHook(ctx, info.source, "onAttack", PLAYER, info, d);
  ctx.emit("damaged", { target, amount: d });
  if (ctx.run.hp <= 0) playerDeath(ctx);
}

function applyHpLoss(ctx: EffectCtx, target: ActorRef, amount: number): void {
  // direct HP loss (Offering, Bloodletting, poison): bypasses block AND the damage pipeline
  if (target.kind === "monster") {
    const m = ctx.combat!.monsters[target.idx];
    if (!m || m.isDead) return;
    const d = Math.max(0, Math.floor(foldHookScoped(ctx, target, "powers", "onLoseHp", amount))); // Invincible cap
    m.hp = Math.max(0, m.hp - d);
    if (d > 0) fireHook(ctx, target, "wasHPLost", { type: "hpLoss", source: null, amount: d }, d);
    if (m.hp <= 0) monsterDeath(ctx, m);
    return;
  }
  const d = foldHook(ctx, PLAYER, "onLoseHp", amount);
  if (d <= 0) return;
  ctx.run.hp = Math.max(0, ctx.run.hp - d);
  ctx.combat!.combatFlags.hpLostThisCombat += d;
  fireHook(ctx, PLAYER, "wasHPLost", { type: "hpLoss", source: null, amount: d }, d);
  checkBloodied(ctx);
  if (ctx.run.hp <= 0) playerDeath(ctx);
}

function applyHeal(ctx: EffectCtx, target: ActorRef, amount: number): void {
  if (target.kind === "monster") {
    const m = ctx.combat!.monsters[target.idx];
    if (!m || m.isDead) return;
    m.hp = Math.min(m.maxHp, m.hp + amount);
    return;
  }
  const healed = Math.floor(foldHook(ctx, PLAYER, "onHeal", amount));
  const was = ctx.run.hp;
  ctx.run.hp = Math.min(ctx.run.maxHp, ctx.run.hp + healed);
  if (was <= ctx.run.maxHp / 2 && ctx.run.hp > ctx.run.maxHp / 2) fireHook(ctx, PLAYER, "onNotBloodied");
}

function applyBlockGain(ctx: EffectCtx, target: ActorRef, amount: number, fromCard: boolean): void {
  if (target.kind === "monster") {
    const m = ctx.combat!.monsters[target.idx];
    if (!m || m.isDead) return;
    m.block = Math.min(999, m.block + calcMonsterBlock(ctx, target.idx, amount));
    return;
  }
  const player = ctx.combat!.player;
  player.block = Math.min(999, player.block + amount);
  if (amount > 0) fireHook(ctx, PLAYER, "onGainedBlock", amount);
}

function checkBloodied(ctx: EffectCtx): void {
  if (ctx.run.hp <= ctx.run.maxHp / 2) fireHook(ctx, PLAYER, "onBloodied");
}

function monsterDeath(ctx: EffectCtx, m: MonsterState): void {
  m.isDead = true;
  m.block = 0;
  const def = ctx.bundle.monsters.get(m.id);
  def?.onDeath?.(ctx, m);
  if (m.isDead) {
    // def.onDeath may resurrect (half-dead Awakened One sets halfDead instead)
    fireHook(ctx, PLAYER, "onMonsterDeath", m);
    ctx.emit("monsterDeath", { idx: m.idx });
    checkVictory(ctx);
  }
}

function checkVictory(ctx: EffectCtx): void {
  const monsters = ctx.combat!.monsters;
  if (monsters.some((m) => m.halfDead)) return; // Awakened One phase 1 corpse holds combat open
  const alive = monsters.filter((m) => !m.isDead && !m.isEscaped);
  const anyNonMinion = alive.some((m) => ctx.bundle.monsters.get(m.id)?.category !== "minion");
  if ((alive.length === 0 || !anyNonMinion) && ctx.rt.combatOver !== "victory") {
    // minions flee when the last non-minion dies
    for (const m of alive) m.isEscaped = true;
    fireHook(ctx, PLAYER, "onVictory");
    ctx.rt.combatOver = "victory";
    ctx.emit("victory");
  }
}

/** Spawn a monster mid-combat (slime splits, summons). slot replaces a corpse; "append" adds. */
export function spawnMonster(
  ctx: EffectCtx,
  monsterId: string,
  slot: number | "append",
  hp: number | null,
  rollFirstMove: boolean,
): void {
  const combat = ctx.combat!;
  const def = ctx.bundle.monsters.get(monsterId);
  if (!def) throw new Error(`unknown monster ${monsterId}`);
  const idx = slot === "append" ? combat.monsters.length : slot;
  const [lo, hi] = def.hp(ctx.asc);
  const maxHp = hp ?? ctx.rng("monsterHpRng").randomRange(lo, hi);
  const m: import("./combatState").MonsterState = {
    id: monsterId,
    idx,
    hp: maxHp,
    maxHp,
    block: 0,
    powers: [],
    move: null,
    moveHistory: [],
    isDead: false,
    isEscaped: false,
    halfDead: false,
    data: {},
  };
  if (slot === "append") combat.monsters.push(m);
  else combat.monsters[idx] = m;
  def.preBattle?.(ctx, m);
  if (rollFirstMove) rollMove(ctx, m);
  ctx.emit("monsterSpawned", { idx, monsterId });
}

function playerDeath(ctx: EffectCtx): void {
  // Fairy in a Bottle / Lizard Tail resurrections hook in here later (Phase 2+)
  ctx.rt.combatOver = "defeat";
  ctx.emit("defeat");
}

// ------------------------------------------------------------------------------
// cards
// ------------------------------------------------------------------------------

function selectCards(ctx: EffectCtx, sel: CardSelector): number[] {
  const piles = ctx.combat!.player.piles;
  switch (sel.kind) {
    case "iid":
      return [sel.iid];
    case "all":
      return [...piles[sel.pile]];
    case "random": {
      const pool = [...piles[sel.pile]];
      const out: number[] = [];
      for (let i = 0; i < sel.n && pool.length > 0; i++) {
        const idx = ctx.rng("cardRandomRng").random(pool.length - 1);
        out.push(pool.splice(idx, 1)[0]!);
      }
      return out;
    }
    case "choose":
      throw new Error("choose selector must go through a choice action");
  }
}

export function discardCard(ctx: EffectCtx, iid: number, manual: boolean): void {
  const c = card(ctx, iid);
  moveCard(ctx, iid, "discard");
  if (manual) {
    ctx.combat!.turnFlags.manualDiscardsThisTurn++;
    fireHook(ctx, PLAYER, "onManualDiscard", c);
    const def = ctx.bundle.cards.get(c.defId);
    if (def?.onManualDiscardThis) def.onManualDiscardThis(cardCtx(ctx, c, null, 0));
  } else {
    fireHook(ctx, PLAYER, "onEndOfTurnDiscard", c);
  }
  ctx.emit("cardDiscarded", { iid, manual });
}

export function exhaustCard(ctx: EffectCtx, iid: number): void {
  const c = card(ctx, iid);
  moveCard(ctx, iid, "exhaust");
  const def = ctx.bundle.cards.get(c.defId);
  if (def?.onExhaustThis) def.onExhaustThis(cardCtx(ctx, c, null, 0));
  fireHook(ctx, PLAYER, "onExhaust", c);
  ctx.emit("cardExhausted", { iid });
}

export function makeTempCard(ctx: EffectCtx, defId: string, upgrades: number, dest: Pile): void {
  const combat = ctx.combat!;
  const def = ctx.bundle.cards.get(defId);
  if (!def) throw new Error(`unknown card def ${defId}`);
  upgrades = Math.floor(foldHook(ctx, PLAYER, "modifyCreatedCardUpgrades", upgrades, defId)); // Master Reality
  const iid = combat.nextCardInstanceId++;
  const cost = def.cost;
  combat.cards[iid] = {
    iid,
    defId,
    upgrades,
    cost,
    costForTurn: cost,
    freeToPlayOnce: false,
    masterIdx: null,
    misc: 0,
    retainOnce: false,
  };
  if (dest === "hand" && combat.player.piles.hand.length >= 10) {
    combat.player.piles.discard.push(iid); // hand overflow goes to discard
  } else if (dest === "draw") {
    // shuffled into a random position
    moveCard(ctx, iid, "draw", "random");
  } else {
    combat.player.piles[dest].push(iid);
  }
  ctx.emit("cardCreated", { iid, defId, dest });
}

function cardCtx(ctx: EffectCtx, c: CardInstance, target: number | null, energyOnUse: number): CardCtx {
  return { ...ctx, card: c, target, energyOnUse, upgraded: c.upgrades > 0 };
}

/** Cost after dynamicCost + modifyCardCost hooks (Corruption: skills 0). X (-1) and unplayable (-2) pass through. */
export function effectiveCost(ctx: EffectCtx, c: CardInstance): number {
  if (c.cost < 0) return c.cost;
  const def = ctx.bundle.cards.get(c.defId);
  const base = def?.dynamicCost ? def.dynamicCost(ctx, c) : c.costForTurn;
  const v = foldHook(ctx, PLAYER, "modifyCardCost", base, c);
  return Math.max(0, Math.floor(v));
}

// ------------------------------------------------------------------------------
// card play resolution (exact order; see plan + reference notes)
// ------------------------------------------------------------------------------

function resolveCardPlay(ctx: EffectCtx, item: CardQueueItem): void {
  if (item.iid === null) return;
  const combat = ctx.combat!;
  const c = combat.cards[item.iid];
  if (!c) return;
  const def = ctx.bundle.cards.get(c.defId);
  if (!def) throw new Error(`unknown card def ${c.defId}`);

  ctx.rt.currentItem = item;

  // target validity: fizzle if targeted monster is gone (duplicated plays can outlive targets)
  if (def.target === "enemy" && item.target !== null) {
    const t = combat.monsters[item.target];
    if (!t || t.isDead || t.isEscaped) {
      ctx.rt.currentItem = null;
      return;
    }
  }

  // the card leaves the hand (to limbo) the moment it starts resolving
  if (!item.purgeOnUse) {
    const handIdx = combat.player.piles.hand.indexOf(item.iid);
    if (handIdx !== -1) {
      combat.player.piles.hand.splice(handIdx, 1);
      combat.player.piles.limbo.push(item.iid);
    }
  }

  item.exhaustOnUse ||= cardHasKeyword(c, def, "exhaust");
  combat.turnFlags.cardsPlayedThisTurn++;
  combat.combatFlags.cardsPlayedThisCombat++;
  if (def.type === "attack") {
    combat.turnFlags.attacksPlayedThisTurn++;
    combat.combatFlags.attacksPlayedThisCombat++;
  } else if (def.type === "skill") {
    combat.turnFlags.skillsPlayedThisTurn++;
    combat.combatFlags.skillsPlayedThisCombat++;
  } else if (def.type === "power") {
    combat.combatFlags.powersPlayedThisCombat++;
  }

  ctx.emit("cardPlayed", {
    iid: item.iid,
    defId: c.defId,
    upgrades: c.upgrades,
    target: item.target,
    autoplayed: item.autoplayed,
    via: item.via,
  });

  // 1. card's own effects enqueue
  const cctx = cardCtx(ctx, c, item.target, item.energyOnUse);
  if (def.primitives) executePrimitives(cctx, def);
  def.onPlay?.(cctx);

  // 2. onUseCard hooks (player: powers -> stance -> relics; then each alive monster's powers, e.g. Enrage)
  fireHook(ctx, PLAYER, "onUseCard", c, item.target);
  for (const m of combat.monsters) {
    if (!m.isDead && !m.isEscaped) fireHook(ctx, monster(m.idx), "onUseCard", c, item.target);
  }

  // 3. terminal destination resolves AFTER the card's queued actions
  ctx.queue.addToBottom({ kind: "effect", ref: "__afterCardUsed", args: { iid: item.iid } });

  // 4. pay energy (unless purge/free/duplicated). X-cost (-1) spends the captured energyOnUse.
  if (!item.purgeOnUse && !c.freeToPlayOnce && !item.ignoreEnergyTotal && !item.autoplayed) {
    if (c.cost === -1) {
      combat.player.energy = Math.max(0, combat.player.energy - item.energyOnUse);
    } else {
      const cost = effectiveCost(ctx, c);
      if (cost > 0) combat.player.energy = Math.max(0, combat.player.energy - cost);
    }
  }
}

/** Registered as effect "__afterCardUsed": terminal card destination + after-play triggers. */
export function afterCardUsed(ctx: EffectCtx, args: unknown): void {
  const { iid } = args as { iid: number };
  const combat = ctx.combat!;
  const item = ctx.rt.currentItem;
  const c = combat.cards[iid];
  if (!c) return;
  const def = ctx.bundle.cards.get(c.defId)!;

  // monster after-card powers (Time Eater, Slow, Beat of Death) via hooks
  for (let i = 0; i < combat.monsters.length; i++) {
    const m = combat.monsters[i]!;
    if (!m.isDead && !m.isEscaped) fireHook(ctx, monster(i), "onAfterCardPlayed", c);
  }
  fireHook(ctx, PLAYER, "onAfterCardPlayed", c);

  if (item?.purgeOnUse) {
    removeCardFromCombat(ctx, iid);
    ctx.rt.currentItem = null;
    return;
  }

  c.freeToPlayOnce = false;
  combat.turnFlags.lastCardPlayedType = def.type;

  if (def.type === "power") {
    removeCardFromCombat(ctx, iid); // powers vanish
  } else if (item?.exhaustOnUse) {
    exhaustCard(ctx, iid);
  } else if (def.afterUse === "shuffleIntoDraw") {
    moveCard(ctx, iid, "draw", "random"); // Tantrum
  } else {
    moveCard(ctx, iid, "discard"); // not a "manual" discard: no discard triggers
  }
  ctx.rt.currentItem = null;
}

function removeCardFromCombat(ctx: EffectCtx, iid: number): void {
  const combat = ctx.combat!;
  for (const pile of Object.values(combat.player.piles)) {
    const idx = pile.indexOf(iid);
    if (idx !== -1) pile.splice(idx, 1);
  }
  delete combat.cards[iid];
}

function cardHasKeyword(c: CardInstance, def: { keywords: string[]; upgradeKeywords?: string[] }, kw: string): boolean {
  const set = c.upgrades > 0 && def.upgradeKeywords ? def.upgradeKeywords : def.keywords;
  return set.includes(kw);
}

function executePrimitives(cctx: CardCtx, def: NonNullable<ReturnType<ContentBundle["cards"]["get"]>>): void {
  // implemented in content/primitives.ts (engine keeps only the dispatch point)
  const fn = cctx.bundle.effects.get("__primitives");
  if (!fn) throw new Error("primitives runner not registered");
  fn(cctx, def);
}

function runInnerQueueMarker(_ctx: EffectCtx): void {
  // placeholder: the main loop continues draining; nothing to do here
}

// ------------------------------------------------------------------------------
// scry
// ------------------------------------------------------------------------------

function startScry(ctx: EffectCtx, n: number): void {
  const draw = ctx.combat!.player.piles.draw;
  const iids = draw.slice(0, Math.min(n, draw.length));
  if (iids.length === 0) return;
  ctx.requestChoice({
    request: { kind: "scry", iids },
    resume: "__scryResolve",
    resumeArgs: { iids },
  });
}

/** Registered as "__scryResolve": args carry chosen discards; fires onScry. */
export function scryResolve(ctx: EffectCtx, args: unknown): void {
  const { iids, discarded } = args as { iids: number[]; discarded: number[] };
  for (const iid of discarded) discardCard(ctx, iid, false);
  fireHook(ctx, PLAYER, "onScry", iids.length);
  // in-discard scry self-triggers (Weave)
  const combat = ctx.combat!;
  for (const iid of [...combat.player.piles.discard]) {
    const c = combat.cards[iid];
    const def = c && ctx.bundle.cards.get(c.defId);
    if (c && def?.onScryThisInDiscard) {
      def.onScryThisInDiscard({ ...ctx, card: c, target: null, energyOnUse: 0, upgraded: c.upgrades > 0 });
    }
  }
}

// ------------------------------------------------------------------------------
// turn flow
// ------------------------------------------------------------------------------

export function startPlayerTurn(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  combat.turn++;
  combat.playerTurn = true;
  combat.combatFlags.turnsTaken++;
  combat.turnFlags.cardsPlayedThisTurn = 0;
  combat.turnFlags.attacksPlayedThisTurn = 0;
  combat.turnFlags.skillsPlayedThisTurn = 0;
  combat.turnFlags.manualDiscardsThisTurn = 0;
  combat.turnFlags.endTurnQueued = false;

  // block loss (Barricade keeps, Calipers -15, default 0)
  if (combat.turn > 1) {
    combat.player.block = Math.max(0, Math.floor(foldHook(ctx, PLAYER, "modifyBlockRetention", 0)));
  }

  fireHook(ctx, PLAYER, "atStartOfTurn");
  triggerStartOfTurnOrbs(ctx);

  // energy recharge
  const retains = anyHook(ctx, PLAYER, "retainsEnergy");
  combat.player.energy = (retains ? combat.player.energy : 0) + combat.player.energyPerTurn;
  fireHook(ctx, PLAYER, "onEnergyRecharge");

  // draw
  drawCards(ctx, Math.max(0, Math.floor(foldHook(ctx, PLAYER, "modifyDrawPerTurn", 5))));

  fireHook(ctx, PLAYER, "atStartOfTurnPostDraw");
  ctx.emit("turnStarted", { turn: combat.turn });
}

/** endTurn command: queue the end-turn marker behind pending card plays. */
export function queueEndTurn(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  if (combat.turnFlags.endTurnQueued) return;
  combat.turnFlags.endTurnQueued = true;
  callEndOfTurnActions(ctx);
  ctx.queue.addToBottom({ kind: "endPlayerTurn" });
}

function callEndOfTurnActions(ctx: EffectCtx): void {
  // relics + powers pre-end-of-turn (Cloak Clasp, Metallicize, Plated Armor, Like Water)
  fireHook(ctx, PLAYER, "atEndOfTurnPreEndOfTurnCards");
  triggerEndOfTurnOrbs(ctx);

  // end-of-turn playing cards (Burn/Decay/Doubt/Shame/Regret) via self-trigger defs
  const combat = ctx.combat!;
  for (const iid of [...combat.player.piles.hand]) {
    const c = combat.cards[iid]!;
    const def = ctx.bundle.cards.get(c.defId);
    if (def?.onEndOfTurnInHand) {
      const handSize = combat.player.piles.hand.length;
      def.onEndOfTurnInHand({ ...cardCtx(ctx, c, null, 0), energyOnUse: handSize });
    }
  }
}

function onTurnEnding(ctx: EffectCtx): void {
  fireHook(ctx, PLAYER, "atEndOfTurn", true);
  stanceAtEndOfTurn(ctx); // Divinity auto-exit
  endOfTurnDiscard(ctx);
  resetCostsForTurn(ctx);
  ctx.queue.addToBottom({ kind: "monsterTurn" });
}

/**
 * End-of-turn hand pass (BattleContext::discardAtEndOfTurn). Retain wins over
 * everything, then ETHEREAL exhausts - and it exhausts even while the hand is
 * being kept: retainsHand (Runic Pyramid, Equilibrium) skips only the discard,
 * exactly like the reference, whose ethereal loop runs after the Runic Pyramid
 * check.
 */
function endOfTurnDiscard(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  const keepsHand = anyHook(ctx, PLAYER, "retainsHand");
  for (const iid of [...combat.player.piles.hand]) {
    const c = combat.cards[iid]!;
    const def = ctx.bundle.cards.get(c.defId)!;
    if (cardHasKeyword(c, def, "retain") || cardHasKeyword(c, def, "selfRetain") || c.retainOnce) {
      c.retainOnce = false;
      if (def.onRetainThis) def.onRetainThis(cardCtx(ctx, c, null, 0));
      fireHook(ctx, PLAYER, "onRetain", c);
      continue;
    }
    if (cardHasKeyword(c, def, "ethereal")) {
      exhaustCard(ctx, iid);
      continue;
    }
    if (!keepsHand) discardCard(ctx, iid, false);
  }
}

function resetCostsForTurn(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  for (const c of Object.values(combat.cards)) c.costForTurn = c.cost;
}

function monsterTurn(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  combat.playerTurn = false;
  if (combat.turnFlags.skipMonsterTurn) {
    // Vault: monsters don't act this round (round-end ticks still happen)
    combat.turnFlags.skipMonsterTurn = false;
    ctx.queue.addToBottom({ kind: "endRound" });
    return;
  }
  for (const m of combat.monsters) {
    if (m.isDead || m.isEscaped || m.halfDead) continue;
    ctx.queue.addToBottom({ kind: "monsterMove", idx: m.idx });
  }
  ctx.queue.addToBottom({ kind: "endRound" });
}

function executeMonsterMove(ctx: EffectCtx, idx: number): void {
  const combat = ctx.combat!;
  const m = combat.monsters[idx];
  if (!m || m.isDead || m.isEscaped || m.halfDead) return;
  const def = ctx.bundle.monsters.get(m.id);
  if (!def) throw new Error(`unknown monster ${m.id}`);

  // monsters lose block at the start of their own turn (Barricade-like powers keep it)
  if (getPowerAmount(ctx, monster(idx), "BARRICADE") === 0) m.block = 0;

  fireHook(ctx, monster(idx), "atStartOfTurn");
  // A start-of-turn power can kill its owner (Poison loses HP synchronously).
  // The reference applies those powers in a separate pre-turn action and
  // re-checks isDeadOrEscaped before takeTurn (MonsterGroup::doMonsterTurn),
  // so a monster that dies here does not act.
  if (m.isDead || m.isEscaped) return;
  if (m.move) {
    const move = def.moves[m.move];
    if (!move) throw new Error(`unknown move ${m.move} on ${m.id}`);
    move.execute(ctx, m);
  }
  fireHook(ctx, monster(idx), "atEndOfTurn", false);
  // roll next move (intent for the coming turn)
  if (!m.isDead && !m.isEscaped) rollMove(ctx, m);
}

export function rollMove(ctx: EffectCtx, m: MonsterState): void {
  const def = ctx.bundle.monsters.get(m.id)!;
  const roll = ctx.rng("aiRng").random(99);
  const next = def.getMove(ctx, m, roll);
  m.move = next;
  m.moveHistory.push(next);
  if (m.moveHistory.length > 8) m.moveHistory.shift();
}

function endRound(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  // player powers tick first, then each monster's
  tickTurnBasedPowers(ctx, PLAYER);
  for (const m of combat.monsters) {
    if (!m.isDead && !m.isEscaped) tickTurnBasedPowers(ctx, monster(m.idx));
  }
  ctx.queue.addToBottom({ kind: "startPlayerTurn" });
}
