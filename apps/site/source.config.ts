import { defineConfig, defineDocs } from "fumadocs-mdx/config";

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

export default defineConfig();
