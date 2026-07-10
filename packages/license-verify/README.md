# @caisson/license-verify

Offline, fail-safe-to-community license verification — the floor a paid edition stands on to resolve
its entitlement tier with **zero network**. Supports asymmetric license verify (ADR-0010) and
perpetual-per-major licensing (ADR-0024).

This package is **verify only**. License issuance (signing) never ships here — the matching
private key lives solely with the issuer service.

## What it gives you

- **Offline Ed25519 verification.** `crypto.verify` (algorithm `null`) over the kernel-canonical
  signed bytes against a **baked-in SPKI public key** — no key fetch, no network, no KMS. A
  signature check, not a secret comparison (so `crypto.verify`, never `timingSafeEqual`).
- **Fail-safe-to-community.** `verifyLicense` NEVER throws. An absent/null token, a malformed wire
  string, a bad signature, claims that fail strict-parse, a non-canonical payload, or an elapsed
  expiry all resolve to the free `community` tier — an unlicensed install keeps running and a
  forged/replayed token never escalates (threat TM-LIC).
- **Signed claims are the sole authority.** The cosmetic wire `PREFIX`/`TIER` (`CAISSON-PRO-…`) are
  informational; only the verified, signed `tier` + `entitlements[]` gate authorization.
- **Strict claims schema.** `licenseId` (UUID) · `tier` (`community`|`pro`, closed enum) ·
  `entitlements[]` (bounded slugs) · `major` (perpetual-per-major) · `expiry` (ISO-8601 or `null`
  for perpetual). `.strict()` — an unknown key fails closed.
- **Pure wire codec.** `PREFIX-TIER-base64url(payload ‖ 64-byte signature)` encode/decode, framework
  -free, fail-closed on any malformed shape.

## Usage

```ts
import { verifyLicense } from "@caisson/license-verify";

const license = verifyLicense(process.env.CAISSON_LICENSE_TOKEN);
if (license.valid && license.entitlements.includes("local-first")) {
  // authorized — paid surface unlocked
} else {
  // fail-closed: community tier
}
```

`verifyLicense(token, now?)` — `token` may be the raw wire string or `null`/`undefined`/`""` for an
unlicensed install; `now` is injectable for deterministic expiry tests. Returns
`{ valid, tier, entitlements, claims }`; never throws.

## Out of scope

No license issuance/signing, no revocation, no network. Consumed by paid editions to resolve
their tier offline (ADR-0010/0024).
