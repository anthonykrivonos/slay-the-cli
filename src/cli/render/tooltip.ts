// The bottom info panel (shared frame chrome): explains whatever holds the
// hover/selection focus - full card text, relic/potion effects, enemy
// intents, map nodes. Height comes from layout.tipHeight (0 on tight
// terminals); 1 rule + a head line + wrapped text lines.

import type { TooltipView } from "../state/view";
import type { Theme } from "./theme";
import { padClip, rule, wrapPlain } from "./widgets";

export function renderTooltip(
  tip: TooltipView | null,
  width: number,
  height: number,
  theme: Theme,
  toast: string | null = null,
): string[] {
  if (height <= 0) return [];
  const out: string[] = [theme.dim(rule("INFO", width))];
  if (toast !== null) {
    // a toast belongs here, not on the key-hint row: losing the hints is how
    // you lose the only clue for leaving a screen
    out.push(theme.inverse(padClip(` ${toast}`, width)));
    while (out.length < height) out.push("");
    return out.slice(0, height);
  }
  if (!tip) {
    out.push(theme.dim(" Tab/arrows browse - Enter selects - Esc clears - hotkeys act directly"));
  } else {
    const chip = theme.bold(theme.fg(tip.color, tip.chip));
    out.push(` ${chip}  ${theme.bold(tip.name)}${tip.meta.length > 0 ? `  ${theme.dim(tip.meta)}` : ""}`);
    const bodyRows = height - 2;
    const wrapped: string[] = [];
    for (const line of tip.lines) {
      if (line.length === 0) continue;
      wrapped.push(...wrapPlain(line, Math.max(10, width - 4)));
    }
    for (let i = 0; i < bodyRows; i++) {
      const more = i === bodyRows - 1 && wrapped.length > bodyRows;
      out.push(`   ${wrapped[i] ?? ""}${more ? " ..." : ""}`);
    }
  }
  while (out.length < height) out.push("");
  return out.slice(0, height).map((l) => padClip(l, width));
}
