// The browser-safe entry (`@caisson-sh/billing-orchestration/browser`, ADR-0396): the pure claim-key
// half of the webhook idempotency layer — the fail-closed `sourceEventId` guard and the per-effect
// composite key derivation. ADDITIVE — the `.` barrel is untouched and stays the full node-capable
// surface; every name here is also on `.` (the subset test in browser-safety.test.ts pins that
// direction, one-way).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - idempotency.ts's `processEvent` / `withIdempotentSideEffect` / `PROCESSED_EVENT_SCHEMA_SQL` —
//     the claim is an `INSERT … ON CONFLICT` against a `TenantExecutor` inside the caller's tenant
//     transaction (@caisson-sh/tenancy-rls, which reaches `pg`). Irreducibly server-only; a browser has
//     no tenant GUC to be fail-closed about.
//   - drivers.ts + lemonsqueezy.ts + polar.ts — checkout REST calls composed with the raw-body
//     signature verifiers (@caisson-sh/billing → node:crypto). A webhook secret has no business in a
//     client bundle regardless of what a bundler would substitute.
//   - paddle-events.ts + stripe-events.ts — the pure provider->domain mappers. These WOULD pass the
//     walk today, and are deliberately still off.
// ponytail: admission is by consumer need, not by "it would pass" — a clean walk is the floor for
// joining this entry, never the reason to. The mappers join the day something browser-side maps an
// event, and the walk in browser-safety.test.ts proves it on the way in.
export * from "./event-keys.ts";
