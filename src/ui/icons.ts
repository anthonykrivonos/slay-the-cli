// Canvas icon rendering from Iconify JSON data — synchronous, no DOM images,
// no network: icon <path> data is parsed into Path2D objects and filled
// directly onto the 2d canvases that back every stage panel.
//
// Icon sets (both fill-based; stroke-based sets like lucide would NOT work):
//   @iconify-json/game-icons — game-icons.net, CC BY 3.0
//     (https://creativecommons.org/licenses/by/3.0/ — attribution shown on
//     the main menu footer)
//   @iconify-json/mdi — Material Design Icons, Apache License 2.0
//
// Names are namespaced "gi:foo" / "mdi:foo". drawIcon on an unknown name is a
// no-op so a bad id can never break rendering; tests/ui/icons.test.ts asserts
// every name in USED_ICONS resolves, which keeps the roster honest.
//
// The runtime reads from src/ui/icondata.ts — a GENERATED snapshot of only
// the used icons (the full @iconify-json sets are ~10 MB of JSON and would
// bloat the mobile bundle). After changing USED_ICONS run:
//   bun tests/ui/gen-icondata.ts
// The icon test verifies the snapshot stays byte-identical to the real sets.

import { ICON_DATA, type IconDatum } from "./icondata";

/** Every icon name the UI draws — the icon test iterates this list. */
export const USED_ICONS = [
  // header / stats
  "gi:hearts",
  "gi:two-coins",
  "mdi:map-marker",
  "gi:standing-potion",
  "mdi:cards",
  "gi:gem-pendant",
  "mdi:menu",
  // combat
  "gi:power-lightning",
  "gi:checked-shield",
  "gi:card-draw",
  "gi:card-discard",
  "gi:card-burn",
  "gi:hourglass",
  // monster intents
  "gi:crossed-swords",
  "mdi:arrow-up-bold",
  "mdi:arrow-down-bold",
  "mdi:sleep",
  "mdi:star-circle",
  "gi:run",
  "gi:cursed-star",
  "mdi:help",
  // map nodes
  "gi:crowned-skull",
  "gi:campfire",
  "gi:swap-bag",
  "gi:chest",
  "gi:daemon-skull",
  // rooms / rewards
  "gi:locked-chest",
  "gi:open-treasure-chest",
  "gi:key",
  "gi:anvil",
  "mdi:help-circle",
  "mdi:skip-next",
  "mdi:skull",
  "mdi:trophy",
] as const;

export type IconName = (typeof USED_ICONS)[number] | (string & {});

interface ParsedIcon {
  paths: { d: string; evenodd: boolean }[];
  vbW: number;
  vbH: number;
  left: number;
  top: number;
}

function resolveIconData(name: string): IconDatum | null {
  return ICON_DATA[name] ?? null;
}

const parsedCache = new Map<string, ParsedIcon | null>();

function parseIcon(name: string): ParsedIcon | null {
  const cached = parsedCache.get(name);
  if (cached !== undefined) return cached;
  const data = resolveIconData(name);
  let parsed: ParsedIcon | null = null;
  if (data) {
    const paths: ParsedIcon["paths"] = [];
    // tolerant <path .../> scan: capture the attribute blob, then pull d= and
    // fill-rule= out of it (attribute order varies between sets)
    const tagRe = /<path\b([^>]*)>/gi;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(data.body)) !== null) {
      const attrs = m[1] ?? "";
      const dm = /\bd\s*=\s*"([^"]+)"/.exec(attrs);
      if (!dm) continue;
      const fr = /\bfill-rule\s*=\s*"([^"]+)"/.exec(attrs);
      paths.push({ d: dm[1]!, evenodd: fr?.[1] === "evenodd" });
    }
    if (paths.length > 0) {
      parsed = {
        paths,
        vbW: data.width ?? 16,
        vbH: data.height ?? 16,
        left: data.left ?? 0,
        top: data.top ?? 0,
      };
    }
  }
  parsedCache.set(name, parsed);
  return parsed;
}

/** True when `name` resolves to at least one drawable path (used by tests). */
export function hasIcon(name: string): boolean {
  return parseIcon(name) !== null;
}

// Path2D objects are built lazily (browser only) and cached per icon.
const path2dCache = new Map<string, { p: Path2D; evenodd: boolean }[]>();

/** Fill icon `name` at (x, y)..(x+size, y+size) in the ctx's coordinate space.
 *  Unknown names are a silent no-op — rendering must never break on an icon. */
export function drawIcon(
  g: CanvasRenderingContext2D,
  name: IconName,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const parsed = parseIcon(name);
  if (!parsed) return;
  if (typeof Path2D === "undefined") return; // headless env — icons are visual-only
  let paths = path2dCache.get(name);
  if (!paths) {
    paths = parsed.paths.map((p) => ({ p: new Path2D(p.d), evenodd: p.evenodd }));
    path2dCache.set(name, paths);
  }
  g.save();
  g.translate(x, y);
  g.scale(size / parsed.vbW, size / parsed.vbH);
  g.translate(-parsed.left, -parsed.top);
  g.fillStyle = color;
  for (const entry of paths) {
    g.fill(entry.p, entry.evenodd ? "evenodd" : "nonzero");
  }
  g.restore();
}
