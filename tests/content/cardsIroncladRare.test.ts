// Behavior tests for the bespoke Ironclad rares and the powers they create
// (base AND upgraded). Numbers are corpus-exact. Player: 80 HP, 3 energy.
// Default monster T_TANK: 200 HP, attacks for 10 every turn.

import { test, expect, describe } from "bun:test";
import {
  fight,
  fightWithInHand,
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

describe("BARRICADE", () => {
  test("block survives the start of turn (cost 3, upgraded 2)", () => {
    let s = fight({ deck: ["BARRICADE", "DEFEND_RED", "DEFEND_RED", "DEFEND_RED", "STRIKE_RED"] });
    s = play(s, "BARRICADE");
    expect(s.combat!.player.energy).toBe(0);
    s = endTurn(s); // tank 10 vs 0 block
    s = play(s, "DEFEND_RED");
    s = play(s, "DEFEND_RED");
    s = play(s, "DEFEND_RED");
    expect(s.combat!.player.block).toBe(15);
    s = endTurn(s); // 10 absorbed -> 5 left
    expect(s.combat!.player.block).toBe(5); // kept through turn start
  });

  test("upgraded costs 2", () => {
    let s = fight({ deck: [{ defId: "BARRICADE", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "BARRICADE");
    expect(s.combat!.player.energy).toBe(1);
    expect(playerPower(s, "BARRICADE")).toBeDefined();
  });
});

describe("BERSERK", () => {
  test("self Vulnerable 2 (1 upgraded); +1 energy each turn", () => {
    for (const [up, vuln] of [
      [0, 2],
      [1, 1],
    ] as const) {
      let s = fight({ deck: [{ defId: "BERSERK", upgrades: up }, ...strikes(4)] });
      s = play(s, "BERSERK");
      expect(playerPower(s, "VULNERABLE")).toBe(vuln);
      expect(playerPower(s, "BERSERK")).toBe(1);
      s = endTurn(s); // tank 10 * 1.5 = 15 while vulnerable
      expect(s.run.hp).toBe(80 - 15);
      expect(s.combat!.player.energy).toBe(4);
    }
  });
});

describe("BRUTALITY", () => {
  test("start of turn: lose 1 HP, draw 1", () => {
    let s = fightWithInHand(["BRUTALITY"], { deck: ["BRUTALITY", ...strikes(8)] });
    s = play(s, "BRUTALITY"); // cost 0
    expect(s.combat!.player.energy).toBe(3);
    s = endTurn(s);
    expect(s.run.hp).toBe(80 - 10 - 1); // tank + brutality
    expect(handNames(s).length).toBe(6); // 5 + 1
  });

  test("innate only when upgraded", () => {
    const up = fight({ deck: [{ defId: "BRUTALITY", upgrades: 1 }, ...strikes(9)], seed: "INNATE" });
    expect(handNames(up)).toContain("BRUTALITY"); // Brutality+ is Innate
  });
});

describe("CORRUPTION", () => {
  test("skills cost 0 and exhaust (cost 3, upgraded 2)", () => {
    for (const [up, left] of [
      [0, 0],
      [1, 1],
    ] as const) {
      let s = fight({ deck: [{ defId: "CORRUPTION", upgrades: up }, "DEFEND_RED", "DEFEND_RED", "STRIKE_RED", "STRIKE_RED"] });
      s = play(s, "CORRUPTION");
      expect(s.combat!.player.energy).toBe(left);
      s = play(s, "DEFEND_RED"); // costs 0 now
      expect(s.combat!.player.energy).toBe(left);
      expect(s.combat!.player.block).toBe(5);
      expect(pileNames(s, "exhaust")).toEqual(["DEFEND_RED"]);
      // attacks unaffected: strike still costs 1
      if (left >= 1) {
        s = play(s, "STRIKE_RED", 0);
        expect(s.combat!.player.energy).toBe(left - 1);
      } else {
        expect(() => play(s, "STRIKE_RED", 0)).toThrow("not enough energy");
      }
    }
  });

  test("a skill that pauses for a choice still exhausts (Warcry-style)", () => {
    let s = fight({ deck: [{ defId: "CORRUPTION", upgrades: 1 }, "BURNING_PACT", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "CORRUPTION");
    s = play(s, "BURNING_PACT"); // free via Corruption; choice among 3 strikes
    s = choose(s, [0]);
    expect(pileNames(s, "exhaust").sort()).toEqual(["BURNING_PACT", "STRIKE_RED"]);
  });
});

describe("DEMON_FORM", () => {
  test("gain 2 (3 upgraded) Strength each turn", () => {
    for (const [up, str] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fight({ deck: [{ defId: "DEMON_FORM", upgrades: up }, ...strikes(4)] });
      s = play(s, "DEMON_FORM");
      expect(s.combat!.player.energy).toBe(0);
      s = endTurn(s);
      expect(playerPower(s, "STRENGTH")).toBe(str);
      const hp0 = monsterHp(s);
      s = play(s, "STRIKE_RED", 0);
      expect(monsterHp(s)).toBe(hp0 - 6 - str);
      s = endTurn(s);
      expect(playerPower(s, "STRENGTH")).toBe(2 * str);
    }
  });
});

describe("DOUBLE_TAP", () => {
  test("base: next attack is played twice", () => {
    let s = fight({ deck: ["DOUBLE_TAP", ...strikes(4)] });
    s = play(s, "DOUBLE_TAP");
    expect(playerPower(s, "DOUBLE_TAP")).toBe(1);
    s = play(s, "STRIKE_RED", 0);
    expect(monsterHp(s)).toBe(200 - 12); // 6 x2
    expect(playerPower(s, "DOUBLE_TAP")).toBeUndefined();
    expect(s.combat!.player.energy).toBe(1); // paid once
    s = play(s, "STRIKE_RED", 0);
    expect(monsterHp(s)).toBe(200 - 18); // no more doubling
  });

  test("upgraded: next 2 attacks are played twice; expires at end of turn", () => {
    let s = fight({ deck: [{ defId: "DOUBLE_TAP", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "DOUBLE_TAP");
    expect(playerPower(s, "DOUBLE_TAP")).toBe(2);
    s = play(s, "STRIKE_RED", 0);
    expect(monsterHp(s)).toBe(200 - 12);
    expect(playerPower(s, "DOUBLE_TAP")).toBe(1);
    s = play(s, "STRIKE_RED", 0);
    expect(monsterHp(s)).toBe(200 - 24);
    expect(playerPower(s, "DOUBLE_TAP")).toBeUndefined();
  });
});

describe("EXHUME", () => {
  test("returns an exhausted card to hand; itself exhausts", () => {
    let s = fight({ deck: ["EXHUME", "IMPERVIOUS", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "IMPERVIOUS"); // exhausts itself
    s = play(s, "EXHUME"); // single candidate -> auto
    expect(s.pending).toBeNull();
    expect(handNames(s)).toContain("IMPERVIOUS");
    expect(pileNames(s, "exhaust")).toEqual(["EXHUME"]);
  });

  test("cannot pick another Exhume; upgraded costs 0", () => {
    let s = fight({ deck: [{ defId: "EXHUME", upgrades: 1 }, { defId: "EXHUME", upgrades: 1 }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "EXHUME");
    expect(s.combat!.player.energy).toBe(3); // upgraded cost 0
    s = play(s, "EXHUME"); // only EXHUME in exhaust pile -> no candidates
    expect(s.pending).toBeNull();
    expect(handNames(s)).not.toContain("EXHUME");
    expect(pileNames(s, "exhaust")).toEqual(["EXHUME", "EXHUME"]);
  });
});

describe("FEED", () => {
  test("fatal: +3 (4 upgraded) max HP, healing the same", () => {
    for (const [up, bonus] of [
      [0, 3],
      [1, 4],
    ] as const) {
      let s = fight({ deck: [{ defId: "FEED", upgrades: up }, ...strikes(4)], monsters: ["T_FRAIL"] });
      s = play(s, "FEED", 0); // 10 (12) vs 8 HP: fatal, ends the combat
      expect(s.combat!.monsters[0]!.isDead).toBe(true);
      expect(s.run.maxHp).toBe(80 + bonus);
      expect(s.run.hp).toBe(80 + bonus);
      expect(s.eventLog.some((e) => e.event === "victory")).toBe(true);
    }
  });

  test("non-fatal: no max HP change; exhausts", () => {
    let s = fight({ deck: ["FEED", ...strikes(4)] });
    s = play(s, "FEED", 0);
    expect(monsterHp(s)).toBe(190);
    expect(s.run.maxHp).toBe(80);
    expect(pileNames(s, "exhaust")).toEqual(["FEED"]);
  });
});

describe("FIEND_FIRE", () => {
  test("exhausts the hand, 7 (10 upgraded) damage per card", () => {
    for (const [up, per] of [
      [0, 7],
      [1, 10],
    ] as const) {
      let s = fight({ deck: [{ defId: "FIEND_FIRE", upgrades: up }, ...strikes(4)] });
      s = play(s, "FIEND_FIRE", 0);
      expect(monsterHp(s)).toBe(200 - 4 * per);
      expect(pileNames(s, "exhaust").length).toBe(5); // 4 strikes + Fiend Fire itself
      expect(handNames(s)).toEqual([]);
    }
  });
});

describe("JUGGERNAUT", () => {
  test("any block gain deals 5 (7 upgraded) to a random enemy", () => {
    for (const [up, n] of [
      [0, 5],
      [1, 7],
    ] as const) {
      let s = fight({ deck: [{ defId: "JUGGERNAUT", upgrades: up }, "DEFEND_RED", "METALLICIZE", "STRIKE_RED", "STRIKE_RED"] });
      s = play(s, "JUGGERNAUT");
      s = play(s, "DEFEND_RED");
      expect(monsterHp(s)).toBe(200 - n);
      // Metallicize's end-of-turn block also triggers it
      s = endTurn(s);
      s = play(s, "METALLICIZE");
      s = endTurn(s);
      expect(monsterHp(s)).toBe(200 - 2 * n);
    }
  });
});

describe("LIMIT_BREAK", () => {
  test("base: doubles Strength and exhausts", () => {
    let s = fight({ deck: ["LIMIT_BREAK", "FLEX", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "FLEX");
    s = play(s, "LIMIT_BREAK");
    expect(playerPower(s, "STRENGTH")).toBe(4);
    expect(pileNames(s, "exhaust")).toEqual(["LIMIT_BREAK"]);
  });

  test("upgraded: does not exhaust; zero strength is a no-op", () => {
    let s = fight({ deck: [{ defId: "LIMIT_BREAK", upgrades: 1 }, "FLEX", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "LIMIT_BREAK");
    expect(playerPower(s, "STRENGTH")).toBeUndefined();
    expect(pileNames(s, "discard")).toEqual(["LIMIT_BREAK"]);
    expect(pileNames(s, "exhaust")).toEqual([]);
  });
});

describe("OFFERING", () => {
  test("lose 6 HP, +2 energy, draw 3 (5 upgraded); exhausts", () => {
    for (const [up, n] of [
      [0, 3],
      [1, 5],
    ] as const) {
      let s = fightWithInHand(["OFFERING"], { deck: [{ defId: "OFFERING", upgrades: up }, ...strikes(9)] });
      s = play(s, "OFFERING");
      expect(s.run.hp).toBe(74);
      expect(s.combat!.player.energy).toBe(5);
      expect(handNames(s).length).toBe(4 + n);
      expect(pileNames(s, "exhaust")).toEqual(["OFFERING"]);
    }
  });
});

describe("REAPER", () => {
  test("heals the unblocked damage dealt; exhausts", () => {
    for (const [up, dmg] of [
      [0, 4],
      [1, 5],
    ] as const) {
      let s = fight({ deck: [{ defId: "REAPER", upgrades: up }, ...strikes(4)], monsters: ["T_TANK", "T_TANK"], hp: 50 });
      s = play(s, "REAPER");
      expect(monsterHp(s, 0)).toBe(200 - dmg);
      expect(monsterHp(s, 1)).toBe(200 - dmg);
      expect(s.run.hp).toBe(50 + 2 * dmg);
      expect(pileNames(s, "exhaust")).toEqual(["REAPER"]);
    }
  });

  test("heal caps at what the enemy actually lost (lethal overkill)", () => {
    let s = fight({ deck: ["FLEX", { defId: "FLEX", upgrades: 1 }, "REAPER", "STRIKE_RED", "STRIKE_RED"], monsters: ["T_FRAIL"], hp: 50 });
    s = play(s, "FLEX");
    s = play(s, "FLEX"); // strength 6 total -> reaper hits 10 vs 8 HP
    s = play(s, "REAPER");
    expect(s.combat!.monsters[0]!.isDead).toBe(true);
    expect(s.run.hp).toBe(58); // only 8 HP were actually lost
  });
});

describe("BLUDGEON / IMPERVIOUS (primitives sanity)", () => {
  test("Bludgeon 32/42; Impervious 30/40 + exhaust", () => {
    for (const [up, bludgeon, block] of [
      [0, 32, 30],
      [1, 42, 40],
    ] as const) {
      let s = fight({ deck: [{ defId: "BLUDGEON", upgrades: up }, ...strikes(4)] });
      s = play(s, "BLUDGEON", 0);
      expect(monsterHp(s)).toBe(200 - bludgeon);
      s = fight({ deck: [{ defId: "IMPERVIOUS", upgrades: up }, ...strikes(4)] });
      s = play(s, "IMPERVIOUS");
      expect(s.combat!.player.block).toBe(block);
      expect(pileNames(s, "exhaust")).toEqual(["IMPERVIOUS"]);
    }
  });
});

describe("IMMOLATE (primitives sanity)", () => {
  test("21 (28 upgraded) to all + a Burn into the discard", () => {
    for (const [up, dmg] of [
      [0, 21],
      [1, 28],
    ] as const) {
      let s = fight({ deck: [{ defId: "IMMOLATE", upgrades: up }, ...strikes(4)], monsters: ["T_TANK", "T_TANK"] });
      s = play(s, "IMMOLATE");
      expect(monsterHp(s, 0)).toBe(200 - dmg);
      expect(monsterHp(s, 1)).toBe(200 - dmg);
      expect(pileNames(s, "discard")).toContain("BURN");
    }
  });
});
