---
"@caisson/prompt-registry": minor
---

Add an optional embeddable prompt browser at the `@caisson/prompt-registry/ui` subpath. It lists
your registered prompt versions with their role shape, variable count, and a one-line preview, and
splits distinct prompt names from total versions so the append-only version history stays legible.
The surface renders only the versions you hand it — no tenant executor, no database. Presentational
and server-render safe; composes the `@caisson/ui` kit. Importing the package root stays React-free.
