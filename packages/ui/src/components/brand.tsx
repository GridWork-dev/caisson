// Wordmark + glyph (ADR-0078 §2) — ported to the @caisson/ui kit recipe (ADR-0097). The lowercase
// mono `caisson` wordmark is primary; the waterline-over-chamber glyph rides beside it in tight
// contexts. MONOCHROME ALWAYS — the accent never enters the wordmark (protects the ≤10% accent
// budget, ADR-0078 §8). Server-safe (no hook/handler/browser API → no "use client"). Both render a
// single DOM root, so both forwardRef (matching the Button reference).
import { forwardRef } from "react";
import type { SVGProps } from "react";

import "./brand.css";

/**
 * The waterline-over-chamber mark, monochrome (`currentColor`). The favicon variant (app/icon.svg)
 * carries the accent waterline; in-product it stays monochrome. Geometry preserved verbatim from the
 * original `apps/site` primitive; `forwardRef` added per the recipe (single SVG DOM root).
 */
export const Glyph = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  function Glyph(props, ref) {
    return (
      <svg
        ref={ref}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        {...props}
      >
        <path
          d="M6 11h7M19 11h7M13 11q3 -2.5 6 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 15v9h14v-9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  },
);

export interface WordmarkProps {
  /** Adds the footer/OG tagline beside the wordmark. */
  descriptor?: boolean;
  className?: string;
}

/**
 * The brand lockup. `descriptor` adds the footer/OG tagline; the glyph rides beside the mono
 * `caisson` wordmark. Prop API + structure preserved verbatim from the original; the descriptor's
 * inline styles are now the co-located `.cs-wordmark__descriptor` class (recipe rule 5).
 */
export const Wordmark = forwardRef<HTMLSpanElement, WordmarkProps>(
  function Wordmark({ descriptor = false, className }, ref) {
    return (
      <span
        ref={ref}
        className={className ? `cs-wordmark ${className}` : "cs-wordmark"}
      >
        <Glyph className="cs-wordmark__glyph" />
        <span>caisson</span>
        {descriptor && (
          <span className="cs-muted cs-wordmark__descriptor">
            compliance-grade infrastructure
          </span>
        )}
      </span>
    );
  },
);
