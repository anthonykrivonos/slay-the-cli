// Centurion & Mystic — exact ports from data/corpus/monsters-act2.json.
// Encounter layout (CENTURION_AND_HEALER): Centurion slot 0, Mystic slot 1.
//
// CONFLICT HONORED (Centurion hp.asc): [78,83] at A7+ per spire-archive+wiki
// majority (lightspeed's 76 min is a transcription error).
// CONFLICT HONORED (Centurion DEFEND when alone): lightspeed transcription —
// the move is a no-op if the Mystic is dead at execution time (the real game's
// self-block variant is only reachable through a stale intent).
// CONFLICT HONORED (Mystic heal repeat): no lastTwoMoves gate on HEAL
// (lightspeed, seed-validated; the wiki's "up to twice in a row" is dropped).
// CONFLICT HONORED (Mystic heal threshold): missing >= 16, switching to >= 21
// at A17 together with the 16 -> 20 heal amount (lightspeed; not the wiki A19).

import type { MonsterDef } from "../../../engine/content/defs";
import { ascTier, firstTurn, lastMove, lastTwoMovesWere } from "../../util";
import { aliveCount, attackPlayer, playerPower, selfPower } from "./_shared";
import { monster } from "../../../engine/core/ids";

const SLASH = "CENTURION_SLASH";
const FURY = "CENTURION_FURY";
const DEFEND = "CENTURION_DEFEND";

export const centurion: MonsterDef = {
  id: "CENTURION",
  name: "Centurion",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [78, 83] : [76, 80]),
  moves: {
    CENTURION_SLASH: {
      id: SLASH,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 14 : 12),
    },
    CENTURION_FURY: {
      id: FURY,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 7 : 6, 3),
    },
    CENTURION_DEFEND: {
      id: DEFEND,
      intent: "defend",
      execute: (ctx, _self) => {
        if (aliveCount(ctx) <= 1) return; // no-op when alone (see header)
        const ally = ctx.combat!.monsters[1];
        if (!ally || ally.isDead || ally.isEscaped) return;
        ctx.queue.addToBottom({
          kind: "gainBlock",
          target: monster(ally.idx),
          amount: ctx.asc >= 17 ? 20 : 15,
          fromCard: false,
        });
      },
    },
  },
  getMove: (ctx, self, roll) => {
    const mysticAlive = aliveCount(ctx) > 1;
    const support = mysticAlive ? DEFEND : FURY;
    if (roll >= 65 && !lastTwoMovesWere(self, DEFEND) && !lastTwoMovesWere(self, FURY)) {
      return support;
    }
    if (!lastTwoMovesWere(self, SLASH)) return SLASH;
    return support;
  },
};

const ATTACK_DEBUFF = "MYSTIC_ATTACK_DEBUFF";
const HEAL = "MYSTIC_HEAL";
const BUFF = "MYSTIC_BUFF";

const mysticHealAmount = (asc: number): number => (asc >= 17 ? 20 : 16);

export const mystic: MonsterDef = {
  id: "MYSTIC",
  name: "Mystic",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [50, 58] : [48, 56]),
  moves: {
    MYSTIC_ATTACK_DEBUFF: {
      id: ATTACK_DEBUFF,
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 9 : 8);
        playerPower(ctx, self, "FRAIL", 2);
      },
    },
    MYSTIC_HEAL: {
      id: HEAL,
      intent: "buff",
      execute: (ctx, self) => {
        const amount = mysticHealAmount(ctx.asc);
        const knight = ctx.combat!.monsters[0];
        if (aliveCount(ctx) > 1 && knight && knight !== self && !knight.isDead && !knight.isEscaped) {
          ctx.queue.addToBottom({ kind: "heal", target: monster(knight.idx), amount });
        }
        ctx.queue.addToBottom({ kind: "heal", target: monster(self.idx), amount });
      },
    },
    MYSTIC_BUFF: {
      id: BUFF,
      intent: "buff",
      execute: (ctx, self) => {
        const str = ascTier(ctx.asc, 2, [
          [2, 3],
          [17, 4],
        ]);
        const knight = ctx.combat!.monsters[0];
        if (aliveCount(ctx) > 1 && knight && knight !== self && !knight.isDead && !knight.isEscaped) {
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: monster(self.idx),
            target: monster(knight.idx),
            powerId: "STRENGTH",
            amount: str,
          });
        }
        selfPower(ctx, self, "STRENGTH", str);
      },
    },
  },
  getMove: (ctx, self, roll) => {
    // note: the A17 heal TRIGGER threshold is 21 while the heal amount is 20
    const healNeed = ctx.asc >= 17 ? 21 : 16;
    const knight = ctx.combat!.monsters[0];
    const knightNeedsHeal =
      knight !== undefined &&
      !knight.isDead &&
      !knight.isEscaped &&
      knight.maxHp - knight.hp >= healNeed;
    if (self.maxHp - self.hp >= healNeed || knightNeedsHeal) return HEAL;
    const debuffGate =
      ctx.asc >= 17 ? lastMove(self) !== ATTACK_DEBUFF : !lastTwoMovesWere(self, ATTACK_DEBUFF);
    if (roll >= 40 && debuffGate) return ATTACK_DEBUFF;
    if (!lastTwoMovesWere(self, BUFF)) return BUFF;
    return ATTACK_DEBUFF;
  },
};
