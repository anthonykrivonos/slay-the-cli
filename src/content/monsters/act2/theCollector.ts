// The Collector + Torch Head - exact ports from data/corpus/monsters-act2.json.
//
// Collector (boss, slot 2 in the reference encounter; Torch Heads spawn into
// slots 0 and 1 and act BEFORE her, so fresh heads first act the round after
// spawning). Prebattle: MINION_LEADER. AI: turn 1 always SPAWN; the roll made
// on turn 3 unconditionally selects MEGA_DEBUFF for turn 4 (exactly once);
// otherwise roll <= 25 SPAWN (only while fewer than 2 heads live, never twice
// in a row), roll <= 70 FIREBALL (never 3x), BUFF (never twice in a row -
// after a BUFF the fallthrough is FIREBALL).
// SPAWN summons (3 - monstersAlive) heads: first into slot 1 if open else 0,
// second into 0. Each head is constructed with TWO monsterHpRng rolls (the
// game's construct + re-initHp bug - the second roll wins), its move preset to
// TACKLE (getMove never runs in the reference), MINION (+1 STR with
// Philosopher's Stone), and one aiRng.random(99) burned per head.
// CONFLICT HONORED (BUFF block): 15 base, 18 from A9, 23 from A19 (wiki tiered
// AscText; lightspeed groups the 18 at A4). STR 3 / 4@A4 / 5@A19 (all sources).
// CONFLICT HONORED (MEGA_DEBUFF): 3 each, 5 each from A19 (wiki tiered AscText;
// lightspeed hardcodes 3).
// ENGINE-GAP (Torch Head): the reference never rolls a Torch Head move - this
// engine's rollMove burns one aiRng.random(99) per turn per head (getMove
// always returns TACKLE).

import type { MonsterDef } from "../../../engine/content/defs";
import { spawnMonster } from "../../../engine/combat/interpreter";
import { applyPower } from "../../../engine/combat/powerRuntime";
import { monster } from "../../../engine/core/ids";
import { ascTier, firstTurn, hasRelic, lastMove, lastTwoMovesWere } from "../../util";
import {
  aliveCount,
  attackPlayer,
  escapeMinions,
  padMonsterSlots,
  playerPower,
  prePower,
  selfBlock,
  selfPower,
  slotOpen,
} from "./_shared";

const SPAWN = "THE_COLLECTOR_SPAWN";
const FIREBALL = "THE_COLLECTOR_FIREBALL";
const BUFF = "THE_COLLECTOR_BUFF";
const MEGA_DEBUFF = "THE_COLLECTOR_MEGA_DEBUFF";

export const theCollector: MonsterDef = {
  id: "THE_COLLECTOR",
  name: "The Collector",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [300, 300] : [282, 282]),
  preBattle: (_ctx, self) => prePower(self, "MINION_LEADER", 1),
  onDeath: (ctx, _self) => escapeMinions(ctx),
  moves: {
    THE_COLLECTOR_SPAWN: {
      id: SPAWN,
      intent: "unknown",
      execute: (ctx, self) => {
        padMonsterSlots(ctx, 3);
        const spawnCount = Math.max(0, 3 - aliveCount(ctx));
        const slots = [1, 0, 2]
          .filter((s) => s !== self.idx && slotOpen(ctx, s))
          .slice(0, spawnCount);
        for (const slot of slots) {
          const hpRng = ctx.rng("monsterHpRng");
          const [lo, hi] = ctx.bundle.monsters.get("TORCH_HEAD")!.hp(ctx.asc);
          hpRng.randomRange(lo, hi); // construct roll, discarded (the re-initHp wins)
          const hp = hpRng.randomRange(lo, hi);
          spawnMonster(ctx, "TORCH_HEAD", slot, hp, false); // head preBattle applies MINION
          if (hasRelic(ctx, "PHILOSOPHERS_STONE")) {
            applyPower(ctx, monster(slot), monster(slot), "STRENGTH", 1);
          }
          ctx.rng("aiRng").random(99); // burned per spawned head (game parity)
          const head = ctx.combat!.monsters[slot]!;
          head.move = "TORCH_HEAD_TACKLE"; // preset - no move roll
          head.moveHistory.push("TORCH_HEAD_TACKLE");
        }
      },
    },
    THE_COLLECTOR_FIREBALL: {
      id: FIREBALL,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 21 : 18),
    },
    THE_COLLECTOR_BUFF: {
      id: BUFF,
      intent: "defendBuff",
      execute: (ctx, self) => {
        const str = ascTier(ctx.asc, 3, [
          [4, 4],
          [19, 5],
        ]);
        const block = ascTier(ctx.asc, 15, [
          [9, 18],
          [19, 23],
        ]); // adjudicated tiers (see header)
        for (const m of ctx.combat!.monsters) {
          if (m.idx === self.idx || m.isDead || m.isEscaped) continue;
          ctx.queue.addToBottom({
            kind: "applyPower",
            source: monster(self.idx),
            target: monster(m.idx),
            powerId: "STRENGTH",
            amount: str,
          });
        }
        selfPower(ctx, self, "STRENGTH", str);
        selfBlock(ctx, self, block);
      },
    },
    THE_COLLECTOR_MEGA_DEBUFF: {
      id: MEGA_DEBUFF,
      intent: "strongDebuff",
      execute: (ctx, self) => {
        const n = ctx.asc >= 19 ? 5 : 3; // adjudicated A19 bump (see header)
        playerPower(ctx, self, "WEAK", n);
        playerPower(ctx, self, "VULNERABLE", n);
        playerPower(ctx, self, "FRAIL", n);
      },
    },
  },
  getMove: (ctx, self, roll) => {
    if (firstTurn(self)) return SPAWN;
    if (ctx.combat!.turn === 3) return MEGA_DEBUFF; // this roll selects turn 4 - exactly once
    const canSpawn = aliveCount(ctx) < 3 && lastMove(self) !== SPAWN;
    if (roll <= 25 && canSpawn) return SPAWN;
    if (roll <= 70 && !lastTwoMovesWere(self, FIREBALL)) return FIREBALL;
    if (lastMove(self) === BUFF) return FIREBALL;
    return BUFF;
  },
};

export const torchHead: MonsterDef = {
  id: "TORCH_HEAD",
  name: "Torch Head",
  category: "minion",
  hp: (asc) => (asc >= 9 ? [40, 45] : [38, 40]),
  preBattle: (_ctx, self) => prePower(self, "MINION", 1),
  moves: {
    TORCH_HEAD_TACKLE: {
      id: "TORCH_HEAD_TACKLE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 7),
    },
  },
  getMove: () => "TORCH_HEAD_TACKLE", // preset at spawn; never varies
};
