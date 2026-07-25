// The updates-RENEWAL book (ADR-0244/0251): which one-time Paddle price EXTENDS an existing
// entitlement's 12-month updates window by another 12 months. Paddle-side this is ONE "Updates
// Renewal" product carrying per-SKU prices (ADR-0251 Decision 4); code-side each price id maps to
// exactly the entitlement it renews. A renewal grants ZERO credits and ZERO entitlements — the
// fulfillment mapper (services/license apply-billing-event.ts) routes a renewal line to
// `extendUpdatesWindow`, never to `grantEntitlements` (fail-closed there when no active grant
// exists to extend). Append-only + versioned like the sibling books (ADR-0006); fail-closed: an
// unknown price id THROWS. A price id lives in EXACTLY ONE of PURCHASE_BOOK / PLAN_BOOK /
// RENEWAL_BOOK (renewals.test.ts pins the pairwise disjointness).
//
// SANDBOX ids (product pro_01kwvz6ktwkcj90gmtfrft8btr, created 2026-07-06): one "Updates Renewal"
// product carrying 16 one-time prices at placeholder cents. Production ids swap in at the checkout
// flip. Cents live in Paddle (and the site display SOT), NEVER here — Kickoff D owns every number.
import { z } from "zod";
import { ConfigError, parseStrict, strictObject } from "@caisson/kernel";

/** Append-only version stamp — a renewal-row change bumps this, never edits it in place (ADR-0006). */
export const RENEWAL_BOOK_VERSION = "2026-07-19.1";

export const renewalBookEntrySchema = strictObject({
  /** The purchased id (edition/bundle/module slug) whose updates window this price renews. */
  renewsEntitlement: z.string().trim().min(1).max(128),
  /** Multi-year renewal lever (R6 rider, mechanism only — Kickoff D-track): how many years of
   *  updates-window ONE purchase of this SKU grants (12 * years months, `extendUpdatesWindow`).
   *  OPTIONAL and left unset on every 1-year row (append-only, ADR-0006 — no existing row needs
   *  editing); `renewalYears()` below reads the 1-year default for an unset row. Capped at 3 —
   *  the backlog names "2 or 3 years"; raise the bound in the same commit that needs a longer tenor.
   */
  years: z.number().int().min(1).max(3).optional(),
});
export type RenewalBookEntry = z.infer<typeof renewalBookEntrySchema>;

/** Resolve a renewal row's tenor in years, defaulting an unset field to 1 — the single place
 *  every consumer (the fulfillment mapper, a future display surface) reads the lever from, so the
 *  "1 default" behavior can't drift between call sites. */
export function renewalYears(entry: RenewalBookEntry): number {
  return entry.years ?? 1;
}

// TODO(CAISSON-128 arming): the operator must add Paddle multi-year prices, add matching
// RENEWAL_BOOK rows with `years: 2` or `years: 3`, decide and add `discountBps`, and wire the
// `multiYearRenewalAmount` display. None of those product/price changes are armed by this pre-work.

/**
 * `providerPriceId -> RenewalBookEntry`. One renewal SKU per renewable edition/module (the same
 * catalog PURCHASE_BOOK sells one-time), plus the bundle. Live SANDBOX price ids; resolveRenewal
 * throws on any id not in the book (fail-closed: a renewal SKU launched without a row extends
 * NOTHING and the webhook 500s for a retry).
 */
export const RENEWAL_BOOK: Record<string, RenewalBookEntry> = {
  // The five original bundle rows (the ADR-0246 catalog). ADR-0270 (edition-trace purge) REPOINTED the
  // four archived-edition + bundle-sentinel rows from the dissolved edition ids to canonical bundle ids —
  // so every row now stores the canonical id directly and resolveRenewal no longer normalizes.
  pri_01kwvz6kzh4h43aec3r5rs5je4: { renewsEntitlement: "compliance" },
  pri_01kwvz6m46s5tj4k2a09kcaf9s: { renewsEntitlement: "ai-production" },
  pri_01kwvz6m791c1xb4wxbedzf9nt: { renewsEntitlement: "local-first" },
  pri_01kwvz6m9tr49rstw0x7s8nk5h: { renewsEntitlement: "agentic-dev" },
  pri_01kwvz6mcfzgjemqa72czdfkmq: { renewsEntitlement: "everything" },
  // The 11 à-la-carte modules (bare package slugs — the PURCHASE_BOOK entitlement-id convention).
  pri_01kwvz6mf22rqfrx6reh4b88sm: { renewsEntitlement: "field-crypto" },
  pri_01kwvz6mhkreqepryq96s2wk7n: { renewsEntitlement: "audit-worm" },
  pri_01kwvz6mm4wnr6b65m2fbq46h5: { renewsEntitlement: "ai-meter" },
  pri_01kwvz6mppg1y7prs0vqjpha8k: { renewsEntitlement: "ai-evals" },
  pri_01kwvz6msc5c7ehctejscxebkx: { renewsEntitlement: "guardrails" },
  pri_01kwvz6mwtsfbmeq39s524na24: { renewsEntitlement: "prompt-registry" },
  pri_01kwvz6mzmdxkkp180bd36t6xj: { renewsEntitlement: "local-store" },
  pri_01kwvz6n3jyt5fhgt0hgdgcvv7: { renewsEntitlement: "agent-kernel" },
  pri_01kwvz6n738kz8n9aygb26jc6j: { renewsEntitlement: "agent-runner" },
  pri_01kwvz6na9hp9gg1b0709exekp: { renewsEntitlement: "alerting" },
  pri_01kwvz6nd2yv34z083cpxamkqy: { renewsEntitlement: "retention-runner" },
  // The W7 catalog big-bang additions (ADR-0258 §5, created 2026-07-06): the Provenance bundle +
  // the eleven carve/new module SKUs. The five original bundle rows above (repointed to canonical
  // ids by ADR-0270) cover the other five bundles directly; their placeholder cents were trued
  // Paddle-side in the same sweep. Cents per ADR-0260 §5 / ADR-0258 §4 live in Paddle only, never here.
  pri_01kwwqa4k2z4wx3b53nacbpd7w: { renewsEntitlement: "provenance" },
  pri_01kwwqa4n21y7ah006yb9q07r1: { renewsEntitlement: "compliance-core" },
  pri_01kwwqa4qc77j5f1pn61811ent: { renewsEntitlement: "frameworks-pack" },
  pri_01kwwqa4sfhdbp2rn09s1kpsae: { renewsEntitlement: "signing-primitive" },
  pri_01kwwqa4vaa99c75mbydysxc2d: { renewsEntitlement: "credits" },
  pri_01kwwqa4xgef5bzfws498q31y0: { renewsEntitlement: "local-sync" },
  pri_01kwwqa4zkwdfbxsefe7kveex2: { renewsEntitlement: "local-inference" },
  pri_01kwwqa51khjcn3y79m7dwhm3z: { renewsEntitlement: "local-privacy" },
  pri_01kwwqa5434re4xvzpd0y77s35: { renewsEntitlement: "tool-exec" },
  pri_01kwwqa5634seyq4v05hmft4ws: { renewsEntitlement: "org-controls" },
  pri_01kwwqa58355kq4t05rtk5v8qf: {
    renewsEntitlement: "billing-orchestration",
  },
  pri_01kwwqa5a8z41s64x1fnfzqanj: { renewsEntitlement: "ui-pro" },
  // agent-trajectory joined the catalog 2026-07-18 (agent-runtime wave) — sandbox renewal
  // price created via tools/paddle-catalog-recreate.ts (its own marker-carrying "Updates
  // Renewal" parent; the earlier hand-built parent keeps the pre-existing rows above).
  pri_01kxvpjp4hga6v33nbx6nn0yw1: { renewsEntitlement: "agent-trajectory" },
  // The compliance-gap trio joined the catalog 2026-07-20 (SKU-arming wave) — sandbox
  // renewal prices created via tools/paddle-catalog-recreate.ts.
  pri_01ky0fgqtdyankb7fh999ak7xc: { renewsEntitlement: "access-review" },
  pri_01ky0fgqw89n4wrjysw4sgcray: { renewsEntitlement: "risk-register" },
  pri_01ky0fgqy145zagcq0n3btxr5k: { renewsEntitlement: "trust-page" },
};

/** Validate a renewal-book override at a boundary (Zod `.strict()` per row). */
export function parseRenewalBook(
  input: unknown,
): Record<string, RenewalBookEntry> {
  return parseStrict(z.record(z.string(), renewalBookEntrySchema), input);
}

/**
 * Whether a provider price id is a renewal SKU — the fulfillment mapper's branch predicate
 * (renewal line → extend window; anything else → the ordinary purchase path). Own-property check
 * so an inherited key (`__proto__`, …) never reads as a renewal.
 */
export function isRenewalPrice(
  priceId: string,
  book: Record<string, RenewalBookEntry> = RENEWAL_BOOK,
): boolean {
  return Object.hasOwn(book, priceId);
}

/**
 * Resolve a provider price id to its renewal entry, fail-closed: an unknown id THROWS
 * (ADR-0089 §6 posture — never a guessed extension).
 *
 * Every row stores a CANONICAL id (ADR-0270 repointed the four archived-edition + bundle-sentinel rows,
 * so no renewal row is keyed to a dissolved edition id anymore). The resolve-time bundle-alias normalization
 * is therefore a no-op and was DROPPED (ADR-0270). The read-side alias fold for a FUTURE module rename lives
 * where a stored grant id is consumed — `extendUpdatesWindow`'s `entitlementIdAliasGroup` — not here, since
 * this reads config rows, not grant state.
 */
export function resolveRenewal(
  priceId: string,
  book: Record<string, RenewalBookEntry> = RENEWAL_BOOK,
): RenewalBookEntry {
  const entry = Object.hasOwn(book, priceId) ? book[priceId] : undefined;
  if (entry === undefined) {
    throw new ConfigError(`no renewal-book entry for price id ${priceId}`);
  }
  return entry;
}
