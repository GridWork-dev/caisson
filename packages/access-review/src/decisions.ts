// src/decisions.ts — the pure half of the access-review campaign kernel (ADR-0371): the chain
// record kinds, the decision vocabulary, the flag-never-guess decision fold, and the close guard.
// Everything here operates on values the caller already holds — no db, no chain I/O, no clock.
//
// BROWSER-SAFE BY CONSTRUCTION, and load-bearing for it: this module's ONLY non-relative edge is
// `@caisson-sh/kernel` (whose `.` barrel is proven builtin-free by kernel's own browser-safety
// test). No node builtin, no @caisson-sh/tenancy-rls, no @caisson-sh/jobs — those stay in campaign.ts
// and schedule.ts, which import FROM here and never the reverse. apps/site's risk/poke suite
// walks its client graph through this file and pins that property; adding a tainted import here
// fails that walk loudly. Note the kernel import is a MIXED value import (the type names ride an
// inline `type` modifier), so the browser-safety claim does not depend on type-erasure reasoning.
import {
  ConflictError,
  type AuditChainEntry,
  type JsonValue,
} from "@caisson-sh/kernel";

/** The two decisions a reviewer may record. "Unresolved" is never a decision value — it is the
 *  ABSENCE of one, computed by `scanCampaignDecisions`, never chosen by a reviewer or a caller
 *  (flag-never-guess: an undecided reviewee is reported, never inferred as approved). */
export const REVIEW_DECISIONS = ["approve", "revoke"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** Chain-payload discriminators — mirrors the impersonation module's own dual-record kinds. */
export const CAMPAIGN_OPENED_RECORD = "access-review.campaign.opened";
export const CAMPAIGN_DECISION_RECORD = "access-review.decision";
export const CAMPAIGN_CLOSED_RECORD = "access-review.campaign.closed";

/** One reviewee's latest recorded decision, plus the roster's still-undecided members. */
export interface CampaignDecisionScan {
  readonly decisions: ReadonlyMap<string, ReviewDecision>;
  readonly unresolved: readonly string[];
}

/** Reads one chain entry as a decision record for `campaignId`, or `null` if it isn't one — a
 *  plain runtime check (no fancy type predicate), matching the impersonation module's
 *  `isDualRecord` style. */
function decisionFromEntry(
  entry: AuditChainEntry,
  campaignId: string,
): { revieweeId: string; decision: ReviewDecision } | null {
  const payload = entry.payload;
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const record = payload as { readonly [key: string]: JsonValue };
  if (
    record["kind"] !== CAMPAIGN_DECISION_RECORD ||
    record["campaignId"] !== campaignId
  ) {
    return null;
  }
  const revieweeId = record["revieweeId"];
  const decision = record["decision"];
  if (typeof revieweeId !== "string") return null;
  if (decision !== "approve" && decision !== "revoke") return null;
  return { revieweeId, decision };
}

/**
 * Scan a loaded chain for one campaign's decision trail: the LATEST decision per reviewee (later
 * `seq` wins — a revised decision supersedes an earlier one) and the roster members with no
 * decision at all. Pure — operates on entries the caller already loaded, never fetches. This is
 * the flag-never-guess output `closeCampaign` reports as-is — an undecided reviewee is NEVER
 * counted as approved.
 */
export function scanCampaignDecisions(
  entries: readonly AuditChainEntry[],
  campaignId: string,
  reviewees: readonly string[],
): CampaignDecisionScan {
  const decisions = new Map<string, ReviewDecision>();
  // "Latest wins" depends on seq-ascending iteration order — sort defensively rather than trust
  // the caller's ordering (entries is fully in memory already, so this is one cheap pass).
  const bySeq = [...entries].sort((a, b) => a.seq - b.seq);
  for (const entry of bySeq) {
    const decision = decisionFromEntry(entry, campaignId);
    if (decision !== null)
      decisions.set(decision.revieweeId, decision.decision);
  }
  const unresolved = reviewees.filter((r) => !decisions.has(r));
  return { decisions, unresolved };
}

/** The close guard's verdict: refused with the typed ConflictError `closeCampaign` throws, or
 *  closed with the reason and the unresolved roster reported as-is. */
export type CampaignCloseVerdict =
  | {
      readonly outcome: "closed";
      readonly reason: "completed" | "deadline";
      readonly unresolved: readonly string[];
    }
  | { readonly outcome: "refused"; readonly error: ConflictError };

/**
 * The EXTRACTED close guard from `closeCampaign` — not a second copy: `closeCampaign` calls this
 * and re-throws the refusal, so the message, details, class, and reason precedence ("completed"
 * wins over "deadline") stay single-sourced. Returned rather than thrown so a caller can render
 * both branches.
 */
export function evaluateCampaignClose(
  scan: CampaignDecisionScan,
  campaignId: string,
  isDue: boolean,
): CampaignCloseVerdict {
  const isComplete = scan.unresolved.length === 0;
  if (!isComplete && !isDue) {
    return {
      outcome: "refused",
      error: new ConflictError(
        "access-review campaign is neither complete nor past its deadline",
        { campaignId },
      ),
    };
  }
  return {
    outcome: "closed",
    reason: isComplete ? "completed" : "deadline",
    unresolved: scan.unresolved,
  };
}
