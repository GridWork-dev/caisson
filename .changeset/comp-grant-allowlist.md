---
"@caisson/service-license": patch
"@caisson/admin": patch
---

ADR-0278 F1: the admin comp-grant boundary (`grantEntitlementAdmin`) now rejects an
unresolvable entitlement id with a 400 before writing any row, instead of accepting an
arbitrary string that would later brick the target account's entire entitlement
expansion on its next `/issue`/dashboard read. The allowlist is derived live from
`expandEntitlements` (bundle ids, indexed modules, reserved graduation ids, and legacy
aliases) — never a hand-maintained list. Private packages only; no publishable release.
