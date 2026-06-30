# ADR-0110 — license-issuer implementation locks (private @caisson/license-issue · node:crypto PKCS8 Signer port · production verify-key bake · lazy bearer-gated POST /issue)

Status: accepted · 2026-06-30 · implements ADR-0010 (does not supersede it) · reconciled to ADR-0107 (operator-provisioned production keypair) · Phase P6 Bucket C

ADR-0010 locked the _model_ of offline licensing: a tessera-format Ed25519 token, verified entirely
offline against a baked-in public key, fail-safe-to-community, with the issuer deferred to P6. ADR-0024
shipped the verify half (`@caisson/license-verify`). This ADR locks the implementation forks the
operator resolved for the ISSUER (2026-06-30), inside that envelope. Append-only; supersede with a later
ADR, never edit.

## Decisions

1. **Issuer home → a NEW private package `@caisson/license-issue`.** It mirrors `@caisson/license-verify`
   structurally but holds the SIGNING half, so it is `private: true`, never published, and never
   installable into a buyer repo — the signing code must not ship in any tarball. Commercial under the
   open-core split (ADR-0094/0097): `paid` + `LicenseRef-Caisson-Commercial` (NOT open Base), enforced by
   the standards-gate. It composes `@caisson/kernel` + `@caisson/license-verify` down-only and never
   depends "up" on an edition (ADR-0003/0022).

2. **Reuse the verifier's contract, never re-declare it.** The issuer imports `licenseClaimsSchema`,
   `licenseTierSchema`, `encodeToken`, and the `LicenseClaims`/`LicenseTier` types from
   `@caisson/license-verify`, and `canonicalize` from `@caisson/kernel`. The single correctness invariant
   (the most important guard in the build): the issuer signs **exactly `canonicalize(parse(claims))`** —
   the byte-identical payload `verify.ts` re-derives and asserts (`canonicalize(claims) === decoded.payload`).
   A one-byte divergence would make the verifier reject the signature as non-canonical and silently
   downgrade every license to community. The claims are strict-parsed BEFORE signing, so the issuer never
   signs a shape (unknown tier, extra field, non-UUID id) the verifier would reject.

3. **Signing key behind a `Signer` port, over `node:crypto`.** A `Signer` interface
   (`keyId`/`algorithm`/`publicKey`/`sign`) with a default `Ed25519Signer` over **`node:crypto`** — the
   SAME primitive the verifier accepts (`crypto.verify` over SPKI), so issuer and verifier share one
   implementation rather than pairing `@noble` with `node:crypto`. The private key is held as an opaque
   `KeyObject` in a `#private` field: `node:crypto` never exposes its bytes through enumeration, logging,
   or JSON-serialization, and `crypto.sign` performs the signature in-engine — strictly safer than holding
   a raw 32-byte seed. Construction fails closed on a non-private or non-Ed25519 key; `toJSON` redacts.
   `@noble/ed25519` is dropped from the package's dependencies. A buyer-supplied AWS **KMS** asymmetric
   signer is a documented **UN-WIRED seam** (`KmsSigner` interface, ADR-0047 ethos): an implementation of
   the same port whose private key never leaves the HSM. We do NOT wire AWS — no SDK dependency, no live
   KMS call on any path.

4. **Key material → a PKCS8 DER (base64) key from env.** `Ed25519Signer.fromEnv` reads
   `CAISSON_LICENSE_SIGNING_KEY` — base64-encoded Ed25519 PKCS8 DER, the format the operator provisioned
   under ADR-0107 (`~/.gridwork/env`) — and an optional `LICENSE_SIGNING_KEY_ID`. It throws a typed
   `ConfigError` that NAMES the env key but NEVER echoes its value on a missing/malformed/non-Ed25519 key;
   the base64-decode + DER-parse run inside a `try` so a parse error cannot leak key bytes through an
   exception message (`@caisson/field-crypto` `fromEnv` discipline).

5. **Verify key → the PRODUCTION public key, baked.** `verify.ts`'s baked `LICENSE_PUBLIC_KEY_SPKI_B64`
   is the production issuer key (SPKI DER base64 `MCowBQYDK2VwAyEAYUM+v6AQcPjNRoRJyQpDSA7S/LwNu1CecWQZ7A1OJU0=`,
   fingerprint `0ae7d2abb886ca3d`, provisioned ADR-0107). The previous baked value was the **KAT test
   vector**, whose seed is publicly documented in a code comment (`SHA-256("caisson-license-verify-KAT-seed-v1")`)
   — shipping it would let anyone forge a `pro`/all-entitlements license, voiding the offline-license
   revenue protection, so baking the real key is security-mandatory, not a deferrable DEPLOY nicety.
   Because the production private half never lives in this repo, the tests cannot mint prod-signed tokens;
   instead **a new explicit-key seam `verifyLicenseWithKey(token, publicKey, now?)`** is added to
   `@caisson/license-verify` (the production `verifyLicense` delegates to it with the baked key — the
   public 2-arg contract is unchanged). Tests sign with a DETERMINISTIC DEV keypair and verify through
   that seam; the SHIPPED baked key is pinned independently by a real **prod-signed golden token**
   (`__golden__/prod-signed-token.json`, minted offline with the production private key — a license token
   is public-safe, its detached signature reveals nothing about the private key), verified through the
   production `verifyLicense` entrypoint, plus a regression that a dev-key-signed token is REJECTED by the
   default entrypoint (proving the bake actually happened). The env private key was verified to derive
   exactly the baked SPKI public key before the bake landed.

6. **HTTP issuance → LAZY, bearer-gated `POST /issue`.** `services/license` gains an `app.ts` + `server.ts`
   mirroring `services/docs`: `Bun.serve`, a `createApp` router, a **timing-safe** Bearer gate (SHA-256 →
   `crypto.timingSafeEqual` over the variable-length token, fail-closed when `LICENSE_ISSUE_TOKEN` is
   unset), and a public `/health`. `POST /issue` takes a Zod `.strict()` body (`accountId`/`tier`/`major`/
   `expiry`), resolves the account's entitlements via the EXISTING `resolveAccountEntitlements` inside
   `withTenant` (RLS-scoped — `entitlements` are NEVER taken from the caller, so a caller cannot mint
   itself what it did not buy), builds the `LicenseClaims` (`licenseId` = `crypto.randomUUID()`), signs via
   `issueLicense`, and returns the token. The server refuses to start without BOTH the issue-bearer token
   AND the signing key (`CAISSON_LICENSE_SIGNING_KEY`).

## Deferred (recommended, not blocking — operator-gated DEPLOY act)

- **KMS Signer adapter** — the `Signer`/`KmsSigner` seam is ready; wire AWS KMS Sign/GetPublicKey in P7
  if the operator wants the key off-host.
- **Postgres Transactor wiring** — `startServer(db)` takes an injected tenant `Transactor`; the repo has
  no in-tree production pool (PGlite in tests, `db: Transactor` injected everywhere). The deploy entrypoint
  supplies a Neon-backed Transactor — the same operator-gated DEPLOY seam as the docs-service real-embedder.
- **Entitlement-freshness semantics** — `POST /issue` signs the account's RESOLVED member slugs (a
  snapshot at issue time), which the registry Worker re-expands idempotently and the buyer-MCP gate
  (ADR-0008) consumes directly. Signing raw PURCHASED ids instead (to keep ADR-0071 index-derived
  freshness for already-issued tokens) is a later refinement if re-issue churn proves costly.

## Binding (carried from ADR-0010)

The signing key never ships in a buyer tarball and is never committed or printed; the issuer signs only
`canonicalize(parse(claims))`; the verifier's baked key is the PRODUCTION key and its fail-safe-to-community
contract is unchanged; the cosmetic wire PREFIX/TIER carry no authority — only the signed payload does.
