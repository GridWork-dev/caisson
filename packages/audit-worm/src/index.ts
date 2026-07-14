// @caisson/audit-worm — the compliance evidentiary primitive (ADR-0006/0052/0053/0054).
//
// Three composable layers over the kernel's pure integrity algebra (it COMPOSES `canonicalize`/
// `chainEntry`/`anchorChain`/`verifyChain`/`validateVersionSet`, never re-implements them):
//   - ArtifactStore: a write-once object port + a retention-ignored fs double + an S3
//     Object-Lock implementation (GOVERNANCE default; COMPLIANCE only via a typed irreversible
//     opt-in) + an `{account_id}/…` key-safety guard + the HIPAA/SEC retention floor.
//   - AuditChainStore: an append-only per-tenant chain table whose every append mints a fresh
//     length-keyed, write-once WORM anchor — tamper, truncation, and rewrite are all evident.
//   - LockedVersionStore: an append-only locked-version table with NO stored "current" — the
//     current version is a derived no-successor predicate, cross-checked against the kernel model.
//
// Every method is tenant-scoped through `withTenant` (the encryption/RLS boundary, ADR-0005,
// fail-closed). This package depends DOWN on `@caisson/kernel` + `@caisson/tenancy-rls` only.

// Write-once artifact store + retention.
export {
  type ArtifactMeta,
  type ArtifactObject,
  type PutOptions,
  type ArtifactStore,
  type SafeKey,
  ArtifactExistsError,
  assertSafeKey,
  buildArtifactKey,
} from "./store.ts";

export { LocalArtifactStore } from "./store.local.ts";

export {
  type S3Sendable,
  type RetentionMode,
  type IrreversibleComplianceOptIn,
  type S3ArtifactStoreConfig,
  COMPLIANCE_ACKNOWLEDGEMENT,
  irreversibleComplianceOptIn,
  S3ArtifactStore,
} from "./store.s3.ts";

// ADR-0267 — GCS Object Retention Lock backend.
export {
  type GcsSendable,
  type GcsRetentionMode,
  type GcsArtifactStoreConfig,
  type GcsServiceAccountCredentials,
  GcsArtifactStore,
  createGcsServiceAccountTransport,
} from "./store.gcs.ts";

// ADR-0267 — R2 backend: S3-compatible data plane + Cloudflare bucket-lock retention plane.
export {
  type R2LockCondition,
  type R2LockRule,
  type R2LockReader,
  type R2LockReaderConfig,
  type R2ArtifactStoreConfig,
  R2ArtifactStore,
  createR2LockReader,
} from "./store.r2.ts";

export {
  MIN_RETENTION_YEARS,
  DEFAULT_RETENTION_YEARS,
  retainUntilFrom,
} from "./retain.ts";

// ADR-0202 — chain-evidenced, strictly-monotonic retention escalation.
export {
  type ComplianceEscalator,
  type EscalateRetentionInput,
  type EscalateRetentionResult,
  escalateRetention,
} from "./retention-escalation.ts";

// Append-only audit chain + WORM anchor.
export {
  type AuditChainStoreOptions,
  type AppendResult,
  type RowProof,
  type RowProofUnverifiable,
  AuditChainStore,
} from "./chain-store.ts";

// Append-only locked-version table + derived current.
export {
  type Provenance,
  type LockedVersion,
  type InsertVersionInput,
  type LockedVersionStoreOptions,
  provenanceSchema,
  LockedVersionStore,
} from "./version-store.ts";

// External anchoring, v1 (TSA `trusted-timestamped` leg; SPEC external-anchoring, ADR-0332/0346).
export {
  type AnchorGrade,
  type TransparencyTarget,
  type TsaTarget,
  type TimestampReceipt,
  type AnchorReceipt,
  type AnchorOutboxState,
  type AnchorOutboxKey,
  type AnchorOutboxRow,
  type TrustedTimestampLog,
  type TsaAnchorLogConfig,
  anchorGradeSchema,
  transparencyTargetSchema,
  tsaTargetSchema,
  timestampReceiptSchema,
  anchorReceiptSchema,
  anchorOutboxStateSchema,
  anchorOutboxRowSchema,
  targetId,
  sha256Hex,
  anchorReceiptKey,
  StubTrustedTimestampLog,
  TsaAnchorLog,
} from "./anchor-transparency.ts";

export { AnchorOutbox, ANCHOR_OUTBOX_SCHEMA_SQL } from "./anchor-outbox.ts";

export {
  type AnchorCheckpointPayload,
  type AnchorCheckpointResult,
  type AnchorCheckpointDeps,
  type CurrentAnchorReader,
  ANCHOR_CHECKPOINT_TASK,
  anchorCheckpointPayloadSchema,
  runAnchorCheckpoint,
  defineAnchorCheckpointTask,
  enqueueAnchorCheckpoint,
} from "./anchor-checkpoint.ts";

export {
  type VerifyExternalDeps,
  type AnchorVerification,
  verifyExternal,
} from "./verify-external.ts";
