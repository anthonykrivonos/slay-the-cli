# slay

A mechanically exact Slay the Spire (V2.3.4) clone as a full-terminal game.
Pure-TypeScript deterministic engine, data-audited content (370 cards, 181
relics, 42 potions, 65 monsters, 51 events, all 4 characters, Ascension 0–20,
Acts 1–4 through the Corrupt Heart), rendered as a plain-ASCII + ANSI-color TUI.

## Play

```sh
bun src/cli/main.ts
bun src/cli/main.ts --seed SPIRE --character WATCHER --ascension 20
bun src/cli/main.ts --no-color        # also honors NO_COLOR
```

Needs an interactive terminal, at least 80×24 — the layout is fluid and uses
everything you give it (panels, card boxes, scene art and a bottom INFO panel
appear as the window grows; at 80×24 screens compact to dense one-liners).
Number keys select, letters act (`e` end turn, `l` combat log, `d` deck,
`p` potions, `q` quit). `Tab`/arrows move a read-only hover cursor whose
target is explained in the INFO panel — on menus and lists it doubles as a
selection cursor (`Enter` activates, `Esc` clears). Runs save to `~/.slay/`
after every action (`SLAY_DIR` overrides); `c` on the menu continues.
If the process is hard-killed the terminal may need `reset`.

## Develop

```sh
bun test                          # full suite
bun tools/corpus/check-all.ts     # corpus ground-truth audit
bun tools/fuzz.ts --seeds 500     # long-run combat fuzzing
bun run build                     # compile a single binary to dist/slay
```

Layout: `src/engine` (pure deterministic core — bit-exact RNG, action queue,
damage pipeline), `src/content` (the forkable game-content bundle),
`src/cli` (TUI: pure snapshot-tested renderer + thin terminal driver),
`data/corpus` (audited ground-truth data; tests/tools only).

Mechanics, numbers, and behavior mirror the original game exactly (documented
deviations are flagged in code). Contains no binary assets or text from the
game itself; event/narrative text is paraphrased and the scene art is
original — except the menu hero portraits, which are low-resolution ASCII
renderings derived from the game's character art (via `tools/ascii-art.ts`).
Slay the Spire is by MegaCrit — buy it; this is a fan reimplementation for
private use.
