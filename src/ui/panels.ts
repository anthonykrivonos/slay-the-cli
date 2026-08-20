// Shared three.js panel drawers used by every screen (main.ts). Rendering
// only — layout/legality decisions live in main.ts / runlogic.ts.
//
// z discipline: the camera sits at z=100 (stage.ts) and raycasts fire -z from
// the camera plane, so ALL tappable content must stay within z 0..50.

import * as THREE from "three";
import type { Mesh } from "three";
import { addToStage, makeTappable, canvasPanel, panelBg, wrapText } from "./stage";
import type { CardDef } from "../engine/content/defs";
import { cardRulesText } from "./cardtext";
import { drawIcon, type IconName } from "./icons";

export const TYPE_COLORS: Record<string, string> = {
  attack: "#c25454",
  skill: "#4f83c9",
  power: "#c2a13e",
  status: "#7a8090",
  curse: "#8a5bb5",
};

/** Tiny icon on the card-type footer strip. */
export const CARD_TYPE_ICONS: Record<string, IconName> = {
  attack: "gi:crossed-swords",
  skill: "gi:checked-shield",
  power: "gi:power-lightning",
  status: "mdi:help",
  curse: "mdi:skull",
};

// --- icon + label panel -------------------------------------------------------------
export interface IconLabelOpts {
  w: number;
  h: number;
  text: string;
  fontPx?: number;
  bg?: string;
  fg?: string;
  border?: string;
  borderW?: number;
  bold?: boolean;
  /** small glyph drawn left of the (centered) label */
  icon?: IconName;
  iconColor?: string;
  iconSize?: number;
}

/** Panel with an optional icon and centered text (multi-line via \n). */
export function iconLabelPanel(opts: IconLabelOpts): Mesh {
  const fontPx = opts.fontPx ?? 24;
  return canvasPanel(opts.w, opts.h, (g) => {
    panelBg(g, opts.w, opts.h, opts.bg ?? "#1c2333", opts.border ?? "#3d4a66", opts.borderW ?? 3);
    const fg = opts.fg ?? "#e6e9f0";
    g.font = `${opts.bold ? "bold " : ""}${fontPx}px -apple-system, system-ui, sans-serif`;
    g.textBaseline = "middle";
    const lines = opts.text.split("\n");
    const lh = fontPx * 1.3;
    const iconSize = opts.iconSize ?? Math.round(fontPx * 1.2);
    const gap = opts.icon ? Math.round(iconSize * 0.4) : 0;
    const maxTextW = opts.w - 24 - (opts.icon ? iconSize + gap : 0);
    const textW = Math.min(maxTextW, Math.max(...lines.map((l) => g.measureText(l).width)));
    const groupW = (opts.icon ? iconSize + gap : 0) + textW;
    const x0 = (opts.w - groupW) / 2;
    if (opts.icon) {
      drawIcon(g, opts.icon, x0, opts.h / 2 - iconSize / 2, iconSize, opts.iconColor ?? fg);
    }
    g.fillStyle = fg;
    g.textAlign = "center";
    const tx = x0 + (opts.icon ? iconSize + gap : 0) + textW / 2;
    lines.forEach((line, i) => {
      g.fillText(line, tx, opts.h / 2 + (i - (lines.length - 1) / 2) * lh, maxTextW);
    });
  });
}

// --- generic button --------------------------------------------------------------
export function button(opts: {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  fontPx?: number;
  bg?: string;
  border?: string;
  fg?: string;
  icon?: IconName;
  iconColor?: string;
  disabled?: boolean;
  onTap: () => void;
}): void {
  const fg = opts.disabled ? "#5a6070" : (opts.fg ?? "#e6e9f0");
  const mesh = iconLabelPanel({
    w: opts.w,
    h: opts.h,
    text: opts.label,
    fontPx: opts.fontPx ?? 24,
    bg: opts.disabled ? "#161a24" : (opts.bg ?? "#243049"),
    border: opts.disabled ? "#2a3040" : (opts.border ?? "#54689a"),
    fg,
    icon: opts.icon,
    iconColor: opts.disabled ? "#5a6070" : (opts.iconColor ?? fg),
    bold: true,
  });
  mesh.position.set(opts.x, opts.y, opts.z ?? 2);
  addToStage(mesh);
  if (!opts.disabled) makeTappable(mesh, opts.onTap);
}

// --- card face (combat instances, deck masters, shop/reward cards) -----------------
export function cardFacePanel(opts: {
  w: number;
  h: number;
  def: CardDef;
  upgrades: number;
  costLabel: string;
  disabled?: boolean;
  selected?: boolean;
  /** footer line; defaults to the card type */
  footer?: string;
  footerColor?: string;
}): Mesh {
  const { w, h, def, upgrades } = opts;
  const disabled = opts.disabled ?? false;
  const selected = opts.selected ?? false;
  return canvasPanel(w, h, (g) => {
    const typeColor = TYPE_COLORS[def.type] ?? "#3d4a66";
    panelBg(
      g,
      w,
      h,
      disabled ? "#151926" : "#1e2536",
      selected ? "#ffd75e" : typeColor,
      selected ? 6 : 4,
      14,
    );
    const ink = disabled ? "#69707f" : "#e9ecf3";
    const dim = disabled ? "#565d6c" : "#a7aebd";
    const scale = Math.min(1, w / 190);

    // cost badge (top-left)
    g.beginPath();
    g.arc(30 * scale, 30 * scale, 20 * scale, 0, Math.PI * 2);
    g.fillStyle = disabled ? "#2e2230" : "#28324a";
    g.fill();
    g.strokeStyle = disabled ? "#8a4a5a" : "#5a6a92";
    g.lineWidth = 2.5;
    g.stroke();
    g.fillStyle = disabled ? "#e08090" : "#ffe9a0";
    g.font = `bold ${Math.round(24 * scale)}px -apple-system, system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(opts.costLabel, 30 * scale, 31 * scale);

    // name (upgraded shows +)
    const name = def.name + (upgrades > 0 ? "+" : "");
    g.fillStyle = upgrades > 0 && !disabled ? "#9fe3a1" : ink;
    g.font = `bold ${Math.round(22 * scale)}px -apple-system, system-ui, sans-serif`;
    g.textAlign = "left";
    g.fillText(name, 58 * scale, 30 * scale, w - 70 * scale);

    // rules text (wrapped, centered block)
    const body = cardRulesText(def.id, upgrades);
    g.fillStyle = ink;
    g.font = `${Math.round(19 * scale)}px -apple-system, system-ui, sans-serif`;
    g.textAlign = "center";
    const lines = wrapText(g, body, w - 32 * scale);
    const lh = 25 * scale;
    const cy = h / 2 + 14 * scale;
    lines.forEach((line, i) => {
      g.fillText(line, w / 2, cy + (i - (lines.length - 1) / 2) * lh, w - 26 * scale);
    });

    // footer (type by default; shops put the price here). The default type
    // footer gets a tiny type icon; custom footers (prices) stay text-only.
    const footerText = opts.footer ?? def.type.toUpperCase();
    const footerColor = opts.footerColor ?? dim;
    g.fillStyle = footerColor;
    g.font = `bold ${Math.round(16 * scale)}px -apple-system, system-ui, sans-serif`;
    const typeIcon = opts.footer === undefined ? CARD_TYPE_ICONS[def.type] : undefined;
    if (typeIcon) {
      const isz = 17 * scale;
      const tw = g.measureText(footerText).width;
      const x0 = w / 2 - (isz + 6 * scale + tw) / 2;
      drawIcon(g, typeIcon, x0, h - 20 * scale - isz / 2, isz, footerColor);
      g.fillText(footerText, x0 + isz + 6 * scale + tw / 2, h - 20 * scale);
    } else {
      g.fillText(footerText, w / 2, h - 20 * scale);
    }
  });
}

// --- thin line (map edges) -----------------------------------------------------------
export function lineMesh(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  color: string,
  z: number,
): Mesh {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(len, thickness),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }),
  );
  mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
  mesh.rotation.z = Math.atan2(dy, dx);
  return mesh;
}
