// src/treatment-plan.ts — the risk-treatment-plan evidence artifact. Same discipline as
// `@caisson-sh/compliance-core`'s evidence-pack manifest: a typed, canonicalizable body whose summary
// counts are DERIVED from the rows, never asserted by the caller, so the same register state
// always canonicalizes to the same bytes. `buildRiskTreatmentPlan` is pure — no I/O, no clock — the
// caller resolves which override (if any) governs each riskId and injects it.
import { z } from "zod";
import {
  canonicalize,
  parseStrict,
  strictObject,
  type JsonValue,
} from "@caisson-sh/kernel";
import { CrosswalkReference } from "@caisson-sh/frameworks-pack/registry";
import {
  computeResidual,
  Impact,
  Likelihood,
  type RiskEntry,
} from "./model.ts";
import type { RiskResidualOverrideRecord } from "./override.ts";

export const RISK_TREATMENT_PLAN_FORMAT_VERSION = "1" as const;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const residualValue = z.number().int().min(1).max(25);

/** One row's override, when a later exception record governs it instead of the computed score. */
const treatmentPlanOverride = strictObject({
  who: z.string().trim().min(1).max(200),
  why: z.string().trim().min(1).max(2000),
  at: z.string().trim().min(1).max(40),
  residual: residualValue,
});

/**
 * One risk's treatment-plan row. `computedResidual` is ALWAYS the model's derived score — present
 * whether or not an override governs the row, so the computed value stays recoverable straight off
 * the artifact, not only from the underlying WORM chain. `effectiveResidual` is the score that
 * governs today: the override's, when `overrideOf` is present, else the computed value.
 */
const treatmentPlanRow = strictObject({
  riskId: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(500),
  likelihood: Likelihood,
  impact: Impact,
  computedResidual: residualValue,
  effectiveResidual: residualValue,
  overrideOf: treatmentPlanOverride.optional(),
  treatmentPlan: z.string().trim().min(1).max(2000).nullable(),
  owner: z.string().trim().min(1).max(200),
  evidenceDigest: z.string().regex(SHA256_HEX),
  crosswalk: z.array(CrosswalkReference),
}).superRefine((row, ctx) => {
  const expected = row.overrideOf?.residual ?? row.computedResidual;
  if (row.effectiveResidual !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveResidual"],
      message: `effectiveResidual (${String(row.effectiveResidual)}) must equal ${row.overrideOf ? "the override's" : "the computed"} value ${String(expected)} — derived, never asserted independently`,
    });
  }
});
export type RiskTreatmentPlanRow = z.infer<typeof treatmentPlanRow>;

/** Readiness-style posture line — the same "N of M" phrasing convention the evidence-pack
 *  generator uses, never a "compliant"/"certified" claim. */
function posturePhrase(
  total: number,
  unmitigated: number,
  overridden: number,
): string {
  const head = `${String(total)} risk${total === 1 ? "" : "s"} on register`;
  const mitigated = total - unmitigated;
  const tail = `${String(mitigated)} of ${String(total)} carry a recorded treatment plan`;
  const overrideTail =
    overridden === 0
      ? ""
      : `; ${String(overridden)} residual${overridden === 1 ? "" : "s"} carry an operator override`;
  return `${head}; ${tail}${overrideTail}.`;
}

const treatmentPlanSummary = strictObject({
  totalRisks: z.number().int().nonnegative(),
  overriddenCount: z.number().int().nonnegative(),
  unmitigatedCount: z.number().int().nonnegative(),
  posture: z.string().trim().min(1).max(1000),
});

export const riskTreatmentPlanSchema = strictObject({
  formatVersion: z.literal(RISK_TREATMENT_PLAN_FORMAT_VERSION),
  tenantId: z.string().trim().min(1).max(200),
  risks: z.array(treatmentPlanRow),
  summary: treatmentPlanSummary,
}).superRefine((plan, ctx) => {
  const totalRisks = plan.risks.length;
  const overriddenCount = plan.risks.filter(
    (r) => r.overrideOf !== undefined,
  ).length;
  const unmitigatedCount = plan.risks.filter(
    (r) => r.treatmentPlan === null,
  ).length;
  const mismatches: ReadonlyArray<readonly [string, number, number]> = [
    ["totalRisks", plan.summary.totalRisks, totalRisks],
    ["overriddenCount", plan.summary.overriddenCount, overriddenCount],
    ["unmitigatedCount", plan.summary.unmitigatedCount, unmitigatedCount],
  ];
  for (const [field, got, want] of mismatches) {
    if (got !== want) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["summary", field],
        message: `summary.${field} must equal the derived value ${String(want)} (no fabricated counts)`,
      });
    }
  }
});
export type RiskTreatmentPlan = z.infer<typeof riskTreatmentPlanSchema>;

export interface BuildRiskTreatmentPlanInput {
  readonly tenantId: string;
  readonly risks: readonly RiskEntry[];
  /** The latest override (if any) per riskId — the caller resolves "latest" from the chain; this
   *  builder stays pure and does no chain reads of its own. */
  readonly overridesByRiskId?: ReadonlyMap<string, RiskResidualOverrideRecord>;
}

export interface RiskTreatmentPlanArtifact {
  readonly plan: RiskTreatmentPlan;
  /** `canonicalize(plan)` — byte-stable across identical register state. */
  readonly canonicalPlan: string;
}

/** Locale-independent lexicographic comparator — determinism must not depend on locale. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Round-trip to a genuine `JsonValue` so `canonicalize` accepts the already-validated plan. */
function toJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/**
 * Assemble the risk-treatment-plan artifact from a register snapshot plus the overrides (if any)
 * that govern it. Pure: no I/O, no clock. Rows are riskId-sorted so input order never changes the
 * output bytes; the summary is derived and re-checked by the schema, never asserted here.
 */
export function buildRiskTreatmentPlan(
  input: BuildRiskTreatmentPlanInput,
): RiskTreatmentPlanArtifact {
  const overrides: ReadonlyMap<string, RiskResidualOverrideRecord> =
    input.overridesByRiskId ?? new Map();
  const rows: z.input<typeof treatmentPlanRow>[] = input.risks.map((r) => {
    const ov = overrides.get(r.riskId);
    // Re-derive from likelihood/impact rather than trusting `r.residual` — a cast-forged entry
    // (bypassing model.ts's type brand) could otherwise carry a tampered residual straight into
    // a compliance artifact. Every blessed entry re-derives to the same value it already carried.
    const computed = computeResidual(r.likelihood, r.impact);
    // Conditionally OMIT the key rather than set it to `undefined` — the schema's `overrideOf` is
    // an optional field (present-or-absent), and this tree's `exactOptionalPropertyTypes` rejects
    // an explicit `undefined` value for one (mirrors @caisson-sh/audit-worm's chain-store convention).
    return {
      riskId: r.riskId,
      subject: r.subject,
      likelihood: r.likelihood,
      impact: r.impact,
      computedResidual: computed,
      effectiveResidual: ov === undefined ? computed : ov.override,
      ...(ov === undefined
        ? {}
        : {
            overrideOf: {
              who: ov.who,
              why: ov.why,
              at: ov.at,
              residual: ov.override,
            },
          }),
      treatmentPlan: r.treatmentPlan,
      owner: r.owner,
      evidenceDigest: r.evidenceDigest,
      crosswalk: r.crosswalk,
    };
  });
  rows.sort((a, b) => cmp(a.riskId, b.riskId));

  const totalRisks = rows.length;
  const overriddenCount = input.risks.filter((r) =>
    overrides.has(r.riskId),
  ).length;
  const unmitigatedCount = rows.filter((r) => r.treatmentPlan === null).length;

  const plan = parseStrict(riskTreatmentPlanSchema, {
    formatVersion: RISK_TREATMENT_PLAN_FORMAT_VERSION,
    tenantId: input.tenantId,
    risks: rows,
    summary: {
      totalRisks,
      overriddenCount,
      unmitigatedCount,
      posture: posturePhrase(totalRisks, unmitigatedCount, overriddenCount),
    },
  });
  return { plan, canonicalPlan: canonicalize(toJson(plan)) };
}
