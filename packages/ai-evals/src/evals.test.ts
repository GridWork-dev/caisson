// @caisson/ai-evals harness tests (ADR-0062). Fully offline + deterministic: model graders replay a
// committed cassette, never a live call (SPEC TM6). Asserts: the grader taxonomy; the injection
// grader is a fail-closed class that can't be loosened (TM9); the cassette judge fails closed on a
// miss; the committed evals match the committed baseline with BLESS unset; a worse-than-baseline run
// fails the gate. The T10 fixtures (baseline + cases + cassette) precede this logic (golden-first).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
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
import { cassetteJudge, parseCassette } from "./judge.ts";

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

describe("injection grader (fail-closed, its own class — TM9)", () => {
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

describe("dataset boundary", () => {
  test("parseDataset rejects an unknown field (.strict)", () => {
    expect(() =>
      parseDataset({ ...complianceDataset, sneaky: true }),
    ).toThrow();
  });
});
