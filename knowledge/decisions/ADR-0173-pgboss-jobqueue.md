# ADR-0173 — Jobs adapter: pg-boss (Postgres-native) behind the `JobQueue` port

**Status:** accepted · 2026-06-30 (Stage-2 Stream D, adapter buildout) · extends ADR-0018 (jobs/email ports) ·
composes with the D6 harvest `enqueue`-options lift (`outputs/specs/stream-d-base-golive/SPEC.md` §4) · realizes
`docs/state/adapter-expansion.md` §2B (advisory "ADR-0124" retires → 0173). Append-only.

## Context

`packages/jobs` defines `JobQueue.enqueue(name, payload): Promise<void>` (`queue.ts:26`) with two drivers:
`createTriggerJobQueue` (Trigger.dev, `trigger-driver.ts:52`) and an InMemory test driver. Trigger.dev is a
managed SaaS; a buyer who wants zero new infra has no self-host option today (`adapter-expansion.md` §2B).

## Decision

Add a **pg-boss** driver in a new sibling file `packages/jobs/src/pgboss.ts` — `createPgBossJobQueue(config):
JobQueue` over the `pg-boss` package, running on the Postgres the buyer already has (the Railway platform DB per
ADR-0115), zero new infrastructure. Injected config (connection string / pool), `ConfigError` fail-closed,
mirroring `trigger-driver.ts`. Trigger.dev stays the managed default. **Compose with the D6 harvest lift** that
adds an optional `{idempotencyKey?, delaySeconds?}` arg to `enqueue` — pg-boss supports both natively (`singletonKey`,
`startAfter`), so the two land coherently (the harvest lift is the port-shape change; this ADR is the driver).

## Scope — build-now vs DEPLOY-class

**Build now:** `pgboss.ts` + round-trip/conformance test. **DEPLOY-class:** none beyond the already-provisioned
platform Postgres — pg-boss self-manages its schema on first run; dormant until selected.

## Rejected

- **BullMQ/Redis or Inngest as the lead self-host driver** — pg-boss first (no new infra on a Postgres-backed
  deploy); Redis/serverless drivers on demand.

## Binding

`JobQueue` gains a pg-boss driver (Postgres-native self-host); Trigger.dev stays the default; the port-shape
`enqueue`-options extension is the D6 lift, not this ADR. Adding another queue driver needs no new ADR.

Evidence: `packages/jobs/src/queue.ts:26`; `trigger-driver.ts:52-92`; `docs/state/adapter-expansion.md:40,91-94`;
recon `wf_fa542371-7e6` (D6:harvest — the `enqueue`-no-options gap).
