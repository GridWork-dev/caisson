---
"@caisson/brand": patch
"@caisson/demo-registry": patch
"@caisson/design-critic": patch
"@caisson/standards-gate": patch
"@caisson/browser-audit": patch
---

Declares each package's type-check-only `build` task as producing no cacheable output (`outputs: []`), clearing the five stale "no output files found" warnings from a clean turbo build. No behavior change.
