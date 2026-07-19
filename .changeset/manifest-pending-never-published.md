---
"@caisson/standards-gate": patch
---

The manifest-pending warning no longer fires for packages that already declare themselves never-published internal tooling (brand, demo-registry, platform-migrations, audit-harness) in an explicit, auditable exemption set. A package must still carry a real SPDX license either way.
