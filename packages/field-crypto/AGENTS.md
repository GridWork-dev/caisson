# AGENTS — @caisson-sh/field-crypto

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a downstream
edition must know to wire field encryption correctly.

## Invariants (do not violate)

- **The encryption boundary EQUALS the RLS tenant boundary** (ADR-0005/0043). Always encrypt/decrypt
  inside a tenant scope: the Drizzle column REFUSES (throws) with no `withFieldCryptoContext` bound,
  and the async API takes `tenantId` explicitly. Never derive or use a key for an empty tenant.
- **AAD is mandatory and structural.** Every encrypt/decrypt binds `tenant_id ∥ key_version ∥
column-context`. Reuse the SAME `columnContext` string for a column on read and write, or decrypt
  fails. Pick a stable, unique context per column (e.g. `"patient.ssn"`).
- **Never log key material or credentials.** `MASTER_FIELD_KEY` is read once by
  `DerivedKeyProvider.fromEnv`; KMS plaintext DEKs exist only inside a request-scoped context. Do not
  stringify providers, SDK credentials, wrapped keys, or plaintext keys into logs/telemetry/embeddings.
- **Nonce is internal.** The cipher generates a fresh CSPRNG nonce per encrypt; never pass or reuse
  one. A `(key, nonce)` pair must never repeat. This binds the browser twin too:
  `aesGcmSealAsync` exposes no caller-supplied nonce seam.
- **Two entry points, one format.** `.` is the full node-capable surface; `./browser` is the
  WebCrypto/`Uint8Array` half (ADR-0396) for a client bundle or a Worker. A module joins `./browser`
  only if its whole graph passes the package's static source-graph walk AND carries no node GLOBAL
  (`Buffer` is not an import — a bundler substitutes `buffer/` for it silently); both are pinned in
  `src/browser-safety.test.ts`. Every `./browser` name must also exist on `.`. Never add a THIRD
  implementation of the vocabulary: shared logic lives in `src/portable.ts` and the node modules
  delegate to it.
- **Rotation is a version bump, not a re-encrypt.** `KeyVersionRegistry.rotate(tenantId)` advances
  the current version; existing envelopes keep their own `key_version` and still decrypt. Re-encrypt
  lazily on the next write.

## Choosing a provider

- **`DerivedKeyProvider`** — zero infra; per-tenant HKDF. Use for dev/test or a self-hosted
  integration that explicitly selects the two-variable deployment model.
- **`KmsKeyProvider`** — envelope encryption; the KEK stays in the KMS. Call `ensureProvisioned()`
  before binding — a bind reads the current version, so it allocates for read-only callers too
  (ADR-0392 §3) — then `withKmsFieldCryptoContext()`. Bind time unwraps every version from 1 through
  current so historical envelopes stay readable; the helper zeroizes all request-local DEKs in
  `finally`. Never retain a `kmsContext()` or unwrapped key in a process-lifetime cache.
- **Wrapped-DEK persistence is append-only.** Use `PgWrappedKeyStore` inside the already tenant-scoped
  transaction. Rotation appends; it never overwrites or deletes a prior wrapped DEK. Cloud wrapped
  payloads must retain the exact KEK version returned by wrap so later rotations cannot redirect
  historical unwraps.
- **Every KMS operation is deadline-bounded.** Pass `KmsOperationOptions` through the client seam;
  never hold a tenant transaction, advisory lock, or plaintext DEK across an unbounded provider call.
- **Deletion receipts are literal provider truth.** Pending, scheduled, soft-deleted, and
  replica-pending keys remain recoverable and MUST report `irreversible: false`; only a proved
  destroy/purge reports `true`. Never fold a new provider state into an existing one to avoid
  touching the union — these receipts are permanent WORM rows, and `replica-pending-deletion` exists
  because folding it into `pending-deletion` minted a record claiming a retention clock that had not
  started. A state with no completion instant must not carry `scheduledFor`.

## Envelope (ADR-0046)

`[ format-version 1B (0x01) | alg-id 1B | key_version uint16 BE | nonce 12B | ciphertext | tag 16B ]`,
base64 into `text`. An unknown format-version/alg-id throws — never guess. The golden fixture
`src/__golden__/envelope.json` pins the parsed structure; update only via `BLESS=1`.

## Out of scope (Wave 0)

No evidence-pack logic and no WORM. Cloud adapters are covered by injected doubles in CI; separately
gated live proofs require explicit credentials. This package is the primitive the Compliance edition
consumes (ADR-0006).
