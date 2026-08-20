// Minimal typing for the UI's build-time import of data/corpus/cards.json
// (allowed for UI only — the engine never reads the corpus at runtime).

declare module "*/cards.json" {
  export interface CorpusCardEntry {
    id: string;
    name: string;
    text?: string | null;
  }
  const cards: CorpusCardEntry[];
  export default cards;
}
