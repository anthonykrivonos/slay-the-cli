// Bronze Automaton + Bronze Orb — exact ports from data/corpus/monsters-act2.json.
//
// Automaton (boss, slot 1 in the reference encounter; orbs spawn into slots
// 0 and 2 — generically: the two lowest slots in 0..2 that are not its own).
// Prebattle: MINION_LEADER + ARTIFACT 3. Deterministic script:
//   SPAWN_ORBS, then repeat [FLAIL, BOOST, FLAIL, BOOST, HYPER_BEAM, STUNNED];
//   at A19 HYPER_BEAM chains into BOOST instead of STUNNED, so the post-first-
//   beam loop is [BOOST, FLAIL, BOOST, HYPER_BEAM].
// One aiRng.random(99) is burned per turn (initial rollMove + noOpRollMove),
// which this engine's per-turn rollMove reproduces exactly.
//
// Bronze Orb (minion): STASIS steals the highest-rarity card (RARE > UNCOMMON
// > COMMON by the card's printed rarity — statuses count as COMMON in the
// reference's rarity table; if the pile holds none of those three, a uniform
// pick over the whole pile) from the draw pile (discard only when draw is
// empty; nothing when both are empty — the move still counts as used). The
// stolen card leaves the piles, is held on the orb (self.data.stasisCardIid),
// and returns to the player's HAND when the orb dies (overflow -> discard).
// Candidates of the target rarity are stable-sorted by the reference's fixed
// card sort order before the uniform cardRandomRng pick — approximated here by
// the card's display name (the reference's cardSortedIdx is name order).
// AI: STASIS at most once per orb (75% per roll until used), then BEAM 70%
// (never 3x) / SUPPORT_BEAM 30% (never 3x; +12 block to the Automaton).
// CONFLICT HONORED (post-stasis odds): lightspeed thresholds — BEAM 70%,
// SUPPORT_BEAM 30% (the wiki prose swaps them).
// CONFLICT HONORED (category): minion (spire-archive's "Elite" is a mislabel).
//
// hp quirk (game parity): each orb construct burns one monsterHpRng roll over
// the BASE range (52,58) before the real asc-tiered roll — reproduced in
// SPAWN_ORBS since the spawner owns the rolls. ENGINE-GAP: an orb placed
// directly in an encounter (never happens in the real game) skips the burn.

import type { MonsterDef } from "../../../engine/content/defs";
import type { CardInstance } from "../../../engine/combat/combatState";
import { rollMove, spawnMonster } from "../../../engine/combat/interpreter";
import { applyPower } from "../../../engine/combat/powerRuntime";
import { monster } from "../../../engine/core/ids";
import { firstTurn, hasRelic, lastMove, lastTwoMovesWere } from "../../util";
import { attackPlayer, escapeMinions, padMonsterSlots, prePower, selfBlock, selfPower, slotOpen } from "./_shared";

const SPAWN_ORBS = "BRONZE_AUTOMATON_SPAWN_ORBS";
const FLAIL = "BRONZE_AUTOMATON_FLAIL";
const BOOST = "BRONZE_AUTOMATON_BOOST";
const HYPER_BEAM = "BRONZE_AUTOMATON_HYPER_BEAM";
const STUNNED = "BRONZE_AUTOMATON_STUNNED";

export const bronzeAutomaton: MonsterDef = {
  id: "BRONZE_AUTOMATON",
  name: "Bronze Automaton",
  category: "boss",
  hp: (asc) => (asc >= 9 ? [320, 320] : [300, 300]),
  preBattle: (_ctx, self) => {
    prePower(self, "MINION_LEADER", 1);
    prePower(self, "ARTIFACT", 3);
  },
  onDeath: (ctx, _self) => escapeMinions(ctx),
  moves: {
    BRONZE_AUTOMATON_SPAWN_ORBS: {
      id: SPAWN_ORBS,
      intent: "unknown",
      execute: (ctx, self) => {
        padMonsterSlots(ctx, 3);
        const slots = [0, 1, 2].filter((s) => s !== self.idx && slotOpen(ctx, s)).slice(0, 2);
        for (const slot of slots) {
          const hpRng = ctx.rng("monsterHpRng");
          hpRng.randomRange(52, 58); // burned construct roll (game parity)
          const [lo, hi] = ctx.bundle.monsters.get("BRONZE_ORB")!.hp(ctx.asc);
          const hp = hpRng.randomRange(lo, hi);
          spawnMonster(ctx, "BRONZE_ORB", slot, hp, false); // orb preBattle applies MINION
          if (hasRelic(ctx, "PHILOSOPHERS_STONE")) {
            applyPower(ctx, monster(slot), monster(slot), "STRENGTH", 1);
          }
          rollMove(ctx, ctx.combat!.monsters[slot]!); // orbs act the round AFTER spawning
        }
      },
    },
    BRONZE_AUTOMATON_FLAIL: {
      id: FLAIL,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 8 : 7, 2),
    },
    BRONZE_AUTOMATON_BOOST: {
      id: BOOST,
      intent: "defendBuff",
      execute: (ctx, self) => {
        selfPower(ctx, self, "STRENGTH", ctx.asc >= 4 ? 4 : 3);
        selfBlock(ctx, self, ctx.asc >= 9 ? 12 : 9);
      },
    },
    BRONZE_AUTOMATON_HYPER_BEAM: {
      id: HYPER_BEAM,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, ctx.asc >= 4 ? 50 : 45),
    },
    BRONZE_AUTOMATON_STUNNED: {
      id: STUNNED,
      intent: "stun",
      execute: () => {},
    },
  },
  getMove: (ctx, self) => {
    if (firstTurn(self)) return SPAWN_ORBS;
    switch (lastMove(self)) {
      case SPAWN_ORBS:
      case STUNNED:
        return FLAIL;
      case FLAIL:
        return BOOST;
      case BOOST:
        // lastBoostWasFlail alternation (miscInfo in the reference)
        if (self.data.lastBoostWasFlail) {
          self.data.lastBoostWasFlail = false;
          return HYPER_BEAM;
        }
        self.data.lastBoostWasFlail = true;
        return FLAIL;
      default:
        return ctx.asc >= 19 ? BOOST : STUNNED; // HYPER_BEAM
    }
  },
};

const BEAM = "BRONZE_ORB_BEAM";
const SUPPORT_BEAM = "BRONZE_ORB_SUPPORT_BEAM";
const STASIS = "BRONZE_ORB_STASIS";

const rarityOf = (ctx: { bundle: { cards: Map<string, { rarity: string }> } }, c: CardInstance): string =>
  ctx.bundle.cards.get(c.defId)?.rarity ?? "special";

export const bronzeOrb: MonsterDef = {
  id: "BRONZE_ORB",
  name: "Bronze Orb",
  category: "minion",
  hp: (asc) => (asc >= 9 ? [54, 60] : [52, 58]),
  preBattle: (_ctx, self) => prePower(self, "MINION", 1),
  onDeath: (ctx, self) => {
    // the stolen card returns to the player's hand (overflow -> discard)
    const iid = self.data.stasisCardIid as number | undefined;
    if (iid === undefined) return;
    delete self.data.stasisCardIid;
    const combat = ctx.combat!;
    if (!combat.cards[iid]) return;
    if (combat.player.piles.hand.length >= 10) combat.player.piles.discard.push(iid);
    else combat.player.piles.hand.push(iid);
    ctx.emit("stasisCardReturned", { idx: self.idx, iid });
  },
  moves: {
    BRONZE_ORB_BEAM: {
      id: BEAM,
      intent: "attack",
      execute: (ctx, self) => attackPlayer(ctx, self, 8),
    },
    BRONZE_ORB_SUPPORT_BEAM: {
      id: SUPPORT_BEAM,
      intent: "defend",
      execute: (ctx, self) => {
        const automaton = ctx.combat!.monsters.find(
          (m) => m.id === "BRONZE_AUTOMATON" && !m.isDead && !m.isEscaped && m.idx !== self.idx,
        );
        if (!automaton) return;
        ctx.queue.addToBottom({ kind: "gainBlock", target: monster(automaton.idx), amount: 12, fromCard: false });
      },
    },
    BRONZE_ORB_STASIS: {
      id: STASIS,
      intent: "strongDebuff",
      execute: (ctx, self) => {
        self.data.usedStasis = 1; // counts as used even when nothing is stolen
        const piles = ctx.combat!.player.piles;
        const pile = piles.draw.length > 0 ? piles.draw : piles.discard.length > 0 ? piles.discard : null;
        if (!pile) return;
        const cards = pile.map((iid) => ctx.combat!.cards[iid]!);
        let pool: CardInstance[] = [];
        for (const rarity of ["rare", "uncommon", "common"]) {
          pool = cards.filter((c) => rarityOf(ctx, c) === rarity);
          if (pool.length > 0) break;
        }
        let chosen: CardInstance;
        if (pool.length === 0) {
          // only basic/special/curse rarities left: uniform over the whole pile
          chosen = cards[ctx.rng("cardRandomRng").random(cards.length - 1)]!;
        } else {
          // stable-sort by the fixed card sort order (name order; see header)
          const sorted = [...pool].sort((a, b) => {
            const an = ctx.bundle.cards.get(a.defId)?.name ?? a.defId;
            const bn = ctx.bundle.cards.get(b.defId)?.name ?? b.defId;
            return an < bn ? -1 : an > bn ? 1 : 0;
          });
          chosen = sorted[ctx.rng("cardRandomRng").random(sorted.length - 1)]!;
        }
        pile.splice(pile.indexOf(chosen.iid), 1); // out of the piles; instance stays registered
        self.data.stasisCardIid = chosen.iid;
        prePower(self, "STASIS", 1);
        ctx.emit("stasisCardStolen", { idx: self.idx, iid: chosen.iid });
      },
    },
  },
  getMove: (ctx, self, roll) => {
    if (!self.data.usedStasis && roll >= 25) return STASIS;
    if (roll >= 70 && !lastTwoMovesWere(self, SUPPORT_BEAM)) return SUPPORT_BEAM;
    if (!lastTwoMovesWere(self, BEAM)) return BEAM;
    return SUPPORT_BEAM;
  },
};
