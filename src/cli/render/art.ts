// Small original ASCII scene art (all drawn for this project — nothing copied)
// for the non-combat screens. Every piece is <= 8 rows, pure ASCII, and
// normalized to a uniform width so renderers can center/place it as a block.
// Art is ALWAYS the first thing a degradation ladder drops.

function norm(rows: string[]): { rows: string[]; w: number; h: number } {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return { rows: rows.map((r) => r.padEnd(w)), w, h: rows.length };
}

export interface Art {
  rows: string[];
  w: number;
  h: number;
}

/** Rest site: a crackling campfire. */
export const ART_CAMPFIRE: Art = norm([
  "     (   (",
  "    )  )  )",
  "   ( ( ( (",
  "    \\ \\|/ /",
  "     \\\\|//",
  "  ===--o--===",
  "   //     \\\\",
]);

/** Neow: the great glowing whale, regarding you. */
export const ART_WHALE: Art = norm([
  "          ______________",
  "     .--~~              ~~--.",
  "    /    (o)                 \\___",
  "   |                          ___)==--",
  "    \\        \\/          __--~",
  "     ~~--____/\\____--~~ \\  \\",
  "                         ~~~",
]);

/** Treasure room: a banded chest, latch shut. */
export const ART_CHEST: Art = norm([
  "   .-~~~~~~~~~~~~-.",
  "  /________________\\",
  "  |                |",
  "  |======[__]======|",
  "  |       ||       |",
  "  '----------------'",
]);

/** Shop: the merchant under his awning. */
export const ART_MERCHANT: Art = norm([
  "  ._._._._._._._._._._.",
  " /_/_/_/_/_/_/_/_/_/_/_\\",
  " |                     |",
  " |  [$]   .---.   [?]  |",
  " |        |o o|        |",
  " |  ___ __|\\_/|__ ___  |",
  " |_/___X_________X___\\_|",
]);

/** Menu / flourish: the Spire itself. */
export const ART_SPIRE: Art = norm([
  "         /\\",
  "        /  \\",
  "       /|/\\|\\",
  "      / |  | \\",
  "     /__|__|__\\",
  "    /|   ||   |\\",
  "   /_|___||___|_\\",
]);

// --- hero portraits (menu) -------------------------------------------------------
//
// Sprite-likeness portraits in several sizes, generated from the character
// images by tools/gen-hero-portraits.ts (see that file to regenerate). The
// menu shows the largest tier that fits beside the hero boxes.

import { HERO_PORTRAIT_ROWS } from "./heroPortraits";

export const HERO_PORTRAITS: Record<string, Art[]> = Object.fromEntries(
  Object.entries(HERO_PORTRAIT_ROWS).map(([id, tiers]) => [id, tiers.map(norm)]),
);

/** Largest portrait tier that fits in maxW x maxH, or null. */
export function pickPortrait(id: string, maxW: number, maxH: number): Art | null {
  const tiers = HERO_PORTRAITS[id];
  if (!tiers) return null;
  let best: Art | null = null;
  for (const t of tiers) {
    if (t.w <= maxW && t.h <= maxH) best = t;
  }
  return best;
}
