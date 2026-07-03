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

const NO_REVOCATIONS: ReadonlySet<string> = new Set<string>();

/**
 * Build a request → purchased-ids resolver with an operator revocation check (ADR-0225 R-4=B).
 * `getDenied` returns the current edge deny-set keyed on the SIGNED `claims.licenseId`; a verified but
 * REVOKED license is treated exactly like an absent/forged token → `null` (community, base-only view).
 * `getDenied` MUST be total (its backing cache is fail-open — an unavailable deny-set returns an empty
 * set, so installs never break); this function never fetches, so it stays a pure sync resolver.
 */
export function makeLicenseEntitlementResolver(
  getDenied: () => ReadonlySet<string>,
): (request: Request) => readonly string[] | null {
  return (request: Request): readonly string[] | null => {
    const header = request.headers.get("authorization");
    if (header === null) return null;
    const match = BEARER_RE.exec(header.trim());
    const token = match?.[1];
    if (token === undefined) return null;
    const verified = verifyLicense(token);
    if (!verified.valid || verified.claims === null) return null;
    // Edge revocation gate: an operator-revoked license id → community. Fail-open lives in getDenied's
    // cache (revocation-list.ts), so a deny-set outage denies nobody rather than blocking every buyer.
    if (getDenied().has(verified.claims.licenseId)) return null;
    return verified.entitlements;
  };
}

/**
 * Resolve a request's purchased-id entitlements from its license header. Returns the signed
 * entitlements for a valid, in-date license; `null` for an absent/invalid one (the handler then serves
 * the free base only). The cosmetic wire TIER is never trusted — `verifyLicense` consults the SIGNED
 * claims alone (ADR-0010). Back-compat export: the un-denylisted resolver (revocation check disabled);
 * the live edge uses `makeLicenseEntitlementResolver` wired to the deny-set (deploy-entry.ts).
 */
export const licenseEntitlementResolver = makeLicenseEntitlementResolver(
  () => NO_REVOCATIONS,
);
