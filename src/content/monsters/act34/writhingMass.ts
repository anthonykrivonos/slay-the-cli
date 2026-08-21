// Writhing Mass - exact port from data/corpus/monsters-act34.json
// (WRITHING_MASS): the full conditional band cascade with in-band re-rolls.
// CONFLICT HONORED (MALLEABLE): starts at 4 per the wiki (lightspeed
// hardcodes 3; block amounts are invisible to its seed tests); the reset
// restores the applied base (4), matching the game's MalleablePower.
// Implant grants the PARASITE curse to the MASTER deck once used (even if
// the Mass is later killed); Omamori's counter is consumed instead, and
// Darkstone Periapt's +6 max HP fires at implant time when Omamori is absent.

import type { MonsterDef } from "../../../engine/content/defs";
import { firstTurn, hasRelic, lastMove } from "../../util";
import { attackPlayer, playerPower, prePower, selfBlock } from "../act1/_shared";

const STRONG_STRIKE = "WRITHING_MASS_STRONG_STRIKE";
const MULTI_STRIKE = "WRITHING_MASS_MULTI_STRIKE";
const FLAIL = "WRITHING_MASS_FLAIL";
const WITHER = "WRITHING_MASS_WITHER";
const IMPLANT = "WRITHING_MASS_IMPLANT";

export const writhingMass: MonsterDef = {
  id: "WRITHING_MASS",
  name: "Writhing Mass",
  category: "normal",
  hp: (asc) => (asc >= 7 ? [175, 175] : [160, 160]),
  preBattle: (_ctx, self) => {
    prePower(self, "REACTIVE", 1);
    self.powers.push({ id: "MALLEABLE", amount: 4, justApplied: false, data: { base: 4 } });
  },
  moves: {
    WRITHING_MASS_STRONG_STRIKE: {
      id: STRONG_STRIKE,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 38 : 32),
    },
    WRITHING_MASS_MULTI_STRIKE: {
      id: MULTI_STRIKE,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 2 ? 9 : 7, 3),
    },
    WRITHING_MASS_FLAIL: {
      id: FLAIL,
      intent: "attackDefend",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 16 : 15);
        selfBlock(ctx, self, ctx.asc >= 2 ? 18 : 16);
      },
    },
    WRITHING_MASS_WITHER: {
      id: WITHER,
      intent: "attackDebuff",
      execute: (ctx, self) => {
        attackPlayer(ctx, self, ctx.asc >= 2 ? 12 : 10);
        playerPower(ctx, self, "WEAK", 2);
        playerPower(ctx, self, "VULNERABLE", 2);
      },
    },
    WRITHING_MASS_IMPLANT: {
      id: IMPLANT,
      intent: "strongDebuff",
      execute: (ctx, self) => {
        self.data.usedImplant = true;
        const omamori = ctx.run.relics.find((r) => r.defId === "OMAMORI");
        if (!omamori && hasRelic(ctx, "DARKSTONE_PERIAPT")) {
          ctx.run.maxHp += 6;
          ctx.run.hp += 6;
        }
        // the curse lands in the MASTER deck when the battle ends; granting
        // it here is unobservable in-combat (Omamori consumed instead)
        if (omamori && omamori.counter > 0) {
          omamori.counter--;
        } else {
          ctx.run.deck.push({ defId: "PARASITE", upgrades: 0, misc: 0, bottled: false });
        }
      },
    },
  },
  getMove: (ctx, self, roll) => {
    if (firstTurn(self)) {
      if (roll < 33) return MULTI_STRIKE;
      if (roll < 66) return FLAIL;
      return WITHER;
    }
    const usedImplant = self.data.usedImplant === true;
    const rng = () => ctx.rng("aiRng");
    let r = roll;
    for (;;) {
      // band A (roll < 10)
      if (r < 10) {
        if (lastMove(self) !== STRONG_STRIKE) return STRONG_STRIKE;
        r = rng().randomRange(10, 99);
      }
      // band B (roll < 20)
      if (r < 20) {
        if (!usedImplant && lastMove(self) !== IMPLANT) return IMPLANT;
        if (rng().randomBoolean(0.1)) return STRONG_STRIKE;
        r = rng().randomRange(20, 99);
      }
      // band C (roll < 40)
      if (r < 40) {
        if (lastMove(self) !== WITHER) return WITHER;
        if (rng().randomBoolean(0.4)) {
          const r2 = rng().randomRange(0, 19);
          if (r2 < 10) return STRONG_STRIKE;
          if (!usedImplant) return IMPLANT;
          if (rng().randomBoolean(0.1)) return STRONG_STRIKE;
          r = rng().randomRange(20, 99);
          continue; // CONTINUE the loop from band C (r >= 20 skips A/B)
        }
        r = rng().randomRange(40, 99);
      }
      // band D (roll < 70)
      if (r < 70) {
        if (lastMove(self) !== MULTI_STRIKE) return MULTI_STRIKE;
        if (rng().randomBoolean(0.3)) return FLAIL;
        r = rng().randomRange(0, 39);
        continue; // CONTINUE the loop from band A
      }
      // band E (roll >= 70)
      if (lastMove(self) !== FLAIL) return FLAIL;
      return WITHER;
    }
  },
};
