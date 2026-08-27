# AGENTS.md

Rules for coding agents working in this repo. Most of this codebase was written
by one, and these are the rules the ones before you were held to, including the
ones they had to be told twice.

Read [`CLAUDE.md`](CLAUDE.md) for the layout and the commands, and
[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for how a pull request lands.
This file is the part that is not obvious from the code.

## 1. What this is

A mechanically exact clone of Slay the Spire V2.3.4, adapted to the terminal.
That word exact is the whole project: **"matches the original" beats "reads
nicer" every time.** A cleaner formula that changes a number is a bug. So is a
nicer-sounding line of copy that the game does not say.

## 2. Ground truth

`data/corpus/*.json` is ground truth for every game number and behavior.

- **Never write a number from memory.** Look it up in the corpus.
- **Never tune a number to make a test pass.** If you think a value is wrong,
  fix the corpus with a source and let `bun test` prove it.
- The corpus is imported by `tests/` and `tools/` only, never by the engine.
- Where the engine cannot yet do what the game does, **flag it in a comment**
  (`ENGINE-GAP`, `VERIFY-JAR`) rather than quietly approximating. A flagged gap
  is honest debt; an unflagged one is a lie in the code.

## 3. Boundaries, enforced by tests and not by honor

- `src/engine` is pure and deterministic: no DOM, no Bun or node APIs, no clock,
  no randomness outside the seeded RNG, and no importing concrete content.
- In `src/cli`, `render/ input/ state/ text/` are pure. Only `term/ io/ app.ts
  main.ts` may touch the OS. That split is what makes `renderFrame` and
  `buildView` snapshot-testable.
- `render/` and `input/` see the View alone, never the content bundle at
  runtime.

`tests/architecture/boundaries.test.ts` and `tests/cli/boundaries.test.ts` grep
for all of it. Do not work around them; they are the design.

## 4. Generated files, never hand-edited

Three sets of files are output, not source. Editing one directly is the change
most likely to be rejected outright.

| files | edit instead | then run |
| --- | --- | --- |
| `tests/cli/fixtures/*.txt` | the renderer | `bun run fixtures` |
| `docs/shots/*.svg` | `tools/gen-readme-shots.ts` | `bun run shots` |
| `src/cli/render/{heroPortraits,monsterPortraits}.ts` | `tools/gen-*-portraits.ts` | the generator, against a local image dir |

The fixtures **are** the expected UI. Regenerate, then **read the diff like a
screenshot** before committing: a diff you did not intend is a UI bug you just
found. Portrait source images are deliberately not committed, and the portraits
are art-derived, so they are private use only.

## 5. Copy rules

These apply to UI copy, code comments, docs, PR text, and your replies.

- **ASCII only.** Every byte of a frame is under 0x80.
- **No em dashes**, and no other typographic punctuation: no en dash, no middot,
  no ellipsis character, no multiplication sign. The only exempt files are
  `src/cli/text/ascii.ts` (the map itself) and `tests/cli/logfmt.test.ts` (which
  exercises it).
- **The game's own terse voice and vocabulary.** Enemy, not monster. Merchant,
  not shop. One-word rest actions: REST, SMITH, RECALL, LEAVE. "Deal double
  damage. Receive double damage." Not an explanation of it.

## 6. Standing decisions, settled, do not relitigate

- **`Enter` always activates whatever is highlighted, on every screen.** Hand
  card, potion, enemy, list row, map path, overlay. An earlier read-only-hover
  rule for combat is dead; do not restore it.
- `hjkl` moves the cursor only when the setting is on. Off by default.
- Own seeds. The RNG is a bit-exact `RandomXS128` port, but there is no
  bit-exact run parity with real Slay the Spire seeds, and that is fine.
- Everything unlocked, no progression. Standard climb only: no Daily, no Custom,
  no Endless.
- **Zero runtime dependencies.** `dependencies` stays empty. A devDependency
  needs a reason.
- **Startup never awaits the network, and nothing prints while the TUI owns the
  screen.** `src/cli/io/update.ts` reads local git refs only (~15ms) and the
  fetch that refreshes them is detached, so the notice is one launch stale by
  design.
- Saves live in `~/.slay-the-cli`, overridable with `SLAY_DIR`.
- Minimum terminal is 80x24. Layout math in `src/cli/render/layout.ts` stays
  total: clamped, exact rows x cols, at every size.
- Event prose is paraphrased, never copied. Mechanics are exact.

## 7. Verify in this order

```sh
bun test                  # the whole suite; it takes about 7s, so run it
bun run fixtures          # then read the diff like a screenshot
bun run shots             # if the UI moved at all
bun run fuzz              # engine or run-layer changes
```

Then **play it in a real terminal**: `bun src/cli/main.ts`. Past sessions
shipped interaction bugs that every test passed and one minute of real play
caught. A pty is not a terminal, and neither is a snapshot.

`bun run audit` is maintainer-only: it cross-checks `data/corpus` against the
gitignored `references/`, so it cannot run from a bare checkout. Content parity
is still gated, by `tests/audit/contentAudit.test.ts`, from the corpus alone.

## 8. Research rules

- **Slay the Spire 2 contaminates every web search.** Use StS1 sources only, and
  discard anything named `StS2_*`.
- `slaythespire.wiki.gg` Lua data modules via `?action=raw` with a browser user
  agent. Not Fandom. Not the Cargo tables: both are StS2-contaminated.
- `gamerpuppy/sts_lightspeed` is the behavior spec (RNG, map gen, rewards, shop,
  monster AI). `nkhoit/spire-archive` `data/sts1/` is the content dump.
- Wiki file names follow the game's internal names, which often differ from the
  displayed ones: Sneaky Gremlin is `GremlinThief.png`, Shield Gremlin is
  `GremlinTsundere.png`, Mystic is `Healer.png`.

## 9. When to bump the version

`package.json`'s `version` is the only version in the repo. `src/cli/version.ts`
is the single reader of it, the title screen prints it, and the README banner
says the same, so **a bump is a player-visible change** and gets treated as one.

**Bump in the same pull request as the change it describes**, then run
`bun run fixtures && bun run shots` and commit the result. Skip that and the
`generated files` check fails, because the snapshots carry the version.

| bump | for |
| --- | --- |
| **patch** `0.2.0 -> 0.2.1` | a bug fix, copy, docs plus code, tests, or a refactor with no new player-visible behavior |
| **minor** `0.2.0 -> 0.3.0` | new player-visible behavior: a screen, a setting, a key, a flag, new content, or a mechanic that now matches the game where it did not |
| **major** `0.2.0 -> 1.0.0` | a break for existing players: the save envelope version in `src/cli/text/runlogic.ts` (which discards older saves), a removed or renamed flag, a moved save directory. Reserved also for the 1.0.0 full-parity claim |

Do not bump for a docs-only, CI-only, or tools-only pull request. Nothing
player-visible changed, so the version did not either.

One bump per pull request. If two land close together, the second rebases and
re-bumps. **Never edit the version to make anything pass.**

On merge, `.github/workflows/release.yml` sees the new version, pushes tag
`v<version>`, and cuts a GitHub release with generated notes. It never writes to
`main`. If the version did not change, it does nothing, which is the normal case.

## 10. How work lands

- **Plan first** for anything multi-file or behavioral, and get sign-off before
  writing code. Deliver the whole scope, then say what you did not do and why.
- `main` is protected. Branch, then open a pull request: three required checks
  (`test`, `generated files`, `node`), one approving review, up to date with
  `main`, squash merge.
- **The pull request title is the commit message**: a short imperative sentence,
  no prefix tag. `git log` on `main` is the house style.
- **Disclose AI assistance** in the description. Everyone here does.
- One issue per pull request, unless asked to sweep several.

## 11. Multi-agent hygiene

- **Never resume or message an old completed agent on this project.** One did
  that on its own, kept making edits nobody asked for, and all of it had to be
  reverted. Start a fresh agent.
- No unrequested scope. Do not add a feature because it seemed nice while you
  were in the file.
- If a request mid-task collides with a standing decision in section 6, **say
  so and ask.** Do not quietly change the decision, and do not quietly refuse
  the request.

## 12. Where prose goes

The README stays short and links out. Detail lives in
[`docs/INSTALL.md`](docs/INSTALL.md) (installing, package managers, updating,
flags, troubleshooting), [`docs/CONTROLS.md`](docs/CONTROLS.md) (keys, layout,
saves), [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) (setup, scripts, the pull
request rules), and [`docs/LEGAL.md`](docs/LEGAL.md). Put new prose in the right
one rather than growing the README.
