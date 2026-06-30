// The services/license implementation of the @caisson/mcp-server `checkRateLimit` port (ADR-0112
// lock 3). It backs the base mcp-server's optional throttle hook with the RLS-scoped token-bucket
// store — so the base package stays DB-free (no @caisson/credits / Postgres dep added there) while
// the server gains a per-account abuse throttle when this hook is wired in.
//
// Two outcomes only:
//   • DENY (out of tokens)        → throw RateLimitError (kernel, HTTP 429) with a retry-after.
//   • store error / unreachable   → FAIL-OPEN (ADR-0112 lock 5, operator-locked): ALLOW the call and
//                                    signal an alert through the operator-supplied sink. A rate limit
//                                    is abuse-throttling, NOT an auth boundary; an infrastructure
//                                    fault must never lock out a paying buyer. The alert sink is the
//                                    repo's telemetry/error surface, never `console.log`.
import { RateLimitError } from "@caisson/kernel";
import { withTenant, type Transactor } from "@caisson/tenancy-rls";
import {
  checkRateLimit,
  type RateLimitConfig,
  type RateLimitDecision,
} from "./rate-limit-store.ts";

export interface RateLimitHookDeps {
  /** A tenant-capable client; the hook runs `checkRateLimit` inside `withTenant`. */
  db: Transactor;
  /**
   * Alert sink for a FAIL-OPEN event (store threw / unreachable). Receives the caught error and the
   * account it was checking. Wire this to the repo's structured-log / telemetry surface — NEVER
   * `console.log`. Omit only in tests; absent ⇒ the fail-open is silent (still allowed).
   */
  onStoreError?: (err: unknown, accountId: string) => void;
  /** Optional per-account override config to apply on every check (ADR-0112 lock 4). */
  config?: RateLimitConfig;
  /** Injectable epoch-ms clock (default `Date.now`) — deterministic in tests. */
  now?: () => number;
}

/**
 * Build the `(accountId) => Promise<void>` hook the buyer MCP awaits before every tool dispatch.
 * Resolves to allow; throws `RateLimitError` only on a genuine deny; fails OPEN (resolves + alerts)
 * on any store error.
 */
export function createRateLimitHook(
  deps: RateLimitHookDeps,
): (accountId: string) => Promise<void> {
  const clock = deps.now ?? Date.now;
  return async (accountId: string): Promise<void> => {
    let decision: RateLimitDecision;
    try {
      decision = await withTenant(deps.db, accountId, (tx) =>
        deps.config !== undefined
          ? checkRateLimit(tx, accountId, clock(), deps.config)
          : checkRateLimit(tx, accountId, clock()),
      );
    } catch (err) {
      // FAIL-OPEN: availability over strictness (ADR-0112 lock 5). Allow + alert; do NOT throw.
      deps.onStoreError?.(err, accountId);
      return;
    }
    if (!decision.allowed) {
      throw new RateLimitError("MCP request rate limit exceeded", {
        retryAfterMs: decision.retryAfterMs,
      });
    }
  };
}
