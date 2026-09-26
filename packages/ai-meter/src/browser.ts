// The browser-safe entry (`@caisson-sh/ai-meter/browser`, ADR-0396): the money path's PURE half — the
// versioned price book and its integer micro-USD -> integer credits normalizer, the pre-call
// estimator, and the spend-policy decision vocabulary (scope, breaker state, the 402 SpendCapError).
// ADDITIVE — the `.` barrel is untouched and stays the full node-capable surface; every name here is
// also on `.` (the subset test in browser-safety.test.ts pins that direction, one-way).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - meter.ts (reserve/reconcile) — the DB-bound money path. It takes a `TenantExecutor`, writes
//     the credit ledger through @caisson-sh/credits, and imports node:crypto for the usage_event row
//     id. Irreducibly server-only; a wallet movement has no business in a client bundle.
//   - breaker.ts (readBreaker/assertBreakerClosed/tripBreaker/resetBreaker) — the stored breaker
//     state, `TenantExecutor` again, and schema.ts under it.
//   - schema.ts — the DDL, which value-imports @caisson-sh/tenancy-rls.
//   - dedup.ts — pure and it WOULD pass the walk, but no browser consumer needs it; ADR-0396's
//     admission rule is need-plus-walk, not walk alone.
// ponytail: dedup stays off until a consumer needs it browser-side — the walk is one line away.
// Keep this list explicit, matching the `.` barrel: `export *` would silently admit a new type-only
// name here while the runtime subset test stayed green (types disappear from `Object.keys`).
export { DEFAULT_SCOPE, SpendCapError } from "./contracts.ts";
export type { BreakerState, BreakerStatus } from "./contracts.ts";

export {
  BUNDLED_PRICE_BOOK,
  CREDIT_CONVERSION,
  PRICE_BOOK_VERSION,
  priceBookEntrySchema,
  priceBookSchema,
  creditConversionSchema,
  usageSchema,
  priceKey,
  resolvePriceEntry,
  computeCost,
  creditsForMicroUsd,
  parsePriceBook,
  parseCreditConversion,
} from "./token-rates.ts";
export type {
  PriceBook,
  PriceBookEntry,
  CreditConversion,
  Usage,
  CostBreakdown,
} from "./token-rates.ts";

export {
  CHARS_PER_TOKEN,
  DEFAULT_OUTPUT_TOKENS,
  estimateMessageSchema,
  estimateMessagesSchema,
  estimateTokens,
  estimateInputTokens,
  estimateUsage,
  estimateCost,
} from "./estimate.ts";
export type { EstimateMessage } from "./estimate.ts";
