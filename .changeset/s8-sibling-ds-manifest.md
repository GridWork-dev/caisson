---
"@caisson/ds-manifest": patch
---

Regenerate ds-manifest's bundled component metadata for the new @caisson/ui version (version-pr.yml runs `bun run --filter @caisson/ui gen:manifest` after Changesets consumes versions, and packages/ui/scripts/manifest-generator.ts writes ui's package.json version into packages/ds-manifest/src/base-manifest.json), so the already-recorded @caisson/ds-manifest@0.3.3 tarball no longer reproduces; a new package version preserves the existing row.
