// The grant identity for this module + the fail-closed predicate a host can use to gate the
// org-controls surfaces (the MANAGE membership surface, WorkOS SSO, and the operator control plane)
// behind its own access grants.
//
// A grant may name the module by its bare slug `org-controls` or by the full `@caisson-sh/org-controls`
// module id; the predicate accepts either form so it is correct whichever the host's grant carries.

/** The bare-slug entitlement id a standalone org-controls purchase grants. */
export const ORG_CONTROLS_ENTITLEMENT_ID = "org-controls";
/** The full module-id form the same entitlement may also appear as. */
export const ORG_CONTROLS_MODULE_ID = "@caisson-sh/org-controls";

/**
 * True only when `activeEntitlementIds` contains the org-controls entitlement (either id form).
 * Pure + fail-closed: an empty set → false (no entitlement → no access). The CALLER supplies ONLY
 * ACTIVE grants (revoked grants must be filtered out before calling), and denies on any read error —
 * this predicate never sees the DB. `activeEntitlementIds` is expected pre-expanded to leaf module
 * ids, so no grouping knowledge is needed here.
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
