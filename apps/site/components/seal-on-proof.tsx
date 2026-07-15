"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import styles from "./seal.module.css";

// Seal on Proof (ADR-0334 moment 1, dep-free) — "the WORM lock engaging."
//
// Two pieces, both site-local and additive-only (content is NEVER hidden pre-seal; the
// animation is a one-shot draw + spring-overshoot settle layered onto already-visible chips):
//
//   <SealOnProof>  — wraps a ProofChips row; on first scroll-into-view it stamps `data-sealed`
//                    and the module CSS dash-draws each chip's check glyph with a bounded
//                    stagger while the chip settles via the --cs-ease-spring-settle linear()
//                    token. Reveal-once IntersectionObserver, same contract as the kit Reveal.
//   <SealBadge>    — the hairline seal ring + check that draws itself on MOUNT (used by the
//                    license-token copy confirm; keyframes run on insertion, no observer).
//
// Reduced-motion: the module CSS gates every animation behind (prefers-reduced-motion:
// no-preference) — glyphs render complete, no draw, no overshoot (ADR-0334 §6).

export function SealOnProof({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sealed, setSealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSealed(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSealed(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const cls = className ? `${styles.seal} ${className}` : styles.seal;
  return (
    <div
      ref={ref}
      className={cls}
      style={style}
      data-sealed={sealed ? "" : undefined}
    >
      {children}
    </div>
  );
}

/** Hairline seal ring + check, drawing itself once on mount (~700ms total). Decorative. */
export function SealBadge() {
  return (
    <svg
      className={styles.badge}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className={styles.badgeRing}
        cx="12"
        cy="12"
        r="10"
        pathLength={1}
      />
      <path
        className={styles.badgeCheck}
        d="M8 12.5l2.6 2.6L16.5 9"
        pathLength={1}
      />
    </svg>
  );
}
