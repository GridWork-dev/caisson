// Per-account abuse-throttle store (implements the credits abuse-throttle design). A SERVER-SIDE
// token bucket so one adopter cannot exhaust shared capacity. One row per account in
// `rate_limit`; each check refills lazily by elapsed time then consumes a single token — done as ONE
// atomic conditional UPDATE (the refilled count is computed in SQL from `now - last_refill_ms`,
// clamped to capacity, decremented and stamped in the same statement; the UPDATE's WHERE makes "had a
// token after refill" the success condition). No read-then-write race: two concurrent consumes on one
// token resolve to exactly one winner because the WHERE guard re-checks the live row.
//
// Token counts are INTEGERS; time is carried as integer epoch-milliseconds (a `bigint` column + an
// injectable `now`), so the whole refill computation is integer-pure and deterministic in tests. The
// store is tenant-owned + fail-closed RLS via @caisson-sh/tenancy-rls, mirroring an entitlement store:
// every read/write runs inside `withTenant`, the policy WITH CHECK rejects a write whose account_id
// does not match the bound tenant.
//
// Fail-OPEN is NOT decided here — `checkRateLimit` returns a typed allowed/denied decision and lets
// its caller (see account-hook.ts) choose to allow + alert on a store error. A DENY (out of tokens)
// is the only signal that ever blocks an adopter.
//
// Originally implemented inside a separate licensing service; hoisted into this shared base package so
// the reference app composing the base substrate can wire per-account throttling without depending on
// that other service (see account-hook.ts for the composition seam).
import type { TenantExecutor } from "@caisson-sh/tenancy-rls";
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";

/**
 * The effective bucket parameters for an account. `capacity` is the burst ceiling (and the initial
 * token count for a fresh row); the bucket refills `refillAmount` tokens every `refillIntervalMs`.
 * All three are positive integers (the SQL CHECK constraints enforce it).
 */
export interface RateLimitConfig {
  /** Bucket size — the max tokens an account can hold, and a fresh row's starting balance. */
  capacity: number;
  /** Tokens added per refill interval (lazy-accrued). */
  refillAmount: number;
  /** Refill interval length in milliseconds. */
  refillIntervalMs: number;
}

/**
 * The STATIC global default. A per-account row may override any of these columns; a freshly
 * auto-provisioned row inherits these. 120 tokens, refilling 120 every 60s ⇒ a sustained ~120
 * tool-calls/minute with a full 120-call burst. Tuned to throttle abuse, not normal adopter use.
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  capacity: 120,
  refillAmount: 120,
  refillIntervalMs: 60_000,
};

export interface RateLimitDecision {
  /** True when a token was consumed; false when the bucket was empty after the lazy refill. */
  allowed: boolean;
  /** Tokens remaining AFTER this consume (≥ 0). On a deny this is 0. */
  remaining: number;
  /** Milliseconds until the next refill frees a token. 0 when allowed; > 0 on a deny (retry-after). */
  retryAfterMs: number;
}

// One row per account. `last_refill_ms` is an integer epoch-ms watermark, advanced only by WHOLE
// consumed refill intervals (never to `now`), so sub-interval accrual is not silently dropped. The
// config columns (capacity/refill_amount/refill_interval_ms) carry DEFAULTs equal to
// DEFAULT_RATE_LIMIT — kept in sync with the const below; `tokens`/`last_refill_ms` are always
// inserted explicitly (no column DEFAULT). A per-account override writes different column values
// (see `setAccountRateLimit`).
export const RATE_LIMIT_SCHEMA_SQL = `
CREATE TABLE rate_limit (
  account_id text PRIMARY KEY,
  tokens integer NOT NULL,
  capacity integer NOT NULL DEFAULT 120,
  refill_amount integer NOT NULL DEFAULT 120,
  refill_interval_ms integer NOT NULL DEFAULT 60000,
  last_refill_ms bigint NOT NULL,
  CONSTRAINT rate_limit_tokens_nonneg CHECK (tokens >= 0),
  CONSTRAINT rate_limit_capacity_pos CHECK (capacity > 0),
  CONSTRAINT rate_limit_refill_amount_pos CHECK (refill_amount > 0),
  CONSTRAINT rate_limit_refill_interval_pos CHECK (refill_interval_ms > 0)
);

${buildTenantPolicySql("rate_limit")}
`;

// The lazily-refilled token count for the CURRENT row, clamped to capacity. `$1` is `now` in epoch
// ms (a bigint). Integer math throughout: GREATEST(0, …) guards a backward clock so periods never
// goes negative; integer division floors the elapsed-over-interval period count. The period count is
// also capped at `capacity` (LEAST) BEFORE the multiply — a purely defensive overflow guard: once
// periods ≥ capacity the bucket already saturates (refill_amount ≥ 1), so the cap is result-identical
// to leaving it uncapped, but it bounds `periods * refill_amount` to `capacity * refill_amount` so a
// pathological config (tiny interval + a long idle) can never overflow int8 and trip the fail-open
// path. Referenced twice (SET and WHERE) by one UPDATE so the WHERE-guard re-checks the live row.
const REFILLED_TOKENS = `LEAST(
  capacity,
  tokens + LEAST(capacity::bigint, GREATEST(0, ($1::bigint - last_refill_ms) / refill_interval_ms)) * refill_amount
)`;

// How far to advance the watermark: by the WHOLE intervals consumed (not to `now`), preserving the
// remainder so fractional accrual is not lost across rapid checks. NOT capped (unlike the refill
// product): this reconstructs ≈`now`, bounded by the clock, so it cannot overflow int8.
const ADVANCED_WATERMARK = `last_refill_ms + GREATEST(0, ($1::bigint - last_refill_ms) / refill_interval_ms) * refill_interval_ms`;

/**
 * Lazily provision an account's bucket row (full, at `now`), then attempt to consume one token in a
 * SINGLE atomic conditional UPDATE. Returns whether the call is allowed plus the remaining balance
 * and a retry-after on a deny. Must run inside `withTenant(db, accountId, …)` — RLS scopes every
 * statement to the bound account, and the policy WITH CHECK refuses a forged cross-tenant write.
 *
 * `config` seeds a NEWLY provisioned row only (the `INSERT … ON CONFLICT DO NOTHING`); an
 * already-provisioned account keeps its stored columns and a passed `config` is NOT applied to it —
 * change a live account's limit via `setAccountRateLimit`, not by re-passing `config` here.
 *
 * `now` is an injected epoch-ms clock (default `Date.now()` at the call site) — pass a fixed value
 * in tests for deterministic lazy-refill assertions.
 */
export async function checkRateLimit(
  tx: TenantExecutor,
  accountId: string,
  now: number,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): Promise<RateLimitDecision> {
  // 1) Ensure the row exists. A fresh account starts with a FULL bucket as of `now`. ON CONFLICT
  //    DO NOTHING leaves an existing (possibly overridden) row untouched — no token reset on retry.
  await tx.query(
    `INSERT INTO rate_limit (account_id, tokens, capacity, refill_amount, refill_interval_ms, last_refill_ms)
     VALUES ($1, $2, $2, $3, $4, $5)
     ON CONFLICT (account_id) DO NOTHING`,
    [
      accountId,
      config.capacity,
      config.refillAmount,
      config.refillIntervalMs,
      now,
    ],
  );

  // 2) Atomic refill-then-consume. The WHERE makes "had ≥ 1 token after the lazy refill" the success
  //    condition: 1 row back ⇒ allowed (and `tokens` is the post-consume remainder); 0 rows ⇒ denied
  //    (the row is left untouched). No read-then-write window — the decrement and the guard are one
  //    statement, so two racing consumes on a single token yield exactly one winner.
  const consumed = await tx.query<{ tokens: number }>(
    `UPDATE rate_limit
     SET tokens = ${REFILLED_TOKENS} - 1,
         last_refill_ms = ${ADVANCED_WATERMARK}
     WHERE account_id = $2
       AND ${REFILLED_TOKENS} >= 1
     RETURNING tokens`,
    [now, accountId],
  );

  if (consumed.rows.length > 0) {
    return {
      allowed: true,
      remaining: consumed.rows[0]!.tokens,
      retryAfterMs: 0,
    };
  }

  // 3) Denied — compute the retry-after from the (untouched) row: the ms remaining until the next
  //    whole interval boundary, when `refillAmount` (≥ 1) tokens become available.
  const r = await tx.query<{
    last_refill_ms: string | number;
    refill_interval_ms: number;
  }>(
    `SELECT last_refill_ms, refill_interval_ms FROM rate_limit WHERE account_id = $1`,
    [accountId],
  );
  const row = r.rows[0];
  let retryAfterMs = 0;
  if (row !== undefined) {
    const lastRefillMs = Number(row.last_refill_ms);
    const interval = row.refill_interval_ms;
    const elapsed = Math.max(0, now - lastRefillMs);
    const periods = Math.floor(elapsed / interval);
    const nextBoundary = lastRefillMs + (periods + 1) * interval;
    retryAfterMs = Math.max(0, nextBoundary - now);
  }
  return { allowed: false, remaining: 0, retryAfterMs };
}

/**
 * Set (or update) a per-account OVERRIDE of the bucket parameters. Upserts the row, resetting the
 * balance to the new capacity. Must run inside `withTenant(db, accountId, …)`; the policy WITH CHECK
 * refuses an override targeting another tenant's account.
 */
export async function setAccountRateLimit(
  tx: TenantExecutor,
  accountId: string,
  config: RateLimitConfig,
  now: number,
): Promise<void> {
  await tx.query(
    `INSERT INTO rate_limit (account_id, tokens, capacity, refill_amount, refill_interval_ms, last_refill_ms)
     VALUES ($1, $2, $2, $3, $4, $5)
     ON CONFLICT (account_id) DO UPDATE
       SET capacity = EXCLUDED.capacity,
           refill_amount = EXCLUDED.refill_amount,
           refill_interval_ms = EXCLUDED.refill_interval_ms,
           tokens = EXCLUDED.capacity,
           last_refill_ms = EXCLUDED.last_refill_ms`,
    [
      accountId,
      config.capacity,
      config.refillAmount,
      config.refillIntervalMs,
      now,
    ],
  );
}
