# Slay the CLI

Slay the Spire (V2.3.4), adapted faithfully to the command line. The whole
climb is here: 370 cards, 181 relics, 42 potions, 65 monsters, 51 events, all
four characters, Ascension 0 to 20, Acts 1 through 4 and the Corrupt Heart.
Every number and behavior comes from audited data rather than memory. Pure
TypeScript, deterministic, no runtime dependencies, drawn in plain ASCII with
ANSI color.

## Play

```sh
bun src/cli/main.ts
bun src/cli/main.ts --seed SPIRE --character WATCHER --ascension 20
bun src/cli/main.ts --no-color        # also honors NO_COLOR
```

Needs an interactive terminal, at least 80x24. The layout is fluid and uses
everything you give it: enemy panels, card-shaped boxes, scene art and a bottom
INFO panel appear as the window grows, and at 80x24 every screen compacts to
dense one-liners. Number keys select, letters act (`e` end turn, `l` combat log,
`d` deck, `p` potions, `q` quit). `Tab` and the arrow keys move a read-only
hover cursor whose target is explained in the INFO panel; on menus and lists
that cursor doubles as a selection (`Enter` activates, `Esc` clears). Runs save
to `~/.slay/` after every action (`SLAY_DIR` overrides), and `c` on the menu
resumes the last one. If the process is hard-killed the terminal may need
`reset`.

## Develop

```sh
bun test                          # full suite
bun tools/corpus/check-all.ts     # corpus ground-truth audit
bun tools/fuzz.ts --seeds 500     # long-run combat fuzzing
bun run build                     # compile a single binary to dist/slay
```

Layout: `src/engine` (the pure deterministic core, with a bit-exact RNG, action
queue and damage pipeline), `src/content` (the forkable game-content bundle),
`src/cli` (the TUI: a pure snapshot-tested renderer plus a thin terminal
driver), `data/corpus` (audited ground-truth data, read by tests and tools
only).

Mechanics, numbers and behavior mirror the original game exactly, and the few
deliberate deviations are flagged in code. The repo holds no binary assets and
no text from the game itself. Event prose is paraphrased, and the scene art is
original except for the menu hero portraits, which are low-resolution ASCII
renderings derived from the game's character art (see `tools/ascii-art.ts`).
Slay the Spire is by MegaCrit. Buy it. This is a fan reimplementation for
private use.
