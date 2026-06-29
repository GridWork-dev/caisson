// The single credit denomination + commerce conversion (ADR-0007/0089; SD-3 home → @caisson/kernel,
// ADR-0098). THE one unit of account: 1 credit = `microUsdPerCredit` micro-USD. Owned here in the
// base-of-base so BOTH the per-ai-call COST book (@caisson/ai-meter, ADR-0060 — rounds UP, never
// under-bill) AND the COMMERCE price-book (@caisson/pricebook, ADR-0089 — rounds DOWN, never
// over-grant) import the SAME constant: exactly one definition exists across the codebase (a second
// would silently drift the two books apart). Integer-only, BigInt internally, never a float
// (ADR-0002/0007). pricebook and ai-meter are both commercial packages ABOVE kernel in the tower, so
// neither may own this (a shared dep can't live "up") — kernel is the only home both resolve DOWN to
// (ADR-0003).
import { z } from "zod";
import { ValidationError } from "./errors.ts";
import { parseStrict, strictObject } from "./schema.ts";

/** Integer micro-USD per credit — the credit denomination (ADR-0007). */
export const creditConversionSchema = strictObject({
  microUsdPerCredit: z.number().int().positive(),
});
export type CreditConversion = z.infer<typeof creditConversionSchema>;

/**
 * THE credit denomination: 1 credit = 1000 micro-USD = $0.001 (ADR-0060/0089). The single unit of
 * account shared by the cost book (ai-meter) and the commerce book (pricebook). Changing this value
 * re-prices the entire ledger — it is intentionally one constant, in one place.
 */
export const CREDIT_CONVERSION: CreditConversion = { microUsdPerCredit: 1000 };

/** Micro-USD in one US cent — the bridge from a raw USD figure (Stripe `amount`) to the denomination. */
const MICRO_USD_PER_CENT = 10_000n;

/** Validate a credit-conversion override at a boundary (Zod `.strict()`). */
export function parseCreditConversion(input: unknown): CreditConversion {
  return parseStrict(creditConversionSchema, input);
}

/**
 * Convert an integer US-cent amount to integer credits for a GRANT, rounding DOWN (never over-grant)
 * — the conservative direction when crediting a buyer, mirroring ai-meter's COST path which rounds UP
 * (never under-bill). BigInt throughout: no float ever materializes. With the default
 * `microUsdPerCredit = 1000`, 1 cent = 10 credits exactly (no remainder). `cents` must be a
 * non-negative integer — a fractional or negative amount is a caller bug, surfaced loudly, never a
 * silent 0.
 */
export function centsToCredits(
  cents: number,
  conversion: CreditConversion = CREDIT_CONVERSION,
): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new ValidationError("cents must be a non-negative integer", {
      field: "cents",
    });
  }
  // BigInt division truncates toward zero; with non-negative operands that is floor (round-down).
  return Number(
    (BigInt(cents) * MICRO_USD_PER_CENT) / BigInt(conversion.microUsdPerCredit),
  );
}
