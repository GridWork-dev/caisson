import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import "./terminal.css";

export interface TerminalProps extends HTMLAttributes<HTMLDivElement> {
  /** Chrome-bar label; also mirrored to the `<pre>` `aria-label`. */
  label: string;
  /** A `<StatusChip/>` or text rendered at the right of the chrome bar. */
  status?: ReactNode;
  children?: ReactNode;
}

/**
 * Terminal — the framed evidence artifact (a chrome bar + a monospace body). Purely
 * presentational (no Radix, server-safe per recipe rule 1). Built to the ADR-0099 recipe:
 *   - Co-located plain CSS (`terminal.css`) reading only `var(--cs-*)`.
 *   - BEM block `cs-terminal` / elements `cs-terminal__bar` + `cs-terminal__body`.
 *   - `forwardRef` onto the single DOM root, matching the Button reference.
 */
export const Terminal = forwardRef<HTMLDivElement, TerminalProps>(
  function Terminal({ label, status, className, children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={className ? `cs-terminal ${className}` : "cs-terminal"}
        {...rest}
      >
        <div className="cs-terminal__bar">
          <span>{label}</span>
          {status}
        </div>
        <pre className="cs-terminal__body" aria-label={label}>
          {children}
        </pre>
      </div>
    );
  },
);
