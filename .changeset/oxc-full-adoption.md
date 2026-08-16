---
"@caisson/access-review": patch
"@caisson/admin": patch
"@caisson/agent-dev": patch
"@caisson/agent-kernel": patch
"@caisson/agent-runner": patch
"@caisson/agent-trajectory": patch
"@caisson/ai-config": patch
"@caisson/ai-evals": patch
"@caisson/ai-kit": patch
"@caisson/ai-meter": patch
"@caisson/alerting": patch
"@caisson/analytics": patch
"@caisson/artifact-render": patch
"@caisson/audit-harness": patch
"@caisson/audit-worm": patch
"@caisson/auth": patch
"@caisson/billing": patch
"@caisson/billing-orchestration": patch
"@caisson/brand": patch
"@caisson/browser-audit": patch
"@caisson/cli": patch
"@caisson/compliance": patch
"@caisson/compliance-core": patch
"@caisson/credits": patch
"@caisson/demo-registry": patch
"@caisson/demos": patch
"@caisson/design-critic": patch
"@caisson/ds-manifest": patch
"@caisson/email": patch
"@caisson/field-crypto": patch
"@caisson/frameworks-pack": patch
"@caisson/guardrails": patch
"@caisson/jobs": patch
"@caisson/kernel": patch
"@caisson/license-issue": patch
"@caisson/license-verify": patch
"@caisson/lint-policy": patch
"@caisson/local-inference": patch
"@caisson/local-privacy": patch
"@caisson/local-store": patch
"@caisson/local-sync": patch
"@caisson/mcp-server": patch
"@caisson/migrate": patch
"@caisson/observability": patch
"@caisson/org-controls": patch
"@caisson/oscal-spine": patch
"@caisson/platform-migrations": patch
"@caisson/platform-reads": patch
"@caisson/pricebook": patch
"@caisson/prompt-registry": patch
"@caisson/rate-limit": patch
"@caisson/registry-schema": patch
"@caisson/retention-runner": patch
"@caisson/risk-register": patch
"@caisson/service-betterstack-adapter": patch
"@caisson/service-docs": patch
"@caisson/service-intel": patch
"@caisson/service-license": patch
"@caisson/signing-primitive": patch
"@caisson/site": patch
"@caisson/standards-gate": patch
"@caisson/tenancy-rls": patch
"@caisson/testing": patch
"@caisson/tool-exec": patch
"@caisson/trust-page": patch
"@caisson/ui": patch
"@caisson/ui-pro": patch
"@caisson/verify-pack": patch
---

Replace ESLint and Prettier with oxlint and oxfmt (ADR-0409, implementing the ADR-0408 lock).

One root lint config now covers the whole tree in place of 72 per-package files. Every package
here is touched by the dependency removal or by the one-commit reformat, so each takes a patch
bump; no runtime behaviour changes.

The formatter swap is deliberately style-neutral: a new `.oxfmtrc.json` pins Prettier's own
defaults, which keeps the reformat to 74 files rather than the whole tree.

The visible consequences for a consumer are that the shared config package is renamed and the
lint and format commands changed. The rule floor is unchanged: the same no-any, no-console,
type-only-import and provider-SDK-boundary rules are enforced, at the same severities.
