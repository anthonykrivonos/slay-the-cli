// Behavior tests for all 5 statuses and 14 curses. Numbers are corpus-exact.
// Player: 80 HP, 3 energy. Default monster T_TANK: 200 HP, attacks for 10.

import { test, expect, describe } from "bun:test";
import {
  fight,
  play,
  endTurn,
  choose,
  choiceIndexOf,
  handNames,
  pileNames,
  monsterHp,
  playerPower,
} from "./cardsTestKit";

const strikes = (n: number) => Array(n).fill("STRIKE_RED") as string[];

describe("statuses", () => {
  test("BURN: unplayable; 2 (4 upgraded) end-of-turn damage, absorbed by block", () => {
    for (const [up, dmg] of [
      [0, 2],
      [1, 4],
    ] as const) {
      let s = fight({ deck: [{ defId: "BURN", upgrades: up }, ...strikes(4)] });
      expect(() => play(s, "BURN")).toThrow("unplayable");
      s = endTurn(s);
      expect(s.run.hp).toBe(80 - dmg - 10); // burn + tank attack
    }
    // block absorbs it
    let s = fight({ deck: ["BURN", "DEFEND_RED", ...strikes(3)] });
    s = play(s, "DEFEND_RED"); // 5 block
    s = endTurn(s); // burn 2 -> 3 block left -> tank 10 -> 7 through
    expect(s.run.hp).toBe(80 - 7);
  });

  test("DAZED: unplayable, ethereal (exhausts at end of turn)", () => {
    let s = fight({ deck: ["DAZED", ...strikes(4)] });
    expect(() => play(s, "DAZED")).toThrow("unplayable");
    s = endTurn(s);
    expect(pileNames(s, "exhaust")).toEqual(["DAZED"]);
  });

  test("SLIMED: costs 1, does nothing, exhausts", () => {
    let s = fight({ deck: ["SLIMED", ...strikes(4)] });
    s = play(s, "SLIMED");
    expect(s.combat!.player.energy).toBe(2);
    expect(pileNames(s, "exhaust")).toEqual(["SLIMED"]);
    expect(monsterHp(s)).toBe(200);
    expect(s.run.hp).toBe(80);
  });

  test("VOID: loses 1 energy when drawn; ethereal", () => {
    let s = fight({ deck: ["VOID", ...strikes(4)] });
    expect(s.combat!.player.energy).toBe(2); // drawn during the opening draw
    expect(() => play(s, "VOID")).toThrow("unplayable");
    s = endTurn(s);
    expect(pileNames(s, "exhaust")).toEqual(["VOID"]);
    // redrawn next turn: loses energy again
    s = endTurn(s);
    expect(s.combat!.player.energy).toBe(3); // VOID is in the exhaust pile now
  });

  test("WOUND: unplayable, inert", () => {
    let s = fight({ deck: ["WOUND", ...strikes(4)] });
    expect(() => play(s, "WOUND")).toThrow("unplayable");
    s = endTurn(s);
    // not ethereal: discarded, reshuffled and redrawn - never exhausted
    expect(pileNames(s, "exhaust")).toEqual([]);
    expect(handNames(s)).toContain("WOUND");
  });
});

describe("curses", () => {
  test("unplayable curses throw", () => {
    for (const id of ["REGRET", "INJURY", "CURSE_OF_THE_BELL", "NECRONOMICURSE", "WRITHE", "PARASITE", "NORMALITY", "PAIN", "DECAY", "DOUBT", "SHAME", "CLUMSY", "ASCENDERS_BANE"]) {
      const s = fight({ deck: [id, ...strikes(4)] });
      expect(() => play(s, id)).toThrow("unplayable");
    }
  });

  test("CLUMSY and ASCENDERS_BANE are ethereal", () => {
    for (const id of ["CLUMSY", "ASCENDERS_BANE"]) {
      let s = fight({ deck: [id, ...strikes(4)] });
      s = endTurn(s);
      expect(pileNames(s, "exhaust")).toEqual([id]);
    }
  });

  test("WRITHE: innate (always in the opening hand)", () => {
    const s = fight({ deck: ["WRITHE", ...strikes(9)], seed: "WRITHE" });
    expect(handNames(s)).toContain("WRITHE");
  });

  test("DECAY: take 2 at end of turn", () => {
    let s = fight({ deck: ["DECAY", ...strikes(4)] });
    s = endTurn(s);
    expect(s.run.hp).toBe(80 - 2 - 10);
  });

  test("DOUBT: 1 Weak at end of turn, active on YOUR next turn", () => {
    let s = fight({ deck: ["DOUBT", ...strikes(4)] });
    s = endTurn(s);
    expect(playerPower(s, "WEAK")).toBe(1); // survived the round tick (justApplied)
    const hp0 = monsterHp(s);
    s = play(s, "STRIKE_RED", 0);
    expect(monsterHp(s)).toBe(hp0 - 4); // floor(6 * 0.75)
  });

  test("SHAME: 1 Frail at end of turn", () => {
    let s = fight({ deck: ["SHAME", ...strikes(4)] });
    s = endTurn(s);
    expect(playerPower(s, "FRAIL")).toBe(1);
    // Doubt/Shame are drawn again turn 2: play a defend-less check via block math
  });

  test("SHAME's Frail reduces card block", () => {
    let s = fight({ deck: ["SHAME", "DEFEND_RED", ...strikes(3)] });
    s = endTurn(s);
    s = play(s, "DEFEND_RED");
    expect(s.combat!.player.block).toBe(3); // floor(5 * 0.75)
  });

  test("REGRET: lose HP equal to hand size at end of turn", () => {
    let s = fight({ deck: ["REGRET", ...strikes(4)] });
    s = endTurn(s); // 5 cards in hand
    expect(s.run.hp).toBe(80 - 5 - 10);
  });

  test("NORMALITY: at most 3 cards per turn while in hand", () => {
    let s = fight({ deck: ["NORMALITY", "ANGER", "ANGER", "ANGER", "ANGER"] });
    expect(playerPower(s, "NORMALITY")).toBe(1);
    s = play(s, "ANGER", 0);
    s = play(s, "ANGER", 0);
    s = play(s, "ANGER", 0);
    expect(() => play(s, "ANGER", 0)).toThrow("prevents playing");
  });

  test("PAIN: lose 1 HP per copy in hand when other cards are played", () => {
    let s = fight({ deck: ["PAIN", ...strikes(4)] });
    s = play(s, "STRIKE_RED", 0);
    expect(s.run.hp).toBe(79);
    s = play(s, "STRIKE_RED", 0);
    expect(s.run.hp).toBe(78);
  });

  test("two PAINs in hand: 2 HP per play", () => {
    let s = fight({ deck: ["PAIN", "PAIN", ...strikes(3)] });
    s = play(s, "STRIKE_RED", 0);
    expect(s.run.hp).toBe(78);
  });

  test("PRIDE: playable for 1, exhausts, does nothing else", () => {
    let s = fight({ deck: ["PRIDE", ...strikes(4)] });
    s = play(s, "PRIDE");
    expect(s.combat!.player.energy).toBe(2);
    expect(pileNames(s, "exhaust")).toEqual(["PRIDE"]);
    expect(s.run.hp).toBe(80);
  });

  test("PRIDE: end of turn in hand puts a copy on top of the draw pile", () => {
    let s = fight({ deck: ["PRIDE", ...strikes(4)] }); // innate: opens in hand
    expect(handNames(s)).toContain("PRIDE");
    s = endTurn(s);
    // the copy sat on top of the draw pile and was drawn first this turn
    expect(handNames(s)).toContain("PRIDE");
    const prides = Object.values(s.combat!.cards).filter((c) => c.defId === "PRIDE");
    expect(prides.length).toBe(2);
  });

  test("NECRONOMICURSE: returns to hand when exhausted", () => {
    let s = fight({ deck: [{ defId: "TRUE_GRIT", upgrades: 1 }, "NECRONOMICURSE", ...strikes(3)] });
    s = play(s, "TRUE_GRIT");
    s = choose(s, [choiceIndexOf(s, "NECRONOMICURSE")]);
    expect(pileNames(s, "exhaust")).toEqual(["NECRONOMICURSE"]);
    expect(handNames(s)).toContain("NECRONOMICURSE"); // the fresh copy
  });
});
