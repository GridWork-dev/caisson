// @caisson/ai-meter — the metered-inference money path (ADR-0060): estimate → reserve → reconcile
// over the credit ledger, a versioned price book, an atomic per-tenant spend window, soft/hard caps
// and a circuit breaker. A base primitive the AI Production Kit gateway meters through; never imports
// an edition (ADR-0003).

// Store schema (DDL + table names).
export {
  AI_METER_SCHEMA_SQL,
  USAGE_EVENT_TABLE,
  TENANT_SPEND_WINDOW_TABLE,
  SPEND_POLICY_TABLE,
  SPEND_BREAKER_TABLE,
} from "./schema.ts";

// Price book + cost normalization.
export {
  BUNDLED_PRICE_BOOK,
  DEFAULT_CREDIT_CONVERSION,
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
} from "./pricebook.ts";
export type {
  PriceBook,
  PriceBookEntry,
  CreditConversion,
  Usage,
  CostBreakdown,
} from "./pricebook.ts";

// Pre-call estimation.
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

// Circuit breaker.
export {
  DEFAULT_SCOPE,
  SpendCapError,
  readBreaker,
  assertBreakerClosed,
  tripBreaker,
  resetBreaker,
} from "./breaker.ts";
export type { BreakerState, BreakerStatus } from "./breaker.ts";

// The reserve/reconcile meter.
export { reserve, reconcile } from "./meter.ts";
export type {
  MeterConfig,
  ReserveInput,
  ReserveResult,
  ReconcileInput,
  ReconcileResult,
} from "./meter.ts";
