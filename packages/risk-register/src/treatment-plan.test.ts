import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { computeResidual, defineRiskEntry } from "./model.ts";
import type { RiskResidualOverrideRecord } from "./override.ts";
import { buildRiskTreatmentPlan } from "./treatment-plan.ts";

const PKG_SRC_META = new URL("./index.ts", import.meta.url).href;
const DIGEST = "a".repeat(64);

function risk(
  riskId: string,
  treatmentPlan: string | null,
): ReturnType<typeof defineRiskEntry> {
  return defineRiskEntry({
    riskId,
    subject: `${riskId} lane`,
    likelihood: "possible",
    impact: "major",
    treatmentPlan,
    owner: "safety@example.com",
    evidenceDigest: DIGEST,
    crosswalk: [],
  });
}

describe("buildRiskTreatmentPlan", () => {
  test("derives summary counts from the rows, never asserted independently", () => {
    const { plan } = buildRiskTreatmentPlan({
      tenantId: "tenant-acme",
      risks: [risk("R-2", "Mitigation in force."), risk("R-1", null)],
    });
    expect(plan.summary.totalRisks).toBe(2);
    expect(plan.summary.unmitigatedCount).toBe(1);
    expect(plan.summary.overriddenCount).toBe(0);
    // riskId-sorted regardless of input order.
    expect(plan.risks.map((r) => r.riskId)).toEqual(["R-1", "R-2"]);
  });

  test("an override supersedes the effective residual but keeps the computed value on the row", () => {
    const entry = risk("R-1", null);
    const overrideResidual = computeResidual("unlikely", "minor");
    const override: RiskResidualOverrideRecord = {
      kind: "risk.residual-overridden",
      riskId: "R-1",
      computed: entry.residual,
      override: overrideResidual,
      who: "compliance-lead@example.com",
      why: "reason on record",
      at: "2026-07-19T00:00:00.000Z",
    };
    const { plan } = buildRiskTreatmentPlan({
      tenantId: "tenant-acme",
      risks: [entry],
      overridesByRiskId: new Map([["R-1", override]]),
    });
    const row = plan.risks[0];
    expect(row?.computedResidual).toBe(entry.residual);
    expect(row?.effectiveResidual).toBe(overrideResidual);
    expect(row?.overrideOf?.who).toBe("compliance-lead@example.com");
    expect(plan.summary.overriddenCount).toBe(1);
  });

  test("a cast-forged residual is re-derived, never trusted off the entry", () => {
    const entry = risk("R-1", "plan");
    // Simulate a bypassed type brand (an unsafe cast landing a tampered residual on an otherwise
    // valid entry) — the artifact row must never carry this value forward.
    const forged = {
      ...entry,
      residual: 999 as unknown as typeof entry.residual,
    };
    const { plan } = buildRiskTreatmentPlan({
      tenantId: "tenant-acme",
      risks: [forged],
    });
    const row = plan.risks[0];
    expect(row?.computedResidual).toBe(
      computeResidual(entry.likelihood, entry.impact),
    );
    expect(row?.computedResidual).not.toBe(999);
  });

  test("canonicalizes to byte-stable output for identical register state", () => {
    const { canonicalPlan: first } = buildRiskTreatmentPlan({
      tenantId: "tenant-acme",
      risks: [risk("R-1", "plan"), risk("R-2", null)],
    });
    const { canonicalPlan: second } = buildRiskTreatmentPlan({
      tenantId: "tenant-acme",
      // Reversed input order — the artifact is riskId-sorted, so the bytes must match.
      risks: [risk("R-2", null), risk("R-1", "plan")],
    });
    expect(first).toBe(second);
    matchGolden(PKG_SRC_META, "risk-treatment-plan", first);
  });
});
