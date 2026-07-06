---
"@caisson/registry-schema": minor
---

Add `entitlementIdAliasGroup` — the read-side reverse of `normalizeEntitlementId`, returning every stored spelling (canonical id plus legacy aliases) of one entitlement so renewal fulfillment can match grants written under the pre-fold vocabulary.
