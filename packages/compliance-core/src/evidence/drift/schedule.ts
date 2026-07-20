// src/evidence/drift/schedule.ts — `runComplianceSnapshot`: the scheduled drift-monitor task
// (ADR-0371, SPEC item 1). Same shape as `@caisson/retention-runner`'s `defineRetentionTask` on the
// `@caisson/jobs` `JobQueue` port (`{name, schema, handler}`, payload validated at the boundary,
// deps injected rather than read from module scope) — but compliance-core stays dependency-free of
// @caisson/jobs (the same down-only-composability posture the package already holds toward
// @caisson/audit-worm/@caisson/alerting): `defineComplianceSnapshotTask` returns an object
// STRUCTURALLY identical to `@caisson/jobs`'s `TaskDefinition<unknown>`, so a caller with the real
// package can register it directly — `createPgBossJobQueue([...otherTasks, driftTask])` — with no
// adapter. Scheduling itself (the cron) is a driver capability (`JobQueue#schedule`, ADR-0256), not
// this module's job; `DEFAULT_SNAPSHOT_CRON` documents the suggested daily default, buyer-configurable
// by passing a different cron string to the caller's own `queue.schedule(...)` call.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { strictObject, type JsonValue } from "@caisson/kernel";
import type { EvidencePack } from "../generate.ts";
import { snapshotFromManifest, type ComplianceSnapshot } from "./types.ts";
import { diffSnapshots, type ControlStatusTransition } from "./diff.ts";
import { isTransitionSuppressed, type AcceptedDeviation } from "./deviation.ts";
import {
  buildDriftAlertEvent,
  deliverToAll,
  type DriftAlertChannel,
} from "./alert-sink.ts";
import type { SnapshotAnchorSink } from "./anchor-sink.ts";

/** The `JobQueue` task name the scheduled snapshot enqueues under. */
export const COMPLIANCE_SNAPSHOT_TASK = "compliance.snapshot_run";

/** Suggested default cadence (pg-boss 5-field cron, daily at midnight) — buyer-configurable: pass a
 *  different cron to the caller's own `queue.schedule(COMPLIANCE_SNAPSHOT_TASK, cron)` call. */
export const DEFAULT_SNAPSHOT_CRON = "0 0 * * *";

/** The snapshot-run payload: which tenant to re-run collectors for. `.strict()` — no extra fields. */
export const snapshotTaskPayloadSchema = strictObject({
  accountId: z.string().trim().min(1).max(200),
});
export type SnapshotTaskPayload = z.infer<typeof snapshotTaskPayloadSchema>;

/** A `TaskDefinition`-shaped object — structurally identical to `@caisson/jobs`'s
 *  `TaskDefinition<T>`, so a caller holding the real package can pass this straight into
 *  `createPgBossJobQueue`/`createInMemoryQueue` with no adapter. */
export interface DriftTaskDefinition<T> {
  readonly name: string;
  readonly schema: z.ZodType<T>;
  readonly handler: (payload: T) => Promise<void>;
}

export interface ComplianceSnapshotTaskDeps {
  /**
   * Gather live facts and produce this run's evidence pack (the caller's job — collectors run over
   * substrate facts gathered at the edge, exactly like every other use of `generateEvidencePack`).
   */
  generateSnapshot(accountId: string, now: Date): Promise<EvidencePack>;
  /** The last persisted snapshot for `accountId`, or `null` on the very first run. */
  loadPreviousSnapshot(accountId: string): Promise<ComplianceSnapshot | null>;
  /** Persist this run's projected snapshot so the NEXT run can diff against it. */
  persistSnapshot(
    accountId: string,
    snapshot: ComplianceSnapshot,
  ): Promise<void>;
  /** Every currently-recorded accepted deviation for `accountId` (expired ones may still be
   *  returned — `isTransitionSuppressed` itself checks expiry against `now`). */
  loadDeviations(accountId: string): Promise<readonly AcceptedDeviation[]>;
  /** Where a fired drift-regression alert is delivered — real `AlertChannel[]` from
   *  @caisson/alerting is directly assignable here (see `alert-sink.ts`). */
  alertChannels: readonly DriftAlertChannel[];
  /** The `AlertEvent.recipient` every fired alert carries (a buyer-configured address/channel id). */
  alertRecipient: string;
  /** The every-run anchoring seam — real `AuditChainStore`+`AnchorOutbox` wiring from
   *  @caisson/audit-worm is directly assignable here (see `anchor-sink.ts`). */
  anchorSink: SnapshotAnchorSink;
  /** Injected clock; defaults to the real clock. Never call `Date.now()`/`new Date()` inline below. */
  now?: () => Date;
  /** Injected id generator for alert event ids; defaults to `crypto.randomUUID`. */
  newId?: () => string;
}

/** Round-trip to a genuine JSON value (drops non-JSON shapes) so the anchor sink can hash it —
 *  mirrors `generate.ts`'s own `toJson` helper. */
function toJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/** One snapshot run's result: the generated pack and every control-evidence transition detected. */
export interface ComplianceSnapshotRunResult {
  readonly pack: EvidencePack;
  readonly transitions: readonly ControlStatusTransition[];
}

/**
 * Run one compliance snapshot end to end: generate the pack, diff it against the last persisted
 * snapshot, anchor the digest (EVERY run, unconditionally — SPEC item 5), alert on every
 * flagged-facing transition not suppressed by a live accepted deviation, then persist the new
 * snapshot for next time. Anchoring happens BEFORE alert delivery, so a failed/slow alert channel
 * never skips the WORM commitment for an already-generated pack.
 */
export async function runComplianceSnapshotOnce(
  payload: SnapshotTaskPayload,
  deps: ComplianceSnapshotTaskDeps,
): Promise<ComplianceSnapshotRunResult> {
  const now = deps.now?.() ?? new Date();
  const newId = deps.newId ?? randomUUID;

  const pack = await deps.generateSnapshot(payload.accountId, now);
  const currentSnapshot = snapshotFromManifest(pack.manifest);
  const previousSnapshot =
    (await deps.loadPreviousSnapshot(payload.accountId)) ?? [];
  const transitions = diffSnapshots(previousSnapshot, currentSnapshot);
  const deviations = await deps.loadDeviations(payload.accountId);
  const deviationByControl = new Map(deviations.map((d) => [d.controlId, d]));

  // Anchor EVERY run, unconditionally — exactly one chain append + one outbox row (SPEC item 5).
  const anchor = await deps.anchorSink.appendSnapshotDigest(
    payload.accountId,
    toJson(pack.manifest),
  );
  await deps.anchorSink.enqueueOutboxRow(payload.accountId, anchor);

  for (const transition of transitions) {
    if (transition.to !== "flagged") continue;
    const deviation = deviationByControl.get(transition.controlId);
    if (isTransitionSuppressed(transition, deviation, now)) continue;
    const event = buildDriftAlertEvent({
      id: newId(),
      tenantId: payload.accountId,
      recipient: deps.alertRecipient,
      controlId: transition.controlId,
      collectorId: transition.collectorId,
      reason: transition.toReason ?? "evidence regressed to flagged",
      now,
    });
    await deliverToAll(event, deps.alertChannels);
  }

  await deps.persistSnapshot(payload.accountId, currentSnapshot);

  return { pack, transitions };
}

/**
 * Define `runComplianceSnapshot` as a `TaskDefinition`-shaped object (mirrors
 * `@caisson/retention-runner`'s `defineRetentionTask`). Register it on a real `JobQueue` (the
 * in-memory driver in dev/test; pg-boss/Trigger.dev in prod) and schedule it with
 * `queue.schedule(COMPLIANCE_SNAPSHOT_TASK, cron)` (default: `DEFAULT_SNAPSHOT_CRON`, daily).
 */
export function defineComplianceSnapshotTask(
  deps: ComplianceSnapshotTaskDeps,
): DriftTaskDefinition<unknown> {
  return {
    name: COMPLIANCE_SNAPSHOT_TASK,
    schema: snapshotTaskPayloadSchema,
    handler: async (payload: unknown): Promise<void> => {
      await runComplianceSnapshotOnce(payload as SnapshotTaskPayload, deps);
    },
  };
}
