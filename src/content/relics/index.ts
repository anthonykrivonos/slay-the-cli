// Relics workstream exports. The bundle assembler (src/content/index.ts, owned
// by the integration workstream) merges:
//   - allRelics into bundle.relics
//   - relicSupportPowers into bundle.powers (map-merge by id; defs shared with
//     other workstreams are corpus-identical)
//   - contentEffects into bundle.effects (choice continuations; also registered
//     lazily at request time so tests work off a raw merge)

import type { RelicDef } from "../../engine/content/defs";
import { starterRelics } from "./starter";
import { commonRelics } from "./common";
import { uncommonRelics } from "./uncommon";
import { rareRelics } from "./rare";
import { bossRelics } from "./boss";
import { shopRelics } from "./shop";
import { eventRelics } from "./event";

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
export { contentEffects } from "./lib";
