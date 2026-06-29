import { forwardRef } from "react";
import type { ReactNode } from "react";

import "./hero.css";

export interface HeroProps {
  eyebrow: string;
  title: string;
  lede: ReactNode;
  ctas?: ReactNode;
  credentials?: ReactNode;
  /** The framed evidence artifact filling the right half (a `<Terminal/>`). */
  artifact?: ReactNode;
}

/**
 * Hero — the split marketing header (V1). Recipe primitive (ADR-0097):
 *   1. Purely presentational → no Radix, no framework import; server-safe (no hooks/handlers).
 *   2. Co-located plain CSS (`hero.css`) reading only `var(--cs-*)`.
 *   3. Layout + spacing live in CSS classes — every former inline `style={{…}}` is now a
 *      co-located class (`cs-hero__title` / `cs-hero__lede` / `cs-hero__credentials`).
 *   4. `forwardRef` onto the single `<section>` root; BEM block `cs-hero`.
 *
 * The `cs-section` shell (+ `data-flush` for the flush top) and the `cs-display` / `cs-eyebrow` /
 * `cs-lede` / `cs-container` utilities are shared layout primitives in base.css — kept by className
 * here, their hero-specific spacing layered on via the `cs-hero__*` classes.
 */
export const Hero = forwardRef<HTMLElement, HeroProps>(function Hero(
  { eyebrow, title, lede, ctas, credentials, artifact },
  ref,
) {
  return (
    <section ref={ref} className="cs-section" data-flush="">
      <div className="cs-container cs-hero">
        <div className="cs-hero__lead">
          <span className="cs-eyebrow">{eyebrow}</span>
          <h1 className="cs-display cs-hero__title">{title}</h1>
          <p className="cs-lede cs-hero__lede">{lede}</p>
          {ctas && <div className="cs-cta-row">{ctas}</div>}
          {credentials && (
            <div className="cs-hero__credentials">{credentials}</div>
          )}
        </div>
        {artifact && <div className="cs-hero__artifact">{artifact}</div>}
      </div>
    </section>
  );
});
