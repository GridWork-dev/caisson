# @caisson-sh/rate-limit — agent contract

Shared abuse-throttle primitives, owned once here; consuming services import them — never copy
them (a re-introduced local token-bucket copy outside this package is the exact regression this
package fixes).

## What it does

Two independent limiters for two different trust levels:

1. **Per-IP, in-memory** (`token-bucket.ts`) — a fixed-window token bucket keyed on the client IP,
   for surfaces with no authenticated identity yet (a public webhook receiver, an unauth scrape
   endpoint). Generic over the caller's bucket-name union; each consumer supplies its own bucket
   names and env-driven config.
2. **Per-account, Postgres-backed** (`account-store.ts` + `account-hook.ts`) — a server-side token
   bucket keyed on an authenticated account id, RLS-scoped so one tenant can never read or write
   another's bucket. `createRateLimitHook` wires this store to the base MCP server's rate-limit
   port.

## Public API

| Symbol                       | Use                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `TokenBucketLimiter<B>`      | The generic in-memory per-IP limiter; `B` is the caller's own bucket-name union. |
| `clientIp(req)`              | Derive the client IP from `X-Real-IP` only — no other forwarded-for header.      |
| `RATE_LIMIT_SCHEMA_SQL`      | The `rate_limit` table DDL + its tenant RLS policy.                              |
| `checkRateLimit`             | Lazily provision + atomically consume one token from an account's bucket.        |
| `setAccountRateLimit`        | Set a per-account override of the bucket parameters.                             |
| `createRateLimitHook`        | Build the `(accountId) => Promise<void>` hook the MCP server awaits.             |
| `createRateLimitedMcpServer` | Build the MCP server with that hook installed by default.                        |

## Invariants

- `TokenBucketLimiter` never throws on a hot path; a caller wraps it and fails OPEN on any internal
  error rather than taking the route down.
- `clientIp` trusts ONLY `X-Real-IP` — every other forwarded-for style header is client-appendable
  and must never be trusted for this purpose.
- The per-account store runs every read/write inside `withTenant`; a write for another tenant's
  account is refused by the RLS policy, never silently reassigned.
- `createRateLimitHook` fails OPEN on a store error (allow + alert) and throws only on a genuine
  deny — a rate limit is an abuse-throttle, not an auth boundary.

## Scope

Abuse-throttle mechanics only. Authentication and tenant-id derivation belong in `@caisson-sh/auth`
and `@caisson-sh/tenancy-rls` respectively.
