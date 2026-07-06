# @caisson/signing-primitive

Per-tenant evidence signing. Produces a detached Ed25519 signature over a canonical,
chain-anchored manifest body, with an optional RFC-3161 trusted-timestamp countersignature and a
fail-closed verify path.

The signing key is per tenant and is deliberately distinct from the Caisson license-issuer key —
a buyer proves the provenance of their own evidence with their own identity. The signature is
detached, so the signed body stays byte-stable and independently verifiable.

```ts
import {
  Ed25519Signer,
  signEvidencePack,
  verifyEvidenceSignature,
} from "@caisson/signing-primitive";
```

Commercial module. Sits on `@caisson/kernel` plus the shared Ed25519 primitive — down-only,
composed by the Compliance edition, never the reverse.
