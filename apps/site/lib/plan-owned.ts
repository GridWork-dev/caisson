// The G13 "owned" derivation (ADR-0293) — pure so it is unit-testable without a DB. `/dashboard/plan`
// used to hardcode `owned=false` for every subscription row (a subscribed buyer saw a live Buy button
// on their own plan). The fix: an entitlement-bearing plan (e.g. Compliance Updates) is owned when
// EVERY entitlement it grants is active for the account — the SAME check the Purchases section
// already used correctly. A ZERO-entitlement plan (Developer, ADR-0269 Decision 3 — it never grants a
// new purchased id) can't use that check: `[].every(...)` is vacuously `true`, which would read as
// "owned" for every account, subscribed or not. For that shape, ownership comes from the
// `subscription_status` signal (ADR-0293) instead — an ACTIVE row keyed by this exact price id.
export function computeOwned(
  entitlements: readonly string[],
  activeEntitlementIds: ReadonlySet<string>,
  activeSubscriptionPriceIds: ReadonlySet<string>,
  priceId: string,
): boolean {
  return entitlements.length > 0
    ? entitlements.every((id) => activeEntitlementIds.has(id))
    : activeSubscriptionPriceIds.has(priceId);
}
