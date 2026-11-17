// Master-deck edits shared by the run layer and content. One obtain path so
// eggs, Omamori, and Darkstone Periapt cannot be skipped, and one removal
// path so Parasite's max-HP loss cannot be skipped.

import type { EffectCtx } from "../content/defs";
import type { CardId } from "../core/ids";
import { PLAYER } from "../core/ids";
import { vetoHook } from "../core/hooks";
import { hasRelic } from "./rewards";
import type { MasterCard } from "./runState";

/** Curses the removal / transform screens never offer. */
export const UNREMOVABLE_CURSES: readonly CardId[] = ["ASCENDERS_BANE", "NECRONOMICURSE", "CURSE_OF_THE_BELL"];

/** Cards a removal screen may target: not bottled, not an unremovable curse. */
export function removableIndices(ctx: EffectCtx): number[] {
  return ctx.run.deck
    .map((_, i) => i)
    .filter((i) => {
      const mc = ctx.run.deck[i]!;
      return !mc.bottled && !UNREMOVABLE_CURSES.includes(mc.defId);
    });
}

/** Molten / Toxic / Frozen Egg: the first copy of a matching card enters upgraded. */
export function eggUpgrades(ctx: EffectCtx, defId: CardId, upgrades: number): number {
  if (upgrades > 0) return upgrades;
  const type = ctx.bundle.cards.get(defId)?.type;
  if (type === "attack" && hasRelic(ctx.run, "MOLTEN_EGG")) return 1;
  if (type === "skill" && hasRelic(ctx.run, "TOXIC_EGG")) return 1;
  if (type === "power" && hasRelic(ctx.run, "FROZEN_EGG")) return 1;
  return 0;
}

/** Push a master card. Returns false when a relic vetoes the obtain (Omamori). */
export function obtainMasterCard(ctx: EffectCtx, defId: CardId, upgrades = 0, misc = 0): boolean {
  if (!vetoHook(ctx, PLAYER, "onObtainCard", defId)) return false;
  const up = eggUpgrades(ctx, defId, upgrades);
  ctx.run.deck.push({ defId, upgrades: up, misc, bottled: false });
  ctx.emit("deckCardObtained", { defId, upgrades: up });
  return true;
}

/** Parasite: losing the card from the deck costs 3 max HP (current HP clamps). */
function parasiteToll(ctx: EffectCtx, mc: MasterCard): void {
  if (mc.defId !== "PARASITE") return;
  ctx.run.maxHp = Math.max(1, ctx.run.maxHp - 3);
  ctx.run.hp = Math.min(ctx.run.hp, ctx.run.maxHp);
}

/** Remove one master card by index. No-op when the index is empty. */
export function removeDeckAt(ctx: EffectCtx, index: number): MasterCard | undefined {
  const mc = ctx.run.deck[index];
  if (!mc) return undefined;
  parasiteToll(ctx, mc);
  ctx.run.deck.splice(index, 1);
  return mc;
}
