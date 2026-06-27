# registry/

The **catalog** the `create-caisson` CLI + the buyer's AI agent + the docs all read (ADR-0004,
one source / many consumers). **A module enters ONLY through the `tooling/` standards gate +
golden-file harness** (ADR-0004/0021) — the publish flow is the one ingress. D9 (this track)
defines that gate + pipeline; see ADR-0020 (manifest), ADR-0021 (publish flow), ADR-0022 (lint
gates).

## index ≠ source

This directory is **not** a source mirror. Module _source_ ships as independently published,
versioned packages (changesets, ADR-0001). This directory holds the **index** — each module →
its published versions → that version's manifest + publish metadata. `create-caisson` composes by
pulling **published versions named in the index**; it never reads working-tree source.

## Contents

| Path                        | What                                                                   |
| --------------------------- | ---------------------------------------------------------------------- |
| `schema/module-manifest.ts` | The typed manifest every module declares (ADR-0020). Canonical Zod.    |
| `schema/registry-index.ts`  | The index schema + the generator **allowlist** helpers (ADR-0021).     |
| `schema/index.ts`           | Re-export barrel.                                                      |
| `SCHEMA.md`                 | Human field reference for the manifest + index.                        |
| `index.example.json`        | A valid sample index (validates against `schema/registry-index.ts`).   |
| `index.json`                | The built catalog — **CI-written only**, never hand-edited (ADR-0021). |

The schema is consumed + enforced by `@caisson/standards-gate` (which supplies `zod`); per-module
`manifest.ts` files import `defineModule` from here.

## The one ingress (ADR-0021)

```
changeset → version bump → STANDARDS GATE → publish → registry-index update
                              ├ boundary lint (ADR-0022)
                              ├ manifest validation (ADR-0020)
                              └ golden-file regression (ADR-0013 harness)
```

The index-update step requires a green-gate **attestation**; a manual index edit with no real
attestation is rejected in CI. The index **is the allowlist** — every generation validates
caller-supplied module/edition ids against it before any path/subprocess (ADR-0021/0008).
