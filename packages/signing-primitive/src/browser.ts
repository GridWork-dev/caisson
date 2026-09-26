// The browser-safe entry (`@caisson-sh/signing-primitive/browser`, ADR-0396): the detached-signature
// contracts, the real `@noble/ed25519` verify path, the signable-payload construction, and the
// RFC-3161 test-double authority — all safe inside a client bundle. ADDITIVE: the `.` barrel is
// untouched and stays the full node-capable surface, and every name here is also on `.` (the subset
// test in browser-safety.test.ts pins that direction, one-way).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - `Ed25519Signer` / `signEvidencePack` — a signing identity holds a tenant secret; keeping the
//     seed out of a client bundle is the point, not an oversight. (They are browser-CAPABLE; the
//     exclusion is a trust decision, and admitting them later needs its own ADR.)
//   - `signaturesEqual` and the sync `timestampCountersignsSignature` — both route through
//     `@caisson-sh/kernel/node`'s `safeEqualFixed` (node:crypto `timingSafeEqual`). The async twin
//     `timestampCountersignsSignatureAsync` is the browser path.
//   - `ph-signer.ts` (the Rekor Ed25519ph deployment signer) — reads a seed out of the process env.
export {
  ED25519_PUBLIC_BYTES,
  ED25519_SIGNATURE_BYTES,
  StubTimestampAuthority,
  evidenceSignablePayload,
  hexToBytes,
  timestampCountersignsSignatureAsync,
  verifyEvidenceSignature,
} from "./portable.ts";
export type {
  EvidenceSignature,
  SignableManifest,
  SignatureAlgorithm,
  TimestampAuthority,
  TimestampToken,
} from "./portable.ts";
