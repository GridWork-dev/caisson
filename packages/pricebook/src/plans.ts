// The commerce plan-book (ADR-0089): which subscription price grants how many credits per cycle.
// Distinct from @caisson/ai-meter's per-ai-call COST book — this is the COMMERCE grant table. Keyed by
// Stripe price id (`invoice.lines[0].price.id`); the cycle->grant mapper in services/license reads it
// on a gated `invoice.paid`. Append-only + versioned (PRICEBOOK_VERSION): a price change BUMPS the
// stamp, never edits a row in place (ADR-0006/0012 grandfathering — a buyer pins the version bought on).
// Fail-closed: an unknown price id THROWS (never a guessed grant, ADR-0089 §6).
//
// The credit NUMBERS are operator-owned + deferred (SD-6/ADR-0012). The rows below are clearly-marked
// PLACEHOLDERS (fake `price_…PLACEHOLDER` keys + round, NON-FINAL credit amounts) pinned only so
// resolvePlan + the golden have data; the operator replaces them with real Stripe price ids + the final
// locked amounts when checkout goes live — the same pre-launch-placeholder posture @caisson/cli and
// @caisson/migrate use for `priceCents`. resolvePlan throws on any real Stripe id until then.
import { z } from "zod";
import { ConfigError, parseStrict, strictObject } from "@caisson/kernel";

/** Append-only version stamp — a plan-row change bumps this, never edits it in place (ADR-0006). */
export const PRICEBOOK_VERSION = "2026-06-29.2";

/** Billing cadence; an annual invoice grants the annual allotment once (ADR-0095). */
export const planCadenceSchema = z.enum(["month", "year"]);
export type PlanCadence = z.infer<typeof planCadenceSchema>;

/**
 * The PURCHASED IDS a plan grants entitlement to (ADR-0071): edition names (`compliance`), the bundle
 * sentinel (`bundle`), or à-la-carte module ids (`@caisson/<slug>`) — NEVER the expanded member-slug
 * leaf set. Commerce carries WHAT WAS BOUGHT; the registry index does the expansion at gate time
 * (`expandEntitlements`), so a module added to an edition reaches existing buyers with no plan edit
 * (ADR-0071 binding). A credits-only plan (no edition) carries `[]`. Bounded like the resolver's input.
 */
export const planEntitlementsSchema = z.array(
  z.string().trim().min(1).max(128),
);

export const planBookEntrySchema = strictObject({
  /** Stable internal plan tag (NOT the Stripe id) — survives a price-id rotation. */
  planTag: z.string().min(1),
  /** EXACT integer credits granted each cycle — never derived from the charged amount (ADR-0089 §5). */
  creditsPerCycle: z.number().int().positive(),
  cadence: planCadenceSchema,
  /** Purchased ids this plan entitles the buyer to (editions/bundle/modules) — `[]` for credits-only. */
  entitlements: planEntitlementsSchema,
});
export type PlanBookEntry = z.infer<typeof planBookEntrySchema>;

/**
 * `stripePriceId -> PlanBookEntry`. PLACEHOLDER rows — the live mapping lands when the operator creates
 * the Stripe products and locks the final numbers (SD-6/ADR-0012). Until then resolvePlan throws on any
 * real price id (fail-closed): a plan launched without a row grants NOTHING (ADR-0089 §6).
 */
export const PLAN_BOOK: Record<string, PlanBookEntry> = {
  price_developer_monthly_PLACEHOLDER: {
    planTag: "developer",
    creditsPerCycle: 1000,
    cadence: "month",
    entitlements: [], // a credits-only dev plan — grants credits, no edition access
  },
  price_compliance_updates_annual_PLACEHOLDER: {
    planTag: "compliance_updates",
    creditsPerCycle: 12000,
    cadence: "year",
    entitlements: ["compliance"], // the compliance edition (expanded to member slugs by the index)
  },
};

/** Validate a plan-book override at a boundary (Zod `.strict()` per row). */
export function parsePlanBook(input: unknown): Record<string, PlanBookEntry> {
  return parseStrict(z.record(z.string(), planBookEntrySchema), input);
}

/** Resolve a Stripe price id to its plan entry, fail-closed: an unknown id THROWS (ADR-0089 §6). */
export function resolvePlan(
  priceId: string,
  book: Record<string, PlanBookEntry> = PLAN_BOOK,
): PlanBookEntry {
  // Own-property check: a plain object resolves inherited keys (`__proto__`, `constructor`, …) to
  // truthy prototype members, which would bypass this fail-closed throw (ADR-0089 §6).
  const entry = Object.hasOwn(book, priceId) ? book[priceId] : undefined;
  if (entry === undefined) {
    throw new ConfigError(`no plan-book entry for price id ${priceId}`);
  }
  return entry;
}
