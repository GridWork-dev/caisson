// @caisson-sh/ai-meter — the metered-inference money path (ADR-0060): estimate → reserve → reconcile
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

// Circuit breaker: the pure decision vocabulary, then the store-bound operations.
export { DEFAULT_SCOPE, SpendCapError } from "./contracts.ts";
export type { BreakerState, BreakerStatus } from "./contracts.ts";
export {
  readBreaker,
  assertBreakerClosed,
  tripBreaker,
  resetBreaker,
} from "./breaker.ts";

// The reserve/reconcile meter.
export { reserve, reconcile } from "./meter.ts";
export type {
  MeterConfig,
  ReserveInput,
  ReserveResult,
  ReconcileInput,
  ReconcileResult,
} from "./meter.ts";

// Pre-call MinHash/LSH dedup-before-meter gate (ADR-0217).
export {
  normalizePrompt,
  shingle,
  computeMinHashSignature,
  lshBands,
  jaccardEstimate,
  createInMemoryDedupStore,
  checkDedupGate,
} from "./dedup.ts";
export type {
  DedupEntry,
  DedupStore,
  DedupGateConfig,
  DedupGateResult,
} from "./dedup.ts";
