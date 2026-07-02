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
import {
  ConfigError,
  asCredits,
  parseStrict,
  strictObject,
  type Credits,
} from "@caisson/kernel";
import { planEntitlementsSchema } from "./plans.ts";

// Branded zero (ADR-0212) for the many license-only rows below — one mint, not 17 casts.
const NO_CREDITS = asCredits(0);

/** Append-only version stamp — a purchase-row change bumps this, never edits it in place (ADR-0006). */
export const PURCHASE_BOOK_VERSION = "2026-06-30.3";

export const purchaseBookEntrySchema = strictObject({
  /** Stable internal purchase tag (NOT the Stripe id) — survives a price-id rotation. */
  purchaseTag: z.string().min(1),
  /** EXACT integer credits granted once on purchase — 0 for a license-only (no credit pack) buy.
   *  Branded `Credits` (ADR-0212): the transform mints the brand AFTER validation, same runtime value. */
  credits: z
    .number()
    .int()
    .nonnegative()
    .transform((n) => n as Credits),
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
    credits: asCredits(5000),
    entitlements: [], // a one-off credit pack — grants credits, no edition access
  },
  price_compliance_onetime_PLACEHOLDER: {
    purchaseTag: "compliance_onetime",
    credits: NO_CREDITS, // a perpetual license-only buy — grants access, no credit pack
    entitlements: ["compliance"], // the compliance edition (expanded to member slugs by the index)
  },
  // ---- REAL Paddle sandbox price ids (ADR-0106/0116 go-live wiring) ----
  // The PLACEHOLDER rows above are kept in place (existing test-suite fixtures); these are the
  // LIVE rows the Paddle checkout + webhook actually resolve against. Every row is a perpetual
  // license-only buy — `credits: 0` (no bundled credit pack; carried over from the
  // `compliance_onetime` placeholder's number, SD-6 — operator-deferred, non-final).
  //
  // REPRICE — Q4 "full below-sum" operator lock (per-edition price CHANGE): the price a buyer is
  // CHARGED is NOT stored here. This book keys the Paddle price id -> credits + entitlements; the
  // dollar AMOUNT lives on the Paddle product (dashboard/API), and the site DISPLAY amount is owned
  // by `apps/site/lib/pricing.ts` (the single display SOT, integer USD — FE-2's tree). So a reprice
  // is a Paddle-side + site-display change, NOT a pricebook code change — no amount is invented here.
  // New locked below-sum targets (USD, one-time perpetual), by `purchaseTag` / Paddle price id:
  //   compliance  -> $749   (pri_01kwd76be2eq96kff5nqw236c0)
  //   ai-kit      -> $599   (pri_01kwd76c1pgs2csxcj2n0y7vv0)  — unchanged
  //   local-ai    -> $349   (pri_01kwd76cahy825m14334aqf209)
  //   agent-dev   -> $249   (pri_01kwd76ck3w8myy4p4f1gj0dcy)
  //   bundle      -> $1,499 (pri_01kwd76bp60acq51mftvpgr42k)  — below the sum of its parts
  //
  // ENTITLEMENT-ID NOTE: `purchaseTag`/`entitlements` mirror the registry edition id `agent-dev`
  // (`packages/registry-schema/src/module-manifest.ts` EDITIONS); the marketing route/label
  // `/agentic-dev`/"Agentic-Dev" deliberately differ from the entitlement id.
  pri_01kwd76be2eq96kff5nqw236c0: {
    purchaseTag: "compliance",
    credits: NO_CREDITS,
    entitlements: ["compliance"],
  },
  pri_01kwd76bp60acq51mftvpgr42k: {
    purchaseTag: "bundle",
    credits: NO_CREDITS,
    entitlements: ["bundle"], // the BUNDLE_ID sentinel — base ∪ every edition (entitlements.ts)
  },
  pri_01kwd76c1pgs2csxcj2n0y7vv0: {
    purchaseTag: "ai-kit",
    credits: NO_CREDITS,
    entitlements: ["ai-kit"],
  },
  pri_01kwd76cahy825m14334aqf209: {
    purchaseTag: "local-ai",
    credits: NO_CREDITS,
    entitlements: ["local-ai"],
  },
  pri_01kwd76ck3w8myy4p4f1gj0dcy: {
    purchaseTag: "agent-dev",
    credits: NO_CREDITS,
    entitlements: ["agent-dev"], // see the ENTITLEMENT-ID NOTE above
  },

  // ---- Per-module à-la-carte PLACEHOLDER rows (P6-store track: sell every commercial module
  // individually, operator-locked — entitlement infra ADR-0071 already supports it). Same
  // PLACEHOLDER posture as the rows above: `price_<slug>_module_PLACEHOLDER` fake keys, real Paddle
  // one-time price ids land here at go-live wiring. Every row is a perpetual license-only buy
  // (`credits: 0`). `entitlements` carries the BARE package slug (no `@caisson/` prefix) — the
  // per-module entitlement-id convention `expandEntitlements` (@caisson/registry-schema
  // entitlements.ts) resolves against the registry index alongside the long-supported full
  // `@caisson/<slug>` module-id form and the edition/bundle sentinels above. 12 CURRENT modules
  // (already published to the registry) + 2 FUTURE Compliance modules whose packages don't exist
  // yet — `alerting` and `retention-runner` are RESERVED entitlement ids
  // (`RESERVED_MODULE_ENTITLEMENT_IDS`): the row here lets a buyer purchase + hold the grant now,
  // but expansion resolves to NOTHING until each package ships and is indexed (never a 500, never a
  // substitute grant). `compliance`/`ai-kit`/`local-ai`/`agent-dev` reuse their EDITION entitlement
  // id (they name their own edition membership in the registry, ADR-0071) — buying the module row
  // below and buying the edition row above both resolve through the same edition expansion; this is
  // the one true "buy just this" price point for a buyer who does not want the rest of the edition.
  price_compliance_module_PLACEHOLDER: {
    purchaseTag: "compliance_module",
    credits: NO_CREDITS,
    entitlements: ["compliance"],
  },
  price_field_crypto_module_PLACEHOLDER: {
    purchaseTag: "field-crypto_module",
    credits: NO_CREDITS,
    entitlements: ["field-crypto"],
  },
  price_audit_worm_module_PLACEHOLDER: {
    purchaseTag: "audit-worm_module",
    credits: NO_CREDITS,
    entitlements: ["audit-worm"],
  },
  price_ai_meter_module_PLACEHOLDER: {
    purchaseTag: "ai-meter_module",
    credits: NO_CREDITS,
    entitlements: ["ai-meter"],
  },
  price_ai_evals_module_PLACEHOLDER: {
    purchaseTag: "ai-evals_module",
    credits: NO_CREDITS,
    entitlements: ["ai-evals"],
  },
  price_guardrails_module_PLACEHOLDER: {
    purchaseTag: "guardrails_module",
    credits: NO_CREDITS,
    entitlements: ["guardrails"],
  },
  price_prompt_registry_module_PLACEHOLDER: {
    purchaseTag: "prompt-registry_module",
    credits: NO_CREDITS,
    entitlements: ["prompt-registry"],
  },
  price_ai_kit_module_PLACEHOLDER: {
    purchaseTag: "ai-kit_module",
    credits: NO_CREDITS,
    entitlements: ["ai-kit"],
  },
  price_local_ai_module_PLACEHOLDER: {
    purchaseTag: "local-ai_module",
    credits: NO_CREDITS,
    entitlements: ["local-ai"],
  },
  price_local_store_module_PLACEHOLDER: {
    purchaseTag: "local-store_module",
    credits: NO_CREDITS,
    entitlements: ["local-store"],
  },
  price_agent_kernel_module_PLACEHOLDER: {
    purchaseTag: "agent-kernel_module",
    credits: NO_CREDITS,
    entitlements: ["agent-kernel"],
  },
  price_agent_dev_module_PLACEHOLDER: {
    purchaseTag: "agent-dev_module",
    credits: NO_CREDITS,
    entitlements: ["agent-dev"],
  },
  // FUTURE — package not yet built; reserved entitlement id (expands to nothing until it ships).
  price_alerting_module_PLACEHOLDER: {
    purchaseTag: "alerting_module",
    credits: NO_CREDITS,
    entitlements: ["alerting"],
  },
  // FUTURE — package not yet built; reserved entitlement id (expands to nothing until it ships).
  price_retention_runner_module_PLACEHOLDER: {
    purchaseTag: "retention-runner_module",
    credits: NO_CREDITS,
    entitlements: ["retention-runner"],
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
