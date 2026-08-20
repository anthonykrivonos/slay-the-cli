import { test, expect, describe } from "bun:test";
import { Rng, JavaRandom, javaShuffle, seedToString, seedFromString } from "../../src/engine/core/rng";
import vectors from "./fixtures/rng-vectors.json";

// Vectors are generated from sts_lightspeed's Random.h by tools/gen-rng-vectors.cpp.

describe("Rng (RandomXS128 port)", () => {
  test("random(99) sequences match reference for all seeds", () => {
    for (const [seed, expected] of Object.entries(vectors.random99)) {
      const r = new Rng(BigInt(seed));
      const got = (expected as number[]).map(() => r.random(99));
      expect(got).toEqual(expected as number[]);
      expect(r.counter).toBe((expected as number[]).length);
    }
  });

  test("randomRange(10,20) matches reference", () => {
    const r = new Rng(777n);
    const got = vectors.randomRange_777_10_20.map(() => r.randomRange(10, 20));
    expect(got).toEqual(vectors.randomRange_777_10_20);
  });

  test("randomFloat matches reference (float32 exact)", () => {
    const r = new Rng(2022n);
    for (const expected of vectors.randomFloat_2022) {
      expect(r.randomFloat()).toBe(Math.fround(expected));
    }
  });

  test("randomFloatRange(0.9, 1.1) matches reference (float32 exact)", () => {
    const r = new Rng(2022n);
    for (const expected of vectors.randomFloatRange_2022_0p9_1p1) {
      expect(r.randomFloatRange(0.9, 1.1)).toBe(Math.fround(expected));
    }
  });

  test("randomBoolean(0.4) matches reference", () => {
    const r = new Rng(555n);
    const got: number[] = vectors.randomBoolean_555_0p4.map(() => (r.randomBoolean(0.4) ? 1 : 0));
    expect(got).toEqual(vectors.randomBoolean_555_0p4 as number[]);
  });

  test("counter fast-forward constructor matches reference replay", () => {
    const r = new Rng(9999n, 137);
    expect(r.counter).toBe(137);
    expect(r.random(99)).toBe(vectors.counterFF_9999_137_next);
  });

  test("randomLongBounded(1000000) matches reference", () => {
    const r = new Rng(31337n);
    const got = vectors.randomLong_31337_1000000.map(() => Number(r.randomLongBounded(1000000n)));
    expect(got).toEqual(vectors.randomLong_31337_1000000);
  });

  test("state save/restore is exact", () => {
    const a = new Rng(4242n);
    for (let i = 0; i < 50; i++) a.random(99);
    const b = Rng.fromState(a.saveState());
    for (let i = 0; i < 50; i++) expect(b.random(99)).toBe(a.random(99));
    expect(b.counter).toBe(a.counter);
  });
});

describe("JavaRandom + shuffle", () => {
  test("nextInt(60) matches java.util.Random reference", () => {
    const jr = new JavaRandom(123456789n);
    const got = vectors.javaNextInt_123456789_60.map(() => jr.nextInt(60));
    expect(got).toEqual(vectors.javaNextInt_123456789_60);
  });

  test("Collections.shuffle matches reference", () => {
    const arr = Array.from({ length: 20 }, (_, i) => i);
    javaShuffle(arr, new JavaRandom(42n));
    expect(arr).toEqual(vectors.javaShuffle_42_20);
  });
});

describe("seed strings", () => {
  test("round-trips and known encodings", () => {
    for (const s of [0n, 1n, 35n, 12345678901234n, (1n << 64n) - 1n]) {
      expect(seedFromString(seedToString(s))).toBe(s);
    }
    // alphabet has no 'O'; 'O' folds onto 'N''s value on input
    expect(seedToString(seedFromString("HELLO"))).toBe(seedToString(seedFromString("HELLN")));
    // lowercase accepted
    expect(seedFromString("abc")).toBe(seedFromString("ABC"));
  });

  test("base-35 digit values", () => {
    expect(seedFromString("10")).toBe(35n);
    expect(seedFromString("Z")).toBe(34n);
    expect(seedFromString("A")).toBe(10n);
    expect(seedFromString("N")).toBe(23n);
    expect(seedFromString("P")).toBe(24n);
  });
});
