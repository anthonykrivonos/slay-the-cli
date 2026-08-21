<p align="center">
  <img src="docs/shots/banner.svg" alt="Slay the CLI" width="100%">
</p>

<p align="center">
  <img alt="runs on Bun" src="https://img.shields.io/badge/runs%20on-Bun-fbf0df?style=flat-square&logo=bun&logoColor=fbf0df&labelColor=12121b">
  <img alt="or Node 18+" src="https://img.shields.io/badge/or-Node%2018%2B-6fce87?style=flat-square&logo=nodedotjs&logoColor=6fce87&labelColor=12121b">
  <img alt="TypeScript, strict" src="https://img.shields.io/badge/TypeScript-strict-9fb8e8?style=flat-square&logo=typescript&logoColor=9fb8e8&labelColor=12121b">
  <img alt="zero runtime dependencies" src="https://img.shields.io/badge/runtime%20deps-0-ff8c3a?style=flat-square&labelColor=12121b">
  <img alt="acts 1 to 4 plus the Heart" src="https://img.shields.io/badge/acts-1--4%20%2B%20the%20Heart-b98ad6?style=flat-square&labelColor=12121b">
</p>

<p align="center">
  <img alt="370 cards" src="https://img.shields.io/badge/cards-370-e06a7a?style=flat-square&labelColor=12121b">
  <img alt="181 relics" src="https://img.shields.io/badge/relics-181-ffd75e?style=flat-square&labelColor=12121b">
  <img alt="42 potions" src="https://img.shields.io/badge/potions-42-6fce87?style=flat-square&labelColor=12121b">
  <img alt="65 monsters" src="https://img.shields.io/badge/monsters-65-b98ad6?style=flat-square&labelColor=12121b">
  <img alt="51 events" src="https://img.shields.io/badge/events-51-9fb8e8?style=flat-square&labelColor=12121b">
  <img alt="ascension 0 to 20" src="https://img.shields.io/badge/ascension-0--20-ff8c3a?style=flat-square&labelColor=12121b">
</p>

Slay the Spire (V2.3.4), adapted faithfully to the command line. The whole climb
is here: 370 cards, 181 relics, 42 potions, 65 monsters, 51 events, all four
characters, Ascension 0 to 20, Acts 1 through 4 and the Corrupt Heart. Every
number and behavior comes from audited data rather than memory. Pure TypeScript,
deterministic, no runtime dependencies, drawn in plain ASCII with ANSI color.

## Play

```sh
git clone https://github.com/anthonykrivonos/slay-the-cli.git ~/.slay-the-cli/app
cd ~/.slay-the-cli/app
bun install          # or npm / pnpm / yarn install
bun src/cli/main.ts  # or npm start
```

Needs `git`, a terminal at least 80x24, and either [Bun](https://bun.sh) or
Node 18+. Every launch checks for a newer version in the background and says so
on the menu; `slay --update` applies one.

**[Full installation guide](docs/INSTALL.md)** for putting `slay` on your `PATH`
on Linux, macOS and Windows, choosing a package manager, how updating works, and
troubleshooting.

## Screenshots

Not mockups. Every picture is the renderer's own output for a snapshot fixture,
painted to SVG by `tools/gen-readme-shots.ts`, so it cannot drift from the game.

**Pick your survivor.** Four characters, Ascension 0 to 20, one seed box.

![The menu: four character cards, ascension and seed controls, and an ASCII Ironclad](docs/shots/menu.svg)

**Fight.** Intents up top, your hand as card-shaped boxes, the combat log
between them. Every creature is drawn in the average color of its own sprite.

![Combat: the Ironclad against a red and a green Louse, five cards in hand](docs/shots/combat.svg)

**Climb.** The act map scrolls, remembers where you have been, and tells you
what each glyph means.

![The Act 1 map with a burning elite, a legend, and three reachable paths](docs/shots/map.svg)

More frames, including the same fight at 80x24 and at 132x45, are in
[the playing guide](docs/CONTROLS.md#the-layout-is-fluid).

## Docs

| | |
| --- | --- |
| **[Installing](docs/INSTALL.md)** | package managers, per-platform `PATH` setup, updating, flags, troubleshooting |
| **[Playing](docs/CONTROLS.md)** | keys, the fluid layout, saves, color |
| **[Contributing](docs/CONTRIBUTING.md)** | setup, scripts, project layout, and the rules that get a PR sent back |
| **[Legal](docs/LEGAL.md)** | the full notice: unaffiliated fan work, no game code or assets |

## About the AI in this repository

Most of the code here was written by a large language model (Claude), directed
and reviewed by a human. That is not an apology appended after the fact, it is
how the thing got built, and the design shows it: the snapshot fixtures, the
corpus audit and the enforced purity boundaries exist because generated code
needs mechanical proof that it is right, not because anyone enjoys writing
assertions.

- **Read it before you trust it.** The tests are the argument for correctness,
  not the byline. Where the code and the corpus disagree, the corpus wins.
- **If you object to AI-generated code on principle, do not contribute, and
  consider not using this.** That is a coherent position and no one here will
  try to talk you out of it. Fork it, rewrite it, or walk away, all fine.
- **Contributions are judged the same regardless of what typed them.** See
  [CONTRIBUTING.md](docs/CONTRIBUTING.md), and disclose AI assistance in the PR.
- Pull requests that only remove this section will be closed.

## Legal

Slay the CLI is an unofficial, non-commercial fan reimplementation, not
affiliated with or endorsed by Mega Crit Games LLC. It contains no game code, no
game assets, and no copied prose. Nothing here is a substitute for owning the
game: **buy Slay the Spire.** Full notice in **[docs/LEGAL.md](docs/LEGAL.md)**.
