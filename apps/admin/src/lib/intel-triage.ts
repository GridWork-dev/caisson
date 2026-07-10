// ADR-0316 F5 — the intel-findings triage WRITE path. Two verbs (review · dismiss) flip an
// `intel.findings` row's `status` so the /intel page's operator can clear the append-only wall the
// standing daemon otherwise piles up.
//
// Dual-logged exactly like every ADR-0220 operator mutation: the `status` UPDATE + the queryable
// `admin_action_log` row commit in ONE `withAdminWrite` transaction (atomic — a throw rolls back
// both), then a tamper-evident WORM chain entry is appended POST-COMMIT. Findings carry NO tenant
// account (a single-operator control-plane store), so both halves log under the synthetic `intel`
// target and anchor the WORM chain there — the same pattern `system_mode` uses with `system`
// (services/license/src/admin-mutations.ts). A post-commit WORM failure is surfaced as `worm:
// "failed"` (DO-NOT-RETRY) and NEVER rethrown: the state change is already durable, so throwing
// would read as a retryable failure. Unlike the money/entitlement mutations this path is
// deliberately NOT gated on system write-mode — a finding's triage state is not tenant money state,
// and blocking triage during a read-only incident window is counterproductive (that's exactly when
// the operator is working the findings).
import { NotFoundError } from "@caisson/kernel";
import { withAdminWrite } from "@caisson/org-controls";
import {
  insertAdminActionLog,
  wormAnchorAccount,
  type AdminAction,
  type AdminMutationDeps,
  type WormStatus,
} from "@caisson/service-license";
import { z } from "zod";

/** The synthetic account intel triage logs + WORM-anchors under (no real tenant, like `system`). */
const INTEL_TRIAGE_TARGET = "intel";

/** Only db + worm are needed — the same two seams `getAdminMutationDeps()` already wires. */
type TriageDeps = Pick<AdminMutationDeps, "db" | "worm">;

export const TriageFindingBody = z
  .object({
    // The finding's uuid — a bounded opaque id; a nonexistent id 404s at the DB read below.
    findingId: z.string().trim().min(1).max(64),
  })
  .strict();

export type TriageFindingInput = z.infer<typeof TriageFindingBody> & {
  actorEmail: string;
};

export interface IntelTriageResult {
  findingId: string;
  /** The finding's status BEFORE this triage (open | reviewed | dismissed). */
  before: string;
  /** The status set by this action. */
  after: "reviewed" | "dismissed";
  /** WORM audit half's outcome — `"failed"` means DO-NOT-RETRY (the status flip already committed). */
  worm: WormStatus;
}

async function triageFinding(
  deps: TriageDeps,
  actorEmail: string,
  findingId: string,
  status: "reviewed" | "dismissed",
  action: AdminAction,
): Promise<IntelTriageResult> {
  const before = await withAdminWrite(deps.db, async (tx) => {
    const cur = await tx.query<{ status: string }>(
      `SELECT status FROM intel.findings WHERE id = $1`,
      [findingId],
    );
    const row = cur.rows[0];
    if (row === undefined) {
      throw new NotFoundError("intel finding does not exist", { findingId });
    }
    const prior = row.status;
    await tx.query(
      `UPDATE intel.findings SET status = $1, triaged_at = now(), triaged_by = $2 WHERE id = $3`,
      [status, actorEmail, findingId],
    );
    await insertAdminActionLog(tx, {
      actorEmail,
      targetAccountId: INTEL_TRIAGE_TARGET,
      action,
      before: { status: prior },
      after: { status },
    });
    return prior;
  });
  let worm: WormStatus = "ok";
  try {
    await deps.worm.append(wormAnchorAccount(INTEL_TRIAGE_TARGET), {
      source: "admin_action",
      action,
      actorEmail,
      targetAccountId: INTEL_TRIAGE_TARGET,
      findingId,
      before: { status: before },
      after: { status },
      at: new Date().toISOString(),
    });
  } catch {
    worm = "failed";
  }
  return { findingId, before, after: status, worm };
}

/** Mark a finding reviewed (operator acknowledged it). */
export async function reviewFindingAdmin(
  deps: TriageDeps,
  input: TriageFindingInput,
): Promise<IntelTriageResult> {
  return triageFinding(
    deps,
    input.actorEmail,
    input.findingId,
    "reviewed",
    "intel_review",
  );
}

/** Mark a finding dismissed (operator judged it noise / not actionable). */
export async function dismissFindingAdmin(
  deps: TriageDeps,
  input: TriageFindingInput,
): Promise<IntelTriageResult> {
  return triageFinding(
    deps,
    input.actorEmail,
    input.findingId,
    "dismissed",
    "intel_dismiss",
  );
}
