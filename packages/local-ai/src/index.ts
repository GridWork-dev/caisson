// @caisson/local-ai — the Local-first AI EDITION (ADR-0050/0064/0067/0073). A COMPOSITION, not a
// fork: it depends DOWN-ONLY on the shipped base/primitive packages (edition→base, never up —
// ADR-0003/0022) and adds the edition-only surface (a built two-way sync engine, an
// `InferenceBackend` port, a zero-egress privacy gate, at-rest field-crypto, and the file-per-tenant
// resolver) in later tasks. At T9 this barrel re-exports the composed base seams the edition is
// built on — no base contract is rebuilt here. Edition-only surface is appended to this barrel as
// each task lands (tenancy, crypto, inference, privacy, sync, migration assembly).

// Local hybrid retrieval (sqlite-vec vec0 KNN + FTS5 + RRF, RRF_K=60, FTS-only degrade) plus the
// file-per-tenant isolation floor — the resolved path IS the tenant boundary (ADR-0067/0073).
export {
  LocalStore,
  RRF_K,
  tenantDbPath,
  openTenantDb,
  type StoreDoc,
  type HybridSearchOptions,
  type SearchHit,
} from "@caisson/local-store";

// Offline, fail-safe-to-community Ed25519 license verification — the signed tier is the sole
// authority; verify never raises (ADR-0010). The issuer is P6; only offline verify is composed here.
export {
  verifyLicense,
  decodeToken,
  encodeToken,
  licenseClaimsSchema,
  licenseTierSchema,
  LICENSE_TIERS,
  COMMUNITY_TIER,
  type VerifiedLicense,
  type LicenseClaims,
  type LicenseTier,
  type LicenseToken,
} from "@caisson/license-verify";

// At-rest field-crypto seams reused for local at-rest encryption — per-tenant HKDF derivation +
// AEAD via the AeadCipher seam + a self-describing envelope; `tenant_id` is bound into the key
// derivation, so a tenant-B file cannot open a tenant-A ciphertext (ADR-0055/0045/0046).
export {
  DerivedKeyProvider,
  deriveTenantKey,
  sealField,
  openField,
  encryptedColumn,
  type FieldKeyProvider,
  type SyncFieldKeyProvider,
  type AeadCipher,
} from "@caisson/field-crypto";

// At-rest field encryption composed over the file-per-tenant local store (ADR-0055/0064 — TM-REST):
// the edition seam that seals/opens a sensitive column under a per-tenant derived key before it
// touches the SQLite file, so a tenant-B file cannot open a tenant-A ciphertext (AEAD auth-fail).
export { AtRestStore } from "./crypto/at-rest.ts";

// Kernel primitives the edition composes: canonical bytes (license payload signing + audit chain),
// the single guarded outbound chokepoint the privacy/egress gate wraps, and the pure
// migration-assembly the edition's ordered, idempotent schema_version ledger builds on
// (ADR-0070/0075).
export {
  canonicalize,
  fetchWithTimeout,
  assembleMigrations,
  type JsonValue,
} from "@caisson/kernel";

// The `InferenceBackend` port + its backends (ADR-0064). The local store leaves the embedding an
// injected seam; the edition wires it here. CI exercises ONLY the deterministic, zero-network
// `StubInferenceBackend`; the real on-device ONNX backend (first-run model fetch) and the
// rented/hosted backend share the same port and stay the un-exercised live paths.
export { EMBEDDING_DIM } from "./inference/backend.ts";
export type {
  InferenceBackend,
  CompletionRequest,
  CompletionResult,
} from "./inference/backend.ts";
export { StubInferenceBackend } from "./inference/stub.ts";
export {
  OnnxEmbeddingBackend,
  DEFAULT_ONNX_MODEL,
  type OnnxBackendConfig,
} from "./inference/onnx-backend.ts";
export {
  RentedInferenceBackend,
  createLiveRentedTransport,
  type RentedBackendConfig,
  type RentedTransport,
  type RentedEmbedResponse,
  type RentedCompleteResponse,
  type MeterSink,
  type LiveRentedTransportConfig,
} from "./inference/rented-backend.ts";
// The OpenRouter rented transport (ADR-0201): the proven-live `RentedTransport` wire — OpenRouter's
// OpenAI-compatible `/embeddings` + `/chat/completions` through the same egress-guard chokepoint,
// usage mapped to integer token units for the metered sink (ADR-0007).
export {
  createOpenRouterRentedTransport,
  type OpenRouterRentedTransportConfig,
} from "./inference/openrouter-transport.ts";
// The enterprise rented drivers (ADR-0204, closing the ADR-0160 Surface-B defer): Azure OpenAI
// (api-key auth, per-deployment routes + api-version) and AWS Bedrock (hand-rolled SigV4 on
// node:crypto — vector-pinned, no @aws-sdk; InvokeModel embed + Converse complete). Same
// egress-guard chokepoint, strict re-validation, and integer metering as the OpenRouter template.
// Ollama stays OUT of the rented seam per ADR-0204 (self-hosted, unmetered — not "rented").
export {
  createAzureOpenAIRentedTransport,
  type AzureOpenAIRentedTransportConfig,
} from "./inference/azure-openai-transport.ts";
export {
  createBedrockRentedTransport,
  type BedrockRentedTransportConfig,
} from "./inference/bedrock-transport.ts";

// The runtime privacy / egress gate (ADR-0064, TM-EGRESS). Zero-egress-by-default, fail-closed-to-
// offline: the guard wraps the kernel `fetchWithTimeout` chokepoint and blocks every non-allowlisted
// host; an empty allowlist (`ZERO_EGRESS_POLICY`) blocks ALL egress. "Your data never leaves the device."
export {
  EgressGuard,
  createEgressGuard,
  type GuardedFetch,
} from "./privacy/egress-guard.ts";
export {
  parsePrivacyPolicy,
  localOnlyPolicy,
  ZERO_EGRESS_POLICY,
  privacyPolicySchema,
  egressSinkSchema,
  sinkKindSchema,
  privacyModeSchema,
  SANCTIONED_SINK_KINDS,
  PRIVACY_MODES,
  type PrivacyPolicy,
  type EgressSink,
  type SanctionedSinkKind,
  type PrivacyMode,
} from "./privacy/policy.ts";

// The built two-way sync engine (ADR-0064, TM-SYNC): per-tenant changeset capture + the fail-closed
// peer-boundary parse + the persistent LWW/CRDT-with-tombstones reconcile. The local canonical store
// is the convergence target — peers move toward it; a tenant-A changeset can never apply to a tenant-B
// file (file-per-tenant partition, ADR-0073).
export { ChangesetLog, parseChangeset } from "./sync/changeset.ts";
export { reconcileReplicas, type ReconciledRow } from "./sync/reconcile.ts";
export {
  reconcileWithTombstones,
  gcTombstones,
  type Tombstone,
  type TombstoneReconcileResult,
} from "./sync/tombstone.ts";
export { compareStamps, stampFromEntry, type HlcStamp } from "./sync/clock.ts";
export type {
  Changeset,
  ChangesetEntry,
  ChangesetCapture,
  ChangeOp,
  RowChange,
  RowValues,
  ApplyResult,
  ReconcileResult,
  SyncEngine,
} from "./sync/port.ts";

// The edition migration assembly + the ordered, idempotent `schema_version` ledger (ADR-0070/0075,
// data-migration). Composes local-store's retrieval tables + the edition's `items`/sync-metadata
// tables into one down-only sequence; the `vec0` embedding dim + sync-metadata columns are IRREVERSIBLE.
export {
  migrate,
  assembleEditionMigrations,
  editionMigrations,
  type MigrateOptions,
  type MigrateResult,
} from "./store/migrate.ts";
