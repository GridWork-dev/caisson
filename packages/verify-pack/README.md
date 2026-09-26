# @caisson-sh/verify-pack

Out-of-band verification for Caisson audit evidence packs. It validates the exact signed file
manifest before checking receipt-chain links, per-length WORM anchors, and Ed25519 signatures. A pack
contains no executable verifier and cannot substitute the program that judges it.

## Usage

```sh
export CAISSON_VERIFY_PACK_KEY_SHA256="<independently obtained 64-hex fingerprint>"
bunx @caisson-sh/verify-pack ./pack.json
```

From a checkout of this repository you trust, the same CLI runs as
`bun run packages/verify-pack/src/cli.ts ./pack.json`.

`./pack.json` is the logical evidence-pack JSON exported by Caisson. Verification is local and makes no
network calls. The fingerprint must come from a separately trusted issuer channel, never from the
pack itself; verification refuses PASS when it is absent or does not match.

## Programmatic use

```ts
import { verifyEvidencePack } from "@caisson-sh/verify-pack";

const result = await verifyEvidencePack(JSON.parse(packJson), {
  expectedPublicKeySha256: trustedIssuerFingerprint,
});
if (!result.ok) {
  throw new Error(result.errors.join("; "));
}
```

Apache-2.0. Verification only: no signing, exporting, publishing, mutation, fetch, or
execution of pack-supplied code.
