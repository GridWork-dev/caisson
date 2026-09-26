// src/model.ts — the framework-agnostic risk model. A register entry is a riskId + subject rated
// on a likelihood/impact scale; the residual risk score is ALWAYS the computed product of that
// rating, never a value the caller supplies directly — `computeResidual` is the one function that
// can produce a `Residual`, and its return type carries a nominal brand a plain number literal
// cannot satisfy, so a freeform residual is rejected by the type checker before any validator runs
// (a Zod cross-check backstops it at the value layer too, but the type system is the primary gate).
//
// Reuses `@caisson-sh/frameworks-pack`'s `CrosswalkReference` for the crosswalk[] pointer pattern
// rather than inventing a second one — a risk entry points into a shipped framework pack's
// canonical controls exactly the way a canonical control points at an external framework.
import { z } from "zod";
import { strictObject, parseStrict } from "@caisson-sh/kernel";
import { CrosswalkReference } from "@caisson-sh/frameworks-pack/registry";

const SHA256_HEX = /^[0-9a-f]{64}$/;

export const Likelihood = z.enum([
  "rare",
  "unlikely",
  "possible",
  "likely",
  "almost-certain",
]);
export type Likelihood = z.infer<typeof Likelihood>;

export const Impact = z.enum([
  "negligible",
  "minor",
  "moderate",
  "major",
  "severe",
]);
export type Impact = z.infer<typeof Impact>;

const LIKELIHOOD_ORDINAL: Readonly<Record<Likelihood, number>> = {
  rare: 1,
  unlikely: 2,
  possible: 3,
  likely: 4,
  "almost-certain": 5,
};

const IMPACT_ORDINAL: Readonly<Record<Impact, number>> = {
  negligible: 1,
  minor: 2,
  moderate: 3,
  major: 4,
  severe: 5,
};

declare const RESIDUAL_BRAND: unique symbol;
/**
 * A residual-risk score (1-25): the likelihood ordinal times the impact ordinal. `computeResidual`
 * is the ONLY function that returns this type — the brand is a phantom property no plain number
 * carries, so assigning a bare number literal where a `Residual` is expected fails at compile time,
 * not merely at a runtime range check.
 */
export type Residual = number & { readonly [RESIDUAL_BRAND]: true };

/** The one path to a `Residual` value: pure ordinal multiplication, no I/O, no caller override. */
export function computeResidual(
  likelihood: Likelihood,
  impact: Impact,
): Residual {
  return (LIKELIHOOD_ORDINAL[likelihood] * IMPACT_ORDINAL[impact]) as Residual;
}

/** True for exactly the values `computeResidual` can produce (1-25, integer). */
export function isResidual(value: unknown): value is Residual {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 25
  );
}

const residualSchema = z.custom<Residual>(isResidual, {
  message: "residual must be a value computeResidual() produced (1-25)",
});

/** Fields a caller authors. `residual` is deliberately absent — `defineRiskEntry` derives it, so
 *  it is never accepted as untrusted input. */
const riskEntryAuthoredFields = {
  riskId: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(500),
  likelihood: Likelihood,
  impact: Impact,
  /** What will be done about this risk, or `null` when no treatment is on record yet — an
   *  identified, scored, unmitigated risk is a real and common register state. */
  treatmentPlan: z.string().trim().min(1).max(2000).nullable(),
  owner: z.string().trim().min(1).max(200),
  /** SHA-256 hex digest of the evidence this scoring rests on. */
  evidenceDigest: z.string().regex(SHA256_HEX),
  /** Pointers into any shipped framework pack's canonical controls — the same shape
   *  `CanonicalControl.crosswalk` uses, reused rather than re-invented. */
  crosswalk: z.array(CrosswalkReference).default([]),
};

export const RiskEntryInput = strictObject(riskEntryAuthoredFields);
export type RiskEntryInput = z.input<typeof RiskEntryInput>;

/**
 * A fully-scored risk-register row. `residual` is derived, cross-checked here against
 * `computeResidual(likelihood, impact)` so a hand-assembled object that somehow carries a
 * `Residual`-typed value (e.g. from a bug elsewhere in the same module) is still caught at the
 * value layer, not just at the type layer.
 */
export const RiskEntry = strictObject({
  ...riskEntryAuthoredFields,
  residual: residualSchema,
}).superRefine((entry, ctx) => {
  const expected = computeResidual(entry.likelihood, entry.impact);
  if (entry.residual !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["residual"],
      message: `residual (${String(entry.residual)}) must equal the computed value ${String(expected)} — never freeform; derive it with computeResidual(), or record a deliberate exception via recordResidualOverride()`,
    });
  }
});
export type RiskEntry = z.infer<typeof RiskEntry>;

/**
 * Author one risk-register entry: validates the caller-supplied fields, computes the residual
 * (never accepted as input), and returns the fully-validated entry. Throws a redaction-safe
 * `ValidationError` on the first violation.
 */
export function defineRiskEntry(input: RiskEntryInput): RiskEntry {
  const parsed = parseStrict(RiskEntryInput, input);
  const residual = computeResidual(parsed.likelihood, parsed.impact);
  return parseStrict(RiskEntry, { ...parsed, residual });
}
