// The hooks dispatcher (ADR-0065/0066). Engine-neutral: handlers observe — and may govern —
// lifecycle act transitions at `${'before'|'after'}:${act}` points. The dispatcher NEVER runs an
// engine and NEVER rewrites the FSM adjacency; it folds handler outcomes through the unified
// `HookResult` shape and is hardened for buyer loops:
//   - FAIL-OPEN on infra failure: a handler that THROWS, and a DOWN/slow sink, never block the loop
//     and never veto — they are isolated, the loop continues (an observer crash is not a policy).
//   - FAIL-CLOSED on an EXPLICIT veto: a handler that returns `deny(reason)` short-circuits dispatch
//     (the first veto wins) — governance decisions are honored.
//   - NO secret logging: nothing is ever `console.log`'d; the only thing emitted to the pluggable
//     sink on a handler throw is the hook name + the error's TYPE name — never its message or stack,
//     which may carry a secret. The emitted payload is secret-free by construction.
//   - PLUGGABLE sink: an optional `@caisson-sh/kernel` `EventSink` port (no tg-bridge / postgres
//     coupling). The sink applies its own redaction; the dispatcher hands it nothing sensitive.
//   - SHELL SAFETY: TS handlers are first-class. A shell-command hook is admitted ONLY through
//     `commandHandler`, which spawns via `execFile` with an argv ARRAY — no shell, no interpolation,
//     no `HookContext` value can reach argv (interpolation is structurally impossible).
//   - ENV DEFAULT: a `CommandHookSpec` inherits the parent's full environment by default (Node's
//     `execFile` default) — pass the optional `env` field to narrow the child to exactly the vars
//     it needs (used verbatim, never merged with `process.env`). Flipping the default to
//     always-narrow is a separate major-version change, not made here.
import type { EventSink, OpsEvent } from "@caisson-sh/kernel";
import type { Act } from "./lifecycle.ts";
import { allow, mutate } from "./governance.ts";
import type { HookResult } from "./governance.ts";
import { execFile } from "node:child_process";

export type HookPhase = "before" | "after";
/** A hook point — fired before/after an act, e.g. `before:execute`, `after:verify`. */
export type HookName = `${HookPhase}:${Act}`;

/** What a handler sees: the act being entered/left, the phase, and the governance context `C`. */
export interface HookContext<C = unknown> {
  readonly act: Act;
  readonly phase: HookPhase;
  /** The governance context a `mutate(ctx)` handler may replace for every downstream handler. */
  readonly context: C;
}

/**
 * A hook handler. Returning `undefined` (an observe-only handler) is treated as `allow`; returning a
 * `HookResult<C>` participates in governance: `deny` vetoes (short-circuit), `mutate` threads context.
 */
export type HookHandler<C = unknown> = (
  ctx: HookContext<C>,
) => void | HookResult<C> | Promise<void | HookResult<C>>;

/** The outcome of a dispatch: how many handlers ran, how many threw (isolated), and the folded decision. */
export interface HookDispatchResult<C> {
  /** Handlers actually invoked (stops early on an explicit `deny`). */
  readonly invoked: number;
  /** Handlers that threw — isolated and fail-open (they did NOT veto the loop). */
  readonly errors: number;
  /** The folded governance decision: `allow`, the first `deny`, or `mutate(finalContext)`. */
  readonly result: HookResult<C>;
}

/** Construction options. The sink is optional — with none, handler errors are silently isolated. */
export interface HookDispatcherOptions {
  /** Pluggable diagnostics sink (kernel `EventSink` port). Receives only secret-free error markers. */
  readonly sink?: EventSink;
}

export class HookDispatcher<C = unknown> {
  readonly #handlers = new Map<HookName, HookHandler<C>[]>();
  readonly #sink: EventSink | undefined;

  constructor(options?: HookDispatcherOptions) {
    this.#sink = options?.sink;
  }

  /** Register `handler` at `name`. Returns `this` for chaining; registration order is preserved. */
  on(name: HookName, handler: HookHandler<C>): this {
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
   * Run every handler at `name` in registration order, awaiting each, folding the unified
   * `HookResult`:
   *   - a handler that THROWS is isolated (reported to the sink, secret-free) and treated as
   *     fail-open `allow` — the loop continues, the throw never vetoes;
   *   - a handler returning `deny(reason)` SHORT-CIRCUITS (the first veto wins, fail-closed);
   *   - a handler returning `mutate(ctx)` threads `ctx` into every downstream handler's context;
   *   - `undefined` / `allow` proceed. All-allow (or no handlers) → `allow`; any mutate, no
   *     deny → `mutate(finalContext)`.
   * An unregistered point is a no-op (`invoked: 0`, `allow`), never a throw.
   */
  async dispatch(
    name: HookName,
    ctx: HookContext<C>,
  ): Promise<HookDispatchResult<C>> {
    const list = this.#handlers.get(name);
    if (list === undefined || list.length === 0) {
      return { invoked: 0, errors: 0, result: allow<C>() };
    }

    let context = ctx.context;
    let mutated = false;
    let invoked = 0;
    let errors = 0;

    for (let i = 0; i < list.length; i++) {
      const handler = list[i]!;
      invoked++;
      let outcome: void | HookResult<C>;
      try {
        outcome = await handler({ act: ctx.act, phase: ctx.phase, context });
      } catch (err) {
        // Per-handler isolation: a thrown observer never bleeds into the loop and never vetoes.
        errors++;
        this.#report(name, i, err);
        continue; // fail-open
      }
      if (outcome === undefined) continue; // observe-only handler = allow
      if (outcome.decision === "deny") {
        return { invoked, errors, result: outcome }; // explicit veto wins (fail-closed)
      }
      if (outcome.decision === "mutate") {
        context = outcome.context;
        mutated = true;
      }
      // "allow" → proceed
    }

    return {
      invoked,
      errors,
      result: mutated ? mutate(context) : allow<C>(),
    };
  }

  /**
   * Report a handler throw to the pluggable sink — secret-free by construction (hook name, handler
   * index, and the error TYPE name only; never the message or stack). A down/slow sink must never
   * block the loop nor surface an unhandled rejection, so a sync throw is swallowed and an async
   * rejection is caught.
   */
  #report(hook: HookName, index: number, err: unknown): void {
    const sink = this.#sink;
    if (sink === undefined) return;
    const event: OpsEvent = {
      name: "hook.handler.error",
      timestamp: new Date().toISOString(),
      attributes: {
        hook,
        index,
        error: err instanceof Error ? err.name : "unknown",
      },
    };
    try {
      const maybe = sink.emit(event);
      if (maybe instanceof Promise) maybe.catch(() => undefined);
    } catch {
      // A down sink never blocks the loop (fail-open) — swallowed, never logged.
    }
  }
}

// --- Safe shell-command hooks -----------------------------------------------------------------

/**
 * A shell-command hook spec. `args` is a FIXED argv array — never derived from a `HookContext`.
 *
 * `env` is OPTIONAL and additive: when absent, the spawned process inherits the parent's full
 * environment (Node's `execFile` default) — today's behavior, unchanged. Pass `env` to narrow the
 * child to exactly the vars it needs; the object is used VERBATIM (never merged with
 * `process.env`), so a caller that wants `PATH` must include it explicitly. Flipping the default
 * to always-narrow is a separate, deliberate major-version change — not made here.
 */
export interface CommandHookSpec {
  /** The executable to run — a program path/name, NEVER a shell string. */
  readonly command: string;
  /** Fixed argv. No interpolation: nothing from the hook context ever reaches here. */
  readonly args?: readonly string[];
  /** Per-invocation timeout (default 30s). */
  readonly timeoutMs?: number;
  /** Optional child environment. Absent → inherits the parent's full env (the default). */
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * The spawn seam: `(command, args, timeoutMs, env?) => exitCode`. Defaults to `execFile` with an
 * argv array; tests inject a double so CI never spawns a real process (the transport stays a
 * port). `env` is an OPTIONAL 4th parameter so every existing custom runner keeps compiling.
 */
export type CommandRunner = (
  command: string,
  args: readonly string[],
  timeoutMs: number,
  env?: Readonly<Record<string, string>>,
) => Promise<number>;

const defaultRunner: CommandRunner = (command, args, timeoutMs, env) =>
  new Promise<number>((resolve, reject) => {
    // `execFile` with an argv ARRAY — no shell is spawned, so there is no injection surface; the
    // command and args are passed verbatim. Process output is intentionally NOT captured (it could
    // carry a secret), so only the exit status is observed. `env`, when supplied, is passed exactly
    // as given (never merged with `process.env`); absent, `execFile` inherits the parent env.
    execFile(
      command,
      [...args],
      env === undefined ? { timeout: timeoutMs } : { timeout: timeoutMs, env },
      (error) => {
        if (error === null) {
          resolve(0);
          return;
        }
        const code = (error as { code?: unknown }).code;
        if (typeof code === "number") {
          resolve(code); // a non-zero process exit
          return;
        }
        // Spawn failure / timeout: reject with a marker carrying NO command output.
        reject(new Error("command hook spawn failed"));
      },
    );
  });

/**
 * Build a hook that runs a shell command SAFELY: via `execFile` with a fixed argv array (no shell,
 * no interpolation, no secret reachable in argv). The handler ignores the `HookContext` entirely —
 * by construction no context value can flow into the command — so it OBSERVES: exit 0 → `allow`
 * (returns nothing), a non-zero exit or spawn failure throws, which the dispatcher isolates
 * (fail-open) — a failing external command never vetoes the buyer's loop.
 */
export function commandHandler<C = unknown>(
  spec: CommandHookSpec,
  runner: CommandRunner = defaultRunner,
): HookHandler<C> {
  const command = spec.command;
  const args: readonly string[] = spec.args ?? [];
  const timeoutMs = spec.timeoutMs ?? 30_000;
  const env = spec.env;
  return async () => {
    const code = await runner(command, args, timeoutMs, env);
    if (code !== 0) throw new Error(`command hook exited ${code}`);
  };
}
