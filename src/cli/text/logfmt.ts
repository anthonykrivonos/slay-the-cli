// Engine-event -> readable log sentence. Harvested from the web UI's
// pushEvents ticker (src/ui/main.ts) plus the full emit() inventory of
// src/engine + src/content. Unknown events fall back to the web UI's raw
// format: `event + clipped payload JSON`. Pure - no Bun/node APIs.

import type { GameEvent } from "../../engine/game";
import type { ContentBundle } from "../../engine/content/defs";
import { titleCase, potionName, cardName, orbName } from "./runlogic";
import { toAscii } from "./ascii";

interface ActorRefish {
  kind?: string;
  idx?: number;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** "You" / "Enemy N" from an ActorRef payload field. */
function actorText(v: unknown): string {
  const a = v as ActorRefish;
  if (isObj(v) && a.kind === "player") return "You";
  if (isObj(v) && a.kind === "monster" && typeof a.idx === "number") return `Enemy ${a.idx + 1}`;
  return "Someone";
}

function powerName(bundle: ContentBundle, id: unknown): string {
  const s = str(id) ?? "?";
  return bundle.powers.get(s)?.name ?? titleCase(s);
}

function monsterName(bundle: ContentBundle, id: unknown): string {
  const s = str(id) ?? "?";
  return bundle.monsters.get(s)?.name ?? titleCase(s);
}

/** Name of whatever forced an autoplay: a card, a power, a relic or a potion. */
function cardishName(bundle: ContentBundle, id: string): string {
  return (
    bundle.cards.get(id)?.name ??
    bundle.powers.get(id)?.name ??
    bundle.relics.get(id)?.name ??
    bundle.potions.get(id)?.name ??
    titleCase(id)
  );
}

/** Fallback: `event + clipped payload JSON` (mirrors the web UI's pushEvents,
 *  with an ASCII ellipsis). */
function rawFormat(ev: GameEvent): string {
  let s = ev.event;
  if (ev.payload !== undefined) {
    let p: string;
    try {
      p = JSON.stringify(ev.payload) ?? "";
    } catch {
      p = String(ev.payload);
    }
    if (p.length > 44) p = `${p.slice(0, 41)}...`;
    s += ` ${p}`;
  }
  return s;
}

/** One readable sentence per engine event. */
export function formatEvent(ev: GameEvent, bundle: ContentBundle): string {
  const p = isObj(ev.payload) ? ev.payload : {};
  let out: string | null = null;
  switch (ev.event) {
    case "turnStarted":
      out = `-- Turn ${num(p.turn) ?? "?"} --`;
      break;
    case "damaged": {
      const who = actorText(p.target);
      const n = num(p.amount) ?? 0;
      out = who === "You" ? `You take ${n} damage` : `${who} takes ${n} damage`;
      break;
    }
    case "victory":
      out = "Victory!";
      break;
    case "defeat":
      out = "You have been slain";
      break;
    case "combatEnded":
      out = ev.payload === "victory" ? "Combat won" : `Combat ended (${String(ev.payload)})`;
      break;
    case "monsterDeath":
      out = `Enemy ${(num(p.idx) ?? 0) + 1} dies`;
      break;
    case "monsterEscaped":
      out = `Enemy ${(num(p.idx) ?? 0) + 1} escapes`;
      break;
    case "monsterSpawned":
      out = `${monsterName(bundle, p.monsterId)} appears`;
      break;
    case "powerApplied":
      out = `${powerName(bundle, p.powerId)} ${num(p.amount) ?? ""} on ${actorText(p.target).toLowerCase() === "you" ? "you" : actorText(p.target)}`;
      break;
    case "powerRemoved":
      out = `${powerName(bundle, p.powerId)} wears off (${actorText(p.target)})`;
      break;
    case "powerVetoed":
      out = `${powerName(bundle, p.powerId)} was prevented`;
      break;
    case "artifactNegated":
      out = `Artifact negated ${powerName(bundle, p.powerId)} (${actorText(p.target)})`;
      break;
    case "combatStarted": {
      const ids = Array.isArray(p.monsters) ? p.monsters : [];
      const names = ids.map((m) => monsterName(bundle, m));
      out = `== ${names.length > 0 ? names.join(", ") : titleCase(str(p.encounterId) ?? "combat")} ==`;
      break;
    }
    case "cardPlayed": {
      const defId = str(p.defId) ?? "?";
      const name = cardName(bundle, defId, num(p.upgrades) ?? 0);
      // an autoplay rolls a target even for untargeted cards, so only say where
      // it went when the card actually aims (PlayTopCardAction parity)
      const aims = bundle.cards.get(defId)?.target === "enemy";
      const at = aims && num(p.target) !== null ? ` at Enemy ${(num(p.target) ?? 0) + 1}` : "";
      const via = str(p.via);
      // an autoplay says who forced it (Havoc, Mayhem, Double Tap...)
      out = via !== null ? `${cardishName(bundle, via)} plays ${name}${at}` : `You play ${name}${at}`;
      break;
    }
    case "deckCardObtained":
      out = `${cardName(bundle, str(p.defId) ?? "?", num(p.upgrades) ?? 0)} joins your deck`;
      break;
    case "cardDrawn":
      out = "Drew a card";
      break;
    case "cardDiscarded":
      out = p.manual === true ? "Discarded a card" : "A card was discarded";
      break;
    case "cardExhausted":
      out = "A card was exhausted";
      break;
    case "cardCreated":
      out = `Created ${cardName(bundle, str(p.defId) ?? "?")}${str(p.dest) ? ` (${str(p.dest)})` : ""}`;
      break;
    case "cardUpgraded":
      out = "A card was upgraded for this combat";
      break;
    case "deckCardUpgraded":
      out = "Upgraded a card in your deck";
      break;
    case "cardCostModified":
      out = "A card's cost changed";
      break;
    case "shuffle":
      out = "Discard pile shuffled into draw";
      break;
    case "drawFizzled":
      out = "No cards left to draw";
      break;
    case "stanceChanged":
      out = `Stance: ${titleCase(str(p.from) ?? "?")} -> ${titleCase(str(p.to) ?? "?")}`;
      break;
    case "mantraGained":
      out = `Mantra +${num(p.n) ?? 0} (${num(p.total) ?? "?"}/10)`;
      break;
    case "orbChanneled":
      out = `Channeled ${orbName(bundle, str(p.orbId) ?? "?")}`;
      break;
    case "orbEvoked": {
      const t = num(p.times) ?? 1;
      out = `Evoked ${orbName(bundle, str(p.orbId) ?? "?")}${t > 1 ? ` x${t}` : ""}`;
      break;
    }
    case "darkOrbGrew":
      out = `Dark orb grew to ${num(p.amount) ?? "?"}`;
      break;
    case "goldStolen":
      out = `Enemy ${(num(p.idx) ?? 0) + 1} stole ${num(p.amount) ?? "?"} gold`;
      break;
    case "potionObtained":
      out = `Obtained potion: ${potionName(bundle, str(p.id) ?? "?")}`;
      break;
    case "stasisCardStolen":
      out = `Enemy ${(num(p.idx) ?? 0) + 1} trapped a card in Stasis`;
      break;
    case "stasisCardReturned":
      out = "A card returns from Stasis";
      break;
    case "eventReveal": {
      const cards = Array.isArray(p.cards) ? p.cards : [];
      out = `Revealed: ${cards.map((c) => cardName(bundle, str(c) ?? "?")).join(", ")}`;
      break;
    }
    default:
      out = rawFormat(ev);
  }
  return toAscii(out);
}
