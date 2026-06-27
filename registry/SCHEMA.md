# Registry schema — field reference

Human reference for `schema/module-manifest.ts` + `schema/registry-index.ts` (canonical Zod).
Authoring + binding: ADR-0020. Publish flow + the allowlist: ADR-0021.

## Module manifest (per-module `manifest.ts` → `defineModule({...})`)

| Field | Type | Notes |
|---|---|---|
| `id` | `@stack/<slug>` | matches package.json `name` |
| `version` | semver | mirrors package.json; independently versioned (ADR-0003) |
| `kind` | `base` \| `edition` \| `primitive` \| `app-template` | drives the down-only gate (ADR-0022) |
| `editions` | edition[] | membership; `[]` for pure base; an edition names itself |
| `tier` | `oss` \| `paid` | commerce lever — distinct from `license` |
| `priceCents` | int \| null | integer minor units, never floats (ADR-0007); `null` for oss |
| `license` | SPDX | mirrors package.json; drives the AGPL gate (ADR-0022/0010) |
| `dependencies` | `@stack/<slug>`[] | workspace deps; **down-only** (ADR-0003) |
| `entry` | path | default `src/index.ts` |
| `agents` | path | the module's **AGENTS.md** (agent-facing; distinct from README) |
| `golden` | path \| null | golden-fixture dir; `null` until the module has golden-able output |
| `stability` | `alpha` \| `beta` \| `stable` | — |
| `description` | string | one line |

Cross-field rules (Zod `.refine`): oss ⇒ `priceCents` null; `edition` kind ⇒ `editions` non-empty;
`local-ai`-edition membership ⇒ `license` matches AGPL (ADR-0010).

## Registry index (`index.json`, CI-written)

`{ schemaVersion: 1, modules: [{ id, latest, versions: [{ version, manifest, publishedAt,
gateAttestation }] }] }`. `gateAttestation` = `"<ci-run-id>@<commit-sha>"` of the green
standards-gate run that admitted the version (ADR-0021). `moduleAllowlist(index)` /
`assertKnownModule(index, id)` are the generator's pre-path/pre-subprocess validation.
