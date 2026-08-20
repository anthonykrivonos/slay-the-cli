// Behavior tests for the bespoke Ironclad commons (base AND upgraded), plus
// primitives sanity checks for the pool. Numbers are corpus-exact.

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
} from "./cardsTestKit";

describe("ARMAMENTS", () => {
  const deck = ["ARMAMENTS", "STRIKE_RED", "STRIKE_RED", "DEFEND_RED", "BODY_SLAM"];

  test("base: 5 block + choose one card to upgrade (cost syncs)", () => {
    let s = fight({ deck });
    s = play(s, "ARMAMENTS");
    expect(s.combat!.player.block).toBe(5);
    expect(s.pending?.request.kind).toBe("cards");
    s = choose(s, [choiceIndexOf(s, "BODY_SLAM")]);
    const bs = Object.values(s.combat!.cards).find((c) => c.defId === "BODY_SLAM")!;
    expect(bs.upgrades).toBe(1);
    expect(bs.cost).toBe(0); // Body Slam+ costs 0
    expect(bs.costForTurn).toBe(0);
  });

  test("upgraded: upgrades ALL cards in hand, no choice", () => {
    let s = fight({ deck: [{ defId: "ARMAMENTS", upgrades: 1 }, ...deck.slice(1)] });
    s = play(s, "ARMAMENTS");
    expect(s.pending).toBeNull();
    expect(s.combat!.player.block).toBe(5);
    for (const iid of s.combat!.player.piles.hand) {
      expect(s.combat!.cards[iid]!.upgrades).toBe(1);
    }
    const hp0 = monsterHp(s);
    s = play(s, "STRIKE_RED", 0); // upgraded in combat -> 9 damage
    expect(monsterHp(s)).toBe(hp0 - 9);
  });
});

describe("CLASH", () => {
  test("base/upgraded: only playable with an all-Attack hand", () => {
    for (const [up, dmg] of [
      [0, 14],
      [1, 18],
    ] as const) {
      let s = fight({ deck: [{ defId: "CLASH", upgrades: up }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
      s = play(s, "CLASH", 0);
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(s.combat!.player.energy).toBe(3); // costs 0
    }
  });

  test("vetoed when a non-Attack is in hand", () => {
    const s = fight({ deck: ["CLASH", "DEFEND_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    expect(() => play(s, "CLASH", 0)).toThrow("cannot be used");
  });
});

describe("HAVOC", () => {
  test("base: plays the top draw card for free and exhausts it (cost 1)", () => {
    let s = fightWithInHand(["HAVOC"], { deck: ["HAVOC", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    expect(pileNames(s, "draw")).toEqual(["STRIKE_RED"]);
    s = play(s, "HAVOC");
    expect(monsterHp(s)).toBe(200 - 6);
    expect(pileNames(s, "exhaust")).toEqual(["STRIKE_RED"]);
    expect(s.combat!.player.energy).toBe(2); // Havoc cost only
  });

  test("upgraded: costs 0", () => {
    let s = fightWithInHand(["HAVOC"], {
      deck: [{ defId: "HAVOC", upgrades: 1 }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"],
    });
    s = play(s, "HAVOC");
    expect(monsterHp(s)).toBe(200 - 6);
    expect(s.combat!.player.energy).toBe(3);
  });

  test("empty draw + discard: fizzles", () => {
    let s = fight({ deck: ["HAVOC", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "HAVOC"); // whole deck is in hand; nothing to play
    expect(monsterHp(s)).toBe(200);
    expect(pileNames(s, "exhaust")).toEqual([]);
  });
});

describe("HEADBUTT", () => {
  test("base: 9 damage; single discard card auto-moves to draw top", () => {
    let s = fight({ deck: ["HEADBUTT", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "HEADBUTT", 0);
    expect(monsterHp(s)).toBe(200 - 6 - 9);
    expect(s.pending).toBeNull(); // 1 candidate auto-resolves
    expect(pileNames(s, "draw")[0]).toBe("STRIKE_RED");
  });

  test("upgraded: 12 damage; multi-card discard opens a choice", () => {
    let s = fight({ deck: [{ defId: "HEADBUTT", upgrades: 1 }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "HEADBUTT", 0);
    expect(monsterHp(s)).toBe(200 - 6 - 6 - 12);
    expect(s.pending?.request.kind).toBe("cards");
    const iids = s.pending!.request.kind === "cards" ? s.pending!.request.iids : [];
    s = choose(s, [0]);
    expect(s.combat!.player.piles.draw[0]).toBe(iids[0]);
  });
});

describe("HEAVY_BLADE", () => {
  test("no Strength: 14 either way", () => {
    let s = fight({ deck: ["HEAVY_BLADE", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "HEAVY_BLADE", 0);
    expect(monsterHp(s)).toBe(200 - 14);
  });

  test("Strength applies 3x (base) / 5x (upgraded)", () => {
    for (const [up, total] of [
      [0, 14 + 2 * 3],
      [1, 14 + 2 * 5],
    ] as const) {
      let s = fight({ deck: ["FLEX", { defId: "HEAVY_BLADE", upgrades: up }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
      s = play(s, "FLEX");
      s = play(s, "HEAVY_BLADE", 0);
      expect(monsterHp(s)).toBe(200 - total);
    }
  });
});

describe("PERFECTED_STRIKE", () => {
  // deck strikes: itself + STRIKE_RED x2 + POMMEL_STRIKE = 4
  const deck = ["PERFECTED_STRIKE", "STRIKE_RED", "STRIKE_RED", "DEFEND_RED", "POMMEL_STRIKE"];

  test("base: 6 + 2 per Strike card (counts itself)", () => {
    let s = fight({ deck });
    s = play(s, "PERFECTED_STRIKE", 0);
    expect(monsterHp(s)).toBe(200 - (6 + 2 * 4));
  });

  test("upgraded: 6 + 3 per Strike card", () => {
    let s = fight({ deck: [{ defId: "PERFECTED_STRIKE", upgrades: 1 }, ...deck.slice(1)] });
    s = play(s, "PERFECTED_STRIKE", 0);
    expect(monsterHp(s)).toBe(200 - (6 + 3 * 4));
  });
});

describe("SWORD_BOOMERANG", () => {
  test("base 3 hits / upgraded 4 hits of 3 at random enemies", () => {
    for (const [up, hits] of [
      [0, 3],
      [1, 4],
    ] as const) {
      let s = fight({ deck: [{ defId: "SWORD_BOOMERANG", upgrades: up }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
      s = play(s, "SWORD_BOOMERANG");
      expect(monsterHp(s)).toBe(200 - 3 * hits);
    }
  });

  test("Strength applies per hit", () => {
    let s = fight({ deck: ["FLEX", "SWORD_BOOMERANG", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "FLEX");
    s = play(s, "SWORD_BOOMERANG");
    expect(monsterHp(s)).toBe(200 - 3 * (3 + 2));
  });
});

describe("TRUE_GRIT", () => {
  test("base: 7 block + exhausts 1 random hand card", () => {
    let s = fight({ deck: ["TRUE_GRIT", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "TRUE_GRIT");
    expect(s.combat!.player.block).toBe(7);
    expect(s.pending).toBeNull();
    expect(pileNames(s, "exhaust")).toEqual(["STRIKE_RED"]);
    expect(handNames(s).length).toBe(3);
  });

  test("upgraded: 9 block + targeted exhaust", () => {
    let s = fight({ deck: [{ defId: "TRUE_GRIT", upgrades: 1 }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "DEFEND_RED"] });
    s = play(s, "TRUE_GRIT");
    expect(s.combat!.player.block).toBe(9);
    expect(s.pending?.request.kind).toBe("cards");
    s = choose(s, [choiceIndexOf(s, "DEFEND_RED")]);
    expect(pileNames(s, "exhaust")).toEqual(["DEFEND_RED"]);
  });
});

describe("WARCRY", () => {
  test("base: draw 1, put a chosen hand card on top of draw, exhaust", () => {
    let s = fight({ deck: ["WARCRY", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "STRIKE_RED", 0); // seed the discard so the draw works
    s = play(s, "WARCRY");
    // drew 1 (via reshuffle) then choice among 4 hand cards
    expect(s.pending?.request.kind).toBe("cards");
    const iids = s.pending!.request.kind === "cards" ? s.pending!.request.iids : [];
    expect(iids.length).toBe(4);
    s = choose(s, [0]);
    expect(s.combat!.player.piles.draw[0]).toBe(iids[0]);
    expect(pileNames(s, "exhaust")).toEqual(["WARCRY"]);
  });

  test("upgraded: draws 2", () => {
    let s = fight({ deck: [{ defId: "WARCRY", upgrades: 1 }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "WARCRY"); // 2 in hand + 2 drawn back
    expect(s.pending?.request.kind).toBe("cards");
    const iids = s.pending!.request.kind === "cards" ? s.pending!.request.iids : [];
    expect(iids.length).toBe(4);
    s = choose(s, [0]);
    expect(pileNames(s, "exhaust")).toEqual(["WARCRY"]);
  });
});

describe("primitives sanity (commons)", () => {
  test("WILD_STRIKE: damage + Wound shuffled into draw", () => {
    for (const [up, dmg] of [
      [0, 12],
      [1, 17],
    ] as const) {
      let s = fight({ deck: [{ defId: "WILD_STRIKE", upgrades: up }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
      s = play(s, "WILD_STRIKE", 0);
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(pileNames(s, "draw")).toEqual(["WOUND"]);
    }
  });

  test("FLEX: temporary Strength falls off at end of turn", () => {
    for (const [up, str] of [
      [0, 2],
      [1, 4],
    ] as const) {
      let s = fight({ deck: [{ defId: "FLEX", upgrades: up }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
      s = play(s, "FLEX");
      expect(playerPower(s, "STRENGTH")).toBe(str);
      expect(playerPower(s, "LOSE_STRENGTH")).toBe(str);
      s = endTurn(s);
      expect(playerPower(s, "STRENGTH") ?? 0).toBe(0);
      expect(playerPower(s, "LOSE_STRENGTH")).toBeUndefined();
    }
  });

  test("IRON_WAVE: 5 block + 5 damage (7/7 upgraded)", () => {
    for (const [up, n] of [
      [0, 5],
      [1, 7],
    ] as const) {
      let s = fight({ deck: [{ defId: "IRON_WAVE", upgrades: up }, "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
      s = play(s, "IRON_WAVE", 0);
      expect(s.combat!.player.block).toBe(n);
      expect(monsterHp(s)).toBe(200 - n);
    }
  });

  test("TWIN_STRIKE: two hits", () => {
    let s = fight({ deck: ["TWIN_STRIKE", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "TWIN_STRIKE", 0);
    expect(monsterHp(s)).toBe(200 - 10);
  });

  test("POMMEL_STRIKE: damage + draw", () => {
    let s = fight({ deck: ["POMMEL_STRIKE", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "POMMEL_STRIKE", 0);
    expect(monsterHp(s)).toBe(200 - 6 - 9);
    expect(handNames(s).length).toBe(4); // 3 left + 1 drawn back
  });

  test("SHRUG_IT_OFF: block + draw", () => {
    let s = fight({ deck: ["SHRUG_IT_OFF", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "SHRUG_IT_OFF");
    expect(s.combat!.player.block).toBe(8);
    expect(handNames(s).length).toBe(4);
  });

  test("CLEAVE + THUNDERCLAP hit all enemies", () => {
    let s = fight({ deck: ["CLEAVE", "THUNDERCLAP", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"], monsters: ["T_TANK", "T_TANK"] });
    s = play(s, "CLEAVE");
    expect(monsterHp(s, 0)).toBe(192);
    expect(monsterHp(s, 1)).toBe(192);
    s = play(s, "THUNDERCLAP");
    expect(monsterHp(s, 0)).toBe(188);
    expect(monsterHp(s, 1)).toBe(188);
    expect(monsterPower(s, "VULNERABLE", 0)).toBe(1);
    expect(monsterPower(s, "VULNERABLE", 1)).toBe(1);
  });
});
