// @caisson/ai-evals — the regression-vs-committed-baseline comparator + BLESS re-baseline (ADR-0062).
//
// The gate (ADR-0072): an eval suite passes only if it does NOT regress against a committed JSON
// baseline AND each eval clears its own absolute `threshold`. The baseline is the eval equivalent of
// a `matchGolden` fixture (ADR-0013): committed, reviewed, and rewritten ONLY through the sanctioned
// `BLESS` path (mirroring `@caisson/testing` `golden.ts`). This is run as a DISTINCT turbo `eval`
// task in the monorepo — never a required CI job inside a generated buyer repo (ADR-0072).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { EvalRun } from "./define-eval.ts";
import { wilsonLowerBound } from "./wilson.ts";

/** Identical BLESS semantics to `@caisson/testing` `golden.ts` — the one sanctioned rewrite gate. */
function blessEnabled(): boolean {
  const v = process.env.BLESS;
  return (
    v !== undefined && v !== "" && v !== "0" && v.toLowerCase() !== "false"
  );
}

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
    scorers: z.record(z.number().min(0).max(1)),
  })
  .strict();
export type BaselineEntry = z.infer<typeof baselineEntrySchema>;

export const baselineFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    evals: z.record(baselineEntrySchema),
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

export interface BaselineGateResult {
  readonly passed: boolean;
  readonly blessed: boolean;
  readonly comparisons: readonly BaselineComparison[];
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

  // Wilson-CI gate augmentation (ADR-0208), opt-in and additive: unset `wilsonFloor` → zero behavior
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

function readBaselineFile(file: string): BaselineFile {
  return baselineFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

/** Load + validate a committed baseline file. Fail-closed: a missing file is an error, not empty. */
export function loadBaseline(file: string): BaselineFile {
  if (!existsSync(file)) {
    throw new Error(
      `baseline file missing: ${file}\n  create it with:  BLESS=1 bun run eval   (then review the diff)`,
    );
  }
  return readBaselineFile(file);
}

/**
 * The regression gate. Compares each run to the committed baseline at `file`.
 *
 * With `BLESS` set, REWRITES the baseline from the current runs (merging into any existing entries so
 * a partial run never drops other evals) and passes — the sole sanctioned re-baseline path. Without
 * `BLESS`, returns `passed: false` if ANY run regressed, missed its threshold, or lacked a baseline.
 */
export function gateAgainstBaseline(
  file: string,
  runs: readonly EvalRun[],
): BaselineGateResult {
  if (blessEnabled()) {
    const existing = existsSync(file)
      ? readBaselineFile(file)
      : {
          schemaVersion: 1 as const,
          evals: {} as Record<string, BaselineEntry>,
        };
    const evals: Record<string, BaselineEntry> = { ...existing.evals };
    for (const run of runs) evals[run.name] = runToEntry(run);
    const next: BaselineFile = { schemaVersion: 1, evals };
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    return {
      passed: true,
      blessed: true,
      comparisons: runs.map((r) => ({
        eval: r.name,
        passed: true,
        findings: [],
        blessed: true,
      })),
    };
  }

  const baseline = loadBaseline(file);
  const comparisons = runs.map((r) => compareToBaseline(r, baseline));
  return {
    passed: comparisons.every((c) => c.passed),
    blessed: false,
    comparisons,
  };
}
