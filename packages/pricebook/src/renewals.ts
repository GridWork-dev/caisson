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
export const RENEWAL_BOOK_VERSION = "2026-07-06.2";

export const renewalBookEntrySchema = strictObject({
  /** The purchased id (edition/bundle/module slug) whose updates window this price renews. */
  renewsEntitlement: z.string().trim().min(1).max(128),
});
export type RenewalBookEntry = z.infer<typeof renewalBookEntrySchema>;

/**
 * `providerPriceId -> RenewalBookEntry`. One renewal SKU per renewable edition/module (the same
 * catalog PURCHASE_BOOK sells one-time), plus the bundle. Live SANDBOX price ids; resolveRenewal
 * throws on any id not in the book (fail-closed: a renewal SKU launched without a row extends
 * NOTHING and the webhook 500s for a retry).
 */
export const RENEWAL_BOOK: Record<string, RenewalBookEntry> = {
  // Editions + bundle (the ADR-0246 catalog).
  pri_01kwvz6kzh4h43aec3r5rs5je4: { renewsEntitlement: "compliance" },
  pri_01kwvz6m46s5tj4k2a09kcaf9s: { renewsEntitlement: "ai-kit" },
  pri_01kwvz6m791c1xb4wxbedzf9nt: { renewsEntitlement: "local-ai" },
  pri_01kwvz6m9tr49rstw0x7s8nk5h: { renewsEntitlement: "agent-dev" },
  pri_01kwvz6mcfzgjemqa72czdfkmq: { renewsEntitlement: "bundle" },
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
