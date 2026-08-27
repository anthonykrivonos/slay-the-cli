import { test, expect, describe } from "bun:test";
import { createCombatGame, advance, type GameState } from "../../src/engine/game";
import type { CardDef, ContentBundle, EffectCtx, StanceDef } from "../../src/engine/content/defs";
import type { Stream } from "../../src/engine/core/rngRegistry";
import { RngRegistry } from "../../src/engine/core/rngRegistry";
import { ActionQueue } from "../../src/engine/core/queue";
import { runQueue } from "../../src/engine/combat/interpreter";
import { makeTestBundle } from "../helpers/testBundle";
import { corePowers } from "../../src/content/powers/core";
import { ironcladBasics } from "../../src/content/cards/ironclad/basics";
import { allRelics, relicSupportPowers } from "../../src/content/relics";
import { allPotions, effectivePotency } from "../../src/content/potions";

// ---------------------------------------------------------------------------
// local bundle (same pattern as relics.test.ts)
// ---------------------------------------------------------------------------

const extraCards: CardDef[] = [
  {
    id: "T_JAB", name: "T Jab", color: "red", type: "attack", rarity: "common", cost: 0, target: "enemy",
    values: { damage: 3 }, upgradeValues: { damage: 5 }, keywords: [], primitives: [{ do: "damage", n: "damage" }],
  },
  {
    id: "T_CANTRIP", name: "T Cantrip", color: "red", type: "skill", rarity: "common", cost: 0, target: "self",
    values: { magic: 1 }, upgradeValues: { magic: 2 }, keywords: [], primitives: [{ do: "draw", n: "magic" }],
  },
  {
    id: "T_POWER", name: "T Power", color: "red", type: "power", rarity: "common", cost: 1, target: "self",
    values: { magic: 1 }, upgradeValues: { magic: 2 }, keywords: [],
    primitives: [{ do: "applyPower", power: "STRENGTH", n: "magic", target: "self" }],
  },
];

const stances: StanceDef[] = [
  { id: "CALM", name: "Calm", onExit: (ctx) => ctx.queue.addToTop({ kind: "gainEnergy", n: 2 }) },
  { id: "WRATH", name: "Wrath", damageGiveMultiplier: 2, damageReceiveMultiplier: 2 },
  {
    id: "DIVINITY", name: "Divinity", damageGiveMultiplier: 3, autoExitAtEndOfTurn: true,
    onEnter: (ctx) => ctx.queue.addToTop({ kind: "gainEnergy", n: 3 }),
  },
];

function makeBundle(): ContentBundle {
  const b = makeTestBundle();
  for (const p of corePowers) b.powers.set(p.id, p);
  for (const p of relicSupportPowers) b.powers.set(p.id, p);
  for (const r of allRelics) b.relics.set(r.id, r);
  for (const p of allPotions) b.potions.set(p.id, p);
  for (const c of [...extraCards, ...ironcladBasics]) b.cards.set(c.id, c);
  for (const s of stances) b.stances.set(s.id, s);
  return b;
}

const B = makeBundle();

function game(opts: {
  seed?: string;
  deck?: { defId: string; upgrades?: number }[];
  relics?: string[];
  hp?: number;
}): GameState {
  return createCombatGame({
    seed: opts.seed ?? "POTIONS",
    bundle: B,
    character: "IRONCLAD",
    deck: opts.deck ?? Array(12).fill({ defId: "T_STRIKE" }),
    relics: opts.relics ?? [],
    monsters: ["T_DUMMY"],
    hp: opts.hp,
    maxHp: 80,
  });
}

/** Use a potion against the live state (the run-layer use site does not exist yet). */
function usePotion(s: GameState, id: string, target: number | null = null): GameState {
  const registry = RngRegistry.fromState(s.rng);
  const rt = { pending: null, currentItem: null, combatOver: null } as EffectCtx["rt"];
  const ctx: EffectCtx = {
    run: s.run,
    combat: s.combat,
    queue: new ActionQueue(),
    bundle: B,
    rt,
    rng: (st: Stream) => registry.get(st),
    asc: s.run.ascension,
    emit: () => {},
    requestChoice: (c) => {
      rt.pending = c;
    },
  };
  const def = B.potions.get(id);
  if (!def) throw new Error(`unknown potion ${id}`);
  def.onUse(ctx, target, effectivePotency(ctx, def));
  runQueue(ctx);
  s.rng = registry.saveState();
  s.pending = rt.pending;
  return s;
}

const handNames = (s: GameState) => s.combat!.player.piles.hand.map((i) => s.combat!.cards[i]!.defId);
const play = (s: GameState, name: string, target?: number) => {
  const idx = handNames(s).indexOf(name);
  if (idx === -1) throw new Error(`${name} not in hand: ${handNames(s)}`);
  return advance(s, { cmd: "playCard", handIdx: idx, target }, B);
};
const power = (s: GameState, id: string) => s.combat!.player.powers.find((p) => p.id === id);
const monsterHp = (s: GameState) => s.combat!.monsters[0]!.hp;

function gameWithIntent(move: string, opts: Parameters<typeof game>[0] = {}): GameState {
  for (let i = 0; i < 30; i++) {
    const s = game({ ...opts, seed: `${opts.seed ?? "PFISH"}${i}` });
    if (s.combat!.monsters[0]!.move === move) return s;
  }
  throw new Error("no seed matched intent");
}

// ---------------------------------------------------------------------------

describe("damage & block potions", () => {
  test("Fire Potion: exactly 20 to the target (no Strength/Vulnerable scaling)", () => {
    let s = game({});
    s.combat!.player.powers.push({ id: "STRENGTH", amount: 5, justApplied: false, data: null });
    const hp0 = monsterHp(s);
    s = usePotion(s, "FIRE_POTION", 0);
    expect(monsterHp(s)).toBe(Math.max(0, hp0 - 20));
  });

  test("Sacred Bark doubles Fire Potion to 40", () => {
    let s = game({ relics: ["SACRED_BARK"] });
    s = usePotion(s, "FIRE_POTION", 0);
    expect(monsterHp(s)).toBe(0); // 40 >= max monster hp (25)
    expect(s.combat!.monsters[0]!.isDead).toBe(true);
  });

  test("Explosive Potion: 10 to all enemies", () => {
    let s = game({});
    const hp0 = monsterHp(s);
    s = usePotion(s, "EXPLOSIVE_POTION");
    expect(monsterHp(s)).toBe(hp0 - 10);
  });

  test("Block Potion: 12 block, unaffected by Dexterity/Frail", () => {
    let s = game({});
    s.combat!.player.powers.push({ id: "FRAIL", amount: 2, justApplied: false, data: null });
    s = usePotion(s, "BLOCK_POTION");
    expect(s.combat!.player.block).toBe(12);
  });
});

describe("power potions", () => {
  test("Strength/Dexterity Potions: +2 each; Sacred Bark makes it +4", () => {
    let s = game({});
    s = usePotion(s, "STRENGTH_POTION");
    s = usePotion(s, "DEXTERITY_POTION");
    expect(power(s, "STRENGTH")?.amount).toBe(2);
    expect(power(s, "DEXTERITY")?.amount).toBe(2);
    let t = game({ relics: ["SACRED_BARK"] });
    t = usePotion(t, "STRENGTH_POTION");
    expect(power(t, "STRENGTH")?.amount).toBe(4);
  });

  test("Weak/Fear Potions apply 3 Weak/Vulnerable to the target", () => {
    let s = game({});
    s = usePotion(s, "WEAK_POTION", 0);
    s = usePotion(s, "FEAR_POTION", 0);
    const m = s.combat!.monsters[0]!;
    expect(m.powers.find((p) => p.id === "WEAK")?.amount).toBe(3);
    expect(m.powers.find((p) => p.id === "VULNERABLE")?.amount).toBe(3);
  });

  test("Ancient Potion: 1 Artifact", () => {
    let s = game({});
    s = usePotion(s, "ANCIENT_POTION");
    expect(power(s, "ARTIFACT")?.amount).toBe(1);
  });

  test("Essence of Steel: 4 Plated Armor", () => {
    let s = game({});
    s = usePotion(s, "ESSENCE_OF_STEEL");
    expect(power(s, "PLATED_ARMOR")?.amount).toBe(4);
  });

  test("Liquid Bronze: 3 Thorns; Heart of Iron: 6 Metallicize; Ghost in a Jar: 1 Intangible", () => {
    let s = game({});
    s = usePotion(s, "LIQUID_BRONZE");
    s = usePotion(s, "HEART_OF_IRON");
    s = usePotion(s, "GHOST_IN_A_JAR");
    expect(power(s, "THORNS")?.amount).toBe(3);
    expect(power(s, "METALLICIZE")?.amount).toBe(6);
    expect(power(s, "INTANGIBLE")?.amount).toBe(1);
  });

  test("Intangible from Ghost in a Jar clamps a 10 attack to 1", () => {
    let s = gameWithIntent("ATTACK", { hp: 60 });
    s = usePotion(s, "GHOST_IN_A_JAR");
    const hp0 = s.run.hp;
    s = advance(s, { cmd: "endTurn" }, B);
    expect(s.run.hp).toBe(hp0 - 1);
  });

  test("Flex Potion: +5 Strength now, back to 0 after the turn", () => {
    let s = game({});
    s = usePotion(s, "FLEX_POTION");
    expect(power(s, "STRENGTH")?.amount).toBe(5);
    expect(power(s, "LOSE_STRENGTH")?.amount).toBe(5);
    s = advance(s, { cmd: "endTurn" }, B);
    expect(power(s, "STRENGTH")?.amount ?? 0).toBe(0);
    expect(power(s, "LOSE_STRENGTH")).toBeUndefined();
  });

  test("Speed Potion: +5 Dexterity now, gone after the turn", () => {
    let s = game({});
    s = usePotion(s, "SPEED_POTION");
    expect(power(s, "DEXTERITY")?.amount).toBe(5);
    s = advance(s, { cmd: "endTurn" }, B);
    expect(power(s, "DEXTERITY")?.amount ?? 0).toBe(0);
  });

  test("Regen Potion: heals 5 at end of turn, then ticks down to 4", () => {
    let s = gameWithIntent("HARDEN", { hp: 40 });
    s = usePotion(s, "REGEN_POTION");
    expect(power(s, "REGEN")?.amount).toBe(5);
    s = advance(s, { cmd: "endTurn" }, B);
    expect(s.run.hp).toBe(45);
    expect(power(s, "REGEN")?.amount).toBe(4);
  });

  test("Cultist Potion: Ritual 1 grants Strength at end of turn", () => {
    let s = game({});
    s = usePotion(s, "CULTIST_POTION");
    expect(power(s, "RITUAL")?.amount).toBe(1);
    s = advance(s, { cmd: "endTurn" }, B);
    expect(power(s, "STRENGTH")?.amount).toBe(1);
  });

  test("Focus Potion: +2 Focus", () => {
    let s = game({});
    s = usePotion(s, "FOCUS_POTION");
    expect(power(s, "FOCUS")?.amount).toBe(2);
  });
});

describe("resource potions", () => {
  test("Energy Potion: +2 energy", () => {
    let s = game({});
    s = usePotion(s, "ENERGY_POTION");
    expect(s.combat!.player.energy).toBe(5);
  });

  test("Swift Potion: draw 3", () => {
    let s = game({});
    s = usePotion(s, "SWIFT_POTION");
    expect(s.combat!.player.piles.hand.length).toBe(8);
  });

  test("Blood Potion: heal 20% of max HP (floored)", () => {
    let s = game({ hp: 40 });
    s = usePotion(s, "BLOOD_POTION");
    expect(s.run.hp).toBe(56); // 40 + floor(80 * 0.20)
  });

  test("Fruit Juice: +5 max HP and +5 HP", () => {
    let s = game({ hp: 40 });
    s = usePotion(s, "FRUIT_JUICE");
    expect(s.run.maxHp).toBe(85);
    expect(s.run.hp).toBe(45);
  });

  test("Potion of Capacity: +2 orb slots", () => {
    let s = game({});
    s = usePotion(s, "POTION_OF_CAPACITY");
    expect(s.combat!.player.orbSlots).toBe(2); // Ironclad starts at 0
  });

  test("Snecko Oil: draw 5 and randomize hand costs into 0..3", () => {
    let s = game({});
    s = usePotion(s, "SNECKO_OIL");
    expect(s.combat!.player.piles.hand.length).toBe(10);
    for (const iid of s.combat!.player.piles.hand) {
      const c = s.combat!.cards[iid]!;
      expect(c.cost).toBeGreaterThanOrEqual(0);
      expect(c.cost).toBeLessThanOrEqual(3);
      expect(c.costForTurn).toBe(c.cost);
    }
  });
});

describe("card-manipulation potions", () => {
  test("Blessing of the Forge upgrades the whole hand for the combat", () => {
    let s = game({});
    s = usePotion(s, "BLESSING_OF_THE_FORGE");
    for (const iid of s.combat!.player.piles.hand) {
      expect(s.combat!.cards[iid]!.upgrades).toBe(1);
    }
    const hp0 = monsterHp(s);
    s = play(s, "T_STRIKE", 0);
    expect(monsterHp(s)).toBe(hp0 - 9); // upgraded T_STRIKE deals 9
  });

  test("Distilled Chaos plays the top 3 cards of the draw pile for free", () => {
    let s = game({});
    const hp0 = monsterHp(s);
    const e0 = s.combat!.player.energy;
    s = usePotion(s, "DISTILLED_CHAOS");
    expect(monsterHp(s)).toBe(Math.max(0, hp0 - 18)); // 3 strikes x 6
    expect(s.combat!.player.energy).toBe(e0);
    expect(s.combat!.player.piles.draw.length).toBe(4); // 12 - 5 hand - 3 played
  });

  test("Duplication Potion: the next card is played twice, paid once", () => {
    let s = game({});
    s = usePotion(s, "DUPLICATION_POTION");
    expect(power(s, "DUPLICATION")?.amount).toBe(1);
    const hp0 = monsterHp(s);
    s = play(s, "T_STRIKE", 0);
    expect(monsterHp(s)).toBe(Math.max(0, hp0 - 12));
    expect(s.combat!.player.energy).toBe(2);
    expect(power(s, "DUPLICATION")).toBeUndefined();
  });

  test("Attack Potion: choose 1 of 3 attacks, added to hand at cost 0", () => {
    let s = game({});
    s = usePotion(s, "ATTACK_POTION");
    expect(s.pending).not.toBeNull();
    expect(s.pending!.request.kind).toBe("option");
    const options = (s.pending!.request as { kind: "option"; options: string[] }).options;
    expect(options.length).toBe(3);
    const hand0 = s.combat!.player.piles.hand.length;
    s = advance(s, { cmd: "choose", indices: [0] }, B);
    expect(s.combat!.player.piles.hand.length).toBe(hand0 + 1);
    const added = s.combat!.player.piles.hand[s.combat!.player.piles.hand.length - 1]!;
    expect(s.combat!.cards[added]!.costForTurn).toBe(0);
    expect(B.cards.get(s.combat!.cards[added]!.defId)!.type).toBe("attack");
  });

  test("Skill and Power Potions offer the right card types", () => {
    let s = game({});
    s = usePotion(s, "POWER_POTION");
    s = advance(s, { cmd: "choose", indices: [0] }, B);
    const last = s.combat!.player.piles.hand[s.combat!.player.piles.hand.length - 1]!;
    expect(B.cards.get(s.combat!.cards[last]!.defId)!.type).toBe("power");
  });

  test("Elixir exhausts the chosen cards", () => {
    let s = game({});
    s = usePotion(s, "ELIXIR_POTION");
    expect(s.pending!.request.kind).toBe("cards");
    s = advance(s, { cmd: "choose", indices: [0, 1, 2] }, B);
    expect(s.combat!.player.piles.exhaust.length).toBe(3);
    expect(s.combat!.player.piles.hand.length).toBe(2);
  });

  test("Gambler's Brew: discard chosen, draw that many", () => {
    let s = game({});
    s = usePotion(s, "GAMBLERS_BREW");
    s = advance(s, { cmd: "choose", indices: [0, 1] }, B);
    expect(s.combat!.player.piles.discard.length).toBe(2);
    expect(s.combat!.player.piles.hand.length).toBe(5);
  });

  test("Liquid Memories returns a discarded card to hand at cost 0", () => {
    let s = game({});
    s = play(s, "T_STRIKE", 0); // now in discard
    s = usePotion(s, "LIQUID_MEMORIES");
    expect(s.pending!.request.kind).toBe("cards");
    s = advance(s, { cmd: "choose", indices: [0] }, B);
    expect(s.combat!.player.piles.discard.length).toBe(0);
    expect(s.combat!.player.piles.hand.length).toBe(5);
    const returned = s.combat!.player.piles.hand[4]!;
    expect(s.combat!.cards[returned]!.costForTurn).toBe(0);
  });
});

describe("stance potions", () => {
  test("Stance Potion: choosing Wrath enters Wrath", () => {
    let s = game({});
    s = usePotion(s, "STANCE_POTION");
    expect(s.pending!.request.kind).toBe("option");
    s = advance(s, { cmd: "choose", indices: [1] }, B);
    expect(s.combat!.player.stance).toBe("WRATH");
  });

  test("Ambrosia enters Divinity (+3 energy from onEnter)", () => {
    let s = game({});
    s = usePotion(s, "AMBROSIA");
    expect(s.combat!.player.stance).toBe("DIVINITY");
    expect(s.combat!.player.energy).toBe(6);
  });
});

describe("potency plumbing", () => {
  test("effectivePotency doubles only sacredBarkDoubles potions", () => {
    const withBark = game({ relics: ["SACRED_BARK"] });
    const registry = RngRegistry.fromState(withBark.rng);
    const ctx: EffectCtx = {
      run: withBark.run,
      combat: withBark.combat,
      queue: new ActionQueue(),
      bundle: B,
      rt: { pending: null, currentItem: null, combatOver: null },
      rng: (st: Stream) => registry.get(st),
      asc: 0,
      emit: () => {},
      requestChoice: () => {},
    };
    expect(effectivePotency(ctx, B.potions.get("FIRE_POTION")!)).toBe(40);
    expect(effectivePotency(ctx, B.potions.get("SWIFT_POTION")!)).toBe(6);
    expect(effectivePotency(ctx, B.potions.get("ELIXIR_POTION")!)).toBe(0); // not doubled
    expect(effectivePotency(ctx, B.potions.get("SMOKE_BOMB")!)).toBe(0);
  });

  test("all 42 corpus potions have defs; flagged ones are safe no-ops", () => {
    expect(allPotions.length).toBe(42);
    let s = game({});
    // RUN-LAYER / ENGINE-GAP potions must not crash or corrupt state
    for (const id of ["ENTROPIC_BREW", "FAIRY_POTION"]) {
      s = usePotion(s, id);
      expect(s.pending).toBeNull();
    }
  });

  describe("Smoke Bomb", () => {
    const combatRoom = (roomKind: "monster" | "elite" | "boss") =>
      ({ kind: "combat", roomKind, encounterId: "T_ENC", burningElite: false }) as GameState["run"]["room"];

    test("walks out of a non-boss fight: combat ends, back to the map, no rewards", () => {
      const s0 = game({});
      s0.run.potions[0] = "SMOKE_BOMB";
      s0.run.room = combatRoom("elite");
      const gold = s0.run.gold;
      const s = advance(s0, { cmd: "usePotion", slot: 0 }, B);
      expect(s.combat).toBeNull();
      expect(s.run.room!.kind).toBe("map"); // not a rewards screen
      expect(s.run.gold).toBe(gold);
      expect(s.run.potions[0]).toBeNull();
      expect(s.outcome).toBeNull();
      expect(s.eventLog.some((e) => e.event === "combatEnded" && e.payload === "escape")).toBe(true);
    });

    test("refuses a boss fight without burning the potion", () => {
      const s0 = game({});
      s0.run.potions[0] = "SMOKE_BOMB";
      s0.run.room = combatRoom("boss");
      expect(() => advance(s0, { cmd: "usePotion", slot: 0 }, B)).toThrow("cannot be used");
      expect(s0.run.potions[0]).toBe("SMOKE_BOMB"); // still in the belt
      expect(s0.combat).not.toBeNull();
    });
  });
});
