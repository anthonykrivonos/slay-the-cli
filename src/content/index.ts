// The base-game ContentBundle — the forkable layer. Merges all content
// workstreams; the corpus audit (tests/audit/contentAudit.test.ts) enforces
// envelope exactness and tracks coverage.

import type {
  ContentBundle,
  CardDef,
  PowerDef,
  MonsterDef,
  StanceDef,
  CharacterDef,
  RelicDef,
  PotionDef,
  EffectFn,
} from "../engine/content/defs";
import { corePowers } from "./powers/core";
import { ironcladCards, statusCards, curseCards, ironcladPowers, ironcladEffects } from "./cards/ironclad/index";
import { colorlessCards, colorlessPowers, colorlessEffects } from "./cards/colorless/index";
import { silentCards, silentPowers, silentEffects } from "./cards/silent/index";
import { defectCards, defectPowers, defectEffects } from "./cards/defect/index";
import { watcherCards, watcherPowers, watcherEffects } from "./cards/watcher/index";
import { allOrbs, orbEffects } from "./orbs";
import { act1Monsters, act1Powers } from "./monsters/act1/index";
import { act2Monsters, act2Powers } from "./monsters/act2/index";
import { act34Monsters, act34Powers } from "./monsters/act34/index";
import { allRelics, relicSupportPowers, contentEffects } from "./relics/index";
import { allPotions } from "./potions/index";
import { allEvents, eventEffects } from "./events/index";
import { actDefs } from "./acts";

const stances: StanceDef[] = [
  { id: "NEUTRAL", name: "Neutral" },
  { id: "CALM", name: "Calm", onExit: (ctx) => ctx.queue.addToTop({ kind: "gainEnergy", n: 2 }) },
  { id: "WRATH", name: "Wrath", damageGiveMultiplier: 2, damageReceiveMultiplier: 2 },
  {
    id: "DIVINITY",
    name: "Divinity",
    damageGiveMultiplier: 3,
    autoExitAtEndOfTurn: true,
    onEnter: (ctx) => ctx.queue.addToTop({ kind: "gainEnergy", n: 3 }),
  },
];

const characters: CharacterDef[] = [
  {
    id: "IRONCLAD",
    name: "Ironclad",
    maxHp: 80,
    startingEnergy: 3,
    startingDeck: [
      ...Array(5).fill({ defId: "STRIKE_RED" }),
      ...Array(4).fill({ defId: "DEFEND_RED" }),
      { defId: "BASH" },
    ],
    startingRelic: "BURNING_BLOOD",
    orbSlots: 0,
    a14HpLoss: 5,
  },
  {
    id: "SILENT",
    name: "Silent",
    maxHp: 70,
    startingEnergy: 3,
    startingDeck: [
      ...Array(5).fill({ defId: "STRIKE_GREEN" }),
      ...Array(5).fill({ defId: "DEFEND_GREEN" }),
      { defId: "SURVIVOR" },
      { defId: "NEUTRALIZE" },
    ],
    startingRelic: "RING_OF_THE_SNAKE",
    orbSlots: 0,
    a14HpLoss: 4,
  },
  {
    id: "DEFECT",
    name: "Defect",
    maxHp: 75,
    startingEnergy: 3,
    startingDeck: [
      ...Array(4).fill({ defId: "STRIKE_BLUE" }),
      ...Array(4).fill({ defId: "DEFEND_BLUE" }),
      { defId: "ZAP" },
      { defId: "DUALCAST" },
    ],
    startingRelic: "CRACKED_CORE",
    orbSlots: 3,
    a14HpLoss: 4,
  },
  {
    id: "WATCHER",
    name: "Watcher",
    maxHp: 72,
    startingEnergy: 3,
    startingDeck: [
      ...Array(4).fill({ defId: "STRIKE_PURPLE" }),
      ...Array(4).fill({ defId: "DEFEND_PURPLE" }),
      { defId: "ERUPTION" },
      { defId: "VIGILANCE" },
    ],
    startingRelic: "PURE_WATER",
    orbSlots: 0,
    a14HpLoss: 4,
  },
];

// merge order: earlier entries are overwritten by later ones ONLY for
// corpus-identical duplicates (e.g. LOSE_STRENGTH defined by two workstreams)
const allCards: CardDef[] = [...ironcladCards, ...statusCards, ...curseCards, ...colorlessCards, ...silentCards, ...defectCards, ...watcherCards];
const allPowers: PowerDef[] = [...corePowers, ...act1Powers, ...act2Powers, ...act34Powers, ...ironcladPowers, ...colorlessPowers, ...relicSupportPowers, ...silentPowers, ...defectPowers, ...watcherPowers];
const allMonsters: MonsterDef[] = [...act1Monsters, ...act2Monsters, ...act34Monsters];
const relicDefs: RelicDef[] = [...allRelics];
const potionDefs: PotionDef[] = [...allPotions];

const effects = new Map<string, EffectFn>();
for (const [k, v] of ironcladEffects) effects.set(k, v);
for (const [k, v] of colorlessEffects) effects.set(k, v);
for (const [k, v] of contentEffects) effects.set(k, v);
for (const [k, v] of eventEffects) effects.set(k, v);
for (const [k, v] of silentEffects) effects.set(k, v);
for (const [k, v] of defectEffects) effects.set(k, v);
for (const [k, v] of watcherEffects) effects.set(k, v);
for (const [k, v] of orbEffects) effects.set(k, v);

export function buildBaseContentBundle(): ContentBundle {
  return {
    id: "sts-base",
    version: "2.3.4",
    cards: new Map(allCards.map((c) => [c.id, c])),
    powers: new Map(allPowers.map((p) => [p.id, p])),
    relics: new Map(relicDefs.map((r) => [r.id, r])),
    potions: new Map(potionDefs.map((p) => [p.id, p])),
    monsters: new Map(allMonsters.map((m) => [m.id, m])),
    events: new Map(allEvents.map((e) => [e.id, e])),
    orbs: new Map(allOrbs.map((o) => [o.id, o])),
    stances: new Map(stances.map((s) => [s.id, s])),
    characters: new Map(characters.map((c) => [c.id, c])),
    acts: actDefs,
    effects,
  };
}
