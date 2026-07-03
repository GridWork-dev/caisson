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
export const PURCHASE_BOOK_VERSION = "2026-07-02.1";

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
  // The one REAL row below that grants CREDITS, not an entitlement — mirrors the
  // `price_credit_pack_PLACEHOLDER` row at the top of this book (5000 credits, $49, no edition
  // access). Not surfaced in `apps/site/lib/catalog.ts` (no marketplace/cart display) — this row
  // exists purely so the webhook can resolve a direct Paddle credit-pack purchase.
  pri_01kwj71ae0g946ztm4sej7bq76: {
    purchaseTag: "credit_pack",
    credits: asCredits(5000),
    entitlements: [],
  },
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
  // PLACEHOLDER posture as the rows above: `price_<slug>_module_PLACEHOLDER` fake keys — these are
  // KEPT as bound `purchases.test.ts` fixtures even now that the REAL module rows exist below.
  // `entitlements` carries the BARE package slug (no `@caisson/` prefix) — the per-module
  // entitlement-id convention `expandEntitlements` (@caisson/registry-schema entitlements.ts)
  // resolves against the registry index alongside the long-supported full `@caisson/<slug>`
  // module-id form and the edition/bundle sentinels above. All 11 à-la-carte modules — including
  // `alerting` and `retention-runner`, shipped in Stage-2 (ADR-0150/0151) and registry-indexed —
  // are CURRENT. The four edition-core rows (`compliance`/`ai-kit`/`local-ai`/`agent-dev` module
  // SKUs) were DROPPED (ADR-0238): their bare ids named their own EDITION's entitlement id, so a
  // module purchase silently expanded to the whole parent edition — and no separable core artifact
  // exists to grant instead (the edition meta-packages hard-depend on their commercial members).
  // Editions are how composition is bought; à la carte sells only the standalone modules.
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
  // agent-runner postdates the rest of this section (harvest slice-2, ADR-0186) — added here to
  // keep the PLACEHOLDER convention symmetric with its REAL row below.
  price_agent_runner_module_PLACEHOLDER: {
    purchaseTag: "agent-runner_module",
    credits: NO_CREDITS,
    entitlements: ["agent-runner"],
  },
  price_alerting_module_PLACEHOLDER: {
    purchaseTag: "alerting_module",
    credits: NO_CREDITS,
    entitlements: ["alerting"],
  },
  price_retention_runner_module_PLACEHOLDER: {
    purchaseTag: "retention-runner_module",
    credits: NO_CREDITS,
    entitlements: ["retention-runner"],
  },

  // ---- REAL Paddle sandbox price ids — per-module à-la-carte (module-SKU wiring, 2026-07-02) ----
  // The PLACEHOLDER rows above are kept in place (bound `purchases.test.ts` fixtures); these are the
  // LIVE rows the module cart + webhook actually resolve against, mirroring the edition/bundle REAL
  // section above. Every row is a perpetual license-only buy (`credits: 0`, no bundled credit pack);
  // `entitlements` carries the bare package slug per the ENTITLEMENT-ID convention above. Dollar
  // amounts live on the Paddle product + `apps/site/lib/pricing.ts` display sheet, not here.
  // The four dropped edition-core rows' sandbox price ids (ADR-0238) are intentionally UNMAPPED —
  // `resolvePurchase` fails closed on them, and the site no longer sells them. The orphaned Paddle
  // SANDBOX products never port to production (ADR-0227).
  pri_01kwj6m3cwez98t45jzwsqb250: {
    purchaseTag: "field-crypto_module",
    credits: NO_CREDITS,
    entitlements: ["field-crypto"],
  },
  pri_01kwj6m3mjq4rpv7918rhfhrhw: {
    purchaseTag: "audit-worm_module",
    credits: NO_CREDITS,
    entitlements: ["audit-worm"],
  },
  pri_01kwj6m3x1cw1k54tcdhsc6pgj: {
    purchaseTag: "retention-runner_module",
    credits: NO_CREDITS,
    entitlements: ["retention-runner"],
  },
  pri_01kwj6m45zeqyxgad3f32x1b30: {
    purchaseTag: "ai-meter_module",
    credits: NO_CREDITS,
    entitlements: ["ai-meter"],
  },
  pri_01kwj6m4d3npk8sszerx7fek7w: {
    purchaseTag: "ai-evals_module",
    credits: NO_CREDITS,
    entitlements: ["ai-evals"],
  },
  pri_01kwj6m4n105qe80fapw9sk5xc: {
    purchaseTag: "guardrails_module",
    credits: NO_CREDITS,
    entitlements: ["guardrails"],
  },
  pri_01kwj6m4whyw1stbej2qk8q0bg: {
    purchaseTag: "prompt-registry_module",
    credits: NO_CREDITS,
    entitlements: ["prompt-registry"],
  },
  pri_01kwj6m5da9ay3z85b6qwtjcpe: {
    purchaseTag: "alerting_module",
    credits: NO_CREDITS,
    entitlements: ["alerting"],
  },
  pri_01kwj6m5w3s4fmvseap7zmp5yf: {
    purchaseTag: "local-store_module",
    credits: NO_CREDITS,
    entitlements: ["local-store"],
  },
  pri_01kwj6m63qpt52489tq5a3v6q3: {
    purchaseTag: "agent-kernel_module",
    credits: NO_CREDITS,
    entitlements: ["agent-kernel"],
  },
  pri_01kwj71a53hycbspsfv8pck5vc: {
    purchaseTag: "agent-runner_module",
    credits: NO_CREDITS,
    entitlements: ["agent-runner"],
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
