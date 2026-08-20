// Orb runtime + orb-definition tests: corpus-exact passive/evoke values, Focus
// application (incl. the floor at 0 for output orbs and Dark's growth-only
// Focus), Plasma's start-of-turn timing, overflow auto-evoke, Loop,
// Electrodynamics all-target Lightning, Lock-On x1.5, and the Cracked Core
// battle-start channel. Player: Defect 75 HP, 3 energy, 3 orb slots.
// T_TANK: 200 HP, attacks 10 every turn. T_GUARD: never attacks.

import { test, expect, describe } from "bun:test";
import corpus from "../../data/corpus/orbs.json";
import { allOrbs } from "../../src/content/orbs";
import {
  fight,
  play,
  endTurn,
  monsterHp,
  playerPower,
  energy,
  block,
  orbIds,
  orbAmounts,
} from "./defectKit";

interface CorpusOrb {
  id: string;
  passive: { base: number; timing: string };
  evoke: { base: number };
  focusApplies: { passive: boolean; evoke: boolean };
}

describe("corpus audit: orb envelope", () => {
  const byId = new Map(allOrbs.map((o) => [o.id, o]));
  for (const o of corpus as CorpusOrb[]) {
    test(`${o.id}`, () => {
      const def = byId.get(o.id);
      expect(def).toBeDefined();
      if (!def) return;
      expect(def.passiveBase).toBe(o.passive.base);
      expect(def.evokeBase).toBe(o.evoke.base);
      // usesFocus mirrors focusApplies.passive (DARK: growth-only; PLASMA: never)
      expect(def.usesFocus).toBe(o.focusApplies.passive);
    });
  }
  test("exactly the four orbs", () => {
    expect(allOrbs.map((o) => o.id).sort()).toEqual(["DARK", "FROST", "LIGHTNING", "PLASMA"]);
  });
});

describe("LIGHTNING", () => {
  test("passive deals 3 to a random enemy at end of turn; evoke deals 8", () => {
    let s = fight({ deck: ["ZAP", "ZAP", "DUALCAST", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "ZAP");
    expect(orbIds(s)).toEqual(["LIGHTNING"]);
    s = endTurn(s);
    expect(monsterHp(s)).toBe(197); // passive 3
    s = play(s, "DUALCAST"); // evoke twice: 8 + 8
    expect(monsterHp(s)).toBe(181);
    expect(orbIds(s)).toEqual([]);
  });

  test("Focus adds to passive and evoke; negative Focus floors at 0", () => {
    // +1 Focus: passive 4, evoke 9
    let s = fight({ deck: ["ZAP", "DEFRAGMENT", "DUALCAST", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "DEFRAGMENT");
    s = play(s, "ZAP");
    s = play(s, "DUALCAST"); // evoke twice: (8+1) x2
    expect(monsterHp(s)).toBe(182);

    // -5 Focus (Reprogram x2 = -2, Hyperbeam -3): passive max(0, 3-5) = 0
    let t = fight({ deck: ["ZAP", "REPROGRAM", "REPROGRAM", "HYPERBEAM", "TURBO"] });
    t = play(t, "TURBO"); // +2 energy
    t = play(t, "REPROGRAM");
    t = play(t, "REPROGRAM");
    t = play(t, "HYPERBEAM"); // 26 dmg, -3 Focus
    expect(playerPower(t, "FOCUS")).toBe(-5);
    t = play(t, "ZAP");
    const hpBefore = monsterHp(t);
    t = endTurn(t);
    expect(monsterHp(t)).toBe(hpBefore); // floored at 0 — no damage
  });
});

describe("FROST", () => {
  test("passive grants 2 Block at end of turn (reduces incoming attack)", () => {
    let s = fight({ deck: ["COOLHEADED", "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE", "STRIKE_BLUE"] });
    s = play(s, "COOLHEADED");
    expect(orbIds(s)).toEqual(["FROST"]);
    s = endTurn(s); // +2 block, tank hits 10 -> lose 8
    expect(s.run.hp).toBe(67);
  });

  test("evoke grants 5 Block (+Focus); no Dexterity involvement", () => {
    let s = fight({ deck: ["COOLHEADED", "DEFRAGMENT", "DUALCAST", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "DEFRAGMENT"); // +1 Focus
    s = play(s, "COOLHEADED");
    s = play(s, "DUALCAST"); // evoke twice: (5+1) x2
    expect(block(s)).toBe(12);
  });
});

describe("DARK", () => {
  test("starts storing 6; grows 6 (+Focus) at end of turn; Focus never touches the initial 6", () => {
    let s = fight({ deck: ["DARKNESS", "DEFRAGMENT", "DUALCAST", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "DEFRAGMENT"); // +1 Focus
    s = play(s, "DARKNESS");
    expect(orbIds(s)).toEqual(["DARK"]);
    expect(orbAmounts(s)).toEqual([0]); // accumulated growth starts at 0 (stored total 6)
    s = endTurn(s); // growth 6+1 = 7
    expect(orbAmounts(s)).toEqual([7]);
    // evoke deals stored total = 6 + 7 = 13, twice via Dualcast
    const hpBefore = monsterHp(s);
    s = play(s, "DUALCAST");
    expect(monsterHp(s)).toBe(hpBefore - 26);
  });

  test("growth floors at 0 under heavily negative Focus", () => {
    const up = { defId: "REPROGRAM", upgrades: 1 };
    let s = fight({ deck: ["DARKNESS", up, up, "HYPERBEAM", "TURBO"] });
    s = play(s, "TURBO");
    s = play(s, "REPROGRAM"); // -2 Focus each (upgraded)
    s = play(s, "REPROGRAM");
    s = play(s, "HYPERBEAM"); // -3 more: Focus -7
    expect(playerPower(s, "FOCUS")).toBe(-7);
    s = play(s, "DARKNESS");
    s = endTurn(s); // growth max(0, 6-7) = 0
    expect(orbAmounts(s)).toEqual([0]);
  });

  test("evoke targets the enemy with the lowest HP", () => {
    let s = fight({ deck: ["DARKNESS", "STRIKE_BLUE", "DUALCAST", "DEFEND_BLUE", "DEFEND_BLUE"], monsters: ["T_GUARD", "T_GUARD"] });
    s = play(s, "STRIKE_BLUE", 1); // second guard down to 194
    s = play(s, "DARKNESS");
    s = play(s, "DUALCAST"); // evoke: 6 twice at the lowest-HP enemy
    expect(monsterHp(s, 0)).toBe(200);
    expect(monsterHp(s, 1)).toBe(182);
  });
});

describe("PLASMA", () => {
  test("passive fires at the START of turn: +1 energy; Focus never applies", () => {
    let s = fight({ deck: ["FUSION", "DEFRAGMENT", "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE"] });
    s = play(s, "DEFRAGMENT"); // +1 Focus must NOT raise plasma output
    s = play(s, "FUSION");
    expect(energy(s)).toBe(0);
    s = endTurn(s);
    expect(energy(s)).toBe(4); // 3 + 1 plasma (not 3 + 2)
    expect(orbIds(s)).toEqual(["PLASMA"]);
  });

  test("evoke grants 2 energy", () => {
    let s = fight({ deck: ["FUSION", "DUALCAST", "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE"] });
    s = play(s, "FUSION"); // 3 -> 1
    s = play(s, "DUALCAST"); // 1 -> 0, evoke twice: +4
    expect(energy(s)).toBe(4);
  });
});

describe("orb slots & overflow", () => {
  test("channeling into full slots auto-evokes the oldest orb", () => {
    let s = fight({ deck: ["ZAP", "ZAP", "ZAP", "COOLHEADED", "TURBO"] });
    s = play(s, "TURBO"); // +2 energy
    s = play(s, "COOLHEADED"); // FROST
    s = play(s, "ZAP");
    s = play(s, "ZAP");
    expect(orbIds(s)).toEqual(["FROST", "LIGHTNING", "LIGHTNING"]); // slots full
    s = play(s, "ZAP"); // overflow: FROST evokes (+5 block), new LIGHTNING channels
    expect(block(s)).toBe(5);
    expect(orbIds(s)).toEqual(["LIGHTNING", "LIGHTNING", "LIGHTNING"]);
  });

  test("overflow-evoked DARK deals its accumulated amount", () => {
    let s = fight({ deck: ["DARKNESS", "ZAP", "ZAP", "ZAP", "TURBO"] });
    s = play(s, "TURBO");
    s = play(s, "DARKNESS");
    s = play(s, "ZAP");
    s = play(s, "ZAP");
    s = endTurn(s); // dark grows to 6; two lightning passives hit 3+3
    const hp = monsterHp(s);
    s = play(s, "ZAP"); // overflow: DARK evokes for 6+6 = 12 at lowest-HP enemy
    expect(monsterHp(s)).toBe(hp - 12);
  });
});

describe("LOOP power", () => {
  test("start of turn triggers the FIRST orb's passive amount times", () => {
    let s = fight({ deck: ["LOOP", "ZAP", "COOLHEADED", "DEFEND_BLUE", "DEFEND_BLUE"] });
    s = play(s, "LOOP");
    s = play(s, "ZAP");
    s = play(s, "COOLHEADED"); // orbs: [LIGHTNING, FROST] — Loop hits index 0 only
    s = endTurn(s); // end-of-turn passives: 3 (L) dmg; start of turn: Loop -> L passive again
    expect(monsterHp(s)).toBe(194);
  });

  test("upgraded Loop stacks: 2 triggers", () => {
    let s = fight({ deck: [{ defId: "LOOP", upgrades: 1 }, "ZAP", "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE"] });
    s = play(s, "LOOP");
    s = play(s, "ZAP");
    s = endTurn(s); // 3 at end of turn + 2x3 at start of next
    expect(monsterHp(s)).toBe(191);
  });

  test("Loop on a Plasma front orb grants energy", () => {
    let s = fight({ deck: ["LOOP", "FUSION", "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE"] });
    s = play(s, "LOOP");
    s = play(s, "FUSION");
    s = endTurn(s); // start of turn: plasma passive (+1) + Loop trigger (+1)
    expect(energy(s)).toBe(5);
  });
});

describe("ELECTRO (Electrodynamics)", () => {
  test("lightning passive and evoke hit ALL enemies", () => {
    let s = fight({
      deck: ["ELECTRODYNAMICS", "DUALCAST", "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE"],
      monsters: ["T_TANK", "T_TANK"],
    });
    s = play(s, "ELECTRODYNAMICS"); // channel 2 lightning
    expect(orbIds(s)).toEqual(["LIGHTNING", "LIGHTNING"]);
    s = play(s, "DUALCAST"); // evoke oldest twice: 8 to ALL, twice
    expect(monsterHp(s, 0)).toBe(184);
    expect(monsterHp(s, 1)).toBe(184);
    s = endTurn(s); // remaining lightning passive: 3 to ALL
    expect(monsterHp(s, 0)).toBe(181);
    expect(monsterHp(s, 1)).toBe(181);
  });

  test("upgraded channels 3 lightning", () => {
    let s = fight({ deck: [{ defId: "ELECTRODYNAMICS", upgrades: 1 }, "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE", "STRIKE_BLUE"] });
    s = play(s, "ELECTRODYNAMICS");
    expect(orbIds(s)).toEqual(["LIGHTNING", "LIGHTNING", "LIGHTNING"]);
  });
});

describe("LOCK_ON", () => {
  test("lightning orb damage x1.5 (floored) on the marked enemy; frost unaffected", () => {
    let s = fight({ deck: ["BULLSEYE", "ZAP", "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE"] });
    s = play(s, "BULLSEYE"); // 8 dmg + LOCK_ON 2
    expect(monsterPowerAmount(s, "LOCK_ON")).toBe(2);
    s = play(s, "ZAP");
    s = endTurn(s); // passive floor(3 * 1.5) = 4
    expect(monsterHp(s)).toBe(200 - 8 - 4);
  });

  test("dark evoke is amplified too", () => {
    let s = fight({ deck: ["BULLSEYE", "DARKNESS", "DUALCAST", "TURBO", "DEFEND_BLUE"] });
    s = play(s, "TURBO");
    s = play(s, "BULLSEYE"); // -8, LOCK_ON 2
    s = play(s, "DARKNESS");
    s = play(s, "DUALCAST"); // evoke stored 6 twice: floor(6*1.5) = 9 each
    expect(monsterHp(s)).toBe(200 - 8 - 18);
  });

  test("Lock-On ticks down like a duration debuff", () => {
    let s = fight({ deck: ["BULLSEYE", "DEFEND_BLUE", "DEFEND_BLUE", "STRIKE_BLUE", "STRIKE_BLUE"] });
    s = play(s, "BULLSEYE");
    s = endTurn(s);
    expect(monsterPowerAmount(s, "LOCK_ON")).toBe(1);
    s = endTurn(s);
    expect(monsterPowerAmount(s, "LOCK_ON")).toBeUndefined();
  });
});

describe("CRACKED_CORE", () => {
  test("channels 1 Lightning at battle start (orb defs now live)", () => {
    const s = fight({ deck: ["STRIKE_BLUE", "STRIKE_BLUE", "DEFEND_BLUE", "DEFEND_BLUE", "ZAP"], relics: ["CRACKED_CORE"] });
    expect(orbIds(s)).toEqual(["LIGHTNING"]);
  });
});

function monsterPowerAmount(s: ReturnType<typeof fight>, id: string, i = 0): number | undefined {
  return s.combat!.monsters[i]!.powers.find((p) => p.id === id)?.amount;
}
