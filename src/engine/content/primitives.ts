// Runner for the declarative card-primitives DSL. Registered in the bundle as
// effect "__primitives"; the interpreter dispatches simple cards here so ~60%
// of the card pool needs no bespoke effect function and stays corpus-auditable.

import type { CardCtx, CardDef, CardPrimitive, EffectCtx } from "./defs";
import { calcCardDamage, calcBlock } from "../combat/damageCalc";
import { PLAYER, monster } from "../core/ids";

function resolveN(cctx: CardCtx, def: CardDef, n: "damage" | "block" | "magic" | "hits" | number | undefined): number {
  if (n === undefined) return 1;
  if (typeof n === "number") return n;
  const upgraded = cctx.card.upgrades > 0;
  const base = def.values[n];
  const up = def.upgradeValues[n];
  const v = upgraded && up !== undefined ? up : base;
  return v ?? 0;
}

export function runPrimitives(ctx: EffectCtx, args: unknown): void {
  const cctx = ctx as CardCtx;
  const def = args as CardDef;
  if (!def.primitives) return;

  for (const p of def.primitives) {
    executePrimitive(cctx, def, p);
  }
}

function executePrimitive(cctx: CardCtx, def: CardDef, p: CardPrimitive): void {
  const q = cctx.queue;
  switch (p.do) {
    case "damage": {
      const base = resolveN(cctx, def, p.n);
      const hits = resolveN(cctx, def, p.hits ?? 1);
      const target = cctx.target ?? 0;
      // damage is calculated once per play and reused for each hit (game behavior)
      const dmg = calcCardDamage(cctx, cctx.card, target, base);
      for (let i = 0; i < hits; i++) {
        q.addToBottom({
          kind: "damage",
          target: monster(target),
          info: { type: "attack", source: PLAYER, amount: dmg },
        });
      }
      break;
    }
    case "damageAll": {
      const base = resolveN(cctx, def, p.n);
      const hits = resolveN(cctx, def, p.hits ?? 1);
      const amounts = cctx.combat!.monsters.map((_, i) => calcCardDamage(cctx, cctx.card, i, base));
      for (let i = 0; i < hits; i++) {
        q.addToBottom({ kind: "damageAllMonsters", amounts, info: { type: "attack", source: PLAYER } });
      }
      break;
    }
    case "block": {
      const base = resolveN(cctx, def, p.n);
      const block = calcBlock(cctx, base, cctx.card, true);
      q.addToBottom({ kind: "gainBlock", target: PLAYER, amount: block, fromCard: true });
      break;
    }
    case "applyPower": {
      const amount = resolveN(cctx, def, p.n);
      const targets =
        p.target === "self"
          ? [PLAYER]
          : p.target === "target"
            ? [monster(cctx.target ?? 0)]
            : cctx.combat!.monsters.filter((m) => !m.isDead && !m.isEscaped).map((m) => monster(m.idx));
      for (const t of targets) {
        q.addToBottom({ kind: "applyPower", source: PLAYER, target: t, powerId: p.power, amount });
      }
      break;
    }
    case "draw":
      q.addToBottom({ kind: "draw", n: resolveN(cctx, def, p.n) });
      break;
    case "gainEnergy":
      q.addToBottom({ kind: "gainEnergy", n: resolveN(cctx, def, p.n) });
      break;
    case "loseHp":
      q.addToBottom({ kind: "loseHp", target: PLAYER, amount: resolveN(cctx, def, p.n) });
      break;
    case "channel": {
      const n = resolveN(cctx, def, p.n ?? 1);
      for (let i = 0; i < n; i++) q.addToBottom({ kind: "channelOrb", orbId: p.orb });
      break;
    }
    case "gainMantra":
      q.addToBottom({ kind: "gainMantra", n: resolveN(cctx, def, p.n) });
      break;
    case "scry":
      q.addToBottom({ kind: "scry", n: resolveN(cctx, def, p.n) });
      break;
    case "changeStance":
      q.addToBottom({ kind: "changeStance", stanceId: p.stance });
      break;
    case "makeCard": {
      const n = resolveN(cctx, def, p.n ?? 1);
      q.addToBottom({
        kind: "makeTempCard",
        defId: p.card,
        upgrades: p.upgraded ? 1 : 0,
        dest: p.dest,
        n,
      });
      break;
    }
  }
}
