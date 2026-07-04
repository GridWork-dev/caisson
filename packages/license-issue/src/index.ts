// @caisson/license-issue — public surface. The PRIVATE Ed25519 license ISSUER: the
// signing-identity port + the default node:crypto PKCS8-env Ed25519 signer (KMS un-wired seam)
// and `issueLicense`, which signs `canonicalize(parse(claims))` into the signed wire token the
// offline `@caisson/license-verify` re-derives byte-for-byte. `private: true` — NEVER
// published; the signing code lives only with the issuer service and is never installable into a buyer
// repo. Composes `@caisson/kernel` (canonicalize, typed errors) + `@caisson/license-verify` (shared
// claims schema + codec) down-only; never depends "up" on an edition (ADR-0003/0022).
export {
  DEFAULT_SIGNING_KEY_ID,
  Ed25519Signer,
  LICENSE_SIGNING_KEY_ENV,
  LICENSE_SIGNING_KEY_ID_ENV,
  type KmsSigner,
  type Signer,
} from "./signer.ts";
export { WIRE_PREFIX, issueLicense } from "./issue.ts";
