// Watcher uncommons — behavior tests (base AND upgraded where values differ).

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
  playerPower,
  handNames,
  pileNames,
} from "./watcherTestKit";

describe("BATTLE_HYMN", () => {
  test("adds a Smite to hand at the start of each turn", () => {
    let s = fight({ deck: ["BATTLE_HYMN", ...strikes(4)] });
    s = play(s, "BATTLE_HYMN");
    expect(playerPower(s, "BATTLE_HYMN")).toBe(1);
    s = endTurn(s);
    expect(handNames(s)).toContain("SMITE");
    s = play(s, "SMITE");
    expect(monsterHp(s)).toBe(200 - 12);
    expect(pileNames(s, "exhaust")).toContain("SMITE");
  });

  test("upgraded is Innate (in the opening hand of a 10-card deck)", () => {
    const s = fight({ deck: [{ defId: "BATTLE_HYMN", upgrades: 1 }, ...strikes(9)] });
    expect(handNames(s)).toContain("BATTLE_HYMN");
  });
});

describe("CARVE_REALITY", () => {
  test("deal 6 (10 upgraded) + add a Smite to hand", () => {
    let s = fight({ deck: ["CARVE_REALITY", ...strikes(4)] });
    s = play(s, "CARVE_REALITY");
    expect(monsterHp(s)).toBe(200 - 6);
    expect(handNames(s)).toContain("SMITE");

    let u = fight({ deck: [{ defId: "CARVE_REALITY", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "CARVE_REALITY");
    expect(monsterHp(u)).toBe(200 - 10);
  });
});

describe("COLLECT", () => {
  test("X-cost: a Miracle+ at the start of the next X turns", () => {
    let s = fight({ deck: ["COLLECT", ...defends(4)] });
    s = play(s, "DEFEND_PURPLE"); // energy 2
    s = play(s, "COLLECT"); // X = 2
    expect(energy(s)).toBe(0);
    expect(playerPower(s, "COLLECT")).toBe(2);
    expect(pileNames(s, "exhaust")).toContain("COLLECT");
    s = endTurn(s); // turn 2: miracle 1
    expect(handNames(s)).toContain("MIRACLE");
    expect(instOf(s, "MIRACLE", "hand").upgrades).toBe(1);
    expect(playerPower(s, "COLLECT")).toBe(1);
    s = endTurn(s); // turn 3: miracle 2, power gone
    expect(handNames(s)).toContain("MIRACLE");
    expect(playerPower(s, "COLLECT")).toBeUndefined();
    s = endTurn(s); // turn 4: no NEW miracle (the 2 old ones self-retain in hand)
    expect(handNames(s).filter((n) => n === "MIRACLE").length).toBe(2);
  });

  test("upgraded: X+1 turns", () => {
    let s = fight({ deck: [{ defId: "COLLECT", upgrades: 1 }, ...defends(4)] });
    s = play(s, "DEFEND_PURPLE");
    s = play(s, "DEFEND_PURPLE"); // energy 1
    s = play(s, "COLLECT"); // X = 1, +1
    expect(playerPower(s, "COLLECT")).toBe(2);
  });
});

describe("CONCLUDE", () => {
  test("12 (16 upgraded) to ALL enemies, then the turn ends", () => {
    let s = fight({ deck: ["CONCLUDE", ...strikes(4)], monsters: ["T_WGUARD", "T_WGUARD"] });
    s = play(s, "CONCLUDE");
    expect(monsterHp(s, 0)).toBe(200 - 12);
    expect(monsterHp(s, 1)).toBe(200 - 12);
    expect(s.combat!.turn).toBe(2); // the play itself ended the turn

    let u = fight({ deck: [{ defId: "CONCLUDE", upgrades: 1 }, ...strikes(4)], monsters: ["T_WGUARD"] });
    u = play(u, "CONCLUDE");
    expect(monsterHp(u, 0)).toBe(200 - 16);
  });
});

describe("DECEIVE_REALITY", () => {
  test("block 4 (7 upgraded) + add a Safety to hand", () => {
    let s = fight({ deck: ["DECEIVE_REALITY", ...strikes(4)] });
    s = play(s, "DECEIVE_REALITY");
    expect(block(s)).toBe(4);
    expect(handNames(s)).toContain("SAFETY");

    let u = fight({ deck: [{ defId: "DECEIVE_REALITY", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "DECEIVE_REALITY");
    expect(block(u)).toBe(7);
  });
});

describe("FASTING", () => {
  test("+3 Str/+3 Dex; lose 1 energy at the start of each turn", () => {
    let s = fight({ deck: ["FASTING", ...strikes(4)] });
    s = play(s, "FASTING");
    expect(playerPower(s, "STRENGTH")).toBe(3);
    expect(playerPower(s, "DEXTERITY")).toBe(3);
    expect(playerPower(s, "FASTING")).toBe(1);
    s = endTurn(s);
    expect(energy(s)).toBe(2);
  });

  test("upgraded gives 4/4", () => {
    let s = fight({ deck: [{ defId: "FASTING", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "FASTING");
    expect(playerPower(s, "STRENGTH")).toBe(4);
    expect(playerPower(s, "DEXTERITY")).toBe(4);
  });
});

describe("FEAR_NO_EVIL", () => {
  test("enters Calm only if the target intends to Attack", () => {
    let s = fight({ deck: ["FEAR_NO_EVIL", ...strikes(4)] }); // tank: attack intent
    s = play(s, "FEAR_NO_EVIL");
    expect(monsterHp(s)).toBe(200 - 8);
    expect(stance(s)).toBe("CALM");

    let t = fight({ deck: ["FEAR_NO_EVIL", ...strikes(4)], monsters: ["T_WGUARD"] });
    t = play(t, "FEAR_NO_EVIL");
    expect(stance(t)).toBe("NEUTRAL");
  });

  test("upgraded deals 11", () => {
    let s = fight({ deck: [{ defId: "FEAR_NO_EVIL", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "FEAR_NO_EVIL");
    expect(monsterHp(s)).toBe(200 - 11);
  });
});

describe("FOREIGN_INFLUENCE", () => {
  test("choose 1 of 3 Attacks of any color into the hand; exhausts", () => {
    let s = fight({ deck: ["FOREIGN_INFLUENCE", ...strikes(4)] });
    s = play(s, "FOREIGN_INFLUENCE");
    expect(s.pending?.request.kind).toBe("option");
    const options = (s.pending!.request as { options: string[] }).options;
    expect(options.length).toBe(3);
    s = choose(s, [0]);
    expect(pileNames(s, "exhaust")).toContain("FOREIGN_INFLUENCE");
    const added = s.combat!.player.piles.hand
      .map((iid) => s.combat!.cards[iid]!)
      .find((c) => c.defId !== "STRIKE_PURPLE");
    expect(added).toBeDefined();
    expect(s.combat!.cards[added!.iid]).toBeDefined();
  });

  test("upgraded: the added Attack costs 0 this turn", () => {
    let s = fight({ deck: [{ defId: "FOREIGN_INFLUENCE", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "FOREIGN_INFLUENCE");
    s = choose(s, [1]);
    const added = s.combat!.player.piles.hand
      .map((iid) => s.combat!.cards[iid]!)
      .find((c) => c.defId !== "STRIKE_PURPLE")!;
    expect(added.costForTurn).toBe(0);
  });
});

describe("FORESIGHT", () => {
  test("scry 3 (4 upgraded) at the start of each turn", () => {
    let s = fightWithInHand(["FORESIGHT"], { deck: ["FORESIGHT", ...strikes(14)] });
    s = play(s, "FORESIGHT");
    s = endTurn(s);
    expect(s.pending?.request.kind).toBe("scry");
    expect((s.pending!.request as { iids: number[] }).iids.length).toBe(3);
    const discardBefore = pileNames(s, "discard").length;
    s = choose(s, [0]);
    expect(pileNames(s, "discard").length).toBe(discardBefore + 1);
  });

  test("upgraded scries 4", () => {
    let s = fightWithInHand(["FORESIGHT"], { deck: [{ defId: "FORESIGHT", upgrades: 1 }, ...strikes(14)] });
    s = play(s, "FORESIGHT");
    s = endTurn(s);
    expect((s.pending!.request as { iids: number[] }).iids.length).toBe(4);
    s = choose(s, []);
  });
});

describe("INDIGNATION", () => {
  test("out of Wrath: enter Wrath; in Wrath: 3 (5 upgraded) Vulnerable to ALL", () => {
    let s = fight({ deck: ["INDIGNATION", "INDIGNATION", ...strikes(3)], monsters: ["T_WGUARD", "T_WGUARD"] });
    s = play(s, "INDIGNATION");
    expect(stance(s)).toBe("WRATH");
    expect(monsterPower(s, "VULNERABLE", 0)).toBeUndefined();
    s = play(s, "INDIGNATION");
    expect(monsterPower(s, "VULNERABLE", 0)).toBe(3);
    expect(monsterPower(s, "VULNERABLE", 1)).toBe(3);
  });

  test("upgraded applies 5", () => {
    let s = fight({
      deck: [{ defId: "INDIGNATION", upgrades: 1 }, "CRESCENDO", ...strikes(3)],
      monsters: ["T_WGUARD"],
    });
    s = play(s, "CRESCENDO");
    s = play(s, "INDIGNATION");
    expect(monsterPower(s, "VULNERABLE", 0)).toBe(5);
  });
});

describe("INNER_PEACE", () => {
  test("out of Calm: enter Calm; in Calm: draw 3 (4 upgraded)", () => {
    let s = fightWithInHand(["INNER_PEACE", "INNER_PEACE"], { deck: ["INNER_PEACE", "INNER_PEACE", ...strikes(6)] });
    s = play(s, "INNER_PEACE");
    expect(stance(s)).toBe("CALM");
    const before = handNames(s).length;
    s = play(s, "INNER_PEACE");
    expect(handNames(s).length).toBe(before - 1 + 3);
    expect(stance(s)).toBe("CALM");
  });
});

describe("LIKE_WATER", () => {
  test("end of turn in Calm: gain 5 (7 upgraded) block", () => {
    let s = fight({ deck: ["LIKE_WATER", "TRANQUILITY", ...strikes(3)], hp: 72 });
    s = play(s, "LIKE_WATER");
    s = play(s, "TRANQUILITY");
    s = endTurn(s); // 5 block, tank hits 10
    expect(s.run.hp).toBe(72 - 5);
  });

  test("no block outside Calm; upgraded gives 7", () => {
    let s = fight({ deck: ["LIKE_WATER", ...strikes(4)], hp: 72 });
    s = play(s, "LIKE_WATER");
    s = endTurn(s);
    expect(s.run.hp).toBe(72 - 10);

    let u = fight({ deck: [{ defId: "LIKE_WATER", upgrades: 1 }, "TRANQUILITY", ...strikes(3)], hp: 72 });
    u = play(u, "LIKE_WATER");
    u = play(u, "TRANQUILITY");
    u = endTurn(u);
    expect(u.run.hp).toBe(72 - 3);
  });
});

describe("MEDITATE", () => {
  test("takes a discard card to hand with Retain, enters Calm, ends the turn", () => {
    let s = fight({ deck: ["MEDITATE", "STRIKE_PURPLE", ...defends(3)] });
    s = play(s, "STRIKE_PURPLE");
    s = play(s, "MEDITATE"); // single candidate auto-resolves; turn ends
    expect(s.combat!.turn).toBe(2);
    expect(stance(s)).toBe("CALM");
    expect(handNames(s)).toContain("STRIKE_PURPLE"); // retained through end of turn
    expect(handNames(s).length).toBe(5); // 1 retained + 4 redrawn (5-card deck)
  });

  test("with several candidates it pauses on a choice", () => {
    let s = fight({ deck: ["MEDITATE", ...defends(4)] });
    s = play(s, "DEFEND_PURPLE");
    s = play(s, "DEFEND_PURPLE");
    s = play(s, "MEDITATE");
    expect(s.pending?.request).toMatchObject({ kind: "cards", min: 1, max: 1 });
    s = choose(s, [0]);
    expect(s.combat!.turn).toBe(2);
    expect(stance(s)).toBe("CALM");
  });

  test("upgraded takes 2 cards", () => {
    let s = fight({ deck: [{ defId: "MEDITATE", upgrades: 1 }, "STRIKE_PURPLE", "STRIKE_PURPLE", ...defends(2)] });
    s = play(s, "STRIKE_PURPLE");
    s = play(s, "STRIKE_PURPLE");
    s = play(s, "MEDITATE"); // both candidates auto-taken
    expect(s.combat!.turn).toBe(2);
    expect(handNames(s).filter((n) => n === "STRIKE_PURPLE").length).toBe(2);
  });
});

describe("MENTAL_FORTRESS", () => {
  test("4 (6 upgraded) block on every stance switch", () => {
    let s = fight({ deck: ["MENTAL_FORTRESS", "CRESCENDO", "TRANQUILITY", ...strikes(2)] });
    s = play(s, "MENTAL_FORTRESS");
    s = play(s, "CRESCENDO"); // -> Wrath
    expect(block(s)).toBe(4);
    s = play(s, "TRANQUILITY"); // -> Calm
    expect(block(s)).toBe(8);
  });

  test("upgraded gives 6", () => {
    let s = fight({ deck: [{ defId: "MENTAL_FORTRESS", upgrades: 1 }, "CRESCENDO", ...strikes(3)] });
    s = play(s, "MENTAL_FORTRESS");
    s = play(s, "CRESCENDO");
    expect(block(s)).toBe(6);
  });
});

describe("NIRVANA", () => {
  test("3 (4 upgraded) block whenever you scry", () => {
    let s = fightWithInHand(["NIRVANA", "THIRD_EYE"], { deck: ["NIRVANA", "THIRD_EYE", ...strikes(5)] });
    s = play(s, "NIRVANA");
    s = play(s, "THIRD_EYE");
    s = choose(s, []);
    expect(block(s)).toBe(7 + 3);
  });

  test("upgraded gives 4", () => {
    let s = fightWithInHand(["NIRVANA", "THIRD_EYE"], {
      deck: [{ defId: "NIRVANA", upgrades: 1 }, "THIRD_EYE", ...strikes(5)],
    });
    s = play(s, "NIRVANA");
    s = play(s, "THIRD_EYE");
    s = choose(s, []);
    expect(block(s)).toBe(7 + 4);
  });
});

describe("PERSEVERANCE", () => {
  test("retained; block grows by 2 (3 upgraded) each retain", () => {
    let s = fight({ deck: ["PERSEVERANCE", ...strikes(4)] });
    s = endTurn(s);
    s = endTurn(s); // retained twice: 5 + 2 + 2
    s = play(s, "PERSEVERANCE");
    expect(block(s)).toBe(9);

    let u = fight({ deck: [{ defId: "PERSEVERANCE", upgrades: 1 }, ...strikes(4)] });
    u = endTurn(u); // 7 + 3
    u = play(u, "PERSEVERANCE");
    expect(block(u)).toBe(10);
  });
});

describe("PRAY", () => {
  test("3 (4 upgraded) mantra + shuffle an Insight into the draw pile", () => {
    let s = fight({ deck: ["PRAY", ...strikes(4)] });
    s = play(s, "PRAY");
    expect(mantra(s)).toBe(3);
    expect(pileNames(s, "draw")).toContain("INSIGHT");
  });
});

describe("REACH_HEAVEN", () => {
  test("deal 10 (15 upgraded) + shuffle Through Violence into the draw pile", () => {
    let s = fight({ deck: ["REACH_HEAVEN", ...strikes(4)] });
    s = play(s, "REACH_HEAVEN");
    expect(monsterHp(s)).toBe(200 - 10);
    expect(pileNames(s, "draw")).toContain("THROUGH_VIOLENCE");

    let u = fight({ deck: [{ defId: "REACH_HEAVEN", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "REACH_HEAVEN");
    expect(monsterHp(u)).toBe(200 - 15);
  });
});

describe("RUSHDOWN", () => {
  test("draw 2 whenever you enter Wrath; upgraded costs 0", () => {
    let s = fightWithInHand(["RUSHDOWN", "ERUPTION"], { deck: ["RUSHDOWN", "ERUPTION", ...strikes(5)] });
    const before = handNames(s).length;
    s = play(s, "RUSHDOWN");
    s = play(s, "ERUPTION");
    expect(stance(s)).toBe("WRATH");
    expect(handNames(s).length).toBe(before - 2 + 2);

    let u = fight({ deck: [{ defId: "RUSHDOWN", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "RUSHDOWN");
    expect(energy(u)).toBe(3);
  });
});

describe("SANCTITY", () => {
  test("6 (9 upgraded) block; draw 2 only after a Skill", () => {
    let s = fight({ deck: ["SANCTITY", "DEFEND_PURPLE", ...strikes(3)] });
    s = play(s, "SANCTITY"); // no previous card
    expect(block(s)).toBe(6);
    expect(handNames(s).length).toBe(4);

    let t = fightWithInHand(["SANCTITY", "DEFEND_PURPLE"], { deck: ["SANCTITY", "DEFEND_PURPLE", ...strikes(5)] });
    t = play(t, "DEFEND_PURPLE");
    const before = handNames(t).length;
    t = play(t, "SANCTITY");
    expect(handNames(t).length).toBe(before - 1 + 2);
  });
});

describe("SANDS_OF_TIME", () => {
  test("costs 4 (unplayable at 3 energy); retain drops the cost by 1", () => {
    let s = fight({ deck: ["SANDS_OF_TIME", ...strikes(4)] });
    expect(() => play(s, "SANDS_OF_TIME")).toThrow("not enough energy");
    s = endTurn(s);
    expect(instOf(s, "SANDS_OF_TIME", "hand").cost).toBe(3);
    s = play(s, "SANDS_OF_TIME");
    expect(monsterHp(s)).toBe(200 - 20);
    expect(energy(s)).toBe(0);
  });

  test("upgraded deals 26", () => {
    let s = fight({ deck: [{ defId: "SANDS_OF_TIME", upgrades: 1 }, ...strikes(4)] });
    s = endTurn(s);
    s = play(s, "SANDS_OF_TIME");
    expect(monsterHp(s)).toBe(200 - 26);
  });
});

describe("SIGNATURE_MOVE", () => {
  test("only playable when it is the only Attack in hand", () => {
    let s = fightWithInHand(["SIGNATURE_MOVE", "STRIKE_PURPLE"], {
      deck: ["SIGNATURE_MOVE", "STRIKE_PURPLE", ...defends(3)],
    });
    expect(() => play(s, "SIGNATURE_MOVE")).toThrow("card cannot be used now");
    s = play(s, "STRIKE_PURPLE");
    s = play(s, "SIGNATURE_MOVE");
    expect(monsterHp(s)).toBe(200 - 6 - 30);
  });

  test("upgraded deals 40", () => {
    let s = fight({ deck: [{ defId: "SIGNATURE_MOVE", upgrades: 1 }, ...defends(4)] });
    s = play(s, "SIGNATURE_MOVE");
    expect(monsterHp(s)).toBe(200 - 40);
  });
});

describe("SIMMERING_FURY", () => {
  test("next turn: enter Wrath and draw 2 (3 upgraded) extra", () => {
    let s = fight({ deck: ["SIMMERING_FURY", ...strikes(7)] });
    if (!handNames(s).includes("SIMMERING_FURY")) s = fightWithInHand(["SIMMERING_FURY"], { deck: ["SIMMERING_FURY", ...strikes(7)] });
    s = play(s, "SIMMERING_FURY");
    expect(playerPower(s, "WRATH_NEXT_TURN")).toBe(1);
    expect(playerPower(s, "DRAW_CARD_NEXT_TURN")).toBe(2);
    expect(stance(s)).toBe("NEUTRAL");
    s = endTurn(s);
    expect(stance(s)).toBe("WRATH");
    expect(handNames(s).length).toBe(7);
    expect(playerPower(s, "WRATH_NEXT_TURN")).toBeUndefined();
    expect(playerPower(s, "DRAW_CARD_NEXT_TURN")).toBeUndefined();
  });

  test("upgraded draws 3", () => {
    let s = fightWithInHand(["SIMMERING_FURY"], { deck: [{ defId: "SIMMERING_FURY", upgrades: 1 }, ...strikes(8)] });
    s = play(s, "SIMMERING_FURY");
    s = endTurn(s);
    expect(handNames(s).length).toBe(8);
  });
});

describe("STUDY", () => {
  test("shuffles an Insight into the draw pile at the end of each turn", () => {
    let s = fight({ deck: ["STUDY", ...strikes(4)] });
    s = play(s, "STUDY");
    expect(energy(s)).toBe(1);
    s = endTurn(s);
    const everywhere = [...pileNames(s, "draw"), ...pileNames(s, "hand"), ...pileNames(s, "discard")];
    expect(everywhere.filter((n) => n === "INSIGHT").length).toBe(1);
  });

  test("upgraded costs 1", () => {
    let s = fight({ deck: [{ defId: "STUDY", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "STUDY");
    expect(energy(s)).toBe(2);
  });
});

describe("SWIVEL", () => {
  test("8 (11 upgraded) block; the next Attack costs 0", () => {
    let s = fight({ deck: ["SWIVEL", ...strikes(4)] });
    s = play(s, "SWIVEL"); // energy 1
    expect(block(s)).toBe(8);
    expect(playerPower(s, "FREE_ATTACK_POWER")).toBe(1);
    s = play(s, "STRIKE_PURPLE"); // free
    expect(energy(s)).toBe(1);
    expect(playerPower(s, "FREE_ATTACK_POWER")).toBeUndefined();
    s = play(s, "STRIKE_PURPLE"); // pays again
    expect(energy(s)).toBe(0);
  });

  test("upgraded blocks 11", () => {
    let s = fight({ deck: [{ defId: "SWIVEL", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "SWIVEL");
    expect(block(s)).toBe(11);
  });
});

describe("TALK_TO_THE_HAND", () => {
  test("5 (7) damage; marked enemy grants 2 (3) block per attack; exhausts", () => {
    let s = fight({ deck: ["TALK_TO_THE_HAND", "FLYING_SLEEVES", ...strikes(3)] });
    s = play(s, "TALK_TO_THE_HAND");
    expect(monsterHp(s)).toBe(200 - 5);
    expect(monsterPower(s, "BLOCK_RETURN")).toBe(2);
    expect(pileNames(s, "exhaust")).toContain("TALK_TO_THE_HAND");
    s = play(s, "FLYING_SLEEVES"); // 2 hits -> 2 triggers
    expect(block(s)).toBe(4);
  });

  test("upgraded: 7 damage, 3 block per attack", () => {
    let s = fight({ deck: [{ defId: "TALK_TO_THE_HAND", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "TALK_TO_THE_HAND");
    expect(monsterHp(s)).toBe(200 - 7);
    s = play(s, "STRIKE_PURPLE");
    expect(block(s)).toBe(3);
  });
});

describe("TANTRUM", () => {
  test("3x3 (3x4 upgraded), enter Wrath, shuffles itself into the draw pile", () => {
    let s = fight({ deck: ["TANTRUM", ...strikes(4)] });
    s = play(s, "TANTRUM");
    expect(monsterHp(s)).toBe(200 - 9);
    expect(stance(s)).toBe("WRATH");
    expect(pileNames(s, "discard")).not.toContain("TANTRUM");
    expect(pileNames(s, "draw")).toContain("TANTRUM");

    let u = fight({ deck: [{ defId: "TANTRUM", upgrades: 1 }, ...strikes(4)] });
    u = play(u, "TANTRUM");
    expect(monsterHp(u)).toBe(200 - 12);
  });
});

describe("WALLOP", () => {
  test("gains block equal to UNBLOCKED damage dealt", () => {
    let s = fight({ deck: ["WALLOP", ...strikes(4)], monsters: ["T_WGUARD"] });
    s = endTurn(s); // guard has 5 block now
    s = play(s, "WALLOP"); // 9: 5 blocked, 4 through
    expect(monsterHp(s)).toBe(200 - 4);
    expect(block(s)).toBe(4);
  });

  test("no block on a fully blocked hit; upgraded deals 12", () => {
    let u = fight({ deck: [{ defId: "WALLOP", upgrades: 1 }, ...strikes(4)], monsters: ["T_WGUARD"] });
    u = endTurn(u);
    u = play(u, "WALLOP"); // 12: 5 blocked, 7 through
    expect(monsterHp(u)).toBe(200 - 7);
    expect(block(u)).toBe(7);
  });
});

describe("WAVE_OF_THE_HAND", () => {
  test("this turn, gaining block applies 1 (2 upgraded) Weak to ALL enemies", () => {
    let s = fight({ deck: ["WAVE_OF_THE_HAND", ...defends(4)], monsters: ["T_WTANK", "T_WGUARD"] });
    s = play(s, "WAVE_OF_THE_HAND");
    s = play(s, "DEFEND_PURPLE");
    expect(monsterPower(s, "WEAK", 0)).toBe(1);
    expect(monsterPower(s, "WEAK", 1)).toBe(1);
    s = endTurn(s); // power expires with the turn
    expect(playerPower(s, "WAVE_OF_THE_HAND")).toBeUndefined();
    s = play(s, "DEFEND_PURPLE");
    expect(monsterPower(s, "WEAK", 0)).toBeUndefined(); // turn-1 weak ticked away too
  });

  test("upgraded applies 2", () => {
    let s = fight({ deck: [{ defId: "WAVE_OF_THE_HAND", upgrades: 1 }, ...defends(4)] });
    s = play(s, "WAVE_OF_THE_HAND");
    s = play(s, "DEFEND_PURPLE");
    expect(monsterPower(s, "WEAK", 0)).toBe(2);
  });
});

describe("WEAVE", () => {
  test("returns from the discard pile to the hand whenever you scry", () => {
    let s = fightWithInHand(["WEAVE", "THIRD_EYE"], { deck: ["WEAVE", "THIRD_EYE", ...strikes(5)] });
    s = play(s, "WEAVE");
    expect(monsterHp(s)).toBe(200 - 4);
    expect(pileNames(s, "discard")).toContain("WEAVE");
    s = play(s, "THIRD_EYE");
    s = choose(s, []);
    expect(handNames(s)).toContain("WEAVE");
    expect(pileNames(s, "discard")).not.toContain("WEAVE");
  });

  test("upgraded deals 6", () => {
    let s = fight({ deck: [{ defId: "WEAVE", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "WEAVE");
    expect(monsterHp(s)).toBe(200 - 6);
  });
});

describe("WHEEL_KICK", () => {
  test("deal 15 (20 upgraded) and draw 2", () => {
    let s = fightWithInHand(["WHEEL_KICK"], { deck: ["WHEEL_KICK", ...strikes(6)] });
    const before = handNames(s).length;
    s = play(s, "WHEEL_KICK");
    expect(monsterHp(s)).toBe(200 - 15);
    expect(handNames(s).length).toBe(before - 1 + 2);
  });

  test("upgraded deals 20", () => {
    let s = fight({ deck: [{ defId: "WHEEL_KICK", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "WHEEL_KICK");
    expect(monsterHp(s)).toBe(200 - 20);
  });
});

describe("WINDMILL_STRIKE", () => {
  test("retained; damage grows by 4 (5 upgraded) each retain", () => {
    let s = fight({ deck: ["WINDMILL_STRIKE", ...strikes(4)] });
    s = endTurn(s);
    s = endTurn(s); // 7 + 4 + 4
    s = play(s, "WINDMILL_STRIKE");
    expect(monsterHp(s)).toBe(200 - 15);

    let u = fight({ deck: [{ defId: "WINDMILL_STRIKE", upgrades: 1 }, ...strikes(4)] });
    u = endTurn(u); // 10 + 5
    u = play(u, "WINDMILL_STRIKE");
    expect(monsterHp(u)).toBe(200 - 15);
  });
});

describe("WORSHIP", () => {
  test("gain 5 mantra; base is NOT retained, upgraded is", () => {
    let s = fight({ deck: ["WORSHIP", ...strikes(4)] });
    s = play(s, "WORSHIP");
    expect(mantra(s)).toBe(5);

    // 10-card decks so the turn-2 redraw can't mask where Worship went
    let b = fightWithInHand(["WORSHIP"], { deck: ["WORSHIP", ...strikes(9)] });
    b = endTurn(b);
    expect(pileNames(b, "discard")).toContain("WORSHIP");

    let u = fightWithInHand(["WORSHIP"], { deck: [{ defId: "WORSHIP", upgrades: 1 }, ...strikes(9)] });
    u = endTurn(u);
    expect(handNames(u)).toContain("WORSHIP");
  });
});

describe("WREATH_OF_FLAME", () => {
  test("next Attack deals +5 (+8 upgraded); Vigor is then consumed", () => {
    let s = fight({ deck: ["WREATH_OF_FLAME", ...strikes(4)] });
    s = play(s, "WREATH_OF_FLAME");
    expect(playerPower(s, "VIGOR")).toBe(5);
    s = play(s, "STRIKE_PURPLE");
    expect(monsterHp(s)).toBe(200 - 11);
    expect(playerPower(s, "VIGOR")).toBeUndefined();
    s = play(s, "STRIKE_PURPLE");
    expect(monsterHp(s)).toBe(200 - 11 - 6);
  });

  test("upgraded gives 8", () => {
    let s = fight({ deck: [{ defId: "WREATH_OF_FLAME", upgrades: 1 }, ...strikes(4)] });
    s = play(s, "WREATH_OF_FLAME");
    s = play(s, "STRIKE_PURPLE");
    expect(monsterHp(s)).toBe(200 - 14);
  });
});
