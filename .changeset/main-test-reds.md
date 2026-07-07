---
"@caisson/audit-harness": patch
"@caisson/mcp-server": patch
---

Audit coverage and gate-test correctness fixes. The audit-harness domain partition now sweeps
loose files at the tooling, infra, and tools container roots into a per-container root domain,
so a script added directly under one of those directories can no longer escape the coverage
gate; its test task is also marked uncacheable because the gate reads the whole repository tree.
The MCP server's entitlement gate test is re-pinned to the current catalog vocabulary: a
dissolved edition id resolves only as its indexed meta-package and no longer grants that
edition's member modules, which are denied fail-closed; the current bundle ids remain the way a
purchase grants its member set.
