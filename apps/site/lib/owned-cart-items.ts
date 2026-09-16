// The signed-in account's OWNED cart-item ids (G16 — add-to-cart had zero ownership awareness).
// A thin read of the SAME `entitlement_grant` store `/dashboard/plan`'s owned derivation reads
// (`activeIds.has(entitlementId)`) — kept here rather than duplicated logic so the two owned-checks
// can never diverge on what "active" means. Every real purchase row grants EXACTLY `[slug]`
// (`packages/pricebook/src/purchases.ts` — a bundle row grants `["<bundle-slug>"]`, a module row
// `["<module-slug>"]`), and `lib/catalog.ts` namespaces cart ids `bundle:<slug>` / `module:<slug>`
// off the SAME slug — so "owned" is exactly "the bare slug is an active entitlement id".
import { BUNDLE_CATALOG, MODULE_CATALOG } from "./catalog.ts";
import { readEntitlementGrants } from "./dashboard-reads.ts";
import { readScoped } from "./db.ts";
import { getSession } from "./auth.ts";

/**
 * Every catalog cart-item id (`bundle:<slug>` / `module:<slug>`) the signed-in account already
 * owns. Empty for a signed-out visitor — nothing to disable. Does NOT expand the Everything
 * bundle's implicit full-catalog coverage (matches the plan page's exact behavior, which this
 * mirrors on purpose — a parallel workstream owns widening that logic for both readers at once).
 */
export async function getOwnedCartItemIds(): Promise<ReadonlySet<string>> {
  const session = await getSession();
  if (session === null) return new Set();
  return getOwnedCartItemIdsForAccount(session.accountId);
}

/** Server-only: accountId must come from a verified session, never request input. */
export async function getOwnedCartItemIdsForAccount(
  accountId: string,
): Promise<ReadonlySet<string>> {
  const grants = await readScoped(accountId, (tx) =>
    readEntitlementGrants(tx, accountId),
  );
  const activeIds = new Set(
    grants.filter((g) => g.status === "active").map((g) => g.entitlementId),
  );
  const owned = new Set<string>();
  for (const item of [...BUNDLE_CATALOG, ...MODULE_CATALOG]) {
    const slug = item.id.split(":")[1];
    if (slug !== undefined && activeIds.has(slug)) owned.add(item.id);
  }
  return owned;
}
