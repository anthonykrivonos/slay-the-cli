// All act-2 monsters (20 corpus entities) + the powers they introduce.
// Mirrors monsters/act1/index.ts; src/content/index.ts wires these into the
// base bundle with a later integration phase (tests import from here directly).

import type { MonsterDef, PowerDef } from "../../../engine/content/defs";
import { sphericGuardian } from "./sphericGuardian";
import { chosen } from "./chosen";
import { shelledParasite } from "./shelledParasite";
import { byrd } from "./byrd";
import { mugger } from "./mugger";
import { centurion, mystic } from "./centurionMystic";
import { snakePlant } from "./snakePlant";
import { snecko } from "./snecko";
import { bookOfStabbing } from "./bookOfStabbing";
import { gremlinLeader } from "./gremlinLeader";
import { taskmaster } from "./taskmaster";
import { bronzeAutomaton, bronzeOrb } from "./bronzeAutomaton";
import { theCollector, torchHead } from "./theCollector";
import { theChamp } from "./theChamp";
import { bear, pointy, romeo } from "./maskedBandits";
import { act2MonsterPowers } from "../../powers/monstersAct2";

export const act2Monsters: MonsterDef[] = [
  sphericGuardian,
  chosen,
  shelledParasite,
  byrd,
  mugger,
  centurion,
  mystic,
  snakePlant,
  snecko,
  bookOfStabbing,
  gremlinLeader,
  taskmaster,
  bronzeAutomaton,
  bronzeOrb,
  theCollector,
  torchHead,
  theChamp,
  bear,
  romeo,
  pointy,
];

export const act2Powers: PowerDef[] = [...act2MonsterPowers];
