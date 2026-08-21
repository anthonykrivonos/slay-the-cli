// One-time special event pool (14 events; NOTE_FOR_YOURSELF drops out of the
// pool at ascension >= 15) - data/corpus/events.json is the spec.

import type { EventDef, EffectCtx } from "../../engine/content/defs";
import type { RewardEntry } from "../../engine/run/runState";
import type { RelicId } from "../../engine/core/ids";
import { returnRandomPotion } from "../../engine/run/rewards";
import { JavaRandom, javaShuffle } from "../../engine/core/rng";
import {
  a15,
  cardName,
  colorlessViaShuffle,
  damagePlayer,
  dataOf,
  endEvent,
  fractionMaxHp,
  gainGold,
  gainMaxHp,
  grantPotionDirect,
  hasRelic,
  healHp,
  healToFull,
  leaveOption,
  loseGold,
  loseHp,
  obtainCard,
  obtainRelic,
  openRewards,
  option,
  peekData,
  removableIndices,
  removeDeckCards,
  removeRelic,
  requestDeckChoice,
  screenlessRandomRelic,
  simpleEvent,
  transformDeckCard,
  upgradeableIndices,
  upgradeDeckCard,
  CURSE_IDS,
  UNREMOVABLE_CURSES,
} from "./lib";

// --- Ominous Forge ------------------------------------------------------------------------

const ominousForge: EventDef = simpleEvent({
  id: "OMINOUS_FORGE",
  name: "Ominous Forge",
  pool: "oneTime",
  summary: "An abandoned forge upgrades a card, or its stash yields a relic bound to a curse.",
  options: () => [
    option(
      "Forge: upgrade a card",
      (ctx) => requestDeckChoice(ctx, { tag: "upgrade", indices: upgradeableIndices(ctx), min: 1, max: 1, reason: "event:forge" }),
      (ctx) => upgradeableIndices(ctx).length > 0,
    ),
    option("Rummage: obtain Warped Tongs relic and the Pain curse", (ctx) => {
      obtainCard(ctx, "PAIN");
      obtainRelic(ctx, "WARPED_TONGS");
      endEvent(ctx);
    }),
    leaveOption(),
  ],
  onResume: (ctx, _tag, chosen) => {
    if (chosen[0] !== undefined) upgradeDeckCard(ctx, chosen[0]);
    endEvent(ctx);
  },
});

// --- Bonfire Spirits ----------------------------------------------------------------------

const bonfireSpirits: EventDef = simpleEvent({
  id: "BONFIRE_SPIRITS",
  name: "Bonfire Spirits",
  pool: "oneTime",
  summary: "Fire spirits consume one offered card and repay you according to its rarity.",
  options: () => [
    option(
      "Offer a card: remove it; reward scales with rarity",
      (ctx) => requestDeckChoice(ctx, { tag: "offer", indices: removableIndices(ctx), min: 1, max: 1, reason: "event:bonfire" }),
      (ctx) => removableIndices(ctx).length > 0,
    ),
  ],
  onResume: (ctx, _tag, chosen) => {
    const idx = chosen[0];
    if (idx !== undefined && ctx.run.deck[idx]) {
      const def = ctx.bundle.cards.get(ctx.run.deck[idx]!.defId);
      removeDeckCards(ctx, [idx]);
      if (def) {
        if (def.type === "curse") obtainRelic(ctx, "SPIRIT_POOP");
        else if (def.rarity === "basic") {
          // nothing
        } else if (def.rarity === "common" || def.rarity === "special") healHp(ctx, 5);
        else if (def.rarity === "uncommon") healHp(ctx, 10);
        else if (def.rarity === "rare") {
          gainMaxHp(ctx, 10);
          healToFull(ctx);
        }
      }
    }
    endEvent(ctx);
  },
});

// --- Designer In-Spire ----------------------------------------------------------------------

const designerCosts = (ctx: EffectCtx) =>
  a15(ctx)
    ? { adjust: 50, clean: 75, full: 110, punch: 5 }
    : { adjust: 40, clean: 60, full: 90, punch: 3 };

const designerInSpire: EventDef = {
  id: "DESIGNER_IN_SPIRE",
  name: "Designer In-Spire",
  pool: "oneTime",
  canSpawn: (run) => (run.act === 2 || run.act === 3) && run.gold >= 75,
  onEnter: (ctx) => {
    // service variants are fixed at setup with two miscRng booleans
    const misc = ctx.rng("miscRng");
    const d = dataOf(ctx);
    d.upgradeChoice = misc.randomBoolean(); // true: choose 1; false: 2 random
    d.cleanupChoice = misc.randomBoolean(); // true: choose 1 removal; false: transform 2 random
  },
  build: (ctx) => {
    const costs = designerCosts(ctx);
    const d = peekData(ctx);
    return {
      summary: "A snob designer sells deck services; each visit rolls which variant of two services is offered.",
      options: [
        option(
          d.upgradeChoice
            ? `Adjustments: pay ${costs.adjust} gold; upgrade a chosen card`
            : `Adjustments: pay ${costs.adjust} gold; upgrade 2 random cards`,
          (c) => {
            loseGold(c, costs.adjust);
            if (peekData(c).upgradeChoice) {
              requestDeckChoice(c, { tag: "upgrade1", indices: upgradeableIndices(c), min: 1, max: 1, reason: "event:designer" });
            } else {
              for (let k = 0; k < 2; k++) {
                const pool = upgradeableIndices(c);
                if (pool.length === 0) break;
                upgradeDeckCard(c, pool[c.rng("miscRng").random(pool.length - 1)]!);
              }
              endEvent(c);
            }
          },
          (c) => c.run.gold >= costs.adjust && upgradeableIndices(c).length > 0,
        ),
        option(
          d.cleanupChoice
            ? `Clean up: pay ${costs.clean} gold; remove a chosen card`
            : `Clean up: pay ${costs.clean} gold; transform 2 random cards`,
          (c) => {
            loseGold(c, costs.clean);
            if (peekData(c).cleanupChoice) {
              requestDeckChoice(c, { tag: "remove1", indices: removableIndices(c), min: 1, max: 1, reason: "event:designer" });
            } else {
              for (let k = 0; k < 2; k++) {
                const pool = removableIndices(c);
                if (pool.length === 0) break;
                transformDeckCard(c, pool[c.rng("miscRng").random(pool.length - 1)]!);
              }
              endEvent(c);
            }
          },
          (c) => c.run.gold >= costs.clean && removableIndices(c).length > 0,
        ),
        option(
          `Full service: pay ${costs.full} gold; remove a chosen card, then upgrade a random card`,
          (c) => {
            loseGold(c, costs.full);
            requestDeckChoice(c, { tag: "fullService", indices: removableIndices(c), min: 1, max: 1, reason: "event:designer" });
          },
          (c) => c.run.gold >= costs.full && removableIndices(c).length > 0,
        ),
        option(`Punch: lose ${costs.punch} HP`, (c) => {
          loseHp(c, designerCosts(c).punch);
          if (c.run.hp <= 0) return;
          endEvent(c);
        }),
      ],
    };
  },
  onResume: (ctx, tag, chosen) => {
    const idx = chosen[0];
    if (idx !== undefined) {
      if (tag === "upgrade1") upgradeDeckCard(ctx, idx);
      else if (tag === "remove1") removeDeckCards(ctx, [idx]);
      else if (tag === "fullService") {
        removeDeckCards(ctx, [idx]);
        const pool = upgradeableIndices(ctx);
        if (pool.length > 0) upgradeDeckCard(ctx, pool[ctx.rng("miscRng").random(pool.length - 1)]!);
      }
    }
    endEvent(ctx);
  },
};

// --- Duplicator --------------------------------------------------------------------------------

const duplicator: EventDef = simpleEvent({
  id: "DUPLICATOR",
  name: "Duplicator",
  pool: "oneTime",
  canSpawn: (run) => run.act === 2 || run.act === 3,
  summary: "An altar that copies one card in your deck.",
  options: () => [
    option(
      "Pray: duplicate a card (gain a copy)",
      (ctx) =>
        requestDeckChoice(ctx, { tag: "dup", indices: ctx.run.deck.map((_, i) => i), min: 1, max: 1, reason: "event:duplicator" }),
      (ctx) => ctx.run.deck.length > 0,
    ),
    leaveOption(),
  ],
  onResume: (ctx, _tag, chosen) => {
    const mc = chosen[0] !== undefined ? ctx.run.deck[chosen[0]] : undefined;
    if (mc) obtainCard(ctx, mc.defId, mc.upgrades, mc.misc); // exact copy (unbottled)
    endEvent(ctx);
  },
});

// --- Face Trader --------------------------------------------------------------------------------

const FACE_RELICS: RelicId[] = ["CULTIST_HEADPIECE", "FACE_OF_CLERIC", "GREMLIN_VISAGE", "NLOTHS_HUNGRY_FACE", "SSSERPENT_HEAD"];

const faceTrader: EventDef = simpleEvent({
  id: "FACE_TRADER",
  name: "Face Trader",
  pool: "oneTime",
  canSpawn: (run) => run.act === 1 || run.act === 2,
  summary: "A mask peddler pays gold to touch your face, or swaps it for a random face relic.",
  options: () => [
    option("Touch: gain 75 gold (50 at A15+), take 10% of max HP as damage (min 1)", (ctx) => {
      gainGold(ctx, a15(ctx) ? 50 : 75);
      damagePlayer(ctx, Math.max(1, fractionMaxHp(ctx, 0.1, "floor")));
      if (ctx.run.hp <= 0) return;
      endEvent(ctx);
    }),
    option("Trade: obtain a random face relic you do not own", (ctx) => {
      const candidates = FACE_RELICS.filter((id) => !hasRelic(ctx.run, id));
      if (candidates.length === 0) {
        obtainRelic(ctx, "CIRCLET");
      } else {
        javaShuffle(candidates, new JavaRandom(ctx.rng("miscRng").randomLong()));
        obtainRelic(ctx, candidates[0]!);
      }
      endEvent(ctx);
    }),
    leaveOption(),
  ],
});

// --- The Divine Fountain ---------------------------------------------------------------------------

const divineFountain: EventDef = simpleEvent({
  id: "THE_DIVINE_FOUNTAIN",
  name: "The Divine Fountain",
  pool: "oneTime",
  // any curse qualifies the spawn (even unremovable ones, like the reference)
  canSpawn: (run) => run.deck.some((mc) => CURSE_IDS.has(mc.defId)),
  summary: "Sacred water washes away every removable curse.",
  options: () => [
    option("Drink: remove all removable curses from your deck", (ctx) => {
      const idxs = ctx.run.deck
        .map((_, i) => i)
        .filter((i) => {
          const mc = ctx.run.deck[i]!;
          return ctx.bundle.cards.get(mc.defId)?.type === "curse" && !UNREMOVABLE_CURSES.includes(mc.defId);
        });
      removeDeckCards(ctx, idxs);
      endEvent(ctx);
    }),
    leaveOption(),
  ],
});

// --- Knowing Skull ------------------------------------------------------------------------------------

const skullBase = (ctx: EffectCtx): number => Math.max(6, fractionMaxHp(ctx, 0.1, "floor"));

const knowingSkull: EventDef = {
  id: "KNOWING_SKULL",
  name: "Knowing Skull",
  pool: "oneTime",
  canSpawn: (run) => run.act === 2 && run.hp >= 13,
  onEnter: (ctx) => {
    Object.assign(dataOf(ctx), { riches: 0, success: 0, potion: 0 });
  },
  build: (ctx) => {
    const d = peekData(ctx);
    const base = skullBase(ctx);
    const cost = (key: string): number => base + ((d[key] as number) ?? 0);
    const pay = (c: EffectCtx, key: string): boolean => {
      const dd = dataOf(c);
      const price = skullBase(c) + ((dd[key] as number) ?? 0);
      dd[key] = ((dd[key] as number) ?? 0) + 1;
      loseHp(c, price);
      return c.run.hp > 0;
    };
    return {
      summary: "A flaming skull sells gold, a colorless card, or a potion for HP; each purchase raises that item's price.",
      options: [
        option(`Riches: lose ${cost("riches")} HP, gain 90 gold (repeatable)`, (c) => {
          if (!pay(c, "riches")) return;
          gainGold(c, 90);
        }),
        option(`Success: lose ${cost("success")} HP, obtain a random uncommon colorless card (repeatable)`, (c) => {
          if (!pay(c, "success")) return;
          const id = colorlessViaShuffle(c, "uncommon");
          if (id) obtainCard(c, id);
        }),
        option(`A pick me up: lose ${cost("potion")} HP, obtain a random potion (repeatable; lost if slots are full)`, (c) => {
          if (!pay(c, "potion")) return;
          grantPotionDirect(c);
        }),
        option(`How do I leave: lose ${skullBase(ctx)} HP, event ends`, (c) => {
          loseHp(c, skullBase(c));
          if (c.run.hp <= 0) return;
          endEvent(c);
        }),
      ],
    };
  },
};

// --- Lab -----------------------------------------------------------------------------------------------

const lab: EventDef = simpleEvent({
  id: "LAB",
  name: "Lab",
  pool: "oneTime",
  summary: "An alchemy lab hands over free potions, no choice involved.",
  options: () => [
    option("Search: receive 3 random potions (2 at A15+) via the reward screen", (ctx) => {
      const n = a15(ctx) ? 2 : 3;
      const entries: RewardEntry[] = [];
      for (let i = 0; i < n; i++) {
        const id = returnRandomPotion(ctx);
        if (id) entries.push({ kind: "potion", id, taken: false });
      }
      openRewards(ctx, entries);
    }),
  ],
});

// --- N'loth --------------------------------------------------------------------------------------------

const nloth: EventDef = {
  id: "NLOTH",
  name: "N'loth",
  pool: "oneTime",
  canSpawn: (run) => run.act === 2 && run.relics.length >= 2,
  onEnter: (ctx) => {
    const idxs = ctx.run.relics.map((_, i) => i);
    javaShuffle(idxs, new JavaRandom(ctx.rng("miscRng").randomLong()));
    const d = dataOf(ctx);
    d.offerA = ctx.run.relics[idxs[0]!]?.defId ?? null;
    d.offerB = ctx.run.relics[idxs[1]!]?.defId ?? null;
  },
  build: (ctx) => {
    const d = peekData(ctx);
    const relicName = (id: unknown): string =>
      typeof id === "string" ? (ctx.bundle.relics.get(id)?.name ?? id) : "(none)";
    const offer = (key: "offerA" | "offerB") =>
      option(
        `Offer ${relicName(d[key])}: lose that relic, obtain N'loth's Gift`,
        (c) => {
          const id = peekData(c)[key];
          if (typeof id === "string") removeRelic(c, id);
          obtainRelic(c, "NLOTHS_GIFT");
          endEvent(c);
        },
        (c) => typeof peekData(c)[key] === "string",
      );
    return {
      summary: "A hungry creature eats one of two randomly chosen relics you own and leaves its gift behind.",
      options: [offer("offerA"), offer("offerB"), leaveOption()],
    };
  },
};

// --- Note For Yourself ------------------------------------------------------------------------------------

const noteForYourself: EventDef = simpleEvent({
  id: "NOTE_FOR_YOURSELF",
  name: "Note For Yourself",
  pool: "oneTime",
  canSpawn: (run) => run.ascension <= 14,
  summary: "A hidden note swaps a stored card from a past run for one of your current cards.",
  options: (b) => [
    option(
      "Take and give: obtain the stored card, then choose a deck card to store away",
      (ctx) => {
        // RUN-META-GAP: cross-run profile storage does not exist. Every run
        // behaves like a fresh profile: the stored card is IRON_WAVE (the
        // reference's noteForYourselfCard default); the card chosen to "store"
        // is removed but persisted nowhere.
        if (!ctx.bundle.cards.has("IRON_WAVE")) {
          endEvent(ctx); // storage absent and no default card: grant nothing
          return;
        }
        obtainCard(ctx, "IRON_WAVE");
        const indices = removableIndices(ctx);
        if (indices.length === 0) endEvent(ctx);
        else requestDeckChoice(ctx, { tag: "store", indices, min: 1, max: 1, reason: "event:note" });
      },
    ),
    option("Ignore: no effect", (ctx) => endEvent(ctx)),
  ],
  onResume: (ctx, _tag, chosen) => {
    removeDeckCards(ctx, chosen); // RUN-META-GAP: not written to any profile
    endEvent(ctx);
  },
});

// --- Secret Portal ------------------------------------------------------------------------------------------

const secretPortal: EventDef = simpleEvent({
  id: "SECRET_PORTAL",
  name: "Secret Portal",
  pool: "oneTime",
  // playtime >= 800s is a wall-clock gate the deterministic engine cannot see;
  // the reference abstracts it as !speedrunPace, which we model as always-open.
  canSpawn: (run) => run.act === 3,
  summary: "A portal offers an instant jump to the Act 3 boss, skipping every floor between.",
  options: () => [
    option("Enter the portal: travel immediately to the act boss", (ctx, svc) => svc.goToBoss()),
    leaveOption(),
  ],
});

// --- The Joust -----------------------------------------------------------------------------------------------

const theJoust: EventDef = simpleEvent({
  id: "THE_JOUST",
  name: "The Joust",
  pool: "oneTime",
  canSpawn: (run) => run.act === 2 && run.gold >= 50,
  summary: "A forced 50-gold wager on a duel between a knight and his pet's murderer.",
  options: () => [
    option(
      "Bet on the murderer: pay 50 gold; 70% chance to win 100 gold",
      (ctx) => {
        loseGold(ctx, 50);
        const ownerWins = ctx.rng("miscRng").randomBoolean(0.3);
        if (!ownerWins) gainGold(ctx, 100);
        endEvent(ctx);
      },
      (ctx) => ctx.run.gold >= 50,
    ),
    option(
      "Bet on the owner: pay 50 gold; 30% chance to win 250 gold",
      (ctx) => {
        loseGold(ctx, 50);
        const ownerWins = ctx.rng("miscRng").randomBoolean(0.3);
        if (ownerWins) gainGold(ctx, 250);
        endEvent(ctx);
      },
      (ctx) => ctx.run.gold >= 50,
    ),
  ],
});

// --- We Meet Again! ---------------------------------------------------------------------------------------------

const weMeetAgain: EventDef = {
  id: "WE_MEET_AGAIN",
  name: "We Meet Again!",
  pool: "oneTime",
  onEnter: (ctx) => {
    const misc = ctx.rng("miscRng");
    const d = dataOf(ctx);
    // setup rolls in option order, each only when the option is available
    const filled = ctx.run.potions.map((p, i) => (p !== null ? i : -1)).filter((i) => i !== -1);
    if (filled.length > 0) {
      javaShuffle(filled, new JavaRandom(misc.randomLong()));
      d.potionSlot = filled[0]!;
    }
    if (ctx.run.gold >= 50) d.goldAmount = misc.randomRange(50, Math.min(150, ctx.run.gold));
    const eligible = ctx.run.deck
      .map((_, i) => i)
      .filter((i) => {
        const def = ctx.bundle.cards.get(ctx.run.deck[i]!.defId);
        return def !== undefined && def.rarity !== "basic" && def.type !== "curse";
      });
    if (eligible.length > 0) {
      javaShuffle(eligible, new JavaRandom(misc.randomLong()));
      d.cardIdx = eligible[0]!;
    }
  },
  build: (ctx) => {
    const d = peekData(ctx);
    const cardIdx = d.cardIdx as number | undefined;
    const mc = cardIdx !== undefined ? ctx.run.deck[cardIdx] : undefined;
    return {
      summary: "A stranger claims friendship and trades a random relic for a potion, gold, or a card.",
      options: [
        option(
          "Give potion: lose a random held potion, obtain a random relic",
          (c) => {
            const slot = peekData(c).potionSlot as number;
            c.run.potions[slot] = null;
            obtainRelic(c, screenlessRandomRelic(c));
            endEvent(c);
          },
          (c) => {
            const slot = peekData(c).potionSlot as number | undefined;
            return slot !== undefined && c.run.potions[slot] !== null;
          },
        ),
        option(
          `Give gold: lose ${(d.goldAmount as number | undefined) ?? "50-150"} gold, obtain a random relic`,
          (c) => {
            loseGold(c, peekData(c).goldAmount as number);
            obtainRelic(c, screenlessRandomRelic(c));
            endEvent(c);
          },
          (c) => peekData(c).goldAmount !== undefined && c.run.gold >= (peekData(c).goldAmount as number),
        ),
        option(
          `Give card: lose ${mc ? cardName(ctx, mc) : "a random card"}, obtain a random relic`,
          (c) => {
            const idx = peekData(c).cardIdx as number;
            removeDeckCards(c, [idx]);
            obtainRelic(c, screenlessRandomRelic(c));
            endEvent(c);
          },
          (c) => peekData(c).cardIdx !== undefined,
        ),
        option("Attack: no effect, event ends", (c) => endEvent(c)),
      ],
    };
  },
};

// --- The Woman in Blue ---------------------------------------------------------------------------------------------

const womanInBlue: EventDef = simpleEvent({
  id: "THE_WOMAN_IN_BLUE",
  name: "The Woman in Blue",
  pool: "oneTime",
  canSpawn: (run) => run.gold >= 50,
  summary: "A pushy shopkeeper insists you buy 1-3 random potions; refusing has a price at high ascension.",
  options: () => {
    const buy = (count: number, cost: number) =>
      option(
        `Buy ${count} potion${count > 1 ? "s" : ""}: pay ${cost} gold`,
        (ctx) => {
          loseGold(ctx, cost);
          const entries: RewardEntry[] = [];
          for (let i = 0; i < count; i++) {
            const id = returnRandomPotion(ctx);
            if (id) entries.push({ kind: "potion", id, taken: false });
          }
          openRewards(ctx, entries);
        },
        (ctx) => ctx.run.gold >= cost,
      );
    return [
      buy(1, 20),
      buy(2, 30),
      buy(3, 40),
      option("Leave: no effect (at A15+: lose 5% of max HP)", (ctx) => {
        if (a15(ctx)) {
          loseHp(ctx, fractionMaxHp(ctx, 0.05, "ceil"));
          if (ctx.run.hp <= 0) return;
        }
        endEvent(ctx);
      }),
    ];
  },
});

export const oneTimeEvents: EventDef[] = [
  ominousForge,
  bonfireSpirits,
  designerInSpire,
  duplicator,
  faceTrader,
  divineFountain,
  knowingSkull,
  lab,
  nloth,
  noteForYourself,
  secretPortal,
  theJoust,
  weMeetAgain,
  womanInBlue,
];
