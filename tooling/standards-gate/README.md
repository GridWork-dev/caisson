# @stack/standards-gate

The ONE standards gate (ADR-0021/0022) — the only registry ingress. Run it: `bun run gate`
(or `stack-gate`). Exit non-zero on any error finding → fails CI, `bun run check`, and blocks
publish.

## What it enforces (executable now)

- **AGPL import boundary** (Gate 1, ADR-0010) — a non-AGPL package may not depend on an
  AGPL-licensed package. Keyed on package.json `license`.
- **Declarations** — a package that ships code must declare an SPDX `license` + a `manifest.ts`
  (ADR-0020). Scaffolds (src/.gitkeep only) are exempt until they ship code.
- **Down-only dependency boundary** (Gate 3, ADR-0003) — scaffolded; activates once modules
  carry manifests (the P5 backfill populates them).

## What runs alongside (delegated, wired by foundations)

- **Provider-SDK import boundary** (Gate 2, ADR-0011) → ESLint `no-restricted-imports` in
  `tooling/eslint-config/boundaries.js`. (Source-import-level; ESLint sees imports, the gate
  sees the package graph.)
- **Golden-file regression** → the ADR-0013 harness (this track does not redefine the runner;
  the _module_ golden-fixture shape is `tooling/testing/golden-module.ts` + ADR-0021 §golden).

## Publish flow (ADR-0021)

```
changeset → version bump → stack-gate + eslint + golden → publish → index update (+ attestation)
```

A green gate stamps the registry-index `gateAttestation`; a manual index write with no real
attestation is rejected in CI. The registry index is the generator **allowlist** — see
`registry/schema` (`assertKnownModule`).

## Schema source

The manifest + index Zod schemas are canonical in `registry/schema/` and re-exported from
`src/index.ts`. (Build note: those files import `zod` via this package's dependency — hoisted to
the workspace root by Bun.)
