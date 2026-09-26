# Engineering handbook

The contributor handbook for the Caisson monorepo: the coding invariants, the single
standards gate, the publish flow, the test harness, the CI required jobs, and the commit
rules - synthesized into one scannable map. This file OWNS the map; it does not own the
rules. Canonical authority stays in `CLAUDE.md` and `knowledge/decisions/` (the ADRs).
Where a row says "ADR-NNNN", that ADR is the source of truth and this file is a pointer.
On any conflict, the ADR wins.

Routing: working rules `CLAUDE.md` - concept specs `specs/00-product-spec.md` ..
`specs/04-voice-and-brand.md`.

Individual ADRs live in `knowledge/decisions/` (`ADR-NNNN-slug.md`, append-only).

## Canonical sources (where a fact lives)

| Topic                        | Canonical                                                              | This file's view         |
| ---------------------------- | ---------------------------------------------------------------------- | ------------------------ |
| Engineering invariants       | `knowledge/decisions/ADR-0002-engineering-invariants.md` + `CLAUDE.md` | invariants table below   |
| Monorepo tooling / packaging | `knowledge/decisions/ADR-0001-monorepo-tooling.md`                     | quickstart + CI table    |
| Composable base/bundle split | `knowledge/decisions/ADR-0003-composable-package-base-split.md`        | import-boundary section  |
| Standards gate / CI          | `knowledge/decisions/ADR-0016-ci-cd-standards-gate.md`                 | gate + CI sections       |
| Golden-file test harness     | `knowledge/decisions/ADR-0013-testing-golden-file-harness.md`          | testing section          |
| Manifest authoring           | `knowledge/decisions/ADR-0020-module-manifest-authoring.md`            | publish section          |
| Registry publish pipeline    | `knowledge/decisions/ADR-0021-registry-publish-pipeline.md`            | publish section          |
| Import-boundary lint gates   | `knowledge/decisions/ADR-0022-import-boundary-lint-gates.md`           | import-boundary section  |
| Error model                  | `knowledge/decisions/ADR-0019-error-model.md`                          | invariants table         |
| Open-source pivot            | `knowledge/decisions/ADR-0428-open-source-pivot.md`                    | publish + build sections |
| Architecture                 | `specs/01-architecture.md`                                             | -                        |

## Coding invariants

Every line of product code satisfies all of these. The "enforced by" column is the
machine check that fails the build - an invariant with no enforcer is a review item, not a
guarantee.

| Invariant                | Rule                                             | Enforced by                                         | Source                    |
| ------------------------ | ------------------------------------------------ | --------------------------------------------------- | ------------------------- |
| TypeScript strict        | `strict: true`, no loosening                     | `tooling/tsconfig/base.json` (every pkg extends it) | ADR-0002                  |
| Bun only                 | Bun runtime + PM; never npm/yarn                 | `packageManager: bun@1.4.2`, lockfile               | ADR-0001                  |
| Zod at boundaries        | `z.object().strict()` on every external input    | review + boundary tests                             | ADR-0002 / ADR-0019       |
| Integer money/credits    | credits + money are integer units, never floats  | review (no float math on `_units`)                  | ADR-0007                  |
| Append-only versions     | locked artifacts immutable; amend by superseding | ADR convention (`knowledge/decisions/`)             | ADR-0006                  |
| `fetchWithTimeout`       | every outbound `fetch` is timeout-wrapped        | review (no bare `fetch(`)                           | ADR-0002                  |
| `crypto.timingSafeEqual` | every secret/token compare                       | review (no `===` on secrets)                        | ADR-0002 / security floor |
| `crypto.randomUUID()`    | all IDs                                          | review                                              | ADR-0002                  |
| No `any`                 | no `any` in product code                         | oxlint (`typescript/no-explicit-any`)               | ADR-0002                  |
| No `console.log`         | no `console.log` in product code                 | oxlint (`eslint/no-console`)                        | ADR-0002                  |
| Fail-closed              | RLS denies by default; credit gate -> 402        | tenancy-rls tests + review                          | ADR-0005                  |
| Down-only deps           | a package never depends "up" on a bundle         | standards gate + dependency-cruiser                 | ADR-0003                  |

Full rationale + the security floor (timing-safe compares, shell-exec, header posture)
live in the gridwork-core security rule and `CLAUDE.md`; do not re-derive them here.

## The one standards gate

`tooling/` is the SINGLE source for lint policy, tsconfig, and the test harness. A package
ships only by conforming to it - this is the ADR-0002 "one standard" invariant, enforced by
two cooperating gates:

- **`bun run gate`** (`packages/kernel/src/gate.ts`) - asserts every active package extends
  `@caisson-sh/tsconfig` + `@caisson-sh/lint-policy` + `@caisson-sh/testing`, declares
  `build`/`lint`/`test` scripts, and is `@caisson-sh/`-scoped. Scaffold packages (no `.ts`,
  no tsconfig) are skipped until they grow code; a package with `.ts` files but no tsconfig
  is a hard violation, not a skip.
- **`tooling/standards-gate/`** (`src/cli.ts` -> `src/checks.ts`) - the SPDX/license
  authority + boundary enforcer (ADR-0021/0022). Findings of severity `error` fail the
  gate. It runs pre-publish, in CI, on every push and PR.

`tooling/` layout:

| Dir                       | Owns                                                                                                                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tooling/tsconfig/`       | `base.json` - the one strict tsconfig every package extends                                                                                                                                                                                                       |
| `tooling/lint-policy/`    | `boundary-policy.cjs` (the ONE provider-SDK / bundle-meta data source, read by both oxlint's `eslint/no-restricted-imports` rule and dependency-cruiser) + `slop-plugin.js` (loaded by oxlint via `jsPlugins`). Rule severities live in the root `.oxlintrc.json` |
| `tooling/testing/`        | shared harness: golden-file (`src/golden.ts`, BLESS) + PGlite RLS harness (`src/pg.ts`) + module golden contract (`golden-module.ts`)                                                                                                                             |
| `tooling/standards-gate/` | `checks.ts` - down-only, license/manifest declarations, manifest<->package.json agreement                                                                                                                                                                         |

**Golden-file-first for compliance logic:** a module's golden fixture is the serialized
deterministic output for a fixed input (ADR-0013 harness, ADR-0021 contract). The fixture
is committed and re-blessed only via `BLESS=1`. Compliance/evidence logic lands its golden
regression before the logic is trusted.

## Import-boundary enforcement (two layers)

The composable base/bundle rule (ADR-0003) and the provider-SDK confinement (ADR-0011) are
enforced by two independent layers, both blocking on merge, both reading the same
`tooling/lint-policy/boundary-policy.cjs` data:

| Layer                 | Tool                                  | Catches                                                                                       | Config                                                                     |
| --------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1 - fast static       | oxlint `eslint/no-restricted-imports` | obvious `import "openai"` provider-SDK reach in-editor                                        | `.oxlintrc.json`, data from `tooling/lint-policy/boundary-policy.cjs`      |
| 2 - real module graph | dependency-cruiser                    | dynamic `import()`/`require()`, transitive provider-SDK reachability, base<->bundle direction | `.dependency-cruiser.cjs` (authoritative), same `boundary-policy.cjs` data |

Provider SDKs (`openai`, `@anthropic-ai/sdk`, `@google/genai`, `@aws-sdk/client-bedrock-runtime`,
the Vercel `ai` family, ...) may be imported only by `@caisson-sh/ai-config` + `@caisson-sh/ai-kit`;
everything else routes inference through `ai-config`. Layer 2 is authoritative because a
provider-SDK denylist (Layer 1) is unwinnable by construction - new SDKs ship constantly.

## Publishing: the standards gate is the only ingress

Module source ships as independently versioned published packages via Changesets. A
package enters ONLY through the standards gate + golden-file harness. Full flow
(`.github/workflows/release.yml`, ADR-0021 as amended by the open-source pivot):

```
changeset -> merge to main
          -> release.yml: pending changesets? open/update the version PR
                           no pending changesets? publish everything not yet on npm
          -> npm trusted publishing (OIDC, provenance) - no registry token, no ledger
```

There is no separate Caisson-run registry service or index; the module catalog contract
(`@caisson-sh/registry-schema`) is a schema/validation library any consumer can build a
catalog against, and `packages/mcp-server` + `packages/cli` read a catalog built with it.
Every published version still passes the standards gate + golden-file harness before it
reaches npm.

## Testing

- **`bun test`** is the runner. Per-package `test` script; root `bun run test` fans out via
  `turbo run test`.
- **PGlite integration** - the fail-closed-RLS + integration harness (`tooling/testing/src/pg.ts`)
  runs in-process PGlite, so integration + golden-file checks are hermetic (no Docker, no
  external service). A Neon branch DB is the opt-in escape hatch via `TEST_DATABASE_URL`,
  never the default.
- **Golden-file harness** (`tooling/testing/src/golden.ts`) - compares actual output against a
  committed fixture and fails on drift. `BLESS=1 bun test` rewrites the fixtures (the only
  sanctioned update path); review the diff after blessing. CI runs with `BLESS` unset so any
  drift fails.
- **Module golden contract** (`tooling/testing/golden-module.ts`, `defineModuleGolden`) -
  a module's golden = the deterministic output for a fixed input (no clocks, randomness, or
  env), committed under the manifest `golden` dir; the gate blocks publish on a diff.
- **Eval** - a distinct `turbo eval` task (ADR-0062), offline + cassette-replayed (no live
  model call, no secret in CI), regression-vs-committed-baseline. Monorepo-only: `create-caisson`
  never emits the eval job into a generated repo (ADR-0072).

## CI required jobs

`.github/workflows/ci.yml` runs on every push to `main` and every PR. Its final `ci` job is
the one required status check: it passes only when every job below it passed, or was
skipped by its own event gate (`native-ext` and `dts-drift` are conditional).

| Job                 | Does                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `standards-gate`    | manifest/license declarations, down-only deps, oxlint import boundaries, dependency-cruiser, changeset presence             |
| `check`             | `oxfmt --check` + `turbo run build lint typecheck test` + `bun run gate` + deterministic evals + token/manifest byte checks |
| `oscal-conformance` | NIST OSCAL v1.2.2 conformance gate (ADR-0179/0180), JSON->XML->schema-validate round-trip via `oscal-cli`                   |
| `native-ext`        | the platform-specific sqlite-vec extension on Linux + macOS (main pushes only)                                              |
| `site-e2e`          | Playwright against a production build of the site                                                                           |
| `evidence-pack`     | assembles the build-provenance evidence pack (ADR-0275) for the commit                                                      |
| `dts-drift`         | declaration-emit drift when a PR bumps the pinned TypeScript compiler                                                       |

Separate workflows: `.github/workflows/security.yml` (`deterministic`: semgrep, trivy,
osv-scanner, trufflehog, zizmor — weekly + every push/PR, required alongside `ci`),
`.github/workflows/release.yml` (Changesets version PR + npm trusted publishing), and
`.github/workflows/site.yml` (deploys `caisson.sh` to Cloudflare Workers static assets on
a relevant `main` push).

## Commit conventions

Conventional commits, atomic, one logical change per commit (canonical: `CLAUDE.md`). Form:
`type(scope): subject`. Types: `feat` `fix` `chore` `docs`. The authoritative scope list
lives in `CLAUDE.md`; add a scope there first before using a new one.

## Build reality

The four legacy editions dissolved into six module families (bundles) on 2026-07-06
(`ADR-0257`/`0258`); the repo went open source under Apache-2.0 on the ADR-0428 pivot,
which also retired the hosted services (admin app, registry service, license/docs/support
services) and the Railway fleet. What remains is `packages/` (48 packages), `apps/site`
(marketing + docs + demo gallery, deployed as a static export), `apps/demos` (interactive
demos, served under `/demos`), and `tooling/` (the standards gate + shared harness). There
is no separate backend service and no buyer-facing runtime beyond the static site.

## Quickstart

| Command                                    | Does                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `bun install`                              | install (frozen lockfile in CI)                                                        |
| `bun run check`                            | `turbo build lint typecheck test` + `bun run gate` (the full local gate == CI `check`) |
| `bun run gate`                             | the standards gate alone (`packages/kernel/src/gate.ts`)                               |
| `bun test <path>`                          | run a package/dir suite                                                                |
| `BLESS=1 bun test`                         | rewrite golden fixtures (review the diff after)                                        |
| `bun run build` / `lint` / `test` / `eval` | turbo fan-outs                                                                         |
| `bun run format` / `format:check`          | oxfmt write / verify                                                                   |

Pre-merge, run `bun run check` locally; it mirrors the CI `check` job. The standards gate +
both import-boundary layers must be green before a package merges.
