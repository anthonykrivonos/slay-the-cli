// Watcher commons - behavior tests (base AND upgraded where values differ).

import { test, expect, describe } from "bun:test";
import {
  fight,
  fightWithInHand,
  play,
  endTurn,
  choose,
  stance,
  energy,
  block,
  mantra,
  instOf,
  strikes,
  defends,
  monsterHp,
  monsterPower,
  handNames,
  pileNames,
} from "./watcherTestKit";

describe("BOWLING_BASH", () => {
  test("one hit per living enemy, all at the target", () => {
    let s = fight({ deck: ["BOWLING_BASH", ...strikes(4)], monsters: ["T_WTANK", "T_WGUARD"] });
    s = play(s, "BOWLING_BASH", 0);
    expect(monsterHp(s, 0)).toBe(200 - 14); // 7 x 2 enemies
    expect(monsterHp(s, 1)).toBe(200);
  });

  test("single enemy: one hit; upgraded 10", () => {
    let s = fight({ deck: [{ defId: "BOWLING_BASH", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "BOWLING_BASH");
    expect(monsterHp(s)).toBe(200 - 10);
  });
});

describe("CONSECRATE", () => {
  test("5 (8 upgraded) to ALL enemies for 0 energy", () => {
    let s = fight({ deck: ["CONSECRATE", ...strikes(4)], monsters: ["T_WTANK", "T_WGUARD"] });
    s = play(s, "CONSECRATE");
    expect(energy(s)).toBe(3);
    expect(monsterHp(s, 0)).toBe(195);
    expect(monsterHp(s, 1)).toBe(195);

    let u = fight({ deck: [{ defId: "CONSECRATE", upgrades: 1 }, ...strikes(4)], monsters: ["T_WTANK", "T_WGUARD"] });
    u = play(u, "CONSECRATE");
    expect(monsterHp(u, 0)).toBe(192);
  });
});

describe("CRESCENDO / TRANQUILITY", () => {
  test("Crescendo: retained, enters Wrath, exhausts; upgraded costs 0", () => {
    let s = fight({ deck: ["CRESCENDO", ...strikes(4)] });
    s = endTurn(s); // retained
    expect(handNames(s)).toContain("CRESCENDO");
    s = play(s, "CRESCENDO");
    expect(stance(s)).toBe("WRATH");
    expect(pileNames(s, "exhaust")).toEqual(["CRESCENDO"]);

    let u = fight({ deck: [{ defId: "CRESCENDO", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "CRESCENDO");
    expect(energy(u)).toBe(3);
  });

  test("Tranquility: enters Calm, exhausts", () => {
    let s = fight({ deck: ["TRANQUILITY", ...strikes(4)] });
    s = play(s, "TRANQUILITY");
    expect(stance(s)).toBe("CALM");
    expect(pileNames(s, "exhaust")).toEqual(["TRANQUILITY"]);
    expect(energy(s)).toBe(2);
  });
});

describe("CRUSH_JOINTS", () => {
  test("vulnerable only if the last card played was a Skill", () => {
    let s = fight({ deck: ["CRUSH_JOINTS", "DEFEND_PURPLE", ...strikes(3)] });
    s = play(s, "CRUSH_JOINTS"); // no previous card
    expect(monsterPower(s, "VULNERABLE")).toBeUndefined();
    expect(monsterHp(s)).toBe(200 - 8);

    let t = fight({ deck: ["CRUSH_JOINTS", "DEFEND_PURPLE", ...strikes(3)] });
    t = play(t, "DEFEND_PURPLE");
    t = play(t, "CRUSH_JOINTS");
    expect(monsterPower(t, "VULNERABLE")).toBe(1);
  });

  test("upgraded: 10 damage, 2 vulnerable", () => {
    let s = fight({ deck: [{ defId: "CRUSH_JOINTS", upgrades: 1 }, "DEFEND_PURPLE", ...strikes(3)] });
    s = play(s, "DEFEND_PURPLE");
    s = play(s, "CRUSH_JOINTS");
    expect(monsterHp(s)).toBe(200 - 10);
    expect(monsterPower(s, "VULNERABLE")).toBe(2);
  });
});

describe("CUT_THROUGH_FATE", () => {
  test("deal 7, scry 2, draw 1 (in that order)", () => {
    let s = fightWithInHand(["CUT_THROUGH_FATE"], { deck: ["CUT_THROUGH_FATE", ...strikes(4), ...defends(3)] });
    const drawBefore = s.combat!.player.piles.draw.length;
    s = play(s, "CUT_THROUGH_FATE");
    expect(monsterHp(s)).toBe(200 - 7);
    expect(s.pending?.request.kind).toBe("scry");
    const offered = (s.pending!.request as { iids: number[] }).iids.length;
    expect(offered).toBe(Math.min(2, drawBefore));
    s = choose(s, [0]); // discard the first scryed card, then draw 1
    expect(handNames(s).length).toBe(5); // 5 - played + drawn
  });

  test("upgraded scries 3", () => {
    let s = fightWithInHand(["CUT_THROUGH_FATE"], {
      deck: [{ defId: "CUT_THROUGH_FATE", upgrades: 1 }, ...strikes(4), ...defends(4)],
    });
    s = play(s, "CUT_THROUGH_FATE");
    expect(monsterHp(s)).toBe(200 - 9);
    expect((s.pending!.request as { iids: number[] }).iids.length).toBe(3);
    s = choose(s, []);
  });
});

describe("EMPTY_BODY / EMPTY_FIST / EMPTY_MIND", () => {
  test("Empty Body: block + exit stance", () => {
    let s = fight({ deck: ["VIGILANCE", "EMPTY_BODY", ...strikes(3)] });
    s = play(s, "VIGILANCE");
    s = play(s, "EMPTY_BODY");
    expect(stance(s)).toBe("NEUTRAL");
    expect(block(s)).toBe(8 + 7);
  });

  test("Empty Fist: 9 (14 upgraded) + exit stance", () => {
    let s = fight({ deck: ["ERUPTION", "EMPTY_FIST", ...strikes(3)] });
    s = play(s, "ERUPTION"); // Wrath
    s = play(s, "EMPTY_FIST"); // doubled while still in Wrath, then exit
    expect(monsterHp(s)).toBe(200 - 9 - 18);
    expect(stance(s)).toBe("NEUTRAL");
  });

  test("Empty Mind: exit stance then draw 2 (3 upgraded); Calm exit refunds", () => {
    let s = fightWithInHand(["VIGILANCE", "EMPTY_MIND"], { deck: ["VIGILANCE", "EMPTY_MIND", ...strikes(6)] });
    s = play(s, "VIGILANCE"); // Calm, energy 1
    const handBefore = handNames(s).length;
    s = play(s, "EMPTY_MIND"); // pay 1 -> 0, Calm exit +2
    expect(stance(s)).toBe("NEUTRAL");
    expect(energy(s)).toBe(2);
    expect(handNames(s).length).toBe(handBefore - 1 + 2);
  });
});

describe("EVALUATE", () => {
  test("block 6 (10 upgraded) + shuffle an Insight into the draw pile", () => {
    let s = fight({ deck: ["EVALUATE", ...strikes(4)] });
    s = play(s, "EVALUATE");
    expect(block(s)).toBe(6);
    expect(pileNames(s, "draw")).toContain("INSIGHT");

    let u = fight({ deck: [{ defId: "EVALUATE", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "EVALUATE");
    expect(block(u)).toBe(10);
  });
});

describe("FLURRY_OF_BLOWS", () => {
  test("returns from the discard pile to the hand on stance change", () => {
    let s = fight({ deck: ["FLURRY_OF_BLOWS", "CRESCENDO", ...strikes(3)] });
    s = play(s, "FLURRY_OF_BLOWS");
    expect(monsterHp(s)).toBe(200 - 4);
    expect(pileNames(s, "discard")).toContain("FLURRY_OF_BLOWS");
    s = play(s, "CRESCENDO"); // enter Wrath
    expect(pileNames(s, "discard")).not.toContain("FLURRY_OF_BLOWS");
    expect(handNames(s)).toContain("FLURRY_OF_BLOWS");
    // and it can be replayed, now Wrath-doubled (6 upgraded would be 12)
    s = play(s, "FLURRY_OF_BLOWS");
    expect(monsterHp(s)).toBe(200 - 4 - 8);
  });

  test("upgraded deals 6", () => {
    let s = fight({ deck: [{ defId: "FLURRY_OF_BLOWS", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "FLURRY_OF_BLOWS");
    expect(monsterHp(s)).toBe(200 - 6);
  });
});

describe("FLYING_SLEEVES", () => {
  test("retained; deals 4x2 (6x2 upgraded)", () => {
    let s = fight({ deck: ["FLYING_SLEEVES", ...strikes(4)] });
    s = endTurn(s);
    expect(handNames(s)).toContain("FLYING_SLEEVES");
    s = play(s, "FLYING_SLEEVES");
    expect(monsterHp(s)).toBe(200 - 8);

    let u = fight({ deck: [{ defId: "FLYING_SLEEVES", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "FLYING_SLEEVES");
    expect(monsterHp(u)).toBe(200 - 12);
  });
});

describe("FOLLOW_UP", () => {
  test("refunds 1 energy only after an Attack", () => {
    let s = fight({ deck: ["FOLLOW_UP", "STRIKE_PURPLE", "DEFEND_PURPLE", ...strikes(2)] });
    s = play(s, "STRIKE_PURPLE");
    s = play(s, "FOLLOW_UP");
    expect(monsterHp(s)).toBe(200 - 6 - 7);
    expect(energy(s)).toBe(3 - 1 - 1 + 1);

    let t = fight({ deck: ["FOLLOW_UP", "STRIKE_PURPLE", "DEFEND_PURPLE", ...strikes(2)] });
    t = play(t, "DEFEND_PURPLE");
    t = play(t, "FOLLOW_UP");
    expect(energy(t)).toBe(1);
  });

  test("upgraded deals 11", () => {
    let s = fight({ deck: [{ defId: "FOLLOW_UP", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "FOLLOW_UP");
    expect(monsterHp(s)).toBe(200 - 11);
  });
});

describe("HALT", () => {
  test("3 block out of Wrath; upgraded 4/+14 in Wrath", () => {
    let s = fight({ deck: ["HALT", ...strikes(4)] });
    s = play(s, "HALT");
    expect(block(s)).toBe(3);

    let u = fight({ deck: [{ defId: "HALT", upgrades: 1 }, "CRESCENDO", ...strikes(3)] });
    u = play(u, "CRESCENDO");
    u = play(u, "HALT");
    expect(block(u)).toBe(18);
  });

  test("in Wrath: 12 total (base)", () => {
    let s = fight({ deck: ["HALT", "CRESCENDO", ...strikes(3)] });
    s = play(s, "CRESCENDO");
    s = play(s, "HALT");
    expect(block(s)).toBe(12);
  });
});

describe("JUST_LUCKY", () => {
  test("scry 1, gain 2 block, deal 3 - for 0 energy", () => {
    let s = fightWithInHand(["JUST_LUCKY"], { deck: ["JUST_LUCKY", ...strikes(4), ...defends(2)] });
    s = play(s, "JUST_LUCKY");
    expect(s.pending?.request.kind).toBe("scry");
    expect((s.pending!.request as { iids: number[] }).iids.length).toBe(1);
    s = choose(s, []);
    expect(block(s)).toBe(2);
    expect(monsterHp(s)).toBe(200 - 3);
    expect(energy(s)).toBe(3);
  });

  test("upgraded: scry 2, block 3, damage 4", () => {
    let s = fightWithInHand(["JUST_LUCKY"], {
      deck: [{ defId: "JUST_LUCKY", upgrades: 1 }, ...strikes(4), ...defends(2)],
    });
    s = play(s, "JUST_LUCKY");
    expect((s.pending!.request as { iids: number[] }).iids.length).toBe(2);
    s = choose(s, [0, 1]);
    expect(block(s)).toBe(3);
    expect(monsterHp(s)).toBe(200 - 4);
  });

  test("empty draw pile: scry fizzles, block+damage still resolve", () => {
    let s = fight({ deck: ["JUST_LUCKY", ...strikes(4)] }); // 5-card deck: draw is empty
    s = play(s, "JUST_LUCKY");
    expect(s.pending).toBeNull();
    expect(block(s)).toBe(2);
    expect(monsterHp(s)).toBe(200 - 3);
  });
});

describe("PRESSURE_POINTS", () => {
  test("applies Mark and ALL enemies lose HP equal to their Mark", () => {
    let s = fight({ deck: ["PRESSURE_POINTS", ...strikes(4)], monsters: ["T_WTANK", "T_WGUARD"] });
    s = play(s, "PRESSURE_POINTS", 0);
    expect(monsterPower(s, "MARK", 0)).toBe(8);
    expect(monsterHp(s, 0)).toBe(200 - 8);
    expect(monsterHp(s, 1)).toBe(200); // no mark, no loss
    s = endTurn(s);
    s = play(s, "PRESSURE_POINTS", 0); // stacks: 16 now
    expect(monsterPower(s, "MARK", 0)).toBe(16);
    expect(monsterHp(s, 0)).toBe(200 - 8 - 16);
  });

  test("upgraded applies 11; Mark HP loss ignores block", () => {
    let s = fight({ deck: [{ defId: "PRESSURE_POINTS", upgrades: 1 }, ...strikes(4)], monsters: ["T_WGUARD"] });
    s = endTurn(s); // guard now has 5 block
    s = play(s, "PRESSURE_POINTS", 0);
    expect(monsterHp(s)).toBe(200 - 11);
    expect(s.combat!.monsters[0]!.block).toBe(5); // untouched
  });
});

describe("PROSTRATE", () => {
  test("2 (3 upgraded) mantra + 4 block for 0 energy", () => {
    let s = fight({ deck: ["PROSTRATE", { defId: "PROSTRATE", upgrades: 1 }, ...strikes(3)] });
    const idx = handNames(s).indexOf("PROSTRATE");
    s = play(s, "PROSTRATE");
    s = play(s, "PROSTRATE");
    expect(mantra(s)).toBe(5);
    expect(block(s)).toBe(8);
    expect(energy(s)).toBe(3);
  });
});

describe("PROTECT", () => {
  test("retained; 12 (16 upgraded) block", () => {
    let s = fight({ deck: ["PROTECT", ...strikes(4)] });
    s = endTurn(s);
    expect(handNames(s)).toContain("PROTECT");
    s = play(s, "PROTECT");
    expect(block(s)).toBe(12);

    let u = fight({ deck: [{ defId: "PROTECT", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "PROTECT");
    expect(block(u)).toBe(16);
  });
});

describe("SASH_WHIP", () => {
  test("weak only if the last card played was an Attack", () => {
    let s = fight({ deck: ["SASH_WHIP", "STRIKE_PURPLE", "DEFEND_PURPLE", ...strikes(2)] });
    s = play(s, "DEFEND_PURPLE");
    s = play(s, "SASH_WHIP");
    expect(monsterPower(s, "WEAK")).toBeUndefined();

    let t = fight({ deck: ["SASH_WHIP", "STRIKE_PURPLE", "DEFEND_PURPLE", ...strikes(2)] });
    t = play(t, "STRIKE_PURPLE");
    t = play(t, "SASH_WHIP");
    expect(monsterHp(t)).toBe(200 - 6 - 8);
    expect(monsterPower(t, "WEAK")).toBe(1);
  });

  test("upgraded: 10 damage, 2 weak", () => {
    let s = fight({ deck: [{ defId: "SASH_WHIP", upgrades: 1 }, "STRIKE_PURPLE", ...strikes(3)] });
    s = play(s, "STRIKE_PURPLE");
    s = play(s, "SASH_WHIP");
    expect(monsterHp(s)).toBe(200 - 6 - 10);
    expect(monsterPower(s, "WEAK")).toBe(2);
  });
});

describe("THIRD_EYE", () => {
  test("block 7 + scry 3 (9/5 upgraded)", () => {
    let s = fightWithInHand(["THIRD_EYE"], { deck: ["THIRD_EYE", ...strikes(4), ...defends(4)] });
    s = play(s, "THIRD_EYE");
    expect(block(s)).toBe(7);
    expect(s.pending?.request.kind).toBe("scry");
    expect((s.pending!.request as { iids: number[] }).iids.length).toBe(3);
    const discardBefore = pileNames(s, "discard").length;
    s = choose(s, [0, 2]);
    // +2 scryed discards, +1 for Third Eye itself landing after the resume
    expect(pileNames(s, "discard").length).toBe(discardBefore + 3);
  });

  test("upgraded scries 5", () => {
    let s = fightWithInHand(["THIRD_EYE"], {
      deck: [{ defId: "THIRD_EYE", upgrades: 1 }, ...strikes(4), ...defends(5)],
    });
    s = play(s, "THIRD_EYE");
    expect(block(s)).toBe(9);
    expect((s.pending!.request as { iids: number[] }).iids.length).toBe(5);
    s = choose(s, []);
  });
});
