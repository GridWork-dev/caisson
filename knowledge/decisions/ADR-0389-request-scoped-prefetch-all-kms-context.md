# ADR-0389 — KMS contexts prefetch every key version and zeroize at request exit

- **Date:** 2026-07-25
- **Status:** Accepted (implementation lock from the field-crypto KMS async SPEC)
- **Parent:** ADR-0387 (Azure Key Vault production backing and no resident plaintext-DEK cache) ·
  ADR-0043 (per-tenant keys and the no-remigration invariant) · ADR-0046 (self-describing envelope)
  · ADR-0014 (append-only wrapped-DEK store and KMS-side crypto-shred)

## Context

ADR-0387 makes Azure Key Vault the production field-crypto backend and rejects a synchronous shim
that keeps unwrapped DEKs in a process-lifetime cache. The encrypted Drizzle column cannot simply
await the KMS: `FieldCryptoContext`, `sealField`, and `openField` are synchronous because Drizzle's
`toDriver` and `fromDriver` hooks are synchronous.

The async boundary can move to context bind time, but a context cannot fetch only the current key.
The envelope carries its original key version, and ADR-0043's no-remigration invariant requires a
value sealed under version 1 to remain readable after version 2 or any later version becomes current.
Bind time does not know which historical envelopes the request will read.

## Decisions

### 1. A KMS context prefetches every version from 1 through the current version

The implementing `kmsContext(provider, tenantId)` reads the current version once, then unwraps every
version in the inclusive range `1..current`. It returns a synchronous `FieldCryptoContext` backed by
that request-local key map. `sealField` and `openField` remain synchronous, so the encrypted-column
surface and its callers do not become async.

This chooses SPEC option 1. It is correct by construction for the no-remigration invariant because
every version an envelope can name is present before tenant-scoped work begins.

The accepted cost is linear in the tenant's rotation count: a bind performs one current-version read
plus one KMS unwrap per version, every request pays for historical versions it may not touch, and all
of those plaintext DEKs coexist for the request's lifetime. Rotations are expected to be rare. If
measured rotation depth or KMS latency makes this unacceptable, changing to an async encrypted-column
surface requires a successor ADR; it is not permission to add a resident cache.

### 2. The production binding owns disposal and zeroizes every plaintext DEK in `finally`

`kmsContext` is disposable. The production entry point is `withKmsFieldCryptoContext`, which creates
the context, binds it through the existing `AsyncLocalStorage`, runs the tenant-scoped callback, and
in `finally` overwrites every key buffer with zeroes and clears the version map. Key access after
disposal fails closed.

If one unwrap fails while the context is being built, every version that did unwrap is zeroized
before the original failure propagates. There is no fallback to `DerivedKeyProvider`, the labelled
DEMO vector, or partial plaintext. The KMS failure is the request result.

This is request-scoped key material, not the process-lifetime cache ADR-0387 rejected. The context
object exists only for the callback lifetime on production paths, and the backing buffers are
actively erased at exit rather than left for garbage collection.

### 3. KMS tenants provision on first seal; concurrent first seals elect one append-only winner

Provisioning happens after live BYOK validation and inside the tenant transaction, immediately before
the first seal. Tenant creation does not call Azure, so an account that never stores a secret never
allocates field-key state.

`ensureProvisioned` first reads the current version. If none exists, it attempts version 1. The
wrapped-DEK store remains append-only: it never overwrites a winning `(tenant, version)` row. If two
first seals race, one insert wins; the loser discards and zeroizes its generated plaintext DEK,
re-reads the winning current version in the still-usable transaction, and continues with that key.
Both requests therefore seal under the same durable version without a mutable pointer or a
last-writer-wins rewrap.

Normal rotation remains explicit `provision()`. Concurrent rotations that mint different material for
the same next version remain conflicts rather than being silently adopted.

## Rejected

- **Prefetch current and fail on a historical miss.** This violates the no-remigration invariant and
  turns valid old ciphertext into an incident after rotation.
- **Make every field operation async now.** This is the most general design, but it ripples through
  the Drizzle custom type and every encrypted-column call site. The request-bind boundary solves the
  locked production need with a materially smaller trust-boundary diff.
- **Lazy or process-lifetime sync cache.** A synchronous miss cannot await Azure, and keeping
  unwrapped DEKs after the request directly violates ADR-0387.
- **Provision at tenant creation.** It adds an Azure dependency and unused key rows to every signup,
  including accounts that never submit a BYOK credential.

## Consequences

- Historical reads stay valid after any number of rotations without re-encryption.
- Azure KMS loss fails the complete request closed before encrypted tenant work begins.
- Plaintext DEKs are request-local and explicitly zeroized, but peak request memory and KMS calls grow
  linearly with rotation depth.
- First-seal provisioning needs a conflict-safe append-only store operation; it cannot rely on a
  caught Postgres unique violation that has already aborted the transaction.
- Derived keys remain available only for dev/test and self-hosting buyers. They are not a production
  fallback from the Azure path.
