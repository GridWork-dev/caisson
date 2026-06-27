// The hooks dispatcher (ADR-0065). Engine-neutral: handlers OBSERVE lifecycle act transitions at
// `${'before'|'after'}:${act}` points; they never alter the FSM and never run an engine. Dispatch
// runs handlers in registration order, awaiting each; an unregistered point is a no-op (0 handlers),
// never a throw.
import type { Act } from "./lifecycle.ts";

export type HookPhase = "before" | "after";
/** A hook point — fired before/after an act, e.g. `before:execute`, `after:verify`. */
export type HookName = `${HookPhase}:${Act}`;

export interface HookContext {
  readonly act: Act;
  readonly phase: HookPhase;
}

export type HookHandler = (ctx: HookContext) => void | Promise<void>;

export class HookDispatcher {
  readonly #handlers = new Map<HookName, HookHandler[]>();

  /** Register `handler` at `name`. Returns `this` for chaining; registration order is preserved. */
  on(name: HookName, handler: HookHandler): this {
    const list = this.#handlers.get(name);
    if (list === undefined) this.#handlers.set(name, [handler]);
    else list.push(handler);
    return this;
  }

  /** How many handlers are registered at `name`. */
  count(name: HookName): number {
    return this.#handlers.get(name)?.length ?? 0;
  }

  /**
   * Run every handler registered at `name` in registration order, awaiting each in turn. Returns
   * the number of handlers invoked (0 for an unregistered point — a no-op, never a throw).
   */
  async dispatch(name: HookName, ctx: HookContext): Promise<number> {
    const list = this.#handlers.get(name);
    if (list === undefined) return 0;
    for (const handler of list) {
      await handler(ctx);
    }
    return list.length;
  }
}
