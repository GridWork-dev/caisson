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
