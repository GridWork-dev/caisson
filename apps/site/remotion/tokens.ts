// Design tokens for Remotion compositions (ADR-0263) — copied verbatim from
// packages/ui/styles/tokens.css / packages/ui/src/tokens/foundation.ts. Remotion renders through
// its own webpack bundle, entirely outside the Next app's CSS pipeline, so there is no shared
// runtime `--cs-*` custom property to read here; this is the deliberate duplication point. Chrome
// Headless (Remotion's render browser) supports oklch() natively, so the color strings are
// copied as-is, never converted. Keep in sync by hand if the source tokens change.

/** Dark-palette semantic colors — packages/ui/styles/tokens.css `:root, [data-theme="dark"]`. */
export const color = {
  bg: "oklch(0.16 0.012 220)",
  surface1: "oklch(0.20 0.013 220)",
  surface2: "oklch(0.25 0.014 220)",
  border: "oklch(0.32 0.012 220)",
  borderStrong: "oklch(0.42 0.012 220)",
  fg: "oklch(0.96 0.004 220)",
  fgMuted: "oklch(0.72 0.012 220)",
  accent: "oklch(0.74 0.115 205)",
  accentTint: "oklch(0.26 0.040 205)",
  success: "oklch(0.72 0.15 150)",
  danger: "oklch(0.65 0.18 25)",
} as const;

/** The token's own fallback stacks (--cs-font-sans/--cs-font-mono) — the named webfonts are not
 *  loaded into the Remotion bundle (no @remotion/google-fonts dependency added for a pilot), so
 *  this renders on the same system-font fallback the token itself defines for that case. */
export const font = {
  sans: '"Hubot Sans", ui-sans-serif, system-ui, sans-serif',
  mono: '"Martian Mono", ui-monospace, "SFMono-Regular", monospace',
} as const;

export const radius = {
  lg: 12,
  xl: 16,
  pill: 999,
} as const;
