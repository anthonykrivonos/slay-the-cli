// Encounter compositions that the real game rolls when the fight starts
// (sts_lightspeed MonsterGroup::createMonsters). The encounter id on the map
// stays fixed; miscRng picks the bodies, and a few pairings also burn
// monsterHpRng for candidates that are built and then discarded.
//
// random(n) is inclusive. randomBoolean() with no argument is a fair coin.

import type { EffectCtx } from "../content/defs";
import type { MonsterId } from "../core/ids";
import { getActDef, resolveEncounter } from "./encounters";

export interface LineupSlot {
  id: MonsterId;
  /** Already rolled from monsterHpRng. Absent means setup rolls it. */
  hp?: number;
  /** Escaped placeholder. Gremlin Leader's front slot is empty. */
  gap?: boolean;
}

const GREMLIN_POOL: MonsterId[] = [
  "MAD_GREMLIN",
  "MAD_GREMLIN",
  "SNEAKY_GREMLIN",
  "SNEAKY_GREMLIN",
  "FAT_GREMLIN",
  "FAT_GREMLIN",
  "SHIELD_GREMLIN",
  "GREMLIN_WIZARD",
];

const SHAPE_POOL: MonsterId[] = ["REPULSOR", "REPULSOR", "EXPLODER", "EXPLODER", "SPIKER", "SPIKER"];

const SLIME_SWARM: MonsterId[] = [
  "SPIKE_SLIME_S",
  "SPIKE_SLIME_S",
  "SPIKE_SLIME_S",
  "ACID_SLIME_S",
  "ACID_SLIME_S",
];

function takeFrom(ctx: EffectCtx, pool: MonsterId[]): MonsterId {
  const rng = ctx.rng("miscRng");
  const last = pool.length - 1;
  const idx = rng.random(last);
  const id = pool[idx]!;
  for (let i = idx; i < last; i++) pool[i] = pool[i + 1]!;
  pool.pop();
  return id;
}

function louse(ctx: EffectCtx): MonsterId {
  return ctx.rng("miscRng").randomBoolean() ? "RED_LOUSE" : "GREEN_LOUSE";
}

function slaver(ctx: EffectCtx): MonsterId {
  return ctx.rng("miscRng").randomBoolean() ? "RED_SLAVER" : "BLUE_SLAVER";
}

function ancientShape(ctx: EffectCtx): MonsterId {
  const shapes: MonsterId[] = ["SPIKER", "REPULSOR", "EXPLODER"];
  return shapes[ctx.rng("miscRng").random(2)]!;
}

function gremlin(ctx: EffectCtx): MonsterId {
  return GREMLIN_POOL[ctx.rng("miscRng").random(7)]!;
}

/** HP roll the reference spends inside Monster::construct, kept or discarded. */
function rollHp(ctx: EffectCtx, id: MonsterId): number {
  const def = ctx.bundle.monsters.get(id);
  if (!def) throw new Error(`unknown monster ${id}`);
  const [lo, hi] = def.hp(ctx.asc);
  return ctx.rng("monsterHpRng").randomRange(lo, hi);
}

/** Build every candidate (HP included), then keep one. Matches create*Wildlife. */
function pickBuilt(ctx: EffectCtx, ids: MonsterId[]): LineupSlot {
  const built = ids.map((id) => ({ id, hp: rollHp(ctx, id) }));
  return built[ctx.rng("miscRng").random(built.length - 1)]!;
}

/** Exordium Thugs' back row: Cultist, a random Slaver, or Looter. */
function strongHumanoid(ctx: EffectCtx): LineupSlot {
  const slaverId = slaver(ctx);
  return pickBuilt(ctx, ["CULTIST", slaverId, "LOOTER"]);
}

/** Exordium Wildlife's front row: Fungi Beast or Jaw Worm. */
function strongWildlife(ctx: EffectCtx): LineupSlot {
  return pickBuilt(ctx, ["FUNGI_BEAST", "JAW_WORM"]);
}

/** Louse (color rolled even when not kept), Spike Slime (M), or Acid Slime (M). */
function weakWildlife(ctx: EffectCtx): LineupSlot {
  const louseId = louse(ctx);
  return pickBuilt(ctx, [louseId, "SPIKE_SLIME_M", "ACID_SLIME_M"]);
}

function slots(ids: MonsterId[]): LineupSlot[] {
  return ids.map((id) => ({ id }));
}

/**
 * Monster slots for a fight. Most encounters are the act table. The ones the
 * reference rolls at battle init are rolled here, on miscRng (and, for the
 * wildlife pairings, monsterHpRng).
 */
export function rollLineup(
  ctx: EffectCtx,
  roomKind: "monster" | "elite" | "boss",
  encounterId: string,
): LineupSlot[] {
  const misc = ctx.rng("miscRng");
  switch (encounterId) {
    case "TWO_LOUSE":
      return slots([louse(ctx), louse(ctx)]);
    case "THREE_LOUSE":
      return slots([louse(ctx), louse(ctx), louse(ctx)]);
    case "SMALL_SLIMES":
      return misc.randomBoolean()
        ? slots(["SPIKE_SLIME_S", "ACID_SLIME_M"])
        : slots(["ACID_SLIME_S", "SPIKE_SLIME_M"]);
    case "LARGE_SLIME":
      return slots([misc.randomBoolean() ? "ACID_SLIME_L" : "SPIKE_SLIME_L"]);
    case "LOTS_OF_SLIMES": {
      const bag = [...SLIME_SWARM];
      const ids: MonsterId[] = [];
      for (let i = bag.length - 1; i >= 0; i--) ids.push(takeFrom(ctx, bag));
      return slots(ids);
    }
    case "GREMLIN_GANG": {
      const bag = [...GREMLIN_POOL];
      const ids: MonsterId[] = [];
      for (let i = 0; i < 4; i++) ids.push(takeFrom(ctx, bag));
      return slots(ids);
    }
    case "EXORDIUM_THUGS":
      return [weakWildlife(ctx), strongHumanoid(ctx)];
    case "EXORDIUM_WILDLIFE":
      return [strongWildlife(ctx), weakWildlife(ctx)];
    case "GREMLIN_LEADER":
      // slot 0 empty, minions in 1 and 2, leader in 3 (each minion is an
      // independent draw from the 8-entry pool, so duplicates are allowed)
      return [
        { id: "GAP", gap: true },
        { id: gremlin(ctx) },
        { id: gremlin(ctx) },
        { id: "GREMLIN_LEADER" },
      ];
    case "THREE_SHAPES":
    case "FOUR_SHAPES": {
      const bag = [...SHAPE_POOL];
      const n = encounterId === "THREE_SHAPES" ? 3 : 4;
      const ids: MonsterId[] = [];
      for (let i = 0; i < n; i++) ids.push(takeFrom(ctx, bag));
      return slots(ids);
    }
    case "SPHERE_AND_TWO_SHAPES":
      return slots([ancientShape(ctx), ancientShape(ctx), "SPHERIC_GUARDIAN"]);
    default: {
      if (ctx.run.act === 4) {
        if (encounterId === "SHIELD_AND_SPEAR") return slots(["SPIRE_SHIELD", "SPIRE_SPEAR"]);
        if (encounterId === "THE_HEART") return slots(["CORRUPT_HEART"]);
      }
      if (roomKind === "boss") {
        const actDef = getActDef(ctx.bundle.acts, ctx.run.act);
        const multi = actDef.bossEncounters?.find((b) => b.id === encounterId);
        return slots(multi ? [...multi.monsters] : [encounterId]);
      }
      return slots(resolveEncounter(getActDef(ctx.bundle.acts, ctx.run.act), encounterId));
    }
  }
}
