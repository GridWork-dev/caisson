// Self-hosted brand fonts (ADR-0079 §4) — the same two faces apps/site loads, for the same
// reason: next/font/google downloads and self-hosts the woff2 at build time, so there is NO
// render-blocking Google Fonts <link> at runtime and the CSP font-src stays 'self'. Each font
// sets a CSS variable the @caisson-sh/ui token stacks consume (`var(--font-sans, …)` in packages/ui
// theme.ts). An embed that fell back to a system stack would read as a foreign panel inside the
// site page it is framed in, so this file is a deliberate mirror of apps/site/lib/fonts.ts rather
// than a shared import — the two apps have no runtime coupling and neither should acquire one.
// Both are variable fonts → no weight array (the full axis is available via font-weight).
import type { CSSProperties } from "react";
import { Hubot_Sans, Martian_Mono } from "next/font/google";

// Display + body (ADR-0042 type "Structural").
export const fontSans = Hubot_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

// Brand surface — eyebrows, labels, control-IDs, tabular numerals (ADR-0078 §1). Every poke's
// byte strips, verdict lines and trust line render in this face.
export const fontMono = Martian_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

/** Apply to <html> so the two `--font-*` variables resolve for the whole document. */
export const fontVariables = [fontSans.variable, fontMono.variable].join(" ");

/** Inline-styled on <html> alongside `fontVariables`: re-declares `--font-sans` with the
 *  "Mona Zero" U+0030 patch face (global.css @font-face) in front of Hubot's real stack, so
 *  every sans "0" renders as a plain oval instead of Hubot's barred zero (which reads as Θ in
 *  prose). Inline style wins over the next/font variable class that sets the unpatched stack. */
export const fontSansZeroPatch = {
  "--font-sans": `"Mona Zero", ${fontSans.style.fontFamily}`,
} as CSSProperties;
