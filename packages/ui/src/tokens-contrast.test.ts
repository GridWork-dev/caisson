import { describe, expect, test } from "bun:test";
import { formatHex, parse, toGamut, wcagContrast } from "culori";

/**
 * Browser-equivalent contrast (visual-audit): our tokens are authored in OKLCH, but a browser
 * gamut-maps every out-of-sRGB OKLCH into the display gamut before painting — and the clamped
 * colour has a different luminance than the ideal OKLCH. Computing `wcagContrast` on the raw OKLCH
 * string therefore checks a colour the user never sees; a value can pass the gate at 4.6:1 raw and
 * render at 4.4:1. Map each token to its sRGB hex first (culori `toGamut`, the same chroma-reducing
 * clamp browsers use) so the gate asserts what actually ships.
 */
const gamutHex = (c: string) => formatHex(toGamut("rgb", "oklch")(parse(c)!));
const contrast = (fg: string, bg: string) =>
  wcagContrast(gamutHex(fg), gamutHex(bg));

import {
  darkTheme,
  functionalDark,
  functionalLight,
  lightTheme,
} from "./tokens/index";
import type { FunctionalTokens, SemanticTheme } from "./tokens/index";

/**
 * WCAG contrast matrix — ADR-0101 gate #2 (the deterministic design-quality gate that REPLACES the
 * hand-transcribed, drifted contrast spot-checks in apps/site + the since-removed apps/studio). Pairs are derived from
 * the live token objects (not copied hex), so a palette edit is checked automatically in BOTH modes.
 *
 * Thresholds follow the USE: body / secondary text → 4.5:1; large text & non-text UI (eyebrow, the
 * accent-as-heading, focus affordance) → 3.0:1. Alpha/shadow tokens (scrim, glowAccent) are excluded
 * — they are veils, not text/surface pairs.
 */
type Pair = {
  fg: keyof SemanticTheme;
  bg: keyof SemanticTheme;
  min: number;
  use: string;
};

const PAIRS: readonly Pair[] = [
  { fg: "fg", bg: "bg", min: 4.5, use: "body on page" },
  { fg: "fg", bg: "surface1", min: 4.5, use: "body on card" },
  { fg: "fg", bg: "surface2", min: 4.5, use: "body on raised surface" },
  { fg: "fgMuted", bg: "bg", min: 4.5, use: "secondary text on page" },
  { fg: "fgMuted", bg: "surface1", min: 4.5, use: "secondary text on card" },
  { fg: "link", bg: "bg", min: 4.5, use: "link on page" },
  { fg: "link", bg: "surface1", min: 4.5, use: "link on card" },
  { fg: "onAccent", bg: "accent", min: 4.5, use: "primary-button label" },
  { fg: "fg", bg: "accentTint", min: 4.5, use: "body on accent-tint card" },
  // The accent renders as the mono eyebrow + accent StatusChip label — SMALL text, so 4.5, not the
  // 3.0 large-text threshold (the prior 3.0 let the light accent slip through at ~4.1:1).
  { fg: "accent", bg: "bg", min: 4.5, use: "eyebrow / accent text on page" },
  { fg: "accent", bg: "surface1", min: 4.5, use: "accent text on card" },
  {
    fg: "accent",
    bg: "accentTint",
    min: 4.5,
    use: "eyebrow on accent-tint band",
  },
];

// Functional/status tokens render as the StatusChip label + the cs-tok-* code highlights — small
// text on the surface ramp, so 4.5:1 in BOTH modes. These live OUTSIDE SemanticTheme, so the
// SemanticTheme matrix above never reached them — the gap that shipped a 2.19:1 success chip on
// light. Per-mode functional sets close it.
const FN_KEYS: ReadonlyArray<keyof FunctionalTokens> = [
  "success",
  "warning",
  "danger",
  "info",
];
const FN_SURFACES: ReadonlyArray<keyof SemanticTheme> = [
  "bg",
  "surface1",
  "surface2",
];

function checkTheme(theme: SemanticTheme, mode: string) {
  for (const p of PAIRS) {
    test(`${mode}: ${p.fg} on ${p.bg} (${p.use}) ≥ ${p.min.toFixed(1)}:1`, () => {
      const ratio = contrast(theme[p.fg], theme[p.bg]);
      expect(ratio).toBeGreaterThanOrEqual(p.min);
    });
  }
}

function checkFunctional(
  theme: SemanticTheme,
  fn: FunctionalTokens,
  mode: string,
) {
  for (const k of FN_KEYS) {
    for (const s of FN_SURFACES) {
      test(`${mode}: ${k} on ${s} (status text / code token) ≥ 4.5:1`, () => {
        expect(contrast(fn[k], theme[s])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
}

describe("WCAG contrast matrix — both modes (ADR-0101 gate #2)", () => {
  checkTheme(darkTheme, "dark");
  checkTheme(lightTheme, "light");
  checkFunctional(darkTheme, functionalDark, "dark");
  checkFunctional(lightTheme, functionalLight, "light");
});
