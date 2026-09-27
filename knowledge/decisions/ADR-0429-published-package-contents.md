# ADR-0429 — Published package contents

- Date: 2026-09-27
- Status: Accepted — operator picker (2026-09-27)
- Supersedes: ADR-0111 decision 4's rule that `@caisson-sh/cli` never ships `src` (the rest of
  ADR-0111 stands)

## Context

Before the first npm release, packing all 47 published packages showed three problems.

1. 44 packages had no `files` list, so their tarballs carried tests, compiled tests, stories,
   golden files, fixtures, `.turbo` build logs and `tsconfig.json`: 2,240 of 4,964 packed files.
2. The three packages that did have a `files` list (`audit-worm`, `cli`, `verify-pack`) left out
   `src/index.ts`, which their `bun` export condition names, so importing them under Bun failed.
3. `registry-schema`, `ui-pro` and the UI kit's components compiled to JavaScript whose relative imports had no file
   extension, which Node's ESM loader rejects. Through `registry-schema`, `create-caisson` failed
   at startup under Node, as did the Node entry points of seven other packages.

## Decision

1. Every published package declares the same `files` allowlist: `dist`, `src`, `manifest.ts`,
   `AGENTS.md` and `CHANGELOG.md`, plus `templates` and `registry-index.json` for the CLI and
   `styles` for the UI kit. Tests, stories, golden files, fixtures and snapshots are excluded from
   `dist` and `src`. Source ships because every package's `bun` export condition points at it.
   The UI kit also leaves out `dist/components`: its components are exported as source only, so
   the compiled copies are unreachable.
2. The CLI follows the same rule and ships its source. ADR-0111 kept `src` out of the CLI tarball
   to keep it small; with every `bun` condition pointing at source, that exception only broke Bun
   imports of the CLI's library entry.
3. Relative imports in package source name their file extension (`./module.ts`); the compiler
   rewrites them to `.js`. The UI kit's components are the exception: the shadcn registry copies
   their source into other projects, which may not allow extensions in imports, so they keep
   extensionless imports and never reach `dist` in the tarball.
4. The release's pack step (`tooling/scripts/publish-packages.ts`, which CI runs with `--dry-run`
   on every pull request) refuses a tarball that ships test or build files, that lacks a file its
   `exports` or `bin` names, or whose compiled JavaScript imports a relative path without an
   extension.

## Consequences

- The first published versions carry 2,606 files across the 47 tarballs, none of them tests or
  build files outside the generator's `templates/`, which keep their own tests.
- A package that adds a runtime asset outside `dist` and `src` must add it to its `files` list;
  the pack step fails if an entry point names a file that is not shipped.
- Unchanged: `@caisson-sh/agent-dev` and `@caisson-sh/local-store` import `bun:` modules and load
  only under Bun, and `@caisson-sh/ui` components ship as TypeScript source for bundlers.
- `@caisson-sh/oscal-spine` still ships its vendored NIST catalog (about 10 MB) under `src/vendor`,
  although only its tests read it.
