// Fluid layout math shared by the per-screen renderers. Everything here is
// pure and TOTAL: every function returns a sane value at any (cols, rows),
// including absurdly small ones - the degradation ladders in the renderers
// decide what to draw, this module only does the arithmetic.

import { padClip } from "./widgets";

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Do n blocks of width w with `gap` columns between them fit in avail? */
export function fits(n: number, w: number, gap: number, avail: number): boolean {
  if (n <= 0) return true;
  return n * w + (n - 1) * gap <= avail;
}

/** Total width of n blocks of width w separated by gap. */
export function rowWidth(n: number, w: number, gap: number): number {
  if (n <= 0) return 0;
  return n * w + (n - 1) * gap;
}

/** Gap that lets n blocks of width w fit in avail: 1 if it fits, else 0. */
export function rowGap(n: number, w: number, avail: number): 0 | 1 {
  return fits(n, w, 1, avail) ? 1 : 0;
}

/** Row-wise concatenation of column blocks. Every row of every block is
 *  padClip'd to its column width FIRST (so styled rows keep their SGR codes
 *  as long as they fit), then joined with `gap` spaces after `leftPad`.
 *  Output height = tallest block; shorter blocks pad with blanks. */
export function joinBlocks(blocks: string[][], widths: number[], gap: number, leftPad: number): string[] {
  const h = blocks.reduce((m, b) => Math.max(m, b.length), 0);
  const out: string[] = [];
  const sep = " ".repeat(Math.max(0, gap));
  const pad = " ".repeat(Math.max(0, leftPad));
  for (let r = 0; r < h; r++) {
    const cells = blocks.map((b, i) => padClip(b[r] ?? "", widths[i] ?? 0));
    out.push(pad + cells.join(sep));
  }
  return out;
}

/** Distribute the leftover rows (avail - fixed) across gap slots by weight.
 *  Returns one extra-row count per weight; earlier slots win remainders.
 *  Never negative - when the fixed content overflows, all gaps are 0. */
export function flexFill(avail: number, fixed: number, weights: number[]): number[] {
  const extra = Math.max(0, avail - fixed);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);
  const out = weights.map((w) => Math.floor((extra * w) / total));
  let used = out.reduce((a, b) => a + b, 0);
  // hand out the remainder to the heaviest slots first (earlier wins ties)
  const order = weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w - a.w || a.i - b.i);
  for (const { i } of order) {
    if (used >= extra) break;
    out[i]! += 1;
    used += 1;
  }
  return out;
}

/** Rows reserved for the bottom tooltip/info panel (shared frame chrome):
 *  1 rule + 2-3 content lines on roomy terminals, nothing below that. */
export function tipHeight(bodyH: number): number {
  return bodyH >= 30 ? 4 : bodyH >= 24 ? 3 : 0;
}
