# @caisson-sh/standards-gate

The Bun layer of the standards gate (ADR-0021/0022) — the SPDX/license authority. Run:
`bun run gate` (or `caisson-gate`). Exit non-zero on any error → fails CI, `bun run check`, blocks
publish. Runs alongside two other layers in CI (ADR-0022): ESLint (fast static provider-SDK
signal) + dependency-cruiser (real module graph: dynamic/transitive reach + base→edition).

## What this layer enforces

- **AGPL boundary** (Gate 1, ADR-0010) — non-AGPL package may not depend on an AGPL package, over
  **workspace `@caisson-sh/*` deps AND external npm deps** (reads each resolved dep's SPDX; external
  scan needs `node_modules` — warns + defers to CI post-install if absent).
- **Down-only** (Gate 3, ADR-0003) — base/primitive ↛ edition, edition ↛ edition. Enforced now
  (keyed on the 4 edition names; refines to manifest `kind` once modules carry manifests).
- **Declarations** — a module that ships code (src/ beyond .gitkeep, or an entry/main/exports)
  must declare an SPDX `license` + a `manifest.ts` (ADR-0020). Scaffolds are exempt.
- **Manifest ↔ package.json agreement** (Gate 4, ADR-0020) — loads each `manifest.ts`, asserts
  `id`/`version`/`license` match package.json (best-effort: warns if deps aren't installed).

## Run alongside in CI (`.github/workflows/ci.yml` `standards-gate` job)

`bun run lint:repo` (oxlint provider-SDK static) · `bun run lint:canary` · `bun tooling/standards-gate/src/dependency-graph-guard.ts`
(TypeScript-enabled graph reach + down-only with coverage floors) · golden-file regression
(ADR-0013 harness) · `changeset status`.

## Publish flow (ADR-0021)

```
changeset → version bump → gate (this + eslint + depcruise + golden) → publish (CI-only) → index rebuilt from registry (CI-only)
```

The registry index is **rebuilt from the published registry by a CI-only job**, never hand-edited;
`gateAttestation` records provenance, not access. The index is the generator **allowlist** —
`registry/schema` (`loadRegistryIndex` → `assertKnownModule` + `assertKnownVersion`).

## Schema source

The manifest + index Zod schemas are canonical in `registry/schema/`; the gate imports them
from `@caisson-sh/registry-schema` directly. (They import `zod` via this package's dependency —
hoisted to the workspace root.)
