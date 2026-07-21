// Server-side Shiki highlighter for the string code artifacts (glossary + marketplace modules).
// Those samples are plain strings, so they rendered flat-monochrome; ADR-0374 lock 1 restores real
// syntax highlighting on the same Shiki the docs use (fumadocs-core), theme-FOLLOWING.
//
// `defaultColor: false` makes each token span carry both `--shiki-light` and `--shiki-dark` custom
// props with no baked `color`; the `.cs-shiki span` rules in @caisson/ui base.css pick the right one
// per theme. The `pre`/`code` components are remapped so the output is just the token spans under a
// single `<code class="cs-shiki">` — no nested Shiki `<pre>` with its own background, since our
// <CodeBlock>/<Terminal> owns the surface and the scroll affordance. `engine: 'js'` keeps the build
// WASM-free.
import { highlight } from "fumadocs-core/highlight";
import type { ReactNode } from "react";

const THEMES = { light: "github-light", dark: "github-dark" } as const;

export async function CodeHighlight({
  code,
  lang,
}: {
  code: string;
  lang: string;
}): Promise<ReactNode> {
  return highlight(code, {
    lang,
    engine: "js",
    defaultColor: false,
    themes: THEMES,
    components: {
      pre: (props) => props.children,
      code: (props) => <code className="cs-shiki" {...props} />,
    },
  });
}
