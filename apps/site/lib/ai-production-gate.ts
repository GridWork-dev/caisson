// The AI-Production entitlement gate for /dashboard/ai-keys (CAISSON-64 P1). BYOK (bring-your-own
// provider key, ADR-0162/0183) is delivered by `@caisson/ai-kit` — the dissolved "AI Production
// Kit" edition (ADR-0257 §1) whose real, current purchase vocabulary is the `ai-production` bundle
// (`packages/registry-schema/src/entitlements.ts`'s `EDITION_BUNDLE_ID` maps the legacy `ai-kit`
// edition onto it; `packages/pricebook/src/purchases.ts` repoints the old `ai-kit` purchase row's
// `entitlements` onto `["ai-production"]`, ADR-0270). There is no standalone à-la-carte SKU that
// individually grants BYOK: `ai-kit`'s member modules (`ai-meter`, `credits`, `guardrails`,
// `prompt-registry`) are each sold separately in `MODULE_PRICES`, but buying just one of them does
// not entitle a buyer to BYOK — the feature composes the whole edition, sold today only as the
// `ai-production` bundle (or the whole-catalog `everything` bundle). So, unlike
// `compliance-gate.ts`'s three-way OR (module id ∨ its bundle ∨ everything), this gate's real id
// set is two-wide: the `ai-production` bundle itself, plus `everything`. Mirrors
// `accountHoldsComplianceCore`'s exact shape otherwise: a fail-closed BOOLEAN over the tenant-scoped
// active-grant read — previously /dashboard/ai-keys had NO entitlement check at all (reachable by
// any signed-in account with zero purchases).
//
// `db` is injected (not read from getDb here) so the gate is unit-testable against a PGlite double.
// FAIL-CLOSED: a read error THROWS — the caller (the page/route) must treat any non-true / thrown
// result as deny and render the upsell / 403, never a silent allow.
import { normalizeEntitlementId } from "@caisson/registry-schema";
import { withTenant, type Transactor } from "@caisson/tenancy-rls";
import { readEntitlementGrants } from "./dashboard-reads.ts";

const AI_PRODUCTION_BUNDLE_ID = "ai-production";

export async function accountHoldsAiProduction(
  db: Transactor,
  accountId: string,
): Promise<boolean> {
  const grants = await withTenant(db, accountId, (tx) =>
    readEntitlementGrants(tx, accountId),
  );
  const activeIds = grants
    .filter((g) => g.status === "active")
    .map((g) => g.entitlementId);
  return activeIds.some((id) => {
    if (id === AI_PRODUCTION_BUNDLE_ID) return true;
    return normalizeEntitlementId(id) === "everything";
  });
}
