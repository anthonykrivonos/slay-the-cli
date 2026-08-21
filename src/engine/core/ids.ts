// Identifier conventions. All content ids are UPPER_SNAKE strings matching the
// corpus (data/corpus/*.json). Plain aliases (not branded) because state must
// round-trip through JSON constantly; the corpus audit is the integrity check.

export type CardId = string; // e.g. "BASH"
export type PowerId = string; // e.g. "VULNERABLE"
export type RelicId = string; // e.g. "BURNING_BLOOD"
export type PotionId = string; // e.g. "FIRE_POTION"
export type MonsterId = string; // e.g. "JAW_WORM"
export type EventId = string; // e.g. "BIG_FISH"
export type OrbId = string; // "LIGHTNING" | "FROST" | "DARK" | "PLASMA"
export type StanceId = string; // "NEUTRAL" | "CALM" | "WRATH" | "DIVINITY"
export type CharacterId = "IRONCLAD" | "SILENT" | "DEFECT" | "WATCHER";
export type MoveId = string; // monster move, e.g. "CHOMP"
export type EffectRefId = string; // named continuation registered in the ContentBundle

/** In-combat card instance id (unique per combat). */
export type CardInstanceId = number;

/** Actor reference: the player or a monster slot index (0..4). */
export type ActorRef = { kind: "player" } | { kind: "monster"; idx: number };

export const PLAYER: ActorRef = { kind: "player" };
export const monster = (idx: number): ActorRef => ({ kind: "monster", idx });
export const sameActor = (a: ActorRef, b: ActorRef): boolean =>
  a.kind === b.kind && (a.kind === "player" || a.idx === (b as { idx: number }).idx);
