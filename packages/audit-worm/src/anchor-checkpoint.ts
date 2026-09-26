// src/anchor-checkpoint.ts — the external-anchoring checkpoint handler + job wiring (CR-16, ADR-0332).
//
// The concrete anchoring logic deliberately lives in audit-worm, never packages/jobs: it imports
// only the GENERIC scheduling ports (defineTask / JobQueue) from jobs and registers this concrete
// handler from here (CR-16 — jobs gains no anchoring knowledge, no upward dependency). The
// scheduler that fans this task out per-tenant lives in the host application — a sibling stage.
//
// The handler NEVER runs inside `append()` (SPEC non-goal / KNOWN-BOUND): it is a scheduled job that
// reads the anchor AFTER the append commits. It composes the outbox (durability) + the port (egress) +
// the WORM store (evidence). Order is load-bearing:
//   1. read current anchor (skip if the tenant has no chain)
//   2. skip if a WORM receipt already exists for (len, target)  — idempotency source of truth
//   3. a pre-existing `submitted` outbox row → needs_reconcile, NEVER a blind resubmit (CR-02)
//   4. outbox enqueuePending → markSubmitted (persist-before-egress fence) → port.submit
//   5. write the receipt to WORM (write-once, same retention floor as the anchor) → markReceipted
// A crash between submit and receipt-persist leaves the row `submitted`; a later tick resolves it to
// needs_reconcile (step 3) rather than duplicating the submission.
import { z } from "zod";
import {
  defineTask,
  type JobQueue,
  type TaskDefinition,
} from "@caisson-sh/jobs";
import { parseStrict, strictObject } from "@caisson-sh/kernel";
import {
  anchorReceiptKey,
  anchorReceiptSchema,
  sha256Hex,
  targetId,
  type AnchorOutboxKey,
  type AnchorReceipt,
  type TransparencyLog,
  type TransparencyTarget,
} from "./anchor-transparency.ts";
import type { AnchorOutbox } from "./anchor-outbox.ts";
import { ArtifactExistsError, type ArtifactStore } from "./store.ts";
import { DEFAULT_RETENTION_YEARS, retainUntilFrom } from "./retain.ts";

/** The pg-boss task name the per-tenant scheduler enqueues under. */
export const ANCHOR_CHECKPOINT_TASK = "audit-worm.anchor_checkpoint";

/** The task payload: which tenant to checkpoint. `.strict()` — no extra fields. */
export const anchorCheckpointPayloadSchema = strictObject({
  accountId: z.string().min(1),
});
export type AnchorCheckpointPayload = z.infer<
  typeof anchorCheckpointPayloadSchema
>;

/**
 * The current WORM anchor for a tenant: its length + the EXACT canonical bytes stored in WORM (the
 * `encodeAnchor` output — the bytes the imprint is taken over). `null` when the tenant has no chain.
 *
 * Injected as a port so this handler never imports chain-store internals (`encodeAnchor`/`anchorKey`
 * are file-private, and chain-store.ts is owned by a parallel lane this wave). The deployed adapter —
 * reading the current anchor object off the WORM store / AuditChainStore — is wired at scheduler time
 * by the host or at reconcile, once the chain-store accessor lands.
 */
export interface CurrentAnchorReader {
  readCurrentAnchor(accountId: string): Promise<{
    readonly length: number;
    readonly anchorBytes: Uint8Array;
  } | null>;
}

export interface AnchorCheckpointDeps {
  /** The WORM store the receipt is read/written from (`ArtifactStore`). */
  readonly store: ArtifactStore;
  /** The durable outbox (persist-before-egress state machine). */
  readonly outbox: AnchorOutbox;
  /**
   * The target-agnostic anchoring port. `TsaAnchorLog` (`trusted-timestamped`) or `RekorAnchorLog` /
   * `OpenTimestampsAnchorLog` (`externally-transparent`) in prod; a stub in tests. The handler is
   * target-blind — it writes whatever receipt `submit` returns under the target's grade.
   */
  readonly log: TransparencyLog;
  /** Reads the tenant's current anchor + its canonical bytes (see {@link CurrentAnchorReader}). */
  readonly reader: CurrentAnchorReader;
  /** The anchor target (v1: a TSA target carrying `grade: "trusted-timestamped"`). */
  readonly target: TransparencyTarget;
  /** Clock for retention + `receiptedAt`. Default: wall clock. */
  readonly now?: () => Date;
  /** WORM retention (years) for the receipt object. Default: the `retain.ts` legal floor. */
  readonly retentionYears?: number;
}

/** The outcome of one checkpoint tick for a tenant. */
export type AnchorCheckpointResult =
  | { readonly status: "empty" } // no chain yet — nothing to anchor
  | { readonly status: "skipped" } // already receipted, or a terminal outbox row
  | { readonly status: "receipted"; readonly receiptKey: string }
  | { readonly status: "needs_reconcile" }; // crash-window row surfaced to the operator

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Anchor the tenant's current checkpoint through the outbox to the timestamp log and persist the
 * grade-tagged WORM receipt. Idempotent + crash-safe (see the module header). Returns a typed outcome;
 * throws only on an unexpected submit/persist error the job runner should surface + retry.
 */
export async function runAnchorCheckpoint(
  accountId: string,
  deps: AnchorCheckpointDeps,
): Promise<AnchorCheckpointResult> {
  const now = deps.now ?? ((): Date => new Date());
  const target = targetId(deps.target);

  const current = await deps.reader.readCurrentAnchor(accountId);
  if (current === null) return { status: "empty" };

  const anchorDigest = sha256Hex(current.anchorBytes);
  const key: AnchorOutboxKey = {
    accountId,
    target,
    anchorLength: current.length,
    anchorDigest,
  };
  const receiptKey = anchorReceiptKey(accountId, current.length, target);

  // Resolve the durable provider identity before any presence check. On versioned backends a key is
  // only a mutable current pointer; the outbox row binds us to the immutable version put returned.
  const existing = await deps.outbox.get(key);
  const receiptVersionId = existing?.receiptVersionId ?? undefined;

  // Idempotency: the exact WORM receipt object is the source of truth. A versioned provider's
  // current pointer is insufficient unless the outbox durably names the immutable version.
  const storedReceipt = await deps.store.head(receiptKey, receiptVersionId);
  if (
    storedReceipt?.versionId !== undefined &&
    (receiptVersionId === undefined ||
      storedReceipt.versionId !== receiptVersionId)
  ) {
    if (existing?.state === "receipted") {
      await deps.outbox.markReceiptIdentityMissing(
        key,
        "receipt exists but its provider version identity is missing or mismatched",
      );
    }
    return { status: "needs_reconcile" };
  }
  if (storedReceipt !== null) return { status: "skipped" };

  // A pre-existing outbox row from an interrupted prior tick decides whether we may (re)submit.
  if (existing !== null) {
    if (existing.state === "submitted") {
      // The TSA MAY have accepted the imprint — resolve to needs_reconcile, never blind-resubmit.
      await deps.outbox.markNeedsReconcile(
        key,
        "prior submit unconfirmed; reconcile before resubmit",
      );
      return { status: "needs_reconcile" };
    }
    if (existing.state !== "pending") {
      // receipted (without a WORM object — checked above), failed, or needs_reconcile: all terminal.
      return { status: "skipped" };
    }
    // pending: an earlier tick crashed before submitting — safe to (re)drive from here.
  }

  // Persist intent BEFORE egress, then fence the submit.
  await deps.outbox.enqueuePending(key);
  await deps.outbox.markSubmitted(key);

  let receipt;
  try {
    receipt = await deps.log.submit(current.anchorBytes);
  } catch (err) {
    await deps.outbox.markFailed(key, errorMessage(err));
    throw err;
  }

  const receiptObject: AnchorReceipt = parseStrict(anchorReceiptSchema, {
    accountId,
    target,
    anchorLength: current.length,
    anchorDigest,
    grade: deps.target.grade, // the target's pinned grade; the receipt shape matches it (union)
    receipt,
    receiptedAt: now().toISOString(),
  });
  const body = new TextEncoder().encode(JSON.stringify(receiptObject));
  const retainUntil = retainUntilFrom(
    now(),
    deps.retentionYears ?? DEFAULT_RETENTION_YEARS,
  );

  try {
    const meta = await deps.store.put(receiptKey, body, {
      retainUntil,
      contentType: "application/json",
    });
    await deps.outbox.markReceipted(key, meta.versionId);
  } catch (err) {
    if (err instanceof ArtifactExistsError) {
      // A concurrent tick already wrote the receipt — the anchor is proven; converge to receipted.
      await deps.outbox.markReceipted(key).catch(() => undefined);
      return { status: "skipped" };
    }
    // Receipt persist failed AFTER a successful submit — the CR-02 window. Surface, never resubmit.
    await deps.outbox.markNeedsReconcile(
      key,
      "receipt persist failed after submit",
    );
    return { status: "needs_reconcile" };
  }

  return { status: "receipted", receiptKey };
}

/**
 * Register the checkpoint handler as a `@caisson-sh/jobs` `TaskDefinition` (the CR-16 boundary: the
 * concrete handler is defined HERE, in commercial audit-worm, using only the generic `defineTask` port
 * from open packages/jobs). The deployed scheduler registers this on its queue and enqueues per tenant.
 */
export function defineAnchorCheckpointTask(
  deps: AnchorCheckpointDeps,
): TaskDefinition<unknown> {
  return defineTask(
    ANCHOR_CHECKPOINT_TASK,
    anchorCheckpointPayloadSchema,
    async (payload: AnchorCheckpointPayload): Promise<void> => {
      await runAnchorCheckpoint(payload.accountId, deps);
    },
  );
}

/**
 * Enqueue one tenant's checkpoint, overlap-safe. `singletonKey = accountId` so a slow tick can never
 * stack a second concurrent run for the same tenant (the outbox state guard is the second belt).
 */
export async function enqueueAnchorCheckpoint(
  queue: JobQueue,
  payload: AnchorCheckpointPayload,
): Promise<void> {
  await queue.enqueue(ANCHOR_CHECKPOINT_TASK, payload, {
    singletonKey: payload.accountId,
  });
}
