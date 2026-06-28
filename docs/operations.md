# Operations & runbooks

Internal source-of-truth for contributors + the operator: how to build, release, publish,
and deploy Caisson. This file OWNS the synthesized ops map; the canonical sources stay in
`specs/` + `knowledge/decisions/`. Deploy specifics route to
[`infra/terraform/README.md`](../infra/terraform/README.md) as canonical.

Verified against the filesystem on 2026-06-28. Anything not directly checked is marked `(unverified)`.

---

## 1. Local dev

```bash
bun install                 # frozen lockfile in CI: bun install --frozen-lockfile
bun run check               # the one command: build + lint + test + standards gate
```

`bun@1.3.14` is the pinned `packageManager`. Never npm, never yarn.

**Root scripts** (`package.json`):

| Script                    | Command                                                 | Notes                                                          |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| `build`                   | `turbo run build --no-daemon`                           | tsc strict, emits `dist/**`                                    |
| `lint`                    | `turbo run lint --no-daemon`                            | `@caisson/eslint-config` (no-any, no-console, boundary rules)  |
| `test`                    | `turbo run test --no-daemon`                            | unit + PGlite integration + golden-file, in one task           |
| `eval`                    | `turbo run eval --no-daemon`                            | distinct `eval` turbo task (ADR-0062), offline cassette replay |
| `gate`                    | `bun packages/kernel/src/gate.ts`                       | the standards gate (ADR-0016/0021)                             |
| `check`                   | `turbo run build lint test --no-daemon && bun run gate` | the full local gate; mirrors CI                                |
| `format` / `format:check` | `prettier ... "**/*.{ts,tsx,js,mjs,json,md,css}"`       | `format:check` is a CI step                                    |

**Turbo is pinned `~2.5.6`** (`package.json` devDeps). Do NOT bump to 2.10.x: it
SIGBUS-crashes locally (project memory `caisson-reconcile-merged`). The `~` keeps it on the
2.5.x line. `turbo.json` defines four tasks: `build` (`dependsOn: ["^build"]`, outputs
`dist/**`), `lint`, `test`, `eval`.

**Workspaces** (`package.json`): `tooling/*`, `packages/*`, `apps/*`, `registry`,
`services/license`, `services/docs`. Note `services/support-bot` is NOT a workspace member
(it is a README-only stub, verified) and `services/docs` ships under the standards tree.

---

## 2. Build status snapshot (the honest map)

Per **ADR-0082 §3** (authoritative go-live posture), only the base substrate +
`create-caisson` are GA-built; the edition packages are classified "structure only". All
packages are `private`, version `0.0.0`, unpublished.

| Group                  | Packages                                                              | Status (verified)                                                                                          |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Base substrate (BUILT) | `kernel`, `tenancy-rls`, `field-crypto`, `auth`, `billing`, `credits` | Real src + tests; the hero fail-closed-RLS + field-crypto + `verifyChain` demos come from here             |
| Generator (BUILT)      | `cli` (`create-caisson`)                                              | src + tests present                                                                                        |
| Editions (NOT GA)      | `audit-worm`, `compliance`, `local-ai`, `ai-kit`, `agent-dev`         | Source present, but NOT shipped/GA; treat as structure per ADR-0082 §3. Do not claim they are fully built. |

> ACCURACY FLAG: ADR-0082 §3 calls the four editions "currently empty stubs". The
> filesystem disagrees -- `packages/compliance/src` has 16 non-test `.ts` + 11 tests,
> `packages/local-ai` 14 + 9, `packages/audit-worm` 7 + 6 (real exports, not placeholders).
> So the editions are "structure / partial, not GA", not literally empty. The ADR wording is
> stale vs the tree as of 2026-06-28; the binding intent (editions are not shipped, only the
> substrate is) holds. When in doubt, say "structure only, not GA".

Canonical build plan: [`plan.md`](../plan.md) (P0->P7). Edition truth-to-built rule:
[`knowledge/decisions/ADR-0082-go-live-site-posture.md`](../knowledge/decisions/ADR-0082-go-live-site-posture.md).

---

## 3. Release / changesets flow

Releases are **changesets-driven** (ADR-0001 / ADR-0069). No hand-edited version numbers.

- Config: [`.changeset/config.json`](../.changeset/config.json) -- `access: "restricted"`,
  `baseBranch: "main"`, `commit: false`. `@changesets/cli ^2.27.9` is a root devDep.
- **Per-module independent semver** (a-la-carte commerce, ADR-0003). Editions depend on base
  packages by `^` range with `updateInternalDependencies: false` -- a base **patch** does NOT
  cascade a republish through every edition (ADR-0021).
- A source change to a package requires a changeset; CI gates on `changeset status --since`
  presence. **Status: the presence gate is designed, not yet wired** -- it lands with the P5
  publish job (the `# Changeset presence is a PUBLISH-time gate` note in `ci.yml`). Pre-publish
  every package is `0.0.0`/private, so there is nothing to release-gate yet.
- No pending `.changeset/*.md` files and no root `release`/`publish` script exist today (verified).

Author a changeset locally with `bunx changeset` `(unverified -- no wrapper script; standard changesets CLI)`.

Canonical: [`knowledge/decisions/ADR-0069-publish-flow-credential-backfill.md`](../knowledge/decisions/ADR-0069-publish-flow-credential-backfill.md).

---

## 4. Registry publish flow (the one ingress)

`registry/` is the **catalog** (`registry/index.json` + `registry/ledger.jsonl`), not a source
mirror. Module source ships as independently published packages to **GitHub Packages**
(operator-locked host). `create-caisson` composes a repo from published versions named in the
index -- never from working-tree source.

**The only ingress** (ADR-0021):

```
changeset -> version bump -> STANDARDS GATE -> publish (CI-only) -> index rebuilt from ledger (CI-only)
```

- **Credential: the built-in `GITHUB_TOKEN` + `permissions: packages: write`** (ADR-0069).
  Zero new stored secret, workflow-scoped, expires with the run. No PAT, no `NODE_AUTH_TOKEN`,
  no laptop publish past the gate. Matches `@caisson:registry=npm.pkg.github.com` +
  `access: restricted` in generated repos.
- **Index is BUILT, never hand-appended.** `registry/index.json` is a byte-identical rebuild
  from `registry/ledger.jsonl`; CI is the sole writer. `.github/CODEOWNERS` (present) +
  branch protection gate hand-edits. `gateAttestation` (`"<ci-run-id>@<commit-sha>"`) records
  provenance, it is not the access gate.
- **Backfill is topological + incremental** (ADR-0069): `kernel -> base packages ->
compliance primitives -> editions -> app-templates`. Publish only what exists; each edition
  publishes as it lands. `create-caisson --edition` degrades gracefully against the
  not-yet-published set.
- **Status: the publish step is P5 and NOT yet active.** The `publish-and-index` job is
  **commented out** at the bottom of `ci.yml`. What runs today is the `registry-index` job
  (proves `index.json` is a clean rebuild from the ledger) and the `standards-gate` job. Full
  enforcement lands with the P5 publish/generator code.

Canonical: [`knowledge/decisions/ADR-0021-registry-publish-pipeline.md`](../knowledge/decisions/ADR-0021-registry-publish-pipeline.md)
· schema [`registry/SCHEMA.md`](../registry/SCHEMA.md) · read-path worker
[`knowledge/decisions/ADR-0047-registry-readpath-worker-seam.md`](../knowledge/decisions/ADR-0047-registry-readpath-worker-seam.md).

---

## 5. Deploy: `apps/site` (marketing + docs)

> Canonical deploy doc: [`infra/terraform/README.md`](../infra/terraform/README.md). This is a summary.

`apps/site` is **one Next 16 App Router app, static export** (`output: 'export'`, ADR-0084),
direct-uploaded to the existing `caisson-site` Cloudflare Pages project. **There is NO
Cloudflare-side build** -- so the Pages project carries no `build_config` and no `source` (that
is correct, not missing). `@cloudflare/next-on-pages` is NOT used (npm-deprecated/archived).

```bash
bun run --filter @caisson/site build          # next build -> apps/site/out
cd apps/site                                   # CWD must be apps/site so wrangler finds
bunx wrangler pages deploy out \               #   wrangler.jsonc AND functions/
  --project-name=caisson-site --branch=main
```

- The deploy pointer is the `out/` arg + `pages_build_output_dir: "out"` in
  [`apps/site/wrangler.jsonc`](../apps/site/wrangler.jsonc).
- Run from `apps/site/` so Cloudflare resolves `apps/site/functions/` (the waitlist Pages
  Function, ADR-0085) relative to CWD, not the output dir.
- Secrets: `CLOUDFLARE_API_TOKEN` (Account -> Cloudflare Pages -> Edit) + `CLOUDFLARE_ACCOUNT_ID`.

---

## 6. Terraform: Cloudflare DNS + Pages (`caisson.sh`)

> Canonical: [`infra/terraform/README.md`](../infra/terraform/README.md).

IaC for the `caisson.sh` zone + the Pages project. The `.sh` registration is external
(Cloudflare Registrar does not sell `.sh`); the zone is hosted on Cloudflare and this module
references it by id.

```bash
cd infra/terraform
export CLOUDFLARE_API_TOKEN=...                # Zone->DNS->Edit + Account->Pages->Edit; never commit
cp terraform.tfvars.example terraform.tfvars   # account_id + zone_id (gitignored)
terraform init && terraform plan && terraform apply
```

Creates: `cloudflare_pages_project.site` (`caisson-site`, prod branch `main`),
`cloudflare_pages_domain.{apex,www}`, `cloudflare_dns_record.{apex,www}` (proxied CNAMEs ->
`<project>.pages.dev`). State is local + gitignored; move to R2 + a lock before a second operator.

---

## 7. CI workflows

Three workflows under [`.github/workflows/`](../.github/workflows/). All Bun + Turbo,
`--frozen-lockfile`.

### `ci.yml` (push to `main` + every PR)

Required-check intent: build · lint · test(unit) · test(integration) · standards-gate ·
golden-file (ADR-0016). PGlite makes integration + golden-file hermetic, so they fold into the
`check` job rather than separate jobs.

| Job                 | Runner / Bun                                | Does                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standards-gate`    | ubuntu, bun latest                          | The sole registry ingress (ADR-0021/0022). Runs `tooling/standards-gate` pre-install (SPDX/AGPL/down-only/declarations) AND post-install (external-AGPL + manifest agreement), then `eslint .` (provider-SDK boundaries) + `depcruise` graph boundaries |
| `check`             | ubuntu, bun 1.3.14                          | `format:check` then `bunx turbo run build lint test --no-daemon --concurrency=50% && bun run gate`. `--concurrency=50%` avoids PGlite `beforeAll` starvation under fan-out (38-pkg tree, 5 Next builds)                                                 |
| `eval`              | ubuntu, bun 1.3.14                          | `bun run eval` -- regression vs committed baseline, offline cassette replay, BLESS unset (ADR-0062). Monorepo-only; never injected into a buyer repo (ADR-0072)                                                                                         |
| `native-ext`        | ubuntu + macos (matrix, `fail-fast: false`) | `bun test packages/local-store/src` -- exercises the platform-specific sqlite-vec `.so`/`.dylib`; macOS step `brew install sqlite` + `Database.setCustomSQLite`                                                                                         |
| `registry-index`    | ubuntu, bun 1.3.14                          | Registry schema/builder/worker tests, then rebuilds `registry/index.json` from the ledger and `git diff --exit-code` -- proves the index is CI-built, not hand-edited                                                                                   |
| `publish-and-index` | --                                          | **Commented out (P5)**: changesets publish (CI-only `GITHUB_TOKEN`) -> append ledger -> rebuild index. Not active yet                                                                                                                                   |

### `deploy-site.yml` (DEPLOY -- operator-gated)

- Triggers: **push to `main`** filtered to `apps/site/**`, `packages/ui/**` (bundled via
  `transpilePackages`), `infra/terraform/**`, the workflow file -- plus `workflow_dispatch`.
  **Never on a pull_request**, so opening/merging a feature PR never deploys.
- Steps: build `@caisson/site` static export -> `out/`, then (working-directory `apps/site`)
  `bunx wrangler pages deploy out --project-name=caisson-site --branch=main`.
- Least privilege: `permissions: contents: read`; uses Cloudflare secrets, not `GITHUB_TOKEN`.
  Third-party actions pinned to commit SHAs (this job holds a prod deploy token).
  `concurrency: deploy-site`, `cancel-in-progress`.

### `lighthouse.yml` (informational)

- Trigger: `pull_request` on `apps/site/**` + `packages/ui/**`.
- `continue-on-error: true`; all assertions are `warn` level (`apps/site/lighthouserc.json`).
  Non-blocking until scores stabilize (ADR-0079 §6). Builds the static export, runs
  `bunx @lhci/cli autorun`. Secret: `LHCI_GITHUB_APP_TOKEN`.

---

## 8. DEPLOY is operator-gated (never auto)

DEPLOY is a separate, explicit, operator-gated act -- it is NOT part of the autonomous
SHIP cycle. SHIP stops at the merged PR. `deploy-site.yml` enforces this in CI: it fires only
on a `main` push (post-merge) or a manual `workflow_dispatch`, never on a PR. No service
restart / redeploy happens inside the SPEC->...->SHIP loop. Doctrine:
`identity/doctrine.md` (Autonomy line + DEPLOY, gridwork-core).

---

## ADR / spec routing

| For                                           | See                                                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| CI/CD + standards gate                        | [`knowledge/decisions/ADR-0016-ci-cd-standards-gate.md`](../knowledge/decisions/ADR-0016-ci-cd-standards-gate.md)                         |
| Registry publish pipeline                     | [`knowledge/decisions/ADR-0021-registry-publish-pipeline.md`](../knowledge/decisions/ADR-0021-registry-publish-pipeline.md)               |
| Publish credential + changesets backfill      | [`knowledge/decisions/ADR-0069-publish-flow-credential-backfill.md`](../knowledge/decisions/ADR-0069-publish-flow-credential-backfill.md) |
| GTM site stack (static export -> Pages)       | [`knowledge/decisions/ADR-0084-gtm-site-stack.md`](../knowledge/decisions/ADR-0084-gtm-site-stack.md)                                     |
| Eval CI gate                                  | [`knowledge/decisions/ADR-0062-ai-kit-eval-harness-ci-gate.md`](../knowledge/decisions/ADR-0062-ai-kit-eval-harness-ci-gate.md)           |
| Buyer-repo CI boundary                        | [`knowledge/decisions/ADR-0072-buyer-repo-boundary.md`](../knowledge/decisions/ADR-0072-buyer-repo-boundary.md)                           |
| Go-live build-truth posture                   | [`knowledge/decisions/ADR-0082-go-live-site-posture.md`](../knowledge/decisions/ADR-0082-go-live-site-posture.md)                         |
| ADR renumber map (GTM 0045-0048 -> 0084-0087) | [`knowledge/decisions/ADR-0088-adr-number-collision-renumber.md`](../knowledge/decisions/ADR-0088-adr-number-collision-renumber.md)       |
| Architecture                                  | [`specs/01-architecture.md`](../specs/01-architecture.md)                                                                                 |
| Live decision board                           | [`docs/state/decisions-and-forks.md`](state/decisions-and-forks.md)                                                                       |
| Build plan (P0-P7)                            | [`plan.md`](../plan.md)                                                                                                                   |
| Deploy (canonical)                            | [`infra/terraform/README.md`](../infra/terraform/README.md)                                                                               |
