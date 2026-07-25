import { defineConfig, defineDocs } from "fumadocs-mdx/config";

import { caissonShikiThemes } from "./lib/shiki-caisson-theme";

// In-repo MDX collections (ADR-0045). `content/docs/**` + meta.json sidebar files.
// includeProcessedMarkdown pre-renders each page so llms-full.txt / getText('processed')
// can read it at build time under `output: 'export'`.
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

// Docs code blocks highlight on Caisson's own Shiki theme pair (ADR-0374 Decision 2) instead of the
// fumadocs default github-light/github-dark. `themes` merges over the default rehypeCode options, so
// the tab/icon transformers and `engine: "js"` are preserved; only the palette changes. A `{light,dark}`
// map keeps defaultColor:false semantics (each token carries --shiki-light/--shiki-dark, re-keyed per
// [data-theme] in app/global.css), so docs code stays theme-following.
export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: caissonShikiThemes,
    },
  },
});
