// The trajectory-quality eval suite (ADR-0360 U-7 / PLAN task 3): the committed dataset (fixtures
// folded from REAL `runToolLoop`/`resumeToolLoop` runs against the AI SDK mock model, deterministic,
// zero network) graded by the four deterministic trajectory graders, gated against the committed
// baseline exactly like evals.test.ts does for compliance-answer/injection-defense. All four graders
// are deterministic — no cassette, no judge, so task 4 (judged criteria) is a no-op for this eval.
//
// The dataset deliberately carries one RED case per grader, INCLUDING the parent-SPEC acceptance
// row (budget-violation) — this file is the proof each grader actually bites (isn't a rubber stamp)
// AND that its red signal stays ISOLATED to the ONE scorer it's meant to catch (Kickoff-R lesson:
// fail-closed paths must not mask each other). The overall run still clears `threshold` (0.8, set in
// the dataset) — EVAL stays green while proving the harness catches a real violation.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareToBaseline, loadBaseline } from "./baseline.ts";
import { defineEval, parseDataset } from "./define-eval.ts";
import type { EvalRun, Grader, ScoredCase } from "./index.ts";
import {
  trajectoryApprovalComplianceGrader,
  trajectoryBudgetAdherenceGrader,
  trajectoryToolChoiceGrader,
  trajectoryUnnecessaryCallGrader,
} from "./trajectory-graders.ts";

const FIXTURES = join(import.meta.dir, "..");
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, rel), "utf8"));
const BASELINE_FILE = join(FIXTURES, "__evals__/baseline.json");

const dataset = parseDataset(
  readJson("__evals__/trajectory-quality.case.json"),
);

async function runTrajectoryQuality(): Promise<EvalRun> {
  const scorers: Record<string, Grader> = {
    "tool-choice": trajectoryToolChoiceGrader(),
    "unnecessary-call": trajectoryUnnecessaryCallGrader(),
    "approval-compliance": trajectoryApprovalComplianceGrader(),
    "budget-adherence": trajectoryBudgetAdherenceGrader(),
  };
  return defineEval({
    name: dataset.eval,
    promptVersionId: dataset.promptVersionId,
    ...(dataset.promptRef !== undefined
      ? { promptRef: dataset.promptRef }
      : {}),
    threshold: dataset.threshold,
    cases: dataset.cases,
    scorers,
  });
}

function caseFor(run: EvalRun, id: string): ScoredCase {
  const found = run.scoredCases.find((c) => c.caseId === id);
  if (found === undefined) throw new Error(`no scored case "${id}"`);
  return found;
}

/** Every scorer key in `passes` EXCEPT `redScorer` must be `true` — the Kickoff-R isolation check:
 *  a dedicated red case's violation must not leak into an unrelated grader. */
function expectIsolatedRed(sc: ScoredCase, redScorer: string): void {
  expect(sc.passes[redScorer]).toBe(false);
  for (const [scorer, ok] of Object.entries(sc.passes)) {
    if (scorer === redScorer) continue;
    expect(ok).toBe(true);
  }
}

describe("trajectory-quality eval — deterministic graders over a real runToolLoop trajectory", () => {
  test("all four graders are deterministic (no judge/cassette needed for this eval)", () => {
    // Task 4: judged criteria are only added where a deterministic grader can't reach. Every
    // scorer this dataset declares is one of the four pure graders above — nothing here calls a
    // Judge port, so there is no cassette to replay and no live driver to inject.
    expect(dataset.scorers.sort()).toEqual(
      [
        "approval-compliance",
        "budget-adherence",
        "tool-choice",
        "unnecessary-call",
      ].sort(),
    );
  });

  test("the run clears its own threshold and matches the committed baseline (EVAL stays green)", async () => {
    const run = await runTrajectoryQuality();
    expect(run.passed).toBe(true);
    expect(run.cases).toBe(6);

    const baseline = loadBaseline(BASELINE_FILE);
    const cmp = compareToBaseline(run, baseline);
    expect(cmp.passed).toBe(true);
    expect(cmp.findings).toEqual([]);
  });

  test("happy-path and gated-approved pass every scorer", async () => {
    const run = await runTrajectoryQuality();
    for (const id of ["happy-path", "gated-approved"]) {
      const sc = caseFor(run, id);
      expect(Object.values(sc.passes).every(Boolean)).toBe(true);
    }
  });

  test("disallowed-tool fails ONLY tool-choice", async () => {
    const run = await runTrajectoryQuality();
    expectIsolatedRed(caseFor(run, "disallowed-tool"), "tool-choice");
  });

  test("duplicate-call fails ONLY unnecessary-call", async () => {
    const run = await runTrajectoryQuality();
    expectIsolatedRed(caseFor(run, "duplicate-call"), "unnecessary-call");
  });

  test("unauthorized-approval fails ONLY approval-compliance", async () => {
    const run = await runTrajectoryQuality();
    expectIsolatedRed(
      caseFor(run, "unauthorized-approval"),
      "approval-compliance",
    );
  });

  // THE parent-SPEC acceptance row (PLAN task 3): a deliberate budget-violation case fails RED,
  // isolated to budget-adherence alone — proving the harness bites without a masking artifact.
  test("budget-violation — THE acceptance row — fails ONLY budget-adherence, RED and isolated", async () => {
    const run = await runTrajectoryQuality();
    const sc = caseFor(run, "budget-violation");
    expectIsolatedRed(sc, "budget-adherence");
    expect(sc.scores["budget-adherence"]).toBe(0);
  });
});
