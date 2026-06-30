import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "./icon";

import "./error-state.css";

export interface ErrorStateProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** Headline — what failed, in plain English. Default "Something went wrong". */
  title?: ReactNode;
  /** Supporting line; lead with reassurance, one next step. */
  description?: ReactNode;
  /** Optional action slot (e.g. a retry `<Button>`). */
  action?: ReactNode;
  /** Leading glyph. Default `"alert-triangle"`; pass `null` to omit. */
  icon?: IconName | null;
}

/**
 * ErrorState — the calm failure affordance for a failed fetch / thrown read (one of the
 * three async states with `LoadingState` / `EmptyState`). A centered column: a tinted
 * warning glyph, a plain-English title, a reassuring description, and an optional
 * retry action.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`, BEM block
 * `cs-error`, `forwardRef` on the single `<div>` root. `role="alert"` — the failure is
 * announced to assistive tech without the consumer wiring a live region.
 */
export const ErrorState = forwardRef<HTMLDivElement, ErrorStateProps>(
  function ErrorState(
    {
      title = "Something went wrong",
      description = "We hit a problem loading this. Try again, and if it keeps happening, contact support.",
      action,
      icon = "alert-triangle",
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={className ? `cs-error ${className}` : "cs-error"}
        role="alert"
        {...rest}
      >
        {icon !== null ? (
          <span className="cs-error__icon" aria-hidden="true">
            <Icon name={icon} size="lg" />
          </span>
        ) : null}
        <p className="cs-error__title">{title}</p>
        {description !== undefined ? (
          <p className="cs-error__description">{description}</p>
        ) : null}
        {action !== undefined ? (
          <div className="cs-error__action">{action}</div>
        ) : null}
      </div>
    );
  },
);
