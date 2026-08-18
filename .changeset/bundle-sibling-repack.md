---
"@caisson/agentic-dev": patch
"@caisson/ai-production": patch
"@caisson/local-first": patch
"@caisson/provenance": patch
---

Repack refresh for the four bundle packages: the lint-tooling swap churned every workspace
manifest, so the previously recorded tarball rows no longer re-pack byte-identical from this
tree. Bumping each bundle records a fresh row at the true bytes; no runtime behavior changes.
