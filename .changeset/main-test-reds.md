---
"@caisson/audit-harness": patch
"@caisson/mcp-server": patch
---

Coverage-gate completeness and stale-pin fixes for two cache-masked main reds: the audit-harness
domain partition now sweeps loose files at the tooling/infra/tools container roots (a
`<container>-root` domain each — `tools/paddle-catalog-recreate.ts` was git-tracked but unclaimed),
and its test task is uncacheable (it reads the whole git tree, which turbo cannot hash). The
mcp-server gate test is re-pinned from the superseded ADR-0257 "legacy id folds members" promise to
the ADR-0270 purge semantics (a dissolved edition id resolves only as its indexed meta; members are
denied fail-closed). The root turbo `test` task now depends on `^build` so a dependency package's
change invalidates dependents' test caches.
