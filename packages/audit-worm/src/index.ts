// @caisson-sh/audit-worm — the compliance evidentiary primitive (ADR-0006/0052/0053/0054).
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
// fail-closed). This package depends DOWN on `@caisson-sh/kernel` + `@caisson-sh/tenancy-rls` only.

// Write-once artifact store + retention.
export {
  type ArtifactMeta,
  type ArtifactObject,
  type PutOptions,
  type ArtifactStore,
  type SafeKey,
  ArtifactExistsError,
  assertSafeKey,
  assertValidArtifactVersionId,
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

// ADR-0379/0380 — Azure Blob version-level immutable storage backend.
export {
  type AzureBlobImmutabilityPolicy,
  type AzureBlockBlobUploadOptions,
  type AzureBlobProperties,
  type AzureBlobClient,
  type AzureBlockBlobClient,
  type AzureBlobContainerClient,
  type AzureBlobArtifactStoreConfig,
  AzureBlobArtifactStore,
} from "./store.azure.ts";

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
  verifyAnchorSignature,
} from "./chain-store.ts";

// Dedicated anchor-signing identity — signs the anchor core at mint.
export {
  type AnchorSigner,
  ANCHOR_SIGNING_KEY_ENV,
  ANCHOR_SIGNING_KEY_ID_ENV,
  DEFAULT_ANCHOR_SIGNING_KEY_ID,
  Ed25519AnchorSigner,
} from "./anchor-signer.ts";

// Append-only locked-version table + derived current.
export {
  type Provenance,
  type LockedVersion,
  type InsertVersionInput,
  type LockedVersionStoreOptions,
  provenanceSchema,
  LockedVersionStore,
} from "./version-store.ts";

// External anchoring, v1 (TSA `trusted-timestamped`) + v1.1 (Rekor `externally-transparent`) legs;
// SPEC external-anchoring, ADR-0332/0346.
export {
  type AnchorGrade,
  type TransparencyTarget,
  type TsaTarget,
  type RekorTarget,
  type OtsTarget,
  type TimestampReceipt,
  type TransparencyReceipt,
  type OtsReceipt,
  type AnchorSubmitReceipt,
  type AnchorReceipt,
  type AnchorOutboxState,
  type AnchorOutboxKey,
  type AnchorOutboxRow,
  type TrustedTimestampLog,
  type TransparencyLog,
  type AnchorSubmissionSigner,
  type IrreversiblePublicityOptIn,
  type TsaAnchorLogConfig,
  anchorGradeSchema,
  transparencyTargetSchema,
  tsaTargetSchema,
  rekorTargetSchema,
  otsTargetSchema,
  timestampReceiptSchema,
  transparencyReceiptSchema,
  otsReceiptSchema,
  anchorSubmitReceiptSchema,
  anchorReceiptSchema,
  anchorOutboxStateSchema,
  anchorOutboxRowSchema,
  targetId,
  sha256Hex,
  anchorReceiptKey,
  PUBLICITY_ACKNOWLEDGEMENT,
  irreversiblePublicityOptIn,
  isIrreversiblePublicityOptIn,
  StubTrustedTimestampLog,
  TsaAnchorLog,
} from "./anchor-transparency.ts";

// External anchoring v1.1 — Rekor v2 public-log submit + offline inclusion-proof verify.
export {
  type RekorAnchorLogConfig,
  type RekorVerifyResult,
  RekorAnchorLog,
  rekorEntryToReceipt,
  verifyRekorReceipt,
} from "./anchor-rekor.ts";

// External anchoring v1.1 — OpenTimestamps drop-in (Fork R-γ; submit leg + stub; verify is a seam).
export {
  type OpenTimestampsAnchorLogConfig,
  OpenTimestampsAnchorLog,
  StubOpenTimestampsLog,
} from "./anchor-ots.ts";

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
