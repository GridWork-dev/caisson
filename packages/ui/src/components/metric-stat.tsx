import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "./icon";

import "./metric-stat.css";

/**
 * Tone tints the value + icon. `default` is the resting register; the others map to
 * the locked functional tokens (success / warning / danger) so the meaning is
 * color-independent across the cascade — the label + value text always carry the fact.
 */
export type MetricStatTone = "default" | "positive" | "warning" | "critical";

export interface MetricStatProps extends HTMLAttributes<HTMLDivElement> {
  /** Small muted caption above the value (what is being measured). */
  label: ReactNode;
  /** The headline figure, rendered large in tabular numerics (e.g. a `<MoneyCell>`). */
  value: ReactNode;
  /** Optional supporting line below the value (a delta, qualifier, or caption). */
  hint?: ReactNode;
  /** Optional leading glyph via the one `<Icon>` surface, tinted to match `tone`. */
  icon?: IconName;
  /** Semantic register for the value + icon. Default `default`. */
  tone?: MetricStatTone;
}

/**
 * MetricStat — a single dashboard stat tile (credits balance, entitlement count, …).
 * A small muted label, a large value in tabular figures, and an optional hint/delta
 * line. `tone` tints the value + icon via tokens only, never a TS light/dark branch.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`, `tone` as a
 * `data-tone` attribute resolved to a local-indirection `--stat-fg` var (rule 3), BEM
 * block `cs-stat`, `forwardRef` on the root. Presentational — no Radix.
 */
export const MetricStat = forwardRef<HTMLDivElement, MetricStatProps>(
  function MetricStat(
    { label, value, hint, icon, tone = "default", className, ...rest },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={className ? `cs-stat ${className}` : "cs-stat"}
        data-tone={tone}
        {...rest}
      >
        <div className="cs-stat__head">
          <span className="cs-stat__label">{label}</span>
          {icon ? (
            <span className="cs-stat__icon" aria-hidden="true">
              <Icon name={icon} />
            </span>
          ) : null}
        </div>
        <span className="cs-stat__value cs-num">{value}</span>
        {hint !== undefined ? (
          <span className="cs-stat__hint">{hint}</span>
        ) : null}
      </div>
    );
  },
);
