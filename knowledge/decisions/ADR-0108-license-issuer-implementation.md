# ADR-0108 — license-issuer implementation locks (private @caisson/license-issue · env-seed Signer port · lazy bearer-gated POST /issue)

Status: accepted · 2026-06-30 · implements ADR-0010 (does not supersede it) · Phase P6 Bucket C

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

3. **Signing key behind a `Signer` port.** Mirrors `@caisson/compliance` `evidence/sign.ts`: a `Signer`
   interface (`keyId`/`algorithm`/`publicKey`/`sign`) with a default `Ed25519Signer` over `@noble/ed25519`
   — the SAME primitive the verifier accepts — holding the 32-byte seed in a `#private` field, defensively
   copied, fail-closed on a bad length, and `toJSON`-redacted so the seed never leaks through logging or
   serialization. A buyer-supplied AWS **KMS** asymmetric signer is a documented **UN-WIRED seam**
   (`KmsSigner` interface, ADR-0047 ethos): an implementation of the same port whose private key never
   leaves the HSM. We do NOT wire AWS — no SDK dependency, no live KMS call on any path.

4. **Key material → a 32-byte hex seed from env.** Mirrors `@caisson/field-crypto` `provider.ts` `fromEnv`:
   `Ed25519Signer.fromEnv` reads `LICENSE_SIGNING_SEED` (strict `/^[0-9a-fA-F]{64}$/`) and an optional
   `LICENSE_SIGNING_KEY_ID`, throwing a typed `ConfigError` that NAMES the env key but NEVER echoes its
   value on a missing/short/non-hex seed (no key material may reach a log/egress path).

5. **Verify key stays the KAT vector through P6.** `verify.ts`'s baked public key is left UNCHANGED; no
   production public key is generated or baked, and the verify golden is NOT re-blessed. Minting a real
   keypair + rotating the baked verify key is a deliberate, operator-gated DEPLOY act, not a build change.
   Consequently the issuer's tests sign with the **deterministic KAT seed**
   (SHA-256("caisson-license-verify-KAT-seed-v1")) so an issued token validates against the baked KAT
   public key — the only key the shipped verifier trusts (it takes no injectable pubkey). Ed25519 is
   deterministic (RFC 8032), so the KAT claims reproduce the committed golden token byte-for-byte, the
   same token `verify.ts`'s own KAT pins — tying issuer, verifier, and codec to one key.

6. **HTTP issuance → LAZY, bearer-gated `POST /issue`.** `services/license` gains an `app.ts` + `server.ts`
   mirroring `services/docs`: `Bun.serve`, a `createApp` router, a **timing-safe** Bearer gate (SHA-256 →
   `crypto.timingSafeEqual` over the variable-length token, fail-closed when `LICENSE_ISSUE_TOKEN` is
   unset), and a public `/health`. `POST /issue` takes a Zod `.strict()` body (`accountId`/`tier`/`major`/
   `expiry`), resolves the account's entitlements via the EXISTING `resolveAccountEntitlements` inside
   `withTenant` (RLS-scoped — `entitlements` are NEVER taken from the caller, so a caller cannot mint
   itself what it did not buy), builds the `LicenseClaims` (`licenseId` = `crypto.randomUUID()`), signs via
   `issueLicense`, and returns the token. The server refuses to start without BOTH the issue-bearer token
   AND the signing seed.

## Deferred (recommended, not blocking — operator-gated DEPLOY act)

- **Production keypair + verify-key rotation** — generate the real Ed25519 keypair, bake its public key
  into `verify.ts`, re-bless the verify golden. DEPLOY-time, operator-gated (Decision 5).
- **KMS Signer adapter** — the `Signer`/`KmsSigner` seam is ready; wire AWS KMS Sign/GetPublicKey in P7
  if the operator wants the seed off-host.
- **Postgres Transactor wiring** — `startServer(db)` takes an injected tenant `Transactor`; the repo has
  no in-tree production pool (PGlite in tests, `db: Transactor` injected everywhere). The deploy entrypoint
  supplies a Neon-backed Transactor — the same operator-gated DEPLOY seam as the docs-service real-embedder.
- **Entitlement-freshness semantics** — `POST /issue` signs the account's RESOLVED member slugs (a
  snapshot at issue time), which the registry Worker re-expands idempotently and the buyer-MCP gate
  (ADR-0008) consumes directly. Signing raw PURCHASED ids instead (to keep ADR-0071 index-derived
  freshness for already-issued tokens) is a later refinement if re-issue churn proves costly.

## Binding (carried from ADR-0010)

The signing key never ships in a buyer tarball; the issuer signs only `canonicalize(parse(claims))`; the
verifier's baked key and fail-safe-to-community contract are unchanged; the cosmetic wire PREFIX/TIER
carry no authority — only the signed payload does.
