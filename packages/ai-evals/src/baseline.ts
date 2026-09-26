// @caisson-sh/ai-evals — the regression-vs-committed-baseline comparator + BLESS re-baseline (ADR-0062).
//
// The gate (ADR-0072): an eval suite passes only if it does NOT regress against a committed JSON
// baseline AND each eval clears its own absolute `threshold`. The baseline is the eval equivalent of
// a `matchGolden` fixture (ADR-0013): committed, reviewed, and rewritten ONLY through the sanctioned
// `BLESS` path (mirroring `@caisson-sh/testing` `golden.ts`). This is run as a DISTINCT turbo `eval`
// task in the monorepo — never a required CI job inside a generated buyer repo (ADR-0072).
//
// THIS module is the file-I/O half only: load, gate, write. The gate's RULES — the boundary schema,
// `compareToBaseline`, `assertRunEligibleForBaseline`, and the BLESS merge — live in the node-free
// `baseline-compare.ts` and are re-exported below so every existing import keeps working.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { EvalRun } from "./define-eval.ts";
import {
  assertRunEligibleForBaseline,
  baselineFileSchema,
  compareToBaseline,
  mergeIntoBaseline,
} from "./baseline-compare.ts";
import type { BaselineComparison, BaselineFile } from "./baseline-compare.ts";

export {
  assertRunEligibleForBaseline,
  baselineEntrySchema,
  baselineFileSchema,
  compareToBaseline,
  mergeIntoBaseline,
} from "./baseline-compare.ts";
export type {
  BaselineComparison,
  BaselineEntry,
  BaselineFile,
  RegressionFinding,
  RegressionKind,
} from "./baseline-compare.ts";

/** Identical BLESS semantics to `@caisson-sh/testing` `golden.ts` — the one sanctioned rewrite gate. */
function blessEnabled(): boolean {
  const v = process.env.BLESS;
  return (
    v !== undefined && v !== "" && v !== "0" && v.toLowerCase() !== "false"
  );
}

export interface BaselineGateResult {
  readonly passed: boolean;
  readonly blessed: boolean;
  readonly comparisons: readonly BaselineComparison[];
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
 * a partial run never drops other evals) and passes — the sole sanctioned re-baseline path. Every run
 * must clear `assertRunEligibleForBaseline` FIRST (WR-01) — a below-threshold run throws before
 * anything is read or written, never partially blessed. Without `BLESS`, returns `passed: false` if
 * ANY run regressed, missed its threshold, or lacked a baseline.
 */
export function gateAgainstBaseline(
  file: string,
  runs: readonly EvalRun[],
): BaselineGateResult {
  if (blessEnabled()) {
    // WR-01 twice over, deliberately: here so a throw precedes any READ, and again inside
    // `mergeIntoBaseline` so no other caller of the merge can skip it.
    for (const run of runs) assertRunEligibleForBaseline(run);
    const existing = existsSync(file)
      ? readBaselineFile(file)
      : {
          schemaVersion: 1 as const,
          evals: {},
        };
    const next = mergeIntoBaseline(existing, runs);
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
