import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "./icon";

import "./status-chip.css";

export type StatusChipTone = "accent" | "success" | "muted";

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** The chip text (always present — meaning is carried by label + glyph, never colour-alone). */
  label: string;
  /** Semantic tone → a local-indirection `--chip-fg` var (recipe rule 3); defaults to `muted`. */
  tone?: StatusChipTone;
  /** Optional leading glyph (Lucide / bespoke domain icon, via the one `<Icon>` surface). */
  icon?: IconName;
  /** Show the leading status dot (inherits `currentColor` from the resolved tone). */
  dot?: boolean;
  children?: ReactNode;
}

/**
 * StatusChip — glyph + label status pill (ADR-0078 §7), never colour-alone.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; tone is a `data-tone`
 * attribute resolved by attribute selectors to a local-indirection `--chip-fg` var (rule 3) so
 * light/dark "just works" by cascade with no theme branching in JS. Presentational — no Radix.
 */
export const StatusChip = forwardRef<HTMLSpanElement, StatusChipProps>(
  function StatusChip(
    { label, tone = "muted", icon, dot, className, children, ...rest },
    ref,
  ) {
    return (
      <span
        ref={ref}
        className={className ? `cs-chip ${className}` : "cs-chip"}
        data-tone={tone}
        {...rest}
      >
        {dot ? <span className="cs-chip__dot" aria-hidden="true" /> : null}
        {icon ? <Icon name={icon} /> : null}
        {label}
        {children}
      </span>
    );
  },
);
