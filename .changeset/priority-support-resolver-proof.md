---
"@caisson/service-license": patch
---

Add an integration test proving `resolveAccountEntitlements` never fails closed for an account
that holds the priority-support subscription alongside a real software entitlement — the exact
brick risk the `@caisson/registry-schema` `NON_MODULE_ENTITLEMENT_IDS` guard closes (ADR-0278/0288).
No behavior change. Private package only; no publishable release.
