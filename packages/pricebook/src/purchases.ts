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
export const PURCHASE_BOOK_VERSION = "2026-07-18.1";

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
  // PRICING NOTE: the price a buyer is CHARGED is NOT stored here. This book keys the Paddle price
  // id -> credits + entitlements; the dollar AMOUNT lives on the Paddle product (dashboard/API), and
  // the site DISPLAY amount is owned by `apps/site/lib/pricing.ts` (the single display SOT, integer
  // USD) with the cents authority in `upgrades.ts` BUNDLE_RETAIL / SKU_RETAIL (ADR-0258/0260). A
  // reprice is a Paddle-side + site-display change, NOT a pricebook code change — no amount is
  // invented here. The four archived-edition rows below and the legacy $1,499 bundle row are RETIRED:
  // their Paddle products were archived in the W7 catalog big-bang (ADR-0258). ADR-0270 repointed their
  // `entitlements` to canonical six-bundle ids (edition-trace purge); the rows stay for replay of any
  // historical sandbox event, and the six-bundle rows live in the W7 section further down.
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
  // ADR-0270 (edition-trace purge): these five archived-edition/bundle-sentinel sandbox rows were
  // REPOINTED from the dissolved edition ids (`ai-kit`/`local-ai`/`agent-dev`/`bundle`) to the canonical
  // six-bundle ids. Their Paddle products are archived (no new transactions); the rows survive only for
  // replay of any historical sandbox event, and a replay now mints the CANONICAL id — the same id the
  // live W7 rows below and the renewal/expansion paths converge on. No edition id is minted anywhere.
  pri_01kwd76be2eq96kff5nqw236c0: {
    purchaseTag: "compliance",
    credits: NO_CREDITS,
    entitlements: ["compliance"],
  },
  pri_01kwd76bp60acq51mftvpgr42k: {
    purchaseTag: "everything",
    credits: NO_CREDITS,
    entitlements: ["everything"], // was the legacy `bundle` sentinel (ADR-0270 repoint)
  },
  pri_01kwd76c1pgs2csxcj2n0y7vv0: {
    purchaseTag: "ai-production",
    credits: NO_CREDITS,
    entitlements: ["ai-production"], // was `ai-kit` (ADR-0270 repoint)
  },
  pri_01kwd76cahy825m14334aqf209: {
    purchaseTag: "local-first",
    credits: NO_CREDITS,
    entitlements: ["local-first"], // was `local-ai` (ADR-0270 repoint)
  },
  pri_01kwd76ck3w8myy4p4f1gj0dcy: {
    purchaseTag: "agentic-dev",
    credits: NO_CREDITS,
    entitlements: ["agentic-dev"], // was `agent-dev` (ADR-0270 repoint)
  },

  // ---- Per-module à-la-carte PLACEHOLDER rows (sell every commercial module
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
  // agent-runner postdates the rest of this section (ADR-0186) — added here to
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
  // agent-trajectory joined the catalog 2026-07-18 (agent-runtime wave) — sandbox price
  // created via tools/paddle-catalog-recreate.ts.
  pri_01kxvpjjx55q4cf21cwjbjhwv5: {
    purchaseTag: "agent-trajectory_module",
    credits: NO_CREDITS,
    entitlements: ["agent-trajectory"],
  },

  // ---- REAL Paddle sandbox price ids — the W7 catalog big-bang (ADR-0258 §5, created
  // 2026-07-06). Eleven carve/new module SKUs (bare package slugs) + the six ADR-0257 bundles
  // (CANONICAL bundle ids — new grants store the id `resolveRenewal`/`expandEntitlements`
  // converge on; legacy-keyed grants stay covered by the alias group in extendUpdatesWindow).
  // Every row is a perpetual license-only buy (`credits: 0`); dollar amounts live on the Paddle
  // product + the site display SOT, never here. The four retired edition products' price ids
  // above stay mapped for historical fulfillment; Paddle-side they are archived (no new
  // transactions), alongside the legacy $1,499 bundle product superseded by `everything`.
  pri_01kwwqa0k69m965tx8hgsv904h: {
    purchaseTag: "compliance-core_module",
    credits: NO_CREDITS,
    entitlements: ["compliance-core"],
  },
  pri_01kwwqa0rkz3etv2yfd6c7jjad: {
    purchaseTag: "frameworks-pack_module",
    credits: NO_CREDITS,
    entitlements: ["frameworks-pack"],
  },
  pri_01kwwqa0y1hn63taahdh7y03vf: {
    purchaseTag: "signing-primitive_module",
    credits: NO_CREDITS,
    entitlements: ["signing-primitive"],
  },
  pri_01kwwqa1413c33yfsrvjb4r34a: {
    purchaseTag: "credits_module",
    credits: NO_CREDITS,
    entitlements: ["credits"],
  },
  pri_01kwwqa1b33ycmh114440xc6re: {
    purchaseTag: "local-sync_module",
    credits: NO_CREDITS,
    entitlements: ["local-sync"],
  },
  pri_01kwwqa1gvkpj7g0jfna7h2qcr: {
    purchaseTag: "local-inference_module",
    credits: NO_CREDITS,
    entitlements: ["local-inference"],
  },
  pri_01kwwqa1p152hskczw7daszzgn: {
    purchaseTag: "local-privacy_module",
    credits: NO_CREDITS,
    entitlements: ["local-privacy"],
  },
  pri_01kwwqa1v2gm7cr5g1rpzyk522: {
    purchaseTag: "tool-exec_module",
    credits: NO_CREDITS,
    entitlements: ["tool-exec"],
  },
  pri_01kwwqa20m42dmedx9mprk085k: {
    purchaseTag: "org-controls_module",
    credits: NO_CREDITS,
    entitlements: ["org-controls"],
  },
  pri_01kwwqa266p6smw4yaanxg1n5j: {
    purchaseTag: "billing-orchestration_module",
    credits: NO_CREDITS,
    entitlements: ["billing-orchestration"],
  },
  pri_01kwwqa2c799fpe1af76p75r7r: {
    purchaseTag: "ui-pro_module",
    credits: NO_CREDITS,
    entitlements: ["ui-pro"],
  },
  pri_01kwwqa2hne35c1df5xe8p91z3: {
    purchaseTag: "compliance_bundle",
    credits: NO_CREDITS,
    entitlements: ["compliance"],
  },
  pri_01kwwqa2rcxtn8pt3dr3jdnnf0: {
    purchaseTag: "ai-production_bundle",
    credits: NO_CREDITS,
    entitlements: ["ai-production"],
  },
  pri_01kwwqa2xp3jp1qww2j5ya0meh: {
    purchaseTag: "local-first_bundle",
    credits: NO_CREDITS,
    entitlements: ["local-first"],
  },
  pri_01kwwqa332mweg8veaarkygbae: {
    purchaseTag: "agentic-dev_bundle",
    credits: NO_CREDITS,
    entitlements: ["agentic-dev"],
  },
  pri_01kwwqa3872cs4c53w8qhhz31k: {
    purchaseTag: "provenance_bundle",
    credits: NO_CREDITS,
    entitlements: ["provenance"],
  },
  pri_01kwwqa3dfp8k0v5k3bbg3pd5f: {
    purchaseTag: "everything_bundle",
    credits: NO_CREDITS,
    entitlements: ["everything"],
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
