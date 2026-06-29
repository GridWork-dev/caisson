/**
 * Non-colour foundation: type scale, weights, line-height, tracking, spacing, radius.
 * Font *families* live per-candidate in `candidates.ts` (the type fork); the locked
 * default family is re-exported from `theme.ts`.
 */

export const foundation = {
  /** Modular type scale, ratio ~1.25. rem. */
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.5rem",
    "5xl": "3.25rem",
    /** Display ceiling — clamp max ≤ 6rem (impeccable). */
    display: "clamp(2.75rem, 1.5rem + 4vw, 5.5rem)",
  },
  fontWeight: {
    /** Body weight — bumped to 400 (ADR-0078 §8): 350 risked thin low-contrast body on dark. */
    body: 400,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.6,
    relaxed: 1.75,
  },
  letterSpacing: {
    /** Display tracking floor ≥ -0.04em (impeccable). */
    tighter: "-0.04em",
    tight: "-0.02em",
    normal: "0em",
    wide: "0.02em",
  },
  /** 4px base. rem. */
  space: {
    0: "0",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
    20: "5rem",
    24: "6rem",
  },
  radius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    pill: "999px",
  },
  /**
   * The ONE rem breakpoint ladder (ADR-0100 F4). Single source of truth for every `@media`
   * width: the breakpoint guard (ADR-0101) rejects any width not on this ladder, because media
   * queries can't read CSS vars. Authored in rem so the breakpoints track the root font size.
   * NOT emitted as CSS vars (a media-query condition can't consume them) — TS-only, read by
   * the guard + by component TS that needs a numeric breakpoint.
   */
  breakpoint: {
    xs: "30rem",
    sm: "40rem",
    md: "48rem",
    lg: "60rem",
    xl: "72rem",
    "2xl": "90rem",
  },
  /**
   * Expressive tokenized motion (ADR-0078 §6). transform/opacity-first; exit ~20% faster than
   * enter; authored curves, never the default `ease`. Honor `prefers-reduced-motion` at use sites.
   */
  motion: {
    duration: { fast: "120ms", base: "180ms", slow: "240ms" },
    ease: {
      /** Standard enter/UI transitions. */
      out: "cubic-bezier(0, 0, 0.2, 1)",
      /** Scroll-reveal / hero — a softer settle. */
      reveal: "cubic-bezier(0.23, 1, 0.32, 1)",
    },
  },
  /**
   * Elevation scale (ADR-0078 §7, supersedes ADR-0042's never-shadows rule). Dark-tuned: pure
   * black at low alpha so cards/overlays/the hero focal point read as raised, not glowing.
   * Tonal surface + hairline stays the DEFAULT; shadow is the deliberate elevation step.
   */
  elevation: {
    sm: "0 1px 2px oklch(0 0 0 / 0.30), 0 1px 1px oklch(0 0 0 / 0.18)",
    md: "0 4px 14px oklch(0 0 0 / 0.38), 0 2px 5px oklch(0 0 0 / 0.24)",
    lg: "0 18px 48px oklch(0 0 0 / 0.50), 0 6px 14px oklch(0 0 0 / 0.32)",
  },
} as const;

export type Foundation = typeof foundation;
