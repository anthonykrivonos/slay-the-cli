// Java-float (32-bit) arithmetic helpers. The game computes damage/block in
// Java floats; exact rounding of chains like Frail 0.75f x Vulnerable 1.5f
// depends on rounding to float32 after every operation.

export const f32 = Math.fround;

export const f32mul = (a: number, b: number): number => Math.fround(Math.fround(a) * Math.fround(b));
export const f32add = (a: number, b: number): number => Math.fround(Math.fround(a) + Math.fround(b));
export const f32sub = (a: number, b: number): number => Math.fround(Math.fround(a) - Math.fround(b));

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
