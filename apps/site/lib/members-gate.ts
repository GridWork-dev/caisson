// The org-controls entitlement gate for /dashboard/members (ADR-0257 §1.3). The member-management
// surface is part of the $249 @caisson/org-controls module, so a buyer must hold the org-controls
// entitlement to reach it. Mirrors the plan page's entitlement-read pattern (readEntitlementGrants →
// active set) but as a fail-closed BOOLEAN gate: the active-filter + the id predicate live in
// @caisson/org-controls (`holdsOrgControls`); this seam supplies the tenant-scoped read AND the
// bundle-coverage check the raw stored ids need (see below).
//
// `db` is injected (not read from getDb here) so the gate is unit-testable against a PGlite double.
// FAIL-CLOSED: a read error THROWS — the caller (the page) must treat any non-true / thrown result as
// deny and render the upsell, never a silent allow.
import { holdsOrgControls } from "@caisson/org-controls";
import { normalizeEntitlementId } from "@caisson/registry-schema";
import { withTenant, type Transactor } from "@caisson/tenancy-rls";
import { readEntitlementGrants } from "./dashboard-reads.ts";

/**
 * True only when `accountId` holds an ACTIVE entitlement covering org-controls: the module itself,
 * or the whole-catalog Everything bundle — which includes every sellable module BY CONSTRUCTION
 * (ADR-0258), matched through the single alias point so the legacy `bundle` id counts too. Stored
 * grants are PURCHASED ids, never pre-expanded (`holdsOrgControls`'s "pre-expanded upstream"
 * contract does not hold on this path — audit F4 2026-07-06 — so the $2,059 Everything buyer was
 * denied a surface they paid for). Tenant-scoped (ADR-0005 fail-closed RLS via withTenant) — a
 * forged account id sees nothing. Revoked grants are filtered out before the predicate.
 *
 * ponytail: org-controls is a member of NO persona bundle (pricing.ts pins `bundles: []` against
 * the registry index via the catalog-parity gate; members-gate.test.ts pins it here) — if it ever
 * joins one, this gate must expand grants against the index instead of the everything shortcut.
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
  return (
    holdsOrgControls(activeIds) ||
    activeIds.some((id) => normalizeEntitlementId(id) === "everything")
  );
}
