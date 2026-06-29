/**
 * Token contract types. The TS objects ARE the source of truth; `gen-tokens-css.ts`
 * emits `styles/tokens.css` (--cs-* vars) from the locked default theme. Candidate
 * sets render live in the studio for the operator to pick, then lock into `theme.ts`.
 */

/** Semantic colour roles. One set per mode (dark / light). All values are OKLCH strings. */
export interface SemanticTheme {
  bg: string;
  surface1: string;
  surface2: string;
  border: string;
  borderStrong: string;
  fg: string;
  fgMuted: string;
  accent: string;
  accentHover: string;
  onAccent: string;
  accentTint: string;
  focus: string;
  link: string;
  /** Accent instrument-glow box-shadow (ADR-0078 §7) — per-theme so it tracks the accent. */
  glowAccent: string;
  /**
   * Modal/drawer/sheet backdrop scrim (ADR-0100 F4) — a translucent fill that sits under an
   * overlay and above every surface. Per-theme + hue-tinted (no pure black, DESIGN.md). Excluded
   * from the contrast matrix (it's an alpha veil, not a text/surface pair).
   */
  scrim: string;
}

/** Functional status colours — shared across candidates. Never used color-alone (pair glyph + label). */
export interface FunctionalTokens {
  success: string;
  warning: string;
  danger: string;
  info: string;
}

/** A palette direction shown in `/design/foundations`. */
export interface AccentCandidate {
  id: "a" | "b" | "c";
  name: string;
  blurb: string;
  recommended: boolean;
  dark: SemanticTheme;
  light: SemanticTheme;
}

/** A type pairing shown in `/design/typography`. */
export interface TypeCandidate {
  id: "1" | "2" | "3";
  name: string;
  blurb: string;
  recommended: boolean;
  /** CSS font-family stacks. */
  sans: string;
  mono: string;
}
