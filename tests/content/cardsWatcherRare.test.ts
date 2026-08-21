// Watcher rares - behavior tests (base AND upgraded where values differ).

import { test, expect, describe } from "bun:test";
import {
  fight,
  fightWithInHand,
  play,
  endTurn,
  choose,
  stance,
  energy,
  mantra,
  block,
  instOf,
  strikes,
  defends,
  monsterHp,
  playerPower,
  handNames,
  pileNames,
} from "./watcherTestKit";

describe("ALPHA", () => {
  test("shuffles a Beta into the draw pile; exhausts; Beta chains to Omega", () => {
    let s = fight({ deck: ["ALPHA", ...strikes(4)] });
    s = play(s, "ALPHA");
    expect(pileNames(s, "draw")).toContain("BETA");
    expect(pileNames(s, "exhaust")).toEqual(["ALPHA"]);
    s = endTurn(s);
    s = play(s, "BETA");
    expect(pileNames(s, "draw")).toContain("OMEGA");
  });

  test("upgraded is Innate", () => {
    const s = fight({ deck: [{ defId: "ALPHA", upgrades: 1 }, ...strikes(9)] });
    expect(handNames(s)).toContain("ALPHA");
  });
});

describe("BLASPHEMY", () => {
  test("enter Divinity (+3 energy, x3 damage); die at the start of next turn", () => {
    let s = fight({ deck: ["BLASPHEMY", ...strikes(4)], hp: 72 });
    s = play(s, "BLASPHEMY");
    expect(stance(s)).toBe("DIVINITY");
    expect(energy(s)).toBe(3 - 1 + 3);
    expect(pileNames(s, "exhaust")).toContain("BLASPHEMY");
    s = play(s, "STRIKE_PURPLE");
    expect(monsterHp(s)).toBe(200 - 18);
    s = endTurn(s); // Divinity exits; tank hits 10; then the power kills us
    expect(s.outcome).toEqual({ kind: "death" });
    expect(s.run.hp).toBe(0);
  });

  test("upgraded is Retained", () => {
    let s = fightWithInHand(["BLASPHEMY"], { deck: [{ defId: "BLASPHEMY", upgrades: 1 }, ...strikes(9)] });
    s = endTurn(s);
    expect(handNames(s)).toContain("BLASPHEMY");
  });
});

describe("BRILLIANCE", () => {
  test("base 12 (16 upgraded) + mantra gained this combat", () => {
    let s = fightWithInHand(["BRILLIANCE", "WORSHIP"], { deck: ["BRILLIANCE", "WORSHIP", ...strikes(3)] });
    s = play(s, "WORSHIP");
    s = play(s, "BRILLIANCE");
    expect(monsterHp(s)).toBe(200 - (12 + 5));
  });

  test("counts raw relic mantra (Damaru) via reconciliation", () => {
    let s = fightWithInHand(["BRILLIANCE"], { deck: ["BRILLIANCE", ...strikes(4)], relics: ["DAMARU"] });
    expect(mantra(s)).toBe(1); // Damaru start-of-turn mantra
    s = play(s, "BRILLIANCE");
    expect(monsterHp(s)).toBe(200 - 13);
  });

  test("mantra consumed by a Divinity entry still counts", () => {
    let s = fight({ deck: ["WORSHIP", "WORSHIP", "BRILLIANCE", ...defends(2)] });
    s = play(s, "WORSHIP");
    s = endTurn(s);
    s = play(s, "WORSHIP"); // 10 mantra -> Divinity (+3 energy)
    expect(stance(s)).toBe("DIVINITY");
    s = play(s, "BRILLIANCE"); // (12 + 10) x3 in Divinity
    expect(monsterHp(s)).toBe(200 - 66);
  });

  test("a direct Divinity entry (Blasphemy) does NOT count as +10", () => {
    let s = fightWithInHand(["BLASPHEMY", "BRILLIANCE", "WORSHIP"], {
      deck: ["BLASPHEMY", "BRILLIANCE", "WORSHIP", ...strikes(2)],
    });
    s = play(s, "WORSHIP"); // 5 tracked mantra, energy 1
    s = play(s, "BLASPHEMY"); // Divinity directly, +3 energy
    s = play(s, "BRILLIANCE"); // (12 + 5) x3
    expect(monsterHp(s)).toBe(200 - 51);
  });

  test("upgraded deals 16 base", () => {
    let s = fight({ deck: [{ defId: "BRILLIANCE", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "BRILLIANCE");
    expect(monsterHp(s)).toBe(200 - 16);
  });
});

describe("CONJURE_BLADE", () => {
  test("shuffles an Expunger with X hits into the draw pile; exhausts", () => {
    let s = fight({ deck: ["CONJURE_BLADE", ...strikes(4)] });
    s = play(s, "CONJURE_BLADE"); // X = 3
    expect(energy(s)).toBe(0);
    expect(pileNames(s, "exhaust")).toEqual(["CONJURE_BLADE"]);
    expect(instOf(s, "EXPUNGER", "draw").misc).toBe(3);
    s = endTurn(s);
    s = play(s, "EXPUNGER");
    expect(monsterHp(s)).toBe(200 - 27); // 9 x 3
  });

  test("upgraded shuffles X+1", () => {
    let s = fight({ deck: [{ defId: "CONJURE_BLADE", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "CONJURE_BLADE"); // X = 3, +1
    expect(instOf(s, "EXPUNGER", "draw").misc).toBe(4);
    s = endTurn(s);
    s = play(s, "EXPUNGER");
    expect(monsterHp(s)).toBe(200 - 36);
  });
});

describe("DEUS_EX_MACHINA", () => {
  test("unplayable; when drawn adds 2 (3 upgraded) Miracles and exhausts", () => {
    // 5-card deck: the whole deck is drawn on turn 1, so the trigger is certain
    let s = fight({ deck: ["DEUS_EX_MACHINA", ...strikes(4)] });
    expect(pileNames(s, "exhaust")).toEqual(["DEUS_EX_MACHINA"]);
    expect(handNames(s).filter((n) => n === "MIRACLE").length).toBe(2);
    s = play(s, "MIRACLE");
    expect(energy(s)).toBe(4);

    const u = fight({ deck: [{ defId: "DEUS_EX_MACHINA", upgrades: 1 }, ...strikes(4)] });
    expect(handNames(u).filter((n) => n === "MIRACLE").length).toBe(3);
  });
});

describe("DEVA_FORM", () => {
  test("energy at turn start grows by 1 each turn", () => {
    let s = fight({ deck: ["DEVA_FORM", ...strikes(4)] });
    s = play(s, "DEVA_FORM"); // all 3 energy
    s = endTurn(s);
    expect(energy(s)).toBe(3 + 1);
    s = endTurn(s);
    expect(energy(s)).toBe(3 + 2);
  });

  test("base is Ethereal (exhausts in hand); upgraded is not", () => {
    let b = fightWithInHand(["DEVA_FORM"], { deck: ["DEVA_FORM", ...strikes(9)] });
    b = endTurn(b);
    expect(pileNames(b, "exhaust")).toEqual(["DEVA_FORM"]);

    let u = fightWithInHand(["DEVA_FORM"], { deck: [{ defId: "DEVA_FORM", upgrades: 1 }, ...strikes(9)] });
    u = endTurn(u);
    expect(pileNames(u, "exhaust")).toEqual([]);
    expect(pileNames(u, "discard")).toContain("DEVA_FORM");
  });
});

describe("DEVOTION", () => {
  test("gain 2 (3 upgraded) mantra at the start of each turn", () => {
    let s = fight({ deck: ["DEVOTION", ...strikes(4)] });
    s = play(s, "DEVOTION");
    expect(mantra(s)).toBe(0);
    s = endTurn(s);
    expect(mantra(s)).toBe(2);
    s = endTurn(s);
    expect(mantra(s)).toBe(4);

    let u = fight({ deck: [{ defId: "DEVOTION", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "DEVOTION");
    u = endTurn(u);
    expect(mantra(u)).toBe(3);
  });
});

describe("ESTABLISHMENT", () => {
  test("retained cards cost 1 less for the combat", () => {
    let s = fight({ deck: ["ESTABLISHMENT", "PROTECT", ...strikes(3)] });
    s = play(s, "ESTABLISHMENT");
    s = endTurn(s); // Protect retained -> cost 2 -> 1
    expect(instOf(s, "PROTECT", "hand").cost).toBe(1);
    s = play(s, "PROTECT");
    expect(energy(s)).toBe(2);
    expect(block(s)).toBe(12);
  });

  test("upgraded is Innate", () => {
    const s = fight({ deck: [{ defId: "ESTABLISHMENT", upgrades: 1 }, ...strikes(9)] });
    expect(handNames(s)).toContain("ESTABLISHMENT");
  });
});

describe("JUDGMENT", () => {
  test("kills at <= 30 HP; upgraded threshold is 40", () => {
    // 35 HP target: base does nothing, upgraded kills
    let s = fight({ deck: ["JUDGMENT", ...strikes(4)], monsters: ["T_WMID"] });
    s = play(s, "JUDGMENT");
    expect(monsterHp(s)).toBe(35);
    expect(s.combat!.monsters[0]!.isDead).toBe(false);

    let u = fight({ deck: [{ defId: "JUDGMENT", upgrades: 1 }, ...strikes(4)], monsters: ["T_WMID"] });
    u = play(u, "JUDGMENT");
    expect(monsterHp(u)).toBe(0);
    expect(u.combat!.monsters[0]!.isDead).toBe(true);
  });

  test("base kills an 8 HP enemy without dealing attack damage", () => {
    let s = fight({ deck: ["JUDGMENT", ...strikes(4)], monsters: ["T_WFRAIL"] });
    s = play(s, "JUDGMENT");
    expect(monsterHp(s)).toBe(0);
    expect(s.combat!.monsters[0]!.isDead).toBe(true);
  });
});

describe("LESSON_LEARNED", () => {
  test("on fatal: a random deck card is permanently upgraded; exhausts", () => {
    let s = fight({ deck: ["LESSON_LEARNED", ...strikes(4)], monsters: ["T_WFRAIL"] });
    expect(s.run.deck.every((c) => c.upgrades === 0)).toBe(true);
    s = play(s, "LESSON_LEARNED"); // 10 vs 8 HP: fatal
    expect(s.combat!.monsters[0]!.isDead).toBe(true);
    expect(s.run.deck.filter((c) => c.upgrades > 0).length).toBe(1);
    expect(pileNames(s, "exhaust")).toContain("LESSON_LEARNED");
  });

  test("no upgrade when not fatal; upgraded deals 13", () => {
    let s = fight({ deck: ["LESSON_LEARNED", ...strikes(4)] });
    s = play(s, "LESSON_LEARNED");
    expect(monsterHp(s)).toBe(200 - 10);
    expect(s.run.deck.every((c) => c.upgrades === 0)).toBe(true);

    let u = fight({ deck: [{ defId: "LESSON_LEARNED", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "LESSON_LEARNED");
    expect(monsterHp(u)).toBe(200 - 13);
  });
});

describe("MASTER_REALITY", () => {
  test("cards created in combat are upgraded (Smite+ from Carve Reality)", () => {
    let s = fight({ deck: ["MASTER_REALITY", "CARVE_REALITY", ...strikes(3)] });
    s = play(s, "MASTER_REALITY");
    s = play(s, "CARVE_REALITY");
    expect(instOf(s, "SMITE", "hand").upgrades).toBe(1);
    s = play(s, "SMITE");
    expect(monsterHp(s)).toBe(200 - 6 - 16); // Smite+ deals 16
  });

  test("upgraded costs 0", () => {
    let s = fight({ deck: [{ defId: "MASTER_REALITY", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "MASTER_REALITY");
    expect(energy(s)).toBe(3);
  });
});

describe("OMNISCIENCE", () => {
  test("plays a chosen draw-pile card twice, exhausting it (and itself)", () => {
    let s = fightWithInHand(["OMNISCIENCE", "MIRACLE"], { deck: ["OMNISCIENCE", "MIRACLE", ...strikes(5)] });
    s = play(s, "MIRACLE"); // energy 4
    s = play(s, "OMNISCIENCE"); // pays 4
    expect(s.pending?.request).toMatchObject({ kind: "cards", pile: "draw" });
    s = choose(s, [0]); // a Strike: played twice
    expect(monsterHp(s)).toBe(200 - 12);
    expect(energy(s)).toBe(0);
    expect(pileNames(s, "exhaust")).toContain("OMNISCIENCE");
    expect(pileNames(s, "exhaust")).toContain("STRIKE_PURPLE");
  });

  test("upgraded costs 3; single-candidate draw pile auto-resolves", () => {
    let s = fightWithInHand(["OMNISCIENCE"], { deck: [{ defId: "OMNISCIENCE", upgrades: 1 }, ...strikes(5)] });
    s = play(s, "OMNISCIENCE");
    expect(s.pending).toBeNull(); // one card in draw: auto-played twice
    expect(monsterHp(s)).toBe(200 - 12);
  });
});

describe("RAGNAROK", () => {
  test("5 (6 upgraded) hits of 5 (6) at random enemies", () => {
    let s = fight({ deck: ["RAGNAROK", ...strikes(4)] });
    s = play(s, "RAGNAROK");
    expect(monsterHp(s)).toBe(200 - 25);

    let m = fight({ deck: ["RAGNAROK", ...strikes(4)], monsters: ["T_WGUARD", "T_WGUARD"] });
    m = play(m, "RAGNAROK");
    expect(200 - monsterHp(m, 0) + (200 - monsterHp(m, 1))).toBe(25);

    let u = fight({ deck: [{ defId: "RAGNAROK", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "RAGNAROK");
    expect(monsterHp(u)).toBe(200 - 36);
  });
});

describe("SCRAWL", () => {
  test("draws until the hand is full; exhausts; upgraded costs 0", () => {
    let s = fightWithInHand(["SCRAWL"], { deck: ["SCRAWL", ...strikes(11)] });
    s = play(s, "SCRAWL");
    expect(handNames(s).length).toBe(10);
    expect(pileNames(s, "exhaust")).toEqual(["SCRAWL"]);
    expect(energy(s)).toBe(2);

    let u = fightWithInHand(["SCRAWL"], { deck: [{ defId: "SCRAWL", upgrades: 1 }, ...strikes(11)] });
    u = play(u, "SCRAWL");
    expect(handNames(u).length).toBe(10);
    expect(energy(u)).toBe(3);
  });
});

describe("SPIRIT_SHIELD", () => {
  test("3 (4 upgraded) block per card in hand", () => {
    let s = fight({ deck: ["SPIRIT_SHIELD", ...strikes(4)] });
    s = play(s, "SPIRIT_SHIELD"); // 4 other cards in hand
    expect(block(s)).toBe(12);

    let u = fight({ deck: [{ defId: "SPIRIT_SHIELD", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "SPIRIT_SHIELD");
    expect(block(u)).toBe(16);
  });
});

describe("VAULT", () => {
  test("ends the turn, skips the monster turn, still ticks round-end powers", () => {
    let s = fight({
      deck: ["VAULT", { defId: "CRUSH_JOINTS", upgrades: 1 }, "DEFEND_PURPLE", ...strikes(2)],
      hp: 72,
    });
    s = play(s, "DEFEND_PURPLE");
    s = play(s, "CRUSH_JOINTS"); // after a skill: 2 Vulnerable (upgraded)
    expect(s.combat!.monsters[0]!.powers.find((p) => p.id === "VULNERABLE")?.amount).toBe(2);
    s = endTurn(s); // tank hits 10 into 5 block; vulnerable ticks 2 -> 1
    expect(s.run.hp).toBe(72 - 5);
    expect(s.combat!.monsters[0]!.powers.find((p) => p.id === "VULNERABLE")?.amount).toBe(1);
    s = play(s, "VAULT");
    expect(s.combat!.turn).toBe(3); // extra turn started
    expect(s.run.hp).toBe(72 - 5); // the tank did NOT act this round
    expect(pileNames(s, "exhaust")).toContain("VAULT");
    // ...but the round-end duration tick still happened
    expect(s.combat!.monsters[0]!.powers.find((p) => p.id === "VULNERABLE")).toBeUndefined();
    // the skip is consumed: ending this turn lets the monster act again
    s = endTurn(s);
    expect(s.run.hp).toBe(72 - 5 - 10);
  });

  test("upgraded costs 2", () => {
    let s = fight({ deck: [{ defId: "VAULT", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "STRIKE_PURPLE");
    s = play(s, "VAULT"); // 2 energy left, costs 2
    expect(s.combat!.turn).toBe(2);
  });
});

describe("WISH", () => {
  test("choose one: 6 Plated Armor / 3 Strength / 25 Gold (8/4/30 upgraded)", () => {
    let a = fight({ deck: ["WISH", ...strikes(4)] });
    a = play(a, "WISH");
    expect(a.pending?.request.kind).toBe("option");
    a = choose(a, [0]);
    expect(playerPower(a, "PLATED_ARMOR")).toBe(6);
    expect(pileNames(a, "exhaust")).toContain("WISH");

    let b = fight({ deck: ["WISH", ...strikes(4)] });
    b = play(b, "WISH");
    b = choose(b, [1]);
    expect(playerPower(b, "STRENGTH")).toBe(3);

    let c = fight({ deck: ["WISH", ...strikes(4)] });
    c = play(c, "WISH");
    c = choose(c, [2]);
    expect(c.run.gold).toBe(99 + 25);

    let u = fight({ deck: [{ defId: "WISH", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "WISH");
    u = choose(u, [0]);
    expect(playerPower(u, "PLATED_ARMOR")).toBe(8);
  });
});
