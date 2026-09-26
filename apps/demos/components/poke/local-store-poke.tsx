"use client";

// The local-store module's poke (ADR-0378 lock 2): an RRF explorer over a fixed 8-doc sample
// corpus.
//
// This component drives the REAL @caisson-sh/local-store: the hand-ported mirror
// (local-store-logic.ts) is deleted. The fusion arithmetic now lives in the package's own
// database-free `rrf.ts` — the ONE implementation `LocalStore.hybridSearch` fuses its two legs
// through — and is imported here via the package's public `./browser` entry point. What CANNOT
// come along is the retrieval itself: the vec0 KNN leg and the FTS5 bm25 leg need `bun:sqlite` plus
// the `sqlite-vec` native extension, which has no browser form. So the two per-leg RANKINGS below
// are PRECOMPUTED SAMPLE data, captured from a real `LocalStore` run over the corpus + query
// declared here and re-derived live against that real store in local-store-poke.test.ts. The
// fusion you drive with the sliders is the shipped function, not a copy of it.
//
// Browser-safety is proven by the static source-graph walk in local-store-poke.test.ts — NOT by a
// build; a bundler substitutes node builtins instead of failing on them. No Date.now(), no
// Math.random(): the corpus, the query, and both leg rankings are fixed constants, so the same
// slider position always fuses to the same numbers. Nothing here fetches, persists, or measures.
import { useMemo, useState } from "react";
import { ValidationError } from "@caisson-sh/kernel";
import { RRF_K, fuseByRrf } from "@caisson-sh/local-store/browser";
import type { RrfLeg } from "@caisson-sh/local-store/browser";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import styles from "./local-store-poke.module.css";

const RRF_K_MIN = 1;
const RRF_K_MAX = 200;
const FTS_WEIGHT_MIN = -2;
const FTS_WEIGHT_MAX = 5;
const FTS_WEIGHT_STEP = 0.5;
const DEFAULT_FTS_WEIGHT = 1;

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
 * order, pinned in local-store-poke.test.ts against that real run. Declaration order matches the
 * upsert order the test seeds the real store with, and the fused key IS that position, so a tied
 * fused score breaks exactly the way the real store's rowid-ascending tie-break does — the same
 * comparator, not an imitation of it. Sample data only, never a live embedding, never a live index.
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
// [1, 0, 0]), reproduced verbatim in local-store-poke.test.ts, which re-derives every rank against
// a live `LocalStore`. Every pairwise L2 distance from the query is deliberately kept well-separated
// (no near-ties) so the vec0 KNN order is stable across runs and platforms, not an artifact of an
// unspecified tie-break: billing-refund [1,0,0], credit-expiry [0.9,0.1,0], hybrid-fusion
// [0.85,0.15,0], offline-mode [0.55,0,0.4], tenant-isolation [0.3,0.1,0.55], keyword-search
// [0.15,0.6,0.1], support-ticket [0.05,0.05,0.7], vector-search [0,0.85,0.15].

export interface FusedHit {
  id: string;
  score: number;
}

/**
 * Poke-local presentation composition: project the sample docs onto the package's `RrfLeg` shape
 * (position → 1-based rank, the same key space the real store's rowids occupy) and hand them to the
 * shipped `fuseByRrf`, then map the fused keys back to doc ids. No fusion math lives here.
 * `includeVector: false` simply omits the vec leg — what the real store does when no query vector
 * is supplied and retrieval degrades to the always-available FTS5 floor.
 */
export function fuseSample(
  docs: readonly SampleDoc[],
  opts: { rrfK: number; ftsWeight: number; includeVector: boolean },
): FusedHit[] {
  // Guarded here under its OWN name, the same shape @caisson-sh/local-store's `hybridSearch`
  // validates ftsWeight before it ever reaches `fuseByRrf` (store.ts) — so a bad value in this
  // demo throws the exact same message a real caller would see, not `fuseByRrf`'s internal
  // "RRF leg weight" wording.
  if (!Number.isFinite(opts.ftsWeight) || opts.ftsWeight <= 0) {
    throw new ValidationError("ftsWeight must be a positive finite number", {
      received: opts.ftsWeight,
    });
  }
  const leg = (key: "vecRank" | "ftsRank", weight: number): RrfLeg => {
    const ranks = new Map<number, number>();
    docs.forEach((doc, i) => {
      const rank = doc[key];
      if (rank !== null) ranks.set(i, rank);
    });
    return { ranks, weight };
  };
  const legs: RrfLeg[] = opts.includeVector
    ? [leg("vecRank", 1), leg("ftsRank", opts.ftsWeight)]
    : [leg("ftsRank", opts.ftsWeight)];
  return fuseByRrf(legs, { rrfK: opts.rrfK }).map(({ key, score }) => ({
    id: docs[key]?.id ?? "",
    score,
  }));
}

interface VerdictLine {
  state: VerdictState;
  message: string;
}

function legOrder(
  docs: readonly SampleDoc[],
  key: "vecRank" | "ftsRank",
): SampleDoc[] {
  return docs
    .filter((doc) => doc[key] !== null)
    .slice()
    .sort((a, b) => (a[key] as number) - (b[key] as number));
}

function describeFused(
  fused: FusedHit[],
  docsById: Map<string, SampleDoc>,
  noVector: boolean,
): VerdictLine {
  if (fused.length === 0) {
    return { state: "neutral", message: "No doc matched either leg." };
  }
  if (noVector) {
    const dropped = SAMPLE_DOCS.length - fused.length;
    return {
      state: "neutral",
      message: `Vector leg off. Keyword-only surfaces ${fused.length} of ${SAMPLE_DOCS.length} docs; ${dropped} lived only in the vector leg and dropped out.`,
    };
  }
  let rescued: { id: string; vecRank: number; fusedRank: number } | null = null;
  fused.forEach((hit, i) => {
    const doc = docsById.get(hit.id);
    if (!doc || doc.vecRank === null) return;
    const gain = doc.vecRank - (i + 1);
    if (
      gain > 0 &&
      (rescued === null || gain > rescued.vecRank - rescued.fusedRank)
    ) {
      rescued = { id: hit.id, vecRank: doc.vecRank, fusedRank: i + 1 };
    }
  });
  const topId = fused[0]?.id ?? "";
  if (rescued) {
    const r = rescued as { id: string; vecRank: number; fusedRank: number };
    return {
      state: "ok",
      message: `"${topId}" tops the fused ranking. "${r.id}" jumps from vector rank ${r.vecRank} to fused rank ${r.fusedRank} on its keyword hit alone.`,
    };
  }
  return {
    state: "ok",
    message: `${fused.length} docs fused, topped by "${topId}". The vector order holds; no keyword hit moved a rank.`,
  };
}

export default function LocalStorePoke() {
  const [rrfK, setRrfK] = useState(RRF_K);
  const [ftsWeight, setFtsWeight] = useState(DEFAULT_FTS_WEIGHT);
  const [noVector, setNoVector] = useState(false);

  const docsById = useMemo(
    () => new Map(SAMPLE_DOCS.map((doc) => [doc.id, doc])),
    [],
  );
  const vecLeg = useMemo(() => legOrder(SAMPLE_DOCS, "vecRank"), []);
  const ftsLeg = useMemo(() => legOrder(SAMPLE_DOCS, "ftsRank"), []);

  const { fused, error } = useMemo(() => {
    try {
      return {
        fused: fuseSample(SAMPLE_DOCS, {
          rrfK,
          ftsWeight,
          includeVector: !noVector,
        }),
        error: null as ValidationError | null,
      };
    } catch (err) {
      if (err instanceof ValidationError) {
        return { fused: [] as FusedHit[], error: err };
      }
      throw err;
    }
  }, [rrfK, ftsWeight, noVector]);

  const verdict: VerdictLine = error
    ? { state: "fail", message: `Blocked. ${error.message}` }
    : describeFused(fused, docsById, noVector);

  return (
    <PokeShell
      label={`@caisson-sh/local-store · sample corpus, query "${SAMPLE_QUERY_TEXT}"`}
      title="Rank by vector. Rank by keyword. Fuse them into one score."
    >
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            RRF_K, real default {RRF_K}. Current {rrfK}
          </span>
          <input
            className={styles.range}
            type="range"
            min={RRF_K_MIN}
            max={RRF_K_MAX}
            step={1}
            value={rrfK}
            onChange={(e) => setRrfK(Number(e.target.value))}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            ftsWeight, keyword-leg multiplier
          </span>
          <input
            className={styles.number}
            type="number"
            min={FTS_WEIGHT_MIN}
            max={FTS_WEIGHT_MAX}
            step={FTS_WEIGHT_STEP}
            value={ftsWeight}
            onChange={(e) => setFtsWeight(Number(e.target.value))}
          />
        </label>
      </div>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={noVector}
          onChange={(e) => setNoVector(e.target.checked)}
        />
        No vector leg. Degrade to keyword-only, the always-available floor.
      </label>

      <div className={styles.legs}>
        <div className={styles.leg} data-active={!noVector}>
          <p className={styles.legLabel}>Vector leg, sample</p>
          <ol className={styles.legList}>
            {vecLeg.map((doc) => (
              <li key={doc.id} className={styles.legRow}>
                <span className={styles.legRank}>{doc.vecRank}</span>
                <span className={styles.legSnippet}>{doc.snippet}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className={styles.leg} data-active="true">
          <p className={styles.legLabel}>Keyword leg, sample FTS5</p>
          <ol className={styles.legList}>
            {ftsLeg.map((doc) => (
              <li key={doc.id} className={styles.legRow}>
                <span className={styles.legRank}>{doc.ftsRank}</span>
                <span className={styles.legSnippet}>{doc.snippet}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className={styles.fusedWrap}>
        <p className={styles.legLabel}>Fused, Reciprocal Rank Fusion</p>
        <ol className={styles.fusedList}>
          {fused.map((hit, i) => {
            const doc = docsById.get(hit.id);
            return (
              <li key={hit.id} className={styles.fusedRow}>
                <span className={styles.fusedRank}>{i + 1}</span>
                <span className={styles.fusedSnippet}>
                  {doc?.snippet ?? hit.id}
                </span>
                <span className={styles.fusedLegs}>
                  vec {doc?.vecRank ?? "-"} · kw {doc?.ftsRank ?? "-"}
                </span>
                <span className={styles.fusedScore}>
                  {hit.score.toFixed(4)}
                </span>
              </li>
            );
          })}
          {fused.length === 0 ? (
            <li className={styles.fusedEmpty}>No fused rows.</li>
          ) : null}
        </ol>
      </div>

      <Verdict state={verdict.state}>{verdict.message}</Verdict>
    </PokeShell>
  );
}
