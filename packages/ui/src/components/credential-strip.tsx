import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

import "./credential-strip.css";

export interface CredentialStripProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label"
> {
  /** Framework names rendered inline, separated by a leading "·" from the second item on. */
  items: readonly string[];
  /** Optional trailing note; wraps onto its own full-width row in muted text. */
  note?: string;
}

/**
 * CredentialStrip (V7) — presentational compliance-framework strip. Recipe primitive (ADR-0099):
 *   - No Radix (no behavior/polymorphism), no `"use client"` (server-safe, no hook/handler).
 *   - Co-located plain CSS (`credential-strip.css`) reading only `var(--cs-*)`.
 *   - BEM block `cs-credentials` / elements `__item` `__sep` `__note`. No inline style.
 *   - `forwardRef` on the single `<div>` root, mirroring the Button reference shape.
 */
export const CredentialStrip = forwardRef<HTMLDivElement, CredentialStripProps>(
  function CredentialStrip({ items, note, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={className ? `cs-credentials ${className}` : "cs-credentials"}
        aria-label="Compliance frameworks"
        {...rest}
      >
        {items.map((it, i) => (
          <span key={it} className="cs-credentials__item">
            {i > 0 && (
              <span className="cs-credentials__sep" aria-hidden="true">
                ·
              </span>
            )}
            {it}
          </span>
        ))}
        {note && <span className="cs-credentials__note">{note}</span>}
      </div>
    );
  },
);
