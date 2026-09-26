/**
 * Pure WCAG contrast checker — extracted from `@caisson-sh/ui`'s own contrast-gate test so a doctor
 * or verify surface runs the exact same check against the exact same thresholds as the kit's CI
 * gate, instead of a second hand-copied implementation drifting out of sync with it. The theme and
 * functional-token objects are passed in by the caller (no `@caisson-sh/ui` runtime dependency) — any
 * theme shaped like this, including an adopter's own customized one, can be checked.
 */
import { clampRgb, formatHex, parse, toGamut, wcagContrast } from "culori";

/** Structurally the same key set as `@caisson-sh/ui`'s `SemanticTheme`. Declared locally (not
 *  imported) so this package carries no `@caisson-sh/ui` runtime dependency. */
export type ContrastThemeKey =
  | "bg"
  | "surface1"
  | "surface2"
  | "border"
  | "borderStrong"
  | "fg"
  | "fgMuted"
  | "accent"
  | "accentHover"
  | "onAccent"
  | "accentTint"
  | "focus"
  | "link"
  | "glowAccent"
  | "scrim";
/** Every value an OKLCH (or any CSS-parseable) color string. */
export type ContrastTheme = Record<ContrastThemeKey, string>;

export type FunctionalKey = "success" | "warning" | "danger" | "info";
/** Structurally the same shape as `@caisson-sh/ui`'s `FunctionalTokens`. */
export type ContrastFunctional = Record<FunctionalKey, string>;

export type CodeTokenKey = "codeString" | "codeKeyword";
/** Structurally the same shape as `@caisson-sh/ui`'s `CodeTokens`. */
export type ContrastCode = Record<CodeTokenKey, string>;

export interface ContrastViolation {
  mode: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  use: string;
}

interface Pair {
  fg: ContrastThemeKey;
  bg: ContrastThemeKey;
  min: number;
  use: string;
}

// Mirrors the pairs the kit's own gate asserts (packages/ui/src/tokens-contrast.test.ts), kept in
// exact parity so this lib and that gate can never silently drift apart. Thresholds: 4.5:1 for
// body/secondary text; the small-text roles (eyebrow, accent-as-heading) also hold 4.5, not the
// 3.0 large-text floor. Alpha/shadow tokens (scrim, glowAccent) are excluded — they are veils, not
// text/surface pairs.
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
  { fg: "accent", bg: "bg", min: 4.5, use: "eyebrow / accent text on page" },
  { fg: "accent", bg: "surface1", min: 4.5, use: "accent text on card" },
  {
    fg: "accent",
    bg: "accentTint",
    min: 4.5,
    use: "eyebrow on accent-tint band",
  },
];

// Functional/status tokens render as a status-chip label or an inline code highlight — small text
// on the surface ramp, so 4.5:1 against every surface they can appear on. These sit outside the
// semantic theme, so the PAIRS matrix above never reaches them.
const FUNCTIONAL_KEYS: readonly FunctionalKey[] = [
  "success",
  "warning",
  "danger",
  "info",
];
const FUNCTIONAL_SURFACES: readonly ContrastThemeKey[] = [
  "bg",
  "surface1",
  "surface2",
];
const CODE_KEYS: readonly CodeTokenKey[] = ["codeString", "codeKeyword"];

const cssColor4ToGamut = toGamut("rgb", "oklch");

function renderedHex(
  color: string,
  mapper: "channel-clamp" | "css-color-4",
): string {
  const parsed = parse(color);
  if (parsed === undefined) throw new Error(`invalid CSS color: ${color}`);
  if (parsed.alpha !== undefined && parsed.alpha < 1)
    throw new Error(
      `checked contrast colors must be opaque; received ${color}`,
    );
  const rendered =
    mapper === "channel-clamp" ? clampRgb(parsed) : cssColor4ToGamut(parsed);
  const hex = formatHex(rendered);
  if (hex === undefined) throw new Error(`cannot render CSS color: ${color}`);
  return hex;
}

/**
 * Measure the stricter of the two browser gamut-mapping families Caisson supports. Raw OKLCH
 * contrast can pass while the painted sRGB color fails, so every matrix consumer shares this one
 * rendered-color calculation.
 */
export function renderedContrastRatio(fg: string, bg: string): number {
  return Math.min(
    wcagContrast(
      renderedHex(fg, "channel-clamp"),
      renderedHex(bg, "channel-clamp"),
    ),
    wcagContrast(
      renderedHex(fg, "css-color-4"),
      renderedHex(bg, "css-color-4"),
    ),
  );
}

function checkThemePairs(
  theme: ContrastTheme,
  mode: string,
): ContrastViolation[] {
  const out: ContrastViolation[] = [];
  for (const p of PAIRS) {
    const ratio = renderedContrastRatio(theme[p.fg], theme[p.bg]);
    // `!(ratio >= min)`, not `ratio < min`: a NaN ratio makes every comparison false, so the
    // `<` spelling passes an unmeasurable pair as compliant. renderedContrastRatio throws on
    // unparseable input today, which is the only reason this was unreachable — that is a
    // property of a collaborator, not of this check.
    if (!(ratio >= p.min))
      out.push({ mode, fg: p.fg, bg: p.bg, ratio, min: p.min, use: p.use });
  }
  return out;
}

function checkFunctionalPairs(
  theme: ContrastTheme,
  fn: ContrastFunctional,
  mode: string,
): ContrastViolation[] {
  const out: ContrastViolation[] = [];
  for (const k of FUNCTIONAL_KEYS) {
    for (const s of FUNCTIONAL_SURFACES) {
      const ratio = renderedContrastRatio(fn[k], theme[s]);
      if (!(ratio >= 4.5))
        out.push({
          mode,
          fg: k,
          bg: s,
          ratio,
          min: 4.5,
          use: "status text / code token",
        });
    }
  }
  return out;
}

function checkCodePairs(
  theme: ContrastTheme,
  code: ContrastCode,
  mode: string,
): ContrastViolation[] {
  const out: ContrastViolation[] = [];
  for (const key of CODE_KEYS) {
    for (const surface of FUNCTIONAL_SURFACES) {
      const ratio = renderedContrastRatio(code[key], theme[surface]);
      if (!(ratio >= 4.5))
        out.push({
          mode,
          fg: key,
          bg: surface,
          ratio,
          min: 4.5,
          use: "code-syntax token",
        });
    }
  }
  return out;
}

/** Run the full WCAG contrast matrix (semantic fg/bg pairs + functional/status tokens) for one
 *  theme mode. `mode` is a caller-chosen label (e.g. `"dark"`/`"light"`) echoed onto each
 *  violation, not otherwise interpreted. `code` is optional for backward compatibility with
 *  callers that only own the semantic + functional palette; when supplied, syntax-token contrast
 *  is checked against the same surface ramp. Returns every violation found — an empty array means
 *  the supplied palette is fully compliant. */
export function checkContrast(
  theme: ContrastTheme,
  fn: ContrastFunctional,
  mode: string,
  code?: ContrastCode,
): ContrastViolation[] {
  return [
    ...checkThemePairs(theme, mode),
    ...checkFunctionalPairs(theme, fn, mode),
    ...(code === undefined ? [] : checkCodePairs(theme, code, mode)),
  ];
}
