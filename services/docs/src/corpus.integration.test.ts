import { describe, expect, test } from "bun:test";
import { buildCorpus } from "./corpus.ts";
import { renderLlmsFull } from "./llms-txt.ts";
import { DocChunkSchema } from "./types.ts";

// Integration: builds the corpus from the REAL repo tree (cwd resolves up to the workspace root).
// Asserts STRUCTURAL invariants, not exact counts — the corpus grows as docs are added.
describe("buildCorpus (real repo)", () => {
  const corpus = buildCorpus();

  test("produces a non-empty corpus of valid chunks + pages", () => {
    expect(corpus.chunks.length).toBeGreaterThan(0);
    expect(corpus.pages.length).toBeGreaterThan(0);
    for (const c of corpus.chunks)
      expect(() => DocChunkSchema.parse(c)).not.toThrow();
  });

  test("includes the curated base docs and package READMEs", () => {
    const sources = new Set(corpus.pages.map((p) => p.source));
    expect(sources.has("apps/site/content/docs/base/billing.mdx")).toBe(true);
    expect(
      [...sources].some(
        (s) => s.startsWith("packages/") && s.endsWith("README.md"),
      ),
    ).toBe(true);
  });

  test("tags the open base docs Apache-2.0", () => {
    const billing = corpus.pages.find(
      (p) => p.source === "apps/site/content/docs/base/billing.mdx",
    );
    expect(billing?.license).toBe("Apache-2.0");
  });

  test("is byte-stable across rebuilds (deterministic)", () => {
    expect(JSON.stringify(buildCorpus())).toBe(JSON.stringify(corpus));
  });

  // Regression for audit finding 69177803de41c5ad: a `"private": true` package's README is internal
  // engineering tooling (e.g. @caisson/audit-harness, @caisson/license-issue) and must never reach the
  // buyer-facing corpus or the llms-full.txt it's rendered into.
  test("excludes private:true packages' READMEs from the corpus and llms-full", () => {
    const sources = corpus.pages.map((p) => p.source);
    expect(sources).not.toContain("packages/audit-harness/README.md");

    const full = renderLlmsFull(corpus);
    expect(full).not.toContain("@caisson/audit-harness");
    expect(full).not.toContain("not sellable");
  });

  // the support bot escalated "how do I use the CLI with my AI agent after purchasing"
  // as unanswerable — the getting-started quickstart chunk must cover both the post-purchase CLI
  // install and how an AI agent drives Caisson (shelling out to the CLI or the MCP server).
  test("the quickstart doc covers post-purchase CLI install and AI-agent usage", () => {
    const quickstart = corpus.chunks.filter(
      (c) => c.source === "apps/site/content/docs/getting-started.mdx",
    );
    expect(quickstart.length).toBeGreaterThan(0);
    const text = quickstart.map((c) => c.text).join("\n");
    expect(text).toContain("bunx @caisson-sh/cli@latest");
    expect(text).toContain("CAISSON_LICENSE_TOKEN");
    expect(text).toContain("@caisson/mcp-server");
    expect(text).toContain("runStdioServer");
  });
});
