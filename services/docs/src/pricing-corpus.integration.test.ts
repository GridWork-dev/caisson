import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCorpus, findRepoRoot, loadPricingFacts } from "./corpus.ts";
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
    expect(facts.bundles.find((b) => b.id === "compliance")?.amount).toBe(1649);
    expect(facts.bundles.find((b) => b.id === "everything")?.amount).toBe(2259);
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
    expect(pricing.some((c) => c.text.includes("$1,649"))).toBe(true);
    expect(pricing.some((c) => c.text.includes("$2,259"))).toBe(true);
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

  // the support bot escalated "what's in the compliance bundle" as unanswerable — the
  // real SOT's compliance-bundle members chunk must name its real member modules (id + a one-line
  // description), so this single chunk answers the question.
  //
  // The members list lives in its own `### Modules included in Compliance` section rather than
  // inline under the price heading (2026-07-29): carried in the price chunk, its thirteen blurbs
  // made that chunk long enough for bm25 length normalization to sink it, and "How much is the
  // Compliance bundle" came back with the Everything card. The requirement above is unchanged and
  // still asserted here — ONE chunk answers "what's in bundle X" — it is just the members chunk
  // rather than the price chunk, and its heading names the bundle so it stands alone.
  test("the real compliance-bundle members chunk names its real member modules", async () => {
    const facts = await loadPricingFacts();
    if (facts === null) throw new Error("pricing SOT not found");
    const corpus = buildCorpus({ pricingFacts: facts });
    const complianceChunk = corpus.chunks.find(
      (c) =>
        c.kind === "pricing" &&
        c.text.startsWith("### Modules included in Compliance"),
    );
    if (complianceChunk === undefined) {
      throw new Error("no compliance-bundle members chunk in the corpus");
    }
    // The price chunk still exists and still carries both numbers on its own.
    const priceChunk = corpus.chunks.find(
      (c) => c.kind === "pricing" && c.text.startsWith("## Compliance —"),
    );
    expect(priceChunk?.text).toContain("$1,649");
    expect(priceChunk?.text).toContain("$659");
    // The compliance bundle's real registry-index-pinned members (apps/site/lib/pricing.ts
    // `MODULE_PRICES` filtered by `bundles.includes("compliance")`).
    for (const id of [
      "field-crypto",
      "audit-worm",
      "retention-runner",
      "alerting",
      "compliance-core",
      "frameworks-pack",
      "oscal-spine",
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

describe("licensing.mdx renewal table (hand-authored money prose pinned to the SOT)", () => {
  test("every bundle renewal row equals flat 40% of the live list price, X9-rounded", async () => {
    // The renewal formula lives in apps/site/lib/pricing.ts renewalAmount() (flat 40%, floored,
    // rounded DOWN to the nearest number ending in 9) and is what Paddle actually charges. The
    // licensing docs page hand-types the same figures; this pin makes a repriced bundle fail HERE
    // instead of shipping a public renewal price the dashboard and Paddle contradict (the exact
    // drift this branch's SHIP audit caught: three rows still carried pre-reprice figures).
    const facts = await loadPricingFacts();
    if (facts === null) throw new Error("pricing SOT not found");
    const mdx = readFileSync(
      join(
        findRepoRoot(import.meta.dir),
        "apps/site/content/docs/licensing.mdx",
      ),
      "utf8",
    );
    const x9 = (n: number) => n - ((n + 1) % 10);
    const rows: Record<string, string> = {
      compliance: "Compliance",
      "ai-production": "AI-Production",
      everything: "Everything",
      provenance: "Provenance",
      "local-first": "Local-first",
      "agentic-dev": "Agentic-Dev",
    };
    for (const [id, label] of Object.entries(rows)) {
      const amount = facts.bundles.find((b) => b.id === id)?.amount;
      if (amount === null || amount === undefined)
        throw new Error(`no priced bundle ${id} in the SOT`);
      const renewal = x9(Math.floor((amount * 40) / 100));
      expect(mdx).toMatch(
        new RegExp(`\\| ${label}\\s+\\| \\$${String(renewal)}\\s+\\|`),
      );
    }
  });
});
