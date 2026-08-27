// The closed GameAction union. Cards/powers/relics/potions enqueue these; the
// interpreter in combat/interpreter.ts executes them synchronously. Everything
// here is plain data so an in-flight queue could in principle be serialized -
// but by design the queue is always empty at player-input points.

import type { ActorRef, CardId, CardInstanceId, EffectRefId, OrbId, PowerId, StanceId } from "./ids";
import type { Pile } from "../combat/combatState";

export type DamageType = "attack" | "thorns" | "hpLoss";

export interface DamageInfo {
  type: DamageType;
  source: ActorRef | null; // null for relic/event/status damage with no attacker
  /** final calculated damage (calc pipeline already applied for attacks) */
  amount: number;
}

export type CardSelector =
  | { kind: "iid"; iid: CardInstanceId }
  | { kind: "random"; pile: Pile; n: number }
  | { kind: "all"; pile: Pile }
  | { kind: "choose"; pile: Pile; min: number; max: number; reason: string };

export type GameAction =
  // damage & hp
  | { kind: "damage"; target: ActorRef; info: DamageInfo }
  | { kind: "damageAllMonsters"; amounts: number[]; info: Omit<DamageInfo, "amount"> }
  | { kind: "loseHp"; target: ActorRef; amount: number }
  | { kind: "heal"; target: ActorRef; amount: number }
  | { kind: "gainBlock"; target: ActorRef; amount: number; fromCard: boolean }
  // powers
  | { kind: "applyPower"; source: ActorRef; target: ActorRef; powerId: PowerId; amount: number }
  | { kind: "reducePower"; target: ActorRef; powerId: PowerId; amount: number }
  | { kind: "removePower"; target: ActorRef; powerId: PowerId }
  // cards & piles
  | { kind: "draw"; n: number }
  | { kind: "discard"; sel: CardSelector; manual: boolean }
  | { kind: "exhaust"; sel: CardSelector }
  | { kind: "moveCard"; iid: CardInstanceId; to: Pile; position?: "top" | "bottom" | "random" }
  | { kind: "makeTempCard"; defId: CardId; upgrades: number; dest: Pile; n: number }
  | { kind: "shuffleDiscardIntoDraw" }
  | { kind: "emptyHandToDiscardEndOfTurn" }
  // energy
  | { kind: "gainEnergy"; n: number }
  | { kind: "loseEnergy"; n: number }
  // defect
  | { kind: "channelOrb"; orbId: OrbId }
  | { kind: "evokeOrb"; times: number }
  | { kind: "changeOrbSlots"; delta: number }
  // watcher
  | { kind: "changeStance"; stanceId: StanceId }
  | { kind: "gainMantra"; n: number }
  | { kind: "scry"; n: number }
  // monsters
  | { kind: "spawnMonster"; monsterId: string; slot: number | "append"; hp: number | null; rollFirstMove: boolean }
  | { kind: "monsterEscape"; idx: number }
  // flow
  | { kind: "useCard"; itemIdx: "next" } // drain marker: pull next CardQueueItem
  | { kind: "monsterMove"; idx: number }
  | { kind: "startPlayerTurn" }
  | { kind: "endPlayerTurn" }
  | { kind: "monsterTurn" }
  /** one monster acts, then the rest re-queue behind whatever its move queued */
  | { kind: "monsterStep"; remaining: number[] }
  | { kind: "endRound" }
  // escapes into content-registered code with plain-data args
  | { kind: "effect"; ref: EffectRefId; args?: unknown }
  // pauses the interpreter for player input; resume is a registered continuation
  | { kind: "choice"; request: ChoiceRequest; resume: EffectRefId; resumeArgs?: unknown };

export type ChoiceRequest =
  | {
      kind: "cards";
      pile: Pile | "custom";
      iids: CardInstanceId[];
      min: number;
      max: number;
      canCancel: boolean;
      reason: string;
    }
  | { kind: "scry"; iids: CardInstanceId[] }
  | { kind: "option"; options: string[]; reason: string };

/** Serializable pending player decision (mid-resolution). */
export interface PendingChoice {
  request: ChoiceRequest;
  resume: EffectRefId;
  resumeArgs?: unknown;
}
