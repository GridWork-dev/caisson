/**
 * `createTheme` — compose a resolved `{ dark, light }` theme from a registered preset id plus an
 * optional per-mode token override. The entry point adopters use to select/extend a preset at
 * runtime (ADR-0250 G2b).
 */
import { DEFAULT_PRESET_ID, getPreset, listPresets } from "./presets.ts";
import { themeOverridesSchema } from "./types.ts";
import type { Theme, ThemeOverrides } from "./types.ts";
import type { SemanticTheme } from "../tokens/types.ts";

// A plain `{ ...base, ...override }` spread widens every property to `T[K] | undefined` here
// (override is a Partial<SemanticTheme>, TS can't see its keys are always-present-when-set), which
// then fails to satisfy the always-required SemanticTheme shape. Merge key-by-key instead, only
// overwriting where the override actually supplies a value.
function mergeMode(
  base: SemanticTheme,
  override: ThemeOverrides["dark"],
): SemanticTheme {
  if (!override) return base;
  const merged: SemanticTheme = { ...base };
  for (const key of Object.keys(override) as (keyof SemanticTheme)[]) {
    const value = override[key];
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

export interface CreateThemeOptions {
  /** A registered preset id (built-in: `"caisson"` | `"pressure"` | `"bulkhead"`, or a custom id
   *  passed to `registerPreset` first). Defaults to the locked `"caisson"` default. */
  preset?: string;
  /** Per-mode token overrides layered on top of the preset. Validated `.strict()` — an unknown
   *  key or an empty-string value throws. */
  overrides?: ThemeOverrides;
}

export function createTheme(options: CreateThemeOptions = {}): Theme {
  const presetId = options.preset ?? DEFAULT_PRESET_ID;
  const preset = getPreset(presetId);
  if (!preset) {
    const known = listPresets()
      .map((p) => p.id)
      .join(", ");
    throw new Error(
      `Unknown theme preset "${presetId}" — registerPreset() it first, or pick one of: ${known}.`,
    );
  }
  const overrides = options.overrides
    ? themeOverridesSchema.parse(options.overrides)
    : undefined;
  return {
    id: preset.id,
    dark: mergeMode(preset.dark, overrides?.dark),
    light: mergeMode(preset.light, overrides?.light),
  };
}
