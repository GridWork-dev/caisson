/**
 * Shared `--cs-*` CSS custom-property mapping for `SemanticTheme`. Single source of truth for the
 * camelCase token key -> kebab-case CSS var suffix mapping, consumed by both the build-time
 * generator (`scripts/gen-tokens-css.ts`, the locked default) and the runtime theme API
 * (`../theme/apply-theme.ts`, presets + overrides) so the two can never drift apart.
 */
import type { SemanticTheme } from "./types.ts";

export const SEMANTIC_VAR_NAMES: ReadonlyArray<
  readonly [keyof SemanticTheme, string]
> = [
  ["bg", "bg"],
  ["surface1", "surface-1"],
  ["surface2", "surface-2"],
  ["border", "border"],
  ["borderStrong", "border-strong"],
  ["fg", "fg"],
  ["fgMuted", "fg-muted"],
  ["accent", "accent"],
  ["accentHover", "accent-hover"],
  ["onAccent", "on-accent"],
  ["accentTint", "accent-tint"],
  ["focus", "focus"],
  ["link", "link"],
  ["glowAccent", "glow-accent"],
  ["scrim", "scrim"],
];

/** `SemanticTheme` -> `{ "--cs-bg": "oklch(...)", ... }`. Pure, SSR-safe. */
export function semanticThemeToCssVars(
  theme: SemanticTheme,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, suffix] of SEMANTIC_VAR_NAMES)
    out[`--cs-${suffix}`] = theme[key];
  return out;
}

/** The same vars as declaration lines (`  --cs-bg: oklch(...);`), `indent` spaces each — the
 *  block shape both the build-time generator and the runtime `<style>` override emit. */
export function semanticCssLines(theme: SemanticTheme, indent = 2): string[] {
  const pad = " ".repeat(indent);
  return SEMANTIC_VAR_NAMES.map(
    ([key, suffix]) => `${pad}--cs-${suffix}: ${theme[key]};`,
  );
}
