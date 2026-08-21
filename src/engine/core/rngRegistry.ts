// The game's named RNG streams and their exact lifecycle:
//  - Run-lifetime streams are all constructed from the run seed at run start and
//    tick counters for the whole run (their counters are what the game saves).
//  - Floor streams are re-seeded from (seed + floorNum) on every floor transition.
//  - mapRng is constructed per act from (seed + actOffset): act1 seed+1,
//    act2 seed+200, act3 seed+600 (offset = act==1 ? 1 : act*100*(act-1)).
//  - mathUtilRng is seeded from (seed - 897897).
// Content code never constructs Rng instances; it requests streams by name so
// misuse (e.g. merchantRng inside combat) is greppable and assertable.

import { Rng, type RngState } from "./rng";

export const RUN_STREAMS = [
  "cardRng", // card rewards + rarity pity
  "eventRng",
  "merchantRng",
  "monsterRng", // encounter list generation
  "neowRng",
  "potionRng",
  "relicRng",
  "treasureRng",
] as const;

export const FLOOR_STREAMS = [
  "aiRng",
  "cardRandomRng", // in-combat randomness: Snecko costs, random cards, random targets
  "miscRng",
  "monsterHpRng",
  "shuffleRng",
] as const;

export type RunStream = (typeof RUN_STREAMS)[number];
export type FloorStream = (typeof FLOOR_STREAMS)[number];
export type Stream = RunStream | FloorStream | "mapRng" | "mathUtilRng";

export interface RngRegistryState {
  seed: string; // bigint as string
  run: Record<RunStream, RngState>;
  floor: Record<FloorStream, RngState>;
  map: RngState;
  mathUtil: RngState;
}

export class RngRegistry {
  readonly seed: bigint;
  private streams = new Map<Stream, Rng>();

  constructor(seed: bigint) {
    this.seed = seed;
    for (const name of RUN_STREAMS) this.streams.set(name, new Rng(seed));
    this.streams.set("mathUtilRng", new Rng(seed - 897897n));
    this.reseedFloorStreams(0);
    this.reseedMap(1);
  }

  get(name: Stream): Rng {
    return this.streams.get(name)!;
  }

  /** Called on every floor transition (room enter), exactly like the game. */
  reseedFloorStreams(floorNum: number): void {
    for (const name of FLOOR_STREAMS) this.streams.set(name, new Rng(this.seed + BigInt(floorNum)));
  }

  /** Called at act start. Act offsets: 1 -> +1, 2 -> +200, 3 -> +600. */
  reseedMap(act: number): void {
    const offset = act === 1 ? 1n : BigInt(act * 100 * (act - 1));
    this.streams.set("mapRng", new Rng(this.seed + offset));
  }

  saveState(): RngRegistryState {
    const run = {} as Record<RunStream, RngState>;
    for (const name of RUN_STREAMS) run[name] = this.get(name).saveState();
    const floor = {} as Record<FloorStream, RngState>;
    for (const name of FLOOR_STREAMS) floor[name] = this.get(name).saveState();
    return {
      seed: this.seed.toString(),
      run,
      floor,
      map: this.get("mapRng").saveState(),
      mathUtil: this.get("mathUtilRng").saveState(),
    };
  }

  static fromState(s: RngRegistryState): RngRegistry {
    const reg = new RngRegistry(BigInt(s.seed));
    for (const name of RUN_STREAMS) reg.streams.set(name, Rng.fromState(s.run[name]));
    for (const name of FLOOR_STREAMS) reg.streams.set(name, Rng.fromState(s.floor[name]));
    reg.streams.set("mapRng", Rng.fromState(s.map));
    reg.streams.set("mathUtilRng", Rng.fromState(s.mathUtil));
    return reg;
  }
}
