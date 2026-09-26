// @caisson-sh/ai-evals harness tests (ADR-0062). Fully offline + deterministic: model graders replay a
// committed cassette, never a live call. Asserts: the grader taxonomy; the injection
// grader is a fail-closed class that can't be loosened; the cassette judge fails closed on a
// miss; the committed evals match the committed baseline with BLESS unset; a worse-than-baseline run
// fails the gate. The baseline/cases/cassette fixtures precede this logic (golden-first).
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  assertRunEligibleForBaseline,
  compareToBaseline,
  gateAgainstBaseline,
  loadBaseline,
} from "./baseline.ts";
import { defineEval, parseDataset } from "./define-eval.ts";
import type { EvalRun, Grader } from "./index.ts";
import {
  exactGrader,
  injectionGrader,
  jsonShapeGrader,
  judgeGrader,
  regexGrader,
  schemaGrader,
} from "./graders.ts";
import { cassetteJudge, judgeRequestSchema, parseCassette } from "./judge.ts";
import type { Judge } from "./judge.ts";

const FIXTURES = join(import.meta.dir, "..");
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, rel), "utf8"));

const BASELINE_FILE = join(FIXTURES, "__evals__/baseline.json");

const complianceDataset = parseDataset(
  readJson("__evals__/compliance-answer.case.json"),
);
const injectionDataset = parseDataset(
  readJson("__evals__/injection-defense.case.json"),
);
const faithfulnessCassette = parseCassette(
  readJson("__cassettes__/compliance-answer.json"),
);

const args = (output: string, expected: unknown) => ({
  eval: "t",
  scorer: "s",
  caseId: "c",
  input: {},
  output,
  expected,
});

describe("deterministic graders", () => {
  test("exact: equality only", async () => {
    expect((await exactGrader()(args("hello", { equals: "hello" }))).pass).toBe(
      true,
    );
    expect((await exactGrader()(args("hello", { equals: "world" }))).pass).toBe(
      false,
    );
  });

  test("regex: pattern match", async () => {
    expect(
      (await regexGrader()(args("order #1234", { matches: "#\\d+" }))).pass,
    ).toBe(true);
    expect(
      (await regexGrader()(args("no number", { matches: "#\\d+" }))).pass,
    ).toBe(false);
  });

  test("json-shape: dot-path required keys", async () => {
    const ok = await jsonShapeGrader()(
      args('{"a":{"b":1}}', { requiredKeys: ["a.b"] }),
    );
    expect(ok.pass).toBe(true);
    const missing = await jsonShapeGrader()(
      args('{"a":{}}', { requiredKeys: ["a.b"] }),
    );
    expect(missing.pass).toBe(false);
    const notJson = await jsonShapeGrader()(
      args("not json", { requiredKeys: ["a"] }),
    );
    expect(notJson.pass).toBe(false);
  });

  test("schema: Zod validation of JSON output", async () => {
    const grader = schemaGrader(z.object({ n: z.number() }).strict());
    expect((await grader(args('{"n":5}', undefined))).pass).toBe(true);
    expect((await grader(args('{"n":"x"}', undefined))).pass).toBe(false);
  });
});

describe("injection grader (fail-closed, its own class)", () => {
  test("blocks a leaked forbidden token", async () => {
    const r = await injectionGrader()(
      args("ok, SECRET_LEAKED here", { mustNotContain: ["SECRET_LEAKED"] }),
    );
    expect(r.pass).toBe(false);
    expect(r.score).toBe(0);
  });

  test("passes clean output (case-insensitive by default)", async () => {
    const r = await injectionGrader()(
      args("a normal compliant answer", {
        mustNotContain: ["OVERRIDDEN", "DAN"],
      }),
    );
    expect(r.pass).toBe(true);
    expect(r.score).toBe(1);
  });

  test("rubric cannot be disabled: an empty deny-list throws", () => {
    expect(() =>
      injectionGrader()(args("anything", { mustNotContain: [] })),
    ).toThrow();
  });
});

describe("cassette judge (replay, fail-closed)", () => {
  test("returns the recorded verdict for a known case", async () => {
    const judge = cassetteJudge(faithfulnessCassette);
    const verdict = await judge.evaluate({
      model: judge.model,
      eval: "compliance-answer",
      scorer: "faithfulness",
      caseId: "cc6.1-logical-access",
      input: {},
      output: "irrelevant under replay",
    });
    expect(verdict.verdict).toBe("pass");
    expect(verdict.score).toBe(1);
  });

  test("a cassette miss rejects (never a silent pass)", () => {
    const judge = cassetteJudge(faithfulnessCassette);
    expect(
      judge.evaluate({
        model: judge.model,
        eval: "compliance-answer",
        scorer: "faithfulness",
        caseId: "not-recorded",
        input: {},
        output: "x",
      }),
    ).rejects.toThrow(/cassette miss/);
  });
});

describe("judgeGrader validates a LIVE verdict (fail-closed — e1b26983)", () => {
  // A fake LIVE judge that returns whatever score it is handed (mimics a real judge JSON.parsing
  // an LLM reply and casting to JudgeVerdict without bounds).
  const fakeJudge = (score: number): Judge => ({
    model: "fake",
    evaluate: () => Promise.resolve({ verdict: "pass", score, rationale: "f" }),
  });

  test("an out-of-range score (999) is rejected, never a silent pass", () => {
    expect(
      judgeGrader(fakeJudge(999))(args("out", undefined)),
    ).rejects.toThrow();
  });

  test("a NaN score is rejected", () => {
    expect(
      judgeGrader(fakeJudge(NaN))(args("out", undefined)),
    ).rejects.toThrow();
  });

  test("a valid 0..1 score flows through unchanged", async () => {
    const r = await judgeGrader(fakeJudge(0.7))(args("out", undefined));
    expect(r.score).toBe(0.7);
    expect(r.pass).toBe(true);
  });

  test("a bad verdict FAILS the whole eval run (no silent PASS of a failing case)", () => {
    expect(
      defineEval({
        name: "t",
        promptVersionId: complianceDataset.promptVersionId,
        threshold: 0.8,
        cases: [{ id: "c1", input: {}, output: "some answer" }],
        scorers: { faithfulness: judgeGrader(fakeJudge(999)) },
      }),
    ).rejects.toThrow();
  });
});

describe("judgeRequestSchema output bound (98a14a41)", () => {
  const base = {
    model: "m",
    eval: "e",
    scorer: "s",
    caseId: "c",
    input: {},
  };

  test("an output over the cap is rejected at the schema boundary", () => {
    expect(() =>
      judgeRequestSchema.parse({ ...base, output: "x".repeat(100_001) }),
    ).toThrow();
  });

  test("an output within the cap is accepted", () => {
    expect(() =>
      judgeRequestSchema.parse({ ...base, output: "x".repeat(100_000) }),
    ).not.toThrow();
  });
});

async function runCompliance(): Promise<EvalRun> {
  const scorers: Record<string, Grader> = {
    "cites-control": regexGrader(),
    faithfulness: judgeGrader(cassetteJudge(faithfulnessCassette)),
  };
  return defineEval({
    name: complianceDataset.eval,
    promptVersionId: complianceDataset.promptVersionId,
    threshold: complianceDataset.threshold,
    cases: complianceDataset.cases,
    scorers,
  });
}

async function runInjection(): Promise<EvalRun> {
  return defineEval({
    name: injectionDataset.eval,
    promptVersionId: injectionDataset.promptVersionId,
    threshold: injectionDataset.threshold,
    cases: injectionDataset.cases,
    scorers: { "injection-resist": injectionGrader() },
  });
}

describe("regression gate vs committed baseline (BLESS unset)", () => {
  test("the committed evals match the committed baseline", async () => {
    const compliance = await runCompliance();
    expect(compliance.score).toBe(1);
    expect(compliance.passed).toBe(true);
    expect(compliance.scorers).toEqual({
      "cites-control": 1,
      faithfulness: 1,
    });

    const injection = await runInjection();
    expect(injection.score).toBe(1);
    expect(injection.scorers).toEqual({ "injection-resist": 1 });

    const gate = gateAgainstBaseline(BASELINE_FILE, [compliance, injection]);
    expect(gate.blessed).toBe(false);
    expect(gate.passed).toBe(true);
  });

  test("a worse-than-baseline run fails (regression + below-threshold)", () => {
    const baseline = loadBaseline(BASELINE_FILE);
    const degraded: EvalRun = {
      name: "compliance-answer",
      promptVersionId: complianceDataset.promptVersionId,
      threshold: 0.8,
      cases: 3,
      score: 0.5,
      scorers: { "cites-control": 0.5, faithfulness: 0.5 },
      passed: false,
      scoredCases: [],
    };
    const cmp = compareToBaseline(degraded, baseline);
    expect(cmp.passed).toBe(false);
    expect(cmp.findings.map((f) => f.kind)).toContain("below-threshold");
    expect(cmp.findings.map((f) => f.kind)).toContain("score-regression");
    expect(cmp.findings.map((f) => f.kind)).toContain("scorer-regression");
  });
});

describe("assertRunEligibleForBaseline — the pre-BLESS guard (WR-01)", () => {
  const degradedRun: EvalRun = {
    name: "t",
    promptVersionId: complianceDataset.promptVersionId,
    threshold: 0.8,
    cases: 1,
    score: 0.3,
    scorers: { s: 0.3 },
    passed: false,
    scoredCases: [],
  };
  const greenRun: EvalRun = {
    ...degradedRun,
    score: 1,
    scorers: { s: 1 },
    passed: true,
  };

  test("a below-threshold run throws", () => {
    expect(() => assertRunEligibleForBaseline(degradedRun)).toThrow(
      /not baseline-eligible/,
    );
  });

  test("a run at or above threshold does not throw", () => {
    expect(() => assertRunEligibleForBaseline(greenRun)).not.toThrow();
    expect(() =>
      assertRunEligibleForBaseline({ ...degradedRun, score: 0.8 }),
    ).not.toThrow();
  });

  describe("wired into gateAgainstBaseline's BLESS branch", () => {
    let dir: string;
    let file: string;
    const originalBless = process.env.BLESS;

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
      if (originalBless === undefined) delete process.env.BLESS;
      else process.env.BLESS = originalBless;
    });

    test("BLESS on a below-threshold run throws and leaves the file untouched", () => {
      dir = mkdtempSync(join(tmpdir(), "ai-evals-bless-"));
      file = join(dir, "baseline.json");
      const before = { schemaVersion: 1 as const, evals: {} };
      writeFileSync(file, JSON.stringify(before));
      process.env.BLESS = "1";

      expect(() => gateAgainstBaseline(file, [degradedRun])).toThrow(
        /not baseline-eligible/,
      );
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(before);
    });

    test("BLESS on a green run writes normally", () => {
      dir = mkdtempSync(join(tmpdir(), "ai-evals-bless-"));
      file = join(dir, "baseline.json");
      process.env.BLESS = "1";

      const gate = gateAgainstBaseline(file, [greenRun]);
      expect(gate.blessed).toBe(true);
      expect(gate.passed).toBe(true);
      const written = JSON.parse(readFileSync(file, "utf8"));
      expect(written.evals.t.score).toBe(1);
    });
  });
});

describe("Wilson-CI gate augmentation (ADR-0214, opt-in additive)", () => {
  test("wilsonFloor unset: the committed evals gate is unaffected (no wilson-below-floor finding)", async () => {
    const compliance = await runCompliance();
    expect(compliance.wilsonFloor).toBeUndefined();
    const baseline = loadBaseline(BASELINE_FILE);
    const cmp = compareToBaseline(compliance, baseline);
    expect(cmp.passed).toBe(true);
    expect(cmp.findings.map((f) => f.kind)).not.toContain("wilson-below-floor");
  });

  test("defineEval threads wilsonFloor onto the returned EvalRun", async () => {
    const run = await defineEval({
      name: "t",
      promptVersionId: complianceDataset.promptVersionId,
      threshold: 0.5,
      wilsonFloor: 0.3,
      cases: [
        { id: "c1", input: {}, output: "hello", expected: { equals: "hello" } },
      ],
      scorers: { exact: exactGrader() },
    });
    expect(run.wilsonFloor).toBe(0.3);
  });

  test("a small 100%-pass sample clears a low wilsonFloor", () => {
    const baseline = loadBaseline(BASELINE_FILE);
    const run: EvalRun = {
      name: "compliance-answer",
      promptVersionId: complianceDataset.promptVersionId,
      threshold: 0.5,
      cases: 3,
      score: 1,
      scorers: { "cites-control": 1 },
      passed: true,
      scoredCases: [
        {
          caseId: "a",
          scores: { "cites-control": 1 },
          passes: { "cites-control": true },
          score: 1,
        },
        {
          caseId: "b",
          scores: { "cites-control": 1 },
          passes: { "cites-control": true },
          score: 1,
        },
        {
          caseId: "c",
          scores: { "cites-control": 1 },
          passes: { "cites-control": true },
          score: 1,
        },
      ],
      wilsonFloor: 0.3,
    };
    const cmp = compareToBaseline(run, baseline);
    expect(cmp.findings.map((f) => f.kind)).not.toContain("wilson-below-floor");
  });

  test("a small 100%-pass sample MISSES a high wilsonFloor (lucky-draw catch)", () => {
    const baseline = loadBaseline(BASELINE_FILE);
    const run: EvalRun = {
      name: "compliance-answer",
      promptVersionId: complianceDataset.promptVersionId,
      threshold: 0.5,
      cases: 3,
      score: 1,
      scorers: { "cites-control": 1 },
      passed: true,
      scoredCases: [
        {
          caseId: "a",
          scores: { "cites-control": 1 },
          passes: { "cites-control": true },
          score: 1,
        },
        {
          caseId: "b",
          scores: { "cites-control": 1 },
          passes: { "cites-control": true },
          score: 1,
        },
        {
          caseId: "c",
          scores: { "cites-control": 1 },
          passes: { "cites-control": true },
          score: 1,
        },
      ],
      wilsonFloor: 0.9,
    };
    const cmp = compareToBaseline(run, baseline);
    expect(cmp.passed).toBe(false);
    const finding = cmp.findings.find((f) => f.kind === "wilson-below-floor");
    expect(finding).toBeDefined();
    expect(finding?.scorer).toBe("cites-control");
  });

  test("a partially-failing scorer lowers the bound enough to miss a moderate floor", () => {
    const baseline = loadBaseline(BASELINE_FILE);
    const run: EvalRun = {
      name: "compliance-answer",
      promptVersionId: complianceDataset.promptVersionId,
      threshold: 0.5,
      cases: 4,
      score: 0.75,
      scorers: { "cites-control": 0.75 },
      passed: true,
      scoredCases: [
        {
          caseId: "a",
          scores: { "cites-control": 1 },
          passes: { "cites-control": true },
          score: 1,
        },
        {
          caseId: "b",
          scores: { "cites-control": 1 },
          passes: { "cites-control": true },
          score: 1,
        },
        {
          caseId: "c",
          scores: { "cites-control": 1 },
          passes: { "cites-control": true },
          score: 1,
        },
        {
          caseId: "d",
          scores: { "cites-control": 0 },
          passes: { "cites-control": false },
          score: 0,
        },
      ],
      wilsonFloor: 0.6,
    };
    const cmp = compareToBaseline(run, baseline);
    expect(cmp.findings.map((f) => f.kind)).toContain("wilson-below-floor");
  });
});

describe("dataset boundary", () => {
  test("parseDataset rejects an unknown field (.strict)", () => {
    expect(() =>
      parseDataset({ ...complianceDataset, sneaky: true }),
    ).toThrow();
  });
});
