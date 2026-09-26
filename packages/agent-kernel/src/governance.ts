// Governance guards + the unified `HookResult` (ADR-0065/0066). Governance has exactly ONE shape: a
// decision is `allow | deny(reason) | mutate(ctx)`, returned by BOTH a transition GUARD (a pure
// predicate gating a lifecycle edge) and a hook VETO (the dispatcher in `hooks.ts`). A guard never
// runs an engine and never rewrites the FSM adjacency — it decides whether policy permits an
// already-legal transition, and may rewrite the governance context a downstream guard/hook sees.
// Engine-neutral, zero-dep, deterministic; `from`/`to` are typed against the shipped lifecycle FSM.
import type { Act } from "./lifecycle.ts";

/** The three governance decisions — the discriminant of `HookResult`. */
export type HookDecision = "allow" | "deny" | "mutate";

/**
 * The ONE governance shape, shared by transition guards and hook vetoes:
 *   - `allow`        — the transition / hook point proceeds unchanged.
 *   - `deny(reason)` — the transition / hook point is vetoed (fail-closed); `reason` is policy text.
 *   - `mutate(ctx)`  — proceed, but `ctx` replaces the governance context every downstream step sees.
 * Generic over the adopter's context `C`. `reason` is adopter policy text — never a secret or a value.
 */
export type HookResult<C> =
  | { readonly decision: "allow" }
  | { readonly decision: "deny"; readonly reason: string }
  | { readonly decision: "mutate"; readonly context: C };

/** Allow — the transition / hook point proceeds unchanged. */
export function allow<C>(): HookResult<C> {
  return { decision: "allow" };
}

/** Deny — veto the transition / hook point (fail-closed). `reason` is policy text, never a secret. */
export function deny<C>(reason: string): HookResult<C> {
  return { decision: "deny", reason };
}

/** Mutate — proceed, replacing the governance context every downstream step sees with `context`. */
export function mutate<C>(context: C): HookResult<C> {
  return { decision: "mutate", context };
}

/** Narrow a `HookResult` to its `allow` variant. */
export function isAllow<C>(
  result: HookResult<C>,
): result is { readonly decision: "allow" } {
  return result.decision === "allow";
}

/** Narrow a `HookResult` to its `deny` variant (carries `reason`). */
export function isDeny<C>(
  result: HookResult<C>,
): result is { readonly decision: "deny"; readonly reason: string } {
  return result.decision === "deny";
}

/** Narrow a `HookResult` to its `mutate` variant (carries `context`). */
export function isMutate<C>(
  result: HookResult<C>,
): result is { readonly decision: "mutate"; readonly context: C } {
  return result.decision === "mutate";
}

/** What a transition guard sees: the lifecycle edge under evaluation + the current governance context. */
export interface TransitionContext<C> {
  readonly from: Act;
  readonly to: Act;
  readonly context: C;
}

/**
 * A transition guard: a PURE predicate over one transition that returns the unified `HookResult` — the
 * governance primitive. It is layered ON TOP of FSM legality (`canTransition`): the FSM says the edge is
 * structurally legal, a guard says whether policy permits it (and may rewrite the context downstream).
 */
export type TransitionGuard<C> = (
  transition: TransitionContext<C>,
) => HookResult<C>;

/**
 * Lift a boolean predicate into a guard: `allow` when the predicate holds, `deny(reason)` when it does
 * not. The pure-predicate-per-transition primitive in its simplest form.
 */
export function predicateGuard<C>(
  predicate: (transition: TransitionContext<C>) => boolean,
  reason: string,
): TransitionGuard<C> {
  return (transition) => (predicate(transition) ? allow() : deny(reason));
}

/**
 * Run `guards` in order over a transition, folding the unified `HookResult`:
 *   - a `deny` SHORT-CIRCUITS (fail-closed) — the first veto wins; remaining guards do not run;
 *   - a `mutate(ctx)` threads `ctx` into the context the remaining guards (and the result) see;
 *   - all `allow` (or no guards) → `allow`; if any guard mutated and none denied → `mutate(finalCtx)`.
 * A guard that THROWS is treated as a fail-closed `deny` (guardrails fail closed) — a buggy guard must
 * never silently admit a transition, and the thrown value is never surfaced (redaction-safe).
 */
export function evaluateGuards<C>(
  guards: readonly TransitionGuard<C>[],
  transition: TransitionContext<C>,
): HookResult<C> {
  let context = transition.context;
  let mutated = false;
  for (const guard of guards) {
    let result: HookResult<C>;
    try {
      result = guard({ from: transition.from, to: transition.to, context });
    } catch {
      return deny("guard threw");
    }
    if (result.decision === "deny") return result;
    if (result.decision === "mutate") {
      context = result.context;
      mutated = true;
    }
  }
  return mutated ? mutate(context) : allow();
}
