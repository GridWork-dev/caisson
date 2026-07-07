# @caisson/license-issue

The private Ed25519 license issuer: the counterpart to the offline, publishable
`@caisson/license-verify`. Holds the signing key behind a `Signer` port (the default
`Ed25519Signer`, loaded from a `node:crypto` PKCS8 env key; a buyer-supplied KMS signer is a
documented, un-wired seam of the same port) and mints a signed license token by signing exactly
`canonicalize(parse(claims))` — the byte-identical payload `@caisson/license-verify` re-derives.
`private: true` — **never published**; the signing code lives only with the issuer service.

## What it gives you

- **`Ed25519Signer.fromEnv()`** — builds the default signer from `CAISSON_LICENSE_SIGNING_KEY`
  (base64 Ed25519 PKCS8 DER). A missing or malformed key throws a `ConfigError` that names the env
  var and never echoes its value or the raw key bytes.
- **`issueLicense(signer, claims)`** — strict-parses `claims` through the schema shared with the
  verifier (an unknown field or tier fails closed here, before any key touches them), signs the
  canonicalized payload, and returns the wire token string the verifier checks offline.

## Install

Never published — this package is a workspace-only dependency of the issuer service:

```json
"@caisson/license-issue": "workspace:*"
```

## Use

```ts
import { Ed25519Signer, issueLicense } from "@caisson/license-issue";

const signer = Ed25519Signer.fromEnv(); // CAISSON_LICENSE_SIGNING_KEY, PKCS8 DER base64

const token = await issueLicense(signer, {
  licenseId: "b3f1c2d4-2f0a-4c9a-9b1e-6a7d8e9f0a1b",
  tier: "compliance",
  entitlements: ["audit-worm", "field-crypto"],
  major: 1,
  expiry: "2027-01-01T00:00:00Z",
});
```

## Tests

`bun test packages/license-issue/src` — the signer rejects a missing/malformed/non-Ed25519 key and
never leaks it in an error; `issueLicense` rejects an unknown claim field or tier, and a golden
round-trip proves the signed token verifies against `@caisson/license-verify`.

License: `LicenseRef-Caisson-Commercial`.
