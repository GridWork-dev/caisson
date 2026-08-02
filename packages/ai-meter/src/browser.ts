// The browser-safe entry (`@caisson/ai-meter/browser`, ADR-0396): the money path's PURE half — the
// versioned price book and its integer micro-USD -> integer credits normalizer, the pre-call
// estimator, and the spend-policy decision vocabulary (scope, breaker state, the 402 SpendCapError).
// ADDITIVE — the `.` barrel is untouched and stays the full node-capable surface; every name here is
// also on `.` (the subset test in browser-safety.test.ts pins that direction, one-way).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - meter.ts (reserve/reconcile) — the DB-bound money path. It takes a `TenantExecutor`, writes
//     the credit ledger through @caisson/credits, and imports node:crypto for the usage_event row
//     id. Irreducibly server-only; a wallet movement has no business in a client bundle.
//   - breaker.ts (readBreaker/assertBreakerClosed/tripBreaker/resetBreaker) — the stored breaker
//     state, `TenantExecutor` again, and schema.ts under it.
//   - schema.ts — the DDL, which value-imports @caisson/tenancy-rls.
//   - dedup.ts — pure and it WOULD pass the walk, but no browser consumer needs it; ADR-0396's
//     admission rule is need-plus-walk, not walk alone.
// ponytail: dedup stays off until a consumer needs it browser-side — the walk is one line away.
export * from "./contracts.ts";
export * from "./pricebook.ts";
export * from "./estimate.ts";
