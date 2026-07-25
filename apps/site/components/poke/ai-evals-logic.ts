// Deterministic client-side mirror of @caisson/ai-evals's regression-vs-baseline gate
// (packages/ai-evals/src/baseline.ts, ADR-0072) for the "ai-evals" poke (ADR-0378 lock 2). Every
// export below is a faithful, standalone port of the package's pure comparison logic. Nothing here
// fetches, persists, measures, or uses Date.now / Math.random in a rendered-output path.
//
// Why mirrored instead of imported: baseline.ts imports node:fs (existsSync/mkdirSync/readFileSync/
// writeFileSync) and node:path (dirname) at module scope for loadBaseline/gateAgainstBaseline's file
// I/O. apps/site does not declare @caisson/ai-evals as a workspace dependency, and even if it did,
// the package's export map exposes only "." (src/index.ts, the whole barrel), no subpath around
// baseline.ts, so importing any binding from it would pull those node builtins into a client bundle.
// compareToBaseline and assertRunEligibleForBaseline are ported verbatim below, their real bodies
// never touch fs/path.
//
// One deliberate omission: compareToBaseline's opt-in `wilsonFloor` branch (ADR-0214) is left out.
// It is additive, "unset -> zero behavior change" per the real function's own comment, and this
// poke never sets it, so the two functions are indistinguishable on every input this file exercises
// (pinned by the parity test importing the real function directly). The `RegressionKind` union below
// still lists "wilson-below-floor" for type parity with the package, even though this mirror's
// compareToBaseline never emits it.
//
// blessBaseline has no real analog: gateAgainstBaseline's BLESS branch reads/writes the baseline
// FILE (fs again). This is the same merge (runToEntry + assertRunEligibleForBaseline first, WR-01),
// stripped of file I/O, returning a new in-memory BaselineFile the caller may hold in state. It never
// touches disk, and it is only ever invoked by an explicit user click, never implicitly.
//
// Parity is golden-pinned in ai-evals-logic.test.ts against the real package (imported by relative
// path, no committed __golden__ fixture exists for @caisson/ai-evals).

/** Float tolerance for score comparisons, verbatim: baseline.ts `EPS`. Only a REAL drop counts. */
export const EPS = 1e-9;

export interface EvalScoreRun {
  readonly name: string;
  readonly promptVersionId: string;
  readonly promptRef?: string;
  readonly threshold: number;
  readonly cases: number;
  readonly score: number;
  readonly scorers: Readonly<Record<string, number>>;
}

export interface BaselineEntry {
  readonly promptVersionId: string;
  readonly promptRef?: string;
  readonly threshold: number;
  readonly cases: number;
  readonly score: number;
  readonly scorers: Readonly<Record<string, number>>;
}

export interface BaselineFile {
  readonly schemaVersion: 1;
  readonly evals: Readonly<Record<string, BaselineEntry>>;
}

// Verbatim: baseline.ts `RegressionKind`.
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
 * Compare one run to the committed baseline. Fail-closed: an eval with NO baseline entry fails
 * (bless to record it first), and an eval below its own `threshold` fails regardless of the
 * baseline. Verbatim port of baseline.ts `compareToBaseline`, minus the opt-in Wilson-CI block
 * (see file header).
 */
export function compareToBaseline(
  run: EvalScoreRun,
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
      detail: `no committed baseline for eval "${run.name}", bless to record it`,
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
    if (actual === undefined) continue; // scorer absent this run: a shape change, not a regression
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

  return {
    eval: run.name,
    passed: findings.length === 0,
    findings,
    blessed: false,
  };
}

/**
 * Pre-BLESS eligibility gate (WR-01), verbatim: baseline.ts `assertRunEligibleForBaseline`. Throws
 * if `run.score` is below its own `threshold`, so a below-threshold run can never overwrite the
 * committed baseline, blessed or not.
 */
export function assertRunEligibleForBaseline(run: EvalScoreRun): void {
  if (run.score + EPS < run.threshold) {
    throw new Error(
      `eval "${run.name}" is not baseline-eligible: score ${String(run.score)} < threshold ${String(run.threshold)}`,
    );
  }
}

/** Verbatim: baseline.ts `runToEntry`. */
function runToEntry(run: EvalScoreRun): BaselineEntry {
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
 * The BLESS re-baseline path, stripped of file I/O (see file header). Mirrors
 * `gateAgainstBaseline`'s BLESS branch: every run must clear `assertRunEligibleForBaseline` first
 * (a below-threshold run throws before anything merges), then each run's entry overwrites (or adds)
 * its eval in a COPY of the existing file, other evals untouched. Returns a new `BaselineFile`; the
 * caller decides what to do with it (this poke holds it in React state, never writes it anywhere).
 * Only ever called from an explicit click, never from `compareToBaseline`.
 */
export function blessBaseline(
  existing: BaselineFile,
  runs: readonly EvalScoreRun[],
): BaselineFile {
  for (const run of runs) assertRunEligibleForBaseline(run);
  const evals: Record<string, BaselineEntry> = { ...existing.evals };
  for (const run of runs) evals[run.name] = runToEntry(run);
  return { schemaVersion: 1, evals };
}
