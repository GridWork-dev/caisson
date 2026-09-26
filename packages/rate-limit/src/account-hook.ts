// The base mcp-server's `checkRateLimit` port needs a concrete backing store to actually throttle
// anything — @caisson-sh/mcp-server declares the port but ships DB-free on purpose (no Postgres
// dependency added to that package). This hook backs the port with the RLS-scoped token-bucket store
// in account-store.ts, so any authenticated host that owns a tenant-scoped Postgres connection gains
// a per-account abuse throttle just by wiring this in.
//
// Two outcomes only:
//   - DENY (out of tokens)        → throw RateLimitError (kernel, HTTP 429) with a retry-after.
//   - store error / unreachable   → FAIL-OPEN (operator-locked): ALLOW the call and signal an alert
//                                    through the operator-supplied sink. A rate limit is an
//                                    abuse-throttle, NOT an auth boundary; an infrastructure fault
//                                    must never lock out a paying buyer. The alert sink is the
//                                    caller's telemetry/error surface, never `console.log`.
import { RateLimitError } from "@caisson-sh/kernel";
import {
  createMcpServer,
  type McpServer,
  type McpServerOptions,
} from "@caisson-sh/mcp-server";
import { withTenant, type Transactor } from "@caisson-sh/tenancy-rls";
import {
  checkRateLimit,
  type RateLimitConfig,
  type RateLimitDecision,
} from "./account-store.ts";

export interface RateLimitHookDeps {
  /** A tenant-capable client; the hook runs `checkRateLimit` inside `withTenant`. */
  db: Transactor;
  /**
   * Alert sink for a FAIL-OPEN event (store threw / unreachable). Receives the caught error and the
   * account it was checking. Wire this to the caller's structured-log / telemetry surface — NEVER
   * `console.log`. Omit only in tests; absent ⇒ the fail-open is silent (still allowed).
   */
  onStoreError?: (err: unknown, accountId: string) => void;
  /**
   * Optional bucket config applied when an account's row is FIRST provisioned. It does NOT mutate an
   * already-provisioned row — an existing account keeps its stored columns; change a live account's
   * limit via `setAccountRateLimit`. Omit to use `DEFAULT_RATE_LIMIT`.
   */
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
      // FAIL-OPEN: availability over strictness. Allow + alert; do NOT throw.
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

/** Build the buyer MCP with the Postgres-backed account throttle installed by default. */
export function createRateLimitedMcpServer(
  options: McpServerOptions,
  deps: RateLimitHookDeps,
): McpServer {
  const checkRateLimit = options.checkRateLimit ?? createRateLimitHook(deps);
  return createMcpServer({ ...options, checkRateLimit });
}
