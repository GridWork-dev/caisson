export { applyTheme, themeToCssText, themeToCssVars } from "./apply-theme.ts";
export type { ApplyThemeOptions } from "./apply-theme.ts";
export { createTheme } from "./create-theme.ts";
export type { CreateThemeOptions } from "./create-theme.ts";
export {
  DEFAULT_PRESET_ID,
  getPreset,
  listPresets,
  registerPreset,
} from "./presets.ts";
export { themeOverridesSchema, themePresetSchema } from "./types.ts";
export type { Theme, ThemeOverrides, ThemePreset } from "./types.ts";
