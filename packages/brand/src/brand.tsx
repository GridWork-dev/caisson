// Wordmark + glyph — the Caisson brand lockup. The lowercase mono `caisson` wordmark is primary;
// the waterline-over-chamber glyph rides beside it in tight contexts. MONOCHROME ALWAYS — the accent
// never enters the wordmark (protects the ≤10% accent budget). Server-safe (no hook/handler/browser
// API → no "use client"). Both render a single DOM root, so both forwardRef (matching the kit Button
// reference). Private brand IP: apps consume `@caisson-sh/brand` directly; the `@caisson-sh/ui` floor no
// longer ships the mark.
import { forwardRef } from "react";
import type { SVGProps } from "react";

import "./brand.css";

/**
 * The Caisson mark — the "Pressure vessel": a sealed steel port holding a single instrument light,
 * with a waterline seam across the crown. Monochrome (`currentColor`) in-product; the favicon /
 * app-icon variant (app/icon.svg) carries the accent light on a dark steel field. The accent never
 * enters the in-product mark (protects the ≤10% budget). `forwardRef` per the recipe (single SVG
 * DOM root).
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
        {/* vessel body */}
        <rect
          x="5"
          y="5"
          width="22"
          height="22"
          rx="7"
          stroke="currentColor"
          strokeWidth="2"
        />
        {/* crown seam — the waterline */}
        <path
          d="M11 10.5h10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        {/* instrument light — halo ring + core, monochrome in-product */}
        <circle
          cx="16"
          cy="17"
          r="3.4"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.5"
        />
        <circle cx="16" cy="17" r="1.7" fill="currentColor" />
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
 * `caisson` wordmark. The descriptor's inline styles are the co-located `.cs-wordmark__descriptor`
 * class (recipe rule 5).
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
