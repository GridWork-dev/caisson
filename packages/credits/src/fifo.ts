// The PURE half of the credit wallet (ADR-0396): the event-type vocabulary, the positive-integer
// money rule, and the FIFO consumption waterfall `debit()` walks. No database, no node builtin —
// the only non-relative edge is the browser-safe `@caisson-sh/kernel` barrel, so this is the module
// `@caisson-sh/credits/browser` publishes, and it is the ONE place the FIFO rule is implemented
// (`credits.ts` calls `planFifoDebit` rather than restating the walk).
//
// The DB-bound half deliberately stays in `credits.ts`: reading which grants are unexpired,
// locking the wallet row, writing `credit_event` / `grant_consumption`, and rolling the whole
// transaction back on a 402 are database acts, not arithmetic. This module decides only how many
// credits come off which grant, and whether the remainders cover the charge at all.
//
// Integer credit units only (ADR-0007): every amount here is a whole number, never a float.
import { ValidationError } from "@caisson-sh/kernel";

// `feature_grant` / `feature_debit` are the generic feature-meter envelopes (ADR-0074): an edition
// meters a NEW action through these carrying a registered `feature` tag, never by extending this
// base-owned, base-closed event-type set. The legacy specifics stay immutable + are not retrofitted.
export const GRANT_EVENT_TYPES = [
  "purchase",
  "sub_allotment",
  "topup",
  "feature_grant",
] as const;
export const DEBIT_EVENT_TYPES = [
  "codegen_debit",
  "ai_feature_debit",
  "feature_debit",
  // The compensating debit a refund writes to claw back UNSPENT credits granted by the refunded
  // purchase (ADR-0113). It is NOT a spendable-balance debit (no 402 floor): the amount is bounded to
  // the current balance so the wallet never goes negative. Written only via `clawback`, never `debit`.
  "refund_clawback",
  // The residue burn the expiry sweep writes when a grant passes its `expires_at` with credits left
  // (ADR-0245/0252). Like refund_clawback it is NOT a spendable-balance debit (bounded to the current
  // balance, wallet never negative). Written only via `sweepExpiredGrants`, never `debit`.
  "expiry_debit",
] as const;
export type GrantEventType = (typeof GRANT_EVENT_TYPES)[number];
export type DebitEventType = (typeof DEBIT_EVENT_TYPES)[number];

/**
 * Every grant/debit/clawback amount is a positive integer (ADR-0007) — internal to the package;
 * `grant`, `debit`, `clawback`, and `planFifoDebit` all route through this one check.
 */
export function assertPositiveInt(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError("amount must be a positive integer", {
      field: "amount",
    });
  }
}

/**
 * One unexpired grant in burn order, with its still-unconsumed credits. The server supplies these
 * from `credit_event` joined to `grant_consumption` (`created_at ASC, expires_at ASC, id ASC`);
 * ordering is the CALLER's contract — this module consumes the sequence it is handed, in order.
 */
export interface GrantRemainder {
  readonly id: string;
  /** Integer credits still unconsumed on this grant. */
  readonly remaining: number;
}

/** One grant a debit draws from, and how many credits it takes (always a positive integer). */
export interface FifoDraw {
  readonly grantId: string;
  readonly taken: number;
}

export interface FifoDebitPlan {
  /** The draws in burn order, one per grant touched. Empty when nothing could be covered. */
  readonly draws: readonly FifoDraw[];
  /** Credits the supplied remainders cover — equal to the requested amount when fully funded. */
  readonly covered: number;
  /** `amount - covered`. Greater than zero means the debit must 402 and record nothing. */
  readonly shortfall: number;
}

/**
 * Plan a debit against grant remainders in the order supplied: take `min(remaining, still needed)`
 * from each grant until the charge is covered or the grants run out. Pure — it writes nothing and
 * throws no 402; the caller decides what a shortfall means (the server rolls its transaction back
 * and throws `InsufficientCreditsError(amount, covered)`; a client surface can render the same
 * numbers without a database).
 *
 * A non-positive remainder contributes no draw: the server's FIFO query already excludes drained
 * grants (`HAVING amount - SUM(consumed) > 0`), so this changes nothing on the database path — it
 * is the guard that keeps a zero-credit draw, which `grant_consumption_amount_positive` forbids,
 * from being planned at all when a caller passes a fully drained line.
 *
 * Throws `ValidationError` when `amount` is not a positive integer, or when any remainder is not
 * an integer (ADR-0007). The remainders are the other half of the money input and this is a
 * PUBLISHED entry a client reaches with numbers parsed out of an API response, where a missing,
 * null, or string-typed field is ordinary — the server's `::int` cast covers only the database
 * path. Validating them here is what keeps `covered`/`shortfall` real numbers: an unchecked NaN
 * remainder makes `Math.min` NaN, poisons the accumulator, and returns `shortfall: NaN`, which
 * every `shortfall > 0` gate — the 402 in `debit()` included — reads as fully funded.
 */
export function planFifoDebit(
  grants: readonly GrantRemainder[],
  amount: number,
): FifoDebitPlan {
  assertPositiveInt(amount);
  // Every remainder is checked, not only the ones the walk below reaches, so the same input is
  // accepted or refused whichever grant happens to cover the charge.
  for (const g of grants) {
    if (!Number.isInteger(g.remaining)) {
      throw new ValidationError("grant remaining must be an integer", {
        field: "remaining",
        grantId: g.id,
      });
    }
  }
  let toCover = amount;
  const draws: FifoDraw[] = [];
  for (const g of grants) {
    if (toCover === 0) break;
    const take = Math.min(g.remaining, toCover);
    // Negated on purpose: `take <= 0` is FALSE for NaN, so the plain form would push a
    // `{taken: NaN}` draw and fail open. The check above already rules NaN out; the guard stays
    // NaN-closed so it cannot become the hole again if that check ever moves.
    if (!(take > 0)) continue;
    draws.push({ grantId: g.id, taken: take });
    toCover -= take;
  }
  return { draws, covered: amount - toCover, shortfall: toCover };
}
