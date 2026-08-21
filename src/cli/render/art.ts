// Original ASCII scene art (all drawn for this project — nothing copied) for
// the non-combat screens, normalized to a uniform width so renderers can
// center/place each piece as a block. The single-size pieces stay <= 8 rows;
// Neow comes in tiers so wide terminals get more of his likeness.
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

// --- Neow ------------------------------------------------------------------------
//
// Neow, drawn from his in-game likeness: a blunt whale head facing LEFT, body
// running off the right edge. The features are what make him recognizable, so
// every tier keeps all of them in the same places —
//   `( @ )`   the big dark eye, high on the brow, with a smaller eye up-right
//             of it and a third, smaller still, below it
//   `-X-`     the branching scar on his flank, right of centre
//   `* * *`   the row of small glowing eyes just above the mouth
//   `^^^`     the pale jagged tooth edge over a wide dark mouth (`===`)
// Tinted per character by renderNeow, so the mouth, glow and teeth carry their
// own colors instead of the whole block being one flat blue.

/**
 * Neow tiers, ascending width; the renderer takes the largest that fits. The
 * two short tiers spend their rows on the mouth (his most distinctive feature)
 * and leave the tooth edge to the tall ones.
 */
export const NEOW_TIERS: Art[] = [
  norm([
    "   .-~~~~~~~~~~~~~~~~",
    "  /   .-.   o      `-.",
    " |   ( @ )   \\       |",
    " |   * * *  -X-      +-",
    "  \\ ============   _/",
    "   `-.__________..--~",
  ]),
  norm([
    "     .-~~~~~~~~~~~~~~~",
    "   .~     .-.   o     `-.",
    "  /      ( @ )           \\",
    " |         `-'      \\     |",
    " |    *  *  *      -X-    +-",
    "  \\  ================ \\  _/",
    "   `-.______________..---~",
  ]),
  norm([
    "        .--~~~~~~~~~~~~~~~~~~~~~~~~~",
    "     .-~                            `--.",
    "   ./      .-.     o                    \\",
    "  /       ( @ )                          |",
    " |         `-'             \\             |",
    " |          .            --X-            +--",
    " |       *  *  *            |\\          /",
    "  \\   ^^^^^^^^^^^^^^^^^               _/",
    "   \\ ===========================    _/",
    "    `-.._______________________..--~",
  ]),
  norm([
    "            .---~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "        .--~                                      `---.",
    "     .-~        .-~~-.        ,-.                      `-.",
    "   ./          (  @@  )      ( o )                        \\",
    "  /             `-~~-'        `-'                          |",
    " |                                          \\   ,          |",
    " |                 .                       --X--           |",
    " |                                          '   \\          +---",
    " |         *    *    *                                    /",
    "  \\                                                     _/",
    "   \\    ^^^^^^^^^^^^^^^^^^^^^^^^^^^                  _/",
    "    \\  ==================================        _.-~",
    "     `-.._______________________________....---~~",
  ]),
];

/** The small tier, for callers that just want one block of whale. */
export const ART_WHALE: Art = NEOW_TIERS[0]!;

/** Largest Neow tier that fits in maxW x maxH, else the smallest. */
export function pickNeow(maxW: number, maxH: number): Art {
  let best = NEOW_TIERS[0]!;
  for (const t of NEOW_TIERS) {
    if (t.w <= maxW && t.h <= maxH) best = t;
  }
  return best;
}

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
