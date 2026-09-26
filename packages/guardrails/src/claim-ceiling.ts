// Evidence-gated claims / honest claim-ceiling release gate (SPEC-wave6-harvest-disposition row
// #27, tm-watch pattern only — rebuild-clean). A generic `{metric, threshold, baseline, margin} ->
// tier` primitive: a copy-review tool feeds it the eval evidence backing a candidate marketing/AI
// claim, and it answers "which claim tier does this evidence license?" — stopping copy from
// outrunning what was actually measured. Pure and deterministic (no network/LLM call); the caller
// owns wiring it into a SHIP-gate or a standalone copy-review CLI.
import { z } from "zod";
import { strictObject, CaissonError } from "@caisson-sh/kernel";

/**
 * The claim ladder, weakest evidence bar to strongest. A claim tagged `minTier` may only run in
 * copy once the backing evidence's `claimTier()` is at or above it.
 *
 * - `unproven`   — the metric didn't clear `threshold` over `baseline`. No externally-facing claim
 *                   is licensed; internal/roadmap language only.
 * - `measured`   — the metric cleared `threshold` over `baseline`. A literal, hedged claim is
 *                   licensed (e.g. "measured a 12% reduction in internal testing").
 * - `validated`  — the metric cleared `threshold` over `baseline` with `margin` to spare, i.e. not
 *                   a threshold-hugging fluke. The strongest, most confident phrasing is licensed.
 */
export const CLAIM_TIERS = ["unproven", "measured", "validated"] as const;
export type ClaimTier = (typeof CLAIM_TIERS)[number];

const TIER_RANK: Record<ClaimTier, number> = {
  unproven: 0,
  measured: 1,
  validated: 2,
};

/**
 * The evidence backing one claim. `metric`/`baseline` are the same unit throughout — plain ratios
 * (0-1, ms, %) are fine as ordinary floats; money-like values MUST already be integer minor units
 * (cents/credits, per the repo's integer-money invariant) so the threshold/margin comparison below
 * never depends on float rounding. `threshold`/`margin` are non-negative: the ladder only rewards an
 * improvement over `baseline`, never a regression.
 */
export const claimEvidenceSchema = strictObject({
  metric: z.number().finite(),
  baseline: z.number().finite(),
  threshold: z.number().finite().nonnegative(),
  margin: z.number().finite().nonnegative(),
  /** Which way "better" points. `"increase"` (default): improvement = `metric - baseline`
   *  (throughput, accuracy, revenue). `"decrease"`: improvement = `baseline - metric` (latency,
   *  error rate, review time) — without this, a genuine reduction reads as a regression and a
   *  true "cuts X in half" claim could never be licensed. */
  direction: z.enum(["increase", "decrease"]).default("increase"),
});
// The INPUT shape (direction optional, default "increase") — callers hand-construct evidence
// literals; claimTier treats an absent direction as "increase", matching the schema default.
export type ClaimEvidence = z.input<typeof claimEvidenceSchema>;

/** A candidate claim string tagged with the minimum evidence tier it requires to run. */
export const claimSchema = strictObject({
  text: z.string().min(1).max(500),
  minTier: z.enum(CLAIM_TIERS),
});
export type Claim = z.infer<typeof claimSchema>;

/**
 * `true` when `achieved` is at or above `required` on the claim ladder — the shared ordering check
 * used by both `assertClaimAllowed` and `allowedClaims`.
 */
function tierMeets(achieved: ClaimTier, required: ClaimTier): boolean {
  return TIER_RANK[achieved] >= TIER_RANK[required];
}

/**
 * Score `evidence` against the claim ladder. Improvement (`lift`) is direction-aware:
 * `metric - baseline` for `"increase"` evidence, `baseline - metric` for `"decrease"` evidence.
 * `lift >= threshold + margin` reaches `"validated"`, `lift >= threshold` reaches `"measured"`,
 * anything short (including a regression) stays `"unproven"`. Boundary is inclusive both steps —
 * a lift landing exactly on `threshold` or exactly on `threshold + margin` clears that rung, it
 * does not fall short of it.
 */
export function claimTier(evidence: ClaimEvidence): ClaimTier {
  const lift =
    evidence.direction === "decrease"
      ? evidence.baseline - evidence.metric
      : evidence.metric - evidence.baseline;
  if (lift >= evidence.threshold + evidence.margin) return "validated";
  if (lift >= evidence.threshold) return "measured";
  return "unproven";
}

/**
 * A claim's evidence fell short of the tier it requires — thrown at copy-review time, never in a
 * live request path. `details` carries the claim text + both tiers so a review tool can render the
 * gap; nothing here is secret, unlike `GuardrailError`'s redaction contract.
 */
export class ClaimCeilingError extends CaissonError {
  readonly code = "claim_ceiling_exceeded";
  readonly httpStatus = 422;
  constructor(claim: Claim, achievedTier: ClaimTier) {
    super(
      `Claim requires "${claim.minTier}" evidence, only "${achievedTier}" was reached: "${claim.text}"`,
      { claimText: claim.text, requiredTier: claim.minTier, achievedTier },
    );
  }
}

/**
 * Throws `ClaimCeilingError` unless `evidence` reaches at least `claim.minTier` on the ladder.
 * Meant to be called once per candidate claim string at copy-review/SHIP-gate time.
 */
export function assertClaimAllowed(
  claim: Claim,
  evidence: ClaimEvidence,
): void {
  const achieved = claimTier(evidence);
  if (!tierMeets(achieved, claim.minTier)) {
    throw new ClaimCeilingError(claim, achieved);
  }
}

/**
 * Filters `claims` down to the ones `evidence` currently licenses — the "tier -> allowed-claim-
 * strings" half of the primitive, for a review UI that wants to list what's usable rather than
 * assert one claim at a time.
 */
export function allowedClaims(
  claims: readonly Claim[],
  evidence: ClaimEvidence,
): Claim[] {
  const achieved = claimTier(evidence);
  return claims.filter((claim) => tierMeets(achieved, claim.minTier));
}
