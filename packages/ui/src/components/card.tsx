import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import "./card.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Accent treatment — accent border + tinted surface (one of the ≤10% accent slots). */
  accent?: boolean;
  /** Tonal-hover affordance: border brighten + surface step + lift (motion-tokened). */
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Card — presentational panel primitive (recipe per ADR-0099). Renders a single `<div>`, so it is
 * server-safe and `forwardRef`s its DOM root. No Radix: a card never navigates or toggles.
 *   - `accent` → `data-accent` (boolean attribute), `interactive` → `data-interactive`; both styled
 *     by attribute selectors in `card.css` — no variant logic in JS.
 *   - Co-located CSS reads only `var(--cs-*)`; BEM block `cs-card`.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { accent, interactive, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={className ? `cs-card ${className}` : "cs-card"}
      data-accent={accent ? "" : undefined}
      data-interactive={interactive ? "" : undefined}
      {...rest}
    >
      {children}
    </div>
  );
});
