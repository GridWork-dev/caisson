---
"@caisson/registry-schema": patch
---

Reserve the `agent-trajectory` module slug in the built-but-unpublished entitlement carve-out. The
trajectory-observation primitive ships before it is offered for sale, so a purchased id matching its
bare slug now expands to an empty grant rather than failing closed — the same fail-soft handling every
sold-before-published module already gets, self-expiring the first time the package is indexed.
