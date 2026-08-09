---
"@caisson/agent-kernel": patch
"@caisson/audit-harness": patch
"@caisson/billing": patch
"@caisson/cli": minor
"@caisson/demo-registry": patch
"@caisson/jobs": patch
"@caisson/license-issue": patch
"@caisson/local-store": patch
"@caisson/mcp-server": patch
"@caisson/pricebook": patch
"@caisson/rate-limit": patch
"@caisson/signing-primitive": patch
"@caisson/ui": patch
"@caisson/ui-pro": patch
---

Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing. The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`.
