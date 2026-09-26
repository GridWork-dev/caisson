import type { ReactNode } from "react";

import "./mobile-buy-bar.css";

export interface MobileBuyBarProps {
  /** The item being purchased (e.g. a module or bundle name) — the same label the full purchase card shows. */
  label: string;
  /** An already-formatted price string (e.g. "$149"), matching the full purchase card's own formatter. */
  price: string;
  /** The purchase action, typically an Add-to-cart button — passed through as-is, never re-implemented here. */
  action: ReactNode;
}

/**
 * Presentational recipe component (ADR-0099) — a persistent price + purchase bar pinned to the
 * mobile viewport bottom, for a page whose full purchase card sinks below other content once the
 * responsive grid collapses to one column (a long page's sticky sidebar rail only exists above that
 * breakpoint). Always rendered — never conditionally mounted — so there is no hydration mismatch;
 * visibility below the breakpoint is a pure CSS media query, the same pattern the rest of the kit
 * uses for mobile-only chrome. No Radix: this never navigates or toggles, it only displays the
 * caller's own action element (BEM block `cs-mobile-buy-bar`, co-located CSS reads only `var(--cs-*)`).
 */
export function MobileBuyBar({ label, price, action }: MobileBuyBarProps) {
  return (
    <div
      className="cs-mobile-buy-bar"
      role="region"
      aria-label={`Buy ${label}`}
    >
      <div className="cs-mobile-buy-bar__info">
        <span className="cs-mobile-buy-bar__label">{label}</span>
        <span className="cs-mobile-buy-bar__price cs-num">{price}</span>
      </div>
      <div className="cs-mobile-buy-bar__action">{action}</div>
    </div>
  );
}
