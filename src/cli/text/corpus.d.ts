// Minimal typing for the CLI's build-time import of data/corpus/cards.json
// (allowed for UI only - the engine never reads the corpus at runtime).
// Pattern is "*/corpus/cards.json" (not "*/cards.json") so this declaration
// can coexist with the legacy src/ui/corpus.d.ts until the web UI is deleted.

declare module "*/corpus/cards.json" {
  export interface CorpusCardEntry {
    id: string;
    name: string;
    text?: string | null;
  }
  const cards: CorpusCardEntry[];
  export default cards;
}

declare module "*/corpus/relics.json" {
  export interface CorpusRelicEntry {
    id: string;
    name: string;
    tier?: string;
    text?: string | null;
  }
  const relics: CorpusRelicEntry[];
  export default relics;
}

declare module "*/corpus/potions.json" {
  export interface CorpusPotionEntry {
    id: string;
    name: string;
    rarity?: string;
    text?: string | null;
  }
  const potions: CorpusPotionEntry[];
  export default potions;
}

declare module "*/corpus/powers.json" {
  export interface CorpusPowerEntry {
    id: string;
    name: string;
    kind?: string;
    text?: string | null;
  }
  const powers: CorpusPowerEntry[];
  export default powers;
}

declare module "*/corpus/stances.json" {
  export interface CorpusStanceEntry {
    id: string;
    name: string;
    attackDamageDealtMultiplier: number;
    attackDamageReceivedMultiplier: number;
    onEnter?: string | null;
    onExit?: string | null;
    autoExit?: string | null;
  }
  const stances: { mantraThreshold: number; stances: CorpusStanceEntry[] };
  export default stances;
}

declare module "*/corpus/orbs.json" {
  export interface CorpusOrbEntry {
    id: string;
    name: string;
    passive: { base: number | null; timing: string; text: string };
    evoke: { base: number | null; text: string };
  }
  const orbs: CorpusOrbEntry[];
  export default orbs;
}
