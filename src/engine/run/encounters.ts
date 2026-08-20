// Exact encounter-list generation (sts_lightspeed GameContext.cpp:526-632, via
// data/corpus/meta.json "encounters"). Per act, using monsterRng exclusively:
//   1. weak list: act1 rolls 3 entries, acts 2-3 roll 2 (uniform weights)
//   2. strong list: 1 "first strong" (with slime/louse follow exclusions) + 12
//   3. elite list: 10 entries, equal 1/3 odds, no immediate repeat
//   4. boss order: indices {0,1,2} java.Collections.shuffle'd with a
//      java.Random seeded from monsterRng.randomLong()
// Weighted rolls walk cumulative float32 weights; a candidate equal to either
// of the last TWO entries of the combined weak+strong list is rerolled.

import type { ActDef } from "../content/defs";
import type { MonsterId } from "../core/ids";
import { Rng, JavaRandom, javaShuffle } from "../core/rng";
import { f32, f32add } from "../core/math";

/** meta.encounters.listLengths — audited against the corpus by tests. */
export const ENCOUNTER_LIST_LENGTHS = {
  weakGeneratedPerAct: { act1: 3, act2: 2, act3: 2 },
  strongGenerated: 13, // 1 first strong + 12
  eliteGenerated: 10,
} as const;

/** rollWeightedIdx: cumulative float32 weight walk; overflow returns last index. */
export function rollWeightedIdx(roll: number, weights: number[]): number {
  let cur = 0;
  for (let i = 0; i < weights.length; i++) {
    cur = f32add(cur, weights[i]!);
    if (roll < cur) return i;
  }
  return weights.length - 1;
}

const REROLL_CAP = 10000;

/** populateMonsterList: candidate rerolled while equal to the last entry or the
 *  second-to-last entry of the (shared) list. */
function populateMonsterList(list: string[], ids: string[], weights: number[], count: number, rng: Rng): void {
  let guard = 0;
  for (let i = 0; i < count; i++) {
    const toAdd = ids[rollWeightedIdx(rng.randomFloat(), weights)]!;
    if (list.length > 0) {
      if (toAdd === list[list.length - 1] || (list.length > 1 && toAdd === list[list.length - 2])) {
        i--;
        if (++guard > REROLL_CAP) throw new Error("encounter pool too small for no-repeat rule");
        continue;
      }
    }
    list.push(toAdd);
  }
}

/** populateFirstStrongEnemy: reroll while the candidate is an excluded follow-up
 *  of the LAST weak encounter (meta.encounters.rolls.repeatRules.firstStrong). */
function populateFirstStrongEnemy(list: string[], ids: string[], weights: number[], rng: Rng): void {
  const last = list[list.length - 1];
  let guard = 0;
  for (;;) {
    const toAdd = ids[rollWeightedIdx(rng.randomFloat(), weights)]!;
    if ((toAdd === "LARGE_SLIME" || toAdd === "LOTS_OF_SLIMES") && last === "SMALL_SLIMES") {
      if (++guard > REROLL_CAP) throw new Error("first-strong reroll cap");
      continue;
    }
    if (toAdd === "THREE_LOUSE" && last === "TWO_LOUSE") {
      if (++guard > REROLL_CAP) throw new Error("first-strong reroll cap");
      continue;
    }
    list.push(toAdd);
    return;
  }
}

export interface GeneratedEncounters {
  /** weak entries first, then 13 strong entries; consumed front-first by monster rooms */
  monsterList: string[];
  /** 10 entries; consumed front-first by elite rooms */
  eliteList: string[];
  /** full shuffled boss order; bossOrder[0] is this act's boss ([1] = A20 second boss) */
  bossOrder: MonsterId[];
}

export function generateEncounters(actDef: ActDef, monsterRng: Rng): GeneratedEncounters {
  const monsterList: string[] = [];

  // weak (uniform weights: 1/4, 1/5, 1/3 per act — always 1/poolSize)
  const weakIds = actDef.weakEncounters.map((e) => e.id);
  const weakWeights = weakIds.map(() => f32(1 / weakIds.length));
  populateMonsterList(monsterList, weakIds, weakWeights, actDef.weakCount, monsterRng);

  // strong: fractions numerator/total, accumulated in float32 like the reference
  const strongIds = actDef.strongEncounters.map((e) => e.id);
  const strongTotal = actDef.strongEncounters.reduce((s, e) => s + e.weight, 0);
  const strongWeights = actDef.strongEncounters.map((e) => f32(e.weight / strongTotal));
  populateFirstStrongEnemy(monsterList, strongIds, strongWeights, monsterRng);
  populateMonsterList(monsterList, strongIds, strongWeights, 12, monsterRng);

  // elites: equal thirds, reroll while equal to the previous elite
  const eliteIds = actDef.elites.map((e) => e.id);
  const eliteWeights = eliteIds.map(() => f32(1 / eliteIds.length));
  const eliteList: string[] = [];
  let guard = 0;
  for (let i = 0; i < ENCOUNTER_LIST_LENGTHS.eliteGenerated; i++) {
    const toAdd = eliteIds[rollWeightedIdx(monsterRng.randomFloat(), eliteWeights)]!;
    if (eliteList.length > 0 && toAdd === eliteList[eliteList.length - 1] && eliteIds.length > 1) {
      i--;
      if (++guard > REROLL_CAP) throw new Error("elite reroll cap");
      continue;
    }
    eliteList.push(toAdd);
  }

  // boss order: java shuffle of indices seeded from one monsterRng long
  const idxs = actDef.bosses.map((_, i) => i);
  javaShuffle(idxs, new JavaRandom(monsterRng.randomLong()));
  const bossOrder = idxs.map((i) => actDef.bosses[i]!);

  return { monsterList, eliteList, bossOrder };
}

/** Top up an exhausted monster list with fresh strong rolls (same weights and
 *  repeat rules, applied to the new batch). TODO: the reference extends the
 *  original list so repeat checks see its tail; near-unreachable in practice. */
export function generateExtraStrongEncounters(actDef: ActDef, monsterRng: Rng, count: number): string[] {
  const strongIds = actDef.strongEncounters.map((e) => e.id);
  const strongTotal = actDef.strongEncounters.reduce((s, e) => s + e.weight, 0);
  const strongWeights = actDef.strongEncounters.map((e) => f32(e.weight / strongTotal));
  const list: string[] = [];
  populateMonsterList(list, strongIds, strongWeights, count, monsterRng);
  return list;
}

/** Resolve an encounter id to its monster slots via the act's tables (bosses
 *  resolve to themselves: bossList stores MonsterIds directly). */
export function resolveEncounter(actDef: ActDef, encounterId: string): MonsterId[] {
  for (const e of actDef.weakEncounters) if (e.id === encounterId) return e.monsters;
  for (const e of actDef.strongEncounters) if (e.id === encounterId) return e.monsters;
  for (const e of actDef.elites) if (e.id === encounterId) return e.monsters;
  if (actDef.bosses.includes(encounterId)) return [encounterId];
  throw new Error(`unknown encounter ${encounterId} in act ${actDef.act}`);
}

export function getActDef(acts: ActDef[], act: number): ActDef {
  const def = acts.find((a) => a.act === act);
  if (!def) throw new Error(`bundle has no ActDef for act ${act}`);
  return def;
}
