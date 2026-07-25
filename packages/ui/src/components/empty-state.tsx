import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "./icon";

import "./empty-state.css";

export interface EmptyStateProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** Leading glyph, centered in a soft tinted circle. Default `"inbox"`; pass `null` to omit. */
  icon?: IconName | null;
  /** The headline — what is empty, in plain English. */
  title: ReactNode;
  /** Optional supporting line under the title (muted). */
  description?: ReactNode;
  /** Optional call-to-action slot (e.g. a `<Button>`). */
  action?: ReactNode;
}

/**
 * EmptyState — the calm "nothing here yet" affordance for empty tables, lists, and
 * search results (one of the three async states with `LoadingState` / `ErrorState`).
 * `DataTable` renders this internally when `rows` is empty and not `loading`.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`, BEM block
 * `cs-empty`, `forwardRef` on the single `<div>` root. Presentational — no Radix.
 *
 * @a11y The decorative leading icon is `aria-hidden`; the visible title and description carry the
 *   empty-state meaning as text.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState(
    { icon = "inbox", title, description, action, className, ...rest },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={className ? `cs-empty ${className}` : "cs-empty"}
        {...rest}
      >
        {icon !== null ? (
          <span className="cs-empty__icon" aria-hidden="true">
            <Icon name={icon} size="lg" />
          </span>
        ) : null}
        <p className="cs-empty__title">{title}</p>
        {description !== undefined ? (
          <p className="cs-empty__description">{description}</p>
        ) : null}
        {action !== undefined ? (
          <div className="cs-empty__action">{action}</div>
        ) : null}
      </div>
    );
  },
);
