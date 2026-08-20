// Behavior tests for the bespoke Ironclad uncommons and the powers they create
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
  monsterPower,
  playerPower,
} from "./cardsTestKit";

const strikes = (n: number) => Array(n).fill("STRIKE_RED") as string[];

describe("BATTLE_TRANCE / NO_DRAW", () => {
  test("base draws 3, upgraded draws 4; No Draw expires at end of turn", () => {
    for (const [up, n] of [
      [0, 3],
      [1, 4],
    ] as const) {
      let s = fightWithInHand(["BATTLE_TRANCE"], { deck: [{ defId: "BATTLE_TRANCE", upgrades: up }, ...strikes(9)] });
      s = play(s, "BATTLE_TRANCE");
      expect(handNames(s).length).toBe(4 + n);
      expect(playerPower(s, "NO_DRAW")).toBe(1);
      s = endTurn(s);
      expect(playerPower(s, "NO_DRAW")).toBeUndefined();
    }
  });
});

describe("BLOODLETTING", () => {
  test("lose 3 HP, gain 2 (3 upgraded) energy", () => {
    for (const [up, e] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fight({ deck: [{ defId: "BLOODLETTING", upgrades: up }, ...strikes(4)] });
      s = play(s, "BLOODLETTING");
      expect(s.run.hp).toBe(77);
      expect(s.combat!.player.energy).toBe(3 + e);
    }
  });
});

describe("BLOOD_FOR_BLOOD", () => {
  const deck = ["BLOOD_FOR_BLOOD", "HEMOKINESIS", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"];

  test("base: cost 4, reduced by 1 per HP-loss instance this combat", () => {
    let s = fight({ deck });
    expect(() => play(s, "BLOOD_FOR_BLOOD", 0)).toThrow("not enough energy"); // 4 > 3
    s = play(s, "HEMOKINESIS", 0); // instance 1 (self)
    s = endTurn(s); // instance 2 (tank hits 10)
    s = play(s, "BLOOD_FOR_BLOOD", 0); // cost 4-2=2
    expect(s.combat!.player.energy).toBe(1);
    expect(monsterHp(s)).toBe(200 - 15 - 18);
  });

  test("upgraded: cost 3, damage 22", () => {
    let s = fight({ deck: [{ defId: "BLOOD_FOR_BLOOD", upgrades: 1 }, ...deck.slice(1)] });
    s = play(s, "HEMOKINESIS", 0); // cost 3 -> 2
    s = play(s, "BLOOD_FOR_BLOOD", 0);
    expect(s.combat!.player.energy).toBe(0);
    expect(monsterHp(s)).toBe(200 - 15 - 22);
  });
});

describe("BURNING_PACT", () => {
  test("base: exhaust a chosen card, then draw 2", () => {
    let s = fight({ deck: ["BURNING_PACT", ...strikes(4)] });
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "BURNING_PACT"); // hand: 2 strikes -> choice
    expect(s.pending?.request.kind).toBe("cards");
    s = choose(s, [0]);
    expect(pileNames(s, "exhaust").length).toBe(1);
    expect(handNames(s).length).toBe(3); // 1 left + 2 drawn (reshuffled discard)
  });

  test("upgraded: draws 3", () => {
    let s = fight({ deck: [{ defId: "BURNING_PACT", upgrades: 1 }, ...strikes(5)] });
    if (!handNames(s).includes("BURNING_PACT")) s = fightWithInHand(["BURNING_PACT"], { deck: [{ defId: "BURNING_PACT", upgrades: 1 }, ...strikes(5)] });
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "STRIKE_RED", 0);
    s = play(s, "BURNING_PACT");
    s = choose(s, [0]);
    expect(pileNames(s, "exhaust").length).toBe(1);
    // 1 in hand + up to 3 drawn from draw(1)+discard(2)
    expect(handNames(s).length).toBe(4);
  });
});

describe("COMBUST", () => {
  test("end of turn: lose 1 HP per Combust played, deal magic to all", () => {
    let s = fight({ deck: ["COMBUST", "COMBUST", ...strikes(3)] });
    s = play(s, "COMBUST");
    s = play(s, "COMBUST");
    expect(playerPower(s, "COMBUST")).toBe(10);
    s = endTurn(s);
    expect(s.run.hp).toBe(80 - 2 - 10); // 2 combust HP + tank attack
    expect(monsterHp(s)).toBe(200 - 10);
  });

  test("upgraded: 7 damage", () => {
    let s = fight({ deck: [{ defId: "COMBUST", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "COMBUST");
    s = endTurn(s);
    expect(s.run.hp).toBe(80 - 1 - 10);
    expect(monsterHp(s)).toBe(193);
  });
});

describe("DISARM", () => {
  test("enemy loses 2 (3 upgraded) Strength; exhausts", () => {
    for (const [up, n] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fight({ deck: [{ defId: "DISARM", upgrades: up }, ...strikes(4)] });
      s = play(s, "DISARM", 0);
      expect(monsterPower(s, "STRENGTH")).toBe(-n);
      expect(pileNames(s, "exhaust")).toEqual(["DISARM"]);
      s = endTurn(s);
      expect(s.run.hp).toBe(80 - (10 - n));
    }
  });
});

describe("DROPKICK", () => {
  test("no Vulnerable: just damage", () => {
    let s = fight({ deck: ["DROPKICK", ...strikes(4)] });
    s = play(s, "DROPKICK", 0);
    expect(monsterHp(s)).toBe(195);
    expect(s.combat!.player.energy).toBe(2);
  });

  test("vs Vulnerable: refunds 1 energy and draws 1", () => {
    for (const [up, dmg] of [
      [0, 7], // floor(5 * 1.5)
      [1, 12], // floor(8 * 1.5)
    ] as const) {
      let s = fight({ deck: [{ defId: "DROPKICK", upgrades: up }, "BASH", ...strikes(3)] });
      s = play(s, "BASH", 0); // 8 dmg + Vulnerable 2, energy 1
      s = play(s, "DROPKICK", 0);
      expect(monsterHp(s)).toBe(200 - 8 - dmg);
      expect(s.combat!.player.energy).toBe(1); // 1 - 1 + 1
      expect(handNames(s)).toContain("BASH"); // drew the reshuffled Bash
    }
  });
});

describe("DUAL_WIELD", () => {
  test("single valid card auto-copies (1 base / 2 upgraded)", () => {
    for (const [up, copies] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "DUAL_WIELD", upgrades: up }, "STRIKE_RED", "DEFEND_RED", "DEFEND_RED", "DEFEND_RED"] });
      s = play(s, "DUAL_WIELD");
      expect(s.pending).toBeNull();
      expect(handNames(s).filter((n) => n === "STRIKE_RED").length).toBe(1 + copies);
    }
  });

  test("multiple valid cards open a choice; copy keeps upgrades", () => {
    let s = fight({ deck: ["DUAL_WIELD", { defId: "BASH", upgrades: 1 }, "STRIKE_RED", "DEFEND_RED", "DEFEND_RED"] });
    s = play(s, "DUAL_WIELD");
    expect(s.pending?.request.kind).toBe("cards");
    s = choose(s, [choiceIndexOf(s, "BASH")]);
    const bashes = Object.values(s.combat!.cards).filter((c) => c.defId === "BASH");
    expect(bashes.length).toBe(2);
    expect(bashes.every((c) => c.upgrades === 1)).toBe(true);
  });
});

describe("ENTRENCH", () => {
  test("doubles current block (cost 2, upgraded 1)", () => {
    for (const up of [0, 1] as const) {
      let s = fight({ deck: [{ defId: "ENTRENCH", upgrades: up }, "DEFEND_RED", ...strikes(3)] });
      s = play(s, "DEFEND_RED");
      s = play(s, "ENTRENCH");
      expect(s.combat!.player.block).toBe(10);
      expect(s.combat!.player.energy).toBe(3 - 1 - (up ? 1 : 2));
    }
  });
});

describe("EVOLVE", () => {
  const deck = (up: number) => [
    { defId: "EVOLVE", upgrades: up },
    "WILD_STRIKE",
    "POMMEL_STRIKE",
    "DEFEND_RED",
    "BLOODLETTING",
  ];

  test("base: drawing a status draws 1 more", () => {
    let s = fight({ deck: deck(0) });
    s = play(s, "BLOODLETTING"); // energy 5
    s = play(s, "EVOLVE");
    s = play(s, "WILD_STRIKE", 0); // Wound is now the whole draw pile
    s = play(s, "DEFEND_RED");
    s = play(s, "POMMEL_STRIKE", 0); // draws Wound -> Evolve draws 1 (reshuffle of 3)
    expect(handNames(s)).toContain("WOUND");
    expect(handNames(s).length).toBe(2);
  });

  test("upgraded: draws 2 more", () => {
    let s = fight({ deck: deck(1) });
    s = play(s, "BLOODLETTING");
    s = play(s, "EVOLVE");
    s = play(s, "WILD_STRIKE", 0);
    s = play(s, "DEFEND_RED");
    s = play(s, "POMMEL_STRIKE", 0);
    expect(handNames(s)).toContain("WOUND");
    expect(handNames(s).length).toBe(3);
  });
});

describe("FIRE_BREATHING", () => {
  test("drawing a status hits all enemies for 6 (10 upgraded)", () => {
    for (const [up, dmg] of [
      [0, 6],
      [1, 10],
    ] as const) {
      let s = fight({ deck: [{ defId: "FIRE_BREATHING", upgrades: up }, "WILD_STRIKE", "POMMEL_STRIKE", "DEFEND_RED", "DEFEND_RED"] });
      s = play(s, "FIRE_BREATHING");
      s = play(s, "WILD_STRIKE", 0); // -12, Wound into draw
      s = play(s, "POMMEL_STRIKE", 0); // -9, draws the Wound -> trigger
      expect(monsterHp(s)).toBe(200 - 12 - 9 - dmg);
    }
  });

  test("drawing a curse triggers it too", () => {
    let s = fightWithInHand(["FIRE_BREATHING", "POMMEL_STRIKE"], {
      deck: ["FIRE_BREATHING", "POMMEL_STRIKE", "REGRET", "REGRET", "REGRET", "REGRET"],
    });
    s = play(s, "FIRE_BREATHING");
    s = play(s, "POMMEL_STRIKE", 0); // draws the leftover Regret
    expect(monsterHp(s)).toBe(200 - 9 - 6);
  });
});

describe("FLAME_BARRIER", () => {
  test("retaliates when attacked this turn; gone next turn", () => {
    for (const [up, block, retal] of [
      [0, 12, 4],
      [1, 16, 6],
    ] as const) {
      let s = fight({ deck: [{ defId: "FLAME_BARRIER", upgrades: up }, ...strikes(4)] });
      s = play(s, "FLAME_BARRIER");
      expect(s.combat!.player.block).toBe(block);
      expect(playerPower(s, "FLAME_BARRIER")).toBe(retal);
      s = endTurn(s); // tank attacks into the barrier
      expect(monsterHp(s)).toBe(200 - retal);
      expect(s.run.hp).toBe(80); // fully blocked
      expect(playerPower(s, "FLAME_BARRIER")).toBeUndefined(); // removed at turn start
    }
  });
});

describe("HEMOKINESIS", () => {
  test("lose 2 HP, deal 15 (20 upgraded)", () => {
    for (const [up, dmg] of [
      [0, 15],
      [1, 20],
    ] as const) {
      let s = fight({ deck: [{ defId: "HEMOKINESIS", upgrades: up }, ...strikes(4)] });
      s = play(s, "HEMOKINESIS", 0);
      expect(s.run.hp).toBe(78);
      expect(monsterHp(s)).toBe(200 - dmg);
    }
  });
});

describe("INFERNAL_BLADE", () => {
  test("adds a random red attack costing 0 this turn; exhausts", () => {
    for (const up of [0, 1] as const) {
      let s = fight({ deck: [{ defId: "INFERNAL_BLADE", upgrades: up }, ...strikes(4)] });
      s = play(s, "INFERNAL_BLADE");
      expect(s.combat!.player.energy).toBe(up ? 3 : 2);
      expect(pileNames(s, "exhaust")).toEqual(["INFERNAL_BLADE"]);
      const hand = s.combat!.player.piles.hand.map((i) => s.combat!.cards[i]!);
      const added = hand.find((c) => c.costForTurn === 0 && c.defId !== "STRIKE_RED");
      expect(added).toBeDefined();
      const def = added && Object.assign({}, added);
      expect(def).toBeDefined();
    }
  });
});

describe("RAGE", () => {
  test("gain 3 (5 upgraded) block per attack this turn; expires", () => {
    for (const [up, n] of [
      [0, 3],
      [1, 5],
    ] as const) {
      let s = fight({ deck: [{ defId: "RAGE", upgrades: up }, "STRIKE_RED", "STRIKE_RED", "DEFEND_RED", "DEFEND_RED"] });
      s = play(s, "RAGE");
      s = play(s, "STRIKE_RED", 0);
      expect(s.combat!.player.block).toBe(n);
      s = play(s, "DEFEND_RED"); // skill: no Rage block
      expect(s.combat!.player.block).toBe(n + 5);
      s = endTurn(s);
      expect(playerPower(s, "RAGE")).toBeUndefined();
    }
  });
});

describe("RAMPAGE", () => {
  test("grows by 5 (8 upgraded) per play this combat", () => {
    for (const [up, grow] of [
      [0, 5],
      [1, 8],
    ] as const) {
      let s = fight({ deck: [{ defId: "RAMPAGE", upgrades: up }, ...strikes(4)] });
      s = play(s, "RAMPAGE", 0);
      expect(monsterHp(s)).toBe(192);
      s = endTurn(s); // redraw the whole 5-card deck
      s = play(s, "RAMPAGE", 0);
      expect(monsterHp(s)).toBe(192 - (8 + grow));
    }
  });
});

describe("RUPTURE", () => {
  test("card HP loss grants Strength; monster damage does not", () => {
    for (const [up, str] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "RUPTURE", upgrades: up }, "HEMOKINESIS", ...strikes(3)] });
      s = play(s, "RUPTURE");
      s = play(s, "HEMOKINESIS", 0); // lose 2 HP from a card
      expect(playerPower(s, "STRENGTH")).toBe(str);
      s = endTurn(s); // tank hits for 10: no Rupture
      expect(playerPower(s, "STRENGTH")).toBe(str);
    }
  });

  test("Burn damage triggers Rupture", () => {
    let s = fight({ deck: ["RUPTURE", "BURN", ...strikes(3)] });
    s = play(s, "RUPTURE");
    s = endTurn(s); // Burn deals 2 (source-null thorns)
    expect(playerPower(s, "STRENGTH")).toBe(1);
  });
});

describe("SEARING_BLOW", () => {
  test("n upgrades deal n*(n+7)/2 + 12", () => {
    for (const [up, dmg] of [
      [0, 12],
      [1, 16],
      [2, 21],
    ] as const) {
      let s = fight({ deck: [{ defId: "SEARING_BLOW", upgrades: up }, ...strikes(4)] });
      s = play(s, "SEARING_BLOW", 0);
      expect(monsterHp(s)).toBe(200 - dmg);
    }
  });
});

describe("SECOND_WIND", () => {
  test("exhausts non-attacks, 5 (7 upgraded) block each", () => {
    for (const [up, n] of [
      [0, 5],
      [1, 7],
    ] as const) {
      let s = fight({ deck: [{ defId: "SECOND_WIND", upgrades: up }, "DEFEND_RED", "DEFEND_RED", "STRIKE_RED", "STRIKE_RED"] });
      s = play(s, "SECOND_WIND");
      expect(pileNames(s, "exhaust")).toEqual(["DEFEND_RED", "DEFEND_RED"]);
      expect(s.combat!.player.block).toBe(2 * n);
      expect(handNames(s)).toEqual(["STRIKE_RED", "STRIKE_RED"]);
    }
  });
});

describe("SEEING_RED", () => {
  test("gain 2 energy; exhausts (cost 1, upgraded 0)", () => {
    for (const [up, e] of [
      [0, 4], // 3 - 1 + 2
      [1, 5], // 3 - 0 + 2
    ] as const) {
      let s = fight({ deck: [{ defId: "SEEING_RED", upgrades: up }, ...strikes(4)] });
      s = play(s, "SEEING_RED");
      expect(s.combat!.player.energy).toBe(e);
      expect(pileNames(s, "exhaust")).toEqual(["SEEING_RED"]);
    }
  });
});

describe("SENTINEL", () => {
  test("gives 2 (3 upgraded) energy when exhausted", () => {
    for (const [up, e] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fight({
        deck: [{ defId: "TRUE_GRIT", upgrades: 1 }, { defId: "SENTINEL", upgrades: up }, ...strikes(3)],
      });
      s = play(s, "TRUE_GRIT");
      s = choose(s, [choiceIndexOf(s, "SENTINEL")]);
      expect(pileNames(s, "exhaust")).toEqual(["SENTINEL"]);
      expect(s.combat!.player.energy).toBe(2 + e);
    }
  });
});

describe("SEVER_SOUL", () => {
  test("exhausts all non-attacks, deals 16 (22 upgraded)", () => {
    for (const [up, dmg] of [
      [0, 16],
      [1, 22],
    ] as const) {
      let s = fight({ deck: [{ defId: "SEVER_SOUL", upgrades: up }, "DEFEND_RED", "DEFEND_RED", "STRIKE_RED", "STRIKE_RED"] });
      s = play(s, "SEVER_SOUL", 0);
      expect(pileNames(s, "exhaust")).toEqual(["DEFEND_RED", "DEFEND_RED"]);
      expect(monsterHp(s)).toBe(200 - dmg);
    }
  });
});

describe("SPOT_WEAKNESS", () => {
  test("attack intent: gain 3 (4 upgraded) Strength", () => {
    for (const [up, str] of [
      [0, 3],
      [1, 4],
    ] as const) {
      let s = fight({ deck: [{ defId: "SPOT_WEAKNESS", upgrades: up }, ...strikes(4)] });
      s = play(s, "SPOT_WEAKNESS", 0);
      expect(playerPower(s, "STRENGTH")).toBe(str);
    }
  });

  test("non-attack intent: nothing", () => {
    let s = fight({ deck: ["SPOT_WEAKNESS", ...strikes(4)], monsters: ["T_GUARD"] });
    s = play(s, "SPOT_WEAKNESS", 0);
    expect(playerPower(s, "STRENGTH")).toBeUndefined();
  });
});

describe("primitives sanity (uncommons)", () => {
  test("PUMMEL: 2 damage x4 (x5 upgraded); exhausts", () => {
    for (const [up, hits] of [
      [0, 4],
      [1, 5],
    ] as const) {
      let s = fight({ deck: [{ defId: "PUMMEL", upgrades: up }, ...strikes(4)] });
      s = play(s, "PUMMEL", 0);
      expect(monsterHp(s)).toBe(200 - 2 * hits);
      expect(pileNames(s, "exhaust")).toEqual(["PUMMEL"]);
    }
  });

  test("CARNAGE: 20/28; POWER_THROUGH: wounds + block; RECKLESS_CHARGE: Dazed", () => {
    let s = fight({ deck: ["CARNAGE", "POWER_THROUGH", "RECKLESS_CHARGE", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "CARNAGE", 0);
    expect(monsterHp(s)).toBe(180);
    s = play(s, "POWER_THROUGH");
    expect(s.combat!.player.block).toBe(15);
    expect(handNames(s).filter((n) => n === "WOUND").length).toBe(2);
    s = play(s, "RECKLESS_CHARGE", 0);
    expect(monsterHp(s)).toBe(173);
    expect(pileNames(s, "draw")).toContain("DAZED");
  });

  test("INTIMIDATE + SHOCKWAVE debuff all enemies and exhaust", () => {
    let s = fight({ deck: ["INTIMIDATE", "SHOCKWAVE", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"], monsters: ["T_TANK", "T_TANK"] });
    s = play(s, "INTIMIDATE");
    expect(monsterPower(s, "WEAK", 0)).toBe(1);
    expect(monsterPower(s, "WEAK", 1)).toBe(1);
    s = play(s, "SHOCKWAVE");
    expect(monsterPower(s, "WEAK", 0)).toBe(4);
    expect(monsterPower(s, "VULNERABLE", 1)).toBe(3);
    expect(pileNames(s, "exhaust").sort()).toEqual(["INTIMIDATE", "SHOCKWAVE"]);
  });

  test("INFLAME + UPPERCUT", () => {
    let s = fight({ deck: ["INFLAME", "UPPERCUT", "GHOSTLY_ARMOR", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "INFLAME");
    expect(playerPower(s, "STRENGTH")).toBe(2);
    s = play(s, "UPPERCUT", 0);
    expect(monsterHp(s)).toBe(200 - 15); // 13 + 2 strength
    expect(monsterPower(s, "WEAK")).toBe(1);
    expect(monsterPower(s, "VULNERABLE")).toBe(1);
  });

  test("METALLICIZE blocks at end of turn; GHOSTLY_ARMOR blocks 10", () => {
    let s = fight({ deck: ["METALLICIZE", "GHOSTLY_ARMOR", "STRIKE_RED", "STRIKE_RED", "STRIKE_RED"] });
    s = play(s, "METALLICIZE");
    expect(playerPower(s, "METALLICIZE")).toBe(3);
    s = play(s, "GHOSTLY_ARMOR");
    expect(s.combat!.player.block).toBe(10);
    s = endTurn(s);
    // 10 + 3 block against the 10-damage attack: untouched
    expect(s.run.hp).toBe(80);
    s = endTurn(s);
    // next turn block resets; metallicize 3 against 10
    expect(s.run.hp).toBe(80 - 7);
  });
});
