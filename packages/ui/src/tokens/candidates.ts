/**
 * Decision surfaces. The A/B/C palette directions + 1/2/3 type pairings render live in the
 * studio (`/design/foundations`, `/design/typography`). Operator picks → lock into `theme.ts`.
 * Mood anchor: a pressurized steel caisson in cold harbor water — wet dark steel, one instrument
 * light, holds under load. Strategy: Restrained (one accent ≤10%, semantic-first).
 */
import type {
  AccentCandidate,
  FunctionalTokens,
  TypeCandidate,
} from "./types.ts";

/** Functional/status set — per mode. The dark set inherits-down onto the near-white light surfaces
 *  and fails WCAG AA there, so light gets its own darkened set. Same across every palette; never
 *  colour-alone (always paired with a glyph + label). */
export const functionalDark: FunctionalTokens = {
  success: "oklch(0.72 0.15 150)",
  warning: "oklch(0.78 0.13 75)",
  danger: "oklch(0.65 0.18 25)",
  info: "oklch(0.70 0.12 240)",
};

/** Light-surface functional set — darkened so each clears WCAG AA (>=4.5:1) on bg/surface1/surface2
 *  (computed + asserted, ADR-0101 gate #2). The hue/chroma stay; only L drops for the light field. */
export const functionalLight: FunctionalTokens = {
  success: "oklch(0.50 0.15 150)",
  warning: "oklch(0.50 0.12 75)",
  danger: "oklch(0.50 0.19 25)",
  info: "oklch(0.50 0.13 240)",
};

/** @deprecated back-compat alias = the dark set (the un-attributed :root default). */
export const functional = functionalDark;

export const accentCandidates: readonly AccentCandidate[] = [
  {
    id: "a",
    name: "Caisson · cold-steel teal",
    blurb:
      "Accent hue ~205, cold harbor water as the single instrument light. Tightest fit to the name, the mood, and the market gap (off the saturated-green devtool crowd).",
    recommended: true,
    dark: {
      bg: "oklch(0.16 0.012 220)",
      surface1: "oklch(0.20 0.013 220)",
      surface2: "oklch(0.25 0.014 220)",
      border: "oklch(0.32 0.012 220)",
      borderStrong: "oklch(0.42 0.012 220)",
      fg: "oklch(0.96 0.004 220)",
      fgMuted: "oklch(0.72 0.012 220)",
      accent: "oklch(0.74 0.115 205)",
      accentHover: "oklch(0.80 0.105 205)",
      onAccent: "oklch(0.17 0.02 220)",
      accentTint: "oklch(0.26 0.040 205)",
      focus: "oklch(0.74 0.115 205)",
      link: "oklch(0.78 0.10 205)",
      glowAccent:
        "0 0 0 1px oklch(0.74 0.115 205 / 0.40), 0 0 28px oklch(0.74 0.115 205 / 0.22)",
      scrim: "oklch(0.1 0.012 220 / 0.6)",
    },
    light: {
      bg: "oklch(0.99 0.003 220)",
      surface1: "oklch(0.975 0.005 220)",
      surface2: "oklch(0.95 0.006 220)",
      border: "oklch(0.88 0.008 220)",
      borderStrong: "oklch(0.80 0.010 220)",
      fg: "oklch(0.22 0.015 220)",
      fgMuted: "oklch(0.45 0.018 220)",
      accent: "oklch(0.50 0.13 215)",
      accentHover: "oklch(0.48 0.13 215)",
      onAccent: "oklch(0.99 0.01 220)",
      accentTint: "oklch(0.93 0.03 205)",
      focus: "oklch(0.50 0.13 215)",
      link: "oklch(0.50 0.13 215)",
      glowAccent:
        "0 0 0 1px oklch(0.50 0.13 215 / 0.28), 0 0 22px oklch(0.50 0.13 215 / 0.16)",
      scrim: "oklch(0.22 0.015 220 / 0.45)",
    },
  },
  {
    id: "b",
    name: "Pressure · deep moss",
    blurb:
      "impeccable seed-182. Accent hue ~150, a deep cultivated green (wet stone under shadow), not neon, keeping the 'all checks pass' adjacency without the bright-green reflex.",
    recommended: false,
    dark: {
      bg: "oklch(0.16 0.012 160)",
      surface1: "oklch(0.20 0.013 160)",
      surface2: "oklch(0.25 0.014 160)",
      border: "oklch(0.32 0.012 160)",
      borderStrong: "oklch(0.42 0.012 160)",
      fg: "oklch(0.96 0.004 160)",
      fgMuted: "oklch(0.72 0.012 160)",
      accent: "oklch(0.70 0.13 150)",
      accentHover: "oklch(0.76 0.12 150)",
      onAccent: "oklch(0.16 0.02 160)",
      accentTint: "oklch(0.26 0.045 150)",
      focus: "oklch(0.70 0.13 150)",
      link: "oklch(0.74 0.11 150)",
      glowAccent:
        "0 0 0 1px oklch(0.70 0.13 150 / 0.40), 0 0 28px oklch(0.70 0.13 150 / 0.22)",
      scrim: "oklch(0.1 0.012 160 / 0.6)",
    },
    light: {
      bg: "oklch(0.99 0.003 160)",
      surface1: "oklch(0.975 0.005 160)",
      surface2: "oklch(0.95 0.006 160)",
      border: "oklch(0.88 0.008 160)",
      borderStrong: "oklch(0.80 0.010 160)",
      fg: "oklch(0.22 0.015 160)",
      fgMuted: "oklch(0.45 0.018 160)",
      accent: "oklch(0.52 0.14 150)",
      accentHover: "oklch(0.46 0.14 150)",
      onAccent: "oklch(0.99 0.01 160)",
      accentTint: "oklch(0.93 0.035 150)",
      focus: "oklch(0.52 0.14 150)",
      link: "oklch(0.48 0.13 150)",
      glowAccent:
        "0 0 0 1px oklch(0.52 0.14 150 / 0.28), 0 0 22px oklch(0.52 0.14 150 / 0.16)",
      scrim: "oklch(0.22 0.015 160 / 0.45)",
    },
  },
  {
    id: "c",
    name: "Bulkhead · near-monochrome",
    blurb:
      "No chromatic brand accent; cool-steel neutrals (hue ~235), white-fill primary CTA, a single restrained steel signal reserved for focus. Maximum gravitas (Linear/Vercel). Risk: lower brand recall.",
    recommended: false,
    dark: {
      bg: "oklch(0.15 0.006 235)",
      surface1: "oklch(0.19 0.007 235)",
      surface2: "oklch(0.24 0.008 235)",
      border: "oklch(0.31 0.007 235)",
      borderStrong: "oklch(0.41 0.007 235)",
      fg: "oklch(0.96 0.003 235)",
      fgMuted: "oklch(0.71 0.008 235)",
      accent: "oklch(0.80 0.030 235)",
      accentHover: "oklch(0.86 0.028 235)",
      onAccent: "oklch(0.16 0.01 235)",
      accentTint: "oklch(0.25 0.018 235)",
      focus: "oklch(0.80 0.040 230)",
      link: "oklch(0.82 0.03 235)",
      glowAccent:
        "0 0 0 1px oklch(0.80 0.030 235 / 0.40), 0 0 28px oklch(0.80 0.030 235 / 0.20)",
      scrim: "oklch(0.09 0.006 235 / 0.6)",
    },
    light: {
      bg: "oklch(0.99 0.002 235)",
      surface1: "oklch(0.975 0.003 235)",
      surface2: "oklch(0.95 0.004 235)",
      border: "oklch(0.88 0.006 235)",
      borderStrong: "oklch(0.80 0.008 235)",
      fg: "oklch(0.20 0.010 235)",
      fgMuted: "oklch(0.44 0.012 235)",
      accent: "oklch(0.45 0.040 235)",
      accentHover: "oklch(0.38 0.040 235)",
      onAccent: "oklch(0.99 0.005 235)",
      accentTint: "oklch(0.93 0.015 235)",
      focus: "oklch(0.45 0.05 235)",
      link: "oklch(0.42 0.04 235)",
      glowAccent:
        "0 0 0 1px oklch(0.45 0.040 235 / 0.26), 0 0 22px oklch(0.45 0.040 235 / 0.14)",
      scrim: "oklch(0.2 0.01 235 / 0.45)",
    },
  },
];

export const typeCandidates: readonly TypeCandidate[] = [
  {
    id: "1",
    name: "Instrument",
    blurb:
      "Geist + Geist Mono: one family, two cuts, free (OFL); built for developer products. Dense, neutral, production-infra. Mono carries audit artifacts and token names.",
    recommended: false,
    sans: '"Geist", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono", ui-monospace, "SFMono-Regular", monospace',
  },
  {
    id: "2",
    name: "Structural",
    blurb:
      "Hubot Sans + Martian Mono: GitHub's engineered variable grotesk with more mechanical character; wide technical mono for labels. More ownable.",
    recommended: true,
    sans: '"Hubot Sans", ui-sans-serif, system-ui, sans-serif',
    mono: '"Martian Mono", ui-monospace, "SFMono-Regular", monospace',
  },
  {
    id: "3",
    name: "Field",
    blurb:
      "Hanken Grotesk + JetBrains Mono: humanist grotesk, warmer and field-proven in production. Slightly more approachable at the cost of mechanical edge.",
    recommended: false,
    sans: '"Hanken Grotesk", ui-sans-serif, system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", monospace',
  },
];
