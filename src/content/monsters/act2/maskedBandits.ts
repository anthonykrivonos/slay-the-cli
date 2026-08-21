// The Masked Bandits event fighters - exact ports from
// data/corpus/monsters-act2.json (Pointy idx 0, Romeo idx 1, Bear idx 2).
// All three run fixed scripts and consume no aiRng after the initial roll in
// the reference.
// CONFLICT HONORED (Bear hp.base): [38,42] per spire-archive+wiki majority
// (lightspeed's 52 max is a transcription typo for 42).
// CONFLICT HONORED (Romeo A17): lightspeed's script (no A17 branch - strict
// AGONIZING/CROSS alternation at every ascension) transcribed as primary; the
// wiki's A17 double-Cross-Slash cycle is noted but not implemented.
// CONFLICT HONORED (categories): all three are event-only fighters.
// ENGINE-GAP: this engine's rollMove burns one aiRng.random(99) per turn
// (values unused by these scripts).

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, lastMove } from "../../util";
import { attackPlayer, playerPower, selfBlock } from "./_shared";

export const bear: MonsterDef = {
  id: "BEAR",
  name: "Bear",
  category: "event",
  hp: (asc) => (asc >= 7 ? [40, 44] : [38, 42]),
  moves: {
    BEAR_BEAR_HUG: {
      id: "BEAR_BEAR_HUG",
      intent: "strongDebuff",
      execute: (ctx, self) => playerPower(ctx, self, "DEXTERITY", ctx.asc >= 17 ? -4 : -2),
    },
    BEAR_LUNGE: {
      id: "BEAR_LUNGE",
      intent: "attackDefend",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 10 : 9);
        selfBlock(ctx, self, 9);
      },
    },
    BEAR_MAUL: {
      id: "BEAR_MAUL",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 20 : 18),
    },
  },
  getMove: (_ctx, self) => {
    if (firstTurn(self)) return "BEAR_BEAR_HUG";
    return lastMove(self) === "BEAR_LUNGE" ? "BEAR_MAUL" : "BEAR_LUNGE";
  },
};

export const romeo: MonsterDef = {
  id: "ROMEO",
  name: "Romeo",
  category: "event",
  hp: (asc) => (asc >= 7 ? [37, 41] : [35, 39]),
  moves: {
    ROMEO_MOCK: {
      id: "ROMEO_MOCK",
      intent: "unknown",
      execute: () => {},
    },
    ROMEO_AGONIZING_SLASH: {
      id: "ROMEO_AGONIZING_SLASH",
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 12 : 10);
        playerPower(ctx, self, "WEAK", ctx.asc >= 17 ? 3 : 2);
      },
    },
    ROMEO_CROSS_SLASH: {
      id: "ROMEO_CROSS_SLASH",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 17 : 15),
    },
  },
  getMove: (_ctx, self) => {
    if (firstTurn(self)) return "ROMEO_MOCK";
    return lastMove(self) === "ROMEO_AGONIZING_SLASH" ? "ROMEO_CROSS_SLASH" : "ROMEO_AGONIZING_SLASH";
  },
};

export const pointy: MonsterDef = {
  id: "POINTY",
  name: "Pointy",
  category: "event",
  hp: (asc) => (asc >= 7 ? [34, 34] : [30, 30]),
  moves: {
    POINTY_ATTACK: {
      id: "POINTY_ATTACK",
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 6 : 5, 2),
    },
  },
  getMove: () => "POINTY_ATTACK",
};
