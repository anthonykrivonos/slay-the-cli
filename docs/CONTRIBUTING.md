# Contributing

Bug reports and fixes are welcome. The bar is high in one specific direction:
this is a clone, so "matches the original" beats "reads nicer" every time.

## Setup

```sh
git clone https://github.com/anthonykrivonos/slay-the-cli.git
cd slay-the-cli
bun install
```

Contributing needs [Bun](https://bun.sh), even though playing does not: every
test file imports `bun:test`, and the binary is compiled by `bun build`.

Before you open a pull request:

```sh
bun test        # the whole suite, all of it must pass
bun run audit   # must print "corpus audit clean"
```

## Scripts

Every task has a package script, so `npm run <name>`, `pnpm <name>`,
`yarn <name>` and `bun run <name>` all reach it. The scripts shell out to Bun,
because the test runner and the compiler are Bun's.

```sh
bun test           # npm test       full suite
bun run audit      # npm run audit  corpus ground-truth audit
bun run fuzz       # npm run fuzz   long-run combat fuzzing
bun run build      # npm run build  compile a single binary to dist/slay
bun run fixtures   #                regenerate the UI snapshots
bun run shots      #                regenerate the README screenshots
bun run dev:bun    # npm run dev    watch mode
```

## Layout

| path | what it is |
| --- | --- |
| `src/engine` | the pure deterministic core: a bit-exact RNG, the action queue, the damage pipeline |
| `src/content` | the forkable game-content bundle |
| `src/cli` | the TUI: a pure snapshot-tested renderer plus a thin terminal driver |
| `data/corpus` | audited ground-truth data, read by tests and tools only |
| `tools` | generators and audits, including the portrait and screenshot generators |

Inside `src/cli`, `render/ input/ state/ text/` are pure, and only
`term/ io/ app.ts main.ts` may touch the OS. That split is what makes
`renderFrame` and `buildView` snapshot-testable, and it is enforced by
`tests/cli/boundaries.test.ts` rather than by convention.

## The rules that will get a PR sent back

1. **Numbers come from the corpus, never from memory.** `data/corpus/*.json` is
   ground truth. If you believe a value is wrong, fix the corpus with a source
   and let the audit prove it. Never tune a number to make a test pass.
2. **Deliberate deviations get a flagging comment.** If the engine cannot yet do
   what the game does, mark it (`ENGINE-GAP`, `VERIFY-JAR`, and so on) rather
   than quietly approximating.
3. **Never hand-edit a snapshot.** The files in `tests/cli/fixtures/` ARE the
   expected UI. Change the renderer, run `bun run fixtures`, and read the diff
   like a screenshot. A PR that edits a fixture directly to make a test pass is
   the one change guaranteed to be rejected.
4. **Frames stay pure ASCII**, every byte under 0x80, exactly rows x cols at
   every size. Layout math lives in `src/cli/render/layout.ts` and must stay
   total (clamped) at all sizes, including 80x24.
5. **Respect the layer boundaries**, which are enforced by tests, not honor
   system. `src/engine` is pure and deterministic: no clock, no I/O, no
   randomness outside the seeded RNG. In `src/cli`, only `term/ io/ app.ts
   main.ts` may touch the OS.
6. **Never make startup wait on the network**, and never print while the TUI
   owns the screen. The update check in `src/cli/io/update.ts` is built around
   this; see how it splits local reads from a detached fetch.
7. **No runtime dependencies.** `dependencies` stays empty. A devDependency
   needs a reason.
8. **Copy rules:** no em dashes or other typographic punctuation, in copy or in
   comments. UI text stays in the game's own terse voice.
9. **Do not edit generated files.** The portraits
   (`src/cli/render/heroPortraits.ts`, `monsterPortraits.ts`) and the
   screenshots (`docs/shots/*.svg`) come from generators in `tools/`. Edit the
   generator and rerun it.

## Things that are genuinely useful

- A mechanic that diverges from the original, with a corpus citation showing it.
- A crash, with the seed and floor that produced it.
- A layout that breaks at some terminal size.
- A monster whose intent telegraph is wrong.

## AI-assisted contributions

Most of this codebase was written by a large language model, so there is no
double standard to worry about: **disclose AI assistance in the PR description**
and it will be reviewed like anything else, against the rules above.

If you object to AI-generated code on principle, do not contribute. That is a
coherent position and nobody here will try to talk you out of it. See
[the note in the README](../README.md#about-the-ai-in-this-repository) for the
full picture.
