// @caisson/license-verify — offline Ed25519 license verification (ADR-0010/0024). Verifies a
// signed license token entirely OFFLINE (zero network) against a BAKED-IN public key using
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
 * The baked-in Ed25519 verification public key (SPKI DER, base64) — the PRODUCTION issuer key
 * (fingerprint `0ae7d2abb886ca3d`, provisioned ADR-0107 / `infra/license-issuer/ISSUER_PUBLIC_KEY.md`).
 * The matching private signing key is `CAISSON_LICENSE_SIGNING_KEY`, held ONLY by the issuer service
 * (`@caisson/license-issue`); it never ships in any tarball and is never committed. Rotating this key
 * is a deliberate release-time change. Tests do NOT sign with this key (no private half lives in the
 * repo) — they exercise the verify logic against a dev keypair via {@link verifyLicenseWithKey} and
 * prove the bake negatively (a dev-signed token is rejected by the default entrypoint). NO
 * prod-signed token is ever committed: a real entitlement token is itself the leak — the token IS
 * the entitlement, and offline verify has no revocation list — regardless of private-key secrecy.
 */
const LICENSE_PUBLIC_KEY_SPKI_B64 =
  "MCowBQYDK2VwAyEAYUM+v6AQcPjNRoRJyQpDSA7S/LwNu1CecWQZ7A1OJU0=";

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
 * Verify a license token offline against the SHIPPED, baked-in production public key. `token` may be
 * the raw wire string, or `null` / `undefined` / empty for an unlicensed install. `now` is injectable
 * for deterministic expiry tests (defaults to the wall clock). Returns a {@link VerifiedLicense};
 * NEVER throws — every error path is community. This is the public contract every consumer (the
 * kernel license gate, the registry Worker) calls; the baked key is the sole authority.
 */
export function verifyLicense(
  token: string | null | undefined,
  now: Date = new Date(),
): VerifiedLicense {
  return verifyLicenseWithKey(token, licensePublicKey, now);
}

/**
 * The verify core, parameterized over the Ed25519 public key. {@link verifyLicense} is the production
 * entrypoint and pins `publicKey` to the baked key — that is the offline contract. This explicit-key
 * form exists for (1) tests, which sign with a dev keypair because the production private half never
 * lives in the repo, and (2) advanced self-hosting where a buyer runs their own issuer key. It IS
 * exported for those uses, but it is NOT the gate-trusted entrypoint — that is {@link verifyLicense}
 * pinned to the baked key. Callers that reach for this explicit-key form accept responsibility for the
 * key they pass. Same fail-safe-to-community contract — NEVER throws.
 */
export function verifyLicenseWithKey(
  token: string | null | undefined,
  publicKey: KeyObject,
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
    if (!cryptoVerify(null, signedBytes, publicKey, decoded.signature)) {
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
