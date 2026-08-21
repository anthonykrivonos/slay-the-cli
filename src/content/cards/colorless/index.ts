// Colorless content slice: the full colorless card pool (20 uncommon + 15 rare
// obtainable, 16 special/token - statuses live in cards/statuses.ts), plus the
// powers and effects these cards create and use.
//
// Integration (orchestrator): merge colorlessCards / colorlessPowers /
// colorlessEffects into src/content/index.ts; the TODO-COLORLESS guards in
// src/engine/run/shop.ts and src/engine/run/neow.ts can then be removed.

import type { CardDef, PowerDef, EffectFn } from "../../../engine/content/defs";
import { colorlessUncommons } from "./uncommon";
import { colorlessRares } from "./rare";
import { colorlessSpecials } from "./special";
import { colorlessPowers } from "./powers";
import { colorlessEffects } from "./effects";

/** All 51 colorless cards (20 uncommon + 15 rare + 16 special). */
export const colorlessCards: CardDef[] = [...colorlessUncommons, ...colorlessRares, ...colorlessSpecials];

export { colorlessUncommons, colorlessRares, colorlessSpecials };
export { colorlessPowers, colorlessEffects };
export type { CardDef, PowerDef, EffectFn };
