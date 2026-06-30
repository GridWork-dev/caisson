# ADR-0112 — buyer-MCP per-account rate limit (lazy-refill token bucket · port-injected · fail-open)

Status: accepted · 2026-06-30 · implements ADR-0008 (does not supersede it) · Phase P6 Bucket C (item I5)

ADR-0008 locked the buyer MCP server: an auth-gated, entitlement-scoped tool surface where every
tool call passes a timing-safe Bearer + a per-tool entitlement gate. It left _abuse throttling_
unaddressed — a single licensed buyer holding a valid token could hammer the `generate` path (or any
tool) and exhaust the shared host capacity. This ADR locks a SERVER-SIDE per-account rate limit, and
records the forks the operator resolved (2026-06-30). It references the kernel `RateLimitError` (HTTP
429, `packages/kernel/src/errors.ts`). Append-only; supersede with a later ADR, never edit.

## Decisions

1. **Lazy-refill TOKEN BUCKET, one atomic conditional UPDATE.** One row per account in a new
   `rate_limit` table (`tokens`, `capacity`, `refill_amount`, `refill_interval_ms`, `last_refill_ms`).
   On each check the bucket is refilled lazily by elapsed time, then one token is consumed — as a
   SINGLE atomic UPDATE: the refilled count is computed in SQL from `now − last_refill_ms` (clamped to
   `capacity`), decremented, and the watermark stamped in the same statement, with the UPDATE's
   `WHERE … >= 1` making "had a token after refill" the success condition. Zero rows back ⇒ denied; one
   row back ⇒ allowed with the post-consume remainder. No read-then-write window — two concurrent
   consumes on a single token resolve to exactly one winner (the WHERE-guard re-checks the live row).
   **Token counts are integers** (ADR-0002); time is carried as integer epoch-milliseconds (a `bigint`
   column + an injectable `now`), so the whole refill computation is integer-pure and deterministic in
   tests. The watermark advances only by WHOLE consumed intervals (never to `now`), so sub-interval
   accrual is never silently dropped.

2. **Store lives at `services/license/src/rate-limit-store.ts`, RLS-scoped via `withTenant`.** It
   mirrors `entitlement-store.ts`: a `RATE_LIMIT_SCHEMA_SQL` const that emits the table + FORCE-RLS
   tenant policy (`buildTenantPolicySql`, ADR-0005) with a `WITH CHECK` that refuses a forged
   cross-tenant write; a `checkRateLimit(tx, accountId, now, config?)` that auto-provisions a full
   bucket then atomically consumes, returning `{ allowed, remaining, retryAfterMs }`; and a
   `setAccountRateLimit(tx, accountId, config, now)` that upserts a per-account override. Every
   statement runs inside `withTenant(db, accountId, …)`. The store decides nothing about fail-open — it
   returns a typed decision and lets its caller choose.

3. **A server-internal `checkRateLimit` HOOK in `McpServerOptions`, designed as a PORT.**
   `@caisson/mcp-server` declares an optional `checkRateLimit?: (accountId: string) => Promise<void>`
   (the `RateLimitHook` type) and AWAITS it before dispatching ANY tool — base or edition — so a buyer
   over their limit is blocked before reaching a handler. `services/license` provides the
   implementation (`createRateLimitHook`) backed by the store, so the base mcp-server package stays
   DB-free — no `@caisson/credits` / Postgres dependency is added to it. When the hook is ABSENT the
   server runs unthrottled (backward-compatible — the Wave-0 contract). The hook is awaited AFTER the
   existence/entitlement gate, so an unknown or non-entitled tool stays a 404 and consumes no token.

4. **Static default + per-account OVERRIDE.** A global static default (`DEFAULT_RATE_LIMIT` — 120
   tokens, refilling 120 every 60s) is the column default and the balance a freshly auto-provisioned
   row inherits. `setAccountRateLimit` writes a per-account override (a different capacity / refill) to
   that account's row; the limit in force is always the row's own columns.

5. **Fail-OPEN + alert on store error (operator-locked).** If the rate-limit store throws or is
   unreachable, the hook ALLOWS the call and signals an alert through an operator-supplied sink
   (`onStoreError`, wired to the repo's structured-log / telemetry surface — **never** `console.log`).
   Availability over strictness: a rate limit is abuse-throttling, NOT an auth boundary, so an
   infrastructure fault must never lock out a paying buyer. A DENY (out of tokens) is the ONLY path
   that throws — an infra error never does. This is the operator's explicit choice, recorded here so a
   future reviewer does not "harden" it into fail-closed.

6. **Reuse the kernel `RateLimitError` (429).** The deny path throws the existing
   `RateLimitError` (no new error type), carrying `retryAfterMs` in `details` so the transport codec
   can surface a `Retry-After`.

## Tests (golden-before-logic where a fixture pins behaviour)

Store (PGlite + real RLS): drains to zero then denies with a retry-after; lazy refill restores tokens
after an injected elapsed time; refill clamps to capacity on a long idle; the atomic UPDATE is
race-safe (two concurrent consumes on one token → exactly one wins); a per-account override changes
the limit; a fresh account auto-provisions the full default; a forged cross-tenant write is refused.
Hook: under-limit resolves; over-limit throws `RateLimitError` (429 + retry-after); a store error
fails OPEN (resolves + alerts, with and without a sink). Server seam: an absent hook runs unthrottled;
a denied hook blocks the tool (handler never runs); the hook fires once per call across base and
edition tools; an unknown tool stays a 404 without consuming a token.

## Deferred (not blocking)

- **Distributed / cross-process limiting** — the Postgres row IS the shared state, so multiple host
  processes already share one bucket; a Redis/edge counter is only warranted if the DB round-trip
  becomes the bottleneck.
- **Per-tool weights** (a `generate` costing more bucket than a `list_modules`) — the seam takes one
  token per call today; weighting is a later refinement once real traffic shows the cost curve.
- **Operator surface to set overrides** (an admin endpoint over `setAccountRateLimit`) — the store
  function exists; exposing it is a follow-on slice.

## Binding (carried from ADR-0008)

Every tool call still passes the timing-safe Bearer + per-tool entitlement gate; the rate limit is an
ADDITIONAL gate layered before dispatch, and it is the only one that fails OPEN — auth and entitlement
remain fail-closed.
