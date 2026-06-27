// The typed design-token contract (spec 03) — a dark-first, pro-tool token set (← tessera's
// "Pigment" floor). This plain-TS object is the source of truth; `theme.css.ts` binds it to
// vanilla-extract for app bundlers. `light` and `dark` share an identical shape (the contract):
// re-skinning = swapping token values, never forking components.

export interface TokenScale {
  color: {
    bg: string;
    surface: string;
    fg: string;
    muted: string;
    accent: string;
    border: string;
    danger: string;
    success: string;
  };
  space: { xs: string; sm: string; md: string; lg: string; xl: string };
  radius: { sm: string; md: string; lg: string };
  font: { sans: string; mono: string };
  elevation: { low: string; high: string };
}

export type ThemeName = "light" | "dark";

const space: TokenScale["space"] = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "40px",
};
const radius: TokenScale["radius"] = { sm: "4px", md: "8px", lg: "14px" };
const font: TokenScale["font"] = {
  sans: 'ui-sans-serif, system-ui, "Inter", sans-serif',
  mono: 'ui-monospace, "JetBrains Mono", monospace',
};

export const dark: TokenScale = {
  color: {
    bg: "#0b0d10",
    surface: "#14171c",
    fg: "#e6e9ef",
    muted: "#8b94a3",
    accent: "#5b8cff",
    border: "#232830",
    danger: "#ff5d5d",
    success: "#3ddc84",
  },
  space,
  radius,
  font,
  elevation: {
    low: "0 1px 2px rgba(0,0,0,0.4)",
    high: "0 8px 30px rgba(0,0,0,0.6)",
  },
};

export const light: TokenScale = {
  color: {
    bg: "#ffffff",
    surface: "#f6f7f9",
    fg: "#0b0d10",
    muted: "#5b626d",
    accent: "#2f6bff",
    border: "#e2e5ea",
    danger: "#d23b3b",
    success: "#1c9c5b",
  },
  space,
  radius,
  font,
  elevation: {
    low: "0 1px 2px rgba(16,24,40,0.06)",
    high: "0 8px 30px rgba(16,24,40,0.12)",
  },
};

export const themes: Record<ThemeName, TokenScale> = { light, dark };
