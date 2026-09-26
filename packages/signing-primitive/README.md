# @caisson/signing-primitive

Per-tenant evidence signing. Produces a detached Ed25519 signature over a canonical,
chain-anchored manifest body, with an optional RFC-3161 trusted-timestamp countersignature and a
fail-closed verify path.

The signing key is per tenant — each tenant proves the provenance of its own evidence with its
own identity. The signature is
detached, so the signed body stays byte-stable and independently verifiable.

```ts
import {
  Ed25519Signer,
  signEvidencePack,
  verifyEvidenceSignature,
} from "@caisson/signing-primitive";
```

## Entry points

- `.` — the full surface, node-capable (the signing identity, the constant-time compares, the Rekor
  Ed25519ph anchoring signer).
- `./browser` — the VERIFY half, safe inside a client bundle (Node >= 20.12): the contracts, the
  signable-payload construction, `verifyEvidenceSignature` over the same `@noble/ed25519` primitive
  the signer uses, and the RFC-3161 test double. A relying party can check a pack in their own
  browser. `Ed25519Signer` is deliberately absent — a tenant seed does not belong in a bundle users
  download — as are `signaturesEqual` and the sync `timestampCountersignsSignature`, whose
  constant-time compare needs `node:crypto` (`timestampCountersignsSignatureAsync` is the browser
  path). Every name on `./browser` is also on `.`.

Apache-2.0. Sits on `@caisson/kernel` plus the shared Ed25519 primitive — down-only, composed by
`@caisson/compliance`, never the reverse.
