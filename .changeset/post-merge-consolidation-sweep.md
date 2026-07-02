---
"@caisson/site": patch
"@caisson/ui": patch
"@caisson/audit-harness": patch
"@caisson/observability": patch
"@caisson/registry": patch
"@caisson/service-docs": patch
"@caisson/service-license": patch
---

Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
