// apps/local-ai/app/demo/pipeline.test.ts — the T22 verify proof (SPEC exit gate, ADR-0044). Drives
// the reference app's `runDemo()` — the exact logic the route handler + RSC page call — under Bun and
// asserts the demo returns hybrid results with ZERO outbound fetch. This is the CI-safe stand-in for
// "the demo route returns hybrid results with zero egress": no live server, no live network.
import { afterEach, describe, expect, test } from "bun:test";
import { runDemo } from "./pipeline.ts";

describe("local-ai reference app — runDemo() (T22 exit artifact)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("runs the whole edition offline and returns hybrid results with zero egress", async () => {
    // Sentinel: ANY outbound fetch during the demo is a zero-egress violation and fails the test.
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      throw new Error(
        "zero-egress violation: fetch was called during the offline demo",
      );
    }) as unknown as typeof fetch;

    const r = await runDemo();

    // Zero egress (the verify clause): the entire pass made no outbound fetch, and the privacy gate
    // blocks every host under the empty-allowlist policy.
    expect(fetchCalls).toBe(0);
    expect(r.privacy.egressBlocked).toBe(true);
    expect(r.privacy.mode).toBe("local-only");

    // Hybrid retrieval — the literal ADR-0064 exit gate: vec0-KNN + FTS5 fused (RRF), and the
    // FTS-only degrade. The query keyword phrase-matches exactly d4, so the top hit is deterministic;
    // the hybrid pass also surfaces the vec-ranked docs FTS-only cannot (count strictly greater).
    expect(r.retrieval.hybridTop).toBe("d4");
    expect(r.retrieval.ftsOnlyTop).toBe("d4");
    expect(r.retrieval.hybridCount).toBeGreaterThan(r.retrieval.ftsOnlyCount);
    expect(r.retrieval.hits.length).toBe(r.retrieval.hybridCount);

    // At-rest + isolation (TM-REST): tenant-A opens its own sealed row; a tenant-B context cannot.
    expect(r.atRest.roundTrip).toBe(true);
    expect(r.atRest.crossTenantBlocked).toBe(true);

    // Offline license (TM-LIC): valid → pro/local-ai; tampered + absent fail safe to community.
    expect(r.license.valid.valid).toBe(true);
    expect(r.license.valid.tier).toBe("pro");
    expect(r.license.valid.entitlements).toContain("local-ai");
    expect(r.license.tampered).toBe("community");
    expect(r.license.absent).toBe("community");

    // Two-way sync convergence (TM-SYNC): two replicas reach byte-equal state; the delete is a durable
    // tombstone (no resurrection of the stale upsert).
    expect(r.sync.converged).toBe(true);
    expect(r.sync.tombstones).toContain("docs/n4");
    expect(r.sync.rows.some((row) => row.pk === "n4")).toBe(false);

    // The aggregate gate + the irreversible-schema identity are present.
    expect(r.ok).toBe(true);
    expect(r.embeddingDim).toBe(384);
    expect(r.schemaVersion.length).toBeGreaterThan(0);
    expect(r.tenants).toEqual(["tenant-a", "tenant-b"]);
  });
});
