/**
 * Token contract types. The TS objects ARE the source of truth; `gen-tokens-css.ts`
 * emits `styles/tokens.css` (--cs-* vars) from the locked default theme. Candidate
 * token sets are authored here for evaluation, then the chosen set is locked into `theme.ts`.
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

/**
 * Code-syntax colours (ADR-0374 Decision 2) — a dedicated per-mode scale for automatic token
 * highlighting, decoupled from the status vocabulary so a hand-wrapped `.cs-tok-*` callout never
 * shares a hue with an ambient string literal. Per-mode like `FunctionalTokens` (the dark set fails
 * AA on light surfaces), emitted into each theme block by the generator, NOT part of `SemanticTheme`
 * (not a runtime-overridable role). The docs/glossary Shiki themes bake the gamut-mapped sRGB hex of
 * these OKLCH values; everything else in a sample renders in `--cs-fg`, comments in `--cs-fg-muted`.
 */
export interface CodeTokens {
  /** string literals + attribute values */
  codeString: string;
  /** keyword / keyword.control / storage */
  codeKeyword: string;
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
