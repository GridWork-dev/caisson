"use client";

// The ai-evals module's poke (ADR-0378 lock 2, kimi CANDIDATES §B baseline gate). A live,
// deterministic run of the package's regression-vs-committed-baseline comparator (ADR-0072)
// against a sample eval run you can drag off course.
//
// This component drives the REAL @caisson-sh/ai-evals: the hand-ported mirror (ai-evals-logic.ts) is
// deleted. The gate's pure half — the boundary schema, `compareToBaseline`, the pre-BLESS
// eligibility check, and the BLESS merge — lives in the package's own node-free
// `baseline-compare.ts` and is imported here through its public `./browser` entry point; the
// node:fs load/save transport stays behind the main entry. Browser-safety is proven by the static
// source-graph walk in ai-evals-poke.test.ts — NOT by a build; a bundler substitutes node builtins
// instead of failing on them. Sample data and layout below are poke-local; no ported logic is.
// Nothing here fetches, persists, or measures the visitor: "blessing" only updates local state.
import { useId, useMemo, useState } from "react";
import { Checkbox, StatusChip } from "@caisson-sh/ui/components";
import {
  compareToBaseline,
  mergeIntoBaseline,
} from "@caisson-sh/ai-evals/browser";
import type {
  BaselineFile,
  EvalRun,
  RegressionKind,
} from "@caisson-sh/ai-evals/browser";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./ai-evals-poke.module.css";

// A sample committed baseline (schemaVersion 1), the JSON shape `BLESS=1 bun run eval` writes,
// reviewed and checked in like any other golden fixture. Labeled as a sample below.
export const EVAL_NAME = "assistant-response-quality";
export const SAMPLE_PROMPT_VERSION_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
export const SAMPLE_THRESHOLD = 0.75;
export const COMMITTED_CASES = 40;
export const SHRUNK_CASES = 32;

export const INITIAL_BASELINE: BaselineFile = {
  schemaVersion: 1,
  evals: {
    [EVAL_NAME]: {
      promptVersionId: SAMPLE_PROMPT_VERSION_ID,
      threshold: SAMPLE_THRESHOLD,
      cases: COMMITTED_CASES,
      score: 0.83,
      scorers: { accuracy: 0.85, tone: 0.81 },
    },
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The sample run the sliders author, in the package's real `EvalRun` shape. `scoredCases` is
 * empty on purpose: `compareToBaseline` reads it only inside the opt-in `wilsonFloor` branch, which
 * this demo never sets, and fabricating 40 per-case rows would be inventing evidence to look busy.
 */
export function sampleRun(input: {
  accuracy: number;
  tone: number;
  cases: number;
}): EvalRun {
  const score = round2((input.accuracy + input.tone) / 2);
  return {
    name: EVAL_NAME,
    promptVersionId: SAMPLE_PROMPT_VERSION_ID,
    threshold: SAMPLE_THRESHOLD,
    cases: input.cases,
    score,
    scorers: { accuracy: input.accuracy, tone: input.tone },
    passed: score >= SAMPLE_THRESHOLD,
    scoredCases: [],
  };
}

const REACHABLE_KINDS: readonly RegressionKind[] = [
  "below-threshold",
  "score-regression",
  "scorer-regression",
  "fewer-cases",
];

const KIND_LABEL: Record<RegressionKind, string> = {
  "below-threshold": "below-threshold",
  "score-regression": "score-regression",
  "scorer-regression": "scorer-regression",
  "missing-baseline": "missing-baseline",
  "fewer-cases": "fewer-cases",
  "wilson-below-floor": "wilson-below-floor",
};

export default function AiEvalsPoke() {
  const uid = useId();
  const [accuracy, setAccuracy] = useState(0.85);
  const [tone, setTone] = useState(0.81);
  const [shrinkCases, setShrinkCases] = useState(false);
  const [baseline, setBaseline] = useState<BaselineFile>(INITIAL_BASELINE);
  const [blessError, setBlessError] = useState<string | null>(null);
  const [justBlessed, setJustBlessed] = useState(false);

  const cases = shrinkCases ? SHRUNK_CASES : COMMITTED_CASES;

  const run = useMemo(
    () => sampleRun({ accuracy, tone, cases }),
    [accuracy, tone, cases],
  );
  const score = run.score;

  const comparison = useMemo(
    () => compareToBaseline(run, baseline),
    [run, baseline],
  );

  const committed = baseline.evals[EVAL_NAME];

  function handleSlider(setter: (n: number) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(Number(e.target.value));
      setJustBlessed(false);
    };
  }

  function handleBless() {
    // mergeIntoBaseline runs assertRunEligibleForBaseline itself (WR-01), so a below-threshold run
    // throws before anything merges — computed OUTSIDE the state updater so the throw is catchable.
    try {
      const next = mergeIntoBaseline(baseline, [run]);
      setBaseline(next);
      setBlessError(null);
      setJustBlessed(true);
    } catch (e) {
      setBlessError((e as Error).message);
      setJustBlessed(false);
    }
  }

  return (
    <PokeShell
      label="@caisson-sh/ai-evals"
      title="Every run compares against the committed baseline. Drag a score down to break it."
    >
      <div className={styles.layout}>
        <p className={styles.field}>Sample eval: {EVAL_NAME}</p>

        <div className={styles.sliderGrid}>
          <div className={styles.sliderField}>
            <label htmlFor={`${uid}-accuracy`} className={styles.sliderLabel}>
              accuracy scorer: {accuracy.toFixed(2)}
            </label>
            <input
              id={`${uid}-accuracy`}
              className={styles.range}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={accuracy}
              onChange={handleSlider(setAccuracy)}
            />
          </div>
          <div className={styles.sliderField}>
            <label htmlFor={`${uid}-tone`} className={styles.sliderLabel}>
              tone scorer: {tone.toFixed(2)}
            </label>
            <input
              id={`${uid}-tone`}
              className={styles.range}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={tone}
              onChange={handleSlider(setTone)}
            />
          </div>
        </div>

        <div className={styles.option}>
          <Checkbox
            label={`Simulate a shrunk dataset (${SHRUNK_CASES} cases instead of ${COMMITTED_CASES}, can mask a regression behind a flattering mean)`}
            checked={shrinkCases}
            onChange={(e) => {
              setShrinkCases(e.target.checked);
              setJustBlessed(false);
            }}
          />
        </div>

        <div className={styles.outputPanel}>
          <Verdict state={comparison.passed ? "ok" : "fail"}>
            {comparison.passed
              ? `compareToBaseline() passed. score ${score.toFixed(2)} clears threshold ${SAMPLE_THRESHOLD.toFixed(2)} and the committed baseline.`
              : `compareToBaseline() failed: ${comparison.findings.length} finding${comparison.findings.length === 1 ? "" : "s"}.`}
          </Verdict>
          {comparison.findings.length > 0 ? (
            <ul className={styles.findings}>
              {comparison.findings.map((f, i) => (
                <li key={i} className={styles.finding}>
                  <dl className={styles.register}>
                    <dt>kind</dt>
                    <dd>{f.kind}</dd>
                    {f.scorer !== undefined ? (
                      <>
                        <dt>scorer</dt>
                        <dd>{f.scorer}</dd>
                      </>
                    ) : null}
                    <dt>actual</dt>
                    <dd>{f.actual}</dd>
                    {f.baseline !== undefined ? (
                      <>
                        <dt>baseline</dt>
                        <dd>{f.baseline}</dd>
                      </>
                    ) : null}
                  </dl>
                  <p className={styles.detail}>{f.detail}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className={styles.chipsRow}>
          {REACHABLE_KINDS.map((kind) => (
            <StatusChip
              key={kind}
              label={KIND_LABEL[kind]}
              tone={
                comparison.findings.some((f) => f.kind === kind)
                  ? "accent"
                  : "muted"
              }
            />
          ))}
        </div>
        <p className={styles.note}>
          RegressionKind, the shipped union. Reachable in this demo:
          below-threshold, score-regression, scorer-regression, fewer-cases.
          missing-baseline needs an eval name absent from the baseline (not
          exposed here), and wilson-below-floor needs an opted-in wilsonFloor
          this demo never sets. The comparator running above is the shipped one,
          both branches included.
        </p>

        <div className={styles.bless}>
          <button
            type="button"
            className={styles.blessButton}
            onClick={handleBless}
          >
            Bless this run as the new baseline
          </button>
          <p className={styles.note}>
            Blessing checks only this run&apos;s own threshold, not the old
            baseline, so a regression can be blessed on purpose. It never
            happens as a side effect of a passing or failing run.
          </p>
          {blessError !== null ? (
            <p className={styles.blessError}>Blocked: {blessError}</p>
          ) : null}
          {justBlessed ? (
            <p className={styles.blessOk}>
              Baseline updated in this session only. Nothing was written to
              disk.
            </p>
          ) : null}
        </div>

        {committed !== undefined ? (
          <dl className={styles.register}>
            <dt>committed score</dt>
            <dd>{committed.score.toFixed(2)}</dd>
            <dt>committed cases</dt>
            <dd>{committed.cases}</dd>
            <dt>committed scorers</dt>
            <dd>
              accuracy {committed.scorers.accuracy?.toFixed(2)}, tone{" "}
              {committed.scorers.tone?.toFixed(2)}
            </dd>
          </dl>
        ) : null}
      </div>
    </PokeShell>
  );
}
