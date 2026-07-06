import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

import "./money-cell.css";

/** Which integer unit `value` is denominated in. `usd-cents` renders a `$` amount with
 * two decimals; `credits` renders a plain thousands-grouped integer. */
export type MoneyCellUnit = "usd-cents" | "credits";

/**
 * Pure formatter — integer units in, a display string out (ADR-0007: credits/money are
 * INTEGER units, never floats; this is the one render boundary where a decimal STRING
 * is allowed to exist, the value itself is never coerced to a float). Throws on a
 * non-safe-integer input so an out-of-domain value fails loudly at render rather than
 * silently drifting through `toLocaleString`.
 */
export function formatMoneyCellValue(
  value: number,
  unit: MoneyCellUnit = "usd-cents",
  opts?: { sign?: boolean },
): string {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`MoneyCell: value must be an integer unit, got ${value}`);
  }
  const negative = value < 0;
  const showSign = opts?.sign === true;
  const magnitude = Math.abs(value);

  if (unit === "credits") {
    const body = magnitude.toLocaleString("en-US");
    if (negative) return `-${body}`;
    return `${showSign ? "+" : ""}${body}`;
  }

  const body = (magnitude / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (negative) return `-$${body}`;
  return `${showSign ? "+" : ""}$${body}`;
}

export interface MoneyCellProps extends HTMLAttributes<HTMLSpanElement> {
  /** Integer value in the unit's smallest denomination (cents for `usd-cents`, whole
   * units for `credits`). Never a float (ADR-0007). */
  value: number;
  /** Display unit. Default `"usd-cents"`. */
  unit?: MoneyCellUnit;
  /** Prefix non-negative values with a leading `+` (reconciliation / ledger diffs). */
  sign?: boolean;
  /** Color the figure by its own sign (positive = success, negative = danger) — for
   * ledger deltas. Default `false` (neutral foreground). */
  signTone?: boolean;
}

/**
 * MoneyCell — renders an INTEGER credit/cent value via `formatMoneyCellValue`
 * (ADR-0007). Purely presentational: no parsing, no inline editing — `DataTable` /
 * `LedgerRow` cells compose it read-only.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`, `signTone`
 * resolved via a `data-sign` attribute + a local-indirection `--money-fg` var (rule 3),
 * BEM block `cs-money`, `forwardRef` on the root. Presentational — no Radix.
 */
export const MoneyCell = forwardRef<HTMLSpanElement, MoneyCellProps>(
  function MoneyCell(
    {
      value,
      unit = "usd-cents",
      sign = false,
      signTone = false,
      className,
      ...rest
    },
    ref,
  ) {
    const display = formatMoneyCellValue(value, unit, { sign });
    const signState = signTone
      ? value < 0
        ? "negative"
        : value > 0
          ? "positive"
          : "zero"
      : undefined;
    return (
      <span
        ref={ref}
        className={className ? `cs-money ${className}` : "cs-money"}
        data-sign={signState}
        {...rest}
      >
        {display}
      </span>
    );
  },
);
