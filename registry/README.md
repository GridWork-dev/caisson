# registry/

The **catalog** the `create-caisson` CLI + the MCP server + the docs all read (ADR-0004, one
source / many consumers).

## index ≠ source

This directory is **not** a source mirror. Module _source_ ships as independently published,
versioned packages (changesets, ADR-0001). This directory holds the **index** — each module →
its published versions → that version's manifest + publish metadata. `create-caisson` composes by
pulling **published versions named in the index**; it never reads working-tree source.

## Contents

| Path                                      | What                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `schema/*.ts`                             | Re-exports of the open `@caisson/registry-schema` contract (manifest + index schema).          |
| `SCHEMA.md`                               | Human field reference for the manifest + index.                                                |
| `ledger.jsonl`                            | The git-tracked version ledger — the index's **sole source of truth**.                         |
| `scripts/build-index.ts`                  | The deterministic, CI-only index builder: ledger → `index.json`.                               |
| `scripts/build-evidence-pack.ts`          | The CI build-provenance evidence pack.                                                         |
| `scripts/sync-generator-template-pins.ts` | The version-PR step that refreshes the generator template's `@caisson/*` pins.                 |
| `index.json`                              | The built catalog — **rebuilt from the ledger by CI only**, never hand-edited (ADR-0021/0047). |

## The catalog check (ADR-0021)

`index.json` is **regenerated from `ledger.jsonl` by `scripts/build-index.ts`** — never hand-edited.
The CI `registry-index` job rebuilds it and fails on any drift (`git diff --exit-code`), so the file
is provably CI-built. The index **is the catalog** — every generation validates caller-supplied
module **id + version** against it (`loadRegistryIndex` / `loadRegistryIndexFromFile` →
`assertKnownModule` / `assertKnownVersion`) before any path/subprocess (ADR-0021/0008).
