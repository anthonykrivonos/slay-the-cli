// Watcher content slice: the full purple card pool, plus the powers and named
// effects the purple cards create and use.
//
// Integration (orchestrator): merge watcherCards / watcherPowers /
// watcherEffects into src/content/index.ts. The purple tokens these cards
// create (SMITE, INSIGHT, MIRACLE, SAFETY, THROUGH_VIOLENCE, BETA, EXPUNGER)
// live in the colorless slice; PLATED_ARMOR (Wish) in relics/supportPowers;
// VIGOR/STRENGTH/DEXTERITY in powers/core; the stance defs + Violet Lotus'
// calm-exit bonus are already live in src/content/index.ts / relics/boss.ts.

import type { CardDef, PowerDef, EffectFn } from "../../../engine/content/defs";
import { watcherBasics } from "./basics";
import { watcherCommons } from "./common";
import { watcherUncommons } from "./uncommon";
import { watcherRares } from "./rare";
import { watcherPowers } from "../../powers/watcher";
import { watcherEffects } from "./effects";

/** All 75 purple cards (4 basics + 19 common + 35 uncommon + 17 rare). */
export const watcherCards: CardDef[] = [
  ...watcherBasics,
  ...watcherCommons,
  ...watcherUncommons,
  ...watcherRares,
];

export { watcherBasics, watcherCommons, watcherUncommons, watcherRares };
export { watcherPowers, watcherEffects };
export type { CardDef, PowerDef, EffectFn };
