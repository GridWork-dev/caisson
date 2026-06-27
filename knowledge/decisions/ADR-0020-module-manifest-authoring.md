# ADR-0020 — Module manifest + authoring conventions

Status: **locked** · 2026-06-27 (D9 module-standards session; locked after 2 adversarial passes)

The D9 pipeline rests on one declaration every registry module carries. This ADR fixes that
manifest + the authoring conventions; ADR-0021 fixes the publish flow; ADR-0022 fixes the lint
gates. (Numbering: D9 owns ADR-0020..0022; the foundations track owns ADR-0013..0018 + the
error-model ADR — see the decisions board.)

## The manifest

Every module declares a **typed manifest** (`manifest.ts` exporting `defineModule({...})`,
validated by the registry Zod schema at build — `registry/schema/`) **plus an npm-native
`package.json`** (`name`, `version` semver, `license` SPDX, `dependencies`). package.json stays
the source of truth for the fields npm + changesets read; the manifest carries the richer,
registry-only declaration. They agree on `id`/`version`/`license` — **ADR-0022 Gate 4 loads the
manifest and asserts the agreement** (so the catalog can't advertise a different license than the
package ships).

Manifest fields:

- **`id`** — `@caisson/<slug>` (matches package.json `name`).
- **`version`** — semver; mirrors package.json (independently versioned, ADR-0003).
- **`kind`** — `base` | `edition` | `primitive` | `app-template`.
- **`editions`** — membership array (`compliance|ai-kit|local-ai|agent-dev`); `[]` for pure base; an `edition` kind names itself.
- **`tier`** — `oss` | `paid` (the **commerce** lever; distinct from the SPDX `license` legal lever). Model is **fully commercial** (ADR-0023): `paid` is the default for every module; `oss` is **only** the AGPL Local-first flank.
- **`priceCents`** — integer minor units, never floats (ADR-0007); `null` for `oss`; a `paid` module **must** carry a positive integer (schema-enforced).
- **`license`** — SPDX from a **curated allowlist** (free strings let "Apache 2.0"/"MITT" through): `LicenseRef-Caisson-Commercial` for every module (the proprietary EULA — fully commercial, ADR-0023), `AGPL-3.0-only` for the Local-first flank only. Mirrors package.json (drives the AGPL gate, ADR-0022/0010). **AGPL ⟺ local-ai membership** — local-ai modules must be AGPL, and only they may be (schema-enforced both ways).
- **`dependencies`** — workspace module ids; **down-only** — a base/primitive never depends "up" on an edition (ADR-0003); gate-checked.
- **`entry`** — package entry (default `src/index.ts`).
- **`agents`** — path to the module's **AGENTS.md** (the agent-facing authoring/usage contract the buyer's MCP/agent reads — distinct from the human README).
- **`golden`** — golden-fixture dir, or `null` until the module has output to fix (harness = ADR-0013; module-fixture shape = ADR-0021 §golden).
- **`stability`** — `alpha` | `beta` | `stable`.
- **`description`** — one line.

## Authoring conventions (per ADR-0002)

A module **only** counts as authored when it: extends `tooling/` (the boundary eslint config +
strict tsconfig + test harness — never per-package config, ADR-0002); validates every boundary
with Zod `.strict()`; carries no `any`/`console.log`; ships a `README.md` (human) **and**
`AGENTS.md` (agent); declares a valid SPDX `license`; and — once it has golden-able output —
carries a golden fixture **before** the logic that produces it (golden-first, ADR-0002/0021).

## Rejected

- **Ad-hoc per-package metadata** — drifts; defeats the one-standard goal.
- **package.json-only (no typed manifest)** — changesets/npm ignore custom fields, and the
  entry/golden/agents/tier richness has no typed home or build-time validation.
- **License only in the manifest** — SPDX in package.json is what license scanners + the AGPL
  gate (ADR-0022) key on; it must live there.

## Binding

A module without a valid manifest + matching SPDX `license` + `AGENTS.md` (and a golden fixture
once it has golden-able output) **cannot pass the standards gate** (ADR-0021/0022). The registry
index is built from manifests — there is no other declaration.
