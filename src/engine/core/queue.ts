// GameActionManager-equivalent action queue. StS semantics preserved exactly:
//   addToBottom = normal FIFO enqueue
//   addToTop    = LIFO preempt (last addToTop runs first)
// The card queue is separate; the interpreter drains one card queue item into
// a useCard resolution whenever the action queue is empty (mirroring
// GameActionManager.getNextAction).

import type { GameAction } from "./actions";

export class ActionQueue {
  private items: GameAction[] = [];

  addToBottom(a: GameAction): void {
    this.items.push(a);
  }

  addToTop(a: GameAction): void {
    this.items.unshift(a);
  }

  pop(): GameAction | undefined {
    return this.items.shift();
  }

  get size(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items.length = 0;
  }
}
