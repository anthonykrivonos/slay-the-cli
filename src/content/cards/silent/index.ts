// Silent content slice: the full green card pool, plus the powers/effects the
// green cards create and use.
//
// Integration (orchestrator): merge silentCards / silentPowers / silentEffects
// into src/content/index.ts. silentPowers re-exports three shared corpus
// powers by reference (NO_DRAW, GENERIC_STRENGTH_UP, NEXT_TURN_BLOCK), so the
// slice is self-sufficient and map-merge by id stays safe. Green cards also
// create the colorless SHIV token (cards/colorless/special.ts).

import type { CardDef, PowerDef, EffectFn } from "../../../engine/content/defs";
import { silentBasics } from "./basics";
import { silentCommons } from "./common";
import { silentUncommons } from "./uncommon";
import { silentRares } from "./rare";
import { silentPowers } from "../../powers/silent";
import { silentEffects } from "./effects";

/** All 75 green cards (4 basics + 19 common + 33 uncommon + 19 rare). */
export const silentCards: CardDef[] = [...silentBasics, ...silentCommons, ...silentUncommons, ...silentRares];

export { silentBasics, silentCommons, silentUncommons, silentRares };
export { silentPowers, silentEffects };
export type { CardDef, PowerDef, EffectFn };
