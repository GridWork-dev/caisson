// src/schema.ts — typed shapes for access-review campaigns (ADR-0371).
//
// Every boundary in this package is a Zod `.strict()` parse: a membership snapshot from an
// external loader, a campaign-open request, a per-reviewee decision, a close request. Fail closed
// before any I/O — the same discipline @caisson-sh/compliance's impersonation kernel applies to its
// begin boundary (src/impersonation/session.ts).
import { z } from "zod";
import { strictObject } from "@caisson-sh/kernel";
import { REVIEW_DECISIONS } from "./decisions.ts";

/** A reviewer/reviewee id — an opaque external identifier (email, username, account id). Bounded
 *  so a malformed import can't smuggle an unbounded string into a WORM-logged payload. */
const memberId = z.string().trim().min(1).max(320);

/** A campaign window ceiling — one year. A recurring review cadence longer than that is a
 *  misconfiguration, not a legitimate use: an unbounded deadline defeats the audit story (a
 *  campaign that can never come due never surfaces its unresolved reviewees). */
export const MAX_CAMPAIGN_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

const revieweesShape = z
  .array(memberId)
  .min(1)
  .max(10_000)
  .refine((ids) => new Set(ids).size === ids.length, {
    message:
      "reviewees must be unique — a duplicate id is refused, never silently deduped",
  });

/** A typed roster: one reviewer and the reviewees they attest access for. Every loader adapter
 *  (CSV/JSON/in-memory, snapshot.ts) parses into this SAME shape — the same shape discipline
 *  `@caisson-sh/compliance-core`'s `EvidenceCollector` uses: the loader's own I/O stays outside the
 *  typed boundary, `read()` itself returns an already-parsed, pure value. */
export const membershipSnapshotSchema = strictObject({
  reviewerId: memberId,
  reviewees: revieweesShape,
});
export type MembershipSnapshot = z.infer<typeof membershipSnapshotSchema>;

/** The boundary for opening a campaign — a membership snapshot plus the tenant + review window. */
export const openCampaignSchema = strictObject({
  accountId: z.string().uuid(),
  reviewerId: memberId,
  reviewees: revieweesShape,
  deadlineMs: z.number().int().positive().max(MAX_CAMPAIGN_WINDOW_MS),
});
export type OpenCampaignInput = z.input<typeof openCampaignSchema>;

/** The boundary for recording one reviewer decision against an open campaign. */
export const recordDecisionSchema = strictObject({
  accountId: z.string().uuid(),
  campaignId: z.string().uuid(),
  revieweeId: memberId,
  decision: z.enum(REVIEW_DECISIONS),
});
export type RecordDecisionInput = z.input<typeof recordDecisionSchema>;

/** The boundary for closing a campaign — id only; `closeCampaign` derives due/complete itself
 *  rather than trusting a caller-supplied verdict. */
export const closeCampaignSchema = strictObject({
  accountId: z.string().uuid(),
  campaignId: z.string().uuid(),
});
export type CloseCampaignInput = z.input<typeof closeCampaignSchema>;
