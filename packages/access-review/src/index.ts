// @caisson-sh/access-review — audit-prep access-review campaigns (ADR-0371).
//
// A WORM-logged attested decision record over an imported membership snapshot: a reviewer opens a
// campaign against a frozen roster of reviewees, decides approve/revoke per reviewee, and the
// campaign closes on completion or deadline with any undecided reviewee flagged unresolved, never
// silently approved. A composable module only — no reviewer-facing UI/portal; rendering is a
// consuming app's job.
export {
  MAX_CAMPAIGN_WINDOW_MS,
  membershipSnapshotSchema,
  openCampaignSchema,
  recordDecisionSchema,
  closeCampaignSchema,
} from "./schema.ts";
export type {
  MembershipSnapshot,
  OpenCampaignInput,
  RecordDecisionInput,
  CloseCampaignInput,
} from "./schema.ts";

export type { MembershipSnapshotSource } from "./snapshot.ts";
export {
  createInMemoryMembershipSnapshotSource,
  createJsonMembershipSnapshotSource,
  createCsvMembershipSnapshotSource,
} from "./snapshot.ts";

export {
  REVIEW_DECISIONS,
  CAMPAIGN_OPENED_RECORD,
  CAMPAIGN_DECISION_RECORD,
  CAMPAIGN_CLOSED_RECORD,
  scanCampaignDecisions,
} from "./decisions.ts";
export type { ReviewDecision, CampaignDecisionScan } from "./decisions.ts";

export { openCampaign, recordDecision, closeCampaign } from "./campaign.ts";
export type {
  CampaignChainStore,
  CampaignDeps,
  AccessReviewCampaign,
  ClosedAccessReviewCampaign,
} from "./campaign.ts";

export {
  CAMPAIGN_OPEN_TASK,
  CAMPAIGN_CLOSE_TASK,
  defineCampaignOpenTask,
  defineCampaignCloseTask,
  enqueueCampaignOpen,
  enqueueCampaignClose,
} from "./schedule.ts";
