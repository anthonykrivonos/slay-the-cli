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
// Original archetype drawings (nothing traced or converted from any image):
// an armored knight, a hooded rogue, an automaton with its orb, and a
// meditating monk. <= 12 rows each; shown beside the menu on wide terminals.

const HERO_IRONCLAD: Art = norm([
  "        .-\"\"-.",
  "       /|____|\\",
  "      | [ o o ] |",
  "      _\\  --  /_",
  "   .-'  '----'  '-.",
  "  / |   .-++-.   | \\",
  " |] |  /  ||  \\  | [|",
  " |] | |   ||   | | [|",
  "  \\ |  \\__||__/  | /",
  "    |     ||     |",
  "   /|_____||_____|\\",
  "  '======[==]======'",
]);

const HERO_SILENT: Art = norm([
  "        _____",
  "      .'     '.",
  "     /  _____  \\",
  "    |  /     \\  |",
  "    | | -   - | |",
  "     \\|   \\   |/",
  "  \\   \\  ---  /   /",
  "   \\.  '.___.'  ./",
  "    \\\\  |   |  //",
  "     \\> |   | </",
  "      ` |___| `",
  "       /__|__\\",
]);

const HERO_DEFECT: Art = norm([
  "      ________",
  "     | ______ |",
  "     || o  o ||     .-.",
  "     ||  __  ||    ( o )",
  "     ||______||     '-'",
  "    _|________|_   *",
  "   | |##|  |##| | *",
  "  [| |::|--|::| |]",
  "   |_|::|__|::|_|",
  "     |___||___|",
  "     |___||___|",
  "    _|__|  |__|_",
]);

const HERO_WATCHER: Art = norm([
  "         .--.",
  "        /    \\",
  "       | -  - |",
  "        \\ __ /",
  "      .-'    '-.",
  "     /  |    |  \\",
  "    |   |    |   |",
  "  .-\\   |____|   /-.",
  " (   '--|    |--'   )",
  "  '-.__/      \\__.-'",
  "   ( _/--.__.--\\_ )",
  "    '--__|__|__--'",
]);

/** Portrait per menu character id. */
export const ART_HEROES: Record<string, Art> = {
  IRONCLAD: HERO_IRONCLAD,
  SILENT: HERO_SILENT,
  DEFECT: HERO_DEFECT,
  WATCHER: HERO_WATCHER,
};
