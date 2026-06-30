// The one-time (non-subscription) PURCHASE book (ADR-0113, provider rename ADR-0108). The subscription
// PLAN_BOOK (plans.ts) answers "which recurring price grants how many credits per cycle"; this answers
// the same for a ONE-TIME checkout: which provider price id (`providerPriceId`) grants which
// entitlement ids + how many credits, ONCE. A one-time module/edition purchase grants the SAME
// purchased ids a subscription would (ADR-0071 — the registry index expands them to member slugs at
// the gate), so `entitlements` carries purchased ids, never the expanded leaf set. `credits` is the
// one-off allotment (0 for a license-only purchase that grants access but no credit pack). Append-only
// + versioned like the plan-book (ADR-0006); fail-closed: an unknown price id THROWS (never a guessed
// grant, ADR-0089 §6 / ADR-0113).
//
// PLACEHOLDER rows (fake `price_…PLACEHOLDER` keys + round, NON-FINAL amounts) — the operator replaces
// them with real Paddle price ids + the final locked numbers (ADR-0106/0012) when checkout goes live;
// resolvePurchase throws on any real provider id until then.
import { z } from "zod";
import { ConfigError, parseStrict, strictObject } from "@caisson/kernel";
import { planEntitlementsSchema } from "./plans.ts";

/** Append-only version stamp — a purchase-row change bumps this, never edits it in place (ADR-0006). */
export const PURCHASE_BOOK_VERSION = "2026-06-30.2";

export const purchaseBookEntrySchema = strictObject({
  /** Stable internal purchase tag (NOT the Stripe id) — survives a price-id rotation. */
  purchaseTag: z.string().min(1),
  /** EXACT integer credits granted once on purchase — 0 for a license-only (no credit pack) buy. */
  credits: z.number().int().nonnegative(),
  /** Purchased ids this one-time buy entitles the buyer to (editions/bundle/modules) — `[]` for a credits-only pack. */
  entitlements: planEntitlementsSchema,
});
export type PurchaseBookEntry = z.infer<typeof purchaseBookEntrySchema>;

/**
 * `providerPriceId -> PurchaseBookEntry`. PLACEHOLDER rows — the live mapping lands when the operator
 * creates the Paddle one-time products and locks the final numbers (ADR-0106/0012). Until then
 * resolvePurchase throws on any real price id (fail-closed): a product launched without a row grants
 * NOTHING (ADR-0089 §6 / ADR-0113).
 */
export const PURCHASE_BOOK: Record<string, PurchaseBookEntry> = {
  price_credit_pack_PLACEHOLDER: {
    purchaseTag: "credit_pack",
    credits: 5000,
    entitlements: [], // a one-off credit pack — grants credits, no edition access
  },
  price_compliance_onetime_PLACEHOLDER: {
    purchaseTag: "compliance_onetime",
    credits: 0, // a perpetual license-only buy — grants access, no credit pack
    entitlements: ["compliance"], // the compliance edition (expanded to member slugs by the index)
  },
  // ---- REAL Paddle sandbox price ids (ADR-0106/0116 go-live wiring) ----
  // The PLACEHOLDER rows above are kept in place (existing test-suite fixtures); these are the
  // LIVE rows the Paddle checkout + webhook actually resolve against. Every row is a perpetual
  // license-only buy — `credits: 0` (no bundled credit pack; carried over from the
  // `compliance_onetime` placeholder's number, SD-6 — operator-deferred, non-final).
  //
  // ENTITLEMENT-ID NOTE: the registry-schema canonical edition slug for the "Agentic-Dev" edition
  // is `agent-dev` (`packages/registry-schema/src/module-manifest.ts` EDITIONS), NOT
  // `agentic-dev` — the marketing label/route slug differ from the entitlement id on purpose.
  // Using "agentic-dev" here would make `expandEntitlements` throw (unknown purchased id,
  // ADR-0071 TM-E) the first time this SKU's webhook event tried to grant. Verified against
  // `resolve-entitlements.ts` before wiring (do not "fix" this back to agentic-dev).
  pri_01kwd76be2eq96kff5nqw236c0: {
    purchaseTag: "compliance",
    credits: 0,
    entitlements: ["compliance"],
  },
  pri_01kwd76bp60acq51mftvpgr42k: {
    purchaseTag: "bundle",
    credits: 0,
    entitlements: ["bundle"], // the BUNDLE_ID sentinel — base ∪ every edition (entitlements.ts)
  },
  pri_01kwd76c1pgs2csxcj2n0y7vv0: {
    purchaseTag: "ai-kit",
    credits: 0,
    entitlements: ["ai-kit"],
  },
  pri_01kwd76cahy825m14334aqf209: {
    purchaseTag: "local-ai",
    credits: 0,
    entitlements: ["local-ai"],
  },
  pri_01kwd76ck3w8myy4p4f1gj0dcy: {
    purchaseTag: "agentic-dev",
    credits: 0,
    entitlements: ["agent-dev"], // see the ENTITLEMENT-ID NOTE above — not "agentic-dev"
  },
};

/** Validate a purchase-book override at a boundary (Zod `.strict()` per row). */
export function parsePurchaseBook(
  input: unknown,
): Record<string, PurchaseBookEntry> {
  return parseStrict(z.record(z.string(), purchaseBookEntrySchema), input);
}

/**
 * Resolve a provider price id to its one-time purchase entry, fail-closed: an unknown id THROWS
 * (ADR-0089 §6 / ADR-0113). Own-property check (Object.hasOwn) so an inherited key (`__proto__`,
 * `constructor`, …) cannot resolve to a truthy prototype member and bypass the fail-closed throw.
 */
export function resolvePurchase(
  priceId: string,
  book: Record<string, PurchaseBookEntry> = PURCHASE_BOOK,
): PurchaseBookEntry {
  const entry = Object.hasOwn(book, priceId) ? book[priceId] : undefined;
  if (entry === undefined) {
    throw new ConfigError(`no purchase-book entry for price id ${priceId}`);
  }
  return entry;
}
