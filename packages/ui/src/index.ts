// Runtime-safe entry: the typed token contract only. The vanilla-extract binding lives at
// "@stack/ui/theme.css" so importing @stack/ui never runs the VE adapter.
export { light, dark, themes } from "./tokens.ts";
export type { TokenScale, ThemeName } from "./tokens.ts";
