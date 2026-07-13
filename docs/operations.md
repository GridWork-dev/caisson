# Operations & runbooks

Internal source-of-truth for contributors + the operator: how to build, release, publish,
and deploy Caisson. This file OWNS the synthesized ops map; the canonical sources stay in
`specs/` + `knowledge/decisions/`. Deploy specifics route to
[`infra/terraform/README.md`](../infra/terraform/README.md) as canonical.

Verified against the filesystem on 2026-07-13. Anything not directly checked is marked `(unverified)`.

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

Per-package build status now lives in one place: [`docs/build-state.md`](build-state.md) -- the
per-package `src / tests / loc` table is machine-regenerated off disk truth (`ADR-0253`,
`bun run sot --update`), so it does not drift the way a hand-typed snapshot in this file would.
The 2026-06-28 posture this section used to restate ("only the base substrate + `create-caisson`
are GA-built, four editions are structure-only stubs", `ADR-0082` §3) is superseded: those four
editions dissolved into six commercial **bundles** 2026-07-06 (`ADR-0257`/`0258`, see
[`docs/glossary.md`](glossary.md) "Bundle"), several packages are now published, and every base +
carve package has real, tested code behind it. Do not restate package counts or GA status here --
read `docs/build-state.md`.

Canonical build plan: [`plan.md`](archive/plan.md) (P0->P7, archived history). Historical edition truth-to-built rule:
[`knowledge/decisions/ADR-0082-go-live-site-posture.md`](../knowledge/decisions/ADR-0082-go-live-site-posture.md)
(superseded on this view by `ADR-0257`/`0258`; still binding on the site-copy honesty question it decided).

---

## 3. Release / changesets flow

Releases are **changesets-driven** (ADR-0001 / ADR-0069). No hand-edited version numbers.

- Config: [`.changeset/config.json`](../.changeset/config.json) -- `access: "restricted"`,
  `baseBranch: "main"`, `commit: false`. `@changesets/cli ^2.27.9` is a root devDep.
- **Per-module independent semver** (a-la-carte commerce, ADR-0003). Editions depend on base
  packages by `^` range; `.changeset/config.json` sets `updateInternalDependencies: "patch"` (the
  changesets default -- a base patch DOES bump dependents' patch versions on the next release cut,
  not the `false`/no-cascade behavior this line used to describe).
- A source change to a public package requires a changeset; CI now enforces it -- `standards-gate`
  in `ci.yml` runs `bunx changeset status --since=origin/main` and fails if one's missing
  (packages are PUBLIC and versioned past `0.0.0`, not pre-publish).
- The 2026-07-06 version cut's 153 pending changesets were consumed by the 2026-07-12 version PR
  (#222: ledger append + index/tarball rows). A fresh changeset accrues per subsequent public-package
  change and is consumed at the next deliberate release act -- see `docs/state/outstanding-work.md`.

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
  no laptop publish past the gate. This is the internal CI publish credential only -- it no
  longer describes the buyer install channel (see below).
  - **Buyer-channel supersession (ADR-0223, DONE):** buyers install commercial modules from
    `registry.caisson.sh`, a real npm registry authed by the license token, not
    `npm.pkg.github.com`. The generator's emit (`packages/cli/src/generate.ts`) + the template
    `.npmrc` (`packages/cli/templates/base/.npmrc`) are flipped to point `@caisson:registry` at
    `registry.caisson.sh` with a `_authToken` line interpolating `CAISSON_LICENSE_TOKEN`. Public
    discovery goes to the `@caisson-sh/*` npmjs mirror (ADR-0222).
- **Index is BUILT, never hand-appended.** `registry/index.json` is a byte-identical rebuild
  from `registry/ledger.jsonl`; CI is the sole writer. `.github/CODEOWNERS` (present) +
  branch protection gate hand-edits. `gateAttestation` (`"<ci-run-id>@<commit-sha>"`) records
  provenance, it is not the access gate.
- **Backfill is topological + incremental** (ADR-0069): `kernel -> base packages ->
compliance primitives -> editions -> app-templates`. Publish only what exists; each edition
  publishes as it lands. `create-caisson --edition` degrades gracefully against the
  not-yet-published set.
- **Status: `publish.yml`'s `publish-and-index` job is WIRED + active but DRY-RUN by default**
  (`CAISSON_PUBLISH_DRY_RUN=true`, ADR-0069). It runs main-only, ordering enforced structurally
  (the required checks — `ci.yml`'s 4 plus `deterministic` in `security-scan.yml` — must pass
  before a merge lands on `main`, which is this job's trigger — see §7) and scaffolds the full flow without pushing packages; set the env var `=false`
  operator-side to go live. The **publishability flip** already happened incrementally per-package
  as each one shipped (`ui-pro`, the Stage-2 modules, the W1/W7 catalog carves are all published;
  see `docs/state/package-catalog.md` for the current public-vs-commercial view). Today's enforcing
  jobs are `registry-index` (proves `index.json` is a clean rebuild from the ledger) + `standards-gate`.

Canonical: [`knowledge/decisions/ADR-0021-registry-publish-pipeline.md`](../knowledge/decisions/ADR-0021-registry-publish-pipeline.md)
· schema [`registry/SCHEMA.md`](../registry/SCHEMA.md) · read-path worker
[`knowledge/decisions/ADR-0047-registry-readpath-worker-seam.md`](../knowledge/decisions/ADR-0047-registry-readpath-worker-seam.md).

---

## 5. Deploy: `apps/site` (marketing + docs + `/dashboard`)

> Canonical deploy doc: [`infra/terraform/README.md`](../infra/terraform/README.md) (DNS + Access
> only now -- see the note below; that file still needs its own Pages-era cleanup pass).

`apps/site` is **one Next 16 App Router app, `output: 'standalone'`** (Node runtime, ADR-0114,
superseding the ADR-0084 static-export plan), built + run on **Railway** (`caisson-prod` project,
service `caisson-site`) via `apps/site/Dockerfile` (`RAILWAY_DOCKERFILE_PATH` set on the Railway
service). The prior static-export -> Cloudflare Pages path (`wrangler pages deploy`,
`caisson-site` Pages project) is **retired**; the Pages project itself has been torn down.

```bash
railway up --service caisson-site --ci        # from repo root; builds via apps/site/Dockerfile
```

- `.github/workflows/deploy-railway.yml` runs the same `railway up` on every push to `main`
  touching `apps/site/**`/`packages/**`, but **stays an inert no-op today** -- the `RAILWAY_TOKEN`
  repo secret is not set, so deploys are the operator running `railway up` manually. It self-arms
  the moment that secret is added (no other change needed).
- Secrets: a Railway project token (`RAILWAY_TOKEN`), scoped to `caisson-prod`. No Cloudflare
  deploy credential is needed for the site anymore.

---

## 6. Terraform: Cloudflare DNS + Access + WAF (`caisson.sh`)

> Canonical: [`infra/terraform/README.md`](../infra/terraform/README.md) -- **that file's own prose
> still describes the retired `cloudflare_pages_project`/`cloudflare_pages_domain` resources; the
> actual `.tf` files (`main.tf`/`access.tf`/`waf.tf`) no longer declare any `cloudflare_pages_*`
> resource.** Flagged here, not fixed in this pass -- treat the `.tf` files, not that README prose,
> as ground truth until it gets its own correction.

IaC for the `caisson.sh` zone: DNS records (apex/www/license/admin/docs-api + their Railway
domain-verification TXT records), Cloudflare Access (Zero Trust) gating `admin.caisson.sh`, and
the edge WAF/rate-limit rulesets (ADR-0219). The Pages project + its DNS CNAMEs are gone -- site
traffic now resolves straight to Railway. The `.sh` registration is external (Cloudflare Registrar
does not sell `.sh`); the zone is hosted on Cloudflare and this module references it by id.

```bash
cd infra/terraform
export CLOUDFLARE_API_TOKEN=...                # Zone->DNS->Edit + Access->Edit; never commit
cp terraform.tfvars.example terraform.tfvars   # account_id + zone_id (gitignored)
terraform init && terraform plan && terraform apply
```

State is local + gitignored — deliberate today (single operator, zero CI applies, `ADR-0107`).
**Locking gap (ADR-0208 #3):** R2 silently ignores S3 conditional-write headers, so Terraform's
`use_lockfile` is a no-op there; "R2 + a lock" needs a locking posture picked consciously at
migration time (accept-no-lock on R2 · a Worker/DO lock backend · AWS S3+DynamoDB), triggered by a
second operator or a CI-driven apply. Detail:
[`infra/terraform/README.md`](../infra/terraform/README.md#state-deferred-adr-0208-3).

---

## 7. CI workflows

**Eleven workflows** under [`.github/workflows/`](../.github/workflows/): `ci.yml`, `quality.yml`,
`security-scan.yml` (Semgrep/Socket security gates, ADR-0314), `publish.yml`, `version-pr.yml`,
`release-train.yml` (the ADR-0318/0325 release train, armed 2026-07-12 — CAISSON-94; first ride
green, see `docs/deploy/STATE.md`),
`deploy-railway.yml`, `lighthouse.yml`, `mirror-sync.yml`, `aeo-probe.yml`, `support-bot.yml`.
All Bun + Turbo (except the Python-only `support-bot.yml`), `--frozen-lockfile`, bun pinned to
`1.3.14` (the `packageManager` line — no `latest` floats).

**Review gate: Greptile RETIRED 2026-07-06.** The `greptile-gate` path-scoped required check
mentioned in older revisions of this doc no longer exists — `.github/workflows/greptile-gate.yml`
and `.greptile/` are deleted (Starter-plan review-limit hit, no replacement vendor). The review
gate is now the **in-session SHIP audit lane** (`gw-code-reviewer` + `gw-security-auditor`/fable
run against the branch diff before the PR opens); see root `CLAUDE.md` §PR review gate. **Required
status checks on `main` are five: `check`, `standards-gate`, `registry-index`,
`oscal-conformance`** (in `ci.yml`, unconditional — no `paths:`) **plus `deterministic`** (the
pinned security-scan layer in `security-scan.yml`, required since the ADR-0327 scan-gate flip,
sequenced after the CAISSON-95 installer pinning). This repo has no enforced GitHub branch
protection (single-owner account — CODEOWNERS documents the intent, "required" is discipline —
enforced by `scripts/release-readiness.ts` and review practice, not a platform gate).

### CI runners — Blacksmith VM-per-job (ADR-0326, cutover 2026-07-11)

The amd64 hot path runs on **Blacksmith** (Firecracker microVM per job,
`runs-on: blacksmith-4vcpu-ubuntu-2404`) since PR #210 — one throwaway VM per job, so host
secrets are architecturally unreachable and nothing persists between jobs (caches are
network-backed `actions/cache`). The **quality macOS matrix leg stays on the Mac mini**
(`[self-hosted, gw-macos-arm64]`, $0, native because it tests macOS). **Credential-bearing
jobs stay `ubuntu-latest`** — publish, deploy-railway, mirror-sync, release-train hold prod
tokens that never ride third-party runners. Fallback when Blacksmith is down: flip the
affected job's `runs-on` to `ubuntu-latest` (one line) and re-run. The prior `caisson-amd64`
runscaler scale set on gw-ms-a2 retires at verified cutover (history: PR #51 fleet →
runscaler 2026-07-02 → Blacksmith ADR-0326; the dind host-socket liability the Codex audit
flagged dies with it).

### `ci.yml` (push to `main` + every PR) — 4 of the 5 required checks, always unconditional

Required-check intent: build · lint · test(unit) · test(integration) · standards-gate ·
golden-file (ADR-0016), plus the registry-index provenance proof and the OSCAL NIST conformance
gate. PGlite makes integration + golden-file hermetic, so they fold into the `check` job rather
than separate jobs. A `concurrency` group cancels superseded in-flight runs so the limited fleet
is not tied up on stale commits. **This file carries 4 of the 5 required status checks and
nothing else** (the fifth, `deterministic`, is the pinned security-scan layer in
`security-scan.yml` — required since the ADR-0327 scan-gate flip) — every other job that used to
live here (`eval`, `native-ext`, `token-drift`, `publish-and-index`) moved to its own workflow
file where path-filtering and main-only gating are safe (they are not required checks, so a
path-skip never blocks a PR forever).

| Job                 | Runner (timeout)                 | Does                                                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standards-gate`    | **Blacksmith** 4vcpu VM (15m)    | The sole registry ingress (ADR-0021/0022). Runs `tooling/standards-gate` pre-install (SPDX/AGPL/down-only/declarations) AND post-install (external-AGPL + manifest agreement), then `eslint .` (provider-SDK boundaries) + `depcruise` graph boundaries                         |
| `check`             | **Blacksmith** 4vcpu VM (30m)    | `format:check` then `bunx turbo run build lint test --no-daemon --concurrency=50% && bun run gate`. `--concurrency=50%` avoids PGlite `beforeAll` starvation under fan-out. The heaviest job → biggest fleet-compute win                                                        |
| `registry-index`    | **Blacksmith** 4vcpu VM (15m)    | Registry schema/builder/worker tests, then rebuilds `registry/index.json` from the ledger and `git diff --exit-code` -- proves the index is CI-built, not hand-edited                                                                                                           |
| `oscal-conformance` | **hosted** `ubuntu-latest` (15m) | NIST OSCAL v1.2.2 conformance gate (ADR-0179/0180): the JSON→XML→schema-validate round-trip via `oscal-cli` (installs a JDK + oscal-cli from Maven Central). Hosted because the fleet `check` job skips oscal-cli entirely — this is where NIST schema validation actually runs |

### `quality.yml` — the non-required quality gates

Split out of `ci.yml` precisely so they can be path-filtered without risking a required check.
**On pull requests** each job may skip when its package tree is untouched (skip = "nothing to
validate," never "merge blocked"). **On pushes to `main`, every job runs unconditionally**
(operator call, 2026-07-09) — main is the full-truth signal, so even a docs-only commit still
exercises eval, token-drift, and native-ext.

| Job             | Runner (timeout)                                                                         | Does                                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changes`       | **Blacksmith** 4vcpu VM (5m)                                                             | `dorny/paths-filter` detects which package trees changed, feeding the `if:` skip logic below                                                                                                                           |
| `eval`          | **Blacksmith** 4vcpu VM (15m)                                                            | `bun run eval` -- regression vs committed baseline, offline cassette replay, BLESS unset (ADR-0062). Monorepo-only; never injected into a buyer repo (ADR-0072)                                                        |
| `token-drift`   | **Blacksmith** 4vcpu VM (15m)                                                            | Rebuilds `packages/ui/styles/tokens.css` from the TS token objects and `git diff --exit-code` -- proves the committed sheet is a byte-identical rebuild (ADR-0101 design-quality gate #1)                              |
| `knip`          | **Blacksmith** 4vcpu VM (15m)                                                            | Unused-dep / unused-export report (`bun run knip -- --no-exit-code`) — advisory, never blocks; repo-wide, not path-filtered                                                                                            |
| `native-ext`    | linux → **Blacksmith** 4vcpu VM; macos → **fleet** `[self-hosted, gw-macos-arm64]` (20m) | `bun test packages/local-store/src` -- exercises the platform-specific sqlite-vec `.so`/`.dylib` on both OSes, `fail-fast: false`                                                                                      |
| `evidence-pack` | **Blacksmith** 4vcpu VM (15m)                                                            | Assembles the CI build-provenance evidence pack (ADR-0275) from the standards-gate + registry-index outputs into one manifest'd artifact for a security reviewer. Unconditional (no path-filter); NOT a required check |

### `version-pr.yml` + `publish.yml` — the ADR-0325 commit-addressable release pair

Both run via `release-train.yml`'s propagation legs (on a published GitHub Release) or manual
`workflow_dispatch`; the release train, armed 2026-07-12 (CAISSON-94), completed its first ride
the same day -- see `docs/deploy/STATE.md` for ride history.

**`version-pr.yml`** (operator-dispatched) is the ONLY place changesets are consumed: it runs
`changeset version`, refreshes `bun.lock`, appends the registry ledger, rebuilds `index.json`,
packs + hashes every non-private package into `registry/tarballs.json`, and opens an
automation-authored **version PR** carrying the whole release source truth as one reviewable
commit. The operator merges it (push-to-main CI proves the 5 required checks on the merge
commit), then publishes a GitHub Release whose tag targets EXACTLY that commit.

**`publish.yml`** (dispatched by the release train's leg 1, or manually, with a required `tag`
input) is the **zero-mutation** publish leg: checkout at the tag SHA, verify the tag is an
ancestor of `main`, verify ledger/sidecar/index consistency, re-pack every tarball and require
byte-equality with the recorded hashes (`bun pm pack` is byte-deterministic), then upload to R2
skipping any object that already exists (rerun-safe, never overwrite). It holds `contents: read`
only — the old `changeset version` + commit-back on the publish path was the provenance defect
ADR-0325 closed. **Buyer delivery is a self-hosted npm registry** (`registry.caisson.sh`,
ADR-0223) — the GitHub-Packages leg is retired. Guarded by `CAISSON_PUBLISH_DRY_RUN` (default
`true`) — dry-run verifies consistency at the tag and uploads nothing. Both jobs (plus the
train's `propagate` and `mirror-sync`) declare `environment: release` (ADR-0327 rider 2 —
definition-first; the free plan can't enforce protection rules on it yet).

### `mirror-sync.yml` / `aeo-probe.yml` / `support-bot.yml`

- **`mirror-sync.yml`** — snapshot-syncs the open (Apache-2.0) base into the public mirror repo
  `caisson-sh/caisson-oss` (force-pushed as one fresh commit per sync, no mirror-side history).
  No longer triggers on `push: main` — that trigger retired under the ADR-0318/0325 release
  train (mirror-sync now fires via the train's propagation leg or manual `workflow_dispatch`).
  `MIRROR_PUSH_TOKEN` is FIXED (rotated 2026-07-10 with Contents+Workflows scope; `mirror-sync`
  run 29117126038 succeeded) — the "failing since 2026-07-04" state is resolved.
- **`aeo-probe.yml`** — the monthly AI-citation probe loop (ADR-0254): runs
  `tooling/scripts/aeo-probe.ts` against 18 canonical questions × 3 OpenRouter-routed engines,
  commits the dated snapshot into `docs/gtm/aeo-citation-tracking.md`. `schedule` (1st of month) +
  `workflow_dispatch`. Self-hosted; write scope is one docs file via the ephemeral `GITHUB_TOKEN`.
- **`support-bot.yml`** — the Python gate for `services/support-bot` (uv/ruff/pyright/pytest), the
  repo's only Python surface. Path-scoped to `services/support-bot/**`; deliberately NOT one of the
  5 required checks. Runs on the same `caisson-amd64` fleet as the TS gates.

**Fleet first-run verification (done on PR#22, the wiring PR).** All `gw-linux-amd64` jobs picked
up the runner and ran (they SERIALIZE — there is one amd64 runner, one-job-then-reset, so the gate
jobs run one at a time rather than in parallel like GitHub-hosted; `eval` passed first). The
**macOS-arm64 lane dispatches fine** (checkout + `bun install` are green on it) but its runner user
has **no Homebrew extension-capable SQLite**, so `brew install sqlite` fails there — hence the macOS
`native-ext` leg was kept on GitHub-hosted `macos-latest` for now (green).

**~~Open follow-up — move the macOS `native-ext` leg onto the fleet~~ DONE (2026-07-02):** the
macos leg now runs `[self-hosted, gw-macos-arm64]` (the mini's legacy labeled runner — the macOS
lane is not a runscaler scale set yet, so the label-array form is correct there, unlike the
bare-name amd64 scale-set jobs). Homebrew's extension-capable SQLite is provisioned host-wide at
`/opt/homebrew/opt/sqlite` (verified readable by the runner user), and the workflow's sqlite step
is check-first so it never needs brew write access on the fleet box. Saves the ~10×-cost hosted
macOS minutes. Manual fallback if the mini is down: flip the leg back to `runs-on: macos-latest`
(one line).

### `deploy-railway.yml` (DEPLOY -- operator-gated)

- Triggers: **push to `main`** filtered to `apps/site/**`, `packages/**`, the workflow file --
  plus `workflow_dispatch`. **Never on a pull_request**, so opening/merging a feature PR never
  deploys.
- Steps: an arm-check gates on the `RAILWAY_TOKEN` secret (absent -> every real step SKIPS and the
  job succeeds as a no-op); when armed, installs the Railway CLI and runs
  `railway up --service caisson-site --ci` (build-on-Railway via `apps/site/Dockerfile`).
- Least privilege: `permissions: contents: read`; uses the Railway project token, not
  `GITHUB_TOKEN`. `concurrency: deploy-railway`, `cancel-in-progress: false`, `timeout-minutes: 25`.
- **Stays GitHub-hosted (not on the fleet):** a production deploy token does not belong on the
  self-hosted box; keep it on a clean hosted runner.
- Supersedes the retired static-export `deploy-site.yml` (Cloudflare Pages, `wrangler pages
deploy`), which no longer exists in `.github/workflows/`.

### `lighthouse.yml` (informational)

- Trigger: **`workflow_dispatch` only** (gated 2026-06-30, ADR-0114) -- the `pull_request` trigger
  was dropped because the audit still targets the retired static `out/` export
  (`lighthouserc.json` `staticDistDir: "out"`), which no longer exists now that `apps/site` builds
  `output: 'standalone'`. Re-arm at the Railway deploy-runbook's C.4/C.6 step: retarget
  `lighthouserc.json` at the live Railway origin (`collect.url` + `startServerCommand`), then
  restore a `pull_request`/`schedule` trigger. The file stays in place meanwhile.
- `continue-on-error: true`; all assertions are `warn` level (`apps/site/lighthouserc.json`).
  Non-blocking until scores stabilize (ADR-0079 §6). Secret: `LHCI_GITHUB_APP_TOKEN`.
  `timeout-minutes: 20`.
- **Stays GitHub-hosted (not on the fleet):** needs a headless Chrome (the fleet runner image ships
  no browser) + uploads to temporary-public-storage; moving it would require a Chrome-equipped image.

---

## 8. DEPLOY is operator-gated (never auto)

DEPLOY is a separate, explicit, operator-gated act -- it is NOT part of the autonomous
SHIP cycle. SHIP stops at the merged PR. `deploy-railway.yml` enforces this in CI: it fires only
on a `main` push (post-merge) or a manual `workflow_dispatch`, never on a PR -- and stays inert
until the operator arms it with `RAILWAY_TOKEN`. No service restart / redeploy happens inside the
SPEC->...->SHIP loop. Doctrine: `identity/doctrine.md` (Autonomy line + DEPLOY, gridwork-core).

---

## 9. Database backup + restore (Railway Postgres)

One Railway Postgres instance carries three databases: `railway` (platform), `admin_auth`
(admin better-auth — its OWN database, same instance), `postgres` (default, unused). Backup
posture (CAISSON-52, configured + proven 2026-07-11):

- **Daily volume snapshots** on the Postgres service: every 24h, 6-day retention (the max
  paired with the Daily tier on the current plan). PITR deliberately not enabled (07-11 picker);
  re-open when real commerce data raises the recovery-point bar.
- **Native snapshot restore is IN-PLACE**: it stages a volume swap on the live service (old
  volume preserved but detached at deploy). Never "test" it against production — it is the
  incident path, not a rehearsal path.
- **Rehearsed logical restore procedure** (proven 2026-07-11 — full row-count match on all
  schemas incl. `intel` + `pgboss`):
  1. Create a scratch Postgres service in the Railway project (`railway add --database postgres`).
  2. `pg_dump -Fc` the live `DATABASE_PUBLIC_URL` **and** the `admin_auth` database (same
     instance, swap the URL's path segment).
  3. **Recreate the app roles FIRST on the target** (`admin`, `admin_write`, `admin_app`, `app`)
     or every RLS `CREATE POLICY ... TO <role>` in the dump fails and the restore comes up
     without its policies (fail-closed RLS locks reads out rather than exposing data — but the
     restore is still broken). `pg_dumpall --globals-only` on the source captures them.
  4. `pg_restore --no-owner --no-acl -d <target>` per database; verify per-table row counts
     against the source before trusting it; re-grant per the migration `GRANT` set (the
     CAISSON-17/18 grantee lesson: grants target `admin_app`, not `CURRENT_USER`).
  5. Delete the scratch service when done — it holds a full production-data copy.
- Rollback for a bad `railway up` is a service-level act (redeploy the prior image), not a DB
  restore — do not reach for snapshots to undo a deploy.

---

## ADR / spec routing

| For                                                                             | See                                                                                                                                       |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| CI/CD + standards gate                                                          | [`knowledge/decisions/ADR-0016-ci-cd-standards-gate.md`](../knowledge/decisions/ADR-0016-ci-cd-standards-gate.md)                         |
| Registry publish pipeline                                                       | [`knowledge/decisions/ADR-0021-registry-publish-pipeline.md`](../knowledge/decisions/ADR-0021-registry-publish-pipeline.md)               |
| Publish credential + changesets backfill                                        | [`knowledge/decisions/ADR-0069-publish-flow-credential-backfill.md`](../knowledge/decisions/ADR-0069-publish-flow-credential-backfill.md) |
| GTM site stack (static export -> Pages, superseded by ADR-0114/0115 -> Railway) | [`knowledge/decisions/ADR-0084-gtm-site-stack.md`](../knowledge/decisions/ADR-0084-gtm-site-stack.md)                                     |
| Eval CI gate                                                                    | [`knowledge/decisions/ADR-0062-ai-kit-eval-harness-ci-gate.md`](../knowledge/decisions/ADR-0062-ai-kit-eval-harness-ci-gate.md)           |
| Buyer-repo CI boundary                                                          | [`knowledge/decisions/ADR-0072-buyer-repo-boundary.md`](../knowledge/decisions/ADR-0072-buyer-repo-boundary.md)                           |
| Go-live build-truth posture                                                     | [`knowledge/decisions/ADR-0082-go-live-site-posture.md`](../knowledge/decisions/ADR-0082-go-live-site-posture.md)                         |
| ADR renumber map (GTM 0045-0048 -> 0084-0087)                                   | [`knowledge/decisions/ADR-0088-adr-number-collision-renumber.md`](../knowledge/decisions/ADR-0088-adr-number-collision-renumber.md)       |
| Architecture                                                                    | [`specs/01-architecture.md`](../specs/01-architecture.md)                                                                                 |
| Live decision board                                                             | [`docs/state/decisions-and-forks.md`](state/decisions-and-forks.md)                                                                       |
| Build plan (P0-P7)                                                              | [`plan.md`](archive/plan.md)                                                                                                              |
| Deploy (canonical)                                                              | [`infra/terraform/README.md`](../infra/terraform/README.md)                                                                               |
