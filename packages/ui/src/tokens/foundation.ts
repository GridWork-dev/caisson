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
    /** Body weight on dark surfaces — light type reads heavier, so step below 400. */
    body: 350,
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
} as const;

export type Foundation = typeof foundation;
