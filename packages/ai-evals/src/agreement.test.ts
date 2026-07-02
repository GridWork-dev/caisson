// Agreement tests (ADR-0214). Perfect-agreement → kappa 1; a hand-computed partial fixture pins the
// formula; a stability-score fixture pins `counterfactualStability`.
import { describe, expect, test } from "bun:test";
import {
  counterfactualStability,
  ensembleAgreement,
  fleissKappa,
} from "./agreement.ts";

describe("fleissKappa", () => {
  test("perfect agreement (every item unanimous, category varies across items) → kappa 1", () => {
    // 3 items, 3 raters, 2 categories [pass, fail]: items 1-2 unanimous pass, item 3 unanimous fail.
    const counts = [
      [3, 0],
      [3, 0],
      [0, 3],
    ];
    expect(fleissKappa(counts)).toBeCloseTo(1, 10);
  });

  test("hand-computed partial-agreement fixture (-11/45)", () => {
    // 2 items, 4 raters, 2 categories: item1 = 3 pass/1 fail, item2 = 2 pass/2 fail.
    // p_pass=5/8, p_fail=3/8 → peBar=17/32. P1=6/12=1/2, P2=4/12=1/3 → pBar=5/12.
    // kappa = (5/12 - 17/32) / (1 - 17/32) = (-11/96) / (45/96) = -11/45.
    const counts = [
      [3, 1],
      [2, 2],
    ];
    expect(fleissKappa(counts)).toBeCloseTo(-11 / 45, 10);
  });

  test("throws on an empty item list", () => {
    expect(() => fleissKappa([])).toThrow();
  });

  test("throws when rater count is inconsistent across items", () => {
    expect(() =>
      fleissKappa([
        [3, 1],
        [2, 1],
      ]),
    ).toThrow();
  });

  test("throws when there are fewer than 2 raters", () => {
    expect(() => fleissKappa([[1, 0]])).toThrow();
  });
});

describe("ensembleAgreement", () => {
  test("tallies per-case verdicts and matches the hand-computed fixture", () => {
    // Same shape as the fleissKappa partial fixture, expressed as raw verdicts.
    const verdicts: Array<Array<"pass" | "fail">> = [
      ["pass", "pass", "pass", "fail"],
      ["pass", "pass", "fail", "fail"],
    ];
    expect(ensembleAgreement(verdicts)).toBeCloseTo(-11 / 45, 10);
  });

  test("perfect agreement across all raters and items → kappa 1", () => {
    const verdicts: Array<Array<"pass" | "fail">> = [
      ["pass", "pass", "pass"],
      ["fail", "fail", "fail"],
    ];
    expect(ensembleAgreement(verdicts)).toBeCloseTo(1, 10);
  });
});

describe("counterfactualStability", () => {
  test("a known variant set: 2 of 3 agree with base", () => {
    const result = counterfactualStability("pass", ["pass", "pass", "fail"]);
    expect(result).toEqual({ agree: 2, total: 3, stabilityScore: 2 / 3 });
  });

  test("full agreement → stabilityScore 1", () => {
    const result = counterfactualStability("fail", ["fail", "fail"]);
    expect(result.stabilityScore).toBe(1);
  });

  test("full disagreement → stabilityScore 0", () => {
    const result = counterfactualStability("pass", ["fail", "fail"]);
    expect(result.stabilityScore).toBe(0);
  });

  test("zero variants → vacuously stable (documented ceiling)", () => {
    const result = counterfactualStability("pass", []);
    expect(result).toEqual({ agree: 0, total: 0, stabilityScore: 1 });
  });
});
