/**
 * Runtime theme API types (ADR-0250 G2b) — the preset registry + composition surface layered on
 * top of the token contract. `SemanticTheme` (`../tokens/types.ts`) stays the single source of
 * truth for what a theme IS; this file adds registration + override validation on top of it.
 */
import { z } from "zod";
import type { SemanticTheme } from "../tokens/types.ts";

/** Every `SemanticTheme` value is a CSS colour/box-shadow string — non-empty, nothing else
 *  assumed (the token contract intentionally stays string-typed, not a parsed colour). */
const semanticThemeSchema = z
  .object({
    bg: z.string().min(1),
    surface1: z.string().min(1),
    surface2: z.string().min(1),
    border: z.string().min(1),
    borderStrong: z.string().min(1),
    fg: z.string().min(1),
    fgMuted: z.string().min(1),
    accent: z.string().min(1),
    accentHover: z.string().min(1),
    onAccent: z.string().min(1),
    accentTint: z.string().min(1),
    focus: z.string().min(1),
    link: z.string().min(1),
    glowAccent: z.string().min(1),
    scrim: z.string().min(1),
  })
  .strict();

/** A partial override layered on top of a registered preset's `dark`/`light` tokens. `.strict()`
 *  — an unrecognized key (a typo, a token that doesn't exist) throws instead of being ignored. */
const semanticThemeOverrideSchema = semanticThemeSchema.partial().strict();

export const themeOverridesSchema = z
  .object({
    dark: semanticThemeOverrideSchema.optional(),
    light: semanticThemeOverrideSchema.optional(),
  })
  .strict();

export const themePresetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    dark: semanticThemeSchema,
    light: semanticThemeSchema,
  })
  .strict();

export type ThemeOverrides = z.infer<typeof themeOverridesSchema>;
export type ThemePreset = z.infer<typeof themePresetSchema>;

/** A fully resolved theme: a preset id plus its (possibly overridden) `dark`/`light` token sets. */
export interface Theme {
  id: string;
  dark: SemanticTheme;
  light: SemanticTheme;
}
