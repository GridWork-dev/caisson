// Server-side Shiki highlighter for the string code artifacts (glossary + marketplace modules).
// Those samples are plain strings, so they rendered flat-monochrome; ADR-0374 lock 1 restores real
// syntax highlighting on the same Shiki the docs use (fumadocs-core), theme-FOLLOWING.
//
// `defaultColor: false` makes each token span carry both `--shiki-light` and `--shiki-dark` custom
// props with no baked `color`; the `.cs-shiki span` rules in @caisson-sh/ui base.css pick the right one
// per theme. The `pre`/`code` components are remapped so the output is just the token spans under a
// single `<code class="cs-shiki">` — no nested Shiki `<pre>` with its own background, since our
// <CodeBlock>/<Terminal> owns the surface and the scroll affordance. `engine: 'js'` keeps the build
// WASM-free.
import { highlight } from "fumadocs-core/highlight";
import type { ReactNode } from "react";

import { caissonShikiThemes } from "@/lib/shiki-caisson-theme";

// Caisson's own theme pair (ADR-0374 Decision 2) — the identical pair the docs pipeline uses
// (source.config.ts), so glossary/marketplace samples read in the brand palette, theme-following.
const THEMES = caissonShikiThemes;

export async function CodeHighlight({
  code,
  lang,
}: {
  code: string;
  lang: string;
}): Promise<ReactNode> {
  return highlight(code, {
    lang,
    // An unrecognized `lang` (typo, a language Shiki doesn't bundle) degrades to plaintext
    // instead of throwing in this Server Component. NOTE: fumadocs-core's actual option name is
    // `fallbackLanguage` (HighlightHastOptions, not `defaultLanguage`) -- it already defaults to
    // "text" internally, which is functionally identical to "plaintext" (both are Shiki's
    // hard-coded no-grammar plain-text ids, isPlainLang), so this is explicit belt-and-suspenders
    // rather than a behavior change.
    fallbackLanguage: "plaintext",
    engine: "js",
    defaultColor: false,
    themes: THEMES,
    components: {
      pre: (props) => props.children,
      code: (props) => <code className="cs-shiki" {...props} />,
    },
  });
}
