import { describe, expect, test } from "bun:test";
import type { Embedder } from "@caisson/local-store";
import { FakeEmbedder } from "./embedder.ts";
import { DocsIndex } from "./index-store.ts";
import type { DocChunk } from "./types.ts";

/** Test double: always resolves after `delayMs`, counting calls — a stand-in for a working-but-slow
 * (or fully unresponsive-until-timeout) network embedder, without a real network wait. */
class SlowCountingEmbedder implements Embedder {
  readonly dim = 4;
  calls = 0;
  constructor(private readonly delayMs: number) {}
  async embed(): Promise<number[]> {
    this.calls += 1;
    await new Promise((r) => setTimeout(r, this.delayMs));
    return [1, 0, 0, 0];
  }
}

function manyChunks(n: number): DocChunk[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `chunk-${String(i)}`,
    source: `apps/site/content/docs/base/gen-${String(i)}.mdx`,
    title: `Gen ${String(i)}`,
    section: "Body",
    kind: "docs" as const,
    license: "Apache-2.0" as const,
    text: `Generated chunk number ${String(i)} for the embed-phase-deadline test.`,
  }));
}

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

describe("DocsIndex embed-phase deadline", () => {
  // Guards the boot-hang fix: a persistently slow/degraded/rate-limited embedder must not turn its
  // own bounded per-call retry+backoff into an effectively-unbounded total build time. See
  // index-store.ts's DEFAULT_EMBED_PHASE_DEADLINE_MS comment for the observed real-world shape (a
  // growing corpus x a slow/rate-limited provider ~= many real minutes of boot before FTS ever won
  // — live-reproduced once during this fix's own verification run against real OpenRouter).

  test("a deadline already in the past skips embedding entirely — build still succeeds (FTS-only)", async () => {
    const embedder = new SlowCountingEmbedder(50);
    const idx = await DocsIndex.build(CHUNKS, embedder, {
      embedPhaseDeadlineMs: -1000, // unambiguously already elapsed, no first-tick race
    });
    expect(embedder.calls).toBe(0);
    expect(idx.size).toBe(3);
    // Still fully functional off the FTS floor alone.
    const hits = await idx.search("billing webhooks", 3);
    expect(hits[0]?.id).toBe("billing-webhook");
    idx.close();
  });

  test("a deadline passing MID-ATTEMPT abandons that chunk instead of waiting it out", async () => {
    // The chunk the coordinator's real Retry-After-driven hang exercised: the call is genuinely
    // made (embedder.calls === 1) but the phase gives up on it once the deadline passes, rather
    // than blocking on however long the provider's own retry/backoff decides to take.
    const SLOW_CALL_MS = 300;
    const DEADLINE_MS = 20;
    const embedder = new SlowCountingEmbedder(SLOW_CALL_MS);

    const start = Date.now();
    const idx = await DocsIndex.build(manyChunks(1), embedder, {
      embedPhaseDeadlineMs: DEADLINE_MS,
    });
    const elapsed = Date.now() - start;

    expect(embedder.calls).toBe(1); // the call WAS made — it just wasn't waited on
    expect(elapsed).toBeLessThan(SLOW_CALL_MS); // resolved well before the slow call itself would
    expect(idx.size).toBe(1);
    idx.close();
  });

  test("bounds total build time independent of chunk count once the deadline passes", async () => {
    const DELAY_MS = 40;
    const DEADLINE_MS = 15;
    const chunks = manyChunks(40); // 40 chunks / EMBED_CONCURRENCY(8) = 5 sequential batches if unbounded
    const embedder = new SlowCountingEmbedder(DELAY_MS);

    const start = Date.now();
    const idx = await DocsIndex.build(chunks, embedder, {
      embedPhaseDeadlineMs: DEADLINE_MS,
    });
    const elapsed = Date.now() - start;

    // Without the fix this would scale with chunk count (5 sequential batches x 40ms = 200ms);
    // bounded, it stays close to the deadline itself regardless of the 40 chunks. Generous upper
    // bound for CI jitter — still far under the unbounded-case figure above.
    expect(elapsed).toBeLessThan(100);
    expect(idx.size).toBe(40);
    idx.close();
  });
});

describe("DocsIndex query-embed deadline", () => {
  // Guards the battery-v2 availability fix (2026-07-10): the per-QUERY embed had no bound, so a
  // slow (not failing) provider held /query open past every caller's budget — the support-bot's
  // 20s ceiling turned that into "retrieval unavailable" escalations for real buyers (4/25
  // battery questions). Past the deadline the query must degrade to the FTS floor and return.

  test("a slow query embed degrades to the FTS floor instead of waiting the provider out", async () => {
    const SLOW_CALL_MS = 400;
    const DEADLINE_MS = 20;
    // One embedder serves boot AND query; the boot deadline is kept generous so all 3 chunks
    // embed for real, proving the QUERY deadline (not the boot one) is what fires below.
    const embedder = new SlowCountingEmbedder(SLOW_CALL_MS);
    const idx = await DocsIndex.build(CHUNKS, embedder, {
      embedPhaseDeadlineMs: 10_000,
      queryEmbedDeadlineMs: DEADLINE_MS,
    });
    const bootCalls = embedder.calls;
    expect(bootCalls).toBe(3); // boot embedding completed — vectors are real

    const start = Date.now();
    const hits = await idx.search("billing webhooks", 3);
    const elapsed = Date.now() - start;

    expect(embedder.calls).toBe(bootCalls + 1); // the query embed WAS attempted
    expect(elapsed).toBeLessThan(SLOW_CALL_MS); // ...but not waited on past the deadline
    expect(hits[0]?.id).toBe("billing-webhook"); // FTS floor still answers
    idx.close();
  });
});
