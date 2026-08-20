// Minimal typing for the CLI's build-time import of data/corpus/cards.json
// (allowed for UI only — the engine never reads the corpus at runtime).
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
