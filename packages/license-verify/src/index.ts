// @caisson/license-verify — public surface (ADR-0010). Offline, fail-safe-to-community Ed25519
// license verification: the tessera-format wire codec, the strict signed-claims schema, and the
// verifier. The license ISSUER is P6 — only OFFLINE verify lives here. Composes `@caisson/kernel`
// (`canonicalize`, typed errors) down-only; never depends up on an edition (ADR-0003/0022).
export {
  SIGNATURE_BYTES,
  decodeToken,
  encodeToken,
  type LicenseToken,
} from "./token.ts";
export {
  COMMUNITY_TIER,
  LICENSE_TIERS,
  licenseClaimsSchema,
  licenseTierSchema,
  type LicenseClaims,
  type LicenseTier,
} from "./claims.ts";
export { verifyLicense, type VerifiedLicense } from "./verify.ts";
