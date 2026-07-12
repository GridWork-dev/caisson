---
"@caisson/cli": minor
---

`--edition <bundle>` alone now auto-selects the bundle's current modules (CAISSON-88):
the selection is resolved through `expandEntitlements` against the live registry index,
pinned at each member's `latest`, with bundle/edition meta entries dropped — so
`bunx create-caisson my-app --edition compliance` scaffolds without a `--module` list.
Explicit `--module` flags still win outright, and the interactive wizard pre-selects the
expansion so a bundle buyer confirms rather than re-picks. Fail-closed: an unknown or
retired edition id, or an expansion that resolves to zero installable modules, throws
before anything is written.
