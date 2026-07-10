import { describe, expect, test } from "bun:test";

import { validateRun } from "./validate-run";

const validRun = {
  runId: "run-1",
  rootDir: "outputs/browser-audit/run-1",
  findings: [
    {
      id: "finding-1",
      category: "behavior",
      severity: "P1",
      confidence: "high",
      ring: "buyer",
      journey: "buyer-plan",
      url: "https://caisson.sh/dashboard/plan",
      viewport: "1440x900",
      theme: "dark",
      authState: "probe",
      steps: ["open plan", "cancel dialog"],
      observed: "dialog loses focus",
      expected: "focus returns to trigger",
      evidence: ["screenshots/before.png", "screenshots/after.png"],
      ruleSource: "Impeccable accessibility: focus return",
      replay: { cleanSession: true, attempts: 1, reproduced: true },
    },
  ],
};

describe("run evidence validation", () => {
  test("accepts replayed P1 findings with relative evidence", () => {
    expect(validateRun(validRun).findings).toHaveLength(1);
  });

  test("rejects escaping evidence paths", () => {
    expect(() =>
      validateRun({
        ...validRun,
        findings: [{ ...validRun.findings[0]!, evidence: ["../secret.txt"] }],
      }),
    ).toThrow("evidence path");
  });

  test("requires clean-session replay for P0 and P1", () => {
    expect(() =>
      validateRun({
        ...validRun,
        findings: [
          {
            ...validRun.findings[0]!,
            replay: { cleanSession: false, attempts: 1, reproduced: true },
          },
        ],
      }),
    ).toThrow("clean-session replay");
  });
});
