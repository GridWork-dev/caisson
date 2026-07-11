# AGENTS — @caisson/license-verify

Agent-facing authoring/usage contract (the manifest's `agents` field). What a generation agent or a downstream
edition must know to gate a paid surface on a license correctly. This package is **offline verify
only** — license issuance (signing) never ships here.

## Invariants (do not violate)

- **`verifyLicense` NEVER throws.** It is fail-safe-to-community by contract (threat TM-LIC): a
  null/absent token, a malformed wire string, a signature that does not verify, claims that fail
  strict-parse, a non-canonical signed payload, or an elapsed expiry ALL resolve to
  `{ valid: false, tier: "community", entitlements: [], claims: null }`. Never wrap it in a
  `try/catch` expecting an error path — there isn't one.
- **The SIGNED `tier` is the sole authority.** The cosmetic wire `PREFIX` / `TIER`
  (`CAISSON-PRO-…`) are informational and MUST NOT be consulted for authorization — only
  `verifyLicense(...).tier` / `.entitlements` from the verified claims. A forged prefix never
  escalates.
- **Asymmetric verify, not `timingSafeEqual`.** Verification uses `crypto.verify` (Ed25519,
  algorithm `null`) over the kernel-canonical signed bytes against the baked-in public key
  (ADR-0010). A signature check is its own discipline, NOT a secret comparison — do not route it
  through `safeEqual*`.
- **Canonical-payload conformance is enforced.** The signed bytes MUST equal
  `canonicalize(claims)` (kernel). A token whose payload is authentically signed but not canonical
  is rejected — the issuer always signs canonical bytes, so a mismatch is a crafted token.
- **Perpetual-per-major.** `expiry === null` never lapses; a non-null `expiry` is an ISO-8601
  instant — unparseable or elapsed fails safe to community. `major` pins the covered product major;
  a license is never auto-extended to a later major.
- **Fail-closed when gating.** Treat ONLY `valid === true` with the required tier/entitlement as
  authorized. Default-deny on everything else; never branch on `claims` being non-null without
  checking `valid`.

## Public surface

- `verifyLicense(token, now?) → VerifiedLicense` — the one entry point. `now` is injectable for
  deterministic expiry tests; defaults to the wall clock.
- `decodeToken` / `encodeToken` / `SIGNATURE_BYTES` — the pure wire codec
  (`PREFIX-TIER-base64url(payload ‖ 64-byte signature)`). Codec only: it does not verify.
- `licenseClaimsSchema` / `licenseTierSchema` / `LICENSE_TIERS` / `COMMUNITY_TIER` — the strict
  signed-claims schema and tier enum (`community` → `pro`, CLOSED).

## Golden

`src/__golden__` pins the signed-token KAT (a deterministic test vector — NOT a production key;
the matching private key lives only with the issuer service). Assert with `BLESS` unset; regenerate
deliberately via the harness only when the wire/claims format intentionally changes.

## Out of scope

No license ISSUANCE / signing, no revocation list, no network call. This package is the
primitive paid editions consume to resolve their entitlement tier offline (ADR-0010/0024).
