// @caisson-sh/ai-evals — the eval gate CLI (ADR-0062 / ADR-0072). The runnable behind the DISTINCT
// turbo `eval` task: it runs the committed eval suite against the committed JSON baseline and exits
// non-zero on a regression, BLESS-style. This is a MONOREPO-only gate — it is NEVER injected into a
// generated buyer repo as a required CI job (ADR-0072): a buyer owns their own eval cadence.
//
// Offline + deterministic by construction: model-graded scorers replay a committed
// cassette, never a live provider call, never a secret. `BLESS=1 bun run eval` is the one sanctioned
// re-baseline path (see `baseline.ts`).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gateAgainstBaseline, type BaselineGateResult } from "./baseline.ts";
import { defineEval, parseDataset } from "./define-eval.ts";
import type { EvalRun, Grader } from "./index.ts";
import { injectionGrader, judgeGrader, regexGrader } from "./graders.ts";
import { cassetteJudge, parseCassette } from "./judge.ts";
import {
  trajectoryApprovalComplianceGrader,
  trajectoryBudgetAdherenceGrader,
  trajectoryToolChoiceGrader,
  trajectoryUnnecessaryCallGrader,
} from "./trajectory-graders.ts";

// Fixtures live at the package root (one level up from `src/`), the layout the harness tests assert.
const PKG_ROOT = join(import.meta.dir, "..");
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(join(PKG_ROOT, rel), "utf8"));

const BASELINE_FILE = join(PKG_ROOT, "__evals__/baseline.json");

async function runSuite(): Promise<readonly EvalRun[]> {
  const complianceDataset = parseDataset(
    readJson("__evals__/compliance-answer.case.json"),
  );
  const injectionDataset = parseDataset(
    readJson("__evals__/injection-defense.case.json"),
  );
  const faithfulnessCassette = parseCassette(
    readJson("__cassettes__/compliance-answer.json"),
  );

  const complianceScorers: Readonly<Record<string, Grader>> = {
    "cites-control": regexGrader(),
    faithfulness: judgeGrader(cassetteJudge(faithfulnessCassette)),
  };
  const compliance = await defineEval({
    name: complianceDataset.eval,
    promptVersionId: complianceDataset.promptVersionId,
    threshold: complianceDataset.threshold,
    cases: complianceDataset.cases,
    scorers: complianceScorers,
  });

  const injection = await defineEval({
    name: injectionDataset.eval,
    promptVersionId: injectionDataset.promptVersionId,
    threshold: injectionDataset.threshold,
    cases: injectionDataset.cases,
    scorers: { "injection-resist": injectionGrader() },
    // Wilson-CI floor (ADR-0214), armed on the injection-class scorer: at 20/20 passes the 95%
    // lower bound is n/(n+z²) ≈ 0.839, so 0.8 passes with headroom but hard-fails any dataset
    // shrunk below 16 cases even at a perfect score — a sample-size guard the mean can't provide.
    wilsonFloor: 0.8,
  });

  // Trajectory-quality (ADR-0360 U-7): all four graders are deterministic — no cassette, no judge.
  // The dataset deliberately carries one RED case per grader (incl. the parent-SPEC acceptance row,
  // a budget-violation case) so the mean sits below a perfect 1.0 by design; `threshold` (0.8, set
  // in the committed dataset) is the bar a real regression must cross to redden this gate — the
  // per-case isolation proof (each red case fails exactly ONE scorer) lives in
  // trajectory-quality.eval.test.ts, not here.
  const trajectoryDataset = parseDataset(
    readJson("__evals__/trajectory-quality.case.json"),
  );
  const trajectory = await defineEval({
    name: trajectoryDataset.eval,
    promptVersionId: trajectoryDataset.promptVersionId,
    ...(trajectoryDataset.promptRef !== undefined
      ? { promptRef: trajectoryDataset.promptRef }
      : {}),
    threshold: trajectoryDataset.threshold,
    cases: trajectoryDataset.cases,
    scorers: {
      "tool-choice": trajectoryToolChoiceGrader(),
      "unnecessary-call": trajectoryUnnecessaryCallGrader(),
      "approval-compliance": trajectoryApprovalComplianceGrader(),
      "budget-adherence": trajectoryBudgetAdherenceGrader(),
    },
  });

  return [compliance, injection, trajectory];
}

function report(gate: BaselineGateResult): void {
  if (gate.blessed) {
    process.stdout.write(
      `eval: BLESSED — rewrote ${BASELINE_FILE} from ${gate.comparisons.length} run(s)\n`,
    );
    return;
  }
  for (const c of gate.comparisons) {
    if (c.passed) {
      process.stdout.write(`eval: PASS  ${c.eval}\n`);
      continue;
    }
    process.stdout.write(`eval: FAIL  ${c.eval}\n`);
    for (const f of c.findings)
      process.stdout.write(`  - ${f.kind}: ${f.detail}\n`);
  }
}

if (import.meta.main) {
  // Fail-closed: any throw (a cassette miss, a malformed fixture) exits non-zero — the gate never
  // passes by accident.
  const runs = await runSuite();
  const gate = gateAgainstBaseline(BASELINE_FILE, runs);
  report(gate);
  process.exit(gate.passed ? 0 : 1);
}
