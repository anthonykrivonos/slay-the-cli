// Color themes. THEME_256 maps the salvaged hex tables onto xterm-256 with a
// pure quantizer (no Bun.color — render/ stays OS-free). THEME_PLAIN is the
// identity theme used for snapshots, NO_COLOR, --no-color, and non-TTY pipes.

import { fg256, sgr, RESET } from "../term/ansi";

export interface Theme {
  /** foreground color from a #rrggbb hex */
  fg(hex: string, s: string): string;
  bold(s: string): string;
  dim(s: string): string;
  inverse(s: string): string;
}

export const THEME_PLAIN: Theme = {
  fg: (_hex, s) => s,
  bold: (s) => s,
  dim: (s) => s,
  inverse: (s) => s,
};

/** Nearest xterm-256 index for a #rrggbb hex (6x6x6 cube + grayscale ramp). */
export function hexToAnsi256(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 7;
  const v = Number.parseInt(m[1]!, 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  const levels = [0, 95, 135, 175, 215, 255];
  const nearestLevel = (c: number): number => {
    let best = 0;
    for (let i = 1; i < 6; i++) if (Math.abs(levels[i]! - c) < Math.abs(levels[best]! - c)) best = i;
    return best;
  };
  const ri = nearestLevel(r);
  const gi = nearestLevel(g);
  const bi = nearestLevel(b);
  const cubeIdx = 16 + 36 * ri + 6 * gi + bi;
  const cubeDist = (levels[ri]! - r) ** 2 + (levels[gi]! - g) ** 2 + (levels[bi]! - b) ** 2;
  // grayscale ramp 232..255: 8 + 10*i
  const grayLevel = Math.max(0, Math.min(23, Math.round((((r + g + b) / 3) - 8) / 10)));
  const gv = 8 + 10 * grayLevel;
  const grayDist = (gv - r) ** 2 + (gv - g) ** 2 + (gv - b) ** 2;
  return grayDist < cubeDist ? 232 + grayLevel : cubeIdx;
}

const cache = new Map<string, string>();
function code(hex: string): string {
  let c = cache.get(hex);
  if (c === undefined) {
    c = fg256(hexToAnsi256(hex));
    cache.set(hex, c);
  }
  return c;
}

export const THEME_256: Theme = {
  fg: (hex, s) => `${code(hex)}${s}${RESET}`,
  bold: (s) => `${sgr(1)}${s}${RESET}`,
  dim: (s) => `${sgr(2)}${s}${RESET}`,
  inverse: (s) => `${sgr(7)}${s}${RESET}`,
};

// Shared palette roles (hexes lifted from the web UI's tables).
export const C = {
  hp: "#e88a8a",
  gold: "#ffe9a0",
  block: "#9fb8e8",
  energy: "#ffe9a0",
  intent: "#ff9e6e",
  good: "#6fce87",
  bad: "#e06a7a",
  dim: "#6f7a92",
  text: "#c9d0e0",
  bright: "#f0e8d2",
  pick: "#6fce87",
  current: "#ffd75e",
  burning: "#ff8c3a",
  purple: "#b98ad6",
} as const;
