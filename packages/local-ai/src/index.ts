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
