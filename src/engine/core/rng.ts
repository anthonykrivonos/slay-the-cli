// Exact port of Slay the Spire's RNG stack (via sts_lightspeed's replication):
//  - sts.Random: libGDX RandomXS128 (xorshift128+) with murmurhash3 seed scrambling
//    and a call counter (every public random* call increments it).
//  - java.Random: the 48-bit LCG used (seeded from an sts.Random long) for
//    Collections.shuffle-style pile shuffles.
//  - SeedHelper: base-35 seed strings (alphabet excludes the letter O).
// All 64-bit arithmetic uses BigInt with explicit masking; float results are
// coerced through Math.fround to match Java float semantics.

const U64 = (1n << 64n) - 1n;
const u64 = (x: bigint): bigint => x & U64;
const i64 = (x: bigint): bigint => BigInt.asIntN(64, x);

const MURMUR_C1 = 0xff51afd7ed558ccdn;
const MURMUR_C2 = 0xc4ceb9fe1a85ec53n;
const ONE_IN_MOST_SIGNIFICANT = 1n << 63n;

const NORM_DOUBLE = 1.1102230246251565e-16; // 2^-53
const NORM_FLOAT = 5.9604644775390625e-8; // 2^-24

function murmurHash3(x: bigint): bigint {
  x = u64(x ^ (x >> 33n));
  x = u64(x * MURMUR_C1);
  x = u64(x ^ (x >> 33n));
  x = u64(x * MURMUR_C2);
  x = u64(x ^ (x >> 33n));
  return x;
}

export interface RngState {
  seed0: string;
  seed1: string;
  counter: number;
}

export class Rng {
  counter = 0;
  private seed0: bigint;
  private seed1: bigint;

  constructor(seed: bigint, targetCounter?: number) {
    // mask to u64 FIRST — callers pass seed+offset which must wrap like C++/Java
    const s = u64(seed);
    this.seed0 = murmurHash3(s === 0n ? ONE_IN_MOST_SIGNIFICANT : s);
    this.seed1 = murmurHash3(this.seed0);
    if (targetCounter !== undefined) {
      // Faithful to the game's save-restore: fast-forward by replaying random(999).
      for (let i = 0; i < targetCounter; i++) this.random(999);
    }
  }

  // --- raw generator (does NOT touch the counter) ---
  private nextLong(): bigint {
    let s1 = this.seed0;
    const s0 = this.seed1;
    this.seed0 = s0;
    s1 = u64(s1 ^ (s1 << 23n));
    this.seed1 = u64(s1 ^ s0 ^ (s1 >> 17n) ^ (s0 >> 26n));
    return u64(this.seed1 + s0);
  }

  /** bounded nextLong via rejection sampling; n > 0 */
  private nextLongBounded(n: bigint): bigint {
    let bits: bigint, value: bigint;
    do {
      bits = this.nextLong() >> 1n;
      value = bits % n;
    } while (i64(bits - value + n - 1n) < 0n);
    return value;
  }

  private nextIntBounded(n: number): number {
    return Number(this.nextLongBounded(BigInt(n)));
  }

  private nextFloat(): number {
    return Math.fround(Number(this.nextLong() >> 40n) * NORM_FLOAT);
  }

  private nextDouble(): number {
    return Number(this.nextLong() >> 11n) * NORM_DOUBLE;
  }

  // --- public API (each call ticks the counter, mirroring the game) ---
  /** integer in [0, range] INCLUSIVE (the game's Random.random(int)) */
  random(range: number): number {
    this.counter++;
    return this.nextIntBounded(range + 1);
  }

  /** integer in [start, end] inclusive */
  randomRange(start: number, end: number): number {
    this.counter++;
    return start + this.nextIntBounded(end - start + 1);
  }

  /** float32 in [0, 1) */
  randomFloat(): number {
    this.counter++;
    return this.nextFloat();
  }

  /** float32 in [0, range) */
  randomFloatUpTo(range: number): number {
    this.counter++;
    return Math.fround(this.nextFloat() * Math.fround(range));
  }

  /** float32 in [start, end) */
  randomFloatRange(start: number, end: number): number {
    this.counter++;
    return Math.fround(Math.fround(start) + this.nextFloat() * Math.fround(Math.fround(end) - Math.fround(start)));
  }

  /** long in [0, range) via double truncation (the game's Random.random(long)) */
  randomLongBounded(range: bigint): bigint {
    this.counter++;
    return BigInt(Math.trunc(this.nextDouble() * Number(range)));
  }

  randomLong(): bigint {
    this.counter++;
    return this.nextLong();
  }

  randomBoolean(chance?: number): boolean {
    this.counter++;
    if (chance === undefined) return (this.nextLong() & 1n) !== 0n;
    return this.nextFloat() < Math.fround(chance);
  }

  /** Faithful to the game's setCounter: advance by replaying randomBoolean(). */
  setCounter(targetCounter: number): void {
    while (this.counter < targetCounter) this.randomBoolean();
  }

  /**
   * Raw bounded int in [0, n) WITHOUT ticking the counter — the map generator's
   * in-place room shuffle uses this internal directly (ported exactly).
   */
  nextIntRaw(n: number): number {
    return this.nextIntBounded(n);
  }

  // --- exact state snapshot (our save format stores this; counter kept for parity checks) ---
  saveState(): RngState {
    return { seed0: this.seed0.toString(), seed1: this.seed1.toString(), counter: this.counter };
  }

  static fromState(s: RngState): Rng {
    const r = new Rng(1n);
    r.seed0 = BigInt(s.seed0);
    r.seed1 = BigInt(s.seed1);
    r.counter = s.counter;
    return r;
  }
}

// --- java.util.Random (48-bit LCG) + Collections.shuffle ----------------------
const J_MULT = 0x5deece66dn;
const J_ADD = 0xbn;
const J_MASK = (1n << 48n) - 1n;

export class JavaRandom {
  private seed: bigint;

  constructor(seed: bigint) {
    this.seed = (u64(seed) ^ J_MULT) & J_MASK;
  }

  private next(bits: number): number {
    this.seed = (this.seed * J_MULT + J_ADD) & J_MASK;
    return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
  }

  nextInt(bound: number): number {
    let r = this.next(31);
    const m = bound - 1;
    if ((bound & m) === 0) {
      r = Number((BigInt(bound) * BigInt(r)) >> 31n);
    } else {
      // int32 overflow in (u - r + m) is the rejection signal — emulate with |0
      for (let u = r; ((u - (r = u % bound) + m) | 0) < 0; u = this.next(31));
    }
    return r;
  }
}

/** Java Collections.shuffle as used by the game (in place). */
export function javaShuffle<T>(arr: T[], rnd: JavaRandom): void {
  for (let i = arr.length; i > 1; i--) {
    const j = rnd.nextInt(i);
    const tmp = arr[i - 1]!;
    arr[i - 1] = arr[j]!;
    arr[j] = tmp;
  }
}

// --- seed strings --------------------------------------------------------------
const SEED_BASE = 35n;
const SEED_CHARS = "0123456789ABCDEFGHIJKLMNPQRSTUVWXYZ"; // no letter O

export function seedToString(seed: bigint): string {
  let uSeed = u64(seed);
  let str = "";
  do {
    const rem = Number(uSeed % SEED_BASE);
    uSeed = uSeed / SEED_BASE;
    str += SEED_CHARS[rem];
  } while (uSeed !== 0n);
  return [...str].reverse().join("");
}

export function seedFromString(seed: string): bigint {
  let ret = 0n;
  for (const raw of seed) {
    const c = raw.toUpperCase();
    const code = c.charCodeAt(0);
    let value: number;
    if (code < 65 /* 'A' */) value = code - 48; /* '0' */
    else if (code < 79 /* 'O' */) value = code - 65 + 10;
    else value = code - 65 + 9;
    ret = u64(ret * SEED_BASE + BigInt(value));
  }
  return ret;
}
