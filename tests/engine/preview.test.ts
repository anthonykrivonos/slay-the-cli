// Card previews: the numbers the hand prints on itself. Real Ironclad cards
// over the stub bundle, because the whole point is the live calc pipeline
// (Strength, Frail, Vulnerable-on-the-target, stance).

import { test, expect, describe } from "bun:test";
import { createCombatGame, type GameState } from "../../src/engine/game";
import type { ContentBundle } from "../../src/engine/content/defs";
import { getCardPreviews, previewCardAt } from "../../src/engine/combat/preview";
import { makeTestBundle } from "../helpers/testBundle";
import { corePowers } from "../../src/content/powers/core";
import { ironcladBasics } from "../../src/content/cards/ironclad/basics";
import { ironcladCards, ironcladPowers, ironcladEffects } from "../../src/content/cards/ironclad/index";

function makeBundle(): ContentBundle {
  const b = makeTestBundle();
  for (const p of corePowers) b.powers.set(p.id, p);
  for (const p of ironcladPowers) b.powers.set(p.id, p);
  for (const c of [...ironcladBasics, ...ironcladCards]) b.cards.set(c.id, c);
  for (const [k, v] of ironcladEffects) b.effects.set(k, v);
  return b;
}

const B = makeBundle();

function game(deck: string[], monsters = ["T_DUMMY"]): GameState {
  return createCombatGame({
    seed: "PREVIEW",
    bundle: B,
    character: "IRONCLAD",
    deck: deck.map((defId) => ({ defId })),
    monsters,
  });
}

/** Preview of the hand slot holding defId (the whole deck is dealt). */
function previewOf(s: GameState, defId: string, target = 0) {
  const idx = s.combat!.player.piles.hand.findIndex((iid) => s.combat!.cards[iid]!.defId === defId);
  if (idx === -1) throw new Error(`${defId} not in hand`);
  return getCardPreviews(s, B, target)[idx] ?? null;
}

const givePower = (s: GameState, id: string, amount: number): void => {
  s.combat!.player.powers.push({ id, amount, justApplied: false, data: null });
};

describe("card previews", () => {
  test("the printed numbers when nothing is modifying them", () => {
    const s = game(["STRIKE_RED", "DEFEND_RED", "BASH", "INFLAME", "CLEAVE"]);
    expect(previewOf(s, "STRIKE_RED")).toEqual({ damage: 6, hits: 1, block: 0, partial: false });
    expect(previewOf(s, "DEFEND_RED")).toEqual({ damage: null, hits: 0, block: 5, partial: false });
    expect(previewOf(s, "BASH")).toEqual({ damage: 8, hits: 1, block: 0, partial: false });
    expect(previewOf(s, "CLEAVE")).toEqual({ damage: 8, hits: 1, block: 0, partial: false });
    expect(previewOf(s, "INFLAME")).toBeNull(); // no damage, no block: nothing to show
  });

  test("Strength raises attacks, Frail cuts block", () => {
    const s = game(["STRIKE_RED", "DEFEND_RED", "BASH", "INFLAME", "CLEAVE"]);
    givePower(s, "STRENGTH", 3);
    givePower(s, "FRAIL", 2);
    expect(previewOf(s, "STRIKE_RED")?.damage).toBe(9);
    expect(previewOf(s, "BASH")?.damage).toBe(11);
    expect(previewOf(s, "DEFEND_RED")?.block).toBe(3); // floor(5 * 0.75)
  });

  test("Weak cuts your attacks, and the preview is per target", () => {
    const s = game(["STRIKE_RED", "DEFEND_RED", "BASH", "INFLAME", "CLEAVE"], ["T_DUMMY", "T_DUMMY"]);
    givePower(s, "WEAK", 2);
    expect(previewOf(s, "STRIKE_RED")?.damage).toBe(4); // floor(6 * 0.75)
    s.combat!.monsters[1]!.powers.push({ id: "VULNERABLE", amount: 2, justApplied: false, data: null });
    expect(previewOf(s, "STRIKE_RED", 0)?.damage).toBe(4);
    expect(previewOf(s, "STRIKE_RED", 1)?.damage).toBe(6); // floor(4 * 1.5)
  });

  test("multi-hit reports per-hit damage and the hit count", () => {
    const s = game(["TWIN_STRIKE", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"]);
    const pv = previewOf(s, "TWIN_STRIKE");
    expect(pv?.hits).toBe(2);
    expect(pv?.damage).toBe(5);
  });

  test("a card that needs the rng previews nothing rather than lying", () => {
    const s = game(["SWORD_BOOMERANG", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"]);
    const pv = previewOf(s, "SWORD_BOOMERANG");
    // the random-target roll throws in the dry run: partial, no numbers claimed
    expect(pv === null || pv.partial).toBe(true);
  });

  test("previewing never touches the live state", () => {
    const s = game(["STRIKE_RED", "DEFEND_RED", "BASH", "INFLAME", "CLEAVE"]);
    const before = JSON.stringify({ run: s.run, combat: s.combat });
    getCardPreviews(s, B, 0);
    previewCardAt(s, B, s.combat!.player.piles.hand[0]!, 0);
    expect(JSON.stringify({ run: s.run, combat: s.combat })).toBe(before);
  });

  test("no combat means no previews", () => {
    const s = game(["STRIKE_RED", "DEFEND_RED", "BASH", "INFLAME", "CLEAVE"]);
    expect(getCardPreviews({ run: s.run, combat: null }, B, 0)).toEqual([]);
    expect(previewCardAt({ run: s.run, combat: null }, B, 1, 0)).toBeNull();
  });
});
