// The events workstream: all 51 events (act1 11 / act2 13 / act3 7 / shrine 6 /
// oneTime 14) + the "__eventChoice" continuation that routes pending-choice
// resumes back to the owning EventDef.onResume.

import type { EventDef, EffectFn } from "../../engine/content/defs";
import { act1Events } from "./act1";
import { act2Events } from "./act2";
import { act3Events } from "./act3";
import { shrineEvents } from "./shrines";
import { oneTimeEvents } from "./oneTime";

export const allEvents: EventDef[] = [...act1Events, ...act2Events, ...act3Events, ...shrineEvents, ...oneTimeEvents];

/** Resume for event-requested PendingChoices (deck picks, option picks). */
const eventChoiceResume: EffectFn = (ctx, args) => {
  const { eventId, tag, extra, chosen } = args as {
    eventId: string;
    tag: string;
    extra?: unknown;
    chosen: number[];
  };
  const def = ctx.bundle.events.get(eventId);
  if (!def?.onResume) throw new Error(`event ${eventId} has no onResume for tag ${tag}`);
  def.onResume(ctx, tag, chosen ?? [], extra);
};

export const eventEffects: ReadonlyArray<readonly [string, EffectFn]> = [["__eventChoice", eventChoiceResume]];
