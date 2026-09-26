# Registry schema — field reference

Human reference for `schema/module-manifest.ts` + `schema/registry-index.ts` (canonical Zod).
Authoring + binding: ADR-0020. The catalog check: ADR-0021.

## Module manifest (per-module `manifest.ts` → `defineModule({...})`)

| Field          | Type                          | Notes                                                           |
| -------------- | ----------------------------- | --------------------------------------------------------------- |
| `id`           | `@caisson/<slug>`             | matches package.json `name`                                     |
| `version`      | semver                        | mirrors package.json; independently versioned (ADR-0003)        |
| `license`      | SPDX (allowlist)              | mirrors package.json; no copyleft on the allowlist (ADR-0010)   |
| `dependencies` | `@caisson/<slug>`[]           | mirrors package.json's `@caisson/*` runtime deps; **down-only** |
| `description`  | string                        | one line                                                        |
| `stability`    | `alpha` \| `beta` \| `stable` | default `alpha`                                                 |

The schema is strict: any other field is rejected. `license` is a curated SPDX enum, not a free
string.

## Registry index (`index.json`, CI-built)

`{ schemaVersion: 1, modules: [{ id, latest, versions: [{ version, manifest, publishedAt,
gateAttestation }] }] }`. The index is **rebuilt from the ledger by a CI-only job**, never
hand-appended (ADR-0021); `gateAttestation` (`"<ci-run-id>@<commit-sha>"`) records provenance, it is
not the access gate. Generator validation: `loadRegistryIndex(raw)` (parse-or-throw) then
`assertKnownModule(index, id)` **and** `assertKnownVersion(index, id, version)` before any
path/subprocess.

## Ledger lines (`ledger.jsonl`)

Two line shapes (`scripts/build-index.ts` canonical Zod):

| Line        | Shape                                      | Effect                                                                                                                                       |
| ----------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **publish** | `LedgerEntry` = `RegistryVersion` + `id`   | one publish; contributes a version to the module's index entry                                                                               |
| **delist**  | `{ op: "delist", id, delistedAt, reason }` | ADR-0271: the module contributes NO index entry from here on; publish history stays. Terminal — a later publish for the id is a ledger error |

Order rules (parse-time): a delist needs a prior publish of its id; an id delists at most once;
no publish may follow its delist.
