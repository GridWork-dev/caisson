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
    expect(facts.bundles.length).toBe(6);
    expect(facts.modules.length).toBeGreaterThan(0);
    // The committed compliance bundle price — read from the SOT, never scraped.
    expect(facts.bundles.find((b) => b.id === "compliance")?.amount).toBe(1049);
  });

  test("buildCorpus(pricingFacts) appends valid kind:pricing chunks + pages", async () => {
    const facts = await loadPricingFacts();
    if (facts === null) throw new Error("pricing SOT not found");
    const corpus = buildCorpus({ pricingFacts: facts });
    const pricing = corpus.chunks.filter((c) => c.kind === "pricing");
    expect(pricing.length).toBeGreaterThan(0);
    for (const c of pricing)
      expect(() => DocChunkSchema.parse(c)).not.toThrow();
    // The live compliance bundle price appears verbatim in a pricing chunk — a stale citation is
    // impossible.
    expect(pricing.some((c) => c.text.includes("$1,049"))).toBe(true);
    expect(corpus.pages.some((p) => p.kind === "pricing")).toBe(true);
    // ADR-0278 Track K (fable F2): the real SOT currently carries an unpriced priority-support row
    // (`amount: null`) — it must never reach the public corpus with internal "unset" config copy.
    expect(
      pricing.some((c) => c.text.includes("Response-time commitment: unset.")),
    ).toBe(false);
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

  // CAISSON-43: the support bot escalated "what's in the compliance bundle" as unanswerable — the
  // real SOT's compliance-bundle chunk must name its real member modules (id + a one-line
  // description), not just the bundle's own price, so this single chunk answers the question.
  test("the real compliance-bundle chunk names its real member modules", async () => {
    const facts = await loadPricingFacts();
    if (facts === null) throw new Error("pricing SOT not found");
    const corpus = buildCorpus({ pricingFacts: facts });
    const complianceChunk = corpus.chunks.find(
      (c) => c.kind === "pricing" && c.text.startsWith("## Compliance —"),
    );
    if (complianceChunk === undefined) {
      throw new Error("no compliance-bundle pricing chunk in the corpus");
    }
    // The compliance bundle's real registry-index-pinned members (apps/site/lib/pricing.ts
    // `MODULE_PRICES` filtered by `bundles.includes("compliance")`).
    for (const id of [
      "field-crypto",
      "audit-worm",
      "retention-runner",
      "alerting",
      "compliance-core",
      "frameworks-pack",
      "signing-primitive",
    ]) {
      expect(complianceChunk.text).toContain(`\`${id}\``);
    }
    // A one-line description travels with the id, not just the bare price.
    expect(complianceChunk.text).toContain(
      "Append-only SHA-256 audit chain plus S3 Object-Lock WORM evidence storage.",
    );
  });
});
