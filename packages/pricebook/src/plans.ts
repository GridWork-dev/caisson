// The commerce plan-book (ADR-0089, provider rename ADR-0108): which subscription price grants how
// many credits per cycle. Distinct from @caisson/ai-meter's per-ai-call COST book — this is the
// COMMERCE grant table. Keyed by the provider's price id (`providerPriceId` — Paddle's
// `items[0].price.id` on a subscription-linked `transaction.completed`, formerly Stripe's
// `invoice.lines[0].price.id`); the cycle->grant mapper in services/license reads it on a gated
// invoice/cycle event. Append-only + versioned (PRICEBOOK_VERSION): a price change BUMPS the stamp,
// never edits a row in place (ADR-0006/0012 grandfathering — a buyer pins the version bought on).
// Fail-closed: an unknown price id THROWS (never a guessed grant, ADR-0089 §6).
//
// The credit NUMBERS are operator-owned + deferred (SD-6/ADR-0012). The rows below are clearly-marked
// PLACEHOLDERS (fake `price_…PLACEHOLDER` keys + round, NON-FINAL credit amounts) pinned only so
// resolvePlan + the golden have data; the operator replaces them with real Paddle price ids + the final
// locked amounts when checkout goes live — the same pre-launch-placeholder posture @caisson/cli and
// @caisson/migrate use for `priceCents`. resolvePlan throws on any real provider id until then.
import { z } from "zod";
import {
  ConfigError,
  asCredits,
  parseStrict,
  strictObject,
  type Credits,
} from "@caisson/kernel";

/** Append-only version stamp — a plan-row change bumps this, never edits it in place (ADR-0006).
 *  2026-07-06.1: the developer rows gain `coversOwnedEntitlements: true` (ADR-0269). */
export const PRICEBOOK_VERSION = "2026-07-06.1";

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
  /** EXACT integer credits granted each cycle — never derived from the charged amount (ADR-0089 §5).
   *  Branded `Credits` (ADR-0212): the transform mints the brand AFTER validation, same runtime value. */
  creditsPerCycle: z
    .number()
    .int()
    .positive()
    .transform((n) => n as Credits),
  cadence: planCadenceSchema,
  /** Purchased ids this plan entitles the buyer to (editions/bundle/modules) — `[]` for credits-only. */
  entitlements: planEntitlementsSchema,
  /**
   * ADR-0269: while this subscription is active, every entitlement the buyer holds via an ACTIVE
   * `one_time` grant is RE-GRANTED subscription-sourced on each granting invoice (the
   * Compliance-Updates re-grant mirror, made dynamic) — lifting the per-entitlement updates-window
   * and member-snapshot gates (ADR-0255 "subscription-sourced access; own `expiry` governs") on
   * what the buyer ALREADY OWNS. Never a grant of new ids. Default false = plain credits/static
   * entitlements behavior, unchanged.
   */
  coversOwnedEntitlements: z.boolean().default(false),
});
export type PlanBookEntry = z.infer<typeof planBookEntrySchema>;

/**
 * `providerPriceId -> PlanBookEntry`. PLACEHOLDER rows — the live mapping lands when the operator
 * creates the Paddle products and locks the final numbers (SD-6/ADR-0012). Until then resolvePlan
 * throws on any real price id (fail-closed): a plan launched without a row grants NOTHING (ADR-0089 §6).
 */
export const PLAN_BOOK: Record<string, PlanBookEntry> = {
  price_developer_monthly_PLACEHOLDER: {
    planTag: "developer",
    creditsPerCycle: asCredits(1000),
    cadence: "month",
    entitlements: [], // no NEW ids ever granted (ADR-0269 Decision 3)
    // ADR-0269: the plan covers the buyer's OWNED entitlements while active — updates + new
    // members reach them subscription-sourced; copy: "updates as they ship".
    coversOwnedEntitlements: true,
  },
  price_compliance_updates_annual_PLACEHOLDER: {
    planTag: "compliance_updates",
    creditsPerCycle: asCredits(12000),
    cadence: "year",
    entitlements: ["compliance"], // the compliance edition (expanded to member slugs by the index)
  },
  // ---- REAL Paddle sandbox price ids (ADR-0106/0116 go-live wiring) ----
  // The PLACEHOLDER rows above are kept in place (existing test-suite fixtures, ADR-0089's bound
  // test list); these are the LIVE rows the Paddle checkout + webhook actually resolve against.
  // ADR-0106 moved both subscriptions to an ANNUAL cadence (was monthly here) — `creditsPerCycle`
  // is the SAME operator-owned placeholder number carried over unchanged (SD-6: credit AMOUNTS
  // are still not final; only the price id + cadence are live).
  pri_01kwd76d64rz2ecm090pt4nq5q: {
    planTag: "developer",
    creditsPerCycle: asCredits(1000), // carried over from the monthly placeholder — NOT a rescale (SD-6)
    cadence: "year", // ADR-0106: Developer plan is $499/yr
    entitlements: [], // no NEW ids ever granted (ADR-0269 Decision 3)
    coversOwnedEntitlements: true, // ADR-0269: covers OWNED entitlements while active
  },
  pri_01kwd76cwytyyy4yhd9ch0m935: {
    planTag: "compliance_updates",
    creditsPerCycle: asCredits(12000), // carried over unchanged (SD-6)
    cadence: "year", // ADR-0106: Compliance Updates is $1,499/yr
    entitlements: ["compliance"],
  },
};

/** Validate a plan-book override at a boundary (Zod `.strict()` per row). */
export function parsePlanBook(input: unknown): Record<string, PlanBookEntry> {
  return parseStrict(z.record(z.string(), planBookEntrySchema), input);
}

/** Resolve a provider price id to its plan entry, fail-closed: an unknown id THROWS (ADR-0089 §6). */
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
