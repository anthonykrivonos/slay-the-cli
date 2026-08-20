// Awakened One — exact port from data/corpus/monsters-act34.json
// (AWAKENED_ONE). Phase 1 ends in half-death: block cleared, all debuffs
// wiped (negative Strength -> 0), Curiosity removed, pending player card
// plays fizzle, intent forced to Rebirth. Its Rebirth turn (driven by the
// AWAKENED_REBIRTH power's atEndOfRound hook — the engine skips halfDead
// monsters in the monster phase) sets max HP to the flat 300 (asc9+: 320),
// fully heals, keeps positive Strength, grants Minion Leader and forces Dark
// Echo. Killing it in phase 2 ends the fight: the two Cultists flee.
// CONFLICT HONORED (hp.asc): asc9+ initHp rolls hpRng.random(300,320) (a real
// roll for RNG parity); REBIRTH then overwrites maxHp with the flat value.
// CONFLICT HONORED (CURIOSITY): the on-Power-card Strength gain is real-game
// behavior (lightspeed comments it out) — implemented in the CURIOSITY power.
// Encounter: 2 Cultists (slots 0,1) + Awakened One (slot 2); the Cultists
// are NOT minions. The run layer must resolve the AWAKENED_ONE boss
// encounter to ["CULTIST","CULTIST","AWAKENED_ONE"] (see act34BossEncounters
// in ./index.ts); as a fallback, when spawned alone this preBattle appends
// the two Cultists (their HP rolls then land AFTER the boss's — an
// ENGINE-GAP vs the reference's slot-order stream).

import type { MonsterDef } from "../../../engine/content/defs";
import { spawnMonster } from "../../../engine/combat/interpreter";
import { removePower } from "../../../engine/combat/powerRuntime";
import { monster } from "../../../engine/core/ids";
import { firstTurn, lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, prePower, replaceIntent } from "../act1/_shared";
import { removeMonsterDebuffs, statusCardsNow } from "./_shared";

const SLASH = "AWAKENED_ONE_SLASH";
const SOUL_STRIKE = "AWAKENED_ONE_SOUL_STRIKE";
const REBIRTH = "AWAKENED_ONE_REBIRTH";
const DARK_ECHO = "AWAKENED_ONE_DARK_ECHO";
const SLUDGE = "AWAKENED_ONE_SLUDGE";
const TACKLE = "AWAKENED_ONE_TACKLE";

export const awakenedOne: MonsterDef = {
  id: "AWAKENED_ONE",
  name: "Awakened One",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [300, 320] : [300, 300]),
  preBattle: (ctx, self) => {
    self.powers.push({ id: "STRENGTH", amount: ctx.asc >= 4 ? 2 : 0, justApplied: false, data: null });
    prePower(self, "CURIOSITY", ctx.asc >= 19 ? 2 : 1);
    prePower(self, "REGENERATE", ctx.asc >= 19 ? 15 : 10);
    // encounter fallback: the boss fight includes 2 Cultists (slots 0,1 in
    // the canonical layout). Only when spawned alone, and only when the
    // bundle carries the act-1 Cultist.
    if (ctx.combat!.monsters.length === 1 && self.idx === 0 && ctx.bundle.monsters.has("CULTIST")) {
      spawnMonster(ctx, "CULTIST", "append", null, false);
      spawnMonster(ctx, "CULTIST", "append", null, false);
    }
  },
  moves: {
    AWAKENED_ONE_SLASH: {
      id: SLASH,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 20),
    },
    AWAKENED_ONE_SOUL_STRIKE: {
      id: SOUL_STRIKE,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 6, 4),
    },
    AWAKENED_ONE_REBIRTH: {
      id: REBIRTH,
      intent: "unknown",
      execute: () => {}, // the revive is driven by the AWAKENED_REBIRTH power
    },
    AWAKENED_ONE_DARK_ECHO: {
      id: DARK_ECHO,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 40),
    },
    AWAKENED_ONE_SLUDGE: {
      id: SLUDGE,
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, 18);
        statusCardsNow(ctx, "VOID", 1, "draw");
      },
    },
    AWAKENED_ONE_TACKLE: {
      id: TACKLE,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 10, 3),
    },
  },
  getMove: (_ctx, self, roll) => {
    if (self.halfDead) return REBIRTH;
    if (!self.data.phase2) {
      if (firstTurn(self)) return SLASH;
      if (roll < 25) return lastMove(self) === SOUL_STRIKE ? SLASH : SOUL_STRIKE;
      return lastTwoMovesWere(self, SLASH) ? SOUL_STRIKE : SLASH;
    }
    // phase 2 (the first phase-2 move, Dark Echo, is forced by the driver)
    if (roll < 50) return lastTwoMovesWere(self, SLUDGE) ? TACKLE : SLUDGE;
    return lastTwoMovesWere(self, TACKLE) ? SLUDGE : TACKLE;
  },
  onDeath: (ctx, self) => {
    if (!self.data.phase2) {
      // phase-1 half-death: the corpse holds combat open (checkVictory)
      self.isDead = false;
      self.halfDead = true;
      if (self.data.rebirthPending) return; // repeat damage on the corpse
      self.data.rebirthPending = true;
      removeMonsterDebuffs(ctx, self);
      removePower(ctx, monster(self.idx), "CURIOSITY");
      ctx.combat!.cardQueue.length = 0; // remaining queued player plays fizzle
      self.powers.push({
        id: "AWAKENED_REBIRTH",
        amount: 1,
        justApplied: false,
        data: { ticks: ctx.combat!.playerTurn ? 1 : 2 },
      });
      replaceIntent(self, REBIRTH);
      return;
    }
    // phase-2 real death: Minion Leader — the Cultists flee, fight over
    for (const m of ctx.combat!.monsters) {
      if (m.idx !== self.idx && !m.isDead && !m.isEscaped) m.isEscaped = true;
    }
  },
};
