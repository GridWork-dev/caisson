// Self-hosted brand fonts (ADR-0079 §4): next/font/google downloads + self-hosts the woff2 at
// build time, so there is NO render-blocking Google Fonts <link> at runtime and the CSP font-src
// stays 'self'. Each font sets a CSS variable consumed by the @caisson/ui token stacks
// (`var(--font-sans, …)` etc. in packages/ui theme.ts). All three are variable fonts → no weight
// array (the full axis is available via font-weight).
import { Hubot_Sans, JetBrains_Mono, Martian_Mono } from "next/font/google";

// Display + body (ADR-0042 type "Structural").
export const fontSans = Hubot_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

// Brand surface — wordmark, eyebrows, labels, control-IDs, tabular numerals (ADR-0078 §1).
export const fontMono = Martian_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

// Multi-line code blocks only — narrower than Martian for read-critical code (ADR-0078 §1).
export const fontMonoCode = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-code",
});

/** Apply to <html> so the three `--font-*` variables resolve for the whole document. */
export const fontVariables = [
  fontSans.variable,
  fontMono.variable,
  fontMonoCode.variable,
].join(" ");
