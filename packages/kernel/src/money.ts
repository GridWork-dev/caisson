// Branded money types + rounding provenance (ADR-0212). TS-native nominal brands over `number` —
// compile-time-only, ZERO runtime cost: no wrapper class, no Zod parse per computation, and a branded
// value widens back to `number` for free at a DB boundary (a SQL param or BigInt() needs no unwrap).
// A cents value can no longer pass silently where credits are expected; explicit construction is
// required only where a raw number first BECOMES money. Integer-only throughout (ADR-0002/0007).
import { ValidationError } from "./errors.ts";

// A real exported symbol (not `declare const`): declaration emit must be able to NAME the brand key
// when a dependent package's d.ts expands one of these types (TS4023 otherwise). One symbol at module
// load; individual money values stay plain numbers — the brand never exists on them at runtime.
export const brandTag: unique symbol = Symbol("caisson.moneyBrand");
export type MoneyBrand<Name extends string> = { readonly [brandTag]: Name };

/** Integer US cents (a provider `amount`). */
export type Cents = number & MoneyBrand<"Cents">;
/** Integer credit units — THE unit of account (ADR-0007/0098). */
export type Credits = number & MoneyBrand<"Credits">;
/** Integer micro-USD (1e-6 USD) — the cost-book normalization unit (ADR-0060). */
export type MicroUsd = number & MoneyBrand<"MicroUsd">;
/** Integer micro-USD per credit — the credit denomination (ADR-0098). */
export type MicroUsdPerCredit = number & MoneyBrand<"MicroUsdPerCredit">;

function assertNonNegativeInt(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`, {
      field,
    });
  }
}

/** Mint a `Cents` value at a boundary (non-negative integer, else `ValidationError`). */
export function asCents(value: number): Cents {
  assertNonNegativeInt(value, "cents");
  return value as Cents;
}

/** Mint a `Credits` value at a boundary (non-negative integer, else `ValidationError`). */
export function asCredits(value: number): Credits {
  assertNonNegativeInt(value, "credits");
  return value as Credits;
}

/** Mint a `MicroUsd` value at a boundary (non-negative integer, else `ValidationError`). */
export function asMicroUsd(value: number): MicroUsd {
  assertNonNegativeInt(value, "microUsd");
  return value as MicroUsd;
}

/** Mint the credit denomination (POSITIVE integer — a zero unit would divide by zero). */
export function asMicroUsdPerCredit(value: number): MicroUsdPerCredit {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError("microUsdPerCredit must be a positive integer", {
      field: "microUsdPerCredit",
    });
  }
  return value as MicroUsdPerCredit;
}

/**
 * Identity no-op: a grep-able DB-BOUNDARY MARKER where a branded value leaves for a SQL parameter —
 * not a type requirement (brands widen to `number` for free). Use it to make the exit explicit.
 */
export function unwrapMoney(
  value: Cents | Credits | MicroUsd | MicroUsdPerCredit,
): number {
  return value;
}

/** The documented direction a rounding site applies (ADR-0060 costs UP, ADR-0089 grants DOWN). */
export type RoundingMode = "up" | "down";

/**
 * The auditable record a rounding site returns (ADR-0212): the pre-rounding raw value, the site's
 * fixed direction, and the rounded integer result. `mode` names the SITE's documented direction —
 * it is recorded even when the division happened to be exact. Persisting `{raw, mode}` alongside the
 * ledger amount makes a grant/debit auditable after the fact; the STORED amount stays an integer
 * (ADR-0007 untouched — provenance describes the rounding, it never replaces the integer).
 */
export interface RoundedMoney<
  TRaw extends number = number,
  TResult extends number = number,
> {
  raw: TRaw;
  mode: RoundingMode;
  result: TResult;
}
