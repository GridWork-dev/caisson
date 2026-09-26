# @caisson/verify-pack

Out-of-band verification for Caisson audit evidence packs. It validates the exact signed file
manifest before checking receipt-chain links, per-length WORM anchors, and Ed25519 signatures. A pack
contains no executable verifier and cannot substitute the program that judges it.

## Current availability

This package has **not been published to a package registry**. It remains `private: true` in this
repository until the operator-gated first publish. The intended post-publish command therefore does
not resolve publicly today:

```sh
export CAISSON_VERIFY_PACK_KEY_SHA256="<independently obtained 64-hex fingerprint>"
npx @caisson/verify-pack ./pack
```

Until that publish occurs, use an independently trusted checkout of this repository:

```sh
bun run packages/verify-pack/src/cli.ts ./pack
```

`./pack` is the logical evidence-pack JSON exported by Caisson. Verification is local and makes no
network calls. The fingerprint must come from a separately trusted issuer channel, never from the
pack itself; verification refuses PASS when it is absent or does not match.

## Programmatic use

```ts
import { verifyEvidencePack } from "@caisson/verify-pack";

const result = await verifyEvidencePack(JSON.parse(packJson), {
  expectedPublicKeySha256: trustedIssuerFingerprint,
});
if (!result.ok) {
  throw new Error(result.errors.join("; "));
}
```

Apache-2.0. Verification only: no signing, exporting, publishing, mutation, fetch, or
execution of pack-supplied code.
