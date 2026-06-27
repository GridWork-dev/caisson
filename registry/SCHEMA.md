# Registry schema — field reference

Human reference for `schema/module-manifest.ts` + `schema/registry-index.ts` (canonical Zod).
Authoring + binding: ADR-0020. Publish flow + the allowlist: ADR-0021.

## Module manifest (per-module `manifest.ts` → `defineModule({...})`)

| Field          | Type                                                 | Notes                                                              |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| `id`           | `@caisson/<slug>`                                    | matches package.json `name`                                        |
| `version`      | semver                                               | mirrors package.json; independently versioned (ADR-0003)           |
| `kind`         | `base` \| `edition` \| `primitive` \| `app-template` | drives the down-only gate (ADR-0022)                               |
| `editions`     | edition[]                                            | membership; `[]` for pure base; an edition names itself            |
| `tier`         | `oss` \| `paid`                                      | commerce lever — distinct from `license`                           |
| `priceCents`   | int \| null                                          | integer minor units (ADR-0007); `null` for oss; `paid` ⇒ positive  |
| `license`      | SPDX (allowlist)                                     | mirrors package.json; drives the AGPL gate (ADR-0022/0010)         |
| `dependencies` | `@caisson/<slug>`[]                                  | workspace deps; **down-only** (ADR-0003)                           |
| `entry`        | path                                                 | default `src/index.ts`                                             |
| `agents`       | path                                                 | the module's **AGENTS.md** (agent-facing; distinct from README)    |
| `golden`       | path \| null                                         | golden-fixture dir; `null` until the module has golden-able output |
| `stability`    | `alpha` \| `beta` \| `stable`                        | —                                                                  |
| `description`  | string                                               | one line                                                           |

Cross-field rules (Zod `.refine`): oss ⇒ `priceCents` null; paid ⇒ `priceCents` > 0; `edition` kind
⇒ `editions` non-empty; **AGPL ⟺ local-ai membership** (both ways, ADR-0010). `license` is a curated
SPDX enum, not a free string.

## Registry index (`index.json`, CI-built)

`{ schemaVersion: 1, modules: [{ id, latest, versions: [{ version, manifest, publishedAt,
gateAttestation }] }] }`. The index is **rebuilt from the published registry by a CI-only job**,
never hand-appended (ADR-0021); `gateAttestation` (`"<ci-run-id>@<commit-sha>"`) records provenance,
it is not the access gate. Generator validation: `loadRegistryIndex(raw)` (parse-or-throw) then
`assertKnownModule(index, id)` **and** `assertKnownVersion(index, id, version)` before any
path/subprocess.
