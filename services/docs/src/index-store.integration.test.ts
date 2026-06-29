import { describe, expect, test } from "bun:test";
import { FakeEmbedder } from "./embedder.ts";
import { DocsIndex } from "./index-store.ts";
import type { DocChunk } from "./types.ts";

// Integration: exercises the real @caisson/local-store LocalStore (bun:sqlite FTS5 + sqlite-vec). On
// Linux (CI `check` runner) the extension loads natively; local-store handles the macOS setCustomSQLite.
const CHUNKS: DocChunk[] = [
  {
    id: "billing-webhook",
    source: "apps/site/content/docs/base/billing.mdx",
    title: "Billing",
    section: "Webhooks",
    kind: "docs",
    license: "Apache-2.0",
    pkg: "@caisson/billing",
    text: "Billing webhooks are verified against the raw request body with a timing-safe HMAC compare.",
  },
  {
    id: "credits-wallet",
    source: "apps/site/content/docs/base/credits.mdx",
    title: "Credits",
    section: "Wallet",
    kind: "docs",
    license: "Apache-2.0",
    pkg: "@caisson/credits",
    text: "Credits are integer units in an append-only ledger, gated by a 402 when the balance is short.",
  },
  {
    id: "ui-tokens",
    source: "apps/site/content/docs/base/ui.mdx",
    title: "UI",
    section: "Tokens",
    kind: "docs",
    license: "Apache-2.0",
    pkg: "@caisson/ui",
    text: "The UI package ships the design token floor and a small set of primitive components.",
  },
];

describe("DocsIndex retrieval", () => {
  // local-store's FTS leg is an exact-PHRASE match (sanitizeFts wraps the query in quotes), so the
  // no-embedder floor matches occurring phrases / keywords; natural-language intent is the vector leg's
  // job (next test). This is the documented floor↔hybrid split.
  test("FTS5 floor (no embedder) ranks the on-topic chunk first for a keyword phrase", async () => {
    const idx = await DocsIndex.build(CHUNKS);
    expect(idx.size).toBe(3);
    const hits = await idx.search("billing webhooks", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).toBe("billing-webhook");
    expect(hits[0]?.source).toBe("apps/site/content/docs/base/billing.mdx"); // citation carried
    idx.close();
  });

  test("hybrid (FakeEmbedder) also ranks the on-topic chunk first", async () => {
    const idx = await DocsIndex.build(CHUNKS, new FakeEmbedder());
    const hits = await idx.search("how does billing verify webhooks", 3);
    expect(hits[0]?.id).toBe("billing-webhook");
    idx.close();
  });

  test("respects the k limit", async () => {
    const idx = await DocsIndex.build(CHUNKS);
    const hits = await idx.search("append-only ledger", 1);
    expect(hits.length).toBe(1);
    expect(hits[0]?.id).toBe("credits-wallet");
    idx.close();
  });
});
