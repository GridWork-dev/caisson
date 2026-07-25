// Pure, deterministic mirror of @caisson/local-store's Reciprocal Rank Fusion math
// (packages/local-store/src/store.ts, `LocalStore.hybridSearch`). The real module's whole import
// graph is bun/node-only (`bun:sqlite`, `sqlite-vec`, `node:fs` inside store.ts). The vec0 KNN leg
// and the FTS5 bm25 leg both need a real SQLite extension host), so it cannot resolve in a browser
// bundle. Only the FUSION FORMULA is hand-mirrored below (a few lines of arithmetic); the two per-leg
// RANKINGS it fuses are PRECOMPUTED SAMPLE data, captured from a real `LocalStore` run over the fixed
// 8-doc corpus + query declared here and pinned in local-store-logic.test.ts, which imports the real
// "@caisson/local-store" package directly (tests run under bun, not a browser) and re-derives every
// rank and every fused score live against it.
//
// No Date.now(), no Math.random(): the corpus, the query, and both leg rankings are fixed constants,
// so the same slider position always fuses to the same numbers.

/** Mirrors RRF_K, packages/local-store/src/store.ts, the standard fusion constant (60). */
export const RRF_K = 60;

/** Mirrors ValidationError's code/httpStatus, packages/kernel/src/errors.ts, the class
 *  `hybridSearch()` throws when `ftsWeight` fails its "positive finite number" check. The real
 *  class also carries a `details` allowlist this client-only mirror skips (nothing here ever
 *  reports to a server). */
export class ValidationErrorMirror extends Error {
  readonly code = "validation_error";
  readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** One sample corpus document plus its precomputed 1-based rank in each leg, or `null` when the
 *  doc doesn't surface in that leg's top results at all (the real store's per-leg rank maps simply
 *  omit such rows). */
export interface SampleDoc {
  id: string;
  snippet: string;
  vecRank: number | null;
  ftsRank: number | null;
}

/** The fixed sample query text fused against the sample corpus below. */
export const SAMPLE_QUERY_TEXT = "refund";

/**
 * The 8-doc sample corpus. `vecRank`/`ftsRank` are captured from a live `LocalStore.hybridSearch`
 * run (dim 3, the embeddings + query vector declared in the test file) with one leg isolated at a
 * time: a blank `queryText` for the vec-only order, an omitted `queryVector` for the FTS-only
 * order, pinned in local-store-logic.test.ts against that real run. Declaration order matches
 * the upsert order the test seeds the real store with, so a tied fused score breaks the same way
 * the real store's rowid-ascending tie-break would. Sample data only, never a live embedding, never
 * a live index.
 */
export const SAMPLE_DOCS: readonly SampleDoc[] = [
  {
    id: "billing-refund",
    snippet:
      "A refund is issued to the original payment method within five business days.",
    vecRank: 1,
    ftsRank: 1,
  },
  {
    id: "credit-expiry",
    snippet:
      "Purchased credits never expire and roll over month to month automatically.",
    vecRank: 2,
    ftsRank: null,
  },
  {
    id: "hybrid-fusion",
    snippet:
      "Reciprocal rank fusion blends a vector ranking and a keyword ranking into one combined score.",
    vecRank: 3,
    ftsRank: null,
  },
  {
    id: "offline-mode",
    snippet:
      "The local store runs entirely on disk, no cloud vector database, no network call ever leaves the box.",
    vecRank: 4,
    ftsRank: null,
  },
  {
    id: "tenant-isolation",
    snippet:
      "Every tenant gets its own SQLite file, so one tenant's data never touches another tenant's.",
    vecRank: 5,
    ftsRank: null,
  },
  {
    id: "keyword-search",
    snippet:
      "Keyword search matches exact terms and ranks by how rare and frequent they are across the corpus.",
    vecRank: 6,
    ftsRank: null,
  },
  {
    id: "support-ticket",
    snippet:
      "Open a support ticket and a refund is processed once the account is verified.",
    vecRank: 7,
    ftsRank: 2,
  },
  {
    id: "vector-search",
    snippet:
      "Vector search finds semantically similar passages even when the exact words differ.",
    vecRank: 8,
    ftsRank: null,
  },
] as const;

// The embedding set SAMPLE_DOCS' vecRank column was captured against (dim 3, query vector
// [1, 0, 0]), reproduced verbatim in local-store-logic.test.ts, which re-derives every rank
// against a live `LocalStore`. Every pairwise L2 distance from the query is deliberately kept
// well-separated (no near-ties) so the vec0 KNN order is stable across runs and platforms, not an
// artifact of an unspecified tie-break: billing-refund [1,0,0], credit-expiry [0.9,0.1,0],
// hybrid-fusion [0.8,0.2,0], offline-mode [0.55,0,0.4], tenant-isolation [0.3,0.1,0.55],
// keyword-search [0.15,0.6,0.1], support-ticket [0.05,0.05,0.7], vector-search [0,0.85,0.15].

export interface FuseOptions {
  /** The RRF dampening constant. Slider-adjustable here to explore the formula; the shipped
   *  package always fuses at the fixed `RRF_K` above. */
  rrfK: number;
  /** Multiplier on the FTS leg's contribution; the vec leg always weighs 1. Mirrors the real,
   *  buyer-configurable `ftsWeight` option on `HybridSearchOptions`. */
  ftsWeight: number;
  /** `false` mirrors omitting `queryVector` entirely. The real `vecLeg()` short-circuits to an
   *  empty rank map and retrieval degrades to the FTS5-only floor. */
  includeVector: boolean;
}

export interface FusedHit {
  id: string;
  score: number;
}

/**
 * Mirrors the fusion loop inside `LocalStore.hybridSearch` (store.ts): every leg a doc appears in
 * contributes `weight / (rrfK + rank)` (vec weight fixed at 1, FTS weight `ftsWeight`), the
 * contributions sum per doc, and the result sorts by score descending. A doc absent from every leg
 * never appears (never a synthesized zero-score row). `ftsWeight` fails closed exactly like the real
 * option: a non-finite or non-positive value throws rather than silently falling back to 1.
 */
export function fuseRrf(
  docs: readonly SampleDoc[],
  opts: FuseOptions,
): FusedHit[] {
  if (!Number.isFinite(opts.ftsWeight) || opts.ftsWeight <= 0) {
    throw new ValidationErrorMirror(
      "ftsWeight must be a positive finite number",
    );
  }
  const hits: FusedHit[] = [];
  for (const doc of docs) {
    let score = 0;
    if (opts.includeVector && doc.vecRank !== null) {
      score += 1 / (opts.rrfK + doc.vecRank);
    }
    if (doc.ftsRank !== null) {
      score += opts.ftsWeight / (opts.rrfK + doc.ftsRank);
    }
    if (score > 0) hits.push({ id: doc.id, score });
  }
  // Array#sort is a stable sort (ES2019+): an exact score tie keeps the SAMPLE_DOCS declaration
  // order, mirroring the real store's rowid-ascending tie-break for docs upserted in that order.
  return hits.sort((a, b) => b.score - a.score);
}
