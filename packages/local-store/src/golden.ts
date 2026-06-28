// Module golden suite (ADR-0021 §golden / ADR-0013 golden-first). Declares the DETERMINISTIC output
// @caisson/local-store pins: the fused RRF ranking for a FIXED (vectors, FTS docs, query) input
// (RRF_K=60). The fixture lives in `src/__golden__` (the manifest `golden` dir) and is re-blessed via
// `BLESS=1` only when the output legitimately changes. This descriptor REFERENCES the to-be-built
// store API (`LocalStore` / `hybridSearch`) from `./store.ts` — golden-first: the fixture + the red
// test land before the logic (T7) that turns them green.
import { defineModuleGolden } from "@caisson/testing/golden-module";
import { LocalStore } from "./store.ts";
import type { HybridSearchOptions, StoreDoc } from "./store.ts";

/** The fixed corpus + query the golden pins. */
interface RrfFixture {
  dim: number;
  docs: StoreDoc[];
  query: HybridSearchOptions;
}

/**
 * A fixed corpus + query chosen so the RRF *fusion* is observable (not a single-leg echo):
 *  - `fox`        tops BOTH legs          → ranks #1
 *  - `fox-quick`  last in vec, top in FTS → fused up to #2 (the FTS leg rescues a vec-weak doc)
 *  - `lazy-fox`   mid in both legs        → #3
 *  - `canine`     #2 in vec, NO FTS hit   → drops to #4 (a strong single-leg doc loses to hybrids)
 * Deterministic: the vec0 L2 KNN order and the FTS5 bm25 order are fixed for this input — no clock,
 * randomness, or env. The embedding is pre-computed here (the injected seam), never modeled live.
 */
const RRF_FIXTURE: RrfFixture = {
  dim: 3,
  docs: [
    { id: "fox", text: "fox", embedding: [1, 0, 0] },
    { id: "fox-quick", text: "fox fox fox quick", embedding: [0, 1, 0] },
    {
      id: "canine",
      text: "canine animal companion",
      embedding: [0.95, 0.05, 0],
    },
    { id: "lazy-fox", text: "the lazy fox", embedding: [0, 0, 0.8] },
  ],
  query: { queryText: "fox", queryVector: [1, 0, 0], limit: 10 },
};

export const localStoreGolden = defineModuleGolden({
  module: "@caisson/local-store",
  goldenDir: "src/__golden__",
  cases: [
    {
      name: "rrf-ranking",
      input: RRF_FIXTURE,
      produce: (input) => {
        const fixture = input as RrfFixture;
        const store = LocalStore.open({ dim: fixture.dim });
        try {
          for (const doc of fixture.docs) store.upsert(doc);
          return store.hybridSearch(fixture.query).map((hit, i) => ({
            rank: i + 1,
            id: hit.id,
            score: Number(hit.score.toFixed(6)),
          }));
        } finally {
          store.close();
        }
      },
    },
  ],
});
