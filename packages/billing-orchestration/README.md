# @caisson/billing-orchestration

Commercial billing orchestration (ADR-0249 G3): the checkout drivers, the provider→`DomainBillingEvent`
parsers, and the dual-layer webhook idempotency. Raw-body HMAC signature verification, the
`BillingProvider` port, and the `DomainBillingEvent` contract stay open in `@caisson/billing`.

- **Layer:** base (commercial)

Real src + tests: `createStripeBilling` / `createPaddleBilling` / `createLemonSqueezyBilling` /
`createPolarBilling` (REST checkout creation + `verifyAndParse`), `parseStripeEvent` /
`parsePaddleEvent` / `parseLemonSqueezyEvent` / `parsePolarEvent` (provider→domain event mapping), and
`processEvent` / `withIdempotentSideEffect` / `PROCESSED_EVENT_SCHEMA_SQL` (exactly-once webhook
side-effects).

## Entry points

- `@caisson/billing-orchestration` — the full node-capable surface, unchanged.
- `@caisson/billing-orchestration/browser` — browser-safe (ADR-0396): the pure claim-key half,
  `assertValidSourceEventId` + `sideEffectEventKey`. Every name on it is also on the main entry (the
  subset direction is one-way). The claim itself stays server-only: it is an `INSERT … ON CONFLICT`
  against a `TenantExecutor` inside your tenant transaction.

## Boundary

`@caisson/billing` (open, Apache-2.0) owns signature verification (`verifyStripeWebhook`,
`verifyPaddleWebhook`, `verifyLemonSqueezyWebhook`, `verifyPolarWebhook`) plus the port + config types +
the `DomainBillingEvent` schema. This package composes those open primitives into the full
verify→parse→checkout→idempotency orchestration. Depends DOWN-ONLY on `@caisson/billing`,
`@caisson/kernel`, `@caisson/tenancy-rls` (ADR-0003).
