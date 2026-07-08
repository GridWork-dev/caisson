import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import "./badge.css";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Semantic tone → a local-indirection `--badge-fg` var (recipe rule 3). Defaults to `neutral`. */
  tone?: BadgeTone;
  size?: BadgeSize;
  children?: ReactNode;
}

/**
 * Badge — a compact solid-fill tag for counts, categories, and short labels (e.g. a module's
 * category chip in a card grid, a cart-item count). Sibling to `StatusChip` (glyph + label,
 * entitlement-flavored tones) but generic: no icon slot, no dot, just text — the kit's plain
 * "tag" primitive the audit flagged as a gap.
 *
 * Recipe-compliant (ADR-0099/ADR-0291): co-located CSS reading only `var(--cs-*)`; `tone` is a
 * `data-tone` attribute resolved by attribute selectors to a local-indirection `--badge-fg` var
 * so light/dark "just works" by cascade with no theme branching in JS. Presentational,
 * server-safe, zero dependencies — `forwardRef` on the single root `<span>`.
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = "neutral", size = "md", className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={className ? `cs-badge ${className}` : "cs-badge"}
      data-tone={tone}
      data-size={size}
      {...rest}
    >
      {children}
    </span>
  );
});
