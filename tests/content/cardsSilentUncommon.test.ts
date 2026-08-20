// Behavior tests for the bespoke Silent uncommons (base AND upgraded).
// Numbers are corpus-exact. Player: 70 HP, 3 energy. T_TANK: 200 HP, hits 10.

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

describe("ALL_OUT_ATTACK", () => {
  test("10 (14) to ALL; discard 1 at random (manual)", () => {
    let s = fight({ deck: ["ALL_OUT_ATTACK", ...strikes(4)], monsters: ["T_TANK", "T_TANK"] });
    s = play(s, "ALL_OUT_ATTACK");
    expect(monsterHp(s, 0)).toBe(190);
    expect(monsterHp(s, 1)).toBe(190);
    expect(handNames(s).length).toBe(3);
    expect(s.combat!.turnFlags.manualDiscardsThisTurn).toBe(1);

    let u = fight({ deck: [{ defId: "ALL_OUT_ATTACK", upgrades: 1 }, ...strikes(4)], monsters: ["T_TANK", "T_TANK"] });
    u = play(u, "ALL_OUT_ATTACK");
    expect(monsterHp(u, 0)).toBe(186);
  });
});

describe("BACKSTAB", () => {
  test("innate, 11 (15) damage, exhausts", () => {
    let s = fight({ deck: ["BACKSTAB", ...strikes(9)] });
    expect(handNames(s)).toContain("BACKSTAB"); // innate: always in opening hand
    s = play(s, "BACKSTAB");
    expect(monsterHp(s)).toBe(189);
    expect(energy(s)).toBe(3); // 0 cost
    expect(pileNames(s, "exhaust")).toContain("BACKSTAB");

    let u = fight({ deck: [{ defId: "BACKSTAB", upgrades: 1 }, ...strikes(9)] });
    u = play(u, "BACKSTAB");
    expect(monsterHp(u)).toBe(185);
  });
});

describe("BLUR", () => {
  test("5 (8) block; block survives the start of next turn, then expires", () => {
    for (const [up, b] of [
      [0, 5],
      [1, 8],
    ] as const) {
      let s = fight({ deck: [{ defId: "BLUR", upgrades: up }, ...strikes(4)], monsters: ["T_GUARD"] });
      s = play(s, "BLUR");
      expect(block(s)).toBe(b);
      expect(playerPower(s, "BLUR")).toBe(1);
      s = endTurn(s);
      expect(block(s)).toBe(b); // retained
      expect(playerPower(s, "BLUR")).toBeUndefined(); // countdown consumed
      s = endTurn(s);
      expect(block(s)).toBe(0); // normal loss resumes
    }
  });
});

describe("BOUNCING_FLASK", () => {
  test("applies 3 poison to a random enemy 3 (4) times", () => {
    for (const [up, total] of [
      [0, 9],
      [1, 12],
    ] as const) {
      let s = fight({ deck: [{ defId: "BOUNCING_FLASK", upgrades: up }, ...strikes(4)], monsters: ["T_GUARD", "T_GUARD"] });
      s = play(s, "BOUNCING_FLASK");
      const p0 = monsterPower(s, "POISON", 0) ?? 0;
      const p1 = monsterPower(s, "POISON", 1) ?? 0;
      expect(p0 + p1).toBe(total);
      expect(p0 % 3).toBe(0);
      expect(p1 % 3).toBe(0);
    }
  });
});

describe("CALCULATED_GAMBLE", () => {
  test("base: discard hand (manual), draw that many; exhausts", () => {
    let s = fight({ deck: ["CALCULATED_GAMBLE", ...strikes(4)] });
    s = play(s, "CALCULATED_GAMBLE");
    expect(handNames(s).length).toBe(4); // 4 discarded, 4 redrawn
    expect(s.combat!.turnFlags.manualDiscardsThisTurn).toBe(4);
    expect(pileNames(s, "exhaust")).toContain("CALCULATED_GAMBLE");
  });

  test("upgraded: no exhaust", () => {
    let s = fight({ deck: [{ defId: "CALCULATED_GAMBLE", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "CALCULATED_GAMBLE");
    expect(pileNames(s, "discard")).toContain("CALCULATED_GAMBLE");
    expect(pileNames(s, "exhaust").length).toBe(0);
  });
});

describe("CALTROPS", () => {
  test("Thorns 3 (5): attacker takes damage back", () => {
    for (const [up, n] of [
      [0, 3],
      [1, 5],
    ] as const) {
      let s = fight({ deck: [{ defId: "CALTROPS", upgrades: up }, ...strikes(4)] });
      s = play(s, "CALTROPS");
      expect(playerPower(s, "THORNS")).toBe(n);
      s = endTurn(s);
      expect(monsterHp(s)).toBe(200 - n);
    }
  });
});

describe("CATALYST", () => {
  test("doubles (triples) the target's poison; nothing without poison; exhausts", () => {
    let s = fight({ deck: ["CATALYST", "DEADLY_POISON", ...strikes(3)] });
    s = play(s, "DEADLY_POISON");
    s = play(s, "CATALYST");
    expect(monsterPower(s, "POISON")).toBe(10);
    expect(pileNames(s, "exhaust")).toContain("CATALYST");

    let u = fight({ deck: [{ defId: "CATALYST", upgrades: 1 }, "DEADLY_POISON", ...strikes(3)] });
    u = play(u, "DEADLY_POISON");
    u = play(u, "CATALYST");
    expect(monsterPower(u, "POISON")).toBe(15);

    let t = fight({ deck: ["CATALYST", ...strikes(4)] });
    t = play(t, "CATALYST");
    expect(monsterPower(t, "POISON")).toBeUndefined();
  });
});

describe("CHOKE / CHOKED", () => {
  test("12 damage; each card played this turn makes the enemy lose 3 (5) HP; expires at end of turn", () => {
    for (const [up, n] of [
      [0, 3],
      [1, 5],
    ] as const) {
      let s = fight({ deck: [{ defId: "CHOKE", upgrades: up }, ...strikes(4)] });
      s = play(s, "CHOKE");
      expect(monsterHp(s)).toBe(188);
      expect(monsterPower(s, "CHOKED")).toBe(n);
      s = play(s, "STRIKE_GREEN");
      expect(monsterHp(s)).toBe(188 - 6 - n);
      s = endTurn(s);
      expect(monsterPower(s, "CHOKED")).toBeUndefined();
      s = play(s, "STRIKE_GREEN");
      expect(monsterHp(s)).toBe(188 - 6 - n - 6); // no more choke loss
    }
  });
});

describe("CONCENTRATE", () => {
  test("discard 3 (2) chosen, gain 2 energy", () => {
    let s = fight({ deck: ["CONCENTRATE", ...strikes(4)] });
    s = play(s, "CONCENTRATE");
    const req = s.pending!.request;
    expect(req.kind === "cards" && req.min === 3 && req.max === 3).toBe(true);
    s = choose(s, [0, 1, 2]);
    expect(energy(s)).toBe(5);
    expect(handNames(s).length).toBe(1);

    let u = fight({ deck: [{ defId: "CONCENTRATE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "CONCENTRATE");
    u = choose(u, [0, 1]);
    expect(energy(u)).toBe(5);
    expect(handNames(u).length).toBe(2);
  });
});

describe("CRIPPLING_CLOUD", () => {
  test("4 (7) poison + 2 weak to ALL; exhausts", () => {
    for (const [up, n] of [
      [0, 4],
      [1, 7],
    ] as const) {
      let s = fight({ deck: [{ defId: "CRIPPLING_CLOUD", upgrades: up }, ...strikes(4)], monsters: ["T_GUARD", "T_GUARD"] });
      s = play(s, "CRIPPLING_CLOUD");
      for (const i of [0, 1]) {
        expect(monsterPower(s, "POISON", i)).toBe(n);
        expect(monsterPower(s, "WEAK", i)).toBe(2);
      }
      expect(pileNames(s, "exhaust")).toContain("CRIPPLING_CLOUD");
    }
  });
});

describe("DASH", () => {
  test("10 (13) block and 10 (13) damage", () => {
    for (const [up, n] of [
      [0, 10],
      [1, 13],
    ] as const) {
      let s = fight({ deck: [{ defId: "DASH", upgrades: up }, ...strikes(4)] });
      s = play(s, "DASH");
      expect(block(s)).toBe(n);
      expect(monsterHp(s)).toBe(200 - n);
    }
  });
});

describe("DISTRACTION", () => {
  test("adds a random Skill costing 0 this turn; exhausts; upgraded costs 0", () => {
    let s = fight({ deck: ["DISTRACTION", ...strikes(4)] });
    s = play(s, "DISTRACTION");
    expect(handNames(s).length).toBe(5); // 4 + generated skill
    const combat = s.combat!;
    const added = combat.player.piles.hand
      .map((iid) => combat.cards[iid]!)
      .find((c) => c.defId !== "STRIKE_GREEN")!;
    expect(added).toBeDefined();
    expect(added.costForTurn).toBe(0);
    expect(pileNames(s, "exhaust")).toContain("DISTRACTION");
    expect(energy(s)).toBe(2);

    let u = fight({ deck: [{ defId: "DISTRACTION", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "DISTRACTION");
    expect(energy(u)).toBe(3); // upgraded costs 0
  });
});

describe("ENDLESS_AGONY", () => {
  test("adds a copy of itself when drawn; 4 (6) damage; exhausts", () => {
    let s = fightWithInHand(["ENDLESS_AGONY"], { deck: ["ENDLESS_AGONY", ...strikes(9)] });
    expect(handNames(s).filter((n) => n === "ENDLESS_AGONY").length).toBe(2); // original + copy
    expect(handNames(s).length).toBe(6);
    s = play(s, "ENDLESS_AGONY");
    expect(monsterHp(s)).toBe(196);
    expect(pileNames(s, "exhaust")).toContain("ENDLESS_AGONY");

    let u = fightWithInHand(["ENDLESS_AGONY"], { deck: [{ defId: "ENDLESS_AGONY", upgrades: 1 }, ...strikes(9)] });
    u = play(u, "ENDLESS_AGONY");
    expect(monsterHp(u)).toBe(194);
  });
});

describe("ESCAPE_PLAN", () => {
  const findFight = (deck: Parameters<typeof fight>[0]["deck"], notInHand: string) => {
    for (const seed of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"]) {
      const s = fight({ deck, seed });
      const names = handNames(s);
      if (names.includes("ESCAPE_PLAN") && !names.includes(notInHand)) return s;
    }
    throw new Error("no seed found");
  };

  test("draws 1; gains 3 (5) block if the drawn card is a Skill", () => {
    // draw pile holds exactly DEFLECT (a skill)
    let s = findFight(["ESCAPE_PLAN", "DEFLECT", ...strikes(4)], "DEFLECT");
    s = play(s, "ESCAPE_PLAN");
    expect(handNames(s)).toContain("DEFLECT");
    expect(block(s)).toBe(3);
  });

  test("no block when the drawn card is an Attack", () => {
    let s = findFight(["ESCAPE_PLAN", "SLICE", ...strikes(4)], "SLICE");
    s = play(s, "ESCAPE_PLAN");
    expect(handNames(s)).toContain("SLICE");
    expect(block(s)).toBe(0);
  });

  test("upgraded: 5 block", () => {
    let s = findFight([{ defId: "ESCAPE_PLAN", upgrades: 1 }, "DEFLECT", ...strikes(4)], "DEFLECT");
    s = play(s, "ESCAPE_PLAN");
    expect(block(s)).toBe(5);
  });
});

describe("EVISCERATE", () => {
  test("7 (9) x3; costs 1 less per manual discard this turn (floor 0)", () => {
    let s = fight({ deck: ["EVISCERATE", "PREPARED", ...strikes(3)] });
    s = play(s, "EVISCERATE"); // full cost 3
    expect(energy(s)).toBe(0);
    expect(monsterHp(s)).toBe(179);

    let t = fight({ deck: ["EVISCERATE", "PREPARED", ...strikes(3)] });
    t = play(t, "PREPARED"); // draw fizzles (empty piles); discard 1 chosen
    t = choose(t, [0]);
    t = play(t, "EVISCERATE"); // cost 3 - 1 = 2
    expect(energy(t)).toBe(1);

    let u = fight({ deck: [{ defId: "EVISCERATE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "EVISCERATE");
    expect(monsterHp(u)).toBe(173); // 9 x3
  });

  test("floor 0 after 3+ discards", () => {
    let s = fight({ deck: ["EVISCERATE", "CALCULATED_GAMBLE", ...strikes(3)] });
    s = play(s, "CALCULATED_GAMBLE"); // discards 4 manually, redraws 4
    expect(s.combat!.turnFlags.manualDiscardsThisTurn).toBe(4);
    s = play(s, "EVISCERATE");
    expect(energy(s)).toBe(3); // cost 0
  });
});

describe("EXPERTISE", () => {
  test("draw until 6 (7) cards in hand", () => {
    let s = fightWithInHand(["EXPERTISE"], { deck: ["EXPERTISE", ...strikes(9)] });
    s = play(s, "EXPERTISE");
    expect(handNames(s).length).toBe(6);

    let u = fightWithInHand(["EXPERTISE"], { deck: [{ defId: "EXPERTISE", upgrades: 1 }, ...strikes(9)] });
    u = play(u, "EXPERTISE");
    expect(handNames(u).length).toBe(7);
  });
});

describe("FINISHER", () => {
  test("one 6 (8) hit per Attack played this turn — counts itself", () => {
    let s = fight({ deck: ["FINISHER", "SLICE", "SLICE", ...strikes(2)] });
    s = play(s, "SLICE");
    s = play(s, "SLICE");
    s = play(s, "FINISHER"); // 3 attacks played
    expect(monsterHp(s)).toBe(200 - 6 - 6 - 18);

    let t = fight({ deck: ["FINISHER", ...strikes(4)] });
    t = play(t, "FINISHER"); // alone: 1 hit
    expect(monsterHp(t)).toBe(194);

    let u = fight({ deck: [{ defId: "FINISHER", upgrades: 1 }, "SLICE", ...strikes(3)] });
    u = play(u, "SLICE");
    u = play(u, "FINISHER"); // 2 attacks: 8 x2
    expect(monsterHp(u)).toBe(200 - 6 - 16);
  });
});

describe("FLECHETTES", () => {
  test("one 4 (6) hit per Skill in hand", () => {
    let s = fight({ deck: ["FLECHETTES", "DEFLECT", "DEFLECT", "DEADLY_POISON", "STRIKE_GREEN"] });
    s = play(s, "FLECHETTES"); // 3 skills in hand
    expect(monsterHp(s)).toBe(188);

    let u = fight({ deck: [{ defId: "FLECHETTES", upgrades: 1 }, "DEFLECT", "DEFLECT", "DEADLY_POISON", "STRIKE_GREEN"] });
    u = play(u, "FLECHETTES");
    expect(monsterHp(u)).toBe(182);

    let t = fight({ deck: ["FLECHETTES", ...strikes(4)] });
    t = play(t, "FLECHETTES"); // no skills: 0 hits
    expect(monsterHp(t)).toBe(200);
  });
});

describe("FOOTWORK", () => {
  test("2 (3) Dexterity", () => {
    for (const [up, n] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fight({ deck: [{ defId: "FOOTWORK", upgrades: up }, "DEFEND_GREEN", ...strikes(3)] });
      s = play(s, "FOOTWORK");
      expect(playerPower(s, "DEXTERITY")).toBe(n);
      s = play(s, "DEFEND_GREEN");
      expect(block(s)).toBe(5 + n);
    }
  });
});

describe("HEEL_HOOK", () => {
  test("5 (8) damage; vs a Weak enemy also +1 energy and draw 1", () => {
    let s = fight({ deck: ["HEEL_HOOK", "NEUTRALIZE", ...strikes(3)] });
    s = play(s, "HEEL_HOOK");
    expect(monsterHp(s)).toBe(195);
    expect(energy(s)).toBe(2); // no bonus

    let t = fight({ deck: ["HEEL_HOOK", "NEUTRALIZE", ...strikes(3)] });
    t = play(t, "NEUTRALIZE"); // applies Weak
    t = play(t, "HEEL_HOOK");
    expect(energy(t)).toBe(3); // 3 - 1 + 1

    let u = fight({ deck: [{ defId: "HEEL_HOOK", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "HEEL_HOOK");
    expect(monsterHp(u)).toBe(192);
  });
});

describe("INFINITE_BLADES", () => {
  test("adds a Shiv at the start of each turn; innate only when upgraded", () => {
    const up = fight({ deck: [{ defId: "INFINITE_BLADES", upgrades: 1 }, ...strikes(9)], seed: "IBINNATE" });
    expect(handNames(up)).toContain("INFINITE_BLADES"); // Infinite Blades+ is Innate
    let s = fight({ deck: ["INFINITE_BLADES", ...strikes(4)] });
    while (!handNames(s).includes("INFINITE_BLADES")) s = endTurn(s);
    s = play(s, "INFINITE_BLADES");
    expect(playerPower(s, "INFINITE_BLADES")).toBe(1);
    s = endTurn(s);
    expect(handNames(s).filter((n) => n === "SHIV").length).toBe(1);
    expect(handNames(s).length).toBe(5); // 4 strikes redrawn + 1 Shiv (the power left the deck)
  });
});

describe("LEG_SWEEP", () => {
  test("2 (3) Weak and 11 (14) block", () => {
    for (const [up, w, b] of [
      [0, 2, 11],
      [1, 3, 14],
    ] as const) {
      let s = fight({ deck: [{ defId: "LEG_SWEEP", upgrades: up }, ...strikes(4)] });
      s = play(s, "LEG_SWEEP");
      expect(monsterPower(s, "WEAK")).toBe(w);
      expect(block(s)).toBe(b);
    }
  });
});

describe("MASTERFUL_STAB", () => {
  test("12 (16) damage; costs +1 per HP-loss INSTANCE this combat", () => {
    let s = fight({ deck: ["MASTERFUL_STAB", ...strikes(4)] });
    s = play(s, "MASTERFUL_STAB"); // no HP lost yet: cost 0
    expect(energy(s)).toBe(3);
    expect(monsterHp(s)).toBe(188);

    let t = fight({ deck: ["MASTERFUL_STAB", ...strikes(4)] });
    t = endTurn(t); // tank hits once: 1 instance
    t = play(t, "MASTERFUL_STAB"); // cost 1
    expect(energy(t)).toBe(2);

    let v = fight({ deck: ["MASTERFUL_STAB", ...strikes(4)] });
    v = endTurn(v);
    v = endTurn(v); // 2 instances (amounts don't matter, events do)
    v = play(v, "MASTERFUL_STAB"); // cost 2
    expect(energy(v)).toBe(1);

    let u = fight({ deck: [{ defId: "MASTERFUL_STAB", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "MASTERFUL_STAB");
    expect(monsterHp(u)).toBe(184);
  });
});

describe("NOXIOUS_FUMES", () => {
  test("applies 2 (3) poison to ALL enemies at the start of each turn", () => {
    for (const [up, n] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fight({ deck: [{ defId: "NOXIOUS_FUMES", upgrades: up }, ...strikes(4)], monsters: ["T_GUARD", "T_GUARD"] });
      s = play(s, "NOXIOUS_FUMES");
      expect(monsterPower(s, "POISON", 0)).toBeUndefined(); // not on the cast turn
      s = endTurn(s);
      expect(monsterPower(s, "POISON", 0)).toBe(n); // applied at turn start (no tick yet)
      expect(monsterPower(s, "POISON", 1)).toBe(n);
      s = endTurn(s);
      // ticked n during the monster turn (-1 stack), then re-applied n
      expect(monsterHp(s, 0)).toBe(200 - n);
      expect(monsterPower(s, "POISON", 0)).toBe(n - 1 + n);
    }
  });
});

describe("PREDATOR", () => {
  test("15 (20) damage; draw 2 additional cards next turn", () => {
    let s = fightWithInHand(["PREDATOR"], { deck: ["PREDATOR", ...strikes(9)] });
    s = play(s, "PREDATOR");
    expect(monsterHp(s)).toBe(185);
    expect(playerPower(s, "DRAW_CARD_NEXT_TURN")).toBe(2);
    s = endTurn(s);
    expect(handNames(s).length).toBe(7);
    expect(playerPower(s, "DRAW_CARD_NEXT_TURN")).toBeUndefined();

    let u = fightWithInHand(["PREDATOR"], { deck: [{ defId: "PREDATOR", upgrades: 1 }, ...strikes(9)] });
    u = play(u, "PREDATOR");
    expect(monsterHp(u)).toBe(180);
  });
});

describe("REFLEX / TACTICIAN (manual-discard self-triggers)", () => {
  test("both are unplayable", () => {
    const s = fight({ deck: ["REFLEX", "TACTICIAN", ...strikes(3)] });
    expect(() => play(s, "REFLEX")).toThrow("unplayable");
    expect(() => play(s, "TACTICIAN")).toThrow("unplayable");
  });

  test("Reflex: draws 2 (3) when manually discarded", () => {
    let s = fightWithInHand(["SURVIVOR", "REFLEX"], { deck: ["SURVIVOR", "REFLEX", ...strikes(8)] });
    s = play(s, "SURVIVOR");
    s = choose(s, [choiceIndexOf(s, "REFLEX")]);
    expect(handNames(s).length).toBe(5); // 4 - reflex + 2 drawn
  });

  test("Reflex does NOT trigger on the end-of-turn discard", () => {
    let s = fightWithInHand(["REFLEX"], { deck: ["REFLEX", ...strikes(9)] });
    const before = s.combat!.player.piles.draw.length;
    s = endTurn(s);
    // next turn draws exactly 5 — no bonus draws happened at end of turn
    expect(handNames(s).length).toBe(5);
    expect(before).toBeGreaterThanOrEqual(0);
  });

  test("Tactician: +1 (+2) energy when manually discarded", () => {
    for (const [up, e] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fightWithInHand(["SURVIVOR", "TACTICIAN"], {
        deck: ["SURVIVOR", { defId: "TACTICIAN", upgrades: up }, ...strikes(8)],
      });
      s = play(s, "SURVIVOR");
      s = choose(s, [choiceIndexOf(s, "TACTICIAN")]);
      expect(energy(s)).toBe(3 - 1 + e);
    }
  });
});

describe("RIDDLE_WITH_HOLES", () => {
  test("3 (4) damage 5 times", () => {
    let s = fight({ deck: ["RIDDLE_WITH_HOLES", ...strikes(4)] });
    s = play(s, "RIDDLE_WITH_HOLES");
    expect(monsterHp(s)).toBe(185);

    let u = fight({ deck: [{ defId: "RIDDLE_WITH_HOLES", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "RIDDLE_WITH_HOLES");
    expect(monsterHp(u)).toBe(180);
  });
});

describe("SETUP", () => {
  test("puts a chosen card on top of the draw pile; it costs 0 until played", () => {
    let s = fight({ deck: ["SETUP", "DASH", ...strikes(3)] });
    s = play(s, "SETUP");
    expect(energy(s)).toBe(2);
    s = choose(s, [choiceIndexOf(s, "DASH")]);
    const combat = s.combat!;
    expect(combat.cards[combat.player.piles.draw[0]!]!.defId).toBe("DASH");
    expect(combat.cards[combat.player.piles.draw[0]!]!.freeToPlayOnce).toBe(true);
    s = endTurn(s);
    expect(handNames(s)).toContain("DASH"); // drawn first from the top
    s = play(s, "DASH");
    expect(energy(s)).toBe(3); // played for free
    expect(block(s)).toBe(10);
    expect(monsterHp(s)).toBe(190);
  });

  test("upgraded costs 0", () => {
    let s = fight({ deck: [{ defId: "SETUP", upgrades: 1 }, "DASH", ...strikes(3)] });
    s = play(s, "SETUP");
    expect(energy(s)).toBe(3);
    s = choose(s, [choiceIndexOf(s, "DASH")]);
  });
});

describe("SKEWER", () => {
  test("X-cost: 7 (10) damage X times, spending all energy", () => {
    let s = fight({ deck: ["SKEWER", ...strikes(4)] });
    s = play(s, "SKEWER"); // X = 3
    expect(monsterHp(s)).toBe(179);
    expect(energy(s)).toBe(0);

    let t = fight({ deck: ["SKEWER", ...strikes(4)] });
    t = play(t, "STRIKE_GREEN");
    t = play(t, "STRIKE_GREEN");
    t = play(t, "STRIKE_GREEN"); // energy 0
    t = play(t, "SKEWER"); // X = 0: no hits
    expect(monsterHp(t)).toBe(182);

    let u = fight({ deck: [{ defId: "SKEWER", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "SKEWER");
    expect(monsterHp(u)).toBe(170); // 10 x3
  });
});

describe("TERROR", () => {
  test("applies 99 Vulnerable; exhausts (base AND upgraded); upgraded costs 0", () => {
    let s = fight({ deck: ["TERROR", ...strikes(4)] });
    s = play(s, "TERROR");
    expect(monsterPower(s, "VULNERABLE")).toBe(99);
    expect(pileNames(s, "exhaust")).toContain("TERROR");
    s = play(s, "STRIKE_GREEN");
    expect(monsterHp(s)).toBe(191); // 6 * 1.5 = 9

    let u = fight({ deck: [{ defId: "TERROR", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "TERROR");
    expect(energy(u)).toBe(3);
    expect(pileNames(u, "exhaust")).toContain("TERROR");
  });
});
