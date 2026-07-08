// The compliance-evidence entitlement gate for /dashboard/compliance + its download API (G25).
// The attestation surface feeds the sold, validate-conformant SOC 2 / HIPAA / EU-AI-Act
// evidence-pack generator (`compliance-core`'s blurb, `lib/pricing.ts`) — previously reachable by
// ANY signed-in account with zero purchases (no entitlement check anywhere, contrast
// `members-gate.ts`'s `accountHoldsOrgControls`). Mirrors that gate's exact shape: a fail-closed
// BOOLEAN over the tenant-scoped active-grant read, ORing in direct compliance-core ownership, the
// compliance BUNDLE (which composes compliance-core — buying the bundle must not lock a buyer out
// of a module it contains), and the whole-catalog Everything bundle.
//
// `db` is injected (not read from getDb here) so the gate is unit-testable against a PGlite double.
// FAIL-CLOSED: a read error THROWS — the caller (the page/route) must treat any non-true / thrown
// result as deny and render the upsell / 403, never a silent allow.
import { normalizeEntitlementId } from "@caisson/registry-schema";
import { withTenant, type Transactor } from "@caisson/tenancy-rls";
import { readEntitlementGrants } from "./dashboard-reads.ts";

const COMPLIANCE_CORE_ENTITLEMENT_ID = "compliance-core";
const COMPLIANCE_CORE_MODULE_ID = "@caisson/compliance-core";
const COMPLIANCE_BUNDLE_ID = "compliance";

export async function accountHoldsComplianceCore(
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
    if (
      id === COMPLIANCE_CORE_ENTITLEMENT_ID ||
      id === COMPLIANCE_CORE_MODULE_ID ||
      id === COMPLIANCE_BUNDLE_ID
    ) {
      return true;
    }
    return normalizeEntitlementId(id) === "everything";
  });
}
