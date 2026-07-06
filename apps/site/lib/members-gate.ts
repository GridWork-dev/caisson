// The org-controls entitlement gate for /dashboard/members (ADR-0257 §1.3). The member-management
// surface is part of the $249 @caisson/org-controls module, so a buyer must hold the org-controls
// entitlement to reach it. Mirrors the plan page's entitlement-read pattern (readEntitlementGrants →
// active set) but as a fail-closed BOOLEAN gate: the active-filter + the id predicate live in
// @caisson/org-controls (`holdsOrgControls`); this seam just supplies the tenant-scoped read.
//
// `db` is injected (not read from getDb here) so the gate is unit-testable against a PGlite double.
// FAIL-CLOSED: a read error THROWS — the caller (the page) must treat any non-true / thrown result as
// deny and render the upsell, never a silent allow.
import { holdsOrgControls } from "@caisson/org-controls";
import { withTenant, type Transactor } from "@caisson/tenancy-rls";
import { readEntitlementGrants } from "./dashboard-reads.ts";

/**
 * True only when `accountId` holds an ACTIVE org-controls entitlement. Tenant-scoped (ADR-0005
 * fail-closed RLS via withTenant) — a forged account id sees nothing. Revoked grants are filtered
 * out before the predicate, so a revoked entitlement denies.
 */
export async function accountHoldsOrgControls(
  db: Transactor,
  accountId: string,
): Promise<boolean> {
  const grants = await withTenant(db, accountId, (tx) =>
    readEntitlementGrants(tx, accountId),
  );
  const activeIds = grants
    .filter((g) => g.status === "active")
    .map((g) => g.entitlementId);
  return holdsOrgControls(activeIds);
}
