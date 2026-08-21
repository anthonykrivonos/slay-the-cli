<p align="center">
  <img src="docs/shots/banner.svg" alt="Slay the CLI" width="100%">
</p>

<p align="center">
  <img alt="runs on Bun" src="https://img.shields.io/badge/runs%20on-Bun-fbf0df?style=flat-square&logo=bun&logoColor=fbf0df&labelColor=12121b">
  <img alt="TypeScript, strict" src="https://img.shields.io/badge/TypeScript-strict-9fb8e8?style=flat-square&logo=typescript&logoColor=9fb8e8&labelColor=12121b">
  <img alt="zero runtime dependencies" src="https://img.shields.io/badge/runtime%20deps-0-6fce87?style=flat-square&labelColor=12121b">
  <img alt="ascension 0 to 20" src="https://img.shields.io/badge/ascension-0--20-ff8c3a?style=flat-square&labelColor=12121b">
  <img alt="acts 1 to 4 plus the Heart" src="https://img.shields.io/badge/acts-1--4%20%2B%20the%20Heart-b98ad6?style=flat-square&labelColor=12121b">
</p>

<p align="center">
  <img alt="370 cards" src="https://img.shields.io/badge/cards-370-e06a7a?style=flat-square&labelColor=12121b">
  <img alt="181 relics" src="https://img.shields.io/badge/relics-181-ffd75e?style=flat-square&labelColor=12121b">
  <img alt="42 potions" src="https://img.shields.io/badge/potions-42-6fce87?style=flat-square&labelColor=12121b">
  <img alt="65 monsters" src="https://img.shields.io/badge/monsters-65-b98ad6?style=flat-square&labelColor=12121b">
  <img alt="51 events" src="https://img.shields.io/badge/events-51-9fb8e8?style=flat-square&labelColor=12121b">
</p>

Slay the Spire (V2.3.4), adapted faithfully to the command line. The whole climb
is here: 370 cards, 181 relics, 42 potions, 65 monsters, 51 events, all four
characters, Ascension 0 to 20, Acts 1 through 4 and the Corrupt Heart. Every
number and behavior comes from audited data rather than memory. Pure TypeScript,
deterministic, no runtime dependencies, drawn in plain ASCII with ANSI color.

## Screenshots

Not mockups. Every picture below is the renderer's own output for a snapshot
fixture, painted to SVG by `tools/gen-readme-shots.ts`, so the pictures cannot
drift from the game.

**Pick your survivor.** Four characters, Ascension 0 to 20, one seed box.

![The menu: four character cards, ascension and seed controls, and an ASCII Ironclad](docs/shots/menu.svg)

**Fight.** Intents up top, your hand as card-shaped boxes, the combat log
between them. Every creature is drawn in the average color of its own sprite.

![Combat: the Ironclad against a red and a green Louse, five cards in hand](docs/shots/combat.svg)

**Climb.** The act map scrolls, remembers where you have been, and tells you
what each glyph means.

![The Act 1 map with a burning elite, a legend, and three reachable paths](docs/shots/map.svg)

<details>
<summary><b>More frames:</b> the merchant, a crowded room, and the 80x24 squeeze</summary>

<br>

**The merchant.** Cards, relics, potions, card removal, paged.

![The shop, showing seven cards for sale with prices, three relics, three potions and card removal](docs/shots/shop.svg)

**Give it room.** At 132x45 five monsters all get full portraits and the cards
in hand grow taller.

![Five Louses at 132x45, each with a full ASCII portrait](docs/shots/crowd.svg)

**Or take it away.** The same fight at the 80x24 minimum, compacted to
one-liners with nothing important dropped.

![The same combat at 80x24, compacted to dense one-liners](docs/shots/combat-80x24.svg)

</details>

## Get climbing in 30 seconds

You need `git`, a terminal at least 80x24, and either [Bun](https://bun.sh) or
Node 18+. Use whichever package manager you already have.

```sh
git clone https://github.com/anthonykrivonos/slay-the-cli.git ~/.slay-the-cli/app
cd ~/.slay-the-cli/app
```

| | install | play |
| --- | --- | --- |
| **Bun** | `bun install` | `bun src/cli/main.ts` |
| **npm** | `npm install` | `npm start` |
| **pnpm** | `pnpm install` | `pnpm start` |
| **Yarn** | `yarn install` | `yarn start` |

Bun runs the TypeScript directly and needs nothing else. The other three run it
on Node through [tsx](https://tsx.is), which is the only devDependency and is
what `npm start` invokes. There are still zero runtime dependencies, and Bun
users can skip the install entirely.

That is enough to play forever. Everything below is convenience.

```sh
bun src/cli/main.ts --seed SPIRE --character WATCHER --ascension 20
bun src/cli/main.ts --no-color        # also honors NO_COLOR
bun src/cli/main.ts --update         # pull + rebuild, then exit
bun src/cli/main.ts --help

npm start -- --seed SPIRE --character WATCHER   # same flags, past the --
```

Two things do want Bun, and neither is playing: the test suite (all 57 files
import `bun:test`) and `bun run build`, which compiles the standalone binary.
Everything else is runtime-agnostic.

## Install it for good

Everything the game owns lives under one directory, `~/.slay-the-cli`: the
checkout in `app/`, and your saves at the root beside it.

```
~/.slay-the-cli/
  app/              the clone, with the compiled binary in app/dist/
  save.json         the run in progress, written after every action
  prefs.json        last character, seed, ascension, color
```

Saves sit outside the checkout on purpose. Updating, rebuilding, or even
`git clean` inside `app/` cannot touch a run in progress.

`bun run build` compiles a standalone binary to `app/dist/slay` (about 60 MB,
the Bun runtime baked in, no Bun needed to run it). Put that directory on your
`PATH` and `slay` works from anywhere.

No Bun? Skip the binary and alias the Node path instead. It behaves identically,
just with a moment of startup while tsx compiles:

```bash
alias slay='npm --prefix "$HOME/.slay-the-cli/app" start --silent --'
```

### Linux and macOS

```sh
git clone https://github.com/anthonykrivonos/slay-the-cli.git ~/.slay-the-cli/app
cd ~/.slay-the-cli/app && bun install && bun run build
```

Then append this to `~/.bashrc` (bash) or `~/.zshrc` (zsh):

```bash
# ---- Slay the CLI --------------------------------------------------------
export SLAY_HOME="$HOME/.slay-the-cli"
export PATH="$SLAY_HOME/app/dist:$PATH"
# -------------------------------------------------------------------------
```

Open a new shell (or `source ~/.zshrc`) and run `slay`. That is the whole
install: updating is built in, so there is no shell function to paste.

Prefer a symlink to a `PATH` edit? `ln -sf "$HOME/.slay-the-cli/app/dist/slay" /usr/local/bin/slay` does the same job.

### Windows

Use Windows Terminal or PowerShell 7. The TUI needs ANSI and a real console;
`cmd.exe` in legacy mode will not do. WSL works too, in which case follow the
Linux instructions inside it.

```powershell
git clone https://github.com/anthonykrivonos/slay-the-cli.git $HOME\.slay-the-cli\app
cd $HOME\.slay-the-cli\app; bun install; bun run build
```

Then append this to your profile (`notepad $PROFILE`, creating it if missing):

```powershell
# ---- Slay the CLI --------------------------------------------------------
$env:SLAY_HOME = "$HOME\.slay-the-cli"
$env:Path = "$env:SLAY_HOME\app\dist;$env:Path"
# -------------------------------------------------------------------------
```

Restart the terminal and run `slay`. The binary lands at `app\dist\slay.exe`;
`slay` finds it. Saves go to `$HOME\.slay-the-cli`, beside `app`.

## Keeping up with the Spire

Updating is part of the app, not something you wire up. Every launch checks
whether the checkout is behind `origin/main`, and when it is, the menu says so:

![The menu with a gold notice reading "The Spire has shifted: 3 commits ahead. Run: slay --update"](docs/shots/menu-update.svg)

`slay --update` fast-forwards the clone, reinstalls, recompiles the binary, and
prints the commit you landed on. It touches only `~/.slay-the-cli/app`, so a run
in progress is never at risk, and running it when you are already current costs
a fetch and nothing else.

**How the check stays free.** Asking a remote at launch would mean waiting on
the network before you can play, and anything that prints while the game owns
the screen scribbles over the frame. So it does neither. The check at startup
reads only the `origin/main` ref git already has on disk, which takes about
15 ms and never touches the network. The `git fetch` that refreshes that ref is
detached and unref'd, so it cannot delay startup, delay exit, or write to the
terminal. Its result is simply there for the next launch to read.

The notice is therefore one launch stale by design. That is the entire trick:
git's own ref store is the cache between the two halves.

**Turning it off.** `--no-update-check` skips it for one run;
`SLAY_NO_UPDATE_CHECK=1` disables it permanently, network and all. The check
also silently does nothing when there is no git checkout (a copied binary), no
`git` on `PATH`, or no network. It never blocks, and it never errors.

Checking is automatic but applying is not, deliberately. Recompiling a binary
out from under a running process is not something to do without being asked.

## Controls

Number keys select, letters act (`e` end turn, `l` combat log, `d` deck, `p`
potions, `q` quit). `Tab` and the arrow keys move a read-only hover cursor whose
target is explained in the INFO panel; on menus and lists that cursor doubles as
a selection (`Enter` activates, `Esc` clears).

The layout is fluid and uses everything you give it: enemy panels, card-shaped
boxes, scene art and a bottom INFO panel appear as the window grows, and at
80x24 every screen compacts to dense one-liners. Give it room (120x36 and up)
and the monsters and your hero appear as ASCII portraits inside their panels,
each creature in its own color.

Runs save to `~/.slay-the-cli/` after every action (`SLAY_DIR` overrides), and
`c` on the menu resumes the last one. If the process is hard-killed the terminal
may need `reset`.

## Develop

Every task has a package script, so `npm run <name>`, `pnpm <name>`,
`yarn <name>` and `bun run <name>` all reach it. The scripts themselves shell
out to Bun, because the test runner and the compiler are Bun's.

```sh
bun test           # npm test       full suite
bun run audit      # npm run audit  corpus ground-truth audit
bun run fuzz       # npm run fuzz   long-run combat fuzzing
bun run build      # npm run build  compile a single binary to dist/slay
bun run fixtures   #                regenerate the UI snapshots
bun run shots      #                regenerate the screenshots above
bun run dev:bun    # npm run dev    watch mode
```

Layout: `src/engine` (the pure deterministic core, with a bit-exact RNG, action
queue and damage pipeline), `src/content` (the forkable game-content bundle),
`src/cli` (the TUI: a pure snapshot-tested renderer plus a thin terminal
driver), `data/corpus` (audited ground-truth data, read by tests and tools
only).

Mechanics, numbers and behavior mirror the original game exactly, and the few
deliberate deviations are flagged in code. The repo holds no binary assets and
no text from the game itself. Event prose is paraphrased, and the scene art is
original, but the portraits are not: every hero and all 65 monsters are
low-resolution ASCII renderings derived from the game's character art, each
monster tinted with the average color of its own sprite. Regenerate them with
`tools/gen-hero-portraits.ts` and `tools/gen-monster-portraits.ts`, which read
images from a local directory and document where to fetch them; the images
themselves are never committed.

## Contributing

Bug reports and fixes are welcome. The bar is high in one specific direction:
this is a clone, so "matches the original" beats "reads nicer" every time.

**Before you open a PR**, from `bun install`:

```sh
bun test                 # 1860 tests, all must pass
bun run audit            # corpus audit, must print "corpus audit clean"
```

Both need Bun, since the suite imports `bun:test`. Playing does not, but
contributing does.

**The rules that will get a PR sent back:**

1. **Numbers come from the corpus, never from memory.** `data/corpus/*.json` is
   ground truth. If you believe a value is wrong, fix the corpus with a source,
   and let the audit prove it. Never tune a number to make a test pass.
2. **Deliberate deviations get a flagging comment.** If the engine cannot yet do
   what the game does, mark it (`ENGINE-GAP`, `VERIFY-JAR`, and so on) rather
   than quietly approximating.
3. **Never hand-edit a snapshot.** `tests/cli/fixtures/*.txt` ARE the expected
   UI. Change the renderer, run `bun run fixtures`, and read the diff like a
   screenshot. A PR that edits a fixture directly to make a test pass is the one
   change guaranteed to be rejected.
4. **Frames stay pure ASCII**, every byte under 0x80, exactly rows x cols at
   every size. Layout math lives in `src/cli/render/layout.ts` and must stay
   total (clamped) at all sizes, including 80x24.
5. **Respect the layer boundaries**, which are enforced by tests, not honor
   system. `src/engine` is pure and deterministic: no clock, no I/O, no
   randomness outside the seeded RNG. In `src/cli`, only `term/ io/ app.ts
   main.ts` may touch the OS; `render/ input/ state/ text/` may not.
6. **No runtime dependencies.** `dependencies` stays empty. A devDependency
   needs a reason.
7. **Copy rules:** no em dashes or other typographic punctuation, in copy or in
   comments. UI text stays in the game's own terse voice.
8. **Do not edit generated files.** The portraits
   (`src/cli/render/{hero,monster}Portraits.ts`) and the README screenshots
   (`docs/shots/*.svg`) come from generators in `tools/`. Edit the generator and
   rerun it.

**Things that are genuinely useful:** a mechanic that diverges from the original
with a corpus citation showing it; a crash with the seed and floor that produced
it; a layout that breaks at some terminal size; a monster whose intent telegraph
is wrong.

**Disclose AI assistance in the PR description.** See below for why that is
normal here rather than an admission.

## About the AI in this repository

Most of the code here was written by a large language model (Claude), directed
and reviewed by a human. That is not an apology appended after the fact, it is
how the thing got built, and the design shows it: the snapshot fixtures, the
corpus audit and the enforced purity boundaries exist because generated code
needs mechanical proof that it is right, not because anyone enjoys writing
assertions.

What that means for you:

- **Read it before you trust it.** The tests are the argument for correctness,
  not the byline. Where the code and the corpus disagree, the corpus wins.
- **If you object to AI-generated code on principle, do not contribute, and
  consider not using this.** That is a coherent position and no one here will
  try to talk you out of it. Fork it, rewrite it, or walk away, all fine.
- **Contributions are judged the same regardless of what typed them.**
  Corpus-backed numbers, passing tests, ASCII-only frames, no hand-edited
  snapshots. Disclose AI assistance in the pull request.
- Pull requests that only remove this section will be closed.

## Legal notice

Slay the CLI is an unofficial, non-commercial fan reimplementation. It is not
affiliated with, endorsed by, sponsored by, or approved by Mega Crit Games LLC.

Slay the Spire and all associated names, characters, artwork, audio, and other
creative material are the property of their respective owners. Those names appear
here only to identify the game whose mechanics this project reproduces, which is
the only way to describe the project truthfully. No claim of ownership,
sponsorship, or affiliation is made or implied.

This repository contains:

- **No game code.** Nothing decompiled, translated, or transcribed from the
  original binaries.
- **No game assets.** No art, audio, fonts, sprites, or data files from the game
  are included or redistributed.
- **No copied prose.** Event text is deliberately paraphrased. Card, relic, and
  power text is written as functional rules description; short strings such as
  "Deal 6 damage." coincide with the original because a rule stated precisely
  admits few other phrasings.
- **Derived portraits, not copied art.** The ASCII portraits are
  low-resolution derivations rendered by the generators in `tools/`. Only the
  ASCII output is committed. The source images are not included, and the
  generators expect you to point them at files you already have.

`data/corpus` holds numeric and behavioral game data (costs, damage values,
intent tables, drop pools) compiled from community documentation and open-source
reimplementations. The project treats such data as functional fact rather than
creative expression, and stores it solely to keep this implementation honest
about how the game actually behaves.

Nothing here is a substitute for owning the game. **Buy Slay the Spire.** It is
worth it, MegaCrit earned it, and this project exists because of it.

No license to any third party's intellectual property is granted by this
repository or by anything in it. The original code in this repository carries no
license file, so default copyright applies and all rights are reserved by the
author. Everything is provided **as is**, without warranty of any kind, express
or implied.

This notice states the project's intent and the constraints it was built under.
It is not legal advice and it is not a legal opinion about your jurisdiction.
