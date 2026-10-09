---
"@caisson-sh/cli": patch
"@caisson-sh/site": patch
---

Fix the documented generator command. `bunx @caisson-sh/cli` starts the package's first bin,
`caisson`, which rejects the generator flags, so the README and the docs now run the generator as
`bunx --package @caisson-sh/cli create-caisson` (or `npx --package @caisson-sh/cli create-caisson`
under Node). The pinned-install example now uses versions that exist on npm.
