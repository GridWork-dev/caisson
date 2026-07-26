// F8 self-serve upgrade crediting (ADR-0247 F8 / ADR-0257) — the checkout reads the pricebook credit
// map here, never recomputing `bundle − owned` from display numbers ad-hoc. SERVER-ONLY: it imports
// `@caisson/pricebook` (a node package — the registry-schema disk loader pulls `node:fs`) and, in
// real use, the buyer's owned entitlement ids from `entitlement_grant` (a server DB read). Keeping it
// out of `lib/cart.ts` (which is bundled into the client cart provider) is what keeps the client
// bundle free of node built-ins.
import {
  upgradeQuote,
  type PaidAmount,
  type UpgradeQuote,
} from "@caisson/pricebook";

/**
 * The upgrade quote to `bundleId` for a signed-in buyer who already OWNS `ownedEntitlementIds` (their
 * bare purchased-id slugs — `entitlement_grant` truth, e.g. `field-crypto`, `ai-meter`). The price is
 * `bundle retail − Σ(owned members' retail)`, floored at $0, from `@caisson/pricebook`'s pre-declared
 * item×bundle credit map. Owned items that are not creditable members of the target bundle contribute
 * nothing (bundle-to-bundle upgrade crediting is out of the F8 map's scope). Throws (fail-closed) only
 * on an unknown `bundleId`.
 *
 * `paidByItem` (ADR-0381 lock 2) is the buyer's own paid price per owned item — the
 * `entitlement_grant.charged_amount` + `charged_currency` read, passed as a pair. A USD entry
 * credits at `max(retail, paid)`, so a later price CUT never strands a buyer who paid the old higher
 * number; omitted items credit at retail, as do non-USD charges (the pricebook will not invent an
 * exchange rate). Optional because the columns are NULL wherever a charge could not be attributed
 * to a single SKU, and because the caller may not have the read yet — the floor is only ever applied
 * to amounts we actually recorded.
 */
export function bundleUpgradeQuote(
  bundleId: string,
  ownedEntitlementIds: readonly string[],
  paidByItem?: Readonly<Record<string, PaidAmount>>,
): UpgradeQuote {
  return upgradeQuote(bundleId, ownedEntitlementIds, paidByItem);
}
