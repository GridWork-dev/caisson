// @caisson-sh/rate-limit — shared abuse-throttle primitives: an in-memory per-IP fixed-window
// token-bucket limiter (for unauth surfaces, keyed on the client IP) and a Postgres-backed
// per-account token-bucket store (for authenticated surfaces, RLS-scoped). Extracted so every
// consuming service imports ONE shared implementation instead of hand-copying it.
export {
  TokenBucketLimiter,
  clientIp,
  type BucketConfig,
  type RateDecision,
  type RateLimiter,
  type TokenBucketLimiterConfig,
} from "./token-bucket.ts";

export {
  RATE_LIMIT_SCHEMA_SQL,
  DEFAULT_RATE_LIMIT,
  checkRateLimit,
  setAccountRateLimit,
  type RateLimitConfig,
  type RateLimitDecision,
} from "./account-store.ts";

export {
  createRateLimitedMcpServer,
  createRateLimitHook,
  type RateLimitHookDeps,
} from "./account-hook.ts";
