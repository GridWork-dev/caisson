// src/campaign.ts — the access-review campaign kernel (ADR-0371).
//
// An AccessReviewCampaign is a mutable roster row (who's reviewing whom, by when) PLUS an
// immutable decision trail on the tenant's existing WORM audit chain (`@caisson-sh/audit-worm`, no
// new anchoring primitive) — the same split @caisson-sh/compliance's impersonation kernel uses
// (src/impersonation/session.ts): lifecycle state (open/closed) lives in Postgres because it is
// queried and mutated; the evidentiary record (who decided what, when) lives ONLY on the chain,
// so a dropped or patched decision is tamper-evident, never a plain log row silently edited.
//
// Boundary discipline: this module depends on `CampaignChainStore`, a NARROW port structurally
// satisfied by the real `AuditChainStore` (`append` + `load`) — it never imports
// `@caisson-sh/audit-worm` itself, so a unit test can stub the chain with no DB/WORM store, exactly
// like `ImpersonationChainStore`. The integration test wires the real store.
//
// Flag-never-guess: `closeCampaign` NEVER marks an undecided reviewee as approved. It refuses to
// close before the deadline unless every reviewee has decided, and at close time every reviewee
// with no recorded decision lands in `unresolved` — visible, never silently resolved.
import { randomUUID } from "node:crypto";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
  parseStrict,
  type AuditChainEntry,
  type JsonValue,
} from "@caisson-sh/kernel";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson-sh/tenancy-rls";
import {
  closeCampaignSchema,
  openCampaignSchema,
  recordDecisionSchema,
  type CloseCampaignInput,
  type OpenCampaignInput,
  type RecordDecisionInput,
} from "./schema.ts";
import {
  CAMPAIGN_CLOSED_RECORD,
  CAMPAIGN_DECISION_RECORD,
  CAMPAIGN_OPENED_RECORD,
  evaluateCampaignClose,
  scanCampaignDecisions,
} from "./decisions.ts";

/** The one seam this kernel needs from the audit chain — structurally satisfied by the real
 *  `AuditChainStore` (`append` + `load`, ADR-0052). Kept as a port so this module and its unit
 *  tests never hard-bind the WORM store wiring. */
export interface CampaignChainStore {
  append(
    accountId: string,
    payload: JsonValue,
  ): Promise<{ readonly entry: AuditChainEntry }>;
  load(accountId: string): Promise<readonly AuditChainEntry[]>;
}

export interface CampaignDeps {
  /** The tenant DB (the same `Transactor` every compliance seam uses). */
  readonly db: Transactor;
  /** The tenant's audit chain — every decision lands here. */
  readonly chain: CampaignChainStore;
  /** Clock injected at the edge (determinism — tests). Default: wall clock. */
  readonly now?: () => Date;
  /** Campaign-id source injected at the edge. Default: `randomUUID`. */
  readonly newId?: () => string;
}

export interface AccessReviewCampaign {
  readonly id: string;
  readonly accountId: string;
  readonly reviewerId: string;
  readonly reviewees: readonly string[];
  readonly openedAt: Date;
  readonly deadlineAt: Date;
}

export interface ClosedAccessReviewCampaign extends AccessReviewCampaign {
  readonly closedAt: Date;
  /** Reviewees with no recorded decision at close time — NEVER treated as approved. */
  readonly unresolved: readonly string[];
}

function nowOf(deps: CampaignDeps): Date {
  return deps.now?.() ?? new Date();
}

interface CampaignRow {
  id: string;
  account_id: string;
  reviewer_id: string;
  reviewees: string[];
  opened_at: string;
  deadline_at: string;
  closed_at: string | null;
}

function toCampaign(row: CampaignRow): AccessReviewCampaign {
  return {
    id: row.id,
    accountId: row.account_id,
    reviewerId: row.reviewer_id,
    reviewees: row.reviewees,
    openedAt: new Date(row.opened_at),
    deadlineAt: new Date(row.deadline_at),
  };
}

/** Normalizes the jsonb `reviewees` column to a real array. A `TenantExecutor` that decodes jsonb
 *  to a JSON string rather than a parsed value (a driver difference, not something this module
 *  controls) would otherwise degrade `row.reviewees.includes(...)` to SUBSTRING matching — a
 *  roster bypass, since `"user"` is a substring of `"user-1"`. Normalize once here, at the single
 *  choke point every caller reads the roster through; anything else fails closed, never guessed. */
function normalizeReviewees(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as string[];
  }
  throw new InternalError(
    "access-review: reviewees column did not decode to an array",
  );
}

/** Loads one campaign row inside the caller's own tenant scope. Throws `NotFoundError` if absent
 *  — fail-closed, never treat a missing campaign as anything else. */
async function selectCampaignRow(
  tx: TenantExecutor,
  campaignId: string,
): Promise<CampaignRow> {
  const res = await tx.query<CampaignRow>(
    `SELECT id, account_id, reviewer_id, reviewees, opened_at, deadline_at, closed_at
       FROM access_review_campaign
      WHERE id = $1`,
    [campaignId],
  );
  const row = res.rows[0];
  if (row === undefined) {
    throw new NotFoundError("access-review campaign not found", {
      campaignId,
    });
  }
  return { ...row, reviewees: normalizeReviewees(row.reviewees) };
}

/**
 * Open a campaign: validate fail-closed, insert the roster row under the tenant's OWN scope, then
 * append the `campaign.opened` chain record. The chain append runs OUTSIDE the insert's
 * transaction (see `chain.append`'s own tenant scope), so a failure between the two surfaces to
 * the caller rather than silently dropping the evidentiary open record — the same torn-begin
 * posture the impersonation kernel documents.
 */
export async function openCampaign(
  deps: CampaignDeps,
  input: OpenCampaignInput,
): Promise<AccessReviewCampaign> {
  const parsed = parseStrict(openCampaignSchema, input);
  const openedAt = nowOf(deps);
  const deadlineAt = new Date(openedAt.getTime() + parsed.deadlineMs);
  const id = (deps.newId ?? randomUUID)();

  await withTenant(deps.db, parsed.accountId, async (tx) => {
    await tx.query(
      `INSERT INTO access_review_campaign
         (id, account_id, reviewer_id, reviewees, opened_at, deadline_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [
        id,
        parsed.accountId,
        parsed.reviewerId,
        JSON.stringify(parsed.reviewees),
        openedAt.toISOString(),
        deadlineAt.toISOString(),
      ],
    );
  });

  await deps.chain.append(parsed.accountId, {
    kind: CAMPAIGN_OPENED_RECORD,
    campaignId: id,
    reviewerId: parsed.reviewerId,
    reviewees: parsed.reviewees,
    openedAt: openedAt.toISOString(),
    deadlineAt: deadlineAt.toISOString(),
  });

  return {
    id,
    accountId: parsed.accountId,
    reviewerId: parsed.reviewerId,
    reviewees: parsed.reviewees,
    openedAt,
    deadlineAt,
  };
}

/**
 * Record one reviewer decision. Fail-closed: refuses (`ValidationError`) a reviewee outside the
 * campaign's frozen roster, and refuses (`ConflictError`) a decision against a campaign this read
 * observes as already closed. A reviewer may revise an earlier decision before the campaign
 * closes; the chain keeps every append, `scanCampaignDecisions` takes the LATEST by sequence.
 *
 * BEST-EFFORT, not atomic with `closeCampaign`: the `closed_at` check above is a plain read, not
 * a CAS against `closeCampaign`'s own UPDATE+append. A decision racing a close at the deadline
 * boundary can still interleave — this function's read observes `closed_at IS NULL`,
 * `closeCampaign` then commits its UPDATE and appends the `campaign.closed` record, and only
 * THEN does this function's own chain append land, after the close record. Nothing in the schema
 * blocks a post-close chain append; the residual is app-level. It does not resurrect an
 * already-reported `unresolved` reviewee — `scanCampaignDecisions` runs once, from the entries
 * `closeCampaign` loaded at close time, so a decision landing after that scan is simply absent
 * from it. Same class of residual the impersonation kernel's torn-begin note documents for
 * `openCampaign` below.
 */
export async function recordDecision(
  deps: CampaignDeps,
  input: RecordDecisionInput,
): Promise<{ readonly seq: number }> {
  const parsed = parseStrict(recordDecisionSchema, input);

  const row = await withTenant(deps.db, parsed.accountId, (tx) =>
    selectCampaignRow(tx, parsed.campaignId),
  );
  if (row.closed_at !== null) {
    throw new ConflictError("access-review campaign is already closed", {
      campaignId: parsed.campaignId,
    });
  }
  if (!row.reviewees.includes(parsed.revieweeId)) {
    throw new ValidationError("reviewee is not on this campaign's roster", {
      campaignId: parsed.campaignId,
      revieweeId: parsed.revieweeId,
    });
  }

  const { entry } = await deps.chain.append(parsed.accountId, {
    kind: CAMPAIGN_DECISION_RECORD,
    campaignId: parsed.campaignId,
    reviewerId: row.reviewer_id,
    revieweeId: parsed.revieweeId,
    decision: parsed.decision,
  });
  return { seq: entry.seq };
}

/**
 * Close a campaign: due (now >= deadline) OR complete (every reviewee decided) — refuses
 * (`ConflictError`) otherwise, so a scheduler can never prematurely close a campaign still in its
 * window with reviewees left to decide. Sets `closed_at` (the column-scoped write, mirroring
 * `impersonation_session.ended_at`), then appends the `campaign.closed` record carrying the
 * unresolved list as-is — never auto-approved.
 *
 * TORN-CLOSE RESIDUAL: the `closed_at` UPDATE and the `campaign.closed` chain append are two
 * separate operations, not one transaction (`chain.append` opens its OWN tenant scope, same as
 * every other chain write in this module). If the append fails after the UPDATE has committed,
 * the campaign is left TERMINALLY closed in Postgres — `closed_at` is set, `recordDecision`
 * refuses any further decision against it — with NO close record on the chain, and this module
 * has no re-drive path for that gap. The failure surfaces to the caller; nothing here retries or
 * reconciles it. Same torn-write posture `openCampaign` documents for its own insert-then-append
 * order.
 */
export async function closeCampaign(
  deps: CampaignDeps,
  input: CloseCampaignInput,
): Promise<ClosedAccessReviewCampaign> {
  const parsed = parseStrict(closeCampaignSchema, input);
  const now = nowOf(deps);

  const row = await withTenant(deps.db, parsed.accountId, (tx) =>
    selectCampaignRow(tx, parsed.campaignId),
  );
  if (row.closed_at !== null) {
    throw new ConflictError("access-review campaign is already closed", {
      campaignId: parsed.campaignId,
    });
  }
  const campaign = toCampaign(row);
  const entries = await deps.chain.load(parsed.accountId);
  const scan = scanCampaignDecisions(
    entries,
    parsed.campaignId,
    campaign.reviewees,
  );
  const verdict = evaluateCampaignClose(
    scan,
    parsed.campaignId,
    now.getTime() >= campaign.deadlineAt.getTime(),
  );
  if (verdict.outcome === "refused") throw verdict.error;

  await withTenant(deps.db, parsed.accountId, async (tx) => {
    const res = await tx.query<{ id: string }>(
      `UPDATE access_review_campaign
          SET closed_at = $2
        WHERE id = $1 AND closed_at IS NULL
        RETURNING id`,
      [parsed.campaignId, now.toISOString()],
    );
    if (res.rows.length === 0) {
      throw new ConflictError("access-review campaign already closed", {
        campaignId: parsed.campaignId,
      });
    }
  });

  await deps.chain.append(parsed.accountId, {
    kind: CAMPAIGN_CLOSED_RECORD,
    campaignId: parsed.campaignId,
    closedAt: now.toISOString(),
    reason: verdict.reason,
    unresolved: verdict.unresolved,
  });

  return { ...campaign, closedAt: now, unresolved: verdict.unresolved };
}
