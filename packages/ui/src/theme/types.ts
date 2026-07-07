/**
 * Runtime theme API types (ADR-0250 G2b) — the preset registry + composition surface layered on
 * top of the token contract. `SemanticTheme` (`../tokens/types.ts`) stays the single source of
 * truth for what a theme IS; this file adds registration + override validation on top of it.
 */
import { z } from "zod";
import type { SemanticTheme } from "../tokens/types.ts";

/**
 * A single token value: a CSS colour/box-shadow string, non-empty, with the CSS-injection chars
 * denied. These values are interpolated RAW into a `<style>` block by `applyTheme`, so a value
 * containing `}` (or `<`/`>`/`;`) could break out of its rule and inject arbitrary CSS. No legit
 * OKLCH colour or box-shadow value needs any of `{ } < > ;` (commas, parens, slashes, spaces,
 * digits, dots all pass). Bounding it here covers BOTH registerPreset and createTheme overrides,
 * since the override schema derives from this one.
 */
const tokenValue = z
  .string()
  .min(1)
  .regex(/^[^{}<>;]*$/, "token value must not contain any of: { } < > ;");

const semanticThemeSchema = z
  .object({
    bg: tokenValue,
    surface1: tokenValue,
    surface2: tokenValue,
    border: tokenValue,
    borderStrong: tokenValue,
    fg: tokenValue,
    fgMuted: tokenValue,
    accent: tokenValue,
    accentHover: tokenValue,
    onAccent: tokenValue,
    accentTint: tokenValue,
    focus: tokenValue,
    link: tokenValue,
    glowAccent: tokenValue,
    scrim: tokenValue,
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
