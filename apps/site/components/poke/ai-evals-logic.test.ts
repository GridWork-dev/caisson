// Real-package parity for the ai-evals poke's browser mirror (ai-evals-logic.ts). No __golden__
// fixture dir exists for @caisson/ai-evals (checked: packages/ai-evals/src has none), so parity is
// anchored solely against the real package's own functions, imported here by relative path
// (apps/site does not declare @caisson/ai-evals as a workspace dependency, see ai-evals-logic.ts's
// header for why). Bun's test runtime is node-like, so the real package's node:fs/node:path imports
// resolve fine here even though they cannot reach a browser bundle.
import { describe, expect, test } from "bun:test";
import {
  assertRunEligibleForBaseline as pkgAssertRunEligibleForBaseline,
  compareToBaseline as pkgCompareToBaseline,
} from "../../../../packages/ai-evals/src/baseline.ts";
import type { BaselineFile as PkgBaselineFile } from "../../../../packages/ai-evals/src/baseline.ts";
import type { EvalRun } from "../../../../packages/ai-evals/src/define-eval.ts";

import {
  EPS,
  assertRunEligibleForBaseline,
  blessBaseline,
  compareToBaseline,
} from "./ai-evals-logic";
import type { BaselineFile, EvalScoreRun } from "./ai-evals-logic";

const SAMPLE_UUID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const EVAL_NAME = "assistant-response-quality";

interface RunOverride {
  readonly name?: string;
  readonly score?: number;
  readonly threshold?: number;
  readonly cases?: number;
  readonly scorers?: Readonly<Record<string, number>>;
}

function realRun(overrides: RunOverride = {}): EvalRun {
  return {
    name: EVAL_NAME,
    promptVersionId: SAMPLE_UUID,
    threshold: 0.75,
    cases: 40,
    score: 0.83,
    scorers: { accuracy: 0.85, tone: 0.81 },
    passed: true,
    scoredCases: [],
    ...overrides,
  };
}

function mirrorRun(overrides: RunOverride = {}): EvalScoreRun {
  return {
    name: EVAL_NAME,
    promptVersionId: SAMPLE_UUID,
    threshold: 0.75,
    cases: 40,
    score: 0.83,
    scorers: { accuracy: 0.85, tone: 0.81 },
    ...overrides,
  };
}

const BASELINE_ENTRY = {
  promptVersionId: SAMPLE_UUID,
  threshold: 0.75,
  cases: 40,
  score: 0.83,
  scorers: { accuracy: 0.85, tone: 0.81 },
};

const BASELINE: BaselineFile & PkgBaselineFile = {
  schemaVersion: 1,
  evals: { [EVAL_NAME]: BASELINE_ENTRY },
};

describe("compareToBaseline, real-package parity", () => {
  const cases: { label: string; run: RunOverride }[] = [
    { label: "matches the committed baseline exactly (pass)", run: {} },
    {
      label: "below its own threshold",
      run: { score: 0.5, scorers: { accuracy: 0.5, tone: 0.5 } },
    },
    {
      label: "score regresses under the baseline",
      run: { score: 0.8, scorers: { accuracy: 0.79, tone: 0.81 } },
    },
    {
      label: "one scorer regresses while the mean still clears the baseline",
      run: { score: 0.85, scorers: { accuracy: 0.7, tone: 1 } },
    },
    {
      label: "dataset shrinks below the baseline's case count",
      run: { cases: 32 },
    },
    {
      label: "a scorer missing from this run's output is not flagged",
      run: { scorers: { accuracy: 0.85 } },
    },
    {
      label: "no committed baseline for this eval name",
      run: { name: "unseen-eval" },
    },
  ];

  for (const { label, run } of cases) {
    test(label, () => {
      const real = pkgCompareToBaseline(realRun(run), BASELINE);
      const mine = compareToBaseline(mirrorRun(run), BASELINE);
      expect(mine.passed).toBe(real.passed);
      // Compare everything but `detail`: the real package's "missing-baseline" detail string uses
      // an em dash (baseline.ts:103), and this mirror's own copy (ai-evals-logic.ts) deliberately
      // rewords it with a comma instead (ADR-0375, no em dashes in a rendered string this file
      // authors). kind/scorer/baseline/actual still match byte-for-byte.
      expect(mine.findings.map(({ detail: _detail, ...rest }) => rest)).toEqual(
        real.findings.map(({ detail: _detail, ...rest }) => rest),
      );
    });
  }

  test("this mirror's own detail copy never uses an em dash (ADR-0375)", () => {
    const mine = compareToBaseline(
      mirrorRun({ name: "unseen-eval" }),
      BASELINE,
    );
    for (const finding of mine.findings) {
      expect(finding.detail).not.toContain("—");
    }
  });
});

describe("assertRunEligibleForBaseline, real-package parity", () => {
  test("does not throw for an eligible run, mine and real agree", () => {
    expect(() => assertRunEligibleForBaseline(mirrorRun())).not.toThrow();
    expect(() => pkgAssertRunEligibleForBaseline(realRun())).not.toThrow();
  });

  test("throws the identical message as the real function for an ineligible run", () => {
    const ineligible: RunOverride = {
      score: 0.5,
      scorers: { accuracy: 0.5, tone: 0.5 },
    };
    let mineMessage = "";
    let realMessage = "";
    try {
      assertRunEligibleForBaseline(mirrorRun(ineligible));
    } catch (e) {
      mineMessage = (e as Error).message;
    }
    try {
      pkgAssertRunEligibleForBaseline(realRun(ineligible));
    } catch (e) {
      realMessage = (e as Error).message;
    }
    expect(mineMessage).not.toBe("");
    expect(mineMessage).toBe(realMessage);
  });
});

describe("blessBaseline, deliberate re-baseline, never a silent pass", () => {
  test("merges an eligible run's entry without touching other evals", () => {
    const before: BaselineFile = {
      schemaVersion: 1,
      evals: { "other-eval": BASELINE_ENTRY },
    };
    const next = blessBaseline(before, [
      mirrorRun({ score: 0.9, scorers: { accuracy: 0.9, tone: 0.9 } }),
    ]);
    expect(next.evals["other-eval"]).toEqual(before.evals["other-eval"]);
    expect(next.evals[EVAL_NAME]?.score).toBe(0.9);
  });

  test("refuses to bless a below-threshold run, the baseline is returned untouched", () => {
    expect(() =>
      blessBaseline(BASELINE, [
        mirrorRun({ score: 0.5, scorers: { accuracy: 0.5, tone: 0.5 } }),
      ]),
    ).toThrow();
  });

  test("a scorer-regressed run above its own threshold can still be blessed on purpose", () => {
    // WR-01 only guards a run's own threshold, never a comparison to the prior baseline. Bless is
    // a deliberate override, not a second safety net.
    const regressed = mirrorRun({
      score: 0.78,
      scorers: { accuracy: 0.78, tone: 0.78 },
    });
    expect(compareToBaseline(regressed, BASELINE).passed).toBe(false);
    const next = blessBaseline(BASELINE, [regressed]);
    expect(next.evals[EVAL_NAME]?.score).toBe(0.78);
  });
});

describe("EPS, a float-noise guard, not a real tolerance band", () => {
  test("a genuinely equal score never counts as a regression", () => {
    const run = mirrorRun({ score: 0.83 + EPS / 1000 });
    expect(compareToBaseline(run, BASELINE).passed).toBe(true);
  });

  test("a real drop of 0.001 fails", () => {
    const run = mirrorRun({
      score: 0.829,
      scorers: { accuracy: 0.829, tone: 0.829 },
    });
    expect(compareToBaseline(run, BASELINE).passed).toBe(false);
  });
});
