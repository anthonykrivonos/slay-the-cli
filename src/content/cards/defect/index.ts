// Defect content slice: the full blue card pool, the four orb definitions, and
// the powers/effects the blue cards create and use.
//
// Integration (orchestrator): merge defectCards into bundle.cards, defectPowers
// into bundle.powers (map-merge by id — FOCUS/BUFFER stay owned by
// relics/supportPowers.ts, which is already corpus-correct incl. FOCUS
// canGoNegative), defectEffects into bundle.effects, and allOrbs into
// bundle.orbs (currently an empty map in src/content/index.ts).

import type { CardDef, PowerDef, EffectFn, OrbDef } from "../../../engine/content/defs";
import { defectBasics } from "./basics";
import { defectCommons } from "./common";
import { defectUncommons } from "./uncommon";
import { defectRares } from "./rare";
import { defectPowers } from "../../powers/defect";
import { defectEffects } from "./effects";
import { allOrbs } from "../../orbs";

/** All 75 blue cards (4 basic + 18 common + 36 uncommon + 17 rare). */
export const defectCards: CardDef[] = [
  ...defectBasics,
  ...defectCommons,
  ...defectUncommons,
  ...defectRares,
];

export { defectBasics, defectCommons, defectUncommons, defectRares };
export { defectPowers, defectEffects, allOrbs };
export type { CardDef, PowerDef, EffectFn, OrbDef };
