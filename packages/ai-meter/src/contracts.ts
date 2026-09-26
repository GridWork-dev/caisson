// The spend-policy DECISION vocabulary (ADR-0060), with no store attached: the aggregation scope,
// the breaker's state shape, and the 402 a closed wallet raises. Extracted verbatim from breaker.ts
// (ADR-0396) so `./browser` can carry the money path's decisions without dragging schema.ts — and
// through it `@caisson-sh/tenancy-rls` — into a client bundle. A move, not a rename: every name here
// keeps its place on the `.` barrel.
//
// The DB-bound half (readBreaker/assertBreakerClosed/tripBreaker/resetBreaker) stays in breaker.ts
// and is deliberately NOT re-exported here — it needs a `TenantExecutor` and never joins `./browser`.
import { CaissonError } from "@caisson-sh/kernel";

/** The default aggregation scope a policy/breaker/window key on when the caller does not specify. */
export const DEFAULT_SCOPE = "account";

export type BreakerState = "closed" | "open";

export interface BreakerStatus {
  state: BreakerState;
  reason: string | null;
}

/**
 * A spend cap reached / circuit breaker open. HTTP 402 (the credit-gate status, ADR-0007) — the
 * tenant has no spendable budget for this call. Metadata only: `details` carries the `scope`, never
 * the spend figures, so the envelope stays redaction-safe (mirrors `InsufficientCreditsError`).
 */
export class SpendCapError extends CaissonError {
  readonly code = "spend_cap_reached";
  readonly httpStatus = 402;
  constructor(
    scope: string,
    message = "Spend cap reached: circuit breaker open",
  ) {
    super(message, { scope });
  }
}
