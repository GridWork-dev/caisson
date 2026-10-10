---
"@caisson-sh/kernel": patch
"@caisson-sh/cli": patch
"@caisson-sh/mcp-server": patch
---

Fix the `create-caisson` and `caisson` commands and the local design-system discovery server doing
nothing on Node versions without `import.meta.main` (before 22.18, and 24.0 to 24.1): they exited 0
with no output. `@caisson-sh/kernel/node` now exports `isMainModule`, which these entries use to
tell that they were started directly.
