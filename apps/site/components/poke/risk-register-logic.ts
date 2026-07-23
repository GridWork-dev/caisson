// Deterministic client-side mirror of @caisson/risk-register (model.ts + override.ts) for the
// "risk-register" poke (ADR-0378 lock 2, kimi CANDIDATES-KIMI.md section B: "risk-register:
// likelihood x impact sliders produce the computed residual (never caller-supplied); an override
// lands as a chained exception"). Every export below is a faithful, standalone port of the
// package's pure logic. Nothing here fetches, persists, measures, or uses Date.now / Math.random
// / an argless `new Date()` in a rendered-output path.
//
// Why mirrored instead of imported: model.ts imports `strictObject`/`parseStrict` from
// "@caisson/kernel", and override.ts imports `InternalError`/`ValidationError` from the same
// package. @caisson/kernel's package.json exposes only the "." barrel plus four narrow subpaths
// ("./fetch", "./audit-verify", "./redact", "./evidence"), none isolates errors.ts/schema.ts, so
// any import of "@caisson/kernel" pulls the "." barrel, which re-exports audit-chain.ts
// (node:crypto) and ssrf.ts (node:fs / node:dns/promises) among others, none of it resolves in a
// browser bundle. This is the same finding guardrails-logic.ts records against the identical
// barrel. model.ts also imports `CrosswalkReference` from "@caisson/frameworks-pack", a package
// apps/site does not even declare as a workspace dependency. `computeResidual`/`isResidual`
// (model.ts) and the `recordResidualOverride` validation order (override.ts) are therefore ported
// line-for-line below with the zod/kernel plumbing stripped; nothing here needs WebCrypto, this
// primitive is ordinal arithmetic and string-length checks, not hashing. Parity is golden-pinned in
// risk-register-logic.test.ts against the committed golden fixture
// packages/risk-register/src/__golden__/risk-treatment-plan.txt and against the real package's own
// functions (imported by relative path, apps/site does not declare @caisson/risk-register as a
// dependency either, matching guardrails-logic.ts's precedent for @caisson/guardrails).

// ---- The risk model (packages/risk-register/src/model.ts) --------------------------------------

/** Verbatim order: model.ts `Likelihood` (a zod enum there; a plain ordered tuple here). */
export const LIKELIHOODS = [
  "rare",
  "unlikely",
  "possible",
  "likely",
  "almost-certain",
] as const;
export type Likelihood = (typeof LIKELIHOODS)[number];

/** Verbatim order: model.ts `Impact`. */
export const IMPACTS = [
  "negligible",
  "minor",
  "moderate",
  "major",
  "severe",
] as const;
export type Impact = (typeof IMPACTS)[number];

/** Verbatim: model.ts `LIKELIHOOD_ORDINAL`. */
const LIKELIHOOD_ORDINAL: Readonly<Record<Likelihood, number>> = {
  rare: 1,
  unlikely: 2,
  possible: 3,
  likely: 4,
  "almost-certain": 5,
};

/** Verbatim: model.ts `IMPACT_ORDINAL`. */
const IMPACT_ORDINAL: Readonly<Record<Impact, number>> = {
  negligible: 1,
  minor: 2,
  moderate: 3,
  major: 4,
  severe: 5,
};

declare const RESIDUAL_BRAND: unique symbol;
/**
 * A residual-risk score (1-25): the likelihood ordinal times the impact ordinal. Verbatim brand
 * shape from model.ts's `Residual`. `computeResidual` is the ONLY function that returns this
 * type, so a caller-supplied number literal fails to satisfy it at compile time.
 */
export type Residual = number & { readonly [RESIDUAL_BRAND]: true };

/** Verbatim: model.ts `computeResidual`. The one path to a `Residual` value, pure ordinal
 *  multiplication, no I/O, no caller override. */
export function computeResidual(
  likelihood: Likelihood,
  impact: Impact,
): Residual {
  return (LIKELIHOOD_ORDINAL[likelihood] * IMPACT_ORDINAL[impact]) as Residual;
}

/** Verbatim: model.ts `isResidual`. True for exactly the values `computeResidual` can produce. */
export function isResidual(value: unknown): value is Residual {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 25
  );
}

/** One cell of the full likelihood x impact matrix, purely derived from `computeResidual`, a
 *  rendering enumeration, not a package export. */
export interface ResidualCell {
  readonly likelihood: Likelihood;
  readonly impact: Impact;
  readonly residual: Residual;
}

/** Every likelihood x impact combination the real ordinal product can produce (25 cells). */
export function residualMatrix(): readonly ResidualCell[] {
  const cells: ResidualCell[] = [];
  for (const likelihood of LIKELIHOODS) {
    for (const impact of IMPACTS) {
      cells.push({
        likelihood,
        impact,
        residual: computeResidual(likelihood, impact),
      });
    }
  }
  return cells;
}

// ---- The chained override exception (packages/risk-register/src/override.ts) -------------------

/** Verbatim: override.ts `RESIDUAL_OVERRIDE_KIND`. */
const RESIDUAL_OVERRIDE_KIND = "risk.residual-overridden" as const;

/** Verbatim shape: override.ts `RiskResidualOverrideRecord`, the chained exception record. */
export interface RiskResidualOverrideRecord {
  readonly kind: typeof RESIDUAL_OVERRIDE_KIND;
  readonly riskId: string;
  readonly computed: Residual;
  readonly override: Residual;
  readonly who: string;
  readonly why: string;
  readonly at: string;
}

/** Mirrors kernel `errors.ts` `ValidationError`: code `"validation_error"`, `httpStatus` 400. */
export interface RiskRegisterValidationErrorLike {
  readonly code: "validation_error";
  readonly httpStatus: 400;
  readonly message: string;
}

/** A typed verdict rather than a thrown exception (matches guardrails-logic.ts's `evaluateGuard`
 *  precedent): an override is either chained, or rejected with the real validation message. */
export type RecordOverrideOutcome =
  | {
      readonly outcome: "recorded";
      readonly record: RiskResidualOverrideRecord;
    }
  | {
      readonly outcome: "rejected";
      readonly error: RiskRegisterValidationErrorLike;
    };

export interface RecordResidualOverrideInput {
  readonly riskId: string;
  /** The value `computeResidual()` derived for this risk, carried forward untouched, never
   *  recomputed here (override.ts's own contract). */
  readonly computed: Residual;
  readonly overrideLikelihood: Likelihood;
  readonly overrideImpact: Impact;
  readonly who: string;
  readonly why: string;
  /** Injected clock: the instant is stamped by the caller, never read here (override.ts's own
   *  contract; this poke's caller passes a fixed sample instant, never a live clock). */
  readonly now: Date;
}

/**
 * Mirrors override.ts's `recordResidualOverride` validation order exactly (riskId non-empty, who
 * non-empty and <= 200 chars, why non-empty and <= 2000 chars, computed shaped like a `Residual`),
 * then mints the chained exception record: computed value plus override plus who/why/when, all on
 * ONE record. The real entry.residual is never touched, an override is never a silent overwrite.
 */
export function recordResidualOverride(
  input: RecordResidualOverrideInput,
): RecordOverrideOutcome {
  const reject = (message: string): RecordOverrideOutcome => ({
    outcome: "rejected",
    error: { code: "validation_error", httpStatus: 400, message },
  });

  if (input.riskId.trim().length === 0) {
    return reject("risk-register: an override requires a non-empty riskId");
  }
  if (input.who.trim().length === 0) {
    return reject("risk-register: an override requires a recorded who");
  }
  if (input.who.trim().length > 200) {
    return reject(
      "risk-register: override who must be 200 characters or fewer",
    );
  }
  if (input.why.trim().length === 0) {
    return reject("risk-register: an override requires a recorded why");
  }
  if (input.why.trim().length > 2000) {
    return reject(
      "risk-register: override why must be 2000 characters or fewer",
    );
  }
  if (!isResidual(input.computed)) {
    return reject(
      "risk-register: computed must be a value computeResidual() produced",
    );
  }

  const override = computeResidual(
    input.overrideLikelihood,
    input.overrideImpact,
  );
  const record: RiskResidualOverrideRecord = {
    kind: RESIDUAL_OVERRIDE_KIND,
    riskId: input.riskId,
    computed: input.computed,
    override,
    who: input.who,
    why: input.why,
    at: input.now.toISOString(),
  };
  return { outcome: "recorded", record };
}

/**
 * Mirrors treatment-plan.ts's own invariant (`row.overrideOf?.residual ?? row.computedResidual`):
 * the score that governs today is the latest override's, when one is on record, else the computed
 * value. The computed value is passed through untouched either way, recoverable straight off the
 * artifact, never overwritten.
 */
export function deriveEffectiveResidual(
  computed: Residual,
  latestOverride: RiskResidualOverrideRecord | null,
): Residual {
  return latestOverride === null ? computed : latestOverride.override;
}

// ---- Sample register row (the golden fixture's own risk, see the test file) --------------------
// packages/risk-register/src/__golden__/risk-treatment-plan.txt's "R-1" entry: possible x major.

export const SAMPLE_RISK_ID = "R-1";
export const SAMPLE_SUBJECT = "R-1 lane";
export const SAMPLE_OWNER = "safety@example.com";
export const SAMPLE_LIKELIHOOD: Likelihood = "possible";
export const SAMPLE_IMPACT: Impact = "major";
/** Fixed sample instant, no Date.now() / argless new Date() in any rendered path. */
export const SAMPLE_NOW = new Date("2026-07-22T00:00:00.000Z");
