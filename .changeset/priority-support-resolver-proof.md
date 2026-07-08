---
"@caisson/service-license": patch
---

Add an integration test proving `resolveAccountEntitlements` never fails closed for an account
that holds the priority-support subscription alongside a real software entitlement — the exact
brick risk the non-module entitlement reservation in `@caisson/registry-schema` closes.
No behavior change. Private package only; no publishable release.
