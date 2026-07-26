import { forwardRef } from "react";
import type { ReactNode } from "react";

export type SectionBand = "tint" | "surface";

export interface SectionProps {
  eyebrow?: string;
  title?: ReactNode;
  lede?: ReactNode;
  /** Toned background band for section rhythm (V19). */
  band?: SectionBand;
  /** Drop the top hairline (first section under the nav). */
  flush?: boolean;
  id?: string;
  /** Heading level for `title`. Use "h1" for a Section-led page's top header (one h1/page). */
  as?: "h1" | "h2";
  children?: ReactNode;
}

/**
 * Section — a semantic page section with optional eyebrow, heading, lede, band, and flush-edge
 * treatments. Recipe primitive (ADR-0099); purely presentational (no Radix), server-safe.
 *   3. Variants as `data-*`: `data-flush` (boolean) drops the hairline, `data-band` tones the
 *      background — styled by attribute selectors, no variant logic in JS.
 *   4. `forwardRef` onto the single `<section>` root; BEM block name `cs-section`.
 * The `.cs-section` shell + its `data-*` variants are a shared layout primitive in base.css (Hero +
 * pages reuse it); the type/layout classes (`cs-container` / `cs-eyebrow` / `cs-section-title` /
 * `cs-lede`) likewise live in base.css. This component owns no co-located CSS — it is composition.
 *
 * @a11y The caller selects the heading level through `as`; the wrapper remains a native `section`.
 */
export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  { eyebrow, title, lede, band, flush, id, as = "h2", children },
  ref,
) {
  const Heading = as;
  return (
    <section
      ref={ref}
      className="cs-section"
      id={id}
      data-flush={flush ? "" : undefined}
      data-band={band}
    >
      <div className="cs-container">
        {eyebrow && <span className="cs-eyebrow">{eyebrow}</span>}
        {title && <Heading className="cs-section-title">{title}</Heading>}
        {lede && <p className="cs-lede">{lede}</p>}
        {children}
      </div>
    </section>
  );
});
