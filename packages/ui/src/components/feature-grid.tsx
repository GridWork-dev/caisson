import type { HTMLAttributes, ReactNode } from "react";

import "./feature-grid.css";

export interface FeatureGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Column count at the widest breakpoint (collapses to 1 on narrow viewports). Default 2. */
  cols?: 2 | 3;
  /** Drop the default top margin when the parent `Section` already supplies the rhythm. */
  flush?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * FeatureGrid — the shared responsive card/feature grid, following the kit's shared component
 * recipe of co-located CSS + no bespoke styling (ADR-0099). Collapses the
 * hand-duplicated `<div className="cs-grid cs-grid--N" style={{ marginTop }}>` pattern into one
 * primitive: it reuses the existing kit-gated `cs-grid`/`cs-grid--N` layout (styles/base.css) and
 * layers the standard top margin (skippable via `flush`). Server-safe; values via `var(--cs-*)`.
 */
export function FeatureGrid({
  cols = 2,
  flush = false,
  className,
  children,
  ...rest
}: FeatureGridProps) {
  const classes = [
    "cs-grid",
    `cs-grid--${cols}`,
    "cs-feature-grid",
    flush ? "cs-feature-grid--flush" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
