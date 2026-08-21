// Local test kit for the Defect card/orb tests: merges the defect slice (cards,
// powers, effects, orbs) plus the shared core/support powers into a copy of the
// stub test bundle, adds deterministic test monsters and the DEFECT character
// (75 HP, 3 energy, 3 orb slots). testBundle.ts and cardsTestKit.ts themselves
// are not modified.

import type { ContentBundle, MonsterDef, EffectCtx } from "../../src/engine/content/defs";
import type { GameState } from "../../src/engine/game";
import { createCombatGame, advance } from "../../src/engine/game";
import { calcMonsterDamage } from "../../src/engine/combat/damageCalc";
import { PLAYER, monster } from "../../src/engine/core/ids";
import { makeTestBundle } from "../helpers/testBundle";
import { corePowers } from "../../src/content/powers/core";
import { relicSupportPowers } from "../../src/content/relics/supportPowers";
import { starterRelics } from "../../src/content/relics/starter";
import { statusCards } from "../../src/content/cards/statuses";
import { curseCards } from "../../src/content/cards/curses";
import { defectCards, defectPowers, defectEffects, allOrbs } from "../../src/content/cards/defect";

/** 200 HP punching bag that always attacks for 10. */
const tank: MonsterDef = {
  id: "T_TANK",
  name: "Test Tank",
  category: "normal",
  hp: () => [200, 200],
  moves: {
    ATTACK: {
      id: "ATTACK",
      intent: "attack",
      execute: (ctx: EffectCtx, self) => {
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

/** 200 HP wall that always defends (never attacks) - for intent checks. */
const guard: MonsterDef = {
  id: "T_GUARD",
  name: "Test Guard",
  category: "normal",
  hp: () => [200, 200],
  moves: {
    GUARD: {
      id: "GUARD",
      intent: "defend",
      execute: (ctx: EffectCtx, self) => {
        ctx.queue.addToBottom({ kind: "gainBlock", target: monster(self.idx), amount: 5, fromCard: false });
      },
    },
  },
  getMove: () => "GUARD",
};

/** 8 HP target for fatal-damage checks; never attacks. */
const frail: MonsterDef = {
  ...guard,
  id: "T_FRAIL",
  name: "Test Frail",
  hp: () => [8, 8],
};

export function defectBundle(): ContentBundle {
  const b = makeTestBundle();
  for (const p of corePowers) b.powers.set(p.id, p);
  for (const p of relicSupportPowers) b.powers.set(p.id, p); // FOCUS, BUFFER, and so on
  for (const p of defectPowers) b.powers.set(p.id, p);
  for (const c of [...defectCards, ...statusCards, ...curseCards]) b.cards.set(c.id, c);
  for (const [k, v] of defectEffects) b.effects.set(k, v);
  for (const o of allOrbs) b.orbs.set(o.id, o);
  for (const r of starterRelics) b.relics.set(r.id, r); // CRACKED_CORE
  for (const m of [tank, guard, frail]) b.monsters.set(m.id, m);
  b.characters.set("DEFECT", {
    id: "DEFECT",
    name: "Test Defect",
    maxHp: 75,
    startingEnergy: 3,
    startingDeck: [],
    startingRelic: "CRACKED_CORE",
    orbSlots: 3,
    a14HpLoss: 4,
  });
  return b;
}

export const bundle = defectBundle();

export interface DeckEntry {
  defId: string;
  upgrades?: number;
}

export function fight(opts: {
  deck: (string | DeckEntry)[];
  seed?: string;
  monsters?: string[];
  relics?: string[];
  hp?: number;
}): GameState {
  return createCombatGame({
    seed: opts.seed ?? "DEFECTKIT",
    bundle,
    character: "DEFECT",
    deck: opts.deck.map((d) => (typeof d === "string" ? { defId: d } : { defId: d.defId, upgrades: d.upgrades })),
    monsters: opts.monsters ?? ["T_TANK"],
    relics: opts.relics,
    hp: opts.hp,
  });
}

export const handNames = (s: GameState): string[] =>
  s.combat!.player.piles.hand.map((i) => s.combat!.cards[i]!.defId);

export const pileNames = (s: GameState, pile: "draw" | "hand" | "discard" | "exhaust"): string[] =>
  s.combat!.player.piles[pile].map((i) => s.combat!.cards[i]!.defId);

export function play(s: GameState, defId: string, target = 0): GameState {
  const idx = handNames(s).indexOf(defId);
  if (idx === -1) throw new Error(`${defId} not in hand: ${handNames(s)}`);
  return advance(s, { cmd: "playCard", handIdx: idx, target }, bundle);
}

export const endTurn = (s: GameState): GameState => advance(s, { cmd: "endTurn" }, bundle);

export const choose = (s: GameState, indices: number[]): GameState =>
  advance(s, { cmd: "choose", indices }, bundle);

/** Pick the pending-choice index of the first offered card with this defId. */
export function choiceIndexOf(s: GameState, defId: string): number {
  const req = s.pending?.request;
  if (!req || req.kind !== "cards") throw new Error("no pending card choice");
  const idx = req.iids.findIndex((iid) => s.combat!.cards[iid]?.defId === defId);
  if (idx === -1) throw new Error(`${defId} not among choices`);
  return idx;
}

export const monsterHp = (s: GameState, i = 0): number => s.combat!.monsters[i]!.hp;

export const playerPower = (s: GameState, id: string): number | undefined =>
  s.combat!.player.powers.find((p) => p.id === id)?.amount;

export const monsterPower = (s: GameState, id: string, i = 0): number | undefined =>
  s.combat!.monsters[i]!.powers.find((p) => p.id === id)?.amount;

export const energy = (s: GameState): number => s.combat!.player.energy;
export const block = (s: GameState): number => s.combat!.player.block;
export const orbIds = (s: GameState): string[] => s.combat!.player.orbs.map((o) => o.id);
export const orbAmounts = (s: GameState): number[] => s.combat!.player.orbs.map((o) => o.amount);
export const orbSlots = (s: GameState): number => s.combat!.player.orbSlots;

/** First fight (over a fixed seed list) whose opening hand holds all wanted cards. */
export function fightWithInHand(want: string[], opts: Parameters<typeof fight>[0]): GameState {
  for (const seed of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"]) {
    const s = fight({ ...opts, seed });
    const names = handNames(s);
    if (want.every((w) => names.includes(w))) return s;
  }
  throw new Error(`no seed put ${want.join(",")} in the opening hand`);
}
