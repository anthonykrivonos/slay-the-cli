// Behavior tests for the Defect basics + bespoke commons (base AND upgraded).
// Numbers are corpus-exact. Player: 75 HP, 3 energy, 3 orb slots. Default
// monster T_TANK: 200 HP, attacks for 10 every turn; T_GUARD never attacks.

import { test, expect, describe } from "bun:test";
import {
  fight,
  play,
  endTurn,
  choose,
  handNames,
  pileNames,
  monsterHp,
  monsterPower,
  playerPower,
  energy,
  block,
  orbIds,
} from "./defectKit";

describe("basics", () => {
  test("STRIKE_BLUE 6/9, DEFEND_BLUE 5/8", () => {
    for (const [up, dmg, blk] of [
      [0, 6, 5],
      [1, 9, 8],
    ] as const) {
      let s = fight({
        deck: [
          { defId: "STRIKE_BLUE", upgrades: up },
          { defId: "DEFEND_BLUE", upgrades: up },
          "ZAP",
          "ZAP",
          "ZAP",
        ],
      });
      s = play(s, "STRIKE_BLUE");
      expect(monsterHp(s)).toBe(200 - dmg);
      s = play(s, "DEFEND_BLUE");
      expect(block(s)).toBe(blk);
    }
  });

  test("ZAP channels 1 Lightning; upgraded costs 0", () => {
    let s = fight({ deck: [{ defId: "ZAP", upgrades: 1 }, "STRIKE_BLUE", "STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "ZAP");
    expect(orbIds(s)).toEqual(["LIGHTNING"]);
    expect(energy(s)).toBe(3);
  });

  test("DUALCAST with no orbs fizzles; upgraded costs 0", () => {
    let s = fight({ deck: [{ defId: "DUALCAST", upgrades: 1 }, "STRIKE_BLUE", "STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "DUALCAST");
    expect(energy(s)).toBe(3);
    expect(monsterHp(s)).toBe(200);
  });
});

describe("BALL_LIGHTNING / COLD_SNAP", () => {
  test("damage + channel", () => {
    for (const [up, bl, cs] of [
      [0, 7, 6],
      [1, 10, 9],
    ] as const) {
      let s = fight({
        deck: [
          { defId: "BALL_LIGHTNING", upgrades: up },
          { defId: "COLD_SNAP", upgrades: up },
          "ZAP",
          "ZAP",
          "ZAP",
        ],
      });
      s = play(s, "BALL_LIGHTNING");
      expect(monsterHp(s)).toBe(200 - bl);
      expect(orbIds(s)).toEqual(["LIGHTNING"]);
      s = play(s, "COLD_SNAP");
      expect(monsterHp(s)).toBe(200 - bl - cs);
      expect(orbIds(s)).toEqual(["LIGHTNING", "FROST"]);
    }
  });
});

describe("BARRAGE", () => {
  test("one hit per channeled orb (4/6 each)", () => {
    for (const [up, per] of [
      [0, 4],
      [1, 6],
    ] as const) {
      let s = fight({ deck: [{ defId: "BARRAGE", upgrades: up }, "ZAP", "COOLHEADED", "STRIKE_BLUE", "DEFEND_BLUE"] });
      s = play(s, "ZAP");
      s = play(s, "COOLHEADED"); // 2 orbs
      s = play(s, "BARRAGE");
      expect(monsterHp(s)).toBe(200 - 2 * per);
    }
  });

  test("no orbs: no hits", () => {
    let s = fight({ deck: ["BARRAGE", "STRIKE_BLUE", "STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "BARRAGE");
    expect(monsterHp(s)).toBe(200);
  });
});

describe("BEAM_CELL", () => {
  test("3/4 damage + 1/2 Vulnerable", () => {
    for (const [up, dmg, vuln] of [
      [0, 3, 1],
      [1, 4, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "BEAM_CELL", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE"] });
      s = play(s, "BEAM_CELL");
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(monsterPower(s, "VULNERABLE")).toBe(vuln);
    }
  });
});

describe("CHARGE_BATTERY", () => {
  test("7/10 Block now, +1 energy next turn", () => {
    for (const [up, blk] of [
      [0, 7],
      [1, 10],
    ] as const) {
      let s = fight({ deck: [{ defId: "CHARGE_BATTERY", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE"] });
      s = play(s, "CHARGE_BATTERY");
      expect(block(s)).toBe(blk);
      expect(playerPower(s, "ENERGIZED")).toBe(1);
      s = endTurn(s);
      expect(energy(s)).toBe(4);
      expect(playerPower(s, "ENERGIZED")).toBeUndefined();
    }
  });
});

describe("CLAW", () => {
  test("every Claw play buffs ALL Claws by 2 this combat", () => {
    let s = fight({ deck: ["CLAW", "CLAW", "CLAW", "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "CLAW"); // 3
    s = play(s, "CLAW"); // 5
    s = play(s, "CLAW"); // 7
    expect(monsterHp(s)).toBe(200 - 3 - 5 - 7);
    expect(playerPower(s, "CLAW_BUFF")).toBe(6);
  });

  test("upgraded base 5", () => {
    const up = { defId: "CLAW", upgrades: 1 };
    let s = fight({ deck: [up, up, "STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "CLAW"); // 5
    s = play(s, "CLAW"); // 7
    expect(monsterHp(s)).toBe(200 - 5 - 7);
  });
});

describe("COMPILE_DRIVER", () => {
  test("7/10 damage; draws per UNIQUE orb", () => {
    for (const [up, dmg] of [
      [0, 7],
      [1, 10],
    ] as const) {
      let s = fight({
        deck: [{ defId: "COMPILE_DRIVER", upgrades: up }, "ZAP", "ZAP", "STRIKE_BLUE", "DEFEND_BLUE", "STRIKE_BLUE", "DEFEND_BLUE"],
        seed: "CD" + up,
      });
      // ensure COMPILE_DRIVER + both ZAPs in hand: deck of 7, draw 5 - search seeds
      if (!handNames(s).includes("COMPILE_DRIVER") || handNames(s).filter((n) => n === "ZAP").length < 2) {
        for (const seed of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
          s = fight({
            deck: [{ defId: "COMPILE_DRIVER", upgrades: up }, "ZAP", "ZAP", "STRIKE_BLUE", "DEFEND_BLUE", "STRIKE_BLUE", "DEFEND_BLUE"],
            seed,
          });
          if (handNames(s).includes("COMPILE_DRIVER") && handNames(s).filter((n) => n === "ZAP").length >= 2) break;
        }
      }
      s = play(s, "ZAP");
      s = play(s, "ZAP"); // 2 lightning = 1 unique type
      const handBefore = handNames(s).length;
      s = play(s, "COMPILE_DRIVER");
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(handNames(s).length).toBe(handBefore - 1 + 1); // played 1, drew 1
    }
  });
});

describe("COOLHEADED", () => {
  test("channel 1 Frost, draw 1/2", () => {
    for (const [up, draw] of [
      [0, 1],
      [1, 2],
    ] as const) {
      let s = fight({
        deck: [{ defId: "COOLHEADED", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE", "STRIKE_BLUE", "STRIKE_BLUE"],
      });
      if (!handNames(s).includes("COOLHEADED")) {
        for (const seed of ["A", "B", "C", "D", "E", "F"]) {
          s = fight({
            deck: [{ defId: "COOLHEADED", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE", "STRIKE_BLUE", "STRIKE_BLUE"],
            seed,
          });
          if (handNames(s).includes("COOLHEADED")) break;
        }
      }
      const before = handNames(s).length;
      s = play(s, "COOLHEADED");
      expect(orbIds(s)).toEqual(["FROST"]);
      expect(handNames(s).length).toBe(before - 1 + draw);
    }
  });
});

describe("GO_FOR_THE_EYES", () => {
  test("applies Weak only when the enemy intends to attack", () => {
    for (const [up, dmg, weak] of [
      [0, 3, 1],
      [1, 4, 2],
    ] as const) {
      let s = fight({ deck: [{ defId: "GO_FOR_THE_EYES", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE"] });
      s = play(s, "GO_FOR_THE_EYES");
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(monsterPower(s, "WEAK")).toBe(weak);

      let t = fight({ deck: ["GO_FOR_THE_EYES", "ZAP", "ZAP", "ZAP", "DEFEND_BLUE"], monsters: ["T_GUARD"] });
      t = play(t, "GO_FOR_THE_EYES");
      expect(monsterPower(t, "WEAK")).toBeUndefined();
    }
  });
});

describe("HOLOGRAM", () => {
  test("3/5 Block; returns a discard card to hand; base exhausts, upgraded doesn't", () => {
    for (const [up, blk] of [
      [0, 3],
      [1, 5],
    ] as const) {
      let s = fight({ deck: [{ defId: "HOLOGRAM", upgrades: up }, "STRIKE_BLUE", "ZAP", "ZAP", "DEFEND_BLUE"] });
      s = play(s, "STRIKE_BLUE"); // now in discard
      s = play(s, "HOLOGRAM"); // single candidate auto-resolves
      expect(block(s)).toBe(blk);
      expect(handNames(s)).toContain("STRIKE_BLUE");
      if (up === 0) {
        expect(pileNames(s, "exhaust")).toContain("HOLOGRAM");
      } else {
        expect(pileNames(s, "discard")).toContain("HOLOGRAM");
      }
    }
  });
});

describe("REBOUND", () => {
  test("next card played this turn goes on top of the draw pile (not Rebound itself)", () => {
    let s = fight({ deck: ["REBOUND", "STRIKE_BLUE", "ZAP", "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE"] });
    if (!handNames(s).includes("REBOUND") || !handNames(s).includes("STRIKE_BLUE")) {
      for (const seed of ["A", "B", "C", "D", "E", "F"]) {
        s = fight({ deck: ["REBOUND", "STRIKE_BLUE", "ZAP", "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE"], seed });
        if (handNames(s).includes("REBOUND") && handNames(s).includes("STRIKE_BLUE")) break;
      }
    }
    s = play(s, "REBOUND");
    expect(monsterHp(s)).toBe(191);
    expect(pileNames(s, "discard")).toContain("REBOUND"); // did not rebound itself
    expect(playerPower(s, "REBOUND")).toBe(1);
    s = play(s, "STRIKE_BLUE");
    expect(pileNames(s, "draw")[0]).toBe("STRIKE_BLUE"); // on top of draw
    expect(playerPower(s, "REBOUND")).toBeUndefined(); // consumed
  });

  test("expires at end of turn", () => {
    let s = fight({ deck: ["REBOUND", "STRIKE_BLUE", "ZAP", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "REBOUND");
    s = endTurn(s);
    expect(playerPower(s, "REBOUND")).toBeUndefined();
  });
});

describe("RECURSION", () => {
  test("evokes the first orb and re-channels it; Dark keeps its stored amount", () => {
    let s = fight({ deck: ["DARKNESS", "RECURSION", "STRIKE_BLUE", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "DARKNESS");
    s = endTurn(s); // dark grows to 6 (stored total 12)
    s = play(s, "RECURSION");
    expect(monsterHp(s)).toBe(200 - 12);
    expect(orbIds(s)).toEqual(["DARK"]);
    expect(s.combat!.player.orbs[0]!.amount).toBe(6); // growth preserved
  });

  test("upgraded costs 0; lightning evoke + re-channel", () => {
    let s = fight({ deck: ["ZAP", { defId: "RECURSION", upgrades: 1 }, "STRIKE_BLUE", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "ZAP");
    const e = energy(s);
    s = play(s, "RECURSION");
    expect(energy(s)).toBe(e);
    expect(monsterHp(s)).toBe(192); // evoke 8
    expect(orbIds(s)).toEqual(["LIGHTNING"]);
  });
});

describe("STACK", () => {
  test("Block = discard size (+3 upgraded)", () => {
    for (const [up, bonus] of [
      [0, 0],
      [1, 3],
    ] as const) {
      let s = fight({ deck: [{ defId: "STACK", upgrades: up }, "CLAW", "CLAW", "STRIKE_BLUE", "DEFEND_BLUE"] });
      s = play(s, "CLAW");
      s = play(s, "CLAW"); // discard: 2
      s = play(s, "STACK");
      expect(block(s)).toBe(2 + bonus);
    }
  });
});

describe("STEAM_BARRIER", () => {
  test("6/8 Block, shrinking by 1 per play this combat", () => {
    for (const [up, first] of [
      [0, 6],
      [1, 8],
    ] as const) {
      const sb = { defId: "STEAM_BARRIER", upgrades: up };
      let s = fight({ deck: [sb, sb, "STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE"] });
      s = play(s, "STEAM_BARRIER");
      expect(block(s)).toBe(first);
      s = play(s, "STEAM_BARRIER"); // the OTHER copy still at full value? No:
      // shrink is per-INSTANCE (card.misc), so the second copy is unshrunk.
      expect(block(s)).toBe(first + first);
    }
  });

  test("the same instance shrinks on replay (via Hologram)", () => {
    let s = fight({ deck: ["STEAM_BARRIER", "HOLOGRAM", "STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE"] });
    s = play(s, "STEAM_BARRIER"); // 6
    s = play(s, "STRIKE_BLUE"); // put a second card into discard
    s = play(s, "HOLOGRAM"); // choice: pick STEAM_BARRIER back
    if (s.pending) {
      const req = s.pending.request;
      if (req.kind !== "cards") throw new Error("expected card choice");
      const idx = req.iids.findIndex((iid) => s.combat!.cards[iid]?.defId === "STEAM_BARRIER");
      s = choose(s, [idx]);
    }
    s = play(s, "STEAM_BARRIER"); // 5
    expect(block(s)).toBe(6 + 3 + 5);
  });
});

describe("STREAMLINE", () => {
  test("15/20 damage; cost drops by 1 per play this combat", () => {
    for (const [up, dmg] of [
      [0, 15],
      [1, 20],
    ] as const) {
      let s = fight({ deck: [{ defId: "STREAMLINE", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE"] });
      s = play(s, "STREAMLINE");
      expect(monsterHp(s)).toBe(200 - dmg);
      expect(energy(s)).toBe(1);
      const iid = s.combat!.player.piles.discard.find((i) => s.combat!.cards[i]!.defId === "STREAMLINE")!;
      expect(s.combat!.cards[iid]!.cost).toBe(1);
    }
  });
});

describe("SWEEPING_BEAM", () => {
  test("6/9 to ALL + draw 1", () => {
    for (const [up, dmg] of [
      [0, 6],
      [1, 9],
    ] as const) {
      let s = fight({
        deck: [{ defId: "SWEEPING_BEAM", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE", "STRIKE_BLUE"],
        monsters: ["T_TANK", "T_TANK"],
      });
      if (!handNames(s).includes("SWEEPING_BEAM")) {
        for (const seed of ["A", "B", "C", "D", "E", "F"]) {
          s = fight({
            deck: [{ defId: "SWEEPING_BEAM", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE", "STRIKE_BLUE"],
            monsters: ["T_TANK", "T_TANK"],
            seed,
          });
          if (handNames(s).includes("SWEEPING_BEAM")) break;
        }
      }
      const before = handNames(s).length;
      s = play(s, "SWEEPING_BEAM");
      expect(monsterHp(s, 0)).toBe(200 - dmg);
      expect(monsterHp(s, 1)).toBe(200 - dmg);
      expect(handNames(s).length).toBe(before - 1 + 1);
    }
  });
});

describe("TURBO", () => {
  test("+2/3 energy; Void into the discard pile", () => {
    for (const [up, gain] of [
      [0, 2],
      [1, 3],
    ] as const) {
      let s = fight({ deck: [{ defId: "TURBO", upgrades: up }, "ZAP", "ZAP", "ZAP", "DEFEND_BLUE"] });
      s = play(s, "TURBO");
      expect(energy(s)).toBe(3 + gain);
      expect(pileNames(s, "discard")).toContain("VOID");
    }
  });
});
