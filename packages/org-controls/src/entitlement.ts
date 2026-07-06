// The entitlement identity for this commercial module + the fail-closed predicate that gates the
// org-controls product surfaces (ADR-0257 §1.3: the new `/dashboard/members` gate). The MANAGE
// membership surface, WorkOS SSO, and the operator control plane are all part of the $249 org module,
// so a buyer must hold this entitlement to reach them.
//
// A standalone org-controls purchase grants the bare-slug id `org-controls` (the per-module
// purchase-id convention — @caisson/pricebook keys PURCHASE_BOOK.entitlements this way, and
// @caisson/registry-schema's `expandEntitlements` resolves both the bare slug and the full
// `@caisson/org-controls` module-id form). The predicate accepts either form so it is correct
// whichever the grant carries.

/** The bare-slug entitlement id a standalone org-controls purchase grants. */
export const ORG_CONTROLS_ENTITLEMENT_ID = "org-controls";
/** The full module-id form the same entitlement may also appear as. */
export const ORG_CONTROLS_MODULE_ID = "@caisson/org-controls";

/**
 * True only when `activeEntitlementIds` contains the org-controls entitlement (either id form).
 * Pure + fail-closed: an empty set → false (no entitlement → no access). The CALLER supplies ONLY
 * ACTIVE grants (revoked grants must be filtered out before calling), and denies on any read error —
 * this predicate never sees the DB. `activeEntitlementIds` is expected pre-expanded to leaf module
 * ids; a bundle grant that composes org-controls resolves to this id upstream (ADR-0257 W5), so no
 * bundle-membership knowledge is needed here.
 */
export function holdsOrgControls(
  activeEntitlementIds: Iterable<string>,
): boolean {
  for (const id of activeEntitlementIds) {
    if (id === ORG_CONTROLS_ENTITLEMENT_ID || id === ORG_CONTROLS_MODULE_ID) {
      return true;
    }
  }
  return false;
}
