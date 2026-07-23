// Golden + real-package parity for the risk-register poke's browser mirror
// (risk-register-logic.ts). Two independent anchors: (1) the committed golden fixture
// packages/risk-register/src/__golden__/risk-treatment-plan.txt, and (2) the real package's own
// functions, imported here by relative path (apps/site does not declare @caisson/risk-register as
// a workspace dependency, see risk-register-logic.ts's header for why. Bun's test runtime is
// node-like, so the real package's @caisson/kernel / @caisson/frameworks-pack imports resolve fine
// here even though they cannot reach a browser bundle.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import type { AppendResult, AuditChainStore } from "@caisson/audit-worm";
import type { JsonValue } from "@caisson/kernel";

import {
  computeResidual as pkgComputeResidual,
  isResidual as pkgIsResidual,
} from "../../../../packages/risk-register/src/model.ts";
import type { Residual as PkgResidual } from "../../../../packages/risk-register/src/model.ts";
import { recordResidualOverride as pkgRecordResidualOverride } from "../../../../packages/risk-register/src/override.ts";

import {
  IMPACTS,
  LIKELIHOODS,
  SAMPLE_IMPACT,
  SAMPLE_LIKELIHOOD,
  SAMPLE_NOW,
  SAMPLE_RISK_ID,
  computeResidual,
  deriveEffectiveResidual,
  isResidual,
  recordResidualOverride,
  residualMatrix,
} from "./risk-register-logic";
import type { Impact, Likelihood } from "./risk-register-logic";

/**
 * Strips the nominal `Residual` brand for cross-module equality checks: this file's mirror and the
 * real package each declare their own `unique symbol` brand, so the two `Residual` types are
 * structurally identical but nominally distinct. A JSON round-trip compares the plain values
 * underneath without a brand-stripping cast at every call site.
 */
function plain<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

const GOLDEN = JSON.parse(
  readFileSync(
    join(
      import.meta.dir,
      "../../../../packages/risk-register/src/__golden__/risk-treatment-plan.txt",
    ),
    "utf8",
  ),
) as {
  risks: {
    riskId: string;
    likelihood: Likelihood;
    impact: Impact;
    computedResidual: number;
  }[];
};

describe("computeResidual, golden fixture parity", () => {
  test("matches the committed golden fixture's R-1 computedResidual", () => {
    const r1 = GOLDEN.risks.find((r) => r.riskId === "R-1");
    if (r1 === undefined) throw new Error("golden fixture missing R-1");
    expect(Number(computeResidual(r1.likelihood, r1.impact))).toBe(
      r1.computedResidual,
    );
  });

  test("every risk row in the golden fixture round-trips through computeResidual", () => {
    for (const r of GOLDEN.risks) {
      expect(Number(computeResidual(r.likelihood, r.impact))).toBe(
        r.computedResidual,
      );
    }
  });

  test("the poke's own sample entry matches the golden fixture's R-1", () => {
    const r1 = GOLDEN.risks.find((r) => r.riskId === "R-1");
    if (r1 === undefined) throw new Error("golden fixture missing R-1");
    expect(SAMPLE_RISK_ID).toBe(r1.riskId);
    expect(SAMPLE_LIKELIHOOD).toBe(r1.likelihood);
    expect(SAMPLE_IMPACT).toBe(r1.impact);
    expect(Number(computeResidual(SAMPLE_LIKELIHOOD, SAMPLE_IMPACT))).toBe(
      r1.computedResidual,
    );
  });
});

describe("computeResidual / isResidual, real-package parity", () => {
  test("agrees with the real model.ts computeResidual on every likelihood x impact pair", () => {
    for (const likelihood of LIKELIHOODS) {
      for (const impact of IMPACTS) {
        expect(Number(computeResidual(likelihood, impact))).toBe(
          Number(pkgComputeResidual(likelihood, impact)),
        );
      }
    }
  });

  test("residualMatrix covers all 25 pairs and each cell matches the real product", () => {
    const cells = residualMatrix();
    expect(cells).toHaveLength(25);
    for (const cell of cells) {
      expect(Number(cell.residual)).toBe(
        Number(pkgComputeResidual(cell.likelihood, cell.impact)),
      );
    }
  });

  test("agrees with the real isResidual on boundary and off-shape values", () => {
    const cases: unknown[] = [0, 1, 12, 25, 26, 1.5, "12", -1, Number.NaN];
    for (const value of cases) {
      expect(isResidual(value)).toBe(pkgIsResidual(value));
    }
  });
});

/** A minimal fake chain satisfying `Pick<AuditChainStore, "append">`, enough to drive the real
 *  `recordResidualOverride`'s validation without a database. */
function fakeChain(): Pick<AuditChainStore, "append"> {
  return {
    append: (_accountId: string, payload: JsonValue): Promise<AppendResult> =>
      Promise.resolve({
        entry: { seq: 0, prevHash: null, payload, hash: "0".repeat(64) },
        anchor: { length: 1, tipHash: "0".repeat(64) },
      }),
  };
}

describe("recordResidualOverride, real-package parity", () => {
  test("a valid override produces the same chained record as the real primitive (minus evidence)", async () => {
    const computed = computeResidual("possible", "major");
    const real = await pkgRecordResidualOverride({
      chain: fakeChain(),
      accountId: "acct_a",
      riskId: SAMPLE_RISK_ID,
      computed: computed as unknown as PkgResidual,
      overrideLikelihood: "unlikely",
      overrideImpact: "minor",
      who: "compliance-lead@example.com",
      why: "Compensating control verified out of band.",
      now: SAMPLE_NOW,
    });
    const mine = recordResidualOverride({
      riskId: SAMPLE_RISK_ID,
      computed,
      overrideLikelihood: "unlikely",
      overrideImpact: "minor",
      who: "compliance-lead@example.com",
      why: "Compensating control verified out of band.",
      now: SAMPLE_NOW,
    });
    if (mine.outcome !== "recorded")
      throw new Error("expected a recorded override");
    expect(plain(mine.record)).toEqual(plain(real.record));
  });

  test("the computed residual is carried through untouched, never recomputed (not a silent overwrite)", () => {
    const computed = computeResidual("rare", "severe"); // 5
    const outcome = recordResidualOverride({
      riskId: SAMPLE_RISK_ID,
      computed,
      overrideLikelihood: "almost-certain",
      overrideImpact: "severe",
      who: "ciso@example.com",
      why: "Escalated after a new finding.",
      now: SAMPLE_NOW,
    });
    if (outcome.outcome !== "recorded")
      throw new Error("expected a recorded override");
    expect(outcome.record.computed).toBe(computed);
    expect(outcome.record.override).toBe(
      computeResidual("almost-certain", "severe"),
    );
    expect(outcome.record.computed).not.toBe(outcome.record.override);
  });

  test("deriveEffectiveResidual governs by the latest override, else falls back to computed", () => {
    const computed = computeResidual("possible", "major");
    expect(deriveEffectiveResidual(computed, null)).toBe(computed);
    const outcome = recordResidualOverride({
      riskId: SAMPLE_RISK_ID,
      computed,
      overrideLikelihood: "rare",
      overrideImpact: "negligible",
      who: "owner@example.com",
      why: "Downgraded after remediation shipped.",
      now: SAMPLE_NOW,
    });
    if (outcome.outcome !== "recorded")
      throw new Error("expected a recorded override");
    expect(Number(deriveEffectiveResidual(computed, outcome.record))).toBe(1);
  });

  const rejectionCases: {
    name: string;
    input: { riskId: string; who: string; why: string };
  }[] = [
    {
      name: "empty riskId",
      input: { riskId: "  ", who: "a@example.com", why: "reason" },
    },
    { name: "empty who", input: { riskId: "R-1", who: "  ", why: "reason" } },
    {
      name: "who over 200 chars",
      input: { riskId: "R-1", who: "x".repeat(201), why: "reason" },
    },
    {
      name: "empty why",
      input: { riskId: "R-1", who: "a@example.com", why: "  " },
    },
    {
      name: "why over 2000 chars",
      input: { riskId: "R-1", who: "a@example.com", why: "x".repeat(2001) },
    },
  ];

  for (const { name, input } of rejectionCases) {
    test(`rejects ${name} with the same message the real primitive throws`, async () => {
      const computed = computeResidual("possible", "major");
      let realMessage: string | null = null;
      try {
        await pkgRecordResidualOverride({
          chain: fakeChain(),
          accountId: "acct_a",
          riskId: input.riskId,
          computed: computed as unknown as PkgResidual,
          overrideLikelihood: "unlikely",
          overrideImpact: "minor",
          who: input.who,
          why: input.why,
          now: SAMPLE_NOW,
        });
      } catch (err) {
        realMessage = err instanceof Error ? err.message : String(err);
      }
      if (realMessage === null) {
        throw new Error("expected the real primitive to throw");
      }

      const mine = recordResidualOverride({
        riskId: input.riskId,
        computed,
        overrideLikelihood: "unlikely",
        overrideImpact: "minor",
        who: input.who,
        why: input.why,
        now: SAMPLE_NOW,
      });
      if (mine.outcome !== "rejected")
        throw new Error("expected a rejected override");
      expect(mine.error.message).toBe(realMessage);
      expect(mine.error.code).toBe("validation_error");
      expect(mine.error.httpStatus).toBe(400);
    });
  }
});
