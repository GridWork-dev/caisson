import { describe, expect, test } from "bun:test";
import { buildCorpus, loadPricingFacts } from "./corpus.ts";
import { DocsIndex } from "./index-store.ts";
import { DocChunkSchema } from "./types.ts";

// Integration: reads the REAL pricing SOT (apps/site/lib/pricing.ts, resolved up from cwd) and proves
// the expanded ingest carries the pricing facts end to end — loaded, chunked, and indexed.
describe("pricing corpus (real SOT)", () => {
  test("loadPricingFacts reads the live display source of truth", async () => {
    const facts = await loadPricingFacts();
    if (facts === null) throw new Error("pricing SOT not found");
    expect(facts.editions.length).toBeGreaterThan(0);
    expect(facts.modules.length).toBeGreaterThan(0);
    // The committed compliance price — read from the SOT, never scraped.
    expect(facts.editions.find((e) => e.id === "compliance")?.amount).toBe(799);
  });

  test("buildCorpus(pricingFacts) appends valid kind:pricing chunks + pages", async () => {
    const facts = await loadPricingFacts();
    if (facts === null) throw new Error("pricing SOT not found");
    const corpus = buildCorpus({ pricingFacts: facts });
    const pricing = corpus.chunks.filter((c) => c.kind === "pricing");
    expect(pricing.length).toBeGreaterThan(0);
    for (const c of pricing)
      expect(() => DocChunkSchema.parse(c)).not.toThrow();
    // The live compliance price appears verbatim in a pricing chunk — a stale citation is impossible.
    expect(pricing.some((c) => c.text.includes("$799"))).toBe(true);
    expect(corpus.pages.some((p) => p.kind === "pricing")).toBe(true);
  });

  test("the docs-only corpus is unchanged — no pricing chunks without facts", () => {
    const corpus = buildCorpus();
    expect(corpus.chunks.some((c) => c.kind === "pricing")).toBe(false);
  });

  test("the expanded corpus indexes and retrieves the new pricing chunks", async () => {
    const facts = await loadPricingFacts();
    if (facts === null) throw new Error("pricing SOT not found");
    const corpus = buildCorpus({ pricingFacts: facts });
    const idx = await DocsIndex.build(corpus.chunks);
    expect(idx.size).toBe(corpus.chunks.length); // every kind, pricing included, is indexed
    const hits = await idx.search("Everything bundle", 8);
    expect(hits.some((h) => h.kind === "pricing")).toBe(true);
    idx.close();
  });
});
