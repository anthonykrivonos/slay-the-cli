// Ironclad content slice: the full red card pool (basics re-exported), plus the
// status/curse pools and the powers/effects the red cards create and use.

import type { CardDef, PowerDef, EffectFn } from "../../../engine/content/defs";
import { ironcladBasics } from "./basics";
import { ironcladCommons } from "./common";
import { ironcladUncommons } from "./uncommon";
import { ironcladRares } from "./rare";
import { statusCards } from "../statuses";
import { curseCards } from "../curses";
import { ironcladPowers } from "../../powers/ironclad";
import { ironcladEffects } from "./effects";

/** All 75 red cards (6 basics/exemplars + 18 common + 35 uncommon + 16 rare). */
export const ironcladCards: CardDef[] = [
  ...ironcladBasics,
  ...ironcladCommons,
  ...ironcladUncommons,
  ...ironcladRares,
];

export { statusCards, curseCards, ironcladEffects };
export { ironcladPowers };
export type { CardDef, PowerDef, EffectFn };
