---
"@caisson/registry-schema": minor
---

Added `NON_MODULE_ENTITLEMENT_IDS` (currently `priority-support`): entitlement ids
that are sold and stored as purchased grants for their own routing purpose but are not a package
and never will be. `expandEntitlements` now resolves them to no members instead of throwing, so a
buyer who holds one alongside real software entitlements never has their whole account's
entitlement expansion fail closed over an id with nothing to expand to.
