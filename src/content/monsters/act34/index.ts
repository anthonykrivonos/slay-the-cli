// All act-3 + act-4 monsters (20 corpus entities) + the powers they
// introduce. src/content/index.ts wires these into the base bundle.
//
// Multi-monster boss/elite encounters: the run layer resolves them via
// ActDef.bossEncounters (acts.ts act 3 carries AWAKENED_ONE and
// DONU_AND_DECA) and runFlow's fixed act-4 lineups (SHIELD_AND_SPEAR,
// THE_HEART). act34BossEncounters below restates the corpus lineups for
// reference/tests. As a defensive fallback the Awakened One's preBattle also
// appends the two Cultists when it is spawned alone - note that path rolls
// the boss's HP before the Cultists' (reordered monsterHpRng stream vs the
// reference; the bossEncounters lineup rolls in true slot order).

import type { MonsterDef, PowerDef } from "../../../engine/content/defs";
import type { MonsterId } from "../../../engine/core/ids";
import { darkling } from "./darkling";
import { orbWalker } from "./orbWalker";
import { exploder, repulsor, spiker } from "./shapes";
import { transient } from "./transient";
import { theMaw } from "./theMaw";
import { spireGrowth } from "./spireGrowth";
import { writhingMass } from "./writhingMass";
import { giantHead } from "./giantHead";
import { nemesis } from "./nemesis";
import { dagger, reptomancer } from "./reptomancer";
import { awakenedOne } from "./awakenedOne";
import { timeEater } from "./timeEater";
import { deca, donu } from "./donuDeca";
import { spireShield, spireSpear } from "./spireShieldSpear";
import { corruptHeart } from "./corruptHeart";
import { act34MonsterPowers } from "../../powers/monstersAct34";

export const act34Monsters: MonsterDef[] = [
  darkling,
  orbWalker,
  spiker,
  repulsor,
  exploder,
  transient,
  theMaw,
  spireGrowth,
  writhingMass,
  giantHead,
  nemesis,
  reptomancer,
  dagger,
  awakenedOne,
  timeEater,
  donu,
  deca,
  spireShield,
  spireSpear,
  corruptHeart,
];

export const act34Powers: PowerDef[] = [...act34MonsterPowers];

/** Boss/act-4 encounter id -> monster lineup (slot order per the corpus). */
export const act34BossEncounters: Record<string, MonsterId[]> = {
  AWAKENED_ONE: ["CULTIST", "CULTIST", "AWAKENED_ONE"],
  TIME_EATER: ["TIME_EATER"],
  DONU_AND_DECA: ["DECA", "DONU"],
  SHIELD_AND_SPEAR: ["SPIRE_SHIELD", "SPIRE_SPEAR"],
  THE_HEART: ["CORRUPT_HEART"],
};
