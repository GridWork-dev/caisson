// @caisson/license-issue — mint a tessera-format license token (ADR-0110, implements ADR-0010). The
// single correctness invariant: the issuer signs EXACTLY `canonicalize(parse(claims))` — the same
// kernel-canonical bytes `@caisson/license-verify` `verify.ts` re-derives and asserts byte-for-byte
// (`canonicalize(claims) === decoded.payload`). A one-byte divergence would make the verifier reject
// the signature as non-canonical and silently downgrade every license to community, so we (1) strict
// -parse the claims through the SHARED `licenseClaimsSchema` (reuse, never re-declare — the signer and
// verifier MUST agree on the shape) and (2) canonicalize the PARSED object, then sign that. The wire
// PREFIX/TIER are cosmetic (the verifier ignores them); only the signed payload carries authority.
import { type JsonValue, ValidationError, canonicalize } from "@caisson/kernel";
import {
  type LicenseClaims,
  encodeToken,
  licenseClaimsSchema,
} from "@caisson/license-verify";
import type { Signer } from "./signer.ts";

/** The cosmetic brand prefix on the wire frame (informational; the verifier never trusts it). */
export const WIRE_PREFIX = "CAISSON";

const ED25519_SIGNATURE_BYTES = 64;

/**
 * Issue a signed license token from a {@link Signer} + claims. The claims are strict-parsed through the
 * shared `licenseClaimsSchema` (an unknown/extra field or an unknown tier fails closed HERE, before any
 * key touches them — the issuer never signs a shape the verifier would reject). The signed bytes are
 * `canonicalize(parsedClaims)`; the detached 64-byte Ed25519 signature is verified for length, then the
 * codec frames `PREFIX-TIER-base64url(payload ∥ signature)`. The cosmetic wire TIER is the SIGNED tier
 * uppercased (purely informational). Returns the wire string `@caisson/license-verify` verifies offline.
 */
export async function issueLicense(
  signer: Signer,
  claims: unknown,
): Promise<string> {
  const parsed: LicenseClaims = licenseClaimsSchema.parse(claims);
  // Sign EXACTLY what the verifier re-derives: canonicalize the PARSED object (key-order independent).
  const payload = canonicalize(parsed as unknown as JsonValue);
  const signature = await signer.sign(new TextEncoder().encode(payload));
  if (signature.length !== ED25519_SIGNATURE_BYTES) {
    throw new ValidationError(
      `issued signature must be ${String(ED25519_SIGNATURE_BYTES)} bytes, got ${String(signature.length)}`,
    );
  }
  return encodeToken({
    prefix: WIRE_PREFIX,
    tier: parsed.tier.toUpperCase(),
    payload,
    signature: Buffer.from(signature),
  });
}
