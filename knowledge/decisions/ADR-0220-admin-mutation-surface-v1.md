# ADR-0220 — admin: operator mutation surface v1 — four actions, admin_write role, dual-logged

**Status:** accepted · 2026-07-02 (deferred-respec picker round, operator-locked).
**Relates:** SPEC `outputs/specs/deferred-respec/SPEC-admin-mutation-surface.md` (the locked draft)
· **supersedes ADR-0141's "mutation … deferred to a later ADR" clause** — ADR-0141's read primitive
(`withAdminRead`, SELECT-only `admin` role) stays intact and unchanged; only the mutation-deferral
reservation is lifted · ADR-0204 (admin CF-Access-JWT middleware — the gate every action sits
behind) · ADR-0074 (credit event envelope) · ADR-0152/0153 (WORM audit chain).

## Context

The operator's only current lever for comp/refund/correction against production is raw SQL.
Checkout is imminent (Paddle sandbox, pre-launch gate ON); the levers must exist before the first
real buyer.

## Decision (five forks, operator-locked)

v1 ships exactly **four actions** in `apps/admin`: entitlement grant, entitlement revoke, credit
adjust, license reissue — each CF-Access-JWT gated, bounded to one target account per call, Zod
`.strict()` validated, dual-logged.

- **AM-1 = A:** the 5th action (buyer lookup / support-context edit) is dropped from v1 — no write
  target exists; re-scope later.
- **AM-2 = B (operator override of the spec recommendation):** a dedicated **`admin_write` PG
  role** + cross-tenant policy + a `withAdminWrite` seam — DB-level privilege separation; admin
  writes never run as the buyer-runtime `app` role.
- **AM-3 = A:** admin credit adjusts ride ADR-0074's existing `feature_grant`/`feature_debit`
  envelope with a registered `admin_adjust` tag — no base schema change to the money core.
- **AM-4 = A:** WORM audit from day 1 — reuse `AuditChainStore`, provision an `ArtifactStore` for
  the mutation service; `admin_action_log` is the queryable half of the dual log.
- **AM-5:** license reissue v1 = idempotent re-serve of the buyer's existing token via a
  server-side `/issue` proxy behind a **new admin-scoped short-lived credential** — never the
  shared `LICENSE_ISSUE_TOKEN`. True key-rotation is a separate follow-up.

## Rejected

- **AM-2 = A (reuse `withTenant` + app-layer allowlist)** — the spec's recommendation; the
  operator chose DB-level separation over the smaller diff.
- **Including the buyer-lookup action in v1** — requires reading better-auth's user/session schema
  and defining a write table first.
