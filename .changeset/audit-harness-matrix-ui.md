---
"@caisson/audit-harness": minor
---

Add an optional embeddable matrix viewer at the `@caisson/audit-harness/ui` subpath for the tooling
app. It pivots the coverage rows into a domain-by-dimension grid (latest round wins) and lists the
reconciled findings, with an open / high-severity headline up top. The surface renders only the
findings and coverage handed to it — no run, no filesystem — and composes the `@caisson/ui` kit.
Importing the package root stays React-free.
