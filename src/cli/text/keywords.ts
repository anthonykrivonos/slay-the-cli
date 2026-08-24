// Keyword glossary for the inspector: the short definitions that make a
// card's rules text legible to someone who does not already know the game.
//
// Keywords are read from the RAW corpus markup rather than the resolved
// prose, because "$Vulnerable" is an unambiguous token while the word
// "vulnerable" in a sentence is not. cardtext/relictext/potiontext each own
// their corpus import and hand their raw string here.
//
// Definitions never come from memory. Anything with a number in it is
// composed from data/corpus (powers.json via powerText, stances.json,
// orbs.json); only the numberless mechanics words are written out here.

import stancesCorpus from "../../../data/corpus/stances.json";
import orbsCorpus from "../../../data/corpus/orbs.json";
import { powerText } from "./powertext";
import { toAscii } from "./ascii";

export interface Keyword {
  name: string;
  text: string;
}

/** Keywords whose token spans two words, tried before the single-word form. */
const MULTIWORD = new Set(["Plated Armor", "Lock On"]);

/** Inflections the corpus uses, folded onto the word we define. */
const ALIAS: Record<string, string> = {
  Exhausted: "Exhaust",
  Weakened: "Weak",
  Retained: "Retain",
  Channeled: "Channel",
  Evoked: "Evoke",
  Upgraded: "Upgrade",
  Orbs: "Orb",
  Stances: "Stance",
};

/** Words the player reads on every screen already - explaining them is noise. */
const TOO_BASIC = new Set(["Block", "Energy"]);

/** Keyword -> the power whose corpus text defines it. */
const POWER_OF: Record<string, string> = {
  Strength: "STRENGTH",
  Dexterity: "DEXTERITY",
  Focus: "FOCUS",
  Weak: "WEAK",
  Vulnerable: "VULNERABLE",
  Frail: "FRAIL",
  Poison: "POISON",
  Artifact: "ARTIFACT",
  Intangible: "INTANGIBLE",
  Thorns: "THORNS",
  Confused: "CONFUSED",
  Mantra: "MANTRA",
  Ritual: "RITUAL",
  Metallicize: "METALLICIZE",
  Regeneration: "REGEN",
  "Plated Armor": "PLATED_ARMOR",
  "Lock On": "LOCK_ON",
};

/** Mechanics words that carry no number, so there is nothing to source. */
const MECHANIC: Record<string, string> = {
  Exhaust: "Removed from your deck for the rest of the combat.",
  Ethereal: "Exhausts itself if it is still in your hand when your turn ends.",
  Innate: "Starts in your opening hand every combat.",
  Retain: "Stays in your hand instead of being discarded when your turn ends.",
  Unplayable: "Cannot be played.",
  Scry: "Look at the top of your draw pile and discard any of it you want.",
  Channel: "Create an orb and put it in an empty orb slot.",
  Evoke: "Trigger an orb's evoke effect, then remove it.",
  Orb: "An effect held in a slot that fires every turn until it is evoked.",
  Stance: "A posture that changes how much damage you deal and take.",
  Fatal: "The condition holds when the attack kills the enemy.",
  Transform: "Replace a card with a different random card.",
  Upgrade: "Improve a card to its + version.",
};

/** "double" / "triple" for the stance damage multipliers. */
function times(n: number): string {
  if (n === 2) return "double";
  if (n === 3) return "triple";
  return `${n}x`;
}

const STANCE: Record<string, string> = {};
for (const s of stancesCorpus.stances) {
  if (s.id === "NEUTRAL") continue;
  const parts = ["A stance."];
  if (s.attackDamageDealtMultiplier !== 1) parts.push(`Deal ${times(s.attackDamageDealtMultiplier)} damage.`);
  if (s.attackDamageReceivedMultiplier !== 1) parts.push(`Receive ${times(s.attackDamageReceivedMultiplier)} damage.`);
  if (s.onEnter) parts.push(`Enter: ${s.onEnter}`);
  if (s.onExit) parts.push(`Exit: ${s.onExit}`);
  if (s.autoExit) parts.push(s.autoExit);
  STANCE[s.name] = parts.join(" ");
}

const TIMING: Record<string, string> = { endOfTurn: "End of turn", startOfTurn: "Start of turn" };

const ORB: Record<string, string> = {};
for (const o of orbsCorpus) {
  const when = TIMING[o.passive.timing] ?? "Passive";
  ORB[o.name] = `An orb. ${when}: ${o.passive.text} Evoke: ${o.evoke.text}`;
}

/** Definition for one keyword, or "" when there is nothing worth saying.
 *  A power's corpus text writes its stack count as a bare X; when the text we
 *  came from said how many ("Apply 2 $Vulnerable"), fill it in. */
function define(name: string, amount: number | undefined): string {
  const powerId = POWER_OF[name];
  const text = powerId !== undefined ? powerText(powerId, amount) : (MECHANIC[name] ?? STANCE[name] ?? ORB[name] ?? "");
  // a definition is one line; the box it lands in does the wrapping
  return text.split("\n").join(" ");
}

interface Mention {
  name: string;
  /** the count written immediately before the token, when there was one */
  amount: number | undefined;
}

/** The keywords a raw corpus string names, canonical and in source order. */
function scan(raw: string): Mention[] {
  const out: Mention[] = [];
  const seen = new Set<string>();
  for (const m of raw.matchAll(/(?:(\d+) )?\$([A-Za-z-]+)(?: ([A-Za-z-]+))?/g)) {
    const pair = m[3] !== undefined ? `${m[2]} ${m[3]}` : "";
    const token = MULTIWORD.has(pair) ? pair : m[2]!;
    const name = ALIAS[token] ?? token;
    if (TOO_BASIC.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, amount: m[1] !== undefined ? Number(m[1]) : undefined });
  }
  return out;
}

/** The keywords a raw corpus string names, canonical and in source order. */
export function keywordsIn(raw: string): string[] {
  return scan(raw).map((m) => m.name);
}

/** How many definitions an inspector box is willing to carry. */
export const KEYWORD_LIMIT = 5;

/** Defined keywords for one or more raw corpus strings, capped and ASCII. */
export function glossary(raws: string[]): Keyword[] {
  const out: Keyword[] = [];
  const seen = new Set<string>();
  for (const raw of raws) {
    for (const { name, amount } of scan(raw)) {
      if (seen.has(name)) continue;
      seen.add(name);
      const text = define(name, amount);
      if (text.length === 0) continue;
      out.push({ name: toAscii(name), text: toAscii(text) });
      if (out.length >= KEYWORD_LIMIT) return out;
    }
  }
  return out;
}
