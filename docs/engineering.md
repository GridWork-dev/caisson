# Engineering handbook

The contributor handbook for the Caisson monorepo: the coding invariants, the single
standards gate, the registry publish ingress, the test harness, the CI required jobs, and
the commit rules - synthesized into one scannable map. This file OWNS the map; it does not
own the rules. Canonical authority stays in `CLAUDE.md` and `knowledge/decisions/` (the
ADRs). Where a row says "ADR-NNNN", that ADR is the source of truth and this file is a
pointer. On any conflict, the ADR wins.

Routing: working rules `CLAUDE.md` - live decision board `docs/state/decisions-and-forks.md`

- concept specs `specs/00-product-spec.md` .. `specs/04-voice-and-brand.md` - build plan
  `docs/archive/plan.md` (executed, archived) - consolidated history `docs/archive/SUMMARY.md`.

> ADR catalog: the canonical index is `docs/adr-index.md` (number -> title -> domain ->
> status -> supersession chains + the GTM renumber map). Individual ADRs live in
> `knowledge/decisions/` (`ADR-NNNN-slug.md`, append-only).

## Canonical sources (where a fact lives)

| Topic                         | Canonical                                                              | This file's view        |
| ----------------------------- | ---------------------------------------------------------------------- | ----------------------- |
| Engineering invariants        | `knowledge/decisions/ADR-0002-engineering-invariants.md` + `CLAUDE.md` | invariants table below  |
| Monorepo tooling / packaging  | `knowledge/decisions/ADR-0001-monorepo-tooling.md`                     | quickstart + CI table   |
| Composable base/edition split | `knowledge/decisions/ADR-0003-composable-package-base-split.md`        | import-boundary section |
| Standards gate / CI           | `knowledge/decisions/ADR-0016-ci-cd-standards-gate.md`                 | gate + CI sections      |
| Golden-file test harness      | `knowledge/decisions/ADR-0013-testing-golden-file-harness.md`          | testing section         |
| Manifest authoring            | `knowledge/decisions/ADR-0020-module-manifest-authoring.md`            | registry section        |
| Registry publish pipeline     | `knowledge/decisions/ADR-0021-registry-publish-pipeline.md`            | registry section        |
| Import-boundary lint gates    | `knowledge/decisions/ADR-0022-import-boundary-lint-gates.md`           | import-boundary section |
| Error model                   | `knowledge/decisions/ADR-0019-error-model.md`                          | invariants table        |
| Architecture                  | `specs/01-architecture.md`                                             | -                       |

## Coding invariants

Every line of product code satisfies all of these. The "enforced by" column is the
machine check that fails the build - an invariant with no enforcer is a review item, not a
guarantee.

| Invariant                | Rule                                                                  | Enforced by                                         | Source                    |
| ------------------------ | --------------------------------------------------------------------- | --------------------------------------------------- | ------------------------- |
| TypeScript strict        | `strict: true`, no loosening                                          | `tooling/tsconfig/base.json` (every pkg extends it) | ADR-0002                  |
| Bun only                 | Bun runtime + PM; never npm/yarn                                      | `packageManager: bun@1.4.2`, lockfile               | ADR-0001                  |
| Zod at boundaries        | `z.object().strict()` on every external input                         | review + boundary tests                             | ADR-0002 / ADR-0019       |
| Integer money/credits    | credits + money are integer units, never floats                       | review (no float math on `_units`)                  | ADR-0007                  |
| Append-only versions     | locked artifacts immutable; amend by superseding                      | ADR convention (`knowledge/decisions/`)             | ADR-0006                  |
| `fetchWithTimeout`       | every outbound `fetch` is timeout-wrapped                             | review (no bare `fetch(`)                           | ADR-0002                  |
| `crypto.timingSafeEqual` | every secret/token/license compare                                    | review (no `===` on secrets)                        | ADR-0002 / security floor |
| `crypto.randomUUID()`    | all IDs                                                               | review                                              | ADR-0002                  |
| No `any`                 | no `any` in product code                                              | oxlint (`typescript/no-explicit-any`)               | ADR-0002                  |
| No `console.log`         | no `console.log` in product code                                      | oxlint (`eslint/no-console`)                        | ADR-0002                  |
| Fail-closed              | RLS denies by default; credit gate -> 402; license check fails closed | tenancy-rls tests + review                          | ADR-0005                  |
| Down-only deps           | a package never depends "up" on an edition                            | standards gate + dependency-cruiser                 | ADR-0003                  |

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
  gate. It is the sole registry ingress.

`tooling/` layout:

| Dir                       | Owns                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tooling/tsconfig/`       | `base.json` - the one strict tsconfig every package extends                                                                                                                              |
| `tooling/lint-policy/`    | `boundary-policy.cjs` (the ONE provider-SDK / bundle-meta data source) + `slop-plugin.js` (loaded by oxlint via jsPlugins). Rule severities live in the root `.oxlintrc.json` (ADR-0408) |
| `tooling/testing/`        | shared harness: golden-file (`golden.ts`, BLESS) + PGlite RLS harness (`pg.ts`) + module golden contract (`golden-module.ts`)                                                            |
| `tooling/standards-gate/` | `checks.ts` - AGPL boundary, down-only, license/manifest declarations, manifest<->package.json agreement                                                                                 |

**Golden-file-first for compliance logic:** a module's golden fixture is the serialized
deterministic output for a fixed input (ADR-0013 harness, ADR-0021 contract). The fixture
is committed and re-blessed only via `BLESS=1`. Compliance/evidence logic lands its golden
regression before the logic is trusted.

## Import-boundary enforcement (three layers)

The composable base/edition rule (ADR-0003) and the provider-SDK confinement (ADR-0011) are
enforced by three independent layers, all blocking on merge. No single layer is sufficient -
oxlint is static-only, the gate is license/declaration-scoped, dependency-cruiser is the
authoritative module graph.

| Layer                        | Tool                                           | Catches                                                                                                                                | Config                                                                             |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1 - SPDX/license + direction | `tooling/standards-gate/src/checks.ts` (`bun`) | AGPL boundary (dormant tripwire, ADR-0050), down-only base/edition, license + manifest declarations, manifest<->package.json agreement | `tooling/standards-gate/`                                                          |
| 2 - fast static              | ESLint `no-restricted-imports`                 | obvious `import "openai"` provider-SDK reach in-editor                                                                                 | `tooling/eslint-config/boundaries.js` (denylist) wired via root `eslint.config.js` |
| 3 - real module graph        | dependency-cruiser                             | dynamic `import()`/`require()`, transitive provider-SDK reachability, base<->edition direction                                         | `.dependency-cruiser.cjs` (authoritative)                                          |

Provider SDKs (`openai`, `@anthropic-ai/sdk`, `@google/genai`, `@aws-sdk/client-bedrock-runtime`,
the Vercel `ai` family, ...) may be imported only by `@caisson-sh/ai-config` + `@caisson-sh/ai-kit`;
everything else routes inference through `ai-config`. Layer 3 is authoritative because a
provider-SDK denylist (Layer 2) is unwinnable by construction - new SDKs ship constantly.

## Registry: the sole publish ingress

`registry/` is the catalog the `create-caisson` CLI + buyer agents + docs read (one source,
many consumers). It is NOT a source mirror. Module source ships as independently versioned
published packages (changesets); `registry/index.json` maps each module -> its published
versions -> that version's manifest. A module enters ONLY through the standards gate +
golden-file harness. Full flow (ADR-0021):

```
changeset -> VERSION PR (version-pr.yml: bump + ledger append + index rebuild + tarball hashes)
          -> STANDARDS GATE + required checks green on the merge commit
          -> tag/Release on EXACTLY that commit
          -> publish (CI, zero mutation): verify tagged bytes + upload missing tarballs (ADR-0325)
                               |- boundary lint (ADR-0022)
                               |- manifest validation (ADR-0020)
                               |- golden-file regression (ADR-0013 harness)
```

`registry/ledger.jsonl` is the index's sole source of truth; `registry/index.json` is
rebuilt from it by `registry/scripts/build-index.ts` (CI only, never hand-edited). The CI
`registry-index` job re-runs the build and fails on any drift (`git diff --exit-code`), so
the index is provably CI-built. The index IS the allowlist - every generation validates a
caller's module id + version against it before any path/subprocess. Ledger append + index
rebuild + tarball hashing happen in the **version PR** (`version-pr.yml`, ADR-0325); the
publish leg (`publish-and-index` in `.github/workflows/publish.yml`, ADR-0223) checks out the
release tag, **verifies** those recorded bytes, and uploads to the self-hosted
`registry.caisson.sh` npm registry with zero source mutation — it stays **dry-run by default**
(`CAISSON_PUBLISH_DRY_RUN=true`; `docs/operations.md` §7). Publishing
is no longer all-or-nothing: several packages (base substrate, `cli`, `ui-pro`, the Stage-2
and catalog-rework carve packages) have real published versions today — see
`docs/state/package-catalog.md` for the current per-package sold-as/license view.

## Testing

- **`bun test`** is the runner. Per-package `test` script; root `bun run test` fans out via
  `turbo run test`.
- **PGlite integration** - the fail-closed-RLS + integration harness (`tooling/testing/pg.ts`)
  runs in-process PGlite, so integration + golden-file checks are hermetic (no Docker, no
  external service). A Neon branch DB is the opt-in escape hatch via `TEST_DATABASE_URL`,
  never the default.
- **Golden-file harness** (`tooling/testing/golden.ts`) - compares actual output against a
  committed fixture and fails on drift. `BLESS=1 bun test` rewrites the fixtures (the only
  sanctioned update path); review the diff after blessing. CI runs with `BLESS` unset so any
  drift fails.
- **Module golden contract** (`tooling/testing/golden-module.ts`, `defineModuleGolden`) -
  a module's golden = the deterministic output for a fixed input (no clocks, randomness, or
  env), committed under the manifest `golden` dir; the gate blocks publish on a diff.
- **Eval** - a distinct `turbo eval` task (ADR-0062), offline + cassette-replayed (no live
  model call, no secret in CI), regression-vs-committed-baseline. Monorepo-only: `create-caisson`
  never emits the eval job into a buyer repo (ADR-0072).

## CI required jobs

`.github/workflows/ci.yml` (on push to `main` + every PR) carries 4 of the 5 required status
checks and nothing else — the fifth, `deterministic`, is the pinned security-scan layer in
`security-scan.yml` (required since the ADR-0327 scan-gate flip); `eval`/`native-ext`/
`token-drift`/`knip` live in the separate `quality.yml` (non-required, path-filtered on PRs,
unconditional on `main` pushes) so a path-skip never blocks a required check forever. Full per-workflow detail (11 workflows total, the Greptile
retirement, the review-gate posture): `docs/operations.md` §7 - this section is not the canonical
CI map, do not extend it here.

| Job                 | Does                                                                                                    | Notes                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `standards-gate`    | gate run pre-install (fs-only) + post-install, then `eslint .`, then `depcruise packages apps tooling`  | the only registry ingress; all three layers block merge                                                                                         |
| `check`             | `prettier --check`, then `turbo run build lint test --concurrency=50%` + `bun run gate`                 | golden fixtures compared with BLESS unset; `--concurrency=50%` avoids PGlite hook-timeout starvation on the runner                              |
| `registry-index`    | registry tests + rebuild `index.json` from ledger, `git diff --exit-code`                               | provenance proof the index is CI-built, not hand-appended                                                                                       |
| `oscal-conformance` | NIST OSCAL v1.2.2 conformance gate (ADR-0179/0180), JSON->XML->schema-validate round-trip via oscal-cli | installs its own JDK + oscal-cli per-run; the `check` job (same Blacksmith runner class, ADR-0326) skips that install and doesn't run oscal-cli |

Separate workflows: `quality.yml` (eval/native-ext/token-drift/knip/evidence-pack),
`publish.yml` (registry publish, ADR-0223), `.github/workflows/deploy-railway.yml` (admin + site on
matching main pushes, license on dispatch; ADR-0114/0115), `lighthouse.yml`, `mirror-sync.yml`,
`aeo-probe.yml`, and `support-bot.yml`.

## Commit conventions

Conventional commits, atomic, one logical change per commit (canonical: `CLAUDE.md`). Form:
`type(scope): subject`. Types: `feat` `fix` `chore` `docs`. Scopes - infra/process:
`scaffold` `specs` `adr` `state` `kickoffs` `tooling` `kernel` `site`; per-package (once code
starts): `auth` `tenancy-rls` `billing` `credits` `ai-config` `mcp` `ui` `audit-worm`
`field-crypto` `compliance` `ai-kit` `local-ai` `agent-dev` `cli` `support-bot` `license`
`docs`. The full authoritative scope list lives in `CLAUDE.md`; add a scope there first.

## Build reality

**Superseded — read [`docs/build-state.md`](build-state.md).** The table this section used to
carry (only the base substrate + `create-caisson` "genuinely built", four editions "structure
only" per `ADR-0082` section 3, citing `packages/local-ai/src/inference/stub.ts` as evidence) is
stale on every count: `local-ai` was carved 2026-07-06 into `local-sync`/`local-inference`/
`local-privacy` (`ADR-0258` §1) and no longer has an `inference/stub.ts` file at all; editions
dissolved into six commercial bundles the same day (`ADR-0257`/`0258`); and every package once
listed as a stub now has live-transport-proven code (`ADR-0201`) with real tests. `docs/build-state.md`'s
per-package table is machine-regenerated off disk truth (`ADR-0253`) - it is the live source, this
section is not.

**Apps** (`apps/`): `site` is the marketing + docs + buyer-dashboard app (Next, standalone Node app on Railway,
ADR-0114/0115); `admin` is the operator control-plane (absorbed the design-system studio,
ADR-0140). **Services** (`services/`): `docs` `intel` `license` `support-bot`.

## Quickstart

| Command                                    | Does                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `bun install`                              | install (frozen lockfile in CI)                                              |
| `bun run check`                            | `turbo build lint test` + `bun run gate` (the full local gate == CI `check`) |
| `bun run gate`                             | the standards gate alone (`packages/kernel/src/gate.ts`)                     |
| `bun test <path>`                          | run a package/dir suite                                                      |
| `BLESS=1 bun test`                         | rewrite golden fixtures (review the diff after)                              |
| `bun run build` / `lint` / `test` / `eval` | turbo fan-outs                                                               |
| `bun run format` / `format:check`          | prettier write / verify                                                      |

Pre-merge, run `bun run check` locally; it mirrors the CI `check` job. The standards gate +
the three import-boundary layers must be green before a package merges.
