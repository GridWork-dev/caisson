---
"@caisson/kernel": patch
"@caisson/credits": patch
"@caisson/billing": patch
"@caisson/pricebook": patch
"@caisson/license-issue": patch
"@caisson/license-verify": patch
"@caisson/field-crypto": patch
"@caisson/tenancy-rls": patch
---

Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
internal build-phase shorthand, and bare specification-id citations that had leaked into
shipped copy. No runtime behavior changed in any package — documentation and comments only.
