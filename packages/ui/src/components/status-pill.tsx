import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import "./status-pill.css";

/** Entitlement / license lifecycle states (the credit-ledger + licensing domain). */
export type EntitlementStatus = "active" | "expired" | "revoked" | "pending";

const DEFAULT_LABEL: Record<EntitlementStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
  pending: "Pending",
};

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  /** Which lifecycle state to render — drives the tone + default label. */
  status: EntitlementStatus;
  /** Override the label; omit for the default plain-English label. */
  children?: ReactNode;
}

/**
 * StatusPill — entitlement/license status pill (active / expired / revoked / pending).
 * Sibling to `StatusChip` (the generic glyph+label pill) but scoped to the adopter
 * dashboard's entitlement domain, so callers get a typed `status` instead of a free
 * `tone`. Never colour-alone: a status dot plus the always-present text label carry
 * the meaning together.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; `status` is a
 * `data-status` attribute resolved by attribute selectors to a local-indirection
 * `--pill-fg` var (rule 3), so light/dark "just works" by cascade with no theme
 * branching in JS. Presentational — no Radix.
 */
export const StatusPill = forwardRef<HTMLSpanElement, StatusPillProps>(
  function StatusPill({ status, children, className, ...rest }, ref) {
    return (
      <span
        ref={ref}
        className={className ? `cs-pill ${className}` : "cs-pill"}
        data-status={status}
        {...rest}
      >
        <span className="cs-pill__dot" aria-hidden="true" />
        {children ?? DEFAULT_LABEL[status]}
      </span>
    );
  },
);
