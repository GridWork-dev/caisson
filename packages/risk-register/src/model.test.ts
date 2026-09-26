import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import {
  computeResidual,
  defineRiskEntry,
  isResidual,
  type RiskEntry,
  type RiskEntryInput,
} from "./model.ts";

const DIGEST = "a".repeat(64);

function baseInput(overrides: Partial<RiskEntryInput> = {}): RiskEntryInput {
  return {
    riskId: "R-1",
    subject: "default model lane",
    likelihood: "possible",
    impact: "major",
    treatmentPlan: "Rate-limited with a human-review fallback.",
    owner: "safety@example.com",
    evidenceDigest: DIGEST,
    crosswalk: [],
    ...overrides,
  };
}

describe("computeResidual", () => {
  test("is the product of the likelihood and impact ordinals", () => {
    // Widened to `number` for the comparison — `Residual`'s brand is exactly what's under test
    // below, not something a plain-number golden value needs to carry.
    expect(computeResidual("rare", "negligible") as number).toBe(1);
    expect(computeResidual("almost-certain", "severe") as number).toBe(25);
    expect(computeResidual("possible", "major") as number).toBe(12);
  });

  test("isResidual accepts only the 1-25 integer range computeResidual can produce", () => {
    expect(isResidual(computeResidual("possible", "major"))).toBe(true);
    expect(isResidual(0)).toBe(false);
    expect(isResidual(26)).toBe(false);
    expect(isResidual(3.5)).toBe(false);
    expect(isResidual("12")).toBe(false);
  });
});

describe("defineRiskEntry", () => {
  test("derives residual from likelihood x impact, never from caller input", () => {
    const entry = defineRiskEntry(baseInput());
    expect(entry.residual).toBe(computeResidual("possible", "major"));
  });

  test("allows a null treatmentPlan — identified and scored, not yet mitigated", () => {
    const entry = defineRiskEntry(baseInput({ treatmentPlan: null }));
    expect(entry.treatmentPlan).toBeNull();
  });

  test("rejects an empty riskId", () => {
    expect(() => defineRiskEntry(baseInput({ riskId: "" }))).toThrow(
      ValidationError,
    );
  });

  test("rejects a malformed evidenceDigest", () => {
    expect(() =>
      defineRiskEntry(baseInput({ evidenceDigest: "not-a-digest" })),
    ).toThrow(ValidationError);
  });
});

describe("residual is type-derived, never freeform", () => {
  test("a freeform residual literal is rejected by the type checker, not merely at runtime", () => {
    const entry = defineRiskEntry(baseInput());
    // @ts-expect-error — `residual` carries a nominal Residual brand; a bare number literal (even
    // one in the valid 1-25 range) can never satisfy it. The only way to a Residual is
    // computeResidual(), proven above — this line exists to keep that guarantee compiler-checked.
    const bad: RiskEntry = { ...entry, residual: 9 };
    // Runtime proof that this is a real, checkable line (not dead code eliminated away): the
    // reassignment above is exactly what a freeform edit would look like if it compiled.
    expect(bad.riskId).toBe(entry.riskId);
  });
});
