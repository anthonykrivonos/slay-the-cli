// Relics workstream exports. The bundle assembler (src/content/index.ts, owned
// by the integration workstream) merges:
//   - allRelics into bundle.relics
//   - relicSupportPowers into bundle.powers (map-merge by id; defs shared with
//     other workstreams are corpus-identical)
//   - contentEffects into bundle.effects (choice continuations; also registered
//     lazily at request time so tests work off a raw merge)

import type { EffectFn, RelicDef } from "../../engine/content/defs";
import { starterRelics } from "./starter";
import { commonRelics } from "./common";
import { uncommonRelics } from "./uncommon";
import { rareRelics } from "./rare";
import { bossRelics } from "./boss";
import { shopRelics } from "./shop";
import { eventRelics } from "./event";
import { contentEffects as libEffects } from "./lib";
import { pickupEffects } from "./pickup";

export const allRelics: RelicDef[] = [
  ...starterRelics,
  ...commonRelics,
  ...uncommonRelics,
  ...rareRelics,
  ...bossRelics,
  ...shopRelics,
  ...eventRelics,
];

export { relicSupportPowers } from "./supportPowers";

/** Choice continuations merged into bundle.effects (also registered lazily at
 *  request time, so tests working off a raw merge still resume). */
export const contentEffects: ReadonlyArray<readonly [string, EffectFn]> = [...libEffects, ...pickupEffects];
