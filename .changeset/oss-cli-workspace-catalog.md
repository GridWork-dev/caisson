---
"@caisson-sh/cli": minor
---

The module catalog `create-caisson` validates against is now built from the packages released with it: every public `@caisson-sh/*` package at its current version, one version per module, with its description, dependencies and stability. Every such package can be generated, and `--module` pins match what npm serves for that release. An unbuilt checkout with no catalog file now fails with a message naming `bun run build` instead of reading a stale index.
