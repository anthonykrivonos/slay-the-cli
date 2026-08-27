// Combat setup: build CombatState from the master deck + an encounter, roll
// monster HP (monsterHpRng), shuffle, pre-battle hooks, roll first moves, and
// start turn 1.

import type { EffectCtx, ContentBundle } from "../content/defs";
import type { CombatState } from "./combatState";
import type { RunState } from "../run/runState";
import type { MonsterId } from "../core/ids";
import { fireHook } from "../core/hooks";
import { PLAYER, monster } from "../core/ids";
import { shuffleDrawPile } from "./piles";
import { rollMove } from "./interpreter";

export function buildCombatState(
  run: RunState,
  bundle: ContentBundle,
  encounterId: string,
  monsterIds: MonsterId[],
  energyPerTurn: number,
  orbSlots: number,
  roomKind: "monster" | "elite" | "boss" = "monster",
): CombatState {
  // boss energy relics add +1/turn; Slaver's Collar only in elite/boss fights
  for (const r of run.relics) {
    const def = bundle.relics.get(r.defId);
    if (!def?.energyBonus) continue;
    if (def.energyBonusEliteBossOnly && roomKind === "monster") continue;
    energyPerTurn += def.energyBonus;
  }
  const cards: CombatState["cards"] = {};
  const draw: number[] = [];
  let iid = 1;
  run.deck.forEach((mc, masterIdx) => {
    const def = bundle.cards.get(mc.defId);
    if (!def) throw new Error(`unknown card in deck: ${mc.defId}`);
    const cost = mc.upgrades > 0 && def.upgradeValues.cost !== undefined ? def.upgradeValues.cost : def.cost;
    cards[iid] = {
      iid,
      defId: mc.defId,
      upgrades: mc.upgrades,
      cost,
      costForTurn: cost,
      freeToPlayOnce: false,
      masterIdx,
      misc: mc.misc,
      retainOnce: false,
    };
    draw.push(iid);
    iid++;
  });

  return {
    turn: 0,
    playerTurn: false,
    player: {
      block: 0,
      energy: 0,
      energyPerTurn,
      stance: "NEUTRAL",
      mantra: 0,
      powers: [],
      orbs: [],
      orbSlots,
      piles: { draw, hand: [], discard: [], exhaust: [], limbo: [] },
    },
    monsters: monsterIds.map((id, idx) => ({
      id,
      idx,
      hp: 0,
      maxHp: 0,
      block: 0,
      powers: [],
      move: null,
      moveHistory: [],
      isDead: false,
      isEscaped: false,
      halfDead: false,
      data: {},
    })),
    cardQueue: [],
    nextCardInstanceId: iid,
    cards,
    turnFlags: {
      cardsPlayedThisTurn: 0,
      attacksPlayedThisTurn: 0,
      skillsPlayedThisTurn: 0,
      endTurnQueued: false,
      manualDiscardsThisTurn: 0,
    },
    combatFlags: {
      cardsPlayedThisCombat: 0,
      attacksPlayedThisCombat: 0,
      skillsPlayedThisCombat: 0,
      powersPlayedThisCombat: 0,
      turnsTaken: 0,
      hpLostThisCombat: 0,
      encounterId,
    },
  };
}

/** Roll HP, fire pre-battle hooks, place innate cards, roll first moves, start turn 1. */
export function initializeCombat(ctx: EffectCtx): void {
  const combat = ctx.combat!;
  ctx.emit("combatStarted", { encounterId: combat.combatFlags.encounterId, monsters: combat.monsters.map((m) => m.id) });

  // monster HP rolls (monsterHpRng, in slot order)
  for (const m of combat.monsters) {
    const def = ctx.bundle.monsters.get(m.id);
    if (!def) throw new Error(`unknown monster ${m.id}`);
    const [lo, hi] = def.hp(ctx.asc);
    m.maxHp = ctx.rng("monsterHpRng").randomRange(lo, hi);
    m.hp = m.maxHp;
  }

  shuffleDrawPile(ctx);

  // innate cards move to the top of the draw pile (drawn first)
  const draw = combat.player.piles.draw;
  const innate: number[] = [];
  for (const iid of [...draw]) {
    const c = combat.cards[iid]!;
    const def = ctx.bundle.cards.get(c.defId)!;
    const kws = c.upgrades > 0 && def.upgradeKeywords ? def.upgradeKeywords : def.keywords;
    if (kws.includes("innate")) innate.push(iid);
  }
  for (const iid of innate.reverse()) {
    draw.splice(draw.indexOf(iid), 1);
    draw.unshift(iid);
  }

  fireHook(ctx, PLAYER, "atBattleStartPreDraw");

  // snapshot: a preBattle may pad the row with empty slots (the Collector
  // moves herself to slot 2), and those placeholders have no monster def
  for (const m of [...combat.monsters]) {
    ctx.bundle.monsters.get(m.id)?.preBattle?.(ctx, m);
  }

  // first moves
  for (const m of combat.monsters) {
    if (!m.isDead && !m.isEscaped) rollMove(ctx, m);
  }

  fireHook(ctx, PLAYER, "atBattleStart");

  ctx.queue.addToBottom({ kind: "startPlayerTurn" });
}
