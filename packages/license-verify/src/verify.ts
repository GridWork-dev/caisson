// @caisson/license-verify — offline Ed25519 license verification (T7, ADR-0010/0024). Verifies a
// tessera-format license token entirely OFFLINE (zero network) against a BAKED-IN public key using
// `crypto.verify` — NOT `timingSafeEqual`: asymmetric signature verification is its own discipline
// (kernel `crypto.ts:1-3`), not a secret comparison.
//
// FAIL-SAFE-TO-COMMUNITY is the contract — this function NEVER raises. A null / absent token, a
// malformed wire string, a signature that does not verify, claims that do not strict-parse, a
// non-canonical signed payload, or an elapsed expiry ALL resolve to the free community tier: an
// unlicensed install keeps running and a forged / replayed token never escalates (threat TM-LIC).
// The SIGNED `tier` is the sole authority; the cosmetic wire PREFIX/TIER are ignored.
import { type JsonValue, canonicalize } from "@caisson/kernel";
import {
  type KeyObject,
  createPublicKey,
  verify as cryptoVerify,
} from "node:crypto";
import {
  COMMUNITY_TIER,
  type LicenseClaims,
  type LicenseTier,
  licenseClaimsSchema,
} from "./claims.ts";
import { decodeToken } from "./token.ts";

/**
 * The baked-in Ed25519 verification public key (SPKI DER, base64). The matching private signing key
 * lives ONLY with the P6 issuer and never ships in any tarball. Rotating it is a deliberate
 * release-time change. This is the deterministic KAT key (SHA-256("caisson-license-verify-KAT-seed-v1")
 * seed → Ed25519) — a TEST vector, not a production secret; see `token.test.ts` header.
 */
const LICENSE_PUBLIC_KEY_SPKI_B64 =
  "MCowBQYDK2VwAyEAbQaycFQ6zDCiACKFQ83ucxYtdL++cvlUXf4dqRwvQgs=";

/** Imported once at module load — a fixed, baked key, never reconstructed per call. */
const licensePublicKey: KeyObject = createPublicKey({
  key: Buffer.from(LICENSE_PUBLIC_KEY_SPKI_B64, "base64"),
  format: "der",
  type: "spki",
});

/** The outcome of an offline verify — always a resolved tier; the verifier never throws. */
export interface VerifiedLicense {
  /** Whether a valid, in-date, authentically-signed license was presented. */
  readonly valid: boolean;
  /** The AUTHORITATIVE tier — the signed tier when valid, else `community`. */
  readonly tier: LicenseTier;
  /** Unlocked module / edition slugs — the signed entitlements when valid, else empty. */
  readonly entitlements: readonly string[];
  /** The full signed claims when valid; `null` on every fail-safe path. */
  readonly claims: LicenseClaims | null;
}

/** The free fall-back every failure resolves to — no entitlements, no claims. */
const COMMUNITY: VerifiedLicense = {
  valid: false,
  tier: COMMUNITY_TIER,
  entitlements: [],
  claims: null,
};

/**
 * Verify a license token offline. `token` may be the raw wire string, or `null` / `undefined` /
 * empty for an unlicensed install. `now` is injectable for deterministic expiry tests (defaults to
 * the wall clock). Returns a {@link VerifiedLicense}; NEVER throws — every error path is community.
 */
export function verifyLicense(
  token: string | null | undefined,
  now: Date = new Date(),
): VerifiedLicense {
  if (token === null || token === undefined || token === "") {
    return COMMUNITY;
  }
  try {
    const decoded = decodeToken(token);
    const signedBytes = Buffer.from(decoded.payload, "utf8");

    // Asymmetric verify over the EXACT signed bytes (Ed25519: algorithm = null). `crypto.verify`,
    // not `timingSafeEqual` — a signature check is not a secret comparison (ADR-0010).
    if (!cryptoVerify(null, signedBytes, licensePublicKey, decoded.signature)) {
      return COMMUNITY;
    }

    const parsed = licenseClaimsSchema.safeParse(
      JSON.parse(decoded.payload) as unknown,
    );
    if (!parsed.success) {
      return COMMUNITY;
    }
    const claims = parsed.data;

    // Format conformance: the signed bytes MUST be the kernel-canonical serialization of the
    // claims. Reject any non-canonical payload — the issuer always signs canonical bytes, so a
    // mismatch is a malformed / crafted token even when the signature is authentic.
    if (canonicalize(claims as JsonValue) !== decoded.payload) {
      return COMMUNITY;
    }

    // Perpetual-per-major: `expiry === null` never lapses. Otherwise an unparseable or elapsed
    // instant fails safe to community (fail-closed).
    if (claims.expiry !== null) {
      const expiresAt = Date.parse(claims.expiry);
      if (Number.isNaN(expiresAt) || expiresAt <= now.getTime()) {
        return COMMUNITY;
      }
    }

    return {
      valid: true,
      tier: claims.tier,
      entitlements: claims.entitlements,
      claims,
    };
  } catch {
    // Any unexpected throw (JSON parse, codec edge, crypto) → community. The verifier never raises.
    return COMMUNITY;
  }
}
