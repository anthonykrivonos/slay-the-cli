// Behavior tests for the bespoke Silent rares and the powers they create
// (base AND upgraded). Numbers are corpus-exact. Player: 70 HP, 3 energy.
// T_TANK: 200 HP, hits 10. T_GUARD blocks 5. T_FRAIL: 8 HP, blocks.

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

describe("ADRENALINE", () => {
  test("gain 1 (2) energy, draw 2, exhaust", () => {
    for (const [up, e] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fightWithInHand(["ADRENALINE"], { deck: [{ defId: "ADRENALINE", upgrades: up }, ...strikes(9)] });
      s = play(s, "ADRENALINE");
      expect(energy(s)).toBe(3 + e);
      expect(handNames(s).length).toBe(6); // 4 + 2 drawn
      expect(pileNames(s, "exhaust")).toContain("ADRENALINE");
    }
  });
});

describe("AFTER_IMAGE", () => {
  test("gain 1 block whenever a card is played; innate only when upgraded", () => {
    const up = fight({ deck: [{ defId: "AFTER_IMAGE", upgrades: 1 }, ...strikes(9)], seed: "AIINNATE" });
    expect(handNames(up)).toContain("AFTER_IMAGE"); // After Image+ is Innate
    let s = fight({ deck: ["AFTER_IMAGE", ...strikes(4)] });
    while (!handNames(s).includes("AFTER_IMAGE")) s = endTurn(s);
    s = play(s, "AFTER_IMAGE");
    expect(block(s)).toBe(0); // the power card itself does not trigger it
    s = play(s, "STRIKE_GREEN");
    expect(block(s)).toBe(1);
    s = play(s, "STRIKE_GREEN");
    expect(block(s)).toBe(2);
  });
});

describe("ALCHEMIZE", () => {
  test("obtains a random potion (potionRng); exhausts; upgraded costs 0", () => {
    let s = fight({ deck: ["ALCHEMIZE", ...strikes(4)] });
    expect(s.run.potions.filter(Boolean).length).toBe(0);
    s = play(s, "ALCHEMIZE");
    expect(s.run.potions.filter(Boolean).length).toBe(1);
    expect(energy(s)).toBe(2);
    expect(pileNames(s, "exhaust")).toContain("ALCHEMIZE");

    let u = fight({ deck: [{ defId: "ALCHEMIZE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "ALCHEMIZE");
    expect(energy(u)).toBe(3);
    expect(u.run.potions.filter(Boolean).length).toBe(1);
  });
});

describe("A_THOUSAND_CUTS", () => {
  test("1 (2) damage to ALL enemies whenever a card is played", () => {
    for (const [up, n] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "A_THOUSAND_CUTS", upgrades: up }, ...strikes(4)], monsters: ["T_TANK", "T_TANK"] });
      s = play(s, "A_THOUSAND_CUTS");
      expect(monsterHp(s, 0)).toBe(200); // not on itself
      s = play(s, "STRIKE_GREEN", 0);
      expect(monsterHp(s, 0)).toBe(200 - 6 - n);
      expect(monsterHp(s, 1)).toBe(200 - n);
    }
  });
});

describe("BULLET_TIME", () => {
  test("hand costs 0 this turn; No Draw this turn; costs reset next turn", () => {
    let s = fight({ deck: ["BULLET_TIME", "DASH", "CHOKE", ...strikes(2)] });
    s = play(s, "BULLET_TIME"); // 3 energy
    expect(energy(s)).toBe(0);
    expect(playerPower(s, "NO_DRAW")).toBe(1);
    s = play(s, "DASH"); // would cost 2
    s = play(s, "CHOKE"); // would cost 2
    expect(energy(s)).toBe(0);
    s = endTurn(s);
    expect(playerPower(s, "NO_DRAW")).toBeUndefined();
    s = play(s, "DASH"); // cost restored
    expect(energy(s)).toBe(1);
  });

  test("upgraded costs 2", () => {
    let s = fight({ deck: [{ defId: "BULLET_TIME", upgrades: 1 }, "DASH", ...strikes(3)] });
    s = play(s, "BULLET_TIME");
    expect(energy(s)).toBe(1);
  });
});

describe("BURST", () => {
  test("next 1 (2) Skills are played twice; attacks are not doubled", () => {
    let s = fight({ deck: ["BURST", "DEADLY_POISON", ...strikes(3)] });
    s = play(s, "BURST");
    expect(playerPower(s, "BURST")).toBe(1);
    s = play(s, "DEADLY_POISON");
    expect(monsterPower(s, "POISON")).toBe(10); // 5 applied twice
    expect(playerPower(s, "BURST")).toBeUndefined();
    expect(energy(s)).toBe(1); // duplicate is free

    let t = fight({ deck: ["BURST", "DEADLY_POISON", ...strikes(3)] });
    t = play(t, "BURST");
    t = play(t, "STRIKE_GREEN");
    expect(monsterHp(t)).toBe(194); // single hit
    expect(playerPower(t, "BURST")).toBe(1); // not consumed by an attack

    let u = fight({ deck: [{ defId: "BURST", upgrades: 1 }, "DEADLY_POISON", "DEADLY_POISON", ...strikes(2)] });
    u = play(u, "BURST");
    u = play(u, "DEADLY_POISON");
    u = play(u, "DEADLY_POISON");
    expect(monsterPower(u, "POISON")).toBe(20); // both doubled
    expect(playerPower(u, "BURST")).toBeUndefined();
  });

  test("expires at end of turn", () => {
    let s = fight({ deck: ["BURST", "DEADLY_POISON", ...strikes(3)] });
    s = play(s, "BURST");
    s = endTurn(s);
    expect(playerPower(s, "BURST")).toBeUndefined();
    s = play(s, "DEADLY_POISON");
    expect(monsterPower(s, "POISON")).toBe(5); // single
  });
});

describe("CORPSE_EXPLOSION", () => {
  test("6 (9) poison + on-death explosion equal to max HP hits ALL enemies", () => {
    let s = fight({
      deck: ["CORPSE_EXPLOSION", ...strikes(4)],
      monsters: ["T_TANK", "T_FRAIL"],
    });
    s = play(s, "CORPSE_EXPLOSION", 1);
    expect(monsterPower(s, "POISON", 1)).toBe(6);
    expect(monsterPower(s, "CORPSE_EXPLOSION_POWER", 1)).toBe(1);
    s = endTurn(s); // poison 6 vs 8 HP -> 2 left
    expect(monsterHp(s, 1)).toBe(2);
    s = endTurn(s); // poison 5 kills; explosion: 8 (its max HP) to ALL others
    expect(s.combat!.monsters[1]!.isDead).toBe(true);
    expect(monsterHp(s, 0)).toBe(200 - 8);

    let u = fight({ deck: [{ defId: "CORPSE_EXPLOSION", upgrades: 1 }, ...strikes(4)], monsters: ["T_GUARD"] });
    u = play(u, "CORPSE_EXPLOSION");
    expect(monsterPower(u, "POISON")).toBe(9);
  });
});

describe("DIE_DIE_DIE", () => {
  test("13 (17) to ALL enemies; exhausts", () => {
    let s = fight({ deck: ["DIE_DIE_DIE", ...strikes(4)], monsters: ["T_TANK", "T_TANK"] });
    s = play(s, "DIE_DIE_DIE");
    expect(monsterHp(s, 0)).toBe(187);
    expect(monsterHp(s, 1)).toBe(187);
    expect(pileNames(s, "exhaust")).toContain("DIE_DIE_DIE");

    let u = fight({ deck: [{ defId: "DIE_DIE_DIE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "DIE_DIE_DIE");
    expect(monsterHp(u)).toBe(183);
  });
});

describe("DOPPELGANGER", () => {
  test("X-cost: next turn draw X and gain X energy (X+1 upgraded); exhausts", () => {
    let s = fightWithInHand(["DOPPELGANGER"], { deck: ["DOPPELGANGER", ...strikes(9)] });
    s = play(s, "DOPPELGANGER"); // X = 3
    expect(energy(s)).toBe(0);
    expect(pileNames(s, "exhaust")).toContain("DOPPELGANGER");
    expect(playerPower(s, "ENERGIZED")).toBe(3);
    expect(playerPower(s, "DRAW_CARD_NEXT_TURN")).toBe(3);
    s = endTurn(s);
    expect(energy(s)).toBe(6);
    expect(handNames(s).length).toBe(8);

    let u = fightWithInHand(["DOPPELGANGER"], { deck: [{ defId: "DOPPELGANGER", upgrades: 1 }, ...strikes(9)] });
    u = play(u, "DOPPELGANGER"); // X = 3, +1
    u = endTurn(u);
    expect(energy(u)).toBe(7);
    expect(handNames(u).length).toBe(9);
  });
});

describe("ENVENOM", () => {
  test("unblocked attack damage applies 1 poison; fully blocked hits apply none", () => {
    let s = fight({ deck: ["ENVENOM", "NEUTRALIZE", ...strikes(3)], monsters: ["T_GUARD"] });
    s = play(s, "ENVENOM"); // cost 2
    expect(energy(s)).toBe(1);
    s = play(s, "NEUTRALIZE"); // 3 dmg, no block yet on turn 1: unblocked
    expect(monsterPower(s, "POISON")).toBe(1);
    s = endTurn(s); // poison ticks 1 (removed); guard gains block 5; weak expires
    expect(monsterPower(s, "POISON")).toBeUndefined();
    s = play(s, "NEUTRALIZE"); // 3 vs block 5: fully blocked -> no poison; re-applies Weak
    expect(monsterPower(s, "POISON")).toBeUndefined();
    s = play(s, "STRIKE_GREEN"); // 6 * 0.75 = 4 vs block 2: 2 unblocked
    expect(monsterPower(s, "POISON")).toBe(1);
  });

  test("upgraded costs 1", () => {
    let s = fight({ deck: [{ defId: "ENVENOM", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "ENVENOM");
    expect(energy(s)).toBe(2);
  });
});

describe("GLASS_KNIFE", () => {
  test("8 (12) x2; damage drops 2 per play this combat, floor 0", () => {
    let s = fight({ deck: ["GLASS_KNIFE", ...strikes(4)] });
    s = play(s, "GLASS_KNIFE");
    expect(monsterHp(s)).toBe(200 - 16);
    s = endTurn(s); // redraw the same 5 cards
    s = play(s, "GLASS_KNIFE");
    expect(monsterHp(s)).toBe(200 - 16 - 12); // 6 x2
    s = endTurn(s);
    s = play(s, "GLASS_KNIFE");
    expect(monsterHp(s)).toBe(200 - 16 - 12 - 8); // 4 x2

    let u = fight({ deck: [{ defId: "GLASS_KNIFE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "GLASS_KNIFE");
    expect(monsterHp(u)).toBe(200 - 24);
    u = endTurn(u);
    u = play(u, "GLASS_KNIFE");
    expect(monsterHp(u)).toBe(200 - 24 - 20);
  });
});

describe("GRAND_FINALE", () => {
  test("playable only with an empty draw pile; 50 (60) to ALL", () => {
    let s = fight({ deck: ["GRAND_FINALE", ...strikes(4)], monsters: ["T_TANK", "T_TANK"] });
    expect(s.combat!.player.piles.draw.length).toBe(0);
    s = play(s, "GRAND_FINALE");
    expect(monsterHp(s, 0)).toBe(150);
    expect(monsterHp(s, 1)).toBe(150);
    expect(energy(s)).toBe(3); // costs 0

    const t = fightWithInHand(["GRAND_FINALE"], { deck: ["GRAND_FINALE", ...strikes(6)] });
    expect(t.combat!.player.piles.draw.length).toBeGreaterThan(0);
    expect(() => play(t, "GRAND_FINALE")).toThrow("cannot be used");

    let u = fight({ deck: [{ defId: "GRAND_FINALE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "GRAND_FINALE");
    expect(monsterHp(u)).toBe(140);
  });
});

describe("MALAISE", () => {
  test("X-cost: enemy loses X (X+1) Strength and gains X (X+1) Weak; exhausts", () => {
    let s = fight({ deck: ["MALAISE", ...strikes(4)] });
    s = play(s, "MALAISE"); // X = 3
    expect(monsterPower(s, "STRENGTH")).toBe(-3);
    expect(monsterPower(s, "WEAK")).toBe(3);
    expect(energy(s)).toBe(0);
    expect(pileNames(s, "exhaust")).toContain("MALAISE");
    s = endTurn(s);
    expect(s.run.hp).toBe(70 - 5); // (10 - 3) * 0.75 = 5.25 -> 5

    let u = fight({ deck: [{ defId: "MALAISE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "MALAISE"); // X = 3, +1
    expect(monsterPower(u, "STRENGTH")).toBe(-4);
    expect(monsterPower(u, "WEAK")).toBe(4);
  });
});

describe("NIGHTMARE", () => {
  test("choose a card; 3 copies arrive next turn; exhausts; upgraded costs 2", () => {
    let s = fight({ deck: ["NIGHTMARE", "DEADLY_POISON", ...strikes(3)] });
    s = play(s, "NIGHTMARE");
    expect(energy(s)).toBe(0);
    s = choose(s, [choiceIndexOf(s, "DEADLY_POISON")]);
    expect(playerPower(s, "NIGHTMARE_POWER")).toBe(3);
    expect(pileNames(s, "exhaust")).toContain("NIGHTMARE");
    s = endTurn(s);
    // 4 remaining deck cards redrawn + 3 created copies
    expect(handNames(s).filter((n) => n === "DEADLY_POISON").length).toBe(4);
    expect(handNames(s).length).toBe(7);
    expect(playerPower(s, "NIGHTMARE_POWER")).toBeUndefined();

    let u = fight({ deck: [{ defId: "NIGHTMARE", upgrades: 1 }, "DEADLY_POISON", ...strikes(3)] });
    u = play(u, "NIGHTMARE");
    expect(energy(u)).toBe(1); // cost 2
    u = choose(u, [choiceIndexOf(u, "DEADLY_POISON")]);
    u = endTurn(u);
    expect(handNames(u).filter((n) => n === "DEADLY_POISON").length).toBe(4);
  });
});

describe("PHANTASMAL_KILLER", () => {
  test("NEXT turn attacks deal double damage — not this turn, not the one after", () => {
    let s = fight({ deck: ["PHANTASMAL_KILLER", ...strikes(4)], monsters: ["T_GUARD"] });
    s = play(s, "PHANTASMAL_KILLER");
    expect(playerPower(s, "PHANTASMAL")).toBe(1);
    s = play(s, "STRIKE_GREEN");
    expect(monsterHp(s)).toBe(194); // not doubled yet
    s = endTurn(s);
    expect(playerPower(s, "PHANTASMAL")).toBeUndefined();
    expect(playerPower(s, "DOUBLE_DAMAGE")).toBe(1);
    s = play(s, "STRIKE_GREEN"); // 6*2 = 12, vs 5 block: 7 through
    expect(monsterHp(s)).toBe(194 - 7);
    s = endTurn(s);
    expect(playerPower(s, "DOUBLE_DAMAGE")).toBeUndefined();
    s = play(s, "STRIKE_GREEN"); // 6 vs 5 block: 1 through
    expect(monsterHp(s)).toBe(194 - 7 - 1);
  });

  test("upgraded costs 0", () => {
    let s = fight({ deck: [{ defId: "PHANTASMAL_KILLER", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "PHANTASMAL_KILLER");
    expect(energy(s)).toBe(3);
  });
});

describe("STORM_OF_STEEL", () => {
  test("discard hand (manual); gain a Shiv per discarded card; upgraded gives Shiv+", () => {
    let s = fight({ deck: ["STORM_OF_STEEL", ...strikes(4)] });
    s = play(s, "STORM_OF_STEEL");
    expect(handNames(s)).toEqual(["SHIV", "SHIV", "SHIV", "SHIV"]);
    expect(s.combat!.turnFlags.manualDiscardsThisTurn).toBe(4);
    s = play(s, "SHIV");
    expect(monsterHp(s)).toBe(196); // Shiv 4

    let u = fight({ deck: [{ defId: "STORM_OF_STEEL", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "STORM_OF_STEEL");
    expect(handNames(u).filter((n) => n === "SHIV").length).toBe(4);
    u = play(u, "SHIV");
    expect(monsterHp(u)).toBe(194); // Shiv+ 6
  });
});

describe("TOOLS_OF_THE_TRADE", () => {
  test("each turn: draw 1 then discard 1 chosen; upgraded costs 0", () => {
    let s = fightWithInHand(["TOOLS_OF_THE_TRADE"], { deck: ["TOOLS_OF_THE_TRADE", ...strikes(6)] });
    s = play(s, "TOOLS_OF_THE_TRADE");
    expect(energy(s)).toBe(2);
    expect(playerPower(s, "TOOLS_OF_THE_TRADE")).toBe(1);
    s = endTurn(s);
    // start of turn 2: drew 5 + 1, now a discard choice is pending
    expect(s.pending?.request.kind).toBe("cards");
    expect(handNames(s).length).toBe(6);
    s = choose(s, [0]);
    expect(handNames(s).length).toBe(5);
    expect(s.combat!.turnFlags.manualDiscardsThisTurn).toBe(1);

    let u = fightWithInHand(["TOOLS_OF_THE_TRADE"], {
      deck: [{ defId: "TOOLS_OF_THE_TRADE", upgrades: 1 }, ...strikes(6)],
    });
    u = play(u, "TOOLS_OF_THE_TRADE");
    expect(energy(u)).toBe(3);
  });
});

describe("UNLOAD", () => {
  test("14 (18) damage, then discard all non-Attacks in hand (manual)", () => {
    let s = fight({ deck: ["UNLOAD", "DEFLECT", "DEADLY_POISON", "STRIKE_GREEN", "STRIKE_GREEN"] });
    s = play(s, "UNLOAD");
    expect(monsterHp(s)).toBe(186);
    expect(handNames(s)).toEqual(["STRIKE_GREEN", "STRIKE_GREEN"]);
    expect(s.combat!.turnFlags.manualDiscardsThisTurn).toBe(2);

    let u = fight({ deck: [{ defId: "UNLOAD", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "UNLOAD");
    expect(monsterHp(u)).toBe(182);
    expect(handNames(u).length).toBe(4); // attacks stay
  });
});

describe("WRAITH_FORM", () => {
  test("2 (3) Intangible; lose 1 Dexterity at the end of each turn", () => {
    let s = fight({ deck: ["WRAITH_FORM", ...strikes(4)] });
    s = play(s, "WRAITH_FORM");
    expect(playerPower(s, "INTANGIBLE")).toBe(2);
    expect(playerPower(s, "WRAITH_FORM_POWER")).toBe(1);
    s = endTurn(s); // tank hits 10 -> 1
    expect(s.run.hp).toBe(69);
    expect(playerPower(s, "DEXTERITY")).toBe(-1);
    expect(playerPower(s, "INTANGIBLE")).toBe(1);
    s = endTurn(s); // still intangible this round
    expect(s.run.hp).toBe(68);
    expect(playerPower(s, "DEXTERITY")).toBe(-2);
    expect(playerPower(s, "INTANGIBLE")).toBeUndefined();
    s = endTurn(s); // expired: full 10
    expect(s.run.hp).toBe(58);

    let u = fight({ deck: [{ defId: "WRAITH_FORM", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "WRAITH_FORM");
    expect(playerPower(u, "INTANGIBLE")).toBe(3);
  });
});
