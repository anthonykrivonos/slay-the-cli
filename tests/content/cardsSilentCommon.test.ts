// Behavior tests for the Silent basics and commons (base AND upgraded).
// Numbers are corpus-exact. Player: 70 HP, 3 energy. Default monster T_TANK:
// 200 HP, attacks for 10 every turn. T_GUARD never attacks (blocks 5).

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
  monsterPower,
  playerPower,
  energy,
  block,
} from "./cardsSilentKit";

const strikes = (n: number) => Array(n).fill("STRIKE_GREEN") as string[];

describe("STRIKE_GREEN / DEFEND_GREEN", () => {
  test("base: strike 6, defend 5", () => {
    let s = fight({ deck: ["STRIKE_GREEN", "DEFEND_GREEN", "SLICE", "SLICE", "SLICE"] });
    s = play(s, "STRIKE_GREEN");
    expect(monsterHp(s)).toBe(194);
    s = play(s, "DEFEND_GREEN");
    expect(block(s)).toBe(5);
  });

  test("upgraded: strike 9, defend 8", () => {
    let s = fight({
      deck: [{ defId: "STRIKE_GREEN", upgrades: 1 }, { defId: "DEFEND_GREEN", upgrades: 1 }, "SLICE", "SLICE", "SLICE"],
    });
    s = play(s, "STRIKE_GREEN");
    expect(monsterHp(s)).toBe(191);
    s = play(s, "DEFEND_GREEN");
    expect(block(s)).toBe(8);
  });
});

describe("SURVIVOR", () => {
  test("base: 8 block, then discard a chosen card (manual)", () => {
    let s = fight({ deck: ["SURVIVOR", ...strikes(4)] });
    s = play(s, "SURVIVOR");
    expect(block(s)).toBe(8);
    expect(s.pending?.request.kind).toBe("cards");
    s = choose(s, [0]);
    expect(handNames(s).length).toBe(3);
    expect(s.combat!.turnFlags.manualDiscardsThisTurn).toBe(1);
    expect(pileNames(s, "discard")).toContain("SURVIVOR"); // resolved after the pause
  });

  test("upgraded: 11 block", () => {
    let s = fight({ deck: [{ defId: "SURVIVOR", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "SURVIVOR");
    expect(block(s)).toBe(11);
    s = choose(s, [0]);
    expect(handNames(s).length).toBe(3);
  });
});

describe("NEUTRALIZE", () => {
  test("3 damage + 1 Weak (4 + 2 upgraded); weak reduces the tank's attack", () => {
    let s = fight({ deck: ["NEUTRALIZE", ...strikes(4)] });
    s = play(s, "NEUTRALIZE");
    expect(monsterHp(s)).toBe(197);
    expect(monsterPower(s, "WEAK")).toBe(1);
    s = endTurn(s);
    expect(s.run.hp).toBe(70 - 7); // 10 * 0.75 = 7.5 -> 7

    let u = fight({ deck: [{ defId: "NEUTRALIZE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "NEUTRALIZE");
    expect(monsterHp(u)).toBe(196);
    expect(monsterPower(u, "WEAK")).toBe(2);
  });
});

describe("ACROBATICS", () => {
  test("base: draw 3 then discard 1 chosen", () => {
    let s = fightWithInHand(["ACROBATICS"], { deck: ["ACROBATICS", ...strikes(7)] });
    s = play(s, "ACROBATICS");
    expect(handNames(s).length).toBe(7); // 4 + 3 drawn
    expect(s.pending?.request.kind).toBe("cards");
    s = choose(s, [0]);
    expect(handNames(s).length).toBe(6);
  });

  test("upgraded: draws 4", () => {
    let s = fightWithInHand(["ACROBATICS"], { deck: [{ defId: "ACROBATICS", upgrades: 1 }, ...strikes(8)] });
    s = play(s, "ACROBATICS");
    expect(handNames(s).length).toBe(8);
    s = choose(s, [0]);
    expect(handNames(s).length).toBe(7);
  });
});

describe("BANE", () => {
  test("7 damage; doubled only if the target is poisoned (checked at use)", () => {
    let s = fight({ deck: ["BANE", "DEADLY_POISON", ...strikes(3)] });
    s = play(s, "BANE");
    expect(monsterHp(s)).toBe(193); // no poison: single hit

    let t = fight({ deck: ["BANE", "DEADLY_POISON", ...strikes(3)] });
    t = play(t, "DEADLY_POISON");
    t = play(t, "BANE");
    expect(monsterHp(t)).toBe(186); // 7 + 7
  });

  test("upgraded: 10, doubled 20", () => {
    let s = fight({ deck: [{ defId: "BANE", upgrades: 1 }, "DEADLY_POISON", ...strikes(3)] });
    s = play(s, "DEADLY_POISON");
    s = play(s, "BANE");
    expect(monsterHp(s)).toBe(180);
  });
});

describe("BLADE_DANCE / CLOAK_AND_DAGGER (Shivs)", () => {
  test("Blade Dance adds 3 (4 upgraded) Shivs; a Shiv deals 4 and exhausts", () => {
    let s = fight({ deck: ["BLADE_DANCE", ...strikes(4)] });
    s = play(s, "BLADE_DANCE");
    expect(handNames(s).filter((n) => n === "SHIV").length).toBe(3);
    s = play(s, "SHIV");
    expect(monsterHp(s)).toBe(196);
    expect(pileNames(s, "exhaust")).toContain("SHIV");

    let u = fight({ deck: [{ defId: "BLADE_DANCE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "BLADE_DANCE");
    expect(handNames(u).filter((n) => n === "SHIV").length).toBe(4);
  });

  test("Cloak and Dagger: 6 block + 1 Shiv (2 upgraded, block stays 6)", () => {
    let s = fight({ deck: ["CLOAK_AND_DAGGER", ...strikes(4)] });
    s = play(s, "CLOAK_AND_DAGGER");
    expect(block(s)).toBe(6);
    expect(handNames(s).filter((n) => n === "SHIV").length).toBe(1);

    let u = fight({ deck: [{ defId: "CLOAK_AND_DAGGER", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "CLOAK_AND_DAGGER");
    expect(block(u)).toBe(6);
    expect(handNames(u).filter((n) => n === "SHIV").length).toBe(2);
  });
});

describe("BACKFLIP / DEFLECT", () => {
  test("Backflip: 5 (8) block, draw 2", () => {
    let s = fightWithInHand(["BACKFLIP"], { deck: ["BACKFLIP", ...strikes(6)] });
    s = play(s, "BACKFLIP");
    expect(block(s)).toBe(5);
    expect(handNames(s).length).toBe(6); // 4 + 2 drawn

    let u = fight({ deck: [{ defId: "BACKFLIP", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "BACKFLIP");
    expect(block(u)).toBe(8);
  });

  test("Deflect: 0 cost, 4 (7) block", () => {
    let s = fight({ deck: ["DEFLECT", ...strikes(4)] });
    s = play(s, "DEFLECT");
    expect(block(s)).toBe(4);
    expect(energy(s)).toBe(3);

    let u = fight({ deck: [{ defId: "DEFLECT", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "DEFLECT");
    expect(block(u)).toBe(7);
  });
});

describe("DAGGER_SPRAY", () => {
  test("4 (6) to ALL enemies, twice", () => {
    let s = fight({ deck: ["DAGGER_SPRAY", ...strikes(4)], monsters: ["T_TANK", "T_TANK"] });
    s = play(s, "DAGGER_SPRAY");
    expect(monsterHp(s, 0)).toBe(192);
    expect(monsterHp(s, 1)).toBe(192);

    let u = fight({ deck: [{ defId: "DAGGER_SPRAY", upgrades: 1 }, ...strikes(4)], monsters: ["T_TANK", "T_TANK"] });
    u = play(u, "DAGGER_SPRAY");
    expect(monsterHp(u, 0)).toBe(188);
    expect(monsterHp(u, 1)).toBe(188);
  });
});

describe("DAGGER_THROW", () => {
  test("9 (12) damage, draw 1, discard 1 chosen", () => {
    let s = fightWithInHand(["DAGGER_THROW"], { deck: ["DAGGER_THROW", ...strikes(6)] });
    s = play(s, "DAGGER_THROW");
    expect(monsterHp(s)).toBe(191);
    expect(s.pending?.request.kind).toBe("cards");
    s = choose(s, [0]);
    expect(handNames(s).length).toBe(4); // 4 - card played + 1 drawn - 1 discarded
    expect(s.combat!.turnFlags.manualDiscardsThisTurn).toBe(1);
  });

  test("upgraded: 12", () => {
    let s = fightWithInHand(["DAGGER_THROW"], { deck: [{ defId: "DAGGER_THROW", upgrades: 1 }, ...strikes(6)] });
    s = play(s, "DAGGER_THROW");
    expect(monsterHp(s)).toBe(188);
    s = choose(s, [0]);
  });
});

describe("DEADLY_POISON / POISONED_STAB", () => {
  test("Deadly Poison applies 5 (7)", () => {
    let s = fight({ deck: ["DEADLY_POISON", ...strikes(4)] });
    s = play(s, "DEADLY_POISON");
    expect(monsterPower(s, "POISON")).toBe(5);

    let u = fight({ deck: [{ defId: "DEADLY_POISON", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "DEADLY_POISON");
    expect(monsterPower(u, "POISON")).toBe(7);
  });

  test("Poisoned Stab: 6 damage + 3 poison (8 + 4 upgraded)", () => {
    let s = fight({ deck: ["POISONED_STAB", ...strikes(4)] });
    s = play(s, "POISONED_STAB");
    expect(monsterHp(s)).toBe(194);
    expect(monsterPower(s, "POISON")).toBe(3);

    let u = fight({ deck: [{ defId: "POISONED_STAB", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "POISONED_STAB");
    expect(monsterHp(u)).toBe(192);
    expect(monsterPower(u, "POISON")).toBe(4);
  });
});

describe("DODGE_AND_ROLL", () => {
  test("4 (6) block now AND at the start of next turn", () => {
    for (const [up, b] of [
      [0, 4],
      [1, 6],
    ] as const) {
      let s = fight({ deck: [{ defId: "DODGE_AND_ROLL", upgrades: up }, ...strikes(4)], monsters: ["T_GUARD"] });
      s = play(s, "DODGE_AND_ROLL");
      expect(block(s)).toBe(b);
      expect(playerPower(s, "NEXT_TURN_BLOCK")).toBe(b);
      s = endTurn(s);
      expect(block(s)).toBe(b); // regained next turn
      expect(playerPower(s, "NEXT_TURN_BLOCK")).toBeUndefined();
    }
  });
});

describe("FLYING_KNEE / OUTMANEUVER (Energized)", () => {
  test("Flying Knee: 8 (11) damage, +1 energy next turn", () => {
    let s = fight({ deck: ["FLYING_KNEE", ...strikes(4)] });
    s = play(s, "FLYING_KNEE");
    expect(monsterHp(s)).toBe(192);
    expect(playerPower(s, "ENERGIZED")).toBe(1);
    s = endTurn(s);
    expect(energy(s)).toBe(4);
    expect(playerPower(s, "ENERGIZED")).toBeUndefined();

    let u = fight({ deck: [{ defId: "FLYING_KNEE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "FLYING_KNEE");
    expect(monsterHp(u)).toBe(189);
  });

  test("Outmaneuver: +2 (+3) energy next turn", () => {
    for (const [up, e] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fight({ deck: [{ defId: "OUTMANEUVER", upgrades: up }, ...strikes(4)] });
      s = play(s, "OUTMANEUVER");
      s = endTurn(s);
      expect(energy(s)).toBe(3 + e);
    }
  });
});

describe("PIERCING_WAIL", () => {
  test("ALL enemies lose 6 (8) Strength this turn; restored at end of their turn", () => {
    for (const [up, n] of [
      [0, 6],
      [1, 8],
    ] as const) {
      let s = fight({ deck: [{ defId: "PIERCING_WAIL", upgrades: up }, ...strikes(4)] });
      s = play(s, "PIERCING_WAIL");
      expect(monsterPower(s, "STRENGTH")).toBe(-n);
      expect(pileNames(s, "exhaust")).toContain("PIERCING_WAIL");
      s = endTurn(s);
      expect(s.run.hp).toBe(70 - Math.max(0, 10 - n)); // weakened hit
      expect(monsterPower(s, "STRENGTH")).toBe(0); // restored after its turn
      s = endTurn(s);
      expect(s.run.hp).toBe(70 - Math.max(0, 10 - n) - 10); // back to full damage
    }
  });
});

describe("PREPARED", () => {
  test("base: draw 1, discard 1 chosen", () => {
    let s = fightWithInHand(["PREPARED"], { deck: ["PREPARED", ...strikes(5)] });
    s = play(s, "PREPARED");
    expect(energy(s)).toBe(3); // costs 0
    s = choose(s, [0]);
    expect(handNames(s).length).toBe(4);
  });

  test("upgraded: draw 2, discard 2", () => {
    let s = fightWithInHand(["PREPARED"], { deck: [{ defId: "PREPARED", upgrades: 1 }, ...strikes(6)] });
    s = play(s, "PREPARED");
    expect(handNames(s).length).toBe(6); // 4 + 2 drawn
    const req = s.pending!.request;
    expect(req.kind === "cards" && req.min === 2 && req.max === 2).toBe(true);
    s = choose(s, [0, 1]);
    expect(handNames(s).length).toBe(4);
    expect(s.combat!.turnFlags.manualDiscardsThisTurn).toBe(2);
  });
});

describe("QUICK_SLASH / SLICE / SUCKER_PUNCH", () => {
  test("Quick Slash: 8 (12) damage, draw 1", () => {
    let s = fightWithInHand(["QUICK_SLASH"], { deck: ["QUICK_SLASH", ...strikes(6)] });
    s = play(s, "QUICK_SLASH");
    expect(monsterHp(s)).toBe(192);
    expect(handNames(s).length).toBe(5); // 4 + 1 drawn

    let u = fight({ deck: [{ defId: "QUICK_SLASH", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "QUICK_SLASH");
    expect(monsterHp(u)).toBe(188);
  });

  test("Slice: 0 cost, 6 (9)", () => {
    let s = fight({ deck: ["SLICE", { defId: "SLICE", upgrades: 1 }, ...strikes(3)] });
    s = play(s, "SLICE");
    expect(energy(s)).toBe(3);
    // both copies present initially; the unupgraded one resolves first by name
    expect([194, 191]).toContain(monsterHp(s));
  });

  test("Sucker Punch: 7 + 1 Weak (9 + 2 upgraded)", () => {
    let s = fight({ deck: ["SUCKER_PUNCH", ...strikes(4)] });
    s = play(s, "SUCKER_PUNCH");
    expect(monsterHp(s)).toBe(193);
    expect(monsterPower(s, "WEAK")).toBe(1);

    let u = fight({ deck: [{ defId: "SUCKER_PUNCH", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "SUCKER_PUNCH");
    expect(monsterHp(u)).toBe(191);
    expect(monsterPower(u, "WEAK")).toBe(2);
  });
});

describe("SNEAKY_STRIKE", () => {
  test("12 (16) damage; +2 energy only if a card was manually discarded this turn", () => {
    let s = fight({ deck: ["SNEAKY_STRIKE", "SURVIVOR", ...strikes(3)] });
    s = play(s, "SNEAKY_STRIKE");
    expect(monsterHp(s)).toBe(188);
    expect(energy(s)).toBe(1); // no refund

    let t = fight({ deck: ["SNEAKY_STRIKE", "SURVIVOR", ...strikes(3)] });
    t = play(t, "SURVIVOR");
    t = choose(t, [0]); // manual discard
    t = play(t, "SNEAKY_STRIKE");
    expect(energy(t)).toBe(2); // 3 - 1 - 2 + 2

    let u = fight({ deck: [{ defId: "SNEAKY_STRIKE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "SNEAKY_STRIKE");
    expect(monsterHp(u)).toBe(184);
  });
});
