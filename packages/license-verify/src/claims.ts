// @caisson/license-verify — signed license-claims schema (ADR-0010). The Zod `.strict()` shape of
// the SIGNED license payload: the claims an offline verifier may trust ONLY after `crypto.verify` has
// accepted the Ed25519 signature over the kernel-canonical bytes (`verify.ts`). The SIGNED `tier` is
// the sole authority for authorization — the cosmetic wire PREFIX/TIER (`token.ts`) are informational
// and never consulted. Claims carry entitlements[] + tier + expiry, with perpetual-per-major support.
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
 * - `licenseId`    — opaque UUID of the issued license (audit / revocation correlation).
 * - `tier`         — the AUTHORITATIVE entitlement tier (the cosmetic wire TIER is ignored).
 * - `entitlements` — module / edition slugs this license unlocks (e.g. `local-ai`); bounded.
 * - `major`        — the product MAJOR version this perpetual license covers (perpetual-per-major:
 *                    valid forever for this major, never auto-extended to a later major).
 * - `expiry`       — ISO-8601 instant the license lapses, or `null` for a perpetual license.
 * - `updatesWindows` — the per-entitlement ADR-0244 updates windows (ADR-0255, replacing the
 *                    single account-wide scalar ADR-0251 shipped): a map `purchasedEntitlementId →
 *                    ISO instant` bounding which published versions the registry serves for the
 *                    modules that entitlement grants. OPTIONAL + nullable: a token WITHOUT the
 *                    field (pre-window issue) or carrying `null` is UNBOUNDED (the pre-launch
 *                    grandfather clause; post-flip tokens always carry the field). An entitlement
 *                    ABSENT from the map is likewise unbounded — there are never null VALUES in
 *                    the map. Distinct from `expiry`: a lapsed window never invalidates the
 *                    license, it only narrows which versions the registry serves.
 * - `entitledSince` — the per-purchased-id SNAPSHOT-AT-SALE instant (ADR-0257 §1.2 / ADR-0247 F7):
 *                    a map `purchasedEntitlementId → ISO instant` recording when the buyer became
 *                    entitled to that bundle. A bundle MEMBER that joined the bundle AFTER this
 *                    instant is not part of the buyer's snapshot and is filtered out at the
 *                    per-member resolver (`@caisson/registry-schema` `expandEntitlements`). SIBLING
 *                    of `updatesWindows` on a DIFFERENT axis (member-set snapshot here; published
 *                    VERSIONS there, enforced separately in the registry Worker) — same
 *                    absent-key-=-unrestricted posture: a token WITHOUT the field, carrying `null`,
 *                    or missing a key = GRANDFATHERED / full access (never fail-closed against an
 *                    existing token). Never null VALUES in the map. Each consumer reads the ONE
 *                    field it needs — never destructures the whole claims shape — so a new sibling
 *                    key never breaks another reader.
 */
export const licenseClaimsSchema = strictObject({
  licenseId: z.string().uuid(),
  tier: licenseTierSchema,
  entitlements: z.array(z.string().min(1).max(128)).max(256),
  major: z.number().int().nonnegative(),
  expiry: z.string().datetime({ offset: true }).nullable(),
  updatesWindows: z
    .record(
      z.string().trim().min(1).max(128),
      z.string().datetime({ offset: true }),
    )
    .nullable()
    .optional(),
  entitledSince: z
    .record(
      z.string().trim().min(1).max(128),
      z.string().datetime({ offset: true }),
    )
    .nullable()
    .optional(),
});

/** The validated, signed license claims. */
export type LicenseClaims = z.infer<typeof licenseClaimsSchema>;
