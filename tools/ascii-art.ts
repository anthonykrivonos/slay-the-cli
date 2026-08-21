// Image -> ASCII generator for the hero portraits (and any future art).
//
//   bun tools/ascii-art.ts <image.png> [--width 60] [--invert] [--gamma 1.0]
//
// Dependency-free: a minimal PNG decoder (8-bit gray/RGB/palette/RGBA,
// non-interlaced; zlib via Bun.inflateSync) feeding a luminance sampler.
// Transparent pixels become spaces; the visible bounding box is cropped
// first; cells sample 2:1 (terminal characters are ~twice as tall as wide).
// Output uses the classic density ramp  " .:-=+*#%@".
//
// This is a TOOL (never imported by src/): it may use Bun/node APIs freely.

import { inflateSync } from "node:zlib";

const RAMP = " .:-=+*#%@";

export interface Img {
  w: number;
  h: number;
  /** RGBA, 8-bit */
  px: Uint8Array;
}

function u32(b: Uint8Array, o: number): number {
  return (b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(bytes: Uint8Array): Img {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== sig[i]) throw new Error("not a PNG (try converting with `sips -s format png`)");
  }
  let w = 0;
  let h = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let o = 8;
  while (o < bytes.length) {
    const len = u32(bytes, o);
    const type = String.fromCharCode(bytes[o + 4]!, bytes[o + 5]!, bytes[o + 6]!, bytes[o + 7]!);
    const data = bytes.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") {
      w = u32(data, 0);
      h = u32(data, 4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      interlace = data[12]!;
    } else if (type === "PLTE") {
      palette = data.slice();
    } else if (type === "tRNS") {
      trns = data.slice();
    } else if (type === "IDAT") {
      idat.push(data.slice());
    } else if (type === "IEND") {
      break;
    }
    o += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth} (8 only)`);
  if (interlace !== 0) throw new Error("interlaced PNGs unsupported");
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 4;
  const zdata = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let zo = 0;
  for (const c of idat) {
    zdata.set(c, zo);
    zo += c.length;
  }
  const raw = new Uint8Array(inflateSync(zdata));
  const stride = w * channels;
  const out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels]! : 0;
      const b = prev[x]!;
      const c = x >= channels ? prev[x - channels]! : 0;
      const v = line[x]!;
      cur[x] =
        (filter === 0 ? v
          : filter === 1 ? v + a
            : filter === 2 ? v + b
              : filter === 3 ? v + ((a + b) >> 1)
                : v + paeth(a, b, c)) & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (colorType === 0) {
        const g = cur[x]!;
        out[i] = g; out[i + 1] = g; out[i + 2] = g;
        out[i + 3] = trns && trns.length >= 2 && g === trns[1] ? 0 : 255;
      } else if (colorType === 2) {
        out[i] = cur[x * 3]!; out[i + 1] = cur[x * 3 + 1]!; out[i + 2] = cur[x * 3 + 2]!;
        out[i + 3] = 255;
      } else if (colorType === 3) {
        const p = cur[x]!;
        out[i] = palette?.[p * 3] ?? 0;
        out[i + 1] = palette?.[p * 3 + 1] ?? 0;
        out[i + 2] = palette?.[p * 3 + 2] ?? 0;
        out[i + 3] = trns && p < trns.length ? trns[p]! : 255;
      } else if (colorType === 4) {
        const g = cur[x * 2]!;
        out[i] = g; out[i + 1] = g; out[i + 2] = g;
        out[i + 3] = cur[x * 2 + 1]!;
      } else {
        out[i] = cur[x * 4]!; out[i + 1] = cur[x * 4 + 1]!; out[i + 2] = cur[x * 4 + 2]!;
        out[i + 3] = cur[x * 4 + 3]!;
      }
    }
    prev = cur;
  }
  return { w, h, px: out };
}

/** Crop to the visible (alpha > 16) bounding box. */
function cropVisible(img: Img): Img {
  let minX = img.w, minY = img.h, maxX = -1, maxY = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.px[(y * img.w + x) * 4 + 3]! > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return img;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    px.set(img.px.subarray(((y + minY) * img.w + minX) * 4, ((y + minY) * img.w + minX + w) * 4), y * w * 4);
  }
  return { w, h, px };
}

export function toAsciiArt(img: Img, outW: number, invert: boolean, gamma: number): string[] {
  const cellW = img.w / outW;
  const cellH = cellW * 2; // terminal cell aspect
  const outH = Math.max(1, Math.round(img.h / cellH));
  const rows: string[] = [];
  for (let cy = 0; cy < outH; cy++) {
    let row = "";
    for (let cx = 0; cx < outW; cx++) {
      const x0 = Math.floor(cx * cellW);
      const x1 = Math.max(x0 + 1, Math.floor((cx + 1) * cellW));
      const y0 = Math.floor(cy * cellH);
      const y1 = Math.max(y0 + 1, Math.min(img.h, Math.floor((cy + 1) * cellH)));
      let lum = 0;
      let alpha = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < img.h; y++) {
        for (let x = x0; x < x1 && x < img.w; x++) {
          const i = (y * img.w + x) * 4;
          const a = img.px[i + 3]! / 255;
          const l = (0.2126 * img.px[i]! + 0.7152 * img.px[i + 1]! + 0.0722 * img.px[i + 2]!) / 255;
          lum += l * a;
          alpha += a;
          n++;
        }
      }
      if (n === 0 || alpha / n < 0.25) {
        row += " ";
        continue;
      }
      let v = lum / Math.max(1e-6, alpha); // average luminance of visible pixels
      v = Math.pow(v, gamma);
      if (invert) v = 1 - v;
      // visible-but-dark cells still get at least the lightest ink
      const idx = Math.max(1, Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1))));
      row += RAMP[idx];
    }
    rows.push(row.replace(/\s+$/, ""));
  }
  // drop blank top/bottom rows
  while (rows.length > 0 && rows[0]!.trim() === "") rows.shift();
  while (rows.length > 0 && rows[rows.length - 1]!.trim() === "") rows.pop();
  return rows;
}

export async function renderFile(path: string, outW: number, invert: boolean, gamma: number): Promise<string[]> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  return toAsciiArt(cropVisible(decodePng(bytes)), outW, invert, gamma);
}

/** Decode + crop once, for callers rendering several widths of one image. */
export async function loadImage(path: string): Promise<Img> {
  return cropVisible(decodePng(new Uint8Array(await Bun.file(path).arrayBuffer())));
}

/**
 * The sprite's own color as "#rrggbb": the alpha-weighted mean of its visible
 * pixels, pushed away from grey so a terminal palette can tell one creature
 * from another. Very dark means near-black art, so it floors at a readable
 * lightness rather than going invisible.
 */
export function spriteTint(img: Img): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (let i = 0; i < img.px.length; i += 4) {
    const al = img.px[i + 3]! / 255;
    if (al < 0.25) continue;
    r += img.px[i]! * al;
    g += img.px[i + 1]! * al;
    b += img.px[i + 2]! * al;
    a += al;
  }
  if (a === 0) return "#c9d0e0";
  r /= a;
  g /= a;
  b /= a;
  // saturate: push each channel away from the mean, then lift the whole thing
  const mean = (r + g + b) / 3;
  const SAT = 1.7;
  let out = [r, g, b].map((c) => mean + (c - mean) * SAT);
  const peak = Math.max(...out);
  if (peak < 150) out = out.map((c) => (c * 150) / Math.max(1, peak)); // readable floor
  const hex = out.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("");
  return `#${hex}`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("usage: bun tools/ascii-art.ts <image.png> [--width 60] [--invert] [--gamma 1.0]");
    process.exit(1);
  }
  const width = Number(args.find((a) => a.startsWith("--width"))?.split("=")[1] ?? args[args.indexOf("--width") + 1] ?? 60);
  const gamma = Number(args.find((a) => a.startsWith("--gamma"))?.split("=")[1] ?? args[args.indexOf("--gamma") + 1] ?? 1.0);
  const invert = args.includes("--invert");
  const rows = await renderFile(file, Number.isFinite(width) && width > 0 ? width : 60, invert, Number.isFinite(gamma) && gamma > 0 ? gamma : 1.0);
  for (const r of rows) console.log(r);
}
