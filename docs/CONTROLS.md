# Playing

Keys, the fluid layout, and where your run is kept.

## Keys

Number keys select, letters act.

| key | does |
| --- | --- |
| `1`-`0` | pick the numbered thing: a card, a reward, a shop item, a path |
| `Enter` | activate whatever the cursor is on |
| `Esc` | clear the cursor, or close the top overlay |
| `Tab` / `Shift-Tab` | move the hover cursor forward and back |
| arrows | move the hover cursor; on the map, scroll and change path |
| `e` | end turn |
| `i` | inspect cards up close; arrows step through them |
| `l` | combat log |
| `d` / `r` / `p` | deck, relics, potions |
| `w` / `x` / `z` | draw, discard and exhaust piles |
| `n` / `p` | next and previous page, on any list that has more than one |
| `n` / `c` | new run, continue (on the menu) |
| `a` / `A` | ascension up and down (on the menu); `+` and `-` also work |
| `s` | edit the seed (on the menu) |
| `q` | quit: instant on the menu, `[y]`/`[n]` confirmation mid-run |
| `Ctrl+C` | quit immediately from anywhere, still safely |

Every screen prints its own key hints along the bottom row, so this table is a
reference rather than something to memorize.

The hover cursor is read-only: moving it never commits anything. Whatever it
points at is explained in the INFO panel at the bottom. On menus and lists the
cursor doubles as the selection, so `Enter` activates it and `Esc` clears it.

## The layout is fluid

The game uses every column and row you give it, and degrades in steps rather
than clipping.

**At 80x24**, the minimum, every screen compacts to dense one-liners. Nothing
important is dropped, it just gets terser.

![The same combat at 80x24, compacted to dense one-liners](shots/combat-80x24.svg)

**At 120x36 and up**, enemy panels, card-shaped boxes, scene art and the bottom
INFO panel appear, and every monster and your hero are drawn as ASCII portraits
inside their panels, each creature tinted with the average color of its own
sprite.

![Combat: the Ironclad against a red and a green Louse, five cards in hand](shots/combat.svg)

**At 132x45**, a crowded room still gives all five monsters a full portrait, and
the cards in hand grow taller.

![Five Louses at 132x45, each with a full ASCII portrait](shots/crowd.svg)

Resizing mid-run is fine. The frame is recomputed from the terminal's current
size on every repaint, and the layout math is clamped at every size, so there is
no size that breaks it.

## Screens

**The map** scrolls, remembers where you have been, and carries a legend for
every glyph.

![The Act 1 map with a burning elite, a legend, and three reachable paths](shots/map.svg)

**The merchant** pages through cards, relics, potions and card removal, with
prices and what you cannot yet afford.

![The shop, showing seven cards for sale with prices, three relics, three potions and card removal](shots/shop.svg)

## Saves

The run is written to `~/.slay-the-cli/save.json` after **every action**, so
quitting is always safe: `q` and Ctrl+C both exit cleanly, and `c` on the menu
resumes exactly where you left off. There is no save slot to manage and no
confirmation to sit through.

`prefs.json` beside it remembers your last character, seed, ascension and color
setting, so the menu comes back the way you left it.

`SLAY_DIR` moves both files elsewhere. See
[INSTALL.md](INSTALL.md#where-things-live) for the full layout, and its
[troubleshooting section](INSTALL.md#troubleshooting) if a run seems to have
gone missing.

## Color

Color is on by default and uses xterm-256. `--no-color` or `NO_COLOR=1` gives
plain output, which is also what you get when the output is not a terminal.
Every frame is pure ASCII underneath, so the game is readable either way.
