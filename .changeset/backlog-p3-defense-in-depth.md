---
"@caisson/site": patch
"@caisson/local-ai-app": patch
"@caisson/app-compliance": patch
---

Backlog P3 defense-in-depth (from the PR#35 sibling sweep; all private apps, no publish):

- `@caisson/site`: `AddMemberInput` gains `.strict()` for boundary-schema floor consistency (behavior
  unchanged — the parse object is hand-built, owner-gated, RLS-scoped, parameterized).
- `@caisson/local-ai-app` + `@caisson/app-compliance`: the demo field-crypto paths (`demoProvider` /
  `createLegHarness`) now **fail closed under `NODE_ENV=production`** instead of silently using the fixed
  demo key vector. Neither app is a deployed service and both handle only synthetic data, so this never
  fires today (tests run under `NODE_ENV=test`; the compliance leg is golden-deterministic so `fromEnv`
  is deliberately NOT used) — pure defense-in-depth against a future deploy routing real data through.
