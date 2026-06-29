// The live entitlement resolver for the registry Worker (ADR-0010/0047/0071). Reads the caller's
// license from the `Authorization: Bearer <token>` header, verifies it OFFLINE against the baked-in
// Ed25519 public key (@caisson/license-verify — fail-safe-to-community, NEVER throws), and returns the
// SIGNED purchased ids (claims.entitlements: editions/bundle/modules) for createIndexHandler to expand
// + filter. No token / malformed / forged / expired → `null` (community → base-only view). Runs at the
// edge under `nodejs_compat` — workerd implements node:crypto sign/verify (since 2025-02), so the same
// verifier the local-ai/agent-dev installs use runs unmodified on the Worker; no WebCrypto fork.
import { verifyLicense } from "@caisson/license-verify";

// `PREFIX-TIER-base64url(...)` carried after the Bearer scheme. Case-insensitive scheme, one token.
const BEARER_RE = /^Bearer\s+(\S+)$/i;

/**
 * Resolve a request's purchased-id entitlements from its license header. Returns the signed
 * entitlements for a valid, in-date license; `null` for an absent/invalid one (the handler then serves
 * the free base only). The cosmetic wire TIER is never trusted — `verifyLicense` consults the SIGNED
 * claims alone (ADR-0010).
 */
export function licenseEntitlementResolver(
  request: Request,
): readonly string[] | null {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  const match = BEARER_RE.exec(header.trim());
  const token = match?.[1];
  if (token === undefined) return null;
  const verified = verifyLicense(token);
  return verified.valid ? verified.entitlements : null;
}
