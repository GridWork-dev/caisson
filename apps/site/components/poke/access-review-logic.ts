// Deterministic client-side mirror of @caisson/access-review's decision-scan + close-guard
// (ADR-0371) for the "access-review" poke (ADR-0378 lock 2). Every export below is a faithful,
// standalone port of packages/access-review/src/campaign.ts's PURE logic — nothing here fetches,
// persists, measures, or uses Date.now / Math.random in a rendered-output path. There is no
// hashing on this module's critical path (unlike field-crypto/guardrails), so no WebCrypto
// substitution is needed either.
//
// Why mirrored instead of imported: campaign.ts imports `randomUUID` from `node:crypto` at module
// scope, plus `@caisson/kernel` (whose barrel `index.ts` re-exports node:crypto- and node:fs/dns-
// backed modules — see guardrails-logic.ts's header for the same finding) and `@caisson/tenancy-rls`
// (a Postgres-fronting port). None of that resolves in a browser bundle, and `openCampaign` /
// `recordDecision` / `closeCampaign` all require a live `db` + `chain` (`CampaignDeps`) to run at
// all, so there is nothing safely callable client-side even where the import graph did resolve.
// `scanCampaignDecisions` and the guard inside `closeCampaign` are pure decision logic with no I/O
// — that pure core is what this file ports, line-for-line. Parity is golden-pinned in
// `access-review-logic.test.ts` against the real `scanCampaignDecisions` (imported by relative
// path — apps/site does not declare `@caisson/access-review` as a dependency) and against the real
// `ConflictError` class shape from `@caisson/kernel` (already a declared dependency).

// ---- Decision record shape (packages/access-review/src/campaign.ts) ----------------------------

export const REVIEW_DECISIONS = ["approve", "revoke"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** Chain-payload discriminators — verbatim: campaign.ts. */
export const CAMPAIGN_DECISION_RECORD = "access-review.decision";
export const CAMPAIGN_CLOSED_RECORD = "access-review.campaign.closed";

/**
 * The one shape this module reads off an audit-chain entry: `seq` (ordering) and `payload`
 * (unknown, exactly as narrow as the real `AuditChainEntry`'s `JsonValue` payload) — any real
 * `AuditChainEntry` (which also carries `prevHash`/`hash`) is structurally assignable here, which
 * is what lets the parity test feed the same fixtures to both this mirror and the real function.
 */
export interface DecisionChainEntry {
  readonly seq: number;
  readonly payload: unknown;
}

/** Verbatim: campaign.ts `decisionFromEntry` (JsonValue narrowed to `unknown` — same runtime check). */
function decisionFromEntry(
  entry: DecisionChainEntry,
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
  const record = payload as { readonly [key: string]: unknown };
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

/** One reviewee's latest recorded decision, plus the roster's still-undecided members. Verbatim:
 *  campaign.ts `CampaignDecisionScan`. */
export interface CampaignDecisionScan {
  readonly decisions: ReadonlyMap<string, ReviewDecision>;
  readonly unresolved: readonly string[];
}

/**
 * Verbatim algorithm: campaign.ts `scanCampaignDecisions`. The LATEST decision per reviewee
 * (later `seq` wins — a revised decision supersedes an earlier one) and the roster members with no
 * decision at all. An undecided reviewee is NEVER counted as approved (flag-never-guess).
 */
export function scanCampaignDecisions(
  entries: readonly DecisionChainEntry[],
  campaignId: string,
  reviewees: readonly string[],
): CampaignDecisionScan {
  const decisions = new Map<string, ReviewDecision>();
  const bySeq = [...entries].sort((a, b) => a.seq - b.seq);
  for (const entry of bySeq) {
    const decision = decisionFromEntry(entry, campaignId);
    if (decision !== null)
      decisions.set(decision.revieweeId, decision.decision);
  }
  const unresolved = reviewees.filter((r) => !decisions.has(r));
  return { decisions, unresolved };
}

// ---- The close guard (packages/access-review/src/campaign.ts `closeCampaign`) ------------------
// Mirrors ONLY the pure decision at the top of closeCampaign — due (now >= deadline) OR complete
// (every reviewee decided), refused otherwise — never the DB/chain writes that follow it, which
// this file has no port for by design (see header).

/** Mirrors kernel `errors.ts` `ConflictError` — 409, metadata-only `details`. Golden-pinned in the
 *  test against the real class's own `.code`/`.httpStatus`. */
export interface ConflictErrorLike {
  readonly code: "conflict";
  readonly httpStatus: 409;
  readonly message: string;
  readonly details: { readonly campaignId: string };
}

export type CampaignCloseVerdict =
  | {
      readonly outcome: "closed";
      /** Verbatim: campaign.ts's `reason: isComplete ? "completed" : "deadline"`, the field it
       *  appends onto the `CAMPAIGN_CLOSED_RECORD` chain payload. */
      readonly reason: "completed" | "deadline";
      readonly unresolved: readonly string[];
    }
  | {
      readonly outcome: "refused";
      readonly error: ConflictErrorLike;
    };

/**
 * Mirrors `closeCampaign`'s guard exactly: due OR complete, else refuse — a campaign is NEVER
 * force-closed with reviewees left undecided before its deadline. `campaign.ts` throws this same
 * `ConflictError` message/details before touching the DB or the chain; this function returns the
 * verdict instead of throwing, so the poke can render both branches without a try/catch.
 */
export function evaluateClose(
  scan: CampaignDecisionScan,
  campaignId: string,
  isDue: boolean,
): CampaignCloseVerdict {
  const isComplete = scan.unresolved.length === 0;
  if (!isComplete && !isDue) {
    return {
      outcome: "refused",
      error: {
        code: "conflict",
        httpStatus: 409,
        message:
          "access-review campaign is neither complete nor past its deadline",
        details: { campaignId },
      },
    };
  }
  return {
    outcome: "closed",
    reason: isComplete ? "completed" : "deadline",
    unresolved: scan.unresolved,
  };
}
