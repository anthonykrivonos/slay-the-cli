// Behavior tests for the bespoke Defect rares (base AND upgraded), including
// the Echo Form / Amplify duplication paths and the Thunder Strike channel
// counter (with Cracked Core's battle-start Lightning). Player: 75 HP, 3
// energy, 3 orb slots. T_TANK: 200 HP, attacks 10 every turn.

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
  energy,
  block,
  orbIds,
  bundle,
} from "./defectKit";

const strikes = (n: number) => Array(n).fill("STRIKE_BLUE") as string[];

describe("ALL_FOR_ONE", () => {
  test("10/14 damage; puts all cost-0 discard cards into hand (Void excluded)", () => {
    for (const [up, dmg] of [
      [0, 10],
      [1, 14],
    ] as const) {
      let s = fight({ deck: [{ defId: "ALL_FOR_ONE", upgrades: up }, "CLAW", "TURBO", "STRIKE_BLUE", "DEFEND_BLUE"] });
      s = play(s, "CLAW"); // 0-cost, to discard
      s = play(s, "TURBO"); // 0-cost, to discard (+2 energy, Void to discard)
      s = play(s, "STRIKE_BLUE"); // 1-cost, stays in discard
      s = play(s, "ALL_FOR_ONE");
      expect(monsterHp(s)).toBe(200 - 3 - 6 - dmg);
      expect(handNames(s).sort()).toEqual(["CLAW", "DEFEND_BLUE", "TURBO"]);
      expect(pileNames(s, "discard")).toContain("STRIKE_BLUE");
      expect(pileNames(s, "discard")).toContain("VOID"); // unplayable, not cost 0
    }
  });
});

describe("AMPLIFY", () => {
  test("next 1/2 Power cards are played twice this turn", () => {
    let s = fight({ deck: ["AMPLIFY", "DEFRAGMENT", "DEFRAGMENT", "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "AMPLIFY");
    expect(playerPower(s, "AMPLIFY")).toBe(1);
    s = play(s, "DEFRAGMENT"); // doubled: FOCUS 2
    expect(playerPower(s, "FOCUS")).toBe(2);
    expect(playerPower(s, "AMPLIFY")).toBeUndefined(); // consumed
    s = play(s, "DEFRAGMENT"); // normal: FOCUS 3
    expect(playerPower(s, "FOCUS")).toBe(3);

    let t = fight({ deck: [{ defId: "AMPLIFY", upgrades: 1 }, "DEFRAGMENT", "DEFRAGMENT", "STRIKE_BLUE", "DEFEND_BLUE"] });
    t = play(t, "AMPLIFY");
    t = play(t, "DEFRAGMENT");
    t = play(t, "DEFRAGMENT"); // both doubled: FOCUS 4
    expect(playerPower(t, "FOCUS")).toBe(4);
  });

  test("expires at end of turn; non-power cards don't consume it", () => {
    let s = fight({ deck: ["AMPLIFY", "STRIKE_BLUE", "DEFEND_BLUE", "ZAP", "DEFEND_BLUE"] });
    s = play(s, "AMPLIFY");
    s = play(s, "STRIKE_BLUE"); // attack: played once, charge kept
    expect(monsterHp(s)).toBe(194);
    expect(playerPower(s, "AMPLIFY")).toBe(1);
    s = endTurn(s);
    expect(playerPower(s, "AMPLIFY")).toBeUndefined();
  });
});

describe("BIASED_COGNITION", () => {
  test("+4/5 Focus now; lose 1 Focus at the start of each turn (BIAS)", () => {
    for (const [up, focus] of [
      [0, 4],
      [1, 5],
    ] as const) {
      let s = fight({ deck: [{ defId: "BIASED_COGNITION", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE"] });
      s = play(s, "BIASED_COGNITION");
      expect(playerPower(s, "FOCUS")).toBe(focus);
      expect(playerPower(s, "BIAS")).toBe(1);
      s = endTurn(s);
      expect(playerPower(s, "FOCUS")).toBe(focus - 1);
      s = endTurn(s);
      expect(playerPower(s, "FOCUS")).toBe(focus - 2);
    }
  });
});

describe("BUFFER", () => {
  test("prevents the next 1/2 HP losses", () => {
    let s = fight({ deck: ["BUFFER", "STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "BUFFER");
    s = endTurn(s); // tank hits 10: prevented
    expect(s.run.hp).toBe(75);
    expect(playerPower(s, "BUFFER")).toBeUndefined();
    s = endTurn(s); // second hit lands
    expect(s.run.hp).toBe(65);

    let t = fight({ deck: [{ defId: "BUFFER", upgrades: 1 }, "STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE", "DEFEND_BLUE"] });
    t = play(t, "BUFFER");
    t = endTurn(t);
    t = endTurn(t); // both hits prevented
    expect(t.run.hp).toBe(75);
  });
});

describe("CORE_SURGE", () => {
  test("11/15 damage + 1 Artifact; exhausts", () => {
    for (const [up, dmg] of [
      [0, 11],
      [1, 15],
    ] as const) {
      let s = fight({ deck: [{ defId: "CORE_SURGE", upgrades: up }, "REPROGRAM", "ZAP", "ZAP", "DEFEND_BLUE"] });
      s = play(s, "CORE_SURGE");
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(playerPower(s, "ARTIFACT")).toBe(1);
      expect(pileNames(s, "exhaust")).toEqual(["CORE_SURGE"]);
      // Artifact negates Reprogram's Focus LOSS (negative canGoNegative application)
      s = play(s, "REPROGRAM");
      expect(playerPower(s, "FOCUS")).toBeUndefined();
      expect(playerPower(s, "STRENGTH")).toBe(1);
      expect(playerPower(s, "ARTIFACT")).toBeUndefined();
    }
  });
});

describe("CREATIVE_AI", () => {
  test("costs 3 (2 upgraded); adds a random blue Power to hand each turn", () => {
    for (const [up, cost] of [
      [0, 3],
      [1, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "CREATIVE_AI", upgrades: up }, ...strikes(4)] });
      s = play(s, "CREATIVE_AI");
      expect(energy(s)).toBe(3 - cost);
      s = endTurn(s);
      const added = s.combat!.player.piles.hand
        .map((iid) => s.combat!.cards[iid]!.defId)
        .filter((d) => d !== "STRIKE_BLUE");
      expect(added.length).toBe(1);
      expect(bundle.cards.get(added[0]!)!.type).toBe("power");
      expect(bundle.cards.get(added[0]!)!.color).toBe("blue");
    }
  });
});

describe("ECHO_FORM", () => {
  test("first card each turn is played twice (attack path)", () => {
    let s = fight({ deck: ["ECHO_FORM", "STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "ECHO_FORM"); // 3 energy
    s = endTurn(s);
    s = play(s, "STRIKE_BLUE"); // doubled: 12
    expect(monsterHp(s)).toBe(188);
    s = play(s, "STRIKE_BLUE"); // second card: normal
    expect(monsterHp(s)).toBe(182);
    s = endTurn(s);
    s = play(s, "STRIKE_BLUE"); // new turn: doubled again
    expect(monsterHp(s)).toBe(170);
  });

  test("duplicates POWER cards too (temp-copy path)", () => {
    let s = fightWithInHand(["ECHO_FORM", "DEFRAGMENT"], {
      deck: ["ECHO_FORM", "DEFRAGMENT", "STRIKE_BLUE", "DEFEND_BLUE", "DEFEND_BLUE"],
    });
    s = play(s, "ECHO_FORM");
    s = endTurn(s);
    s = play(s, "DEFRAGMENT"); // doubled: FOCUS 2
    expect(playerPower(s, "FOCUS")).toBe(2);
  });

  test("base is Ethereal (exhausts unplayed); upgraded is not", () => {
    let s = fightWithInHand(["ECHO_FORM"], { deck: ["ECHO_FORM", ...strikes(5)] });
    s = endTurn(s);
    expect(pileNames(s, "exhaust")).toEqual(["ECHO_FORM"]);

    let t = fightWithInHand(["ECHO_FORM"], { deck: [{ defId: "ECHO_FORM", upgrades: 1 }, ...strikes(5)] });
    t = endTurn(t);
    expect(pileNames(t, "exhaust")).toEqual([]);
  });

  test("an echoed Echo Form stacks (power duplicated by the active power)", () => {
    let s = fight({ deck: ["ECHO_FORM", "ECHO_FORM", "TURBO", "TURBO", "DEFEND_BLUE"] });
    s = play(s, "TURBO");
    s = play(s, "TURBO"); // 7 energy
    s = play(s, "ECHO_FORM"); // amount 1, active immediately
    s = play(s, "ECHO_FORM"); // first non-autoplay this turn window: doubled
    // second play applies +1 and its echoed duplicate applies +1 more
    expect(playerPower(s, "ECHO_FORM")).toBe(3);
    expect(energy(s)).toBe(1);
  });
});

describe("FISSION", () => {
  test("base: removes all orbs without evoking; energy + draw per orb", () => {
    let s = fight({ deck: ["ZAP", "ZAP", "FISSION", "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "ZAP");
    s = play(s, "ZAP");
    const before = handNames(s).length;
    s = play(s, "FISSION");
    expect(orbIds(s)).toEqual([]);
    expect(monsterHp(s)).toBe(200); // no evokes
    expect(energy(s)).toBe(3 - 2 + 2);
    expect(handNames(s).length).toBe(before - 1 + 2);
    expect(pileNames(s, "exhaust")).toEqual(["FISSION"]);
  });

  test("upgraded: EVOKES all orbs (oldest first)", () => {
    let s = fight({ deck: ["ZAP", "ZAP", { defId: "FISSION", upgrades: 1 }, "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "ZAP");
    s = play(s, "ZAP");
    s = play(s, "FISSION");
    expect(orbIds(s)).toEqual([]);
    expect(monsterHp(s)).toBe(200 - 16); // two lightning evokes at 8
    expect(energy(s)).toBe(3);
  });
});

describe("HYPERBEAM", () => {
  test("26/34 to ALL; lose 3 Focus", () => {
    for (const [up, dmg] of [
      [0, 26],
      [1, 34],
    ] as const) {
      let s = fight({
        deck: [{ defId: "HYPERBEAM", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE"],
        monsters: ["T_TANK", "T_TANK"],
      });
      s = play(s, "HYPERBEAM");
      expect(monsterHp(s, 0)).toBe(200 - dmg);
      expect(monsterHp(s, 1)).toBe(200 - dmg);
      expect(playerPower(s, "FOCUS")).toBe(-3);
    }
  });
});

describe("MACHINE_LEARNING", () => {
  test("draw 1 additional card each turn (DRAW power)", () => {
    let s = fightWithInHand(["MACHINE_LEARNING"], { deck: ["MACHINE_LEARNING", ...strikes(11)] });
    s = play(s, "MACHINE_LEARNING");
    expect(playerPower(s, "DRAW")).toBe(1);
    s = endTurn(s);
    expect(handNames(s).length).toBe(6);
  });

  test("upgraded is innate", () => {
    const s = fight({ deck: [...strikes(9), { defId: "MACHINE_LEARNING", upgrades: 1 }] });
    expect(handNames(s)).toContain("MACHINE_LEARNING");
  });
});

describe("METEOR_STRIKE", () => {
  test("24/30 damage; channel 3 Plasma", () => {
    for (const [up, dmg] of [
      [0, 24],
      [1, 30],
    ] as const) {
      let s = fight({ deck: ["TURBO", "TURBO", { defId: "METEOR_STRIKE", upgrades: up }, "STRIKE_BLUE", "DEFEND_BLUE"] });
      s = play(s, "TURBO");
      s = play(s, "TURBO"); // 7 energy
      s = play(s, "METEOR_STRIKE");
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(orbIds(s)).toEqual(["PLASMA", "PLASMA", "PLASMA"]);
      expect(energy(s)).toBe(2);
    }
  });
});

describe("MULTI_CAST", () => {
  test("evokes the first orb X times (X+1 upgraded)", () => {
    let s = fight({ deck: ["ZAP", "MULTI_CAST", "STRIKE_BLUE", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "ZAP"); // 2 energy left
    s = play(s, "MULTI_CAST"); // X = 2: evoke lightning twice
    expect(monsterHp(s)).toBe(200 - 16);
    expect(orbIds(s)).toEqual([]);
    expect(energy(s)).toBe(0);

    let t = fight({ deck: ["ZAP", { defId: "MULTI_CAST", upgrades: 1 }, "STRIKE_BLUE", "DEFEND_BLUE", "DEFEND_BLUE"] });
    t = play(t, "ZAP");
    t = play(t, "MULTI_CAST"); // X+1 = 3
    expect(monsterHp(t)).toBe(200 - 24);
  });
});

describe("RAINBOW", () => {
  test("channels Lightning, Frost, Dark in order; base exhausts, upgraded doesn't", () => {
    let s = fight({ deck: ["RAINBOW", "ZAP", "ZAP", "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "RAINBOW");
    expect(orbIds(s)).toEqual(["LIGHTNING", "FROST", "DARK"]);
    expect(pileNames(s, "exhaust")).toEqual(["RAINBOW"]);

    let t = fight({ deck: [{ defId: "RAINBOW", upgrades: 1 }, "ZAP", "ZAP", "STRIKE_BLUE", "DEFEND_BLUE"] });
    t = play(t, "RAINBOW");
    expect(pileNames(t, "discard")).toEqual(["RAINBOW"]);
  });
});

describe("REBOOT", () => {
  test("shuffles hand + discard into the draw pile; draws 4/6; exhausts itself", () => {
    for (const [up, draw] of [
      [0, 4],
      [1, 6],
    ] as const) {
      let s = fightWithInHand(["REBOOT"], { deck: [{ defId: "REBOOT", upgrades: up }, ...strikes(10)] });
      s = play(s, "STRIKE_BLUE");
      s = play(s, "STRIKE_BLUE"); // discard: 2
      s = play(s, "REBOOT");
      expect(handNames(s).length).toBe(draw);
      expect(pileNames(s, "discard")).toEqual([]);
      expect(pileNames(s, "exhaust")).toEqual(["REBOOT"]);
      expect(pileNames(s, "draw").length).toBe(10 - draw);
    }
  });

  test("the exhaust pile stays out of the shuffle", () => {
    let s = fightWithInHand(["REBOOT", "CHILL"], { deck: ["REBOOT", "CHILL", ...strikes(9)] });
    s = play(s, "CHILL"); // exhausts
    s = play(s, "REBOOT");
    expect(pileNames(s, "exhaust").sort()).toEqual(["CHILL", "REBOOT"]);
    expect(pileNames(s, "draw")).not.toContain("CHILL");
  });
});

describe("SEEK", () => {
  test("puts 1 chosen card from the draw pile into your hand; exhausts", () => {
    let s = fightWithInHand(["SEEK"], {
      deck: ["SEEK", "DUALCAST", "ZAP", "CLAW", "LEAP", "STRIKE_BLUE", "DEFEND_BLUE", "COOLHEADED"],
    });
    const drawPile = pileNames(s, "draw");
    expect(drawPile.length).toBe(3);
    const want = drawPile[drawPile.length - 1]!; // pick the bottom card
    const before = handNames(s).length;
    s = play(s, "SEEK");
    s = choose(s, [choiceIndexOf(s, want)]);
    expect(handNames(s).length).toBe(before); // -1 played +1 fetched
    expect(handNames(s)).toContain(want);
    expect(pileNames(s, "exhaust")).toEqual(["SEEK"]);
  });

  test("upgraded fetches 2; auto-resolves when the pile is that small", () => {
    let s = fightWithInHand(["SEEK"], {
      deck: [{ defId: "SEEK", upgrades: 1 }, "DUALCAST", "ZAP", "CLAW", "LEAP", "STRIKE_BLUE", "DEFEND_BLUE"],
    });
    expect(pileNames(s, "draw").length).toBe(2);
    const before = handNames(s).length;
    s = play(s, "SEEK"); // 2 candidates for n=2: auto-resolve, no pending choice
    expect(s.pending).toBeNull();
    expect(handNames(s).length).toBe(before - 1 + 2);
    expect(pileNames(s, "draw")).toEqual([]);
  });
});

describe("THUNDER_STRIKE", () => {
  test("one 7/9 hit per Lightning channeled this combat — Cracked Core counts", () => {
    for (const [up, per] of [
      [0, 7],
      [1, 9],
    ] as const) {
      let s = fight({
        deck: ["TURBO", "ZAP", { defId: "THUNDER_STRIKE", upgrades: up }, "STRIKE_BLUE", "DEFEND_BLUE"],
        relics: ["CRACKED_CORE"],
      });
      expect(orbIds(s)).toEqual(["LIGHTNING"]); // battle-start channel
      s = play(s, "TURBO");
      s = play(s, "ZAP"); // 2 lightning channeled total
      s = play(s, "THUNDER_STRIKE");
      expect(monsterHp(s)).toBe(200 - 2 * per);
    }
  });

  test("zero lightning channeled: no hits", () => {
    let s = fight({ deck: ["TURBO", "THUNDER_STRIKE", "STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "TURBO");
    s = play(s, "THUNDER_STRIKE");
    expect(monsterHp(s)).toBe(200);
  });
});
