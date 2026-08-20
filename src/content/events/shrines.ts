// Shrine pool (6 events) — data/corpus/events.json is the spec.

import type { EventDef, EffectCtx } from "../../engine/content/defs";
import type { CardId } from "../../engine/core/ids";
import { classCardPool } from "../../engine/run/rewards";
import { JavaRandom, javaShuffle } from "../../engine/core/rng";
import {
  a15,
  colorlessViaShuffle,
  dataOf,
  endEvent,
  fractionMaxHp,
  gainGold,
  healToFull,
  leaveOption,
  loseHp,
  obtainCard,
  obtainRelic,
  openRewards,
  option,
  peekData,
  randomCurse,
  removableIndices,
  removeDeckCards,
  requestDeckChoice,
  screenlessRandomRelic,
  simpleEvent,
  transformDeckCard,
  upgradeableIndices,
  upgradeDeckCard,
} from "./lib";

// --- Match and Keep --------------------------------------------------------------------

const STARTER_BY_CLASS: Record<string, CardId> = {
  IRONCLAD: "BASH",
  SILENT: "NEUTRALIZE",
  DEFECT: "ZAP",
  WATCHER: "ERUPTION",
};

interface MatchKeepData {
  cards: (CardId | null)[]; // the 6 pool slots
  board: number[]; // 12 grid slots -> pool slot index
  matched: boolean[]; // per grid slot
  attempts: number;
  first: number | null; // grid slot flipped first this attempt
}

const mkData = (d: unknown): MatchKeepData => d as MatchKeepData;

const matchAndKeep: EventDef = {
  id: "MATCH_AND_KEEP",
  name: "Match and Keep",
  pool: "shrine",
  onEnter: (ctx) => {
    const cardRng = ctx.rng("cardRng");
    const pick = (rarity: "common" | "uncommon" | "rare"): CardId | null => {
      const pool = classCardPool(ctx, rarity);
      return pool.length > 0 ? pool[cardRng.random(pool.length - 1)]! : null;
    };
    // pool slots: rare / uncommon / common class card (cardRng), uncommon
    // colorless (shuffleRng; a second random curse at A15+), random curse
    // (cardRng), class starter.
    const cards: (CardId | null)[] = [];
    cards.push(pick("rare"));
    cards.push(pick("uncommon"));
    cards.push(pick("common"));
    cards.push(a15(ctx) ? randomCurse(ctx) : colorlessViaShuffle(ctx, "uncommon"));
    cards.push(randomCurse(ctx));
    cards.push(STARTER_BY_CLASS[ctx.run.character] ?? null);
    // layout: [0..5,0..5] java-shuffled (miscRng-seeded); shuffle position i
    // lands on grid slot (i%3)*4 + (i%4)
    const indices = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5];
    javaShuffle(indices, new JavaRandom(ctx.rng("miscRng").randomLong()));
    const board = new Array<number>(12).fill(0);
    for (let i = 0; i < 12; i++) board[(i % 3) * 4 + (i % 4)] = indices[i]!;
    Object.assign(dataOf(ctx), { cards, board, matched: new Array(12).fill(false), attempts: 0, first: null } satisfies MatchKeepData);
  },
  build: (ctx) => {
    const d = mkData(peekData(ctx));
    const name = (slot: number): string => {
      const id = d.cards?.[d.board?.[slot] ?? 0] ?? null;
      return id ? (ctx.bundle.cards.get(id)?.name ?? id) : "(empty)";
    };
    const options = [];
    for (let slot = 0; slot < 12; slot++) {
      const revealed = d.matched?.[slot] || d.first === slot;
      options.push(
        option(
          revealed ? `Card ${slot + 1}: ${name(slot)}` : `Flip card ${slot + 1}`,
          (c) => {
            const dd = mkData(dataOf(c));
            if (dd.first === null) {
              dd.first = slot;
              return;
            }
            const a = dd.first;
            dd.first = null;
            dd.attempts++;
            const idA = dd.cards[dd.board[a]!]!;
            const idB = dd.cards[dd.board[slot]!]!;
            c.emit("eventReveal", { slots: [a, slot], cards: [idA, idB] });
            if (dd.board[a] === dd.board[slot]) {
              dd.matched[a] = true;
              dd.matched[slot] = true;
              if (idA) obtainCard(c, idA);
            }
            if (dd.attempts >= 5 || dd.matched.every((m) => m)) endEvent(c);
          },
          (c) => {
            const dd = mkData(peekData(c));
            return !dd.matched?.[slot] && dd.first !== slot && (dd.attempts ?? 5) < 5;
          },
        ),
      );
    }
    return {
      summary: "A 12-card memory game: five flip attempts, matched pairs join your deck (curses included).",
      options,
    };
  },
};

// --- Golden Shrine -----------------------------------------------------------------------

const goldenShrine: EventDef = simpleEvent({
  id: "GOLDEN_SHRINE",
  name: "Golden Shrine",
  pool: "shrine",
  summary: "A gilded shrine gives modest gold when honored or a fortune plus a curse when defiled.",
  options: () => [
    option("Pray: gain 100 gold (50 at A15+)", (ctx) => {
      gainGold(ctx, a15(ctx) ? 50 : 100);
      endEvent(ctx);
    }),
    option("Desecrate: gain 275 gold, obtain the Regret curse", (ctx) => {
      gainGold(ctx, 275);
      obtainCard(ctx, "REGRET");
      endEvent(ctx);
    }),
    leaveOption(),
  ],
});

// --- Transmogrifier ------------------------------------------------------------------------

const transmogrifier: EventDef = simpleEvent({
  id: "TRANSMORGRIFIER",
  name: "Transmogrifier",
  pool: "shrine",
  summary: "A shrine that transforms one card.",
  options: () => [
    option(
      "Pray: transform a card",
      (ctx) => requestDeckChoice(ctx, { tag: "transform", indices: removableIndices(ctx), min: 1, max: 1, reason: "event:transmogrifier" }),
      (ctx) => removableIndices(ctx).length > 0,
    ),
    leaveOption(),
  ],
  onResume: (ctx, _tag, chosen) => {
    if (chosen[0] !== undefined) transformDeckCard(ctx, chosen[0]);
    endEvent(ctx);
  },
});

// --- Purifier ---------------------------------------------------------------------------------

const purifier: EventDef = simpleEvent({
  id: "PURIFIER",
  name: "Purifier",
  pool: "shrine",
  summary: "A shrine that removes one card.",
  options: () => [
    option(
      "Pray: remove a card",
      (ctx) => requestDeckChoice(ctx, { tag: "remove", indices: removableIndices(ctx), min: 1, max: 1, reason: "event:purifier" }),
      (ctx) => removableIndices(ctx).length > 0,
    ),
    leaveOption(),
  ],
  onResume: (ctx, _tag, chosen) => {
    removeDeckCards(ctx, chosen);
    endEvent(ctx);
  },
});

// --- Upgrade Shrine ------------------------------------------------------------------------------

const upgradeShrine: EventDef = simpleEvent({
  id: "UPGRADE_SHRINE",
  name: "Upgrade Shrine",
  pool: "shrine",
  summary: "A shrine that upgrades one card.",
  options: () => [
    option(
      "Pray: upgrade a card",
      (ctx) => requestDeckChoice(ctx, { tag: "upgrade", indices: upgradeableIndices(ctx), min: 1, max: 1, reason: "event:upgradeShrine" }),
      (ctx) => upgradeableIndices(ctx).length > 0,
    ),
    leaveOption(),
  ],
  onResume: (ctx, _tag, chosen) => {
    if (chosen[0] !== undefined) upgradeDeckCard(ctx, chosen[0]);
    endEvent(ctx);
  },
});

// --- Wheel of Change --------------------------------------------------------------------------------

const wheelOfChange: EventDef = simpleEvent({
  id: "WHEEL_OF_CHANGE",
  name: "Wheel of Change",
  pool: "shrine",
  summary: "A gremlin forces one spin of a six-outcome prize wheel; results range from riches to injury.",
  options: () => [
    option("Spin: uniform roll over gold / relic / full heal / Decay curse / card removal / HP loss", (ctx) => {
      const r = ctx.rng("miscRng").random(5);
      switch (r) {
        case 0:
          gainGold(ctx, ctx.run.act * 100);
          endEvent(ctx);
          break;
        case 1:
          openRewards(ctx, [{ kind: "relic", id: screenlessRandomRelic(ctx), taken: false }]);
          break;
        case 2:
          healToFull(ctx);
          endEvent(ctx);
          break;
        case 3:
          obtainCard(ctx, "DECAY");
          endEvent(ctx);
          break;
        case 4: {
          const indices = removableIndices(ctx);
          if (indices.length === 0) endEvent(ctx);
          else requestDeckChoice(ctx, { tag: "remove", indices, min: 1, max: 1, reason: "event:wheel" });
          break;
        }
        default:
          loseHp(ctx, fractionMaxHp(ctx, a15(ctx) ? 0.15 : 0.1, "floor"));
          if (ctx.run.hp > 0) endEvent(ctx);
          break;
      }
    }),
  ],
  onResume: (ctx, _tag, chosen) => {
    removeDeckCards(ctx, chosen);
    endEvent(ctx);
  },
});

export const shrineEvents: EventDef[] = [matchAndKeep, goldenShrine, transmogrifier, purifier, upgradeShrine, wheelOfChange];
