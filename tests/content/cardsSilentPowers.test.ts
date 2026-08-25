// End-to-end tests for the Silent's signature powers: POISON (tick timing,
// decrement, removal, block bypass, kill credit, Lagavulin wake), ACCURACY
// (Shiv gating + the adopted multiplier ordering), and WELL_LAID_PLANS
// (end-of-turn retain flow).

import { test, expect, describe } from "bun:test";
import {
  fight,
  play,
  endTurn,
  choose,
  choiceIndexOf,
  handNames,
  monsterHp,
  monsterPower,
  playerPower,
  block,
} from "./cardsSilentKit";

const strikes = (n: number) => Array(n).fill("STRIKE_GREEN") as string[];

describe("POISON end-to-end", () => {
  test("ticks at the start of the monster's turn, then decrements; removed at 0", () => {
    let s = fight({ deck: ["DEADLY_POISON", ...strikes(4)], monsters: ["T_GUARD"] });
    s = play(s, "DEADLY_POISON");
    expect(monsterPower(s, "POISON")).toBe(5);
    expect(monsterHp(s)).toBe(200); // no tick on the application turn
    let expected = 200;
    for (let stacks = 5; stacks >= 1; stacks--) {
      s = endTurn(s);
      expected -= stacks;
      expect(monsterHp(s)).toBe(expected);
      expect(monsterPower(s, "POISON")).toBe(stacks - 1 > 0 ? stacks - 1 : undefined);
    }
    expect(monsterHp(s)).toBe(200 - 15); // 5+4+3+2+1
    s = endTurn(s);
    expect(monsterHp(s)).toBe(185); // fully expired
  });

  test("bypasses block (loseHp, not attack damage)", () => {
    let s = fight({ deck: ["DEADLY_POISON", ...strikes(4)], monsters: ["T_GUARD"] });
    s = play(s, "DEADLY_POISON");
    s = endTurn(s); // guard had 0 block on round 1; blocks 5 after acting
    s = endTurn(s); // now it holds block 5 while poison ticks 4
    expect(monsterHp(s)).toBe(200 - 5 - 4);
    expect(s.combat!.monsters[0]!.block).toBe(5); // untouched by the tick
  });

  test("kill credit: a poison death wins the combat", () => {
    let s = fight({ deck: ["DEADLY_POISON", "DEADLY_POISON", ...strikes(3)], monsters: ["T_FRAIL"] });
    s = play(s, "DEADLY_POISON");
    s = play(s, "DEADLY_POISON");
    expect(monsterPower(s, "POISON")).toBe(10); // intensity stacking
    s = endTurn(s); // 10 poison vs 8 HP
    expect(s.combat!.monsters[0]!.isDead).toBe(true);
    expect(s.eventLog.some((e) => e.event === "combatEnded" && e.payload === "victory")).toBe(true);
  });

  // MonsterGroup::doMonsterTurn re-checks isDeadOrEscaped before takeTurn, so a
  // monster that dies to its own start-of-turn tick never gets its move off.
  test("a monster killed by its own poison tick does not attack", () => {
    let s = fight({ deck: ["DEADLY_POISON", ...strikes(4)], monsters: ["T_TANK", "T_GUARD"] });
    s = play(s, "DEADLY_POISON", 0);
    s.combat!.monsters[0]!.hp = 3; // 5 poison vs 3 HP
    const hp0 = s.run.hp;
    s = endTurn(s);
    expect(s.combat!.monsters[0]!.isDead).toBe(true);
    expect(s.run.hp).toBe(hp0); // the tank's 10-damage Attack never happened
  });

  test("wakes Lagavulin (wasHPLost) through its 8 block", () => {
    let s = fight({ deck: ["DEADLY_POISON", ...strikes(4)], monsters: ["LAGAVULIN"] });
    const m = s.combat!.monsters[0]!;
    const maxHp = m.maxHp;
    expect(monsterPower(s, "ASLEEP")).toBe(1);
    expect(m.block).toBe(8);
    s = play(s, "DEADLY_POISON");
    s = endTurn(s);
    // poison ticked 5 THROUGH the 8 block; the wasHPLost wake fired
    expect(monsterHp(s)).toBe(maxHp - 5);
    expect(monsterPower(s, "POISON")).toBe(4);
    expect(monsterPower(s, "ASLEEP")).toBeUndefined();
    expect(monsterPower(s, "METALLICIZE")).toBeUndefined();
    // ENGINE-NOTE: the next-move roll happens inside the same monsterMove
    // action, before the queued wake resolves - the SLEEP intent lingers one
    // extra turn vs the real game (documented in powers/silent.ts POISON).
    expect(s.combat!.monsters[0]!.move).toBe("LAGAVULIN_SLEEP");
    s = endTurn(s);
    expect(s.combat!.monsters[0]!.move).toBe("LAGAVULIN_ATTACK"); // awake cycle begins
  });

  test("player-side poison ticks at the start of the player's turn", () => {
    // no green card poisons the player; apply directly to exercise the
    // owner-agnostic hook
    let s = fight({ deck: strikes(5), monsters: ["T_GUARD"] });
    s.combat!.player.powers.push({ id: "POISON", amount: 3, justApplied: false, data: null });
    s = endTurn(s);
    expect(s.run.hp).toBe(70 - 3);
    expect(playerPower(s, "POISON")).toBe(2);
    s = endTurn(s);
    expect(s.run.hp).toBe(70 - 3 - 2);
    expect(playerPower(s, "POISON")).toBe(1);
  });
});

describe("ACCURACY", () => {
  test("Shivs deal +4 (+6); other attacks are unaffected", () => {
    for (const [up, n] of [
      [0, 4],
      [1, 6],
    ] as const) {
      let s = fight({ deck: [{ defId: "ACCURACY", upgrades: up }, "BLADE_DANCE", ...strikes(3)] });
      s = play(s, "ACCURACY");
      expect(playerPower(s, "ACCURACY")).toBe(n);
      s = play(s, "STRIKE_GREEN");
      expect(monsterHp(s)).toBe(194); // strike untouched
      s = play(s, "BLADE_DANCE");
      s = play(s, "SHIV");
      expect(monsterHp(s)).toBe(194 - (4 + n));
    }
  });

  test("stacks (intensity)", () => {
    let s = fight({ deck: ["ACCURACY", "ACCURACY", "BLADE_DANCE", ...strikes(2)] });
    s = play(s, "ACCURACY");
    s = play(s, "ACCURACY");
    expect(playerPower(s, "ACCURACY")).toBe(8);
    s = play(s, "BLADE_DANCE");
    s = play(s, "SHIV");
    expect(monsterHp(s)).toBe(200 - 12);
  });

  test("ADOPTED ORDER: with Accuracy applied before a Double Damage-style power, " +
    "the add happens before the multiplier - (4+4)*2 = 16, matching the game's " +
    "base-damage semantics (see powers/silent.ts ACCURACY ordering caveat)", () => {
    let s = fight({ deck: ["ACCURACY", "PHANTASMAL_KILLER", "BLADE_DANCE", ...strikes(2)] });
    s = play(s, "ACCURACY");
    s = play(s, "PHANTASMAL_KILLER");
    s = endTurn(s); // DOUBLE_DAMAGE covers this turn
    expect(playerPower(s, "DOUBLE_DAMAGE")).toBe(1);
    s = play(s, "BLADE_DANCE");
    s = play(s, "SHIV");
    expect(monsterHp(s)).toBe(200 - 16); // (4+4)*2, not 4*2+4 = 12
  });
});

describe("WELL_LAID_PLANS retain flow", () => {
  test("base: at end of turn choose up to 1 card to retain", () => {
    let s = fight({ deck: ["WELL_LAID_PLANS", "DASH", ...strikes(3)], monsters: ["T_GUARD"] });
    s = play(s, "WELL_LAID_PLANS");
    expect(playerPower(s, "WELL_LAID_PLANS")).toBe(1);
    s = endTurn(s);
    const req = s.pending!.request;
    expect(req.kind === "cards" && req.min === 0 && req.max === 1).toBe(true);
    s = choose(s, [choiceIndexOf(s, "DASH")]);
    // turn 2: the 3 discarded strikes are redrawn + the retained DASH
    expect(handNames(s).length).toBe(4);
    expect(handNames(s).filter((n) => n === "DASH").length).toBe(1);
    // retainOnce is consumed: next end of turn offers the choice again but the
    // card discards normally if not re-chosen
    s = endTurn(s);
    expect(s.pending).not.toBeNull();
    s = choose(s, []); // retain nothing
    expect(handNames(s).length).toBe(4); // all 4 discarded and redrawn
    expect(block(s)).toBe(0);
  });

  test("upgraded: retain up to 2; choosing none retains none", () => {
    let s = fight({ deck: [{ defId: "WELL_LAID_PLANS", upgrades: 1 }, ...strikes(4)], monsters: ["T_GUARD"] });
    s = play(s, "WELL_LAID_PLANS");
    expect(playerPower(s, "WELL_LAID_PLANS")).toBe(2);
    s = endTurn(s);
    const req = s.pending!.request;
    expect(req.kind === "cards" && req.max === 2).toBe(true);
    s = choose(s, [0, 1]);
    // 2 retained + the 2 discarded strikes redrawn
    expect(handNames(s).length).toBe(4);
  });

  test("no choice when the hand is empty at end of turn", () => {
    let s = fight({ deck: ["WELL_LAID_PLANS", "SLICE", "SLICE", "SLICE"], monsters: ["T_GUARD"] });
    s = play(s, "WELL_LAID_PLANS");
    s = play(s, "SLICE");
    s = play(s, "SLICE");
    s = play(s, "SLICE");
    expect(handNames(s).length).toBe(0);
    s = endTurn(s);
    expect(s.pending).toBeNull(); // nothing to retain, no pause
    expect(handNames(s).length).toBe(3);
  });
});
