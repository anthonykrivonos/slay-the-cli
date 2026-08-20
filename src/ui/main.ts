// Full-run UI — every screen is three.js panels on the 1600x900 virtual stage
// (see stage.ts). Immediate-mode at game speed: every state or UI-interaction
// change rebuilds the scene from the current GameState (cheap at this scale,
// and guarantees the render always matches the engine). Tap-only interaction.
//
// Screen dispatch: main menu (no game) -> run screens keyed on run.room.kind
// (neow / map / combat / rewards / shop / rest / treasure / event / gameOver),
// with a persistent header (HP, gold, floor, act, potion belt, deck, relics)
// on every run screen. Modal overlays: pending choice, deck list (view /
// smith / remove), relic list, potion menu, pile inspection.
//
// z discipline: camera sits at z=100 (stage.ts) — ALL tappable content must
// stay within z 0..50. Screens use 0..8, overlays use 30..36.

import type { Mesh } from "three";
import { createRun, advance } from "../engine/game";
import type { GameState, Command, GameEvent } from "../engine/game";
import { buildBaseContentBundle } from "../content";
import type { CardInstance, MonsterState, Pile } from "../engine/combat/combatState";
import type { CardDef } from "../engine/content/defs";
import type { PendingChoice } from "../engine/core/actions";
import { getIntents, type IntentInfo } from "../engine/combat/intents";
import type { RoomState, RewardEntry, MasterCard } from "../engine/run/runState";
import {
  STAGE_W,
  addToStage,
  clearStage,
  makeTappable,
  onBackgroundTap,
  canvasPanel,
  textPanel,
  panelBg,
  wrapText,
  dimPlane,
  toast,
} from "./stage";
import { button, cardFacePanel, iconLabelPanel, lineMesh, TYPE_COLORS } from "./panels";
import { drawIcon, type IconName } from "./icons";
import {
  RUN_SAVE_KEY,
  MENU_SEED_KEY,
  MENU_CHARACTER_KEY,
  MENU_ASCENSION_KEY,
  PRESET_SEEDS,
  seedFromSearch,
  cycleSeed,
  bumpSeed,
  validateSavedRun,
  titleCase,
  relicName,
  potionName,
  eventTitle,
  masterCardCost,
  costText,
  canSmithMaster,
  smithableDeckIndices,
  neowBonusText,
  neowDrawbackText,
  legalMapPicks,
  BOSS_DOOR_Y,
  mapGlyph,
  restHealPreview,
  canRecall,
  rewardLabel,
  rewardBlocked,
  rewardRows,
  chestTitle,
  chestLootSummary,
  describeChoiceReason,
  CHARACTER_IDS,
  type UICharacterId,
  isCharacterId,
  CHARACTER_COLORS,
  characterSummary,
  MAX_ASCENSION,
  clampAscension,
  ascensionLabel,
  buildEventView,
  stanceColor,
  orbColor,
  playerFocus,
  orbDisplayValue,
  orbName,
  keyViews,
  gameOverTitle,
  gameOverSubtitle,
  gameOverStats,
} from "./runlogic";

// --- game + UI state ---------------------------------------------------------
const bundle = buildBaseContentBundle();

let game: GameState | null = null;
let screen: "menu" | "run" = "menu";
let seedInput: string = PRESET_SEEDS[0]!;
let charInput: UICharacterId = "IRONCLAD";
let ascInput = 0;

// UI-only state (never persisted; the rebuilt scene reads it)
type PileName = Extract<Pile, "draw" | "discard" | "exhaust">;
type DeckOverlayMode = "view" | "smith" | "remove";
let deckOverlay: { mode: DeckOverlayMode; page: number } | null = null;
let relicsOverlay = false;
let potionMenu: number | null = null; // belt slot with its use/discard menu open
let potionTargeting: number | null = null; // belt slot awaiting a monster target
let pileOverlay: PileName | null = null;
let targeting: number | null = null; // hand index awaiting a monster target
let choiceSel: number[] = []; // selected indices for the pending choice
let lastLoot: string | null = null; // treasure-room open result (display only)
const uiLog: string[] = []; // rolling event ticker (eventLog is drained per advance)

const OVERLAY_DIM_Z = 30;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function resetUiState(): void {
  deckOverlay = null;
  relicsOverlay = false;
  potionMenu = null;
  potionTargeting = null;
  pileOverlay = null;
  targeting = null;
  choiceSel = [];
  lastLoot = null;
}

function pushEvents(events: GameEvent[]): void {
  for (const ev of events) {
    let s = ev.event;
    if (ev.payload !== undefined) {
      let p: string;
      try {
        p = JSON.stringify(ev.payload) ?? "";
      } catch {
        p = String(ev.payload);
      }
      if (p.length > 44) p = `${p.slice(0, 41)}…`;
      s += ` ${p}`;
    }
    uiLog.push(s);
  }
  if (uiLog.length > 40) uiLog.splice(0, uiLog.length - 40);
}

// --- persistence --------------------------------------------------------------
function save(): void {
  if (!game) return;
  try {
    localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(game));
  } catch {
    // storage unavailable (private mode etc) — game still plays, just unsaved
  }
}

function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(RUN_SAVE_KEY);
    if (raw === null) return null;
    return validateSavedRun(JSON.parse(raw));
  } catch {
    return null;
  }
}

function discardSave(): void {
  try {
    localStorage.removeItem(RUN_SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/** Menu selections (seed / character / ascension) persist under their own keys. */
function saveMenuPrefs(): void {
  try {
    localStorage.setItem(MENU_SEED_KEY, seedInput);
    localStorage.setItem(MENU_CHARACTER_KEY, charInput);
    localStorage.setItem(MENU_ASCENSION_KEY, String(ascInput));
  } catch {
    /* storage unavailable */
  }
}

function loadMenuPrefs(): void {
  try {
    const seed = localStorage.getItem(MENU_SEED_KEY);
    if (seed !== null && seed.trim().length > 0) seedInput = seed;
    const ch = localStorage.getItem(MENU_CHARACTER_KEY);
    if (isCharacterId(ch)) charInput = ch;
    const asc = localStorage.getItem(MENU_ASCENSION_KEY);
    if (asc !== null) ascInput = clampAscension(asc);
  } catch {
    /* storage unavailable */
  }
}

// --- run control ------------------------------------------------------------------
function newRun(): void {
  saveMenuPrefs();
  try {
    game = createRun({ seed: seedInput, bundle, character: charInput, ascension: ascInput });
  } catch (e) {
    toast(errMsg(e));
    return;
  }
  screen = "run";
  resetUiState();
  uiLog.length = 0;
  pushEvents(game.eventLog);
  save();
  renderAll();
}

function continueRun(): void {
  const restored = readSave();
  if (!restored) {
    toast("No valid saved run found");
    renderAll();
    return;
  }
  game = restored;
  seedInput = restored.seed;
  if (isCharacterId(restored.run.character)) charInput = restored.run.character;
  ascInput = clampAscension(restored.run.ascension);
  screen = "run";
  resetUiState();
  uiLog.push("(restored saved run)");
  try {
    renderAll();
  } catch (e) {
    // stale/incompatible save from an older engine build — discard and recover
    console.error("restore failed, returning to menu:", e);
    discardSave();
    game = null;
    screen = "menu";
    renderAll();
    toast("Saved run was from an older version — it was discarded");
  }
}

function backToMenu(): void {
  screen = "menu";
  resetUiState();
  renderAll();
}

function doAdvance(cmd: Command): void {
  if (!game) return;
  targeting = null;
  potionTargeting = null;
  const prev = game;
  try {
    game = advance(game, cmd, bundle);
    choiceSel = [];
    pushEvents(game.eventLog);
    if (cmd.cmd === "openChest" || cmd.cmd === "takeSapphireKey") {
      lastLoot = chestLootSummary(prev, game, bundle);
    } else if (cmd.cmd === "proceed" || cmd.cmd === "mapPick") {
      lastLoot = null;
    }
    save();
  } catch (e) {
    const msg = errMsg(e);
    toast(/invariant/i.test(msg) ? "That can't be used right now" : msg);
  }
  renderAll();
}

// --- small derived helpers ----------------------------------------------------------
/** Mirror of the engine's playability gate for the disabled visual. */
function isPlayable(card: CardInstance): boolean {
  const c = game?.combat;
  if (!c) return false;
  if (card.cost === -2) return false; // unplayable
  if (card.cost === -1) return true; // X-cost spends whatever you have
  if (card.freeToPlayOnce) return true;
  return c.player.energy >= card.costForTurn;
}

function instCostLabel(card: CardInstance): string {
  if (card.cost === -1) return "X";
  if (card.cost === -2) return "–";
  return String(card.costForTurn);
}

function powerName(id: string): string {
  return bundle.powers.get(id)?.name ?? titleCase(id);
}

function prettyMove(monsterId: string, moveId: string): string {
  const stripped = moveId.startsWith(`${monsterId}_`) ? moveId.slice(monsterId.length + 1) : moveId;
  return titleCase(stripped);
}

function anyOverlayOpen(): boolean {
  return (
    game?.pending != null ||
    deckOverlay !== null ||
    relicsOverlay ||
    potionMenu !== null ||
    pileOverlay !== null
  );
}

function masterPanel(opts: {
  w: number;
  h: number;
  mc: MasterCard;
  disabled?: boolean;
  selected?: boolean;
}): Mesh {
  const def = bundle.cards.get(opts.mc.defId);
  if (!def) {
    return textPanel({ w: opts.w, h: opts.h, text: opts.mc.defId, fontPx: 18 });
  }
  return cardFacePanel({
    w: opts.w,
    h: opts.h,
    def,
    upgrades: opts.mc.upgrades,
    costLabel: costText(masterCardCost(def, opts.mc.upgrades)),
    disabled: opts.disabled,
    selected: opts.selected,
  });
}

// --- persistent run header --------------------------------------------------------------
function drawHeader(g: GameState): void {
  const run = g.run;
  const y = 866;
  const h = 52;

  const stat = (x: number, w: number, text: string, fg: string, icon: IconName): void => {
    const p = iconLabelPanel({
      w,
      h,
      text,
      fontPx: 21,
      bg: "#141926",
      border: "#2c3650",
      fg,
      bold: true,
      icon,
      iconSize: 24,
    });
    p.position.set(x, y, 3);
    addToStage(p);
  };
  stat(98, 176, `${run.hp}/${run.maxHp}`, "#e88a8a", "gi:hearts");
  stat(250, 118, `${run.gold}`, "#ffe9a0", "gi:two-coins");
  stat(388, 148, `F${run.floor} · A${run.act}`, "#c9d0e0", "mdi:map-marker");

  // the three Act 4 keys — lit when owned, dim when not (always visible)
  const keys = keyViews(run);
  const keysPanel = canvasPanel(118, h, (gc) => {
    panelBg(gc, 118, h, "#141926", "#2c3650", 3);
    keys.forEach((k, i) => {
      const c = k.owned ? k.color : "#333a4a";
      drawIcon(gc, "gi:key", 16 + i * 32, h / 2 - 12, 24, c);
    });
  });
  keysPanel.position.set(524, y, 3);
  addToStage(keysPanel);

  // potion belt
  const slots = run.potions.length;
  const slotW = slots > 3 ? 96 : 120;
  const beltX0 = 592;
  for (let i = 0; i < slots; i++) {
    const id = run.potions[i] ?? null;
    const x = beltX0 + slotW / 2 + i * (slotW + 6);
    const mesh = iconLabelPanel({
      w: slotW,
      h,
      text: id ? potionName(bundle, id) : "—",
      fontPx: 14,
      bg: id ? "#20283c" : "#10141e",
      border: id ? "#5f78b0" : "#232a3a",
      fg: id ? "#cfe0ff" : "#3c4356",
      icon: "gi:standing-potion",
      iconColor: id ? "#8fb8f0" : "#2b3244",
      iconSize: 20,
    });
    mesh.position.set(x, y, 3);
    addToStage(mesh);
    if (id) {
      const slot = i;
      makeTappable(mesh, () => {
        potionMenu = slot;
        targeting = null;
        potionTargeting = null;
        renderAll();
      });
    }
  }

  button({
    label: `${run.deck.length}`,
    icon: "mdi:cards",
    x: 1178,
    y,
    w: 138,
    h,
    z: 3,
    fontPx: 19,
    bg: "#1a2130",
    border: "#3d4a66",
    onTap: () => {
      deckOverlay = { mode: "view", page: 0 };
      renderAll();
    },
  });
  button({
    label: `${run.relics.length}`,
    icon: "gi:gem-pendant",
    x: 1322,
    y,
    w: 138,
    h,
    z: 3,
    fontPx: 19,
    bg: "#1a2130",
    border: "#3d4a66",
    onTap: () => {
      relicsOverlay = true;
      renderAll();
    },
  });
  button({
    label: "MENU",
    icon: "mdi:menu",
    x: 1520,
    y,
    w: 140,
    h,
    z: 3,
    fontPx: 19,
    bg: "#241d2e",
    border: "#6a5488",
    onTap: backToMenu,
  });
}

// --- main menu -----------------------------------------------------------------------------
function drawCharacterCard(id: UICharacterId, x: number, y: number): void {
  const info = characterSummary(bundle, id);
  const selected = charInput === id;
  const accent = CHARACTER_COLORS[id] ?? "#54689a";
  const w = 330;
  const h = 190;
  const mesh = canvasPanel(w, h, (g) => {
    panelBg(g, w, h, selected ? "#232c42" : "#161c2b", selected ? "#ffd75e" : accent, selected ? 5 : 3, 14);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = selected ? "#f0e8d2" : "#c9d0e0";
    g.font = "bold 30px -apple-system, system-ui, sans-serif";
    g.fillText(info.name, w / 2, 44, w - 30);
    // accent underline
    g.fillStyle = accent;
    g.fillRect(w / 2 - 50, 66, 100, 4);
    g.fillStyle = "#e88a8a";
    g.font = "bold 22px -apple-system, system-ui, sans-serif";
    g.fillText(`${info.maxHp} HP`, w / 2, 98);
    g.fillStyle = selected ? "#ffd9a0" : "#8a93a8";
    g.font = "19px -apple-system, system-ui, sans-serif";
    g.fillText(info.relic, w / 2, 136, w - 30);
    if (selected) {
      g.fillStyle = "#ffd75e";
      g.font = "bold 15px -apple-system, system-ui, sans-serif";
      g.fillText("SELECTED", w / 2, 168);
    }
  });
  mesh.position.set(x, y, 2);
  addToStage(mesh);
  makeTappable(mesh, () => {
    charInput = id;
    saveMenuPrefs();
    renderAll();
  });
}

function drawMenu(): void {
  const title = canvasPanel(700, 150, (g) => {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#f0e8d2";
    g.font = "bold 88px -apple-system, system-ui, sans-serif";
    g.fillText("SLAY", 350, 60);
    g.fillStyle = "#6f7a92";
    g.font = "20px -apple-system, system-ui, sans-serif";
    g.fillText("a mechanically exact spire", 350, 128);
  });
  title.position.set(STAGE_W / 2, 822, 1);
  addToStage(title);

  // character select: 4 tappable cards
  const cardW = 330;
  const gap = 24;
  const rowW = 4 * cardW + 3 * gap;
  CHARACTER_IDS.forEach((id, i) => {
    drawCharacterCard(id, (STAGE_W - rowW) / 2 + cardW / 2 + i * (cardW + gap), 640);
  });

  // ascension stepper: [-] ASCENSION n [+] with a one-line description
  button({
    label: "−",
    x: STAGE_W / 2 - 290,
    y: 478,
    w: 96,
    h: 68,
    fontPx: 34,
    bg: "#141926",
    border: "#3d4a66",
    disabled: ascInput <= 0,
    onTap: () => {
      ascInput = clampAscension(ascInput - 1);
      saveMenuPrefs();
      renderAll();
    },
  });
  const ascLabel = textPanel({
    w: 400,
    h: 68,
    text: ascInput === 0 ? "ASCENSION 0" : `ASCENSION ${ascInput}`,
    fontPx: 27,
    bold: true,
    bg: "#1c2333",
    border: ascInput > 0 ? "#c2a13e" : "#3d4a66",
    fg: ascInput > 0 ? "#ffe9a0" : "#c9d0e0",
  });
  ascLabel.position.set(STAGE_W / 2, 478, 1);
  addToStage(ascLabel);
  button({
    label: "+",
    x: STAGE_W / 2 + 290,
    y: 478,
    w: 96,
    h: 68,
    fontPx: 34,
    bg: "#141926",
    border: "#3d4a66",
    disabled: ascInput >= MAX_ASCENSION,
    onTap: () => {
      ascInput = clampAscension(ascInput + 1);
      saveMenuPrefs();
      renderAll();
    },
  });
  const ascDesc = textPanel({
    w: 780,
    h: 34,
    text: ascensionLabel(ascInput),
    fontPx: 17,
    bg: "#0b0e14",
    border: "#0b0e14",
    fg: "#8a93a8",
  });
  ascDesc.position.set(STAGE_W / 2, 424, 1);
  addToStage(ascDesc);

  button({
    label: `SEED  ${seedInput}   ▸`,
    x: STAGE_W / 2,
    y: 352,
    w: 560,
    h: 62,
    fontPx: 24,
    bg: "#141926",
    border: "#3d4a66",
    fg: "#9aa3b8",
    onTap: () => {
      seedInput = cycleSeed(seedInput);
      saveMenuPrefs();
      renderAll();
    },
  });
  const hint = textPanel({
    w: 560,
    h: 30,
    text: "tap to cycle — or set ?seed=YOURSEED in the URL",
    fontPx: 15,
    bg: "#0b0e14",
    border: "#0b0e14",
    fg: "#4a5266",
  });
  hint.position.set(STAGE_W / 2, 302, 1);
  addToStage(hint);

  button({
    label: "NEW RUN",
    x: STAGE_W / 2,
    y: 212,
    w: 460,
    h: 88,
    fontPx: 30,
    bg: "#1f3326",
    border: "#4f9a63",
    fg: "#c9edd2",
    onTap: newRun,
  });

  const saved = readSave();
  if (saved) {
    const savedName = bundle.characters.get(saved.run.character)?.name ?? saved.run.character;
    const desc =
      saved.run.room?.kind === "gameOver"
        ? "run over"
        : `${savedName} A${saved.run.ascension} · Floor ${saved.run.floor} · Act ${saved.run.act}`;
    button({
      label: `CONTINUE — ${desc}`,
      x: STAGE_W / 2,
      y: 118,
      w: 640,
      h: 74,
      fontPx: 22,
      onTap: continueRun,
    });
  }

  // icon-set attribution (game-icons.net requires CC BY credit)
  const credits = textPanel({
    w: 760,
    h: 30,
    text: "Icons: game-icons.net (CC BY 3.0) · Material Design Icons (Apache 2.0)",
    fontPx: 14,
    bg: "#0b0e14",
    border: "#0b0e14",
    fg: "#3c4356",
  });
  credits.position.set(STAGE_W / 2, 40, 1);
  addToStage(credits);
}

// --- neow ------------------------------------------------------------------------------------
function drawNeow(g: GameState, room: Extract<RoomState, { kind: "neow" }>): void {
  const title = textPanel({
    w: 900,
    h: 70,
    text: "NEOW'S BLESSING — choose one",
    fontPx: 32,
    bold: true,
    bg: "#1c2333",
    border: "#8a5bb5",
    fg: "#e6d9f7",
  });
  title.position.set(STAGE_W / 2, 770, 1);
  addToStage(title);

  room.options.forEach((opt, i) => {
    const hasDrawback = opt.drawback !== "NONE";
    const label = hasDrawback
      ? `${neowBonusText(opt.bonus)}\n⚠ ${neowDrawbackText(opt.drawback)}`
      : neowBonusText(opt.bonus);
    const mesh = canvasPanel(1080, 108, (gc) => {
      panelBg(gc, 1080, 108, "#1e2536", hasDrawback ? "#8a5bb5" : "#54689a", 3, 14);
      gc.textAlign = "center";
      gc.textBaseline = "middle";
      gc.fillStyle = "#e9ecf3";
      gc.font = "bold 25px -apple-system, system-ui, sans-serif";
      const lines = label.split("\n");
      if (lines.length === 1) {
        const wrapped = wrapText(gc, lines[0]!, 1020);
        wrapped.forEach((ln, li) =>
          gc.fillText(ln, 540, 54 + (li - (wrapped.length - 1) / 2) * 30, 1030),
        );
      } else {
        gc.fillText(lines[0]!, 540, 36, 1030);
        gc.fillStyle = "#d9a0a8";
        gc.font = "21px -apple-system, system-ui, sans-serif";
        gc.fillText(lines[1]!, 540, 74, 1030);
      }
    });
    mesh.position.set(STAGE_W / 2, 645 - i * 126, 2);
    addToStage(mesh);
    makeTappable(mesh, () => doAdvance({ cmd: "neowPick", i }));
  });
}

// --- map -----------------------------------------------------------------------------------
const NODE_COLORS: Record<string, string> = {
  monster: "#8891a8",
  elite: "#c25454",
  rest: "#6fce87",
  shop: "#e8c85a",
  treasure: "#c2a13e",
  unknown: "#9a7ab5",
  boss: "#e06a7a",
};

const MAP_NODE_ICONS: Record<string, IconName> = {
  monster: "gi:crossed-swords",
  elite: "gi:crowned-skull",
  rest: "gi:campfire",
  shop: "gi:swap-bag",
  treasure: "gi:chest",
  unknown: "mdi:help",
  event: "mdi:help",
  boss: "gi:daemon-skull",
  neow: "gi:cursed-star",
};

function drawMapScreen(g: GameState): void {
  const map = g.run.map;
  if (!map) {
    const p = textPanel({ w: 600, h: 80, text: "no map generated", fontPx: 24 });
    p.position.set(STAGE_W / 2, 450, 1);
    addToStage(p);
    return;
  }
  const pos = g.run.position;
  const picks = legalMapPicks(g.run);
  const pickSet = new Set(picks.map((p) => `${p.x},${p.y}`));
  const bossReachable = pickSet.has(`3,${BOSS_DOOR_Y}`);

  // Act 4 is a fixed 4-node column (rest/shop/elite/boss at x=3); the Heart is
  // a normal map node, so spread the short column out and skip the boss door.
  const act4 = map.act === 4;
  const rowY = (y: number): number => (act4 ? 150 + y * 190 : 74 + y * 47);
  const colX = (x: number): number => 265 + x * 178;
  const bossY = 792;

  // edges (thin quads)
  for (let y = 0; y < map.rows.length; y++) {
    for (const node of map.rows[y]!) {
      if (!node) continue;
      const fromY = rowY(y) + 15;
      if (y === map.rows.length - 1) {
        addToStage(lineMesh(colX(node.x), fromY, STAGE_W / 2, bossY - 24, 3, "#2c3650", 1));
      } else {
        for (const ex of node.edges) {
          addToStage(lineMesh(colX(node.x), fromY, colX(ex), rowY(y + 1) - 15, 3, "#2c3650", 1));
        }
      }
    }
  }

  // nodes
  for (let y = 0; y < map.rows.length; y++) {
    for (const node of map.rows[y]!) {
      if (!node) continue;
      const isCurrent = pos !== null && pos[0] === node.x && pos[1] === y;
      const isPick = pickSet.has(`${node.x},${y}`);
      const passed = pos !== null && y <= pos[1] && !isCurrent;
      const w = 170;
      const h = 46;
      const mesh = canvasPanel(w, h, (gc) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = 17;
        gc.globalAlpha = isCurrent || isPick ? 1 : passed ? 0.32 : 0.75;
        // highlight ring
        if (isCurrent || isPick) {
          gc.beginPath();
          gc.arc(cx, cy, r + 4.5, 0, Math.PI * 2);
          gc.strokeStyle = isCurrent ? "#ffd75e" : "#6fce87";
          gc.lineWidth = 3.5;
          gc.stroke();
        }
        gc.beginPath();
        gc.arc(cx, cy, r, 0, Math.PI * 2);
        gc.fillStyle = "#1e2536";
        gc.fill();
        gc.strokeStyle = node.burningElite ? "#ff8c3a" : (NODE_COLORS[node.kind] ?? "#8891a8");
        gc.lineWidth = 2.5;
        gc.stroke();
        const icon = MAP_NODE_ICONS[node.kind];
        if (icon) {
          drawIcon(gc, icon, cx - 10.5, cy - 10.5, 21, "#e9ecf3");
        } else {
          gc.fillStyle = "#e9ecf3";
          gc.font = "bold 20px -apple-system, system-ui, sans-serif";
          gc.textAlign = "center";
          gc.textBaseline = "middle";
          gc.fillText(mapGlyph(node.kind), cx, cy + 1);
        }
        if (node.emeraldKey) {
          gc.textAlign = "left";
          gc.textBaseline = "middle";
          gc.fillStyle = "#7de3a5";
          gc.font = "bold 13px -apple-system, system-ui, sans-serif";
          gc.textAlign = "left";
          gc.fillText("KEY", cx + r + 9, cy);
        }
      });
      mesh.position.set(colX(node.x), rowY(y), isPick || isCurrent ? 3 : 2);
      addToStage(mesh);
      if (isPick) {
        const nx = node.x;
        const ny = y;
        makeTappable(mesh, () => doAdvance({ cmd: "mapPick", x: nx, y: ny }));
      }
    }
  }

  // boss door (acts 1-3; in Act 4 the Heart is a regular node on the column)
  const bossName = bundle.monsters.get(map.bossId)?.name ?? titleCase(map.bossId);
  if (act4) {
    const title = iconLabelPanel({
      w: 560,
      h: 56,
      text: `ACT 4 — ${bossName.toUpperCase()} AWAITS`,
      fontPx: 25,
      bold: true,
      bg: "#33202a",
      border: "#e06a7a",
      fg: "#ffd9df",
      icon: "gi:daemon-skull",
    });
    title.position.set(STAGE_W / 2, bossY, 1);
    addToStage(title);
  } else {
    button({
      label: `BOSS — ${bossName}`,
      icon: "gi:daemon-skull",
      x: STAGE_W / 2,
      y: bossY,
      w: 460,
      h: 50,
      z: 3,
      fontPx: 22,
      bg: "#33202a",
      border: bossReachable ? "#e06a7a" : "#4a3038",
      fg: "#ffd9df",
      disabled: !bossReachable,
      onTap: () => doAdvance({ cmd: "mapPick", x: 3, y: BOSS_DOOR_Y }),
    });
  }

  // legend + hint (icons drawn inline)
  const hint = act4
    ? pos === null
      ? "The final climb: rest, shop, then the Shield and Spear guard the Heart"
      : "Tap the highlighted room to climb"
    : pos === null
      ? "Choose a room on the bottom row to begin the act"
      : "Tap a highlighted room to travel";
  const legendW = 1240;
  const legendH = 56;
  const legend = canvasPanel(legendW, legendH, (gc) => {
    panelBg(gc, legendW, legendH, "#10141e", "#232a3a", 2, 10);
    gc.fillStyle = "#8a93a8";
    gc.font = "16px -apple-system, system-ui, sans-serif";
    gc.textAlign = "center";
    gc.textBaseline = "middle";
    gc.fillText(hint, legendW / 2, 15, legendW - 30);
    // icon legend row
    const entries: { icon: IconName; label: string; color?: string }[] = [
      { icon: "gi:crossed-swords", label: "monster" },
      { icon: "gi:crowned-skull", label: "elite" },
      { icon: "gi:swap-bag", label: "shop" },
      { icon: "gi:campfire", label: "rest" },
      { icon: "gi:chest", label: "treasure" },
      { icon: "mdi:help", label: "unknown" },
      { icon: "gi:crowned-skull", label: "burning elite (Emerald Key)", color: "#ff8c3a" },
    ];
    gc.font = "15px -apple-system, system-ui, sans-serif";
    gc.textAlign = "left";
    const isz = 16;
    const gapIn = 5;
    const gapBetween = 22;
    let total = 0;
    for (const e of entries) total += isz + gapIn + gc.measureText(e.label).width + gapBetween;
    total -= gapBetween;
    let x = (legendW - total) / 2;
    const cy = 39;
    for (const e of entries) {
      drawIcon(gc, e.icon, x, cy - isz / 2, isz, e.color ?? "#6f7a92");
      x += isz + gapIn;
      gc.fillStyle = "#6f7a92";
      gc.fillText(e.label, x, cy);
      x += gc.measureText(e.label).width + gapBetween;
    }
  });
  legend.position.set(STAGE_W / 2 + 60, 30, 1);
  addToStage(legend);

  const seedP = textPanel({
    w: 200,
    h: 40,
    text: `seed ${g.seed}`,
    fontPx: 15,
    bg: "#10141e",
    border: "#232a3a",
    fg: "#4a5266",
  });
  seedP.position.set(110, 30, 1);
  addToStage(seedP);
}

// --- rewards ----------------------------------------------------------------------------------
const REWARD_ICONS: Record<RewardEntry["kind"], IconName> = {
  gold: "gi:two-coins",
  potion: "gi:standing-potion",
  relic: "gi:gem-pendant",
  emeraldKey: "gi:key",
  card: "mdi:cards",
  bossRelic: "gi:gem-pendant",
};

function drawRewards(g: GameState, room: Extract<RoomState, { kind: "rewards" }>): void {
  const title = iconLabelPanel({
    w: 700,
    h: 64,
    text: `REWARDS — ${room.source}`,
    fontPx: 30,
    bold: true,
    bg: "#1c2333",
    border: "#c2a13e",
    fg: "#ffe9a0",
    icon: "gi:two-coins",
  });
  title.position.set(STAGE_W / 2, 792, 1);
  addToStage(title);

  const rows = rewardRows(room.entries);
  let yCursor = 730;
  for (const row of rows) {
    if (row.type === "single") {
      const e = row.entry;
      const blocked = rewardBlocked(e, g.run);
      const label = e.taken
        ? `✓ ${rewardLabel(e, bundle)}`
        : blocked
          ? `${rewardLabel(e, bundle)}  (${blocked})`
          : rewardLabel(e, bundle);
      button({
        label,
        icon: REWARD_ICONS[e.kind],
        iconColor: e.kind === "emeraldKey" ? "#7de3a5" : undefined,
        x: STAGE_W / 2,
        y: yCursor - 33,
        w: 680,
        h: 62,
        z: 2,
        fontPx: 23,
        bg: e.taken ? "#161a24" : "#243049",
        disabled: e.taken || blocked !== null,
        onTap: () => doAdvance({ cmd: "takeReward", i: row.idx }),
      });
      yCursor -= 72;
    } else if (row.kind === "card") {
      const n = row.items.length;
      const cw = 178;
      const ch = 242;
      const gap = 18;
      const totalW = n * cw + (n - 1) * gap;
      const cy = yCursor - ch / 2 - 8;
      row.items.forEach((item, k) => {
        const e = item.entry;
        if (e.kind !== "card") return;
        const def = bundle.cards.get(e.id);
        const x = STAGE_W / 2 - totalW / 2 + cw / 2 + k * (cw + gap);
        let mesh: Mesh;
        if (def) {
          mesh = cardFacePanel({
            w: cw,
            h: ch,
            def,
            upgrades: e.upgraded ? 1 : 0,
            costLabel: costText(masterCardCost(def, e.upgraded ? 1 : 0)),
            disabled: e.taken,
          });
        } else {
          mesh = textPanel({ w: cw, h: ch, text: e.id, fontPx: 18 });
        }
        mesh.position.set(x, cy, 2);
        addToStage(mesh);
        if (!e.taken) makeTappable(mesh, () => doAdvance({ cmd: "takeReward", i: item.idx }));
      });
      yCursor -= ch + 26;
    } else {
      // boss relic choice
      const n = row.items.length;
      const rw = 360;
      const rh = 118;
      const gap = 24;
      const totalW = n * rw + (n - 1) * gap;
      const cy = yCursor - rh / 2 - 8;
      row.items.forEach((item, k) => {
        const e = item.entry;
        if (e.kind !== "bossRelic") return;
        const x = STAGE_W / 2 - totalW / 2 + rw / 2 + k * (rw + gap);
        const mesh = iconLabelPanel({
          w: rw,
          h: rh,
          text: `${relicName(bundle, e.id)}\nBOSS RELIC`,
          fontPx: 24,
          bold: true,
          bg: e.taken ? "#161a24" : "#2a2130",
          border: e.taken ? "#2a3040" : "#c08a3e",
          fg: e.taken ? "#5a6070" : "#ffd9a0",
          icon: "gi:gem-pendant",
          iconSize: 34,
        });
        mesh.position.set(x, cy, 2);
        addToStage(mesh);
        if (!e.taken) makeTappable(mesh, () => doAdvance({ cmd: "takeReward", i: item.idx }));
      });
      yCursor -= rh + 26;
    }
  }

  button({
    label: room.source === "boss" ? "ENTER NEXT ACT" : "CONTINUE",
    icon: "mdi:skip-next",
    x: 1390,
    y: 90,
    w: 340,
    h: 78,
    z: 2,
    fontPx: 26,
    bg: "#1f3326",
    border: "#4f9a63",
    fg: "#c9edd2",
    onTap: () => doAdvance({ cmd: "skipRewards" }),
  });
}

// --- shop --------------------------------------------------------------------------------------
function drawShop(g: GameState, room: Extract<RoomState, { kind: "shop" }>): void {
  const shop = room.shop;
  const gold = g.run.gold;

  const title = iconLabelPanel({
    w: 560,
    h: 60,
    text: "THE MERCHANT",
    fontPx: 30,
    bold: true,
    bg: "#1c2333",
    border: "#e8c85a",
    fg: "#ffe9a0",
    icon: "gi:swap-bag",
  });
  title.position.set(STAGE_W / 2, 794, 1);
  addToStage(title);

  // card slots (up to 7; centered on however many the engine rolled)
  const nCards = shop.cards.length;
  shop.cards.forEach((slot, i) => {
    const def = bundle.cards.get(slot.id);
    const afford = gold >= slot.price;
    const x = STAGE_W / 2 + (i - (nCards - 1) / 2) * 184;
    let mesh: Mesh;
    if (def) {
      mesh = cardFacePanel({
        w: 172,
        h: 244,
        def,
        upgrades: 0,
        costLabel: costText(def.cost),
        disabled: slot.sold || !afford,
        footer: slot.sold ? "SOLD" : `${slot.price} G`,
        footerColor: slot.sold ? "#5a6070" : afford ? "#ffd75e" : "#e08090",
      });
    } else {
      mesh = textPanel({ w: 172, h: 244, text: slot.id, fontPx: 16 });
    }
    mesh.position.set(x, 614, 2);
    addToStage(mesh);
    if (!slot.sold) {
      makeTappable(mesh, () => doAdvance({ cmd: "shopBuy", kind: "card", idx: i }));
    }
  });

  // 3 relics
  shop.relics.forEach((slot, i) => {
    const afford = gold >= slot.price;
    const mesh = iconLabelPanel({
      w: 392,
      h: 96,
      text: slot.sold
        ? `${relicName(bundle, slot.id)}\nSOLD`
        : `${relicName(bundle, slot.id)}\n${slot.tier} relic — ${slot.price} G`,
      fontPx: 22,
      bold: true,
      bg: slot.sold || !afford ? "#161a24" : "#22293c",
      border: slot.sold ? "#2a3040" : afford ? "#8a6f3e" : "#5a3a44",
      fg: slot.sold ? "#5a6070" : afford ? "#ffd9a0" : "#8a7580",
      icon: "gi:gem-pendant",
      iconSize: 30,
    });
    mesh.position.set(396 + i * 404, 420, 2);
    addToStage(mesh);
    if (!slot.sold) {
      makeTappable(mesh, () => doAdvance({ cmd: "shopBuy", kind: "relic", idx: i }));
    }
  });

  // 3 potions
  shop.potions.forEach((slot, i) => {
    const afford = gold >= slot.price;
    const mesh = iconLabelPanel({
      w: 392,
      h: 76,
      text: slot.sold
        ? `${potionName(bundle, slot.id)} — SOLD`
        : `${potionName(bundle, slot.id)} — ${slot.price} G`,
      fontPx: 21,
      bg: slot.sold || !afford ? "#161a24" : "#20283c",
      border: slot.sold ? "#2a3040" : afford ? "#5f78b0" : "#5a3a44",
      fg: slot.sold ? "#5a6070" : afford ? "#cfe0ff" : "#8a7580",
      icon: "gi:standing-potion",
      iconSize: 24,
    });
    mesh.position.set(396 + i * 404, 306, 2);
    addToStage(mesh);
    if (!slot.sold) {
      makeTappable(mesh, () => doAdvance({ cmd: "shopBuy", kind: "potion", idx: i }));
    }
  });

  // removal service
  button({
    label: shop.removalUsed ? "CARD REMOVAL — USED" : `REMOVE A CARD — ${shop.removalCost} G`,
    icon: "gi:card-burn",
    x: 400,
    y: 150,
    w: 560,
    h: 80,
    z: 2,
    fontPx: 25,
    bg: "#301f26",
    border: "#8a4a5a",
    fg: "#ffd9df",
    disabled: shop.removalUsed,
    onTap: () => {
      if (gold < shop.removalCost) {
        toast("Not enough gold for a removal");
        return;
      }
      deckOverlay = { mode: "remove", page: 0 };
      renderAll();
    },
  });

  button({
    label: "PROCEED",
    icon: "mdi:skip-next",
    x: 1390,
    y: 150,
    w: 320,
    h: 80,
    z: 2,
    fontPx: 26,
    bg: "#1f3326",
    border: "#4f9a63",
    fg: "#c9edd2",
    onTap: () => doAdvance({ cmd: "proceed" }),
  });
}

// --- rest --------------------------------------------------------------------------------------
function drawRest(g: GameState, room: Extract<RoomState, { kind: "rest" }>): void {
  const title = iconLabelPanel({
    w: 520,
    h: 70,
    text: "REST SITE",
    fontPx: 34,
    bold: true,
    bg: "#1c2a22",
    border: "#4f9a63",
    fg: "#c9edd2",
    icon: "gi:campfire",
  });
  title.position.set(STAGE_W / 2, 720, 1);
  addToStage(title);

  if (room.used) {
    const msg = textPanel({
      w: 720,
      h: 90,
      text: "You have already used this rest site.",
      fontPx: 26,
      bg: "#141926",
      border: "#2c3650",
      fg: "#9aa3b8",
    });
    msg.position.set(STAGE_W / 2, 520, 1);
    addToStage(msg);
    button({
      label: "CONTINUE",
      x: STAGE_W / 2,
      y: 330,
      w: 360,
      h: 90,
      z: 2,
      fontPx: 28,
      onTap: () => doAdvance({ cmd: "proceed" }),
    });
    return;
  }

  const heal = restHealPreview(g.run);
  const recall = canRecall(g.run, room.used);
  button({
    label: `REST — heal ${heal} HP  (${g.run.hp} → ${Math.min(g.run.maxHp, g.run.hp + heal)})`,
    icon: "gi:campfire",
    x: STAGE_W / 2,
    y: recall ? 560 : 540,
    w: 700,
    h: 104,
    z: 2,
    fontPx: 27,
    bg: "#1f3326",
    border: "#4f9a63",
    fg: "#c9edd2",
    onTap: () => doAdvance({ cmd: "restOption", kind: "rest" }),
  });

  const smithable = smithableDeckIndices(g.run, bundle);
  button({
    label: "SMITH — upgrade a card",
    icon: "gi:anvil",
    x: STAGE_W / 2,
    y: recall ? 434 : 400,
    w: 700,
    h: 104,
    z: 2,
    fontPx: 27,
    bg: "#2c2a1a",
    border: "#c2a13e",
    fg: "#ffe9a0",
    disabled: smithable.length === 0,
    onTap: () => {
      deckOverlay = { mode: "smith", page: 0 };
      renderAll();
    },
  });

  if (recall) {
    button({
      label: "RECALL — take the Ruby Key",
      icon: "gi:key",
      iconColor: "#e06a7a",
      x: STAGE_W / 2,
      y: 312,
      w: 700,
      h: 92,
      z: 2,
      fontPx: 25,
      bg: "#33202a",
      border: "#e06a7a",
      fg: "#ffd9df",
      onTap: () => doAdvance({ cmd: "restOption", kind: "recall" }),
    });
    const note = textPanel({
      w: 700,
      h: 30,
      text: "Uses the rest site — one of three keys needed to reach Act 4",
      fontPx: 15,
      bg: "#0b0e14",
      border: "#0b0e14",
      fg: "#8a7580",
    });
    note.position.set(STAGE_W / 2, 252, 1);
    addToStage(note);
  }

  button({
    label: "LEAVE",
    x: STAGE_W / 2,
    y: recall ? 172 : 230,
    w: 320,
    h: 76,
    z: 2,
    fontPx: 24,
    onTap: () => doAdvance({ cmd: "proceed" }),
  });
}

// --- treasure ------------------------------------------------------------------------------------
function drawTreasure(g: GameState, room: Extract<RoomState, { kind: "treasure" }>): void {
  const chest = room.chest;
  const sub = chest.opened ? (lastLoot ?? "Chest opened.") : "Something glints inside…";
  const panel = iconLabelPanel({
    w: 720,
    h: 190,
    text: `${chestTitle(chest.size)}\n${sub}`,
    fontPx: 30,
    bold: true,
    bg: "#241d12",
    border: "#c2a13e",
    fg: "#ffe9a0",
    icon: chest.opened ? "gi:open-treasure-chest" : "gi:locked-chest",
    iconSize: 56,
  });
  panel.position.set(STAGE_W / 2, 600, 1);
  addToStage(panel);

  if (!chest.opened) {
    button({
      label: "OPEN CHEST",
      icon: "gi:open-treasure-chest",
      x: STAGE_W / 2,
      y: 400,
      w: 480,
      h: 100,
      z: 2,
      fontPx: 30,
      bg: "#2c2a1a",
      border: "#c2a13e",
      fg: "#ffe9a0",
      onTap: () => doAdvance({ cmd: "openChest" }),
    });
    if (chest.sapphireKeyAvailable) {
      button({
        label: "TAKE THE SAPPHIRE KEY\n(forfeits the relic)",
        icon: "gi:key",
        iconColor: "#7db8f0",
        x: STAGE_W / 2,
        y: 268,
        w: 480,
        h: 96,
        z: 2,
        fontPx: 22,
        bg: "#1a2434",
        border: "#5f9ad0",
        fg: "#cfe6ff",
        onTap: () => doAdvance({ cmd: "takeSapphireKey" }),
      });
    }
  } else {
    button({
      label: "CONTINUE",
      x: STAGE_W / 2,
      y: 360,
      w: 360,
      h: 90,
      z: 2,
      fontPx: 28,
      onTap: () => doAdvance({ cmd: "proceed" }),
    });
  }
}

// --- event ----------------------------------------------------------------------------------------
function drawEvent(g: GameState, room: Extract<RoomState, { kind: "event" }>): void {
  const title = iconLabelPanel({
    w: 900,
    h: 72,
    text: eventTitle(bundle, room.eventId),
    fontPx: 32,
    bold: true,
    bg: "#221a30",
    border: "#9a7ab5",
    fg: "#e6d9f7",
    icon: "mdi:help-circle",
  });
  title.position.set(STAGE_W / 2, 776, 1);
  addToStage(title);

  // buildEventScreen over a read-only ctx; null = stub room (empty passage /
  // exhausted pool) which keeps the single implicit "leave" option.
  const view = buildEventView(g, bundle);

  if (!view) {
    const panel = textPanel({
      w: 900,
      h: 110,
      text: "The passage is empty. Nothing stirs.",
      fontPx: 24,
      bg: "#141926",
      border: "#2c3650",
      fg: "#9aa3b8",
    });
    panel.position.set(STAGE_W / 2, 600, 1);
    addToStage(panel);
    button({
      label: "LEAVE",
      x: STAGE_W / 2,
      y: 400,
      w: 360,
      h: 92,
      z: 2,
      fontPx: 28,
      onTap: () => doAdvance({ cmd: "eventOption", i: 0 }),
    });
    return;
  }

  // summary: wrapped text panel
  const sumW = 1060;
  const sumH = 128;
  const summary = canvasPanel(sumW, sumH, (gc) => {
    panelBg(gc, sumW, sumH, "#141926", "#2c3650", 3, 12);
    gc.fillStyle = "#c9d0e0";
    gc.font = "23px -apple-system, system-ui, sans-serif";
    gc.textAlign = "center";
    gc.textBaseline = "middle";
    const lines = wrapText(gc, view.summary, sumW - 60).slice(0, 4);
    lines.forEach((line, i) => {
      gc.fillText(line, sumW / 2, sumH / 2 + (i - (lines.length - 1) / 2) * 30, sumW - 50);
    });
  });
  summary.position.set(STAGE_W / 2, 656, 1);
  addToStage(summary);

  // one button per option; disabled visual when !enabled(ctx). Multi-screen
  // events re-render automatically: state changes rebuild via buildEventScreen.
  // Long lists (Match and Keep's 12-card grid) wrap into two columns.
  const n = view.options.length;
  const cols = n > 6 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const bw = cols === 2 ? 560 : 1060;
  const bh = rows > 5 ? 62 : 78;
  const step = bh + 12;
  const topY = 520;
  view.options.forEach((opt, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = cols === 1 ? STAGE_W / 2 : STAGE_W / 2 + (col === 0 ? -(bw / 2 + 8) : bw / 2 + 8);
    button({
      label: opt.label,
      x,
      y: topY - row * step,
      w: bw,
      h: bh,
      z: 2,
      fontPx: rows > 5 || cols === 2 ? 18 : 21,
      bg: "#241d30",
      border: "#8a5bb5",
      fg: "#e6d9f7",
      disabled: !opt.enabled,
      onTap: () => doAdvance({ cmd: "eventOption", i }),
    });
  });
}

// --- game over ---------------------------------------------------------------------------------------
function drawGameOver(g: GameState, room: Extract<RoomState, { kind: "gameOver" }>): void {
  const victory = room.victory;
  const heart = victory && g.run.act >= 4;
  const banner = iconLabelPanel({
    w: 860,
    h: 150,
    text: gameOverTitle(victory, g.run.act),
    fontPx: heart ? 58 : 72,
    bold: true,
    bg: victory ? "#1f3326" : "#331b20",
    border: heart ? "#ffd75e" : victory ? "#6fce87" : "#c0687a",
    fg: heart ? "#ffe9a0" : victory ? "#c9edd2" : "#ffdce4",
    borderW: 6,
    icon: victory ? "mdi:trophy" : "mdi:skull",
    iconSize: 76,
  });
  banner.position.set(STAGE_W / 2, 620, 2);
  addToStage(banner);

  const sub = textPanel({
    w: 860,
    h: 40,
    text: gameOverSubtitle(victory, g.run.act),
    fontPx: 20,
    bg: "#0b0e14",
    border: "#0b0e14",
    fg: victory ? "#9fd8ac" : "#c99aa4",
  });
  sub.position.set(STAGE_W / 2, 528, 2);
  addToStage(sub);

  const stats = textPanel({
    w: 560,
    h: 126,
    text: gameOverStats(g, bundle),
    fontPx: 23,
    bg: "#141926",
    border: "#2c3650",
    fg: "#9aa3b8",
  });
  stats.position.set(STAGE_W / 2, 428, 2);
  addToStage(stats);

  button({
    label: "NEW RUN",
    x: STAGE_W / 2,
    y: 290,
    w: 400,
    h: 92,
    z: 2,
    fontPx: 30,
    bg: "#1f3326",
    border: "#4f9a63",
    fg: "#c9edd2",
    onTap: () => {
      // rerun with the same character/ascension on a bumped seed
      seedInput = bumpSeed(g.seed);
      if (isCharacterId(g.run.character)) charInput = g.run.character;
      ascInput = clampAscension(g.run.ascension);
      newRun();
    },
  });
  button({
    label: "MENU",
    x: STAGE_W / 2,
    y: 185,
    w: 300,
    h: 72,
    z: 2,
    fontPx: 24,
    onTap: backToMenu,
  });
}

// --- combat screen ----------------------------------------------------------------------------------
/** Icons per intent category (fallback mdi:help). */
const INTENT_ICONS: Record<string, IconName[]> = {
  attack: ["gi:crossed-swords"],
  attackDebuff: ["gi:crossed-swords", "mdi:arrow-down-bold"],
  attackBuff: ["gi:crossed-swords", "mdi:arrow-up-bold"],
  attackDefend: ["gi:crossed-swords", "gi:checked-shield"],
  defend: ["gi:checked-shield"],
  defendBuff: ["gi:checked-shield", "mdi:arrow-up-bold"],
  defendDebuff: ["gi:checked-shield", "mdi:arrow-down-bold"],
  buff: ["mdi:arrow-up-bold"],
  debuff: ["mdi:arrow-down-bold"],
  strongDebuff: ["mdi:arrow-down-bold", "mdi:arrow-down-bold"],
  sleep: ["mdi:sleep"],
  stun: ["mdi:star-circle"],
  escape: ["gi:run"],
  magic: ["gi:cursed-star"],
  unknown: ["mdi:help"],
};

const INTENT_LABELS: Record<string, string> = {
  buff: "Buffing",
  debuff: "Debuffing you",
  strongDebuff: "Debuffing you hard",
  sleep: "Sleeping",
  stun: "Stunned",
  escape: "Escaping",
  magic: "Casting",
  unknown: "Unknown",
  defend: "Defending",
  defendBuff: "Defend + buff",
  defendDebuff: "Defend + debuff",
};

function monsterPanel(m: MonsterState, highlight: boolean, intent: IntentInfo | null): Mesh {
  const w = 480;
  const h = 210;
  return canvasPanel(w, h, (g) => {
    const gone = m.isDead || m.isEscaped;
    panelBg(
      g,
      w,
      h,
      gone ? "#12151e" : "#222a3d",
      highlight ? "#ffd75e" : gone ? "#272d3c" : "#5b6788",
      highlight ? 6 : 3,
    );
    const def = bundle.monsters.get(m.id);
    const ink = gone ? "#59606f" : "#f0e8d2";
    const sub = gone ? "#4a505e" : "#b3bac9";

    g.fillStyle = ink;
    g.font = "bold 28px -apple-system, system-ui, sans-serif";
    g.textAlign = "left";
    g.textBaseline = "top";
    const status = m.isDead ? "  (dead)" : m.isEscaped ? "  (escaped)" : "";
    g.fillText((def?.name ?? titleCase(m.id)) + status, 20, 14, w - 40);

    // hp bar
    const barX = 20;
    const barY = 58;
    const barW = w - 40;
    const barH = 20;
    g.fillStyle = "#33171d";
    g.beginPath();
    g.roundRect(barX, barY, barW, barH, 6);
    g.fill();
    const ratio = m.maxHp > 0 ? Math.max(0, Math.min(1, m.hp / m.maxHp)) : 0;
    if (ratio > 0) {
      g.fillStyle = gone ? "#4a2a30" : "#b03a45";
      g.beginPath();
      g.roundRect(barX, barY, barW * ratio, barH, 6);
      g.fill();
    }
    g.fillStyle = sub;
    g.font = "20px -apple-system, system-ui, sans-serif";
    g.fillText(`HP ${m.hp}/${m.maxHp}` + (m.block > 0 ? `   Block ${m.block}` : ""), barX, barY + 28);

    // --- intent row (the combat-readability centerpiece): live numbers ---
    // attack damage is per-hit and already run through the damage calc.
    const rowCY = 132; // vertical center of the intent row
    if (!gone && intent) {
      let x = 20;
      g.textBaseline = "middle";
      if (intent.damage !== null) {
        // big attack number: sword + "N" or "N x H"
        const warm = "#ff9e6e";
        drawIcon(g, "gi:crossed-swords", x, rowCY - 17, 34, warm);
        x += 42;
        const dmgText = intent.hits > 1 ? `${intent.damage} × ${intent.hits}` : `${intent.damage}`;
        g.fillStyle = warm;
        g.font = "bold 38px -apple-system, system-ui, sans-serif";
        g.fillText(dmgText, x, rowCY + 1);
        x += g.measureText(dmgText).width + 18;
        if (intent.block > 0) {
          // secondary: incoming self-block (hidden in the real game; shown for UX)
          drawIcon(g, "gi:checked-shield", x, rowCY - 12, 24, "#9fb8e8");
          x += 30;
          g.fillStyle = "#9fb8e8";
          g.font = "bold 24px -apple-system, system-ui, sans-serif";
          g.fillText(`+${intent.block}`, x, rowCY + 1);
          x += g.measureText(`+${intent.block}`).width + 12;
        }
      } else if (intent.block > 0) {
        // pure defend: shield + "+N"
        drawIcon(g, "gi:checked-shield", x, rowCY - 15, 30, "#9fb8e8");
        x += 38;
        g.fillStyle = "#9fb8e8";
        g.font = "bold 32px -apple-system, system-ui, sans-serif";
        g.fillText(`+${intent.block}`, x, rowCY + 1);
        x += g.measureText(`+${intent.block}`).width + 12;
      } else {
        // category-only intent: icon(s) + short label
        const icons = INTENT_ICONS[intent.kind] ?? ["mdi:help"];
        for (const ic of icons) {
          drawIcon(g, ic, x, rowCY - 13, 26, "#ffcf87");
          x += 31;
        }
        x += 5;
        g.fillStyle = "#ffcf87";
        g.font = "bold 22px -apple-system, system-ui, sans-serif";
        const label = INTENT_LABELS[intent.kind] ?? titleCase(intent.kind);
        g.fillText(label, x, rowCY + 1, w - x - 130);
      }
      // move name, small, right-aligned
      g.fillStyle = sub;
      g.font = "17px -apple-system, system-ui, sans-serif";
      g.textAlign = "right";
      g.fillText(prettyMove(m.id, intent.moveId), w - 20, rowCY + 1, 150);
      g.textAlign = "left";
      g.textBaseline = "top";
    } else if (!gone) {
      g.fillStyle = sub;
      g.font = "bold 21px -apple-system, system-ui, sans-serif";
      g.textBaseline = "middle";
      g.fillText("Intent: unknown", 20, rowCY + 1);
      g.textBaseline = "top";
    }

    // powers list
    const powers = m.powers.map((p) => `${powerName(p.id)} ${p.amount}`).join(", ");
    g.fillStyle = sub;
    g.font = "19px -apple-system, system-ui, sans-serif";
    const pLines = wrapText(g, powers.length > 0 ? `Powers: ${powers}` : "Powers: —", w - 40);
    pLines.slice(0, 2).forEach((line, i) => g.fillText(line, 20, 156 + i * 24, w - 40));

    if (highlight) {
      g.fillStyle = "#ffd75e";
      g.font = "bold 17px -apple-system, system-ui, sans-serif";
      g.textAlign = "right";
      g.fillText("TAP TO TARGET", w - 18, 16);
    }
  });
}

function playerPanel(g: GameState): Mesh {
  const w = 300;
  const h = 250;
  return canvasPanel(w, h, (gc) => {
    panelBg(gc, w, h, "#1a2130", "#46557a", 3);
    const c = g.combat!;
    const p = c.player;
    gc.textAlign = "left";
    gc.textBaseline = "top";
    gc.fillStyle = "#f0e8d2";
    gc.font = "bold 26px -apple-system, system-ui, sans-serif";
    gc.fillText(bundle.characters.get(g.run.character)?.name ?? g.run.character, 18, 14);

    gc.font = "22px -apple-system, system-ui, sans-serif";
    drawIcon(gc, "gi:hearts", 18, 54, 22, "#e88a8a");
    gc.fillStyle = "#e88a8a";
    gc.fillText(`HP ${g.run.hp}/${g.run.maxHp}`, 48, 54);
    drawIcon(gc, "gi:checked-shield", 18, 86, 22, "#9fb8e8");
    gc.fillStyle = "#9fb8e8";
    gc.fillText(`Block ${p.block}`, 48, 86);
    drawIcon(gc, "gi:power-lightning", 18, 118, 22, "#ffe9a0");
    gc.fillStyle = "#ffe9a0";
    gc.fillText(`Energy ${p.energy}/${p.energyPerTurn}`, 48, 118);

    // stance badge next to energy (Calm blue / Wrath red / Divinity gold)
    if (p.stance !== "NEUTRAL") {
      const sc = stanceColor(p.stance);
      const sname = (bundle.stances.get(p.stance)?.name ?? titleCase(p.stance)).toUpperCase();
      gc.font = "bold 15px -apple-system, system-ui, sans-serif";
      const bw = Math.max(64, gc.measureText(sname).width + 20);
      const bx = w - 18 - bw;
      gc.fillStyle = "#10141e";
      gc.strokeStyle = sc;
      gc.lineWidth = 2.5;
      gc.beginPath();
      gc.roundRect(bx, 114, bw, 30, 8);
      gc.fill();
      gc.stroke();
      gc.fillStyle = sc;
      gc.textAlign = "center";
      gc.textBaseline = "middle";
      gc.fillText(sname, bx + bw / 2, 130, bw - 12);
      gc.textAlign = "left";
      gc.textBaseline = "top";
      gc.font = "22px -apple-system, system-ui, sans-serif";
    }

    let y = 150;
    // mantra counter (Watcher): 10 mantra enters Divinity
    if (p.mantra > 0) {
      gc.fillStyle = "#ffd75e";
      gc.font = "20px -apple-system, system-ui, sans-serif";
      gc.fillText(`Mantra ${p.mantra}/10`, 18, y);
      y += 28;
    }
    const powers = p.powers.map((pw) => `${powerName(pw.id)} ${pw.amount}`).join(", ");
    if (powers.length > 0) {
      gc.fillStyle = "#b3bac9";
      gc.font = "19px -apple-system, system-ui, sans-serif";
      const lines = wrapText(gc, powers, w - 36);
      lines.slice(0, 3).forEach((line, i) => gc.fillText(line, 18, y + i * 24, w - 36));
    }
  });
}

/** Defect orb row: one circle per slot — hollow when empty, colored per orb
 *  with its display value (L/F passive incl. Focus, Dark stored total,
 *  Plasma flat) and the orb name underneath. */
function orbRowPanel(g: GameState): Mesh {
  const c = g.combat!;
  const p = c.player;
  const slots = p.orbSlots;
  const cell = Math.min(74, Math.floor(280 / Math.max(1, slots)));
  const w = Math.max(120, slots * cell + 20);
  const h = 96;
  const focus = playerFocus(p.powers);
  return canvasPanel(w, h, (gc) => {
    panelBg(gc, w, h, "#141926", "#2c3650", 2, 10);
    const x0 = (w - slots * cell) / 2 + cell / 2;
    for (let i = 0; i < slots; i++) {
      const cx = x0 + i * cell;
      const cy = 40;
      const r = Math.min(24, cell / 2 - 6);
      const orb = p.orbs[i];
      gc.beginPath();
      gc.arc(cx, cy, r, 0, Math.PI * 2);
      if (orb) {
        const col = orbColor(orb.id);
        gc.fillStyle = "#10141e";
        gc.fill();
        gc.strokeStyle = col;
        gc.lineWidth = 3;
        gc.stroke();
        const val = orbDisplayValue(bundle, orb, focus);
        gc.fillStyle = col;
        gc.font = "bold 20px -apple-system, system-ui, sans-serif";
        gc.textAlign = "center";
        gc.textBaseline = "middle";
        gc.fillText(val === null ? "?" : String(val), cx, cy + 1);
        gc.font = "12px -apple-system, system-ui, sans-serif";
        gc.fillText(orbName(bundle, orb.id), cx, cy + r + 14, cell - 4);
      } else {
        // empty slot: hollow circle
        gc.strokeStyle = "#333a4a";
        gc.lineWidth = 2;
        gc.stroke();
      }
    }
  });
}

function eventLogPanel(): Mesh {
  const w = 500;
  const h = 130;
  const last = uiLog.slice(-4);
  return canvasPanel(w, h, (g) => {
    panelBg(g, w, h, "#141926", "#2c3650", 2, 10);
    g.textAlign = "left";
    g.textBaseline = "top";
    g.fillStyle = "#6f7a92";
    g.font = "15px -apple-system, system-ui, sans-serif";
    g.fillText("LOG", 14, 8);
    g.fillStyle = "#9aa3b8";
    g.font = "17px ui-monospace, Menlo, monospace";
    last.forEach((line, i) => g.fillText(line, 14, 30 + i * 24, w - 28));
  });
}

function combatLocked(): boolean {
  return game?.pending != null || anyOverlayOpen();
}

function drawHand(g: GameState): void {
  const c = g.combat;
  if (!c) return;
  const hand = c.player.piles.hand;
  const n = hand.length;
  if (n === 0) return;
  const W = 190;
  const H = 270; // tap target well over 64 stage units tall
  const span = n === 1 ? W : Math.min(n * (W + 8) - 8, 940);
  const step = n > 1 ? (span - W) / (n - 1) : 0;
  const x0 = STAGE_W / 2 - span / 2 + W / 2;
  const locked = combatLocked();

  hand.forEach((iid, i) => {
    const card = c.cards[iid];
    if (!card) return;
    const def = bundle.cards.get(card.defId);
    if (!def) return;
    const selected = targeting === i;
    const mesh = cardFacePanel({
      w: W,
      h: H,
      def,
      upgrades: card.upgrades,
      costLabel: instCostLabel(card),
      disabled: locked || !isPlayable(card),
      selected,
    });
    mesh.position.set(x0 + i * step, selected ? 195 : 150, 5 + i * 0.01 + (selected ? 3 : 0));
    addToStage(mesh);
    makeTappable(mesh, () => onHandTap(i));
  });
}

function onHandTap(i: number): void {
  const g = game;
  if (!g || combatLocked()) return;
  const c = g.combat;
  if (!c) return;
  const iid = c.player.piles.hand[i];
  if (iid === undefined) return;
  const card = c.cards[iid];
  if (!card) return;
  const def = bundle.cards.get(card.defId);
  if (!def) return;

  potionTargeting = null;
  if (targeting === i) {
    targeting = null; // tap again to cancel
    renderAll();
    return;
  }
  if (!isPlayable(card)) {
    toast(card.cost === -2 ? `${def.name} is unplayable` : `Not enough energy for ${def.name}`);
    return;
  }
  if (def.target === "enemy") {
    targeting = i;
    renderAll();
  } else {
    doAdvance({ cmd: "playCard", handIdx: i });
  }
}

function drawMonsters(g: GameState): void {
  const c = g.combat;
  if (!c) return;
  const intents = getIntents(g, bundle);
  const n = c.monsters.length;
  const gap = n > 1 ? Math.min(230, 440 / (n - 1)) : 0;
  const topY = 610;
  c.monsters.forEach((m, idx) => {
    const targetable = (targeting !== null || potionTargeting !== null) && !m.isDead && !m.isEscaped;
    const mesh = monsterPanel(m, targetable, intents[idx] ?? null);
    mesh.position.set(1330, topY - idx * gap, 2 + idx * 0.01);
    addToStage(mesh);
    if (targetable) {
      makeTappable(mesh, () => {
        if (targeting !== null) {
          const handIdx = targeting;
          doAdvance({ cmd: "playCard", handIdx, target: idx });
        } else if (potionTargeting !== null) {
          const slot = potionTargeting;
          doAdvance({ cmd: "usePotion", slot, target: idx });
        }
      });
    }
  });

  if (targeting !== null || potionTargeting !== null) {
    const what = targeting !== null ? "play the card on it" : "throw the potion at it";
    const hint = textPanel({
      w: 680,
      h: 54,
      text: `Tap a monster to ${what} — tap empty space to cancel`,
      fontPx: 21,
      bg: "#2c2a1a",
      border: "#ffd75e",
      fg: "#ffe9a0",
    });
    hint.position.set(STAGE_W / 2, 330, 6);
    addToStage(hint);
  }
}

function drawPiles(g: GameState): void {
  const c = g.combat;
  if (!c) return;
  const spots: { pile: PileName; label: string; icon: IconName; x: number; y: number }[] = [
    { pile: "draw", label: "Draw", icon: "gi:card-draw", x: 105, y: 100 },
    { pile: "discard", label: "Discard", icon: "gi:card-discard", x: 1350, y: 60 },
    { pile: "exhaust", label: "Exhaust", icon: "gi:card-burn", x: 1515, y: 60 },
  ];
  for (const s of spots) {
    const count = c.player.piles[s.pile].length;
    button({
      label: `${s.label}: ${count}`,
      icon: s.icon,
      x: s.x,
      y: s.y,
      w: 160,
      h: 72,
      fontPx: 19,
      bg: "#1a2130",
      border: "#3d4a66",
      onTap: () => {
        if (game?.pending) return;
        pileOverlay = s.pile;
        targeting = null;
        potionTargeting = null;
        renderAll();
      },
    });
  }
}

function drawCombat(g: GameState): void {
  const c = g.combat;
  if (!c) return;

  const logP = eventLogPanel();
  logP.position.set(270, 765, 1);
  addToStage(logP);

  const turn = textPanel({
    w: 130,
    h: 52,
    text: `Turn ${c.turn}`,
    fontPx: 21,
    bg: "#141926",
    border: "#2c3650",
    fg: "#c9d0e0",
  });
  turn.position.set(600, 765, 1);
  addToStage(turn);

  const player = playerPanel(g);
  player.position.set(170, 425, 1);
  addToStage(player);

  // orb row (Defect): sits directly above the player panel
  if (c.player.orbSlots > 0) {
    const orbs = orbRowPanel(g);
    orbs.position.set(170, 605, 1);
    addToStage(orbs);
  }

  drawMonsters(g);
  drawHand(g);
  drawPiles(g);

  button({
    label: "END TURN",
    icon: "gi:hourglass",
    x: 1432,
    y: 165,
    w: 280,
    h: 92, // big mobile tap target
    fontPx: 30,
    bg: "#1f3326",
    border: "#4f9a63",
    fg: "#c9edd2",
    disabled: combatLocked(),
    onTap: () => doAdvance({ cmd: "endTurn" }),
  });
}

// --- overlays ---------------------------------------------------------------------------------------
function overlayDim(onTapOutside?: () => void): void {
  const dim = dimPlane(0.74);
  dim.position.z = OVERLAY_DIM_Z;
  addToStage(dim);
  makeTappable(dim, onTapOutside ?? (() => {}));
}

function drawPileOverlay(g: GameState, pile: PileName): void {
  const c = g.combat;
  if (!c) return;
  const close = (): void => {
    pileOverlay = null;
    renderAll();
  };
  overlayDim(close);

  const iids = c.player.piles[pile];
  interface Row {
    name: string;
    cost: string;
    type: string;
  }
  let rows: Row[] = [];
  for (const iid of iids) {
    const card = c.cards[iid];
    if (!card) continue;
    const def = bundle.cards.get(card.defId);
    rows.push({
      name: (def?.name ?? card.defId) + (card.upgrades > 0 ? "+" : ""),
      cost: instCostLabel(card),
      type: def?.type ?? "?",
    });
  }
  // draw-pile order is hidden information — present it sorted
  if (pile === "draw") rows = rows.sort((a, b) => a.name.localeCompare(b.name));

  const w = 980;
  const h = 620;
  const panel = canvasPanel(w, h, (gc) => {
    panelBg(gc, w, h, "#161c2b", "#54689a", 4, 16);
    gc.textAlign = "left";
    gc.textBaseline = "top";
    gc.fillStyle = "#f0e8d2";
    gc.font = "bold 30px -apple-system, system-ui, sans-serif";
    const note = pile === "draw" ? "  (order hidden — sorted)" : "";
    gc.fillText(`${titleCase(pile)} pile — ${rows.length} card${rows.length === 1 ? "" : "s"}${note}`, 24, 20);

    gc.font = "22px -apple-system, system-ui, sans-serif";
    const perCol = 13;
    rows.forEach((row, i) => {
      const col = Math.floor(i / perCol);
      const rowIdx = i % perCol;
      const x = 24 + col * 320;
      const y = 76 + rowIdx * 38;
      if (x > w - 200) return; // more than 3 columns can't fit; counts stay accurate
      gc.fillStyle = TYPE_COLORS[row.type] ?? "#9aa3b8";
      gc.fillText(`(${row.cost})`, x, y, 50);
      gc.fillStyle = "#dfe3ec";
      gc.fillText(row.name, x + 56, y, 250);
    });
    if (rows.length === 0) {
      gc.fillStyle = "#6f7a92";
      gc.fillText("(empty)", 24, 80);
    }
  });
  panel.position.set(STAGE_W / 2, 490, 31);
  addToStage(panel);
  makeTappable(panel, () => {
    /* swallow taps on the sheet itself */
  });

  button({
    label: "CLOSE",
    x: STAGE_W / 2,
    y: 130,
    w: 240,
    h: 72,
    z: 32,
    onTap: close,
  });
}

function drawDeckOverlay(g: GameState, ov: { mode: DeckOverlayMode; page: number }): void {
  overlayDim();
  const deck = g.run.deck;
  const perPage = 18;
  const pages = Math.max(1, Math.ceil(deck.length / perPage));
  const page = Math.min(ov.page, pages - 1);
  ov.page = page;

  const shopRoom = g.run.room?.kind === "shop" ? g.run.room : null;
  const titleText =
    ov.mode === "view"
      ? `Deck — ${deck.length} card${deck.length === 1 ? "" : "s"}`
      : ov.mode === "smith"
        ? "SMITH — choose a card to upgrade"
        : `REMOVE — choose a card (${shopRoom?.shop.removalCost ?? "?"} G)`;
  const title = textPanel({
    w: 900,
    h: 58,
    text: titleText,
    fontPx: 27,
    bold: true,
    bg: "#1c2333",
    border: "#54689a",
    fg: "#f0e8d2",
  });
  title.position.set(STAGE_W / 2, 848, 31);
  addToStage(title);

  const cw = 176;
  const ch = 212;
  const cols = 6;
  const gapX = 12;
  const gridW = cols * cw + (cols - 1) * gapX;
  const rowYs = [688, 462, 236];
  deck.slice(page * perPage, page * perPage + perPage).forEach((mc, k) => {
    const deckIdx = page * perPage + k;
    const col = k % cols;
    const rowI = Math.floor(k / cols);
    const x = STAGE_W / 2 - gridW / 2 + cw / 2 + col * (cw + gapX);
    const y = rowYs[rowI] ?? 236;
    const smithOk = ov.mode !== "smith" || canSmithMaster(bundle, mc);
    const mesh = masterPanel({ w: cw, h: ch, mc, disabled: !smithOk });
    mesh.position.set(x, y, 32);
    addToStage(mesh);
    if (ov.mode === "smith" && smithOk) {
      makeTappable(mesh, () => {
        deckOverlay = null;
        doAdvance({ cmd: "restOption", kind: "smith", deckIdx });
      });
    } else if (ov.mode === "remove") {
      makeTappable(mesh, () => {
        deckOverlay = null;
        doAdvance({ cmd: "shopRemove", deckIdx });
      });
    } else {
      makeTappable(mesh, () => {
        /* view mode: swallow so the tap doesn't fall through */
      });
    }
  });
  if (deck.length === 0) {
    const empty = textPanel({ w: 400, h: 80, text: "(empty deck)", fontPx: 24, fg: "#6f7a92" });
    empty.position.set(STAGE_W / 2, 480, 32);
    addToStage(empty);
  }

  if (pages > 1) {
    button({
      label: "◀",
      x: 150,
      y: 56,
      w: 90,
      h: 62,
      z: 32,
      disabled: page === 0,
      onTap: () => {
        ov.page = page - 1;
        renderAll();
      },
    });
    const lbl = textPanel({
      w: 150,
      h: 62,
      text: `${page + 1} / ${pages}`,
      fontPx: 22,
      bg: "#141926",
      border: "#2c3650",
      fg: "#9aa3b8",
    });
    lbl.position.set(285, 56, 32);
    addToStage(lbl);
    button({
      label: "▶",
      x: 420,
      y: 56,
      w: 90,
      h: 62,
      z: 32,
      disabled: page >= pages - 1,
      onTap: () => {
        ov.page = page + 1;
        renderAll();
      },
    });
  }

  button({
    label: ov.mode === "view" ? "CLOSE" : "CANCEL",
    x: 1440,
    y: 56,
    w: 240,
    h: 62,
    z: 32,
    onTap: () => {
      deckOverlay = null;
      renderAll();
    },
  });
}

function drawRelicsOverlay(g: GameState): void {
  const close = (): void => {
    relicsOverlay = false;
    renderAll();
  };
  overlayDim(close);

  const relics = g.run.relics;
  const w = 920;
  const h = 620;
  const panel = canvasPanel(w, h, (gc) => {
    panelBg(gc, w, h, "#161c2b", "#8a6f3e", 4, 16);
    gc.textAlign = "left";
    gc.textBaseline = "top";
    gc.fillStyle = "#ffd9a0";
    gc.font = "bold 30px -apple-system, system-ui, sans-serif";
    gc.fillText(`Relics — ${relics.length}`, 24, 20);
    gc.font = "23px -apple-system, system-ui, sans-serif";
    const perCol = 12;
    relics.forEach((r, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const x = 24 + col * 440;
      const y = 78 + row * 42;
      if (x > w - 200) return;
      gc.fillStyle = "#dfe3ec";
      const counter = r.counter > 0 ? `  (${r.counter})` : "";
      gc.fillText(relicName(bundle, r.defId) + counter, x, y, 420);
    });
    if (relics.length === 0) {
      gc.fillStyle = "#6f7a92";
      gc.fillText("(none)", 24, 80);
    }
  });
  panel.position.set(STAGE_W / 2, 490, 31);
  addToStage(panel);
  makeTappable(panel, () => {});

  button({ label: "CLOSE", x: STAGE_W / 2, y: 130, w: 240, h: 72, z: 32, onTap: close });
}

function drawPotionMenu(g: GameState, slot: number): void {
  const id = g.run.potions[slot];
  if (!id) {
    potionMenu = null;
    return;
  }
  const def = bundle.potions.get(id);
  const close = (): void => {
    potionMenu = null;
    renderAll();
  };
  overlayDim(close);

  const info = iconLabelPanel({
    w: 560,
    h: 130,
    text: `${potionName(bundle, id)}${def?.targeted ? "\n(throws at a target in combat)" : ""}`,
    fontPx: 28,
    bold: true,
    bg: "#20283c",
    border: "#5f78b0",
    fg: "#cfe0ff",
    icon: "gi:standing-potion",
    iconSize: 40,
    iconColor: "#8fb8f0",
  });
  info.position.set(STAGE_W / 2, 560, 31);
  addToStage(info);
  makeTappable(info, () => {});

  button({
    label: "USE",
    x: STAGE_W / 2 - 130,
    y: 420,
    w: 230,
    h: 84,
    z: 32,
    fontPx: 26,
    bg: "#1f3326",
    border: "#4f9a63",
    fg: "#c9edd2",
    onTap: () => {
      potionMenu = null;
      if (def?.targeted) {
        if (!g.combat) {
          toast("That potion needs a target — use it in combat");
          renderAll();
          return;
        }
        potionTargeting = slot;
        renderAll();
      } else {
        doAdvance({ cmd: "usePotion", slot });
      }
    },
  });
  button({
    label: "DISCARD",
    x: STAGE_W / 2 + 130,
    y: 420,
    w: 230,
    h: 84,
    z: 32,
    fontPx: 26,
    bg: "#301f26",
    border: "#8a4a5a",
    onTap: () => {
      potionMenu = null;
      doAdvance({ cmd: "discardPotion", slot });
    },
  });
  button({
    label: "CANCEL",
    x: STAGE_W / 2,
    y: 310,
    w: 230,
    h: 72,
    z: 32,
    fontPx: 24,
    onTap: close,
  });
}

function drawChoiceOverlay(g: GameState, pending: PendingChoice): void {
  overlayDim();

  const req = pending.request;
  const isCards = req.kind === "cards" || req.kind === "scry";
  const min = req.kind === "cards" ? req.min : req.kind === "option" ? 1 : 0;
  const max = req.kind === "cards" ? req.max : req.kind === "option" ? 1 : req.iids.length;
  const reason =
    req.kind === "cards"
      ? describeChoiceReason(req.reason)
      : req.kind === "option"
        ? req.reason
        : "Scry — select cards to discard";
  const canCancel = req.kind === "cards" && req.canCancel;

  const constraint =
    req.kind === "scry" ? "any number" : min === max ? `exactly ${min}` : `${min}–${max}`;
  const title = textPanel({
    w: 1100,
    h: 64,
    text: `${reason}   (choose ${constraint})`,
    fontPx: 26,
    bg: "#1c2333",
    border: "#54689a",
    fg: "#f0e8d2",
    bold: true,
  });
  title.position.set(STAGE_W / 2, 800, 31);
  addToStage(title);

  const toggle = (i: number): void => {
    const at = choiceSel.indexOf(i);
    if (at >= 0) {
      choiceSel.splice(at, 1);
    } else if (choiceSel.length < max) {
      choiceSel.push(i);
    } else if (max === 1) {
      choiceSel = [i];
    } else {
      toast(`Select at most ${max}`);
      return;
    }
    renderAll();
  };

  if (isCards) {
    // "custom" pile choices outside combat reference DECK indices (Neow flows);
    // everything else references combat card instance ids.
    const deckMode = !g.combat;
    const iids = req.iids;
    const n = iids.length;
    const cols = Math.min(Math.max(n, 1), 6);
    const scale = n > 12 ? 0.8 : 1;
    const cw = 180 * scale;
    const ch = 250 * scale;
    const gapX = 14;
    const gapY = 16;
    const rowsCount = Math.ceil(n / cols);
    const gridW = cols * cw + (cols - 1) * gapX;
    const centerY = 480;
    iids.forEach((iid, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = STAGE_W / 2 - gridW / 2 + cw / 2 + col * (cw + gapX);
      const y = centerY + ((rowsCount - 1) / 2 - row) * (ch + gapY);
      let mesh: Mesh;
      if (deckMode) {
        const mc = g.run.deck[iid];
        mesh = mc
          ? masterPanel({ w: cw, h: ch, mc, selected: choiceSel.includes(i) })
          : textPanel({ w: cw, h: ch, text: `deck #${iid}`, fontPx: 20 });
      } else {
        const card = g.combat?.cards[iid];
        const def = card ? bundle.cards.get(card.defId) : undefined;
        mesh =
          card && def
            ? cardFacePanel({
                w: cw,
                h: ch,
                def,
                upgrades: card.upgrades,
                costLabel: instCostLabel(card),
                selected: choiceSel.includes(i),
              })
            : textPanel({ w: cw, h: ch, text: `card #${iid}`, fontPx: 20 });
      }
      mesh.position.set(x, y, 32);
      addToStage(mesh);
      makeTappable(mesh, () => toggle(i));
    });
  } else {
    // option list
    req.options.forEach((opt, i) => {
      button({
        label: opt,
        x: STAGE_W / 2,
        y: 640 - i * 90,
        w: 760,
        h: 76,
        z: 32,
        fontPx: 24,
        border: choiceSel.includes(i) ? "#ffd75e" : "#54689a",
        bg: choiceSel.includes(i) ? "#3a331f" : "#243049",
        onTap: () => toggle(i),
      });
    });
  }

  const okDisabled = choiceSel.length < min || choiceSel.length > max;
  button({
    label: `CONFIRM (${choiceSel.length})`,
    x: canCancel ? STAGE_W / 2 - 160 : STAGE_W / 2,
    y: 110,
    w: 280,
    h: 76,
    z: 33,
    fontPx: 26,
    bg: "#1f3326",
    border: "#4f9a63",
    fg: "#c9edd2",
    disabled: okDisabled,
    onTap: () => doAdvance({ cmd: "choose", indices: [...choiceSel] }),
  });
  if (canCancel) {
    button({
      label: "CANCEL",
      x: STAGE_W / 2 + 160,
      y: 110,
      w: 240,
      h: 76,
      z: 33,
      fontPx: 26,
      bg: "#301f26",
      border: "#8a4a5a",
      onTap: () => doAdvance({ cmd: "choose", indices: [] }),
    });
  }
}

// --- top-level render ---------------------------------------------------------------------------
function renderAll(): void {
  clearStage();

  if (screen === "menu" || game === null) {
    drawMenu();
    return;
  }
  const g = game;
  const room = g.run.room;
  if (!room) {
    // single-combat saves (old demo) have no run layer — not supported here
    drawMenu();
    return;
  }

  drawHeader(g);

  switch (room.kind) {
    case "neow":
      drawNeow(g, room);
      break;
    case "map":
      drawMapScreen(g);
      break;
    case "combat":
      drawCombat(g);
      break;
    case "rewards":
      drawRewards(g, room);
      break;
    case "shop":
      drawShop(g, room);
      break;
    case "rest":
      drawRest(g, room);
      break;
    case "treasure":
      drawTreasure(g, room);
      break;
    case "event":
      drawEvent(g, room);
      break;
    case "gameOver":
      drawGameOver(g, room);
      break;
  }

  // overlay precedence: pending choice > deck > relics > potion menu > piles
  if (g.pending) {
    drawChoiceOverlay(g, g.pending);
  } else if (deckOverlay !== null) {
    drawDeckOverlay(g, deckOverlay);
  } else if (relicsOverlay) {
    drawRelicsOverlay(g);
  } else if (potionMenu !== null) {
    drawPotionMenu(g, potionMenu);
  } else if (pileOverlay !== null) {
    drawPileOverlay(g, pileOverlay);
  }

  if (targeting !== null || potionTargeting !== null) {
    onBackgroundTap(() => {
      targeting = null;
      potionTargeting = null;
      renderAll();
    });
  }
}

// --- boot ------------------------------------------------------------------------------------------
function boot(): void {
  loadMenuPrefs();
  const urlSeed = seedFromSearch(window.location.search);
  if (urlSeed !== null) seedInput = urlSeed;
  screen = "menu";
  renderAll();
}

// surface any unexpected runtime error instead of dying silently
window.addEventListener("error", (ev) => {
  console.error(ev.error ?? ev.message);
  try {
    toast(`Error: ${ev.message}`);
  } catch {
    /* stage may not be ready */
  }
});

boot();
