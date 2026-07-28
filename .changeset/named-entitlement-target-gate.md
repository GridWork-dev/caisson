---
"@caisson/standards-gate": patch
---

Adds a build-time check that every named entitlement edge points at a module the registry index actually carries. The runtime now skips an unresolvable edge instead of failing the whole grant, so this gate is what keeps a missing target loud at the moment it is still free to fix.
