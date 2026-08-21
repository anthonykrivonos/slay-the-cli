// All act-1 monsters (25 corpus entities) + the powers they introduce.
// src/content/index.ts wires these into the base bundle (integration lands
// with a later phase; tests import from here directly).

import type { MonsterDef, PowerDef } from "../../../engine/content/defs";
import { jawWorm } from "./jawWorm";
import { cultist } from "./cultist";
import { greenLouse, redLouse } from "./louses";
import { acidSlimeL, acidSlimeM, acidSlimeS, spikeSlimeL, spikeSlimeM, spikeSlimeS } from "./slimes";
import { fatGremlin, gremlinWizard, madGremlin, shieldGremlin, sneakyGremlin } from "./gremlins";
import { looter } from "./looter";
import { fungiBeast } from "./fungiBeast";
import { blueSlaver, redSlaver } from "./slavers";
import { gremlinNob } from "./gremlinNob";
import { lagavulin } from "./lagavulin";
import { sentry } from "./sentry";
import { slimeBoss } from "./slimeBoss";
import { theGuardian } from "./theGuardian";
import { hexaghost } from "./hexaghost";
import { act1MonsterPowers } from "../../powers/monstersAct1";

export const act1Monsters: MonsterDef[] = [
  cultist,
  jawWorm,
  redLouse,
  greenLouse,
  acidSlimeS,
  acidSlimeM,
  acidSlimeL,
  spikeSlimeS,
  spikeSlimeM,
  spikeSlimeL,
  madGremlin,
  sneakyGremlin,
  fatGremlin,
  shieldGremlin,
  gremlinWizard,
  looter,
  fungiBeast,
  blueSlaver,
  redSlaver,
  gremlinNob,
  lagavulin,
  sentry,
  slimeBoss,
  theGuardian,
  hexaghost,
];

export const act1Powers: PowerDef[] = [...act1MonsterPowers];
