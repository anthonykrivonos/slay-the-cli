// Stage bootstrap: one WebGL canvas, orthographic camera on a fixed 1600x900
// virtual stage that letterboxes to any screen. All layout code positions
// objects in stage units (origin bottom-left, y up); the camera adapts.
//
// Also exports the shared canvas-texture panel helpers, tap raycasting, and a
// transient toast layer. The combat screen rebuilds the `content` group from
// scratch on every state change (clearStage + add*).

import * as THREE from "three";

export const STAGE_W = 1600;
export const STAGE_H = 900;

const root = document.getElementById("app")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090f);

const camera = new THREE.OrthographicCamera(0, STAGE_W, STAGE_H, 0, -1000, 1000);
// The camera MUST sit at positive z: Raycaster.setFromCamera puts the ortho ray
// origin on the camera plane firing -z, so content at z>camera.z is unhittable
// (renders fine — near=-1000 — which is why headless tests never caught it).
camera.position.z = 100;

function resize(): void {
  const w = root.clientWidth;
  const h = root.clientHeight;
  renderer.setSize(w, h, false);
  // Letterbox: show the full stage, keep aspect, center the overflow axis.
  const scale = Math.min(w / STAGE_W, h / STAGE_H);
  const viewW = w / scale;
  const viewH = h / scale;
  camera.left = -(viewW - STAGE_W) / 2;
  camera.right = STAGE_W + (viewW - STAGE_W) / 2;
  camera.bottom = -(viewH - STAGE_H) / 2;
  camera.top = STAGE_H + (viewH - STAGE_H) / 2;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// Stage backdrop so the letterbox bars read as "outside the table".
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(STAGE_W, STAGE_H),
  new THREE.MeshBasicMaterial({ color: 0x0b0e14 }),
);
backdrop.position.set(STAGE_W / 2, STAGE_H / 2, -5);
scene.add(backdrop);

// Rebuilt-per-state content vs persistent toasts.
const content = new THREE.Group();
scene.add(content);
const toastLayer = new THREE.Group();
scene.add(toastLayer);

// --- pointer/touch hit-testing ------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tappables = new Map<THREE.Object3D, () => void>();
let backgroundTap: (() => void) | null = null;

function onTap(ev: PointerEvent): void {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...tappables.keys()], false);
  const hit = hits[0];
  if (hit) tappables.get(hit.object)?.();
  else backgroundTap?.();
}
renderer.domElement.addEventListener("pointerdown", onTap);

export function makeTappable(obj: THREE.Object3D, fn: () => void): void {
  tappables.set(obj, fn);
}

/** Handler for taps that hit no tappable object (used to cancel targeting etc). */
export function onBackgroundTap(fn: (() => void) | null): void {
  backgroundTap = fn;
}

// --- scene content management --------------------------------------------------
export function addToStage(obj: THREE.Object3D): void {
  content.add(obj);
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (m instanceof THREE.MeshBasicMaterial) m.map?.dispose();
        m.dispose();
      }
    }
  });
}

/** Remove and dispose everything added via addToStage, and clear tap handlers. */
export function clearStage(): void {
  tappables.clear();
  backgroundTap = null;
  for (const child of [...content.children]) {
    content.remove(child);
    disposeObject(child);
  }
}

// --- canvas panels --------------------------------------------------------------
/** A plane whose texture is drawn by `draw` on a 2d canvas in stage units. */
export function canvasPanel(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
): THREE.Mesh {
  const dpr = 2;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  const g = cv.getContext("2d")!;
  g.scale(dpr, dpr);
  draw(g);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  return mesh;
}

/** Rounded panel background used by every panel drawer. */
export function panelBg(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: string,
  border: string,
  lineW = 3,
  radius = 12,
): void {
  g.fillStyle = bg;
  g.strokeStyle = border;
  g.lineWidth = lineW;
  g.beginPath();
  g.roundRect(lineW, lineW, w - lineW * 2, h - lineW * 2, radius);
  g.fill();
  g.stroke();
}

/** Word-wrap `text` (which may contain \n) to `maxW` using the ctx's current font. */
export function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter((s) => s.length > 0);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const attempt = line.length > 0 ? `${line} ${word}` : word;
      if (line.length > 0 && g.measureText(attempt).width > maxW) {
        out.push(line);
        line = word;
      } else {
        line = attempt;
      }
    }
    out.push(line);
  }
  return out;
}

export interface TextPanelOpts {
  w: number;
  h: number;
  text: string;
  fontPx?: number;
  bg?: string;
  fg?: string;
  border?: string;
  align?: "left" | "center";
  bold?: boolean;
  borderW?: number;
}

/** Simple multi-line text panel (buttons, labels, banners). */
export function textPanel(opts: TextPanelOpts): THREE.Mesh {
  const fontPx = opts.fontPx ?? 28;
  return canvasPanel(opts.w, opts.h, (g) => {
    panelBg(g, opts.w, opts.h, opts.bg ?? "#1c2333", opts.border ?? "#3d4a66", opts.borderW ?? 3);
    g.fillStyle = opts.fg ?? "#e6e9f0";
    g.font = `${opts.bold ? "bold " : ""}${fontPx}px -apple-system, system-ui, sans-serif`;
    g.textBaseline = "middle";
    const lines = opts.text.split("\n");
    const lh = fontPx * 1.3;
    const align = opts.align ?? "center";
    g.textAlign = align;
    const x = align === "center" ? opts.w / 2 : 16;
    lines.forEach((line, i) => {
      g.fillText(line, x, opts.h / 2 + (i - (lines.length - 1) / 2) * lh, opts.w - 24);
    });
  });
}

/** Full-screen dimmer used behind modal overlays (covers letterbox gutters too). */
export function dimPlane(opacity: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(STAGE_W * 3, STAGE_H * 3),
    new THREE.MeshBasicMaterial({ color: 0x04060a, transparent: true, opacity }),
  );
  mesh.position.set(STAGE_W / 2, STAGE_H / 2, 0);
  return mesh;
}

// --- toasts ----------------------------------------------------------------------
const activeToasts: { mesh: THREE.Mesh; until: number }[] = [];

/** Transient message (engine errors, UI hints). Auto-expires. */
export function toast(msg: string): void {
  const mesh = textPanel({
    w: 720,
    h: 64,
    text: msg,
    fontPx: 24,
    bg: "#3a2430",
    border: "#c0687a",
    fg: "#ffdce4",
  });
  mesh.position.set(STAGE_W / 2, 700 - activeToasts.length * 72, 90);
  toastLayer.add(mesh);
  activeToasts.push({ mesh, until: performance.now() + 2800 });
}

renderer.setAnimationLoop(() => {
  const now = performance.now();
  for (let i = activeToasts.length - 1; i >= 0; i--) {
    const t = activeToasts[i]!;
    if (t.until <= now) {
      toastLayer.remove(t.mesh);
      disposeObject(t.mesh);
      activeToasts.splice(i, 1);
    }
  }
  renderer.render(scene, camera);
});
