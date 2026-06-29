// Wordmark + glyph (ADR-0078 §2, mark locked by ADR-0101). The lowercase mono `caisson` wordmark is
// primary; the "Pressure vessel" mark — a sealed steel port holding one instrument light — rides
// beside it. MONOCHROME ALWAYS in-product — the accent never enters the wordmark (protects the ≤10%
// accent budget, ADR-0078 §8); only the favicon/app-icon carries the accent light. Server-safe.
import type { SVGProps } from "react";

/** The Caisson "Pressure vessel" mark (ADR-0101), monochrome (currentColor). The favicon variant
 *  (app/icon.svg) carries the accent light; in-product it stays monochrome. */
export function Glyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <rect
        x="5"
        y="5"
        width="22"
        height="22"
        rx="7"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M11 10.5h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
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
}

/** The brand lockup. `descriptor` adds the footer/OG tagline; `glyphOnly` is for the nav avatar. */
export function Wordmark({
  descriptor = false,
  className,
}: {
  descriptor?: boolean;
  className?: string;
}) {
  return (
    <span className={["cs-wordmark", className].filter(Boolean).join(" ")}>
      <Glyph className="cs-wordmark__glyph" />
      <span>caisson</span>
      {descriptor && (
        <span
          className="cs-muted"
          style={{
            marginLeft: "var(--cs-space-2)",
            fontSize: "var(--cs-text-xs)",
            fontWeight: "var(--cs-weight-body)",
          }}
        >
          compliance-grade infrastructure
        </span>
      )}
    </span>
  );
}
