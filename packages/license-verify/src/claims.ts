// @caisson/license-verify — signed license-claims schema (T7, ADR-0010). The Zod `.strict()` shape of
// the SIGNED license payload: the claims an offline verifier may trust ONLY after `crypto.verify` has
// accepted the Ed25519 signature over the kernel-canonical bytes (`verify.ts`). The SIGNED `tier` is
// the sole authority for authorization — the cosmetic wire PREFIX/TIER (`token.ts`) are informational
// and never consulted. Claims richer than tessera's (entitlements[] + tier + expiry, perpetual-per-major).
import { strictObject } from "@caisson/kernel";
import { z } from "zod";

/**
 * License tiers, lowest → highest privilege. `community` is the free, always-available tier every
 * unlicensed (or tampered / expired / absent) install resolves to; `pro` unlocks the paid edition.
 * The enum is CLOSED: a token carrying an unknown tier fails strict parsing and the verifier falls
 * safe to community — an unrecognized tier never silently grants more than the free tier.
 */
export const LICENSE_TIERS = ["community", "pro"] as const;

/** Zod enum over {@link LICENSE_TIERS}. */
export const licenseTierSchema = z.enum(LICENSE_TIERS);

/** The authoritative entitlement tier carried in a signed license. */
export type LicenseTier = z.infer<typeof licenseTierSchema>;

/** The free fall-back tier — the fail-safe target for every verify failure (threat TM-LIC). */
export const COMMUNITY_TIER: LicenseTier = "community";

/**
 * The signed license claims. `.strict()` — an extra / unknown key fails closed: signer and verifier
 * must agree byte-for-byte, so an unexpected field signals a format the verifier cannot trust.
 *
 * - `licenseId`    — opaque UUID of the issued license (audit / revocation correlation; P6 issuer).
 * - `tier`         — the AUTHORITATIVE entitlement tier (the cosmetic wire TIER is ignored).
 * - `entitlements` — module / edition slugs this license unlocks (e.g. `local-ai`); bounded.
 * - `major`        — the product MAJOR version this perpetual license covers (perpetual-per-major:
 *                    valid forever for this major, never auto-extended to a later major).
 * - `expiry`       — ISO-8601 instant the license lapses, or `null` for a perpetual license.
 */
export const licenseClaimsSchema = strictObject({
  licenseId: z.string().uuid(),
  tier: licenseTierSchema,
  entitlements: z.array(z.string().min(1).max(128)).max(256),
  major: z.number().int().nonnegative(),
  expiry: z.string().datetime({ offset: true }).nullable(),
});

/** The validated, signed license claims. */
export type LicenseClaims = z.infer<typeof licenseClaimsSchema>;
