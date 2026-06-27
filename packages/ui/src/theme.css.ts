// vanilla-extract binding of the token contract (spec 03). Consumed by app bundlers via the
// "@stack/ui/theme.css" export — NOT from the package's main entry, so importing @stack/ui at
// runtime never triggers the VE adapter. `vars` is the typed contract every edition app themes
// against; `darkTheme`/`lightTheme` are the class names that bind concrete values.
import { createTheme, createThemeContract } from "@vanilla-extract/css";
import { dark, light } from "./tokens.ts";

export const vars = createThemeContract({
  color: {
    bg: null,
    surface: null,
    fg: null,
    muted: null,
    accent: null,
    border: null,
    danger: null,
    success: null,
  },
  space: { xs: null, sm: null, md: null, lg: null, xl: null },
  radius: { sm: null, md: null, lg: null },
  font: { sans: null, mono: null },
  elevation: { low: null, high: null },
});

export const darkTheme = createTheme(vars, dark);
export const lightTheme = createTheme(vars, light);
