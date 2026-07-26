import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { EmptyState } from "./empty-state";
import { LoadingState } from "./loading-state";
import { MoneyCell, type MoneyCellUnit } from "./money-cell";

import "./ledger-list.css";

/** One credit-ledger transaction. `delta` is signed (grant = positive, debit =
 * negative); `balance` is the running total AFTER this entry. Both are integer units
 * (ADR-0007), denominated per the `LedgerList`/`LedgerRow` `unit` prop. */
export interface LedgerEntry {
  id: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  reason: string;
  delta: number;
  balance: number;
}

/** ISO-8601 instant → a calm display label (e.g. "Jun 30, 2026, 2:14 PM"). A value that
 * fails to parse is returned verbatim rather than reformatted into a plausible-looking
 * date the data did not carry. */
export function formatLedgerTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export interface LedgerRowProps {
  entry: LedgerEntry;
  /** Display unit for `delta` / `balance`. Default `"credits"`. */
  unit?: MoneyCellUnit;
}

/**
 * LedgerRow — one credit-ledger transaction row: timestamp, reason, the signed delta
 * (via `<MoneyCell sign signTone>`), and the running balance. Composes inside
 * `<LedgerList>`; presentational, no Radix.
 */
export function LedgerRow({ entry, unit = "credits" }: LedgerRowProps) {
  return (
    <div className="cs-ledger__row" data-row-id={entry.id}>
      <span className="cs-ledger__timestamp">
        {formatLedgerTimestamp(entry.timestamp)}
      </span>
      <span className="cs-ledger__reason">{entry.reason}</span>
      <MoneyCell
        className="cs-ledger__delta"
        value={entry.delta}
        unit={unit}
        sign
        signTone
      />
      <MoneyCell
        className="cs-ledger__balance"
        value={entry.balance}
        unit={unit}
      />
    </div>
  );
}

export interface LedgerListProps extends HTMLAttributes<HTMLDivElement> {
  entries: readonly LedgerEntry[];
  /** Display unit for every row's delta/balance. Default `"credits"`. */
  unit?: MoneyCellUnit;
  /** Renders the built-in `LoadingState` (list variant) in place of `entries`. */
  loading?: boolean;
  /** Skeleton row count while `loading`. Default 5. */
  loadingRows?: number;
  /** Rendered when `entries` is empty and not `loading`. Defaults to a generic
   * `<EmptyState>`. */
  empty?: ReactNode;
}

/**
 * LedgerList — the credit-ledger transaction list. A muted column head plus one
 * `<LedgerRow>` per entry, with the built-in `loading` (skeleton) and empty states
 * already wired in.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`, BEM block
 * `cs-ledger`, `forwardRef` on the root. Presentational — no Radix.
 *
 * @a11y The visual column header is `aria-hidden`; each transaction's date, reason, amount, and
 *   balance remain readable in DOM order.
 */
export const LedgerList = forwardRef<HTMLDivElement, LedgerListProps>(
  function LedgerList(
    {
      entries,
      unit = "credits",
      loading = false,
      loadingRows = 5,
      empty,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={className ? `cs-ledger ${className}` : "cs-ledger"}
        {...rest}
      >
        <div className="cs-ledger__head" aria-hidden="true">
          <span>Date</span>
          <span>Reason</span>
          <span className="cs-ledger__head-numeric">Amount</span>
          <span className="cs-ledger__head-numeric">Balance</span>
        </div>
        {loading ? (
          <LoadingState variant="list" rows={loadingRows} />
        ) : entries.length === 0 ? (
          (empty ?? <EmptyState title="No ledger activity yet" />)
        ) : (
          entries.map((entry) => (
            <LedgerRow key={entry.id} entry={entry} unit={unit} />
          ))
        )}
      </div>
    );
  },
);
