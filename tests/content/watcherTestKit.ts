// Local test kit for the Watcher card tests: merges the watcher slice (cards,
// powers, effects) into the REAL base bundle (buildBaseContentBundle — needed
// for the live stance defs, the colorless tokens the purple cards create, and
// relics like Damaru/Violet Lotus), plus deterministic test monsters.
// cardsTestKit.ts itself is not modified; its bundle-independent helpers are
// re-exported from here for convenience.

import type { ContentBundle, MonsterDef } from "../../src/engine/content/defs";
import type { GameState } from "../../src/engine/game";
import { createCombatGame, advance } from "../../src/engine/game";
import { calcMonsterDamage } from "../../src/engine/combat/damageCalc";
import { PLAYER, monster } from "../../src/engine/core/ids";
import { buildBaseContentBundle } from "../../src/content/index";
import { watcherCards, watcherPowers, watcherEffects } from "../../src/content/cards/watcher";

export { handNames, pileNames, choiceIndexOf, monsterHp, playerPower, monsterPower } from "./cardsTestKit";
import { handNames } from "./cardsTestKit";

/** 200 HP punching bag that always attacks for 10 (intent: attack). */
const tank: MonsterDef = {
  id: "T_WTANK",
  name: "Watcher Test Tank",
  category: "normal",
  hp: () => [200, 200],
  moves: {
    ATTACK: {
      id: "ATTACK",
      intent: "attack",
      execute: (ctx, self) => {
        const dmg = calcMonsterDamage(ctx, self.idx, 10);
        ctx.queue.addToBottom({
          kind: "damage",
          target: PLAYER,
          info: { type: "attack", source: monster(self.idx), amount: dmg },
        });
      },
    },
  },
  getMove: () => "ATTACK",
};

/** 200 HP wall that always defends (intent: defend) — never attacks. */
const guard: MonsterDef = {
  id: "T_WGUARD",
  name: "Watcher Test Guard",
  category: "normal",
  hp: () => [200, 200],
  moves: {
    GUARD: {
      id: "GUARD",
      intent: "defend",
      execute: (ctx, self) => {
        ctx.queue.addToBottom({ kind: "gainBlock", target: monster(self.idx), amount: 5, fromCard: false });
      },
    },
  },
  getMove: () => "GUARD",
};

/** 8 HP target for fatal checks; never attacks. */
const frail: MonsterDef = { ...guard, id: "T_WFRAIL", name: "Watcher Test Frail", hp: () => [8, 8] };

/** 35 HP target for the Judgment threshold (30 < 35 <= 40); never attacks. */
const mid: MonsterDef = { ...guard, id: "T_WMID", name: "Watcher Test Mid", hp: () => [35, 35] };

export function watcherBundle(): ContentBundle {
  const b = buildBaseContentBundle();
  for (const p of watcherPowers) b.powers.set(p.id, p);
  for (const c of watcherCards) b.cards.set(c.id, c);
  for (const [k, v] of watcherEffects) b.effects.set(k, v);
  for (const m of [tank, guard, frail, mid]) b.monsters.set(m.id, m);
  return b;
}

export const bundle = watcherBundle();

export interface DeckEntry {
  defId: string;
  upgrades?: number;
}

export function fight(opts: {
  deck: (string | DeckEntry)[];
  seed?: string;
  monsters?: string[];
  hp?: number;
  relics?: string[];
}): GameState {
  return createCombatGame({
    seed: opts.seed ?? "WKIT",
    bundle,
    character: "WATCHER",
    deck: opts.deck.map((d) => (typeof d === "string" ? { defId: d } : { defId: d.defId, upgrades: d.upgrades })),
    monsters: opts.monsters ?? ["T_WTANK"],
    hp: opts.hp,
    relics: opts.relics,
  });
}

export function play(s: GameState, defId: string, target = 0): GameState {
  const idx = handNames(s).indexOf(defId);
  if (idx === -1) throw new Error(`${defId} not in hand: ${handNames(s)}`);
  return advance(s, { cmd: "playCard", handIdx: idx, target }, bundle);
}

export const endTurn = (s: GameState): GameState => advance(s, { cmd: "endTurn" }, bundle);

/** Resolve any pending choice. For scry, indices = positions (into the offered
 *  iids) of the cards to DISCARD; [] keeps everything on top. */
export const choose = (s: GameState, indices: number[]): GameState =>
  advance(s, { cmd: "choose", indices }, bundle);

export const stance = (s: GameState): string => s.combat!.player.stance;
export const energy = (s: GameState): number => s.combat!.player.energy;
export const mantra = (s: GameState): number => s.combat!.player.mantra;
export const block = (s: GameState): number => s.combat!.player.block;

/** First instance of defId in the given pile. */
export function instOf(s: GameState, defId: string, pile: "draw" | "hand" | "discard" | "exhaust") {
  const iid = s.combat!.player.piles[pile].find((i) => s.combat!.cards[i]!.defId === defId);
  if (iid === undefined) throw new Error(`${defId} not in ${pile}`);
  return s.combat!.cards[iid]!;
}

export const strikes = (n: number): string[] => Array(n).fill("STRIKE_PURPLE") as string[];
export const defends = (n: number): string[] => Array(n).fill("DEFEND_PURPLE") as string[];

/** First fight (over a fixed seed list) whose opening hand holds all wanted cards. */
export function fightWithInHand(want: string[], opts: Parameters<typeof fight>[0]): GameState {
  for (const seed of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"]) {
    const s = fight({ ...opts, seed });
    const names = handNames(s);
    if (want.every((w) => names.includes(w))) return s;
  }
  throw new Error(`no seed put ${want.join(",")} in the opening hand`);
}
