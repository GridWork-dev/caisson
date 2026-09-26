// src/retain.ts — the WORM retention floor (ADR-0054, implementing ADR-0006). A calendar-correct
// "retain until" computation with a HARD minimum: SEC 17a-4 and HIPAA §164.316(b)(2) both demand
// multi-year immutability, so a term below the floor is a fail-closed error — never silently
// shortened, never guessed. The returned date is what both the DB `retain_until` column AND the S3
// `RetainUntilDate` are set to, so the row date provably equals the object-lock date (ADR-0054).
import { ValidationError } from "@caisson-sh/kernel";

/** Hard legal minimum (years). HIPAA §164.316(b)(2) = 6yr; SEC 17a-4 = 6yr. Below this is rejected. */
export const MIN_RETENTION_YEARS = 6;

/** Conservative default when no explicit term is given — one year past the floor (SEC + buffer). */
export const DEFAULT_RETENTION_YEARS = 7;

/**
 * Compute the `retain_until` date `years` after `now`, calendar-correct: a Feb-29 anchor in a
 * non-leap target year rolls FORWARD to Mar-1 (the native `setUTCFullYear` behaviour), i.e. the lock
 * is never SHORTER than asked. `years` must be a positive integer at or above
 * {@link MIN_RETENTION_YEARS}; anything below the floor THROWS (fail-closed — a too-short WORM lock
 * is a compliance breach, never auto-extended to the floor). UTC throughout, so the result is
 * timezone-independent and deterministic for a fixed anchor.
 */
export function retainUntilFrom(
  now: Date,
  years: number = DEFAULT_RETENTION_YEARS,
): Date {
  const ms = now.getTime();
  if (Number.isNaN(ms)) {
    throw new ValidationError("retainUntilFrom requires a valid anchor date");
  }
  if (!Number.isInteger(years) || years < MIN_RETENTION_YEARS) {
    throw new ValidationError("retention term is below the WORM floor", {
      years,
      floorYears: MIN_RETENTION_YEARS,
    });
  }
  const until = new Date(ms);
  until.setUTCFullYear(until.getUTCFullYear() + years);
  return until;
}
