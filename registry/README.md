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

| Path                        | What                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema/module-manifest.ts` | The typed manifest every module declares (ADR-0020). Canonical Zod.                                                                                                                                            |
| `schema/registry-index.ts`  | The index schema + the generator **allowlist** helpers (ADR-0021).                                                                                                                                             |
| `schema/index.ts`           | Re-export barrel.                                                                                                                                                                                              |
| `SCHEMA.md`                 | Human field reference for the manifest + index.                                                                                                                                                                |
| `index.example.json`        | A valid sample index (validates against `schema/registry-index.ts`).                                                                                                                                           |
| `ledger.jsonl`              | The git-tracked version ledger — the index's **sole source of truth**. A gated publish appends `{id, version, manifest, attestation, publishedAt}` (CI, P5).                                                   |
| `scripts/build-index.ts`    | The deterministic, CI-only index builder: ledger → `index.json`.                                                                                                                                               |
| `index.json`                | The built catalog — **rebuilt from the ledger by CI only**, never hand-edited (ADR-0021/0047).                                                                                                                 |
| `worker/`                   | The Cloudflare Worker read seam (ADR-0047) — typed + unit-tested, now **deployed LIVE** (caisson-registry.broken-wood-97a9.workers.dev; `deploy-entry.ts` esbuild-inlines `index.json`, ADR-0047 seam → live). |

The schema is consumed + enforced by `@caisson/standards-gate` (which supplies `zod`); per-module
`manifest.ts` files import `defineModule` from here.

## The one ingress (ADR-0021)

```
changeset → version bump → STANDARDS GATE → publish (CI) → append ledger.jsonl → rebuild index.json (CI)
                              ├ boundary lint (ADR-0022)
                              ├ manifest validation (ADR-0020)
                              └ golden-file regression (ADR-0013 harness)
```

`index.json` is **regenerated from `ledger.jsonl` by `scripts/build-index.ts`** — never hand-edited.
The CI `registry-index` job rebuilds it and fails on any drift (`git diff --exit-code`), so the file
is provably CI-built; CODEOWNERS gates both `index.json` and `ledger.jsonl`. The index **is the
allowlist** — every generation validates caller-supplied module **id + version** against it
(`loadRegistryIndex` / `loadRegistryIndexFromFile` → `assertKnownModule` / `assertKnownVersion`)
before any path/subprocess (ADR-0021/0008). Entitlement (being allowed a known module) is a separate
request-time gate (ADR-0008/P6).

## Read path (ADR-0047)

The static CI-built `index.json` is the Wave-0 read path; consumers parse it via
`loadRegistryIndexFromFile(path)` (parse-or-throw). A thin Cloudflare Worker (`worker/handler.ts` +
`worker/wrangler.toml`) fronts it for edge reads — now **deployed LIVE**
(caisson-registry.broken-wood-97a9.workers.dev; `deploy-entry.ts` esbuild-inlines `registry/index.json`
into the bundle, ADR-0047 seam → live). Entitlement filtering remains the one P6 item.
