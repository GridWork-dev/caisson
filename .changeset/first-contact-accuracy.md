---
"@caisson-sh/cli": patch
"@caisson-sh/audit-worm": patch
"@caisson-sh/field-crypto": patch
"@caisson-sh/tenancy-rls": patch
"@caisson-sh/site": patch
---

Correct first-contact documentation: generated projects now tell you to run `bun run test` (bare `bun test` also picks up built output), the WORM retention copy states that GOVERNANCE mode can be bypassed by a principal with the bypass-governance permission while COMPLIANCE mode cannot, and package READMEs no longer refer to product editions or call the drizzle-orm `.forceRLS()` change an issue.
