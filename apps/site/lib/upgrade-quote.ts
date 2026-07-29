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
import { readNetPaidByItem } from "@caisson/platform-reads";
import { getSession } from "./auth.ts";
import { readScoped } from "./db.ts";

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
 * to a single SKU — the floor is only ever applied to amounts we actually recorded. A caller with a
 * signed-in buyer should get the map from {@link paidByItemForAccount} rather than reading the
 * column itself; see the note there.
 */
export function bundleUpgradeQuote(
  bundleId: string,
  ownedEntitlementIds: readonly string[],
  paidByItem?: Readonly<Record<string, PaidAmount>>,
): UpgradeQuote {
  return upgradeQuote(bundleId, ownedEntitlementIds, paidByItem);
}

/**
 * The signed-in account's `paidByItem` map, or `undefined` for a signed-out visitor (nothing owned,
 * so nothing to credit above retail).
 *
 * NO CALLER YET. This is the arming half of ADR-0394: nothing in the app renders or charges an
 * upgrade price, so `bundleUpgradeQuote` has no live caller either and no buyer's credit is computed
 * from this today. Wiring a checkout surface to it is a separate change.
 *
 * It exists ahead of that surface so the wiring cannot get the money wrong: `charged_amount` is what
 * the buyer was charged and NOT what they kept — refunds accumulate separately — so a caller that
 * SELECTs the column itself and passes it straight through would credit an upgrade against money
 * already returned to the buyer's card. `readNetPaidByItem` nets the two and is pinned against the
 * license service's own `netCharged`, so going through it is what keeps that impossible. Use it
 * rather than adding a second read.
 */
export async function paidByItemForAccount(): Promise<
  Readonly<Record<string, PaidAmount>> | undefined
> {
  const session = await getSession();
  if (session === null) return undefined;
  return readScoped(session.accountId, (tx) =>
    readNetPaidByItem(tx, session.accountId),
  );
}
