import { describe, expect, test } from "bun:test";
import { buildCorpus } from "./corpus.ts";
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
});
