---
"@caisson/agent-usage": patch
"@caisson/ai-config": patch
"@caisson/analytics": patch
"@caisson/artifact-render": patch
"@caisson/audit-harness": patch
"@caisson/billing": patch
"@caisson/brand": patch
"@caisson/cli": patch
"@caisson/demo-registry": patch
"@caisson/ds-manifest": patch
"@caisson/email": patch
"@caisson/jobs": patch
"@caisson/license-issue": patch
"@caisson/mcp-server": patch
"@caisson/observability": patch
"@caisson/platform-migrations": patch
"@caisson/pricebook": patch
"@caisson/rate-limit": patch
"@caisson/signing-primitive": patch
"@caisson/ui": patch
"@caisson/ui-pro": patch
"@caisson/verify-pack": patch
---

Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing without changing runtime behavior.
