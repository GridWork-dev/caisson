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
// PLACEHOLDER rows (`pri_placeholder_renewal_<slug>`): the operator creates the sandbox "Updates
// Renewal" product + prices in the Paddle dashboard and swaps in the real `pri_…` ids. Cents live
// in Paddle (and the site display SOT), NEVER here — Kickoff D owns every number.
import { z } from "zod";
import { ConfigError, parseStrict, strictObject } from "@caisson/kernel";

/** Append-only version stamp — a renewal-row change bumps this, never edits it in place (ADR-0006). */
export const RENEWAL_BOOK_VERSION = "2026-07-06.1";

export const renewalBookEntrySchema = strictObject({
  /** The purchased id (edition/bundle/module slug) whose updates window this price renews. */
  renewsEntitlement: z.string().trim().min(1).max(128),
});
export type RenewalBookEntry = z.infer<typeof renewalBookEntrySchema>;

/**
 * `providerPriceId -> RenewalBookEntry`. One renewal SKU per renewable edition/module (the same
 * catalog PURCHASE_BOOK sells one-time), plus the bundle. All PLACEHOLDER ids until the operator
 * creates the sandbox prices; resolveRenewal throws on any real price id until then (fail-closed:
 * a renewal SKU launched without a row extends NOTHING and the webhook 500s for a retry).
 */
export const RENEWAL_BOOK: Record<string, RenewalBookEntry> = {
  // Editions + bundle (the ADR-0246 catalog).
  pri_placeholder_renewal_compliance: { renewsEntitlement: "compliance" },
  pri_placeholder_renewal_ai_kit: { renewsEntitlement: "ai-kit" },
  pri_placeholder_renewal_local_ai: { renewsEntitlement: "local-ai" },
  pri_placeholder_renewal_agent_dev: { renewsEntitlement: "agent-dev" },
  pri_placeholder_renewal_bundle: { renewsEntitlement: "bundle" },
  // The 11 à-la-carte modules (bare package slugs — the PURCHASE_BOOK entitlement-id convention).
  pri_placeholder_renewal_field_crypto: { renewsEntitlement: "field-crypto" },
  pri_placeholder_renewal_audit_worm: { renewsEntitlement: "audit-worm" },
  pri_placeholder_renewal_ai_meter: { renewsEntitlement: "ai-meter" },
  pri_placeholder_renewal_ai_evals: { renewsEntitlement: "ai-evals" },
  pri_placeholder_renewal_guardrails: { renewsEntitlement: "guardrails" },
  pri_placeholder_renewal_prompt_registry: {
    renewsEntitlement: "prompt-registry",
  },
  pri_placeholder_renewal_local_store: { renewsEntitlement: "local-store" },
  pri_placeholder_renewal_agent_kernel: { renewsEntitlement: "agent-kernel" },
  pri_placeholder_renewal_agent_runner: { renewsEntitlement: "agent-runner" },
  pri_placeholder_renewal_alerting: { renewsEntitlement: "alerting" },
  pri_placeholder_renewal_retention_runner: {
    renewsEntitlement: "retention-runner",
  },
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
