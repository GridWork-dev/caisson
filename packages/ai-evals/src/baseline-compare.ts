// @caisson-sh/ai-evals — the PURE half of the regression-vs-baseline gate: the baseline file's
// boundary schema, the comparison, the pre-BLESS eligibility check, and the BLESS merge. No file
// I/O, no `process`, no node builtin — `baseline.ts` keeps the load/save transport and delegates
// here, so the gate's rules have exactly ONE implementation and this module can also ride the
// package's `./browser` entry point.
//
// The only non-relative edge is `zod`; `EvalRun` is a TYPE import (erased at emit, no bundle-graph
// edge). `browser-safety.test.ts` proves both claims by a static source-graph walk.
import { z } from "zod";
import type { EvalRun } from "./define-eval.ts";
import { wilsonLowerBound } from "./wilson.ts";

// Float tolerance: scores are rounded means; only a real drop below baseline counts as a regression.
const EPS = 1e-9;

// --- Baseline file boundary schema --------------------------------------------------------------

export const baselineEntrySchema = z
  .object({
    promptVersionId: z.string().uuid(),
    promptRef: z.string().optional(),
    threshold: z.number().min(0).max(1),
    cases: z.number().int().nonnegative(),
    score: z.number().min(0).max(1),
    scorers: z.record(z.string(), z.number().min(0).max(1)),
  })
  .strict();
export type BaselineEntry = z.infer<typeof baselineEntrySchema>;

export const baselineFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    evals: z.record(z.string(), baselineEntrySchema),
  })
  .strict();
export type BaselineFile = z.infer<typeof baselineFileSchema>;

// --- Comparison ---------------------------------------------------------------------------------

export type RegressionKind =
  | "below-threshold"
  | "score-regression"
  | "scorer-regression"
  | "missing-baseline"
  | "fewer-cases"
  | "wilson-below-floor";

export interface RegressionFinding {
  readonly kind: RegressionKind;
  readonly scorer?: string;
  readonly baseline?: number;
  readonly actual: number;
  readonly detail: string;
}

export interface BaselineComparison {
  readonly eval: string;
  readonly passed: boolean;
  readonly findings: readonly RegressionFinding[];
  readonly blessed: boolean;
}

/**
 * Compare one run to the committed baseline. Fail-closed: an eval that has NO baseline entry fails
 * (bless to record it first), and an eval below its own `threshold` fails regardless of the baseline.
 * A shrunk dataset is flagged too — fewer cases can mask a regression behind a flattering mean.
 */
export function compareToBaseline(
  run: EvalRun,
  baseline: BaselineFile,
): BaselineComparison {
  const findings: RegressionFinding[] = [];

  if (run.score + EPS < run.threshold) {
    findings.push({
      kind: "below-threshold",
      actual: run.score,
      baseline: run.threshold,
      detail: `score ${run.score} < threshold ${run.threshold}`,
    });
  }

  const prior = baseline.evals[run.name];
  if (prior === undefined) {
    findings.push({
      kind: "missing-baseline",
      actual: run.score,
      detail: `no committed baseline for eval "${run.name}" — bless to record it`,
    });
    return { eval: run.name, passed: false, findings, blessed: false };
  }

  if (run.score + EPS < prior.score) {
    findings.push({
      kind: "score-regression",
      actual: run.score,
      baseline: prior.score,
      detail: `score ${run.score} worse than baseline ${prior.score}`,
    });
  }

  for (const [name, base] of Object.entries(prior.scorers)) {
    const actual = run.scorers[name];
    if (actual === undefined) continue; // scorer absent this run — a shape change, not a regression
    if (actual + EPS < base) {
      findings.push({
        kind: "scorer-regression",
        scorer: name,
        actual,
        baseline: base,
        detail: `scorer "${name}" ${actual} worse than baseline ${base}`,
      });
    }
  }

  if (run.cases < prior.cases) {
    findings.push({
      kind: "fewer-cases",
      actual: run.cases,
      baseline: prior.cases,
      detail: `dataset shrank from ${prior.cases} to ${run.cases} cases`,
    });
  }

  // Wilson-CI gate augmentation (ADR-0214), opt-in and additive: unset `wilsonFloor` → zero behavior
  // change (skips this block entirely). Per-scorer successes come from `scoredCases[].passes[scorer]`
  // over `run.cases` — a confidence floor distinct from `threshold` (which gates the mean), looser,
  // to catch a lucky-draw small sample rather than a genuinely low score.
  if (run.wilsonFloor !== undefined) {
    for (const scorer of Object.keys(run.scorers)) {
      const successes = run.scoredCases.filter(
        (sc) => sc.passes[scorer] === true,
      ).length;
      const lowerBound = wilsonLowerBound(successes, run.cases);
      if (lowerBound < run.wilsonFloor - EPS) {
        findings.push({
          kind: "wilson-below-floor",
          scorer,
          actual: lowerBound,
          baseline: run.wilsonFloor,
          detail: `scorer "${scorer}" Wilson lower bound ${lowerBound} (successes=${successes}/${run.cases}) below floor ${run.wilsonFloor}`,
        });
      }
    }
  }

  return {
    eval: run.name,
    passed: findings.length === 0,
    findings,
    blessed: false,
  };
}

function runToEntry(run: EvalRun): BaselineEntry {
  return {
    promptVersionId: run.promptVersionId,
    ...(run.promptRef !== undefined ? { promptRef: run.promptRef } : {}),
    threshold: run.threshold,
    cases: run.cases,
    score: run.score,
    scorers: { ...run.scorers },
  };
}

/**
 * Pre-BLESS eligibility gate (WR-01): throws if `run.score` is below its own `threshold` (the same
 * `EPS` tolerance `compareToBaseline` uses for a real float compare). `gateAgainstBaseline`'s BLESS
 * branch has no threshold check of its own — without this, `BLESS=1` on a genuinely failing run
 * would silently overwrite the committed baseline with that failing score, turning "trust the
 * baseline" into "trust whatever last got blessed." Called for every run BEFORE any read/write, so a
 * throw here leaves the baseline file completely untouched.
 */
export function assertRunEligibleForBaseline(run: EvalRun): void {
  if (run.score + EPS < run.threshold) {
    throw new Error(
      `eval "${run.name}" is not baseline-eligible: score ${String(run.score)} < threshold ${String(run.threshold)}`,
    );
  }
}

/**
 * The BLESS re-baseline merge, as a pure function: every run must clear
 * {@link assertRunEligibleForBaseline} first (WR-01 — enforced HERE so no caller can skip it), then
 * each run's entry overwrites (or adds) its eval in a COPY of `existing`, leaving every other eval
 * untouched. Returns a new file; persisting it is the caller's job (`gateAgainstBaseline` writes it,
 * an in-browser consumer just holds it).
 */
export function mergeIntoBaseline(
  existing: BaselineFile,
  runs: readonly EvalRun[],
): BaselineFile {
  for (const run of runs) assertRunEligibleForBaseline(run);
  const evals: Record<string, BaselineEntry> = { ...existing.evals };
  for (const run of runs) evals[run.name] = runToEntry(run);
  return { schemaVersion: 1, evals };
}
