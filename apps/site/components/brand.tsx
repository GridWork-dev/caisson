// Wordmark + glyph (ADR-0078 §2). The lowercase mono `caisson` wordmark is primary; the
// waterline-over-chamber glyph rides beside it in tight contexts. MONOCHROME ALWAYS — the accent
// never enters the wordmark (protects the ≤10% accent budget, ADR-0078 §8). Server-safe.
import type { SVGProps } from "react";

/** The waterline-over-chamber mark, monochrome (currentColor). The favicon variant (app/icon.svg)
 *  carries the accent waterline; in-product it stays monochrome. */
export function Glyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
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
