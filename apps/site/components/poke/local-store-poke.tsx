"use client";

// The local-store module's poke (ADR-0378 lock 2): an RRF explorer over a fixed 8-doc sample
// corpus. The vector leg (vec0 KNN) and the keyword leg (FTS5 bm25) are precomputed sample
// rankings (see ./local-store-logic.ts's header for why); the fusion itself runs live, on the
// package's real formula, every time a slider moves. Nothing here fetches, persists, or measures
// the visitor.
import { useMemo, useState } from "react";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import {
  RRF_K,
  SAMPLE_DOCS,
  SAMPLE_QUERY_TEXT,
  ValidationErrorMirror,
  fuseRrf,
} from "./local-store-logic";
import type { FusedHit, SampleDoc } from "./local-store-logic";
import styles from "./local-store-poke.module.css";

const RRF_K_MIN = 1;
const RRF_K_MAX = 200;
const FTS_WEIGHT_MIN = -2;
const FTS_WEIGHT_MAX = 5;
const FTS_WEIGHT_STEP = 0.5;
const DEFAULT_FTS_WEIGHT = 1;

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
        fused: fuseRrf(SAMPLE_DOCS, {
          rrfK,
          ftsWeight,
          includeVector: !noVector,
        }),
        error: null as ValidationErrorMirror | null,
      };
    } catch (err) {
      if (err instanceof ValidationErrorMirror) {
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
      label={`@caisson/local-store · sample corpus, query "${SAMPLE_QUERY_TEXT}"`}
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
