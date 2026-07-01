import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

import "./loading-state.css";

export type LoadingStateVariant = "table" | "stat" | "list" | "block";

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Layout this skeleton stands in for, so it occupies the same shape as the real
   * content and avoids layout shift once data arrives. Default `block`. */
  variant?: LoadingStateVariant;
  /** Row count for `table` / `list`. Default 5. */
  rows?: number;
  /** Column count for `table`. Default 4. */
  columns?: number;
  /** Accessible busy label, announced to screen readers. Default "Loading". */
  label?: string;
}

function Bar({ size }: { size: "lg" | "sm" | "xs" }) {
  return (
    <span
      className={`cs-skeleton__bar cs-skeleton__bar--${size}`}
      aria-hidden="true"
    />
  );
}

function Body({
  variant,
  rows,
  columns,
}: {
  variant: LoadingStateVariant;
  rows: number;
  columns: number;
}) {
  if (variant === "table") {
    const colIdx = Array.from({ length: Math.max(1, columns) }, (_, i) => i);
    const rowIdx = Array.from({ length: Math.max(1, rows) }, (_, i) => i);
    return (
      <div className="cs-skeleton__table">
        <div className="cs-skeleton__row cs-skeleton__row--head">
          {colIdx.map((i) => (
            <Bar key={i} size="xs" />
          ))}
        </div>
        {rowIdx.map((r) => (
          <div key={r} className="cs-skeleton__row">
            {colIdx.map((c) => (
              <Bar key={c} size="sm" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === "stat") {
    return (
      <div className="cs-skeleton__stat-row">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="cs-skeleton__tile">
            <Bar size="xs" />
            <Bar size="lg" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="cs-skeleton__list">
        {Array.from({ length: Math.max(1, rows) }, (_, i) => (
          <Bar key={i} size="sm" />
        ))}
      </div>
    );
  }

  return (
    <div className="cs-skeleton__block">
      <Bar size="lg" />
      <Bar size="sm" />
    </div>
  );
}

/**
 * LoadingState — the kit's async skeleton (one of the three async states with
 * `EmptyState` / `ErrorState`). `DataTable` renders this internally while `loading`;
 * views may also mount it directly above their own layout.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`, variant as a
 * `data-variant` attribute, BEM block `cs-skeleton`, `forwardRef` on the root. A polite
 * live region (`role="status"`, `aria-busy`) with a visually-hidden label; the bars
 * themselves are `aria-hidden`. The pulse is disabled under `prefers-reduced-motion`.
 */
export const LoadingState = forwardRef<HTMLDivElement, LoadingStateProps>(
  function LoadingState(
    {
      variant = "block",
      rows = 5,
      columns = 4,
      label = "Loading",
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={className ? `cs-skeleton ${className}` : "cs-skeleton"}
        data-variant={variant}
        role="status"
        aria-busy="true"
        aria-label={label}
        {...rest}
      >
        <span className="cs-skeleton__sr">{label}</span>
        <Body variant={variant} rows={rows} columns={columns} />
      </div>
    );
  },
);
