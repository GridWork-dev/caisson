// Caisson's own Shiki themes (ADR-0374 Decision 2) — the docs (fumadocs-mdx) and the glossary/
// marketplace string path (components/code-highlight.tsx) both highlight on THIS pair instead of
// Shiki's generic github-light/github-dark, so code samples read in the brand's own token language.
//
// Each colour is the gamut-mapped sRGB hex of a --cs-* OKLCH token (packages/ui tokens.css):
//   default (everything else) -> --cs-fg   comment -> --cs-fg-muted
//   string / attribute-value  -> --cs-code-string   keyword/keyword.control/storage -> --cs-code-keyword
// Only ~4 scopes, matching the two dedicated code tokens + fg/fg-muted — deliberately NOT a full
// rainbow TextMate theme (ADR-0078 restrained strategy).
//
// Two tripwires are load-bearing (ADR-0374 lock 1):
//  1. `editor.background` is transparent — the fumadocs fd-bridge / kit CodeBlock owns the figure
//     surface via --cs-surface-1; a baked background hex would re-introduce a hardcoded code surface.
//  2. Comments carry NO fontStyle (plain weight) — Martian Mono (the site's sole mono face, ADR-0195)
//     ships no italic in its next/font config, so an italic scope would render a faked oblique.
//
// shiki isn't a resolvable dependency name here (fumadocs bundles it internally), so the objects are
// shaped by a local ThemeRegistration-compatible type rather than an import; both consumers pass them
// to a `themes` option whose declared type (ThemeRegistrationAny) accepts them structurally.

interface ShikiThemeRegistration {
  name: string;
  type: "light" | "dark";
  colors: Record<string, string>;
  settings: {
    scope?: string | string[];
    settings: { foreground?: string; fontStyle?: string };
  }[];
}

// keyword / keyword.control / storage — the syntax categories that read as language structure.
const KEYWORD_SCOPES = [
  "keyword",
  "keyword.control",
  "storage",
  "storage.type",
  "storage.modifier",
];
// string literals + attribute values.
const STRING_SCOPES = [
  "string",
  "string.quoted",
  "string.template",
  "meta.attribute-value",
  "constant.other.symbol",
];
const COMMENT_SCOPES = ["comment", "punctuation.definition.comment"];

export const caissonLight: ShikiThemeRegistration = {
  name: "caisson-light",
  type: "light",
  colors: {
    "editor.foreground": "#131c1f", // --cs-fg (light)
    "editor.background": "#00000000", // transparent — surface owned by fd-bridge / CodeBlock
  },
  settings: [
    { scope: COMMENT_SCOPES, settings: { foreground: "#4b585c" } }, // --cs-fg-muted (light)
    { scope: STRING_SCOPES, settings: { foreground: "#007253" } }, // --cs-code-string (light)
    { scope: KEYWORD_SCOPES, settings: { foreground: "#5b5cb7" } }, // --cs-code-keyword (light)
  ],
};

export const caissonDark: ShikiThemeRegistration = {
  name: "caisson-dark",
  type: "dark",
  colors: {
    "editor.foreground": "#eff2f4", // --cs-fg (dark)
    "editor.background": "#00000000", // transparent
  },
  settings: [
    { scope: COMMENT_SCOPES, settings: { foreground: "#9da6aa" } }, // --cs-fg-muted (dark)
    { scope: STRING_SCOPES, settings: { foreground: "#00c296" } }, // --cs-code-string (dark)
    { scope: KEYWORD_SCOPES, settings: { foreground: "#a0a6f3" } }, // --cs-code-keyword (dark)
  ],
};

/** The `{ light, dark }` pair both render paths pass to Shiki's `themes` option (defaultColor:false
 *  → each token span carries `--shiki-light`/`--shiki-dark`, picked per [data-theme] in base.css). */
export const caissonShikiThemes = {
  light: caissonLight,
  dark: caissonDark,
} as const;
