// Renders real game frames into the SVG "screenshots" the README embeds:
//   bun tools/gen-readme-shots.ts
// GitHub will not render ANSI in a code fence, so the frames are drawn as SVG
// text on a terminal-shaped card instead. Nothing here is hand-drawn: each shot
// is the actual renderFrame() output for a snapshot fixture, colored by a
// truecolor Theme, so the pictures cannot drift from the UI.
//
// Output: docs/shots/*.svg (generated - never hand-edit, rerun this instead).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES, bundle } from "../tests/cli/fixtures";
import { buildView } from "../src/cli/state/view";
import { renderFrame } from "../src/cli/render/frame";
import { bigWord } from "../src/cli/render/bigfont";
import type { Theme } from "../src/cli/render/theme";

// ---------------------------------------------------------------- the shots

interface Shot {
  fixture: string;
  file: string;
  title: string;
  cols: number;
  rows: number;
}

const SHOTS: Shot[] = [
  { fixture: "menu", file: "menu", title: "slay", cols: 120, rows: 36 },
  { fixture: "menu-update", file: "menu-update", title: "slay - update found", cols: 120, rows: 36 },
  { fixture: "combat", file: "combat", title: "slay - combat", cols: 120, rows: 36 },
  { fixture: "combat-crowd", file: "crowd", title: "slay - 132x45", cols: 132, rows: 45 },
  { fixture: "map-act1", file: "map", title: "slay - the map", cols: 120, rows: 36 },
  { fixture: "shop", file: "shop", title: "slay - the merchant", cols: 120, rows: 36 },
  { fixture: "inspect-relic", file: "inspect", title: "slay - inspect", cols: 120, rows: 36 },
  { fixture: "combat", file: "combat-80x24", title: "slay - 80x24", cols: 80, rows: 24 },
];

// ------------------------------------------------------------- svg geometry

const FONT_SIZE = 15;
const CHAR_W = 9;
const LINE_H = 18;
const PAD_X = 14;
const PAD_Y = 12;
const BAR_H = 30;
const FONT = "ui-monospace,SFMono-Regular,Menlo,Consolas,'DejaVu Sans Mono',monospace";

const BG = "#12121b";
const BG_BAR = "#1c1c28";
const EDGE = "#2f2f42";
const DEFAULT_FG = "#c9d0e0";

// --------------------------------------------------------- truecolor theme

function rgb(hex: string): string {
  const v = Number.parseInt(hex.replace("#", ""), 16);
  return `${(v >> 16) & 0xff};${(v >> 8) & 0xff};${v & 0xff}`;
}

const THEME_TRUECOLOR: Theme = {
  fg: (hex, s) => `\x1b[38;2;${rgb(hex)}m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  inverse: (s) => `\x1b[7m${s}\x1b[0m`,
};

// ------------------------------------------------------------- ansi -> runs

interface Attrs {
  fg: string | null;
  bold: boolean;
  dim: boolean;
  inverse: boolean;
}

interface Run extends Attrs {
  col: number;
  text: string;
}

const SGR_RE = /\x1b\[([0-9;]*)m/g;

/** Split one ANSI line into column-anchored runs, emulating a real terminal
 *  (a plain reset clears every attribute, exactly as the CLI's themes assume). */
function toRuns(line: string): Run[] {
  const runs: Run[] = [];
  let at: Attrs = { fg: null, bold: false, dim: false, inverse: false };
  let col = 0;
  let last = 0;

  const push = (text: string): void => {
    if (text.length === 0) return;
    runs.push({ ...at, col, text });
    col += text.length;
  };

  SGR_RE.lastIndex = 0;
  for (let m = SGR_RE.exec(line); m; m = SGR_RE.exec(line)) {
    push(line.slice(last, m.index));
    last = m.index + m[0].length;
    const codes = (m[1] ?? "").split(";").map((c) => Number.parseInt(c || "0", 10));
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i]!;
      if (c === 0) at = { fg: null, bold: false, dim: false, inverse: false };
      else if (c === 1) at = { ...at, bold: true };
      else if (c === 2) at = { ...at, dim: true };
      else if (c === 7) at = { ...at, inverse: true };
      else if (c === 38 && codes[i + 1] === 2) {
        const [r, g, b] = [codes[i + 2] ?? 0, codes[i + 3] ?? 0, codes[i + 4] ?? 0];
        const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
        at = { ...at, fg: hex };
        i += 4;
      }
    }
  }
  push(line.slice(last));
  return runs;
}

// ---------------------------------------------------------------- svg emit

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function n2(x: number): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

function toSvg(lines: string[], shot: Shot): string {
  const w = shot.cols * CHAR_W + PAD_X * 2;
  const h = shot.rows * LINE_H + PAD_Y * 2 + BAR_H;
  const out: string[] = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}" font-size="${FONT_SIZE}">`,
  );
  out.push(`<rect width="${w}" height="${h}" rx="10" fill="${BG}"/>`);
  out.push(`<path d="M0 10a10 10 0 0 1 10-10h${w - 20}a10 10 0 0 1 10 10v${BAR_H - 10}H0z" fill="${BG_BAR}"/>`);
  for (const [i, dot] of ["#e06a7a", "#ffd75e", "#6fce87"].entries()) {
    out.push(`<circle cx="${20 + i * 17}" cy="${BAR_H / 2}" r="5" fill="${dot}"/>`);
  }
  out.push(
    `<text x="${w / 2}" y="${BAR_H / 2 + 4}" fill="#6f7a92" font-size="12" text-anchor="middle">${esc(shot.title)}</text>`,
  );
  out.push(`<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="10" fill="none" stroke="${EDGE}"/>`);

  // Cells first (inverse runs paint a block), then all glyphs on top.
  const cells: string[] = [];
  const glyphs: string[] = [];

  lines.forEach((line, row) => {
    const y = BAR_H + PAD_Y + row * LINE_H + FONT_SIZE - 2;
    const spans: string[] = [];
    for (const run of toRuns(line)) {
      const x = PAD_X + run.col * CHAR_W;
      const width = run.text.length * CHAR_W;
      if (run.inverse) {
        cells.push(
          `<rect x="${n2(x)}" y="${n2(BAR_H + PAD_Y + row * LINE_H)}" width="${n2(width)}" height="${LINE_H}" fill="${run.fg ?? DEFAULT_FG}"/>`,
        );
      } else if (run.text.trim() === "") {
        continue; // blank space needs no glyph
      }
      const attrs = [
        `x="${n2(x)}"`,
        `textLength="${n2(width)}"`,
        `lengthAdjust="spacingAndGlyphs"`,
        `fill="${run.inverse ? BG : (run.fg ?? DEFAULT_FG)}"`,
      ];
      if (run.bold) attrs.push(`font-weight="bold"`);
      if (run.dim) attrs.push(`opacity="0.55"`);
      spans.push(`<tspan ${attrs.join(" ")}>${esc(run.text)}</tspan>`);
    }
    if (spans.length > 0) {
      glyphs.push(`<text y="${n2(y)}" xml:space="preserve">${spans.join("")}</text>`);
    }
  });

  out.push(...cells, ...glyphs, "</svg>");
  return out.join("\n") + "\n";
}

// ------------------------------------------------------------- title banner

/** The menu's own block-letter title, painted with a four-character gradient
 *  (Ironclad red, gold, Silent green, Defect blue, Watcher purple). */
function bannerSvg(): string {
  const rows = bigWord("SLAY THE CLI");
  if (!rows) throw new Error("bigfont is missing a glyph for the title");
  const tagline = "The Spire awaits.";
  const cols = rows[0]!.length;
  const w = cols * CHAR_W + PAD_X * 2;
  const h = (rows.length + 2) * LINE_H + PAD_Y * 2;
  const stops = ["#e06a7a", "#ffd75e", "#6fce87", "#9fb8e8", "#b98ad6"];
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}" font-size="${FONT_SIZE}">`,
    `<defs><linearGradient id="spire" x1="0" y1="0" x2="1" y2="0">`,
    ...stops.map((c, i) => `<stop offset="${((i / (stops.length - 1)) * 100).toFixed(0)}%" stop-color="${c}"/>`),
    `</linearGradient></defs>`,
    `<rect width="${w}" height="${h}" rx="10" fill="${BG}"/>`,
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="10" fill="none" stroke="${EDGE}"/>`,
  ];
  rows.forEach((row, i) => {
    const y = PAD_Y + i * LINE_H + FONT_SIZE - 2;
    out.push(
      `<text x="${PAD_X}" y="${n2(y)}" textLength="${n2(cols * CHAR_W)}" lengthAdjust="spacingAndGlyphs"` +
        ` fill="url(#spire)" font-weight="bold" xml:space="preserve">${esc(row)}</text>`,
    );
  });
  const tagY = PAD_Y + (rows.length + 1) * LINE_H + FONT_SIZE - 2;
  out.push(`<text x="${w / 2}" y="${n2(tagY)}" fill="#6f7a92" text-anchor="middle">${esc(tagline)}</text>`, "</svg>");
  return out.join("\n") + "\n";
}

// -------------------------------------------------------------------- main

if (import.meta.main) {
  const dir = join(import.meta.dir, "..", "docs", "shots");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "banner.svg"), bannerSvg());
  console.log("wrote", join(dir, "banner.svg"));
  for (const shot of SHOTS) {
    const build = FIXTURES[shot.fixture];
    if (!build) throw new Error(`unknown fixture ${shot.fixture}`);
    const { game, ui } = build();
    const view = buildView(game, ui, bundle);
    const lines = renderFrame(view, { cols: shot.cols, rows: shot.rows }, THEME_TRUECOLOR);
    const file = join(dir, `${shot.file}.svg`);
    writeFileSync(file, toSvg(lines, shot));
    console.log("wrote", file, `(${shot.cols}x${shot.rows})`);
  }
}
