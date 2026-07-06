---
"@caisson/agent-kernel": patch
"@caisson/agent-runner": patch
"@caisson/ai-config": patch
"@caisson/ai-evals": patch
"@caisson/ai-kit": patch
"@caisson/ai-meter": patch
"@caisson/alerting": patch
"@caisson/audit-harness": patch
"@caisson/audit-worm": patch
"@caisson/auth": patch
"@caisson/billing": patch
"@caisson/cli": patch
"@caisson/compliance": patch
"@caisson/credits": patch
"@caisson/email": patch
"@caisson/field-crypto": patch
"@caisson/guardrails": patch
"@caisson/jobs": patch
"@caisson/kernel": patch
"@caisson/license-issue": patch
"@caisson/license-verify": patch
"@caisson/local-ai": patch
"@caisson/local-store": patch
"@caisson/mcp-server": patch
"@caisson/migrate": patch
"@caisson/observability": patch
"@caisson/platform-reads": patch
"@caisson/pricebook": patch
"@caisson/prompt-registry": patch
"@caisson/rate-limit": patch
"@caisson/registry-schema": patch
"@caisson/retention-runner": patch
"@caisson/tenancy-rls": patch
"@caisson/tool-exec": patch
"@caisson/ui": patch
---

Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
