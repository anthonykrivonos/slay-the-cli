// The five gremlin-gang gremlins - exact ports from data/corpus/monsters-act1.json.
// CONFLICT HONORED (SHIELD_GREMLIN Protect block): 7 / 8 / 11 with tiers at
// asc>=7 and asc>=17 (lightspeed + Weekly Patch 17 note; the wiki's asc-2 tier
// text is presumed wrong).
// NOTE (MAD_GREMLIN): the corpus says ANGRY triggers even on fully blocked
// attacks; the shared core ANGRY power requires unblocked damage > 0 - kept
// as-is per file ownership (core.ts is out of scope). Flagged in the report.

import type { MonsterDef } from "../../../engine/content/defs";
import { ascTier, firstTurn, lastMove } from "../../util";
import { attackPlayer, playerPower, prePower } from "./_shared";

export const madGremlin: MonsterDef = {
  id: "MAD_GREMLIN",
  name: "Mad Gremlin",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [21, 25] : [20, 24]),
  preBattle: (ctx, self) => prePower(self, "ANGRY", ctx.asc >= 17 ? 2 : 1),
  moves: {
    MAD_GREMLIN_SCRATCH: {
      id: "MAD_GREMLIN_SCRATCH",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 5 : 4),
    },
  },
  getMove: () => "MAD_GREMLIN_SCRATCH",
};

export const sneakyGremlin: MonsterDef = {
  id: "SNEAKY_GREMLIN",
  name: "Sneaky Gremlin",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [11, 15] : [10, 14]),
  moves: {
    SNEAKY_GREMLIN_PUNCTURE: {
      id: "SNEAKY_GREMLIN_PUNCTURE",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 10 : 9),
    },
  },
  getMove: () => "SNEAKY_GREMLIN_PUNCTURE",
};

export const fatGremlin: MonsterDef = {
  id: "FAT_GREMLIN",
  name: "Fat Gremlin",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [14, 18] : [13, 17]),
  moves: {
    FAT_GREMLIN_SMASH: {
      id: "FAT_GREMLIN_SMASH",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 5 : 4);
        playerPower(ctx, self, "WEAK", 1);
        if (ctx.asc >= 17) playerPower(ctx, self, "FRAIL", 1);
      },
    },
  },
  getMove: () => "FAT_GREMLIN_SMASH",
};

export const shieldGremlin: MonsterDef = {
  id: "SHIELD_GREMLIN",
  name: "Shield Gremlin",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [13, 17] : [12, 15]),
  moves: {
    SHIELD_GREMLIN_PROTECT: {
      id: "SHIELD_GREMLIN_PROTECT",
      intent: "defend",
      execute: (ctx, self) => {
        const block = ascTier(ctx.asc, 7, [
          [7, 8],
          [17, 11],
        ]);
        // one random not-dying monster other than itself; itself only when alone
        const valid = ctx.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped && m.idx !== self.idx);
        const targetIdx = valid.length > 0 ? valid[ctx.rng("aiRng").random(valid.length - 1)]!.idx : self.idx;
        ctx.queue.addToBottom({ kind: "gainBlock", target: { kind: "monster", idx: targetIdx }, amount: block, fromCard: false });
      },
    },
    SHIELD_GREMLIN_SHIELD_BASH: {
      id: "SHIELD_GREMLIN_SHIELD_BASH",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 8 : 6),
    },
  },
  getMove: (ctx, self) => {
    // permanent switch: never returns to PROTECT once alone
    if (lastMove(self) === "SHIELD_GREMLIN_SHIELD_BASH") return "SHIELD_GREMLIN_SHIELD_BASH";
    if (firstTurn(self)) return "SHIELD_GREMLIN_PROTECT";
    const alive = ctx.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped).length;
    return alive <= 1 ? "SHIELD_GREMLIN_SHIELD_BASH" : "SHIELD_GREMLIN_PROTECT";
  },
};

export const gremlinWizard: MonsterDef = {
  id: "GREMLIN_WIZARD",
  name: "Gremlin Wizard",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [22, 26] : [21, 25]),
  moves: {
    GREMLIN_WIZARD_CHARGING: {
      id: "GREMLIN_WIZARD_CHARGING",
      intent: "unknown",
      execute: () => {}, // does nothing; charge bookkeeping lives in getMove
    },
    GREMLIN_WIZARD_ULTIMATE_BLAST: {
      id: "GREMLIN_WIZARD_ULTIMATE_BLAST",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 30 : 25),
    },
  },
  getMove: (ctx, self) => {
    // ENGINE-GAP: the reference consumes no aiRng.random(99) after turn 1;
    // this engine's rollMove consumes one per turn (value unused).
    if (firstTurn(self)) {
      self.data.charge = 1;
      return "GREMLIN_WIZARD_CHARGING";
    }
    if (lastMove(self) === "GREMLIN_WIZARD_ULTIMATE_BLAST") {
      if (ctx.asc >= 17) return "GREMLIN_WIZARD_ULTIMATE_BLAST"; // attacks every turn after the first blast
      self.data.charge = 0;
      return "GREMLIN_WIZARD_CHARGING";
    }
    // last move was CHARGING: charge += 1; blast at 3
    const charge = (self.data.charge as number) + 1;
    self.data.charge = charge;
    return charge >= 3 ? "GREMLIN_WIZARD_ULTIMATE_BLAST" : "GREMLIN_WIZARD_CHARGING";
  },
};
