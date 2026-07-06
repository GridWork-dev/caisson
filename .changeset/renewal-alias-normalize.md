---
"@caisson/pricebook": patch
---

An updates-renewal now resolves the current bundle name of the edition it renews. A renewal
written against an edition's earlier name still points at the same entitlement after the catalog
is reorganized into bundles, so a renewal keeps extending the correct updates window regardless of
which naming the renewal row was created under.
