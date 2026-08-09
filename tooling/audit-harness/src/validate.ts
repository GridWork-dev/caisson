// /validate spine — high-risk findings only (ADR-0134 §4). Routine (info/warn) findings are
// unaffected; only a `severity: "high"` Finding is worth this escalation. Two INDEPENDENT
// adversarial passes challenge the finding; it survives only if BOTH explicitly return
// `refuted: false`. A tie, a `null` verdict (challenger unavailable / errored / no opinion), or
// either pass returning `refuted: true` all default to REFUTED — a high-risk finding must actively
// survive scrutiny, not merely go unchallenged. Non-blocking by design: `validateHighRisk` never
// throws to a caller gating on it.
import type { Finding } from "./findings.ts";

export interface ChallengeVerdict {
  refuted: boolean;
}

/**
 * The port: one method. The real driver (PAL `challenge` → OpenRouter, per GridWork's
 * cross-vendor-LLM-work convention) is an injected CLI/skill concern — this package depends only on
 * the port, so it stays testable with a fake challenger and never carries a network call itself.
 */
export interface Challenger {
  challenge(finding: Finding): Promise<ChallengeVerdict | null>;
}

/**
 * Pure decision. KILLED (suppressed) unless every supplied verdict explicitly says
 * `refuted: false` — i.e. survives only when ALL passes agree the finding is real. Any `null`
 * (missing/failed verdict) or an explicit `refuted: true` kills it. With the two-pass caller below
 * this is exactly "both-not-refuted survives; one-or-both-refuted, or a tie/null, is killed".
 */
export function majorityKills(verdicts: (ChallengeVerdict | null)[]): boolean {
  return !verdicts.every((v) => v !== null && v.refuted === false);
}

/** A throwing/rejecting challenger call is treated as a missing verdict (`null`), never propagated
 * — this spine is advisory and must never throw to whatever is gating on it. */
async function safeChallenge(
  challenger: Challenger,
  finding: Finding,
): Promise<ChallengeVerdict | null> {
  try {
    return await challenger.challenge(finding);
  } catch {
    return null;
  }
}

/**
 * Run the challenger TWICE (independently) against a high-risk finding and report whether it
 * survives. Never throws — every failure mode collapses to a `null` verdict, which `majorityKills`
 * already treats as REFUTED.
 */
export async function validateHighRisk(
  finding: Finding,
  challenger: Challenger,
): Promise<boolean> {
  const verdicts = await Promise.all([
    safeChallenge(challenger, finding),
    safeChallenge(challenger, finding),
  ]);
  return !majorityKills(verdicts);
}
