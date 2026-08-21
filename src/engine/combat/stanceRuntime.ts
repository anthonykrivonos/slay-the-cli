// Watcher stance runtime: change flow (no-op if same; exit effects -> swap ->
// enter effects -> onChangeStance hooks) and Mantra accumulation (>=10 subtracts
// 10 and enters Divinity).

import type { EffectCtx } from "../content/defs";
import { fireHook } from "../core/hooks";
import { PLAYER } from "../core/ids";

export function changeStance(ctx: EffectCtx, to: string): void {
  const player = ctx.combat!.player;
  const from = player.stance;
  if (from === to) return;

  const fromDef = ctx.bundle.stances.get(from);
  const toDef = ctx.bundle.stances.get(to);

  fromDef?.onExit?.(ctx);
  player.stance = to;
  toDef?.onEnter?.(ctx);
  fireHook(ctx, PLAYER, "onChangeStance", from, to);
  // in-discard stance self-triggers (Flurry of Blows)
  for (const iid of [...player.piles.discard]) {
    const c = ctx.combat!.cards[iid];
    const def = c && ctx.bundle.cards.get(c.defId);
    if (c && def?.onStanceChangeThisInDiscard) {
      def.onStanceChangeThisInDiscard({ ...ctx, card: c, target: null, energyOnUse: 0, upgraded: c.upgrades > 0 });
    }
  }
  ctx.emit("stanceChanged", { from, to });
}

export function gainMantra(ctx: EffectCtx, n: number): void {
  const player = ctx.combat!.player;
  player.mantra += n;
  ctx.emit("mantraGained", { n, total: player.mantra });
  if (player.mantra >= 10) {
    player.mantra -= 10;
    changeStance(ctx, "DIVINITY");
  }
}

/** Divinity auto-exits at end of turn. */
export function stanceAtEndOfTurn(ctx: EffectCtx): void {
  const player = ctx.combat!.player;
  const def = ctx.bundle.stances.get(player.stance);
  if (def?.autoExitAtEndOfTurn) changeStance(ctx, "NEUTRAL");
}
