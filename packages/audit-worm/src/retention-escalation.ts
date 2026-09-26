// src/retention-escalation.ts — the chain-evidenced escalation helper (ADR-0202, composing
// ADR-0052). One call = one retention change PLUS one `retention.escalated` record on the tenant's
// audit chain — an unrecorded retention change is a FAILED escalation, so the evidence-retention
// gate is provable from the chain + `GetObjectRetention`, never from application logs.
//
// Fail-closed at every seam: the key must sit under the caller's tenant prefix; a COMPLIANCE
// request against a store that cannot harden a mode is refused (never silently downgraded to a
// plain extend); and a chain-append failure fails the WHOLE operation loudly — see
// `escalateRetention` for the evidence-gap semantics.
import { InternalError, ValidationError } from "@caisson-sh/kernel";
import {
  assertSafeKey,
  type ArtifactMeta,
  type ArtifactStore,
} from "./store.ts";
import type { IrreversibleComplianceOptIn, RetentionMode } from "./store.s3.ts";
import type { AppendResult, AuditChainStore } from "./chain-store.ts";

/**
 * The optional GOVERNANCE→COMPLIANCE capability (ADR-0202). NOT on the `ArtifactStore` port —
 * only a backend with a real, root-proof lock (the S3 backend) can honestly offer it; the helper
 * detects it structurally and REFUSES a compliance escalation against a store without it.
 */
export interface ComplianceEscalator {
  escalateToCompliance(
    key: string,
    retainUntil: Date,
    optIn: IrreversibleComplianceOptIn,
    versionId?: string,
  ): Promise<ArtifactMeta>;
}

function canEscalateToCompliance(
  store: ArtifactStore,
): store is ArtifactStore & ComplianceEscalator {
  return (
    typeof (store as Partial<ComplianceEscalator>).escalateToCompliance ===
    "function"
  );
}

/** The store's declared retention mode, when it declares one (the S3 backend does); `null` for a
 *  backend that enforces nothing (the local double) — the chain record never claims a mode the
 *  store cannot back. */
function declaredMode(store: ArtifactStore): RetentionMode | null {
  const mode = (store as { mode?: unknown }).mode;
  return mode === "GOVERNANCE" || mode === "COMPLIANCE" ? mode : null;
}

export interface EscalateRetentionInput {
  readonly store: ArtifactStore;
  /** The tenant's audit chain — the escalation record is evidence, not a log line (ADR-0052). */
  readonly chain: Pick<AuditChainStore, "append">;
  readonly accountId: string;
  /** Must sit under `accountId`'s prefix — a cross-tenant escalation is refused fail-closed. */
  readonly key: string;
  /** Exact provider identity recorded from put; versioned production callers should always pass it. */
  readonly versionId?: string;
  readonly retainUntil: Date;
  /** Present ⇒ escalate GOVERNANCE→COMPLIANCE (the store must expose {@link ComplianceEscalator}). */
  readonly compliance?: { readonly optIn: IrreversibleComplianceOptIn };
}

export interface EscalateRetentionResult {
  /** Updated artifact metadata — `retainUntil` is the authoritative date for the caller's DB
   *  `retain_until` row update (row==object, ADR-0006/0051). */
  readonly meta: ArtifactMeta;
  /** The chain entry + fresh WORM anchor evidencing this escalation. */
  readonly evidence: AppendResult;
}

/**
 * Extend (or COMPLIANCE-escalate) an artifact's retention AND append the
 * `{ kind: "retention.escalated", key, from, to, mode }` evidence record to the tenant's chain.
 *
 * EVIDENCE-GAP semantics (fail-loud, ADR-0202): the store change lands BEFORE the chain append —
 * if the append then throws, the (possibly irreversible, paid) S3 retention change is ALREADY
 * applied but unevidenced. The whole call throws an `InternalError` naming the gap; it is NOT
 * cleanly retryable, because a re-run would refuse on the now-equal date — the operator must
 * reconcile by appending the evidence record directly. Silent success here would be worse: an
 * escalation the chain cannot prove is exactly what auditors treat as no escalation at all.
 */
export async function escalateRetention(
  input: EscalateRetentionInput,
): Promise<EscalateRetentionResult> {
  const { store, chain, accountId, key, versionId, retainUntil, compliance } =
    input;
  const safe = assertSafeKey(key);
  if (safe.accountId !== accountId) {
    throw new ValidationError(
      "audit-worm: escalation key is outside the tenant's prefix",
      { accountId, key },
    );
  }
  if (compliance !== undefined && !canEscalateToCompliance(store)) {
    throw new ValidationError(
      "audit-worm: this ArtifactStore cannot escalate to COMPLIANCE (no escalateToCompliance capability)",
      { key },
    );
  }

  // `from` for the evidence record — the retention BEFORE the change (null = none recorded).
  const before = await store.head(key, versionId);
  if (before?.versionId !== undefined && versionId === undefined) {
    throw new ValidationError(
      "audit-worm: versioned artifact requires its recorded provider version identity",
      { key },
    );
  }
  if (
    before?.versionId !== undefined &&
    versionId !== undefined &&
    before.versionId !== versionId
  ) {
    throw new InternalError(
      "audit-worm: recorded provider version identity does not match the stored artifact",
      { key, versionId, storedVersionId: before.versionId },
    );
  }
  const from = before?.retainUntil?.toISOString() ?? null;

  let meta: ArtifactMeta;
  let mode: RetentionMode | null;
  if (compliance !== undefined && canEscalateToCompliance(store)) {
    meta = await store.escalateToCompliance(
      key,
      retainUntil,
      compliance.optIn,
      versionId,
    );
    mode = "COMPLIANCE";
  } else {
    meta = await store.extendRetention(key, retainUntil, versionId);
    mode = declaredMode(store);
  }
  if (
    versionId !== undefined &&
    meta.versionId !== undefined &&
    meta.versionId !== versionId
  ) {
    throw new InternalError(
      "audit-worm: retention was applied to an unexpected provider version identity",
      { key, versionId, retainedVersionId: meta.versionId },
    );
  }
  const to = (meta.retainUntil ?? retainUntil).toISOString();
  const retainedVersionId = meta.versionId ?? versionId;
  const payload: {
    kind: string;
    key: string;
    versionId?: string;
    from: string | null;
    to: string;
    mode: RetentionMode | null;
  } = { kind: "retention.escalated", key, from, to, mode };
  if (retainedVersionId !== undefined) payload.versionId = retainedVersionId;

  let evidence: AppendResult;
  try {
    evidence = await chain.append(accountId, payload);
  } catch (err) {
    throw new InternalError(
      "audit-worm: retention change applied but the chain append failed — evidence gap; reconcile the chain before trusting this escalation",
      {
        accountId,
        key,
        from,
        to,
        mode,
        cause: err instanceof Error ? err.message : String(err),
      },
    );
  }
  return { meta, evidence };
}
