# AGENTS — @caisson/field-crypto

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a downstream
edition must know to wire field encryption correctly.

## Invariants (do not violate)

- **The encryption boundary EQUALS the RLS tenant boundary** (ADR-0005/0043). Always encrypt/decrypt
  inside a tenant scope: the Drizzle column REFUSES (throws) with no `withFieldCryptoContext` bound,
  and the async API takes `tenantId` explicitly. Never derive or use a key for an empty tenant.
- **AAD is mandatory and structural.** Every encrypt/decrypt binds `tenant_id ∥ key_version ∥
column-context`. Reuse the SAME `columnContext` string for a column on read and write, or decrypt
  fails. Pick a stable, unique context per column (e.g. `"patient.ssn"`).
- **Never log `MASTER_FIELD_KEY`.** It is read once via `DerivedKeyProvider.fromEnv` and held in a
  private field. Do not stringify the provider into logs/telemetry/embeddings (its `toJSON` redacts).
- **Nonce is internal.** The cipher generates a fresh CSPRNG nonce per encrypt; never pass or reuse
  one. A `(key, nonce)` pair must never repeat.
- **Rotation is a version bump, not a re-encrypt.** `KeyVersionRegistry.rotate(tenantId)` advances
  the current version; existing envelopes keep their own `key_version` and still decrypt. Re-encrypt
  lazily on the next write.

## Choosing a provider

- **`DerivedKeyProvider` (default)** — zero infra; per-tenant HKDF. Backs the sync Drizzle column.
- **`KmsKeyProvider`** — envelope encryption; the KEK stays in the KMS. Async only — for the Drizzle
  column under KMS, pre-resolve + cache DEKs into the sync context (P2 wiring). Supply a real
  `KmsClient` (AWS/GCP/Azure); CI uses `LocalKmsClient` (a real local wrap, no cloud call).
- **Deletion receipts are literal provider truth.** Pending, scheduled, and soft-deleted keys remain
  recoverable and MUST report `irreversible: false`; only a proved destroy/purge reports `true`.

## Envelope (ADR-0046)

`[ format-version 1B (0x01) | alg-id 1B | key_version uint16 BE | nonce 12B | ciphertext | tag 16B ]`,
base64 into `text`. An unknown format-version/alg-id throws — never guess. The golden fixture
`src/__golden__/envelope.json` pins the parsed structure; update only via `BLESS=1`.

## Out of scope (Wave 0)

No evidence-pack logic and no WORM. Cloud adapters are covered by injected doubles in CI; separately
gated live proofs require explicit credentials. This package is the primitive the Compliance edition
consumes (ADR-0006).
