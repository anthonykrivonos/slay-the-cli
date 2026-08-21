// Local extension of the stub test bundle for run-layer tests (the shared
// tests/helpers/testBundle.ts is intentionally untouched). Adds: rarity-tiered
// fake class cards, colorless cards, a curse, potions of all rarities, relic
// pools per tier, 3 stub acts (all monsters T_DUMMY), stub event pools, and a
// high-HP character so full-act walks never die.

import type { CardDef, ContentBundle, PotionDef, RelicDef, ActDef } from "../../src/engine/content/defs";
import { makeTestBundle } from "../helpers/testBundle";

function card(
  id: string,
  type: "attack" | "skill" | "power",
  rarity: "common" | "uncommon" | "rare",
  color: "red" | "colorless" = "red",
): CardDef {
  return {
    id,
    name: id,
    color,
    type,
    rarity,
    cost: 1,
    target: type === "attack" ? "enemy" : "self",
    values: type === "attack" ? { damage: 6 } : { block: 5 },
    upgradeValues: type === "attack" ? { damage: 9 } : { block: 8 },
    keywords: [],
    primitives: type === "attack" ? [{ do: "damage", n: "damage" }] : [{ do: "block", n: "block" }],
  };
}

const extraCards: CardDef[] = [
  // red class pools: 3 attacks + 3 skills + 2 powers per rarity
  ...(["common", "uncommon", "rare"] as const).flatMap((r) => {
    const R = r.toUpperCase();
    return [
      card(`T_${R}_ATK_A`, "attack", r),
      card(`T_${R}_ATK_B`, "attack", r),
      card(`T_${R}_ATK_C`, "attack", r),
      card(`T_${R}_SKL_A`, "skill", r),
      card(`T_${R}_SKL_B`, "skill", r),
      card(`T_${R}_SKL_C`, "skill", r),
      card(`T_${R}_PWR_A`, "power", r),
      card(`T_${R}_PWR_B`, "power", r),
    ];
  }),
  // colorless pools
  card("T_CL_U_A", "skill", "uncommon", "colorless"),
  card("T_CL_U_B", "skill", "uncommon", "colorless"),
  card("T_CL_U_C", "skill", "uncommon", "colorless"),
  card("T_CL_R_A", "skill", "rare", "colorless"),
  card("T_CL_R_B", "skill", "rare", "colorless"),
  card("T_CL_R_C", "skill", "rare", "colorless"),
  // a curse
  {
    id: "T_CURSE",
    name: "T Curse",
    color: "curse",
    type: "curse",
    rarity: "special",
    cost: -2,
    target: "none",
    values: {},
    upgradeValues: {},
    keywords: [],
  },
];

function potion(id: string, rarity: "common" | "uncommon" | "rare"): PotionDef {
  return {
    id,
    name: id,
    rarity,
    class: "shared",
    targeted: false,
    potency: 5,
    sacredBarkDoubles: false,
    onUse: () => {}, // inert stub
  };
}

const potions: PotionDef[] = [
  potion("T_POT_C_A", "common"),
  potion("T_POT_C_B", "common"),
  potion("T_POT_U_A", "uncommon"),
  potion("T_POT_U_B", "uncommon"),
  potion("T_POT_R_A", "rare"),
  potion("T_POT_R_B", "rare"),
];

function relic(id: string, tier: RelicDef["tier"]): RelicDef {
  return { id, name: id, tier, pool: "shared", hooks: {} };
}

const relics: RelicDef[] = [
  ...[..."ABCDEF"].map((c) => relic(`T_RELIC_C_${c}`, "common")),
  ...[..."ABCDEF"].map((c) => relic(`T_RELIC_U_${c}`, "uncommon")),
  ...[..."ABCDEF"].map((c) => relic(`T_RELIC_R_${c}`, "rare")),
  ...[..."ABCD"].map((c) => relic(`T_RELIC_S_${c}`, "shop")),
  ...[..."ABCDEFGH"].map((c) => relic(`T_RELIC_B_${c}`, "boss")),
];

function stubAct(act: number): ActDef {
  return {
    act,
    weakCount: act === 1 ? 3 : 2,
    weakEncounters: [
      { id: `A${act}_WEAK_1`, monsters: ["T_DUMMY"] },
      { id: `A${act}_WEAK_2`, monsters: ["T_DUMMY"] },
      { id: `A${act}_WEAK_3`, monsters: ["T_DUMMY", "T_DUMMY"] },
      { id: `A${act}_WEAK_4`, monsters: ["T_DUMMY"] },
    ],
    strongEncounters: [
      { id: `A${act}_STRONG_1`, weight: 2, monsters: ["T_DUMMY"] },
      { id: `A${act}_STRONG_2`, weight: 2, monsters: ["T_DUMMY", "T_DUMMY"] },
      { id: `A${act}_STRONG_3`, weight: 3, monsters: ["T_DUMMY"] },
      { id: `A${act}_STRONG_4`, weight: 4, monsters: ["T_DUMMY"] },
      { id: `A${act}_STRONG_5`, weight: 5, monsters: ["T_DUMMY", "T_DUMMY"] },
    ],
    elites: [
      { id: `A${act}_ELITE_1`, monsters: ["T_DUMMY"] },
      { id: `A${act}_ELITE_2`, monsters: ["T_DUMMY"] },
      { id: `A${act}_ELITE_3`, monsters: ["T_DUMMY"] },
    ],
    bosses: [`A${act}_BOSS_1`, `A${act}_BOSS_2`, `A${act}_BOSS_3`],
    events: [`A${act}_EVENT_1`, `A${act}_EVENT_2`, `A${act}_EVENT_3`, `A${act}_EVENT_4`, `A${act}_EVENT_5`],
    shrines: ["T_SHRINE_1", "T_SHRINE_2", "T_SHRINE_3"],
  };
}

export function makeRunTestBundle(): ContentBundle {
  const bundle = makeTestBundle();
  for (const c of extraCards) bundle.cards.set(c.id, c);
  for (const p of potions) bundle.potions.set(p.id, p);
  for (const r of relics) bundle.relics.set(r.id, r);
  bundle.acts = [stubAct(1), stubAct(2), stubAct(3)];
  // bosses are MonsterIds - map every stub boss id to a T_DUMMY-alike def
  const dummy = bundle.monsters.get("T_DUMMY")!;
  for (const act of bundle.acts) {
    for (const b of act.bosses) bundle.monsters.set(b, { ...dummy, id: b, category: "boss" });
  }
  // high-HP character so full-run walks never die; real starter deck
  bundle.characters.set("IRONCLAD", {
    id: "IRONCLAD",
    name: "Run Test Ironclad",
    maxHp: 999,
    startingEnergy: 3,
    startingDeck: [
      ...Array(5).fill({ defId: "T_STRIKE" }),
      ...Array(4).fill({ defId: "T_DEFEND" }),
      { defId: "T_BASH" },
    ],
    startingRelic: "T_STARTER",
    orbSlots: 0,
    a14HpLoss: 5,
  });
  bundle.relics.set("T_STARTER", relic("T_STARTER", "starter"));
  return bundle;
}
