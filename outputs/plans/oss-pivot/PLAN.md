---
slug: oss-pivot
spec: outputs/specs/oss-pivot/SPEC.md
adr: knowledge/decisions/ADR-0428-open-source-pivot.md
date: 2026-09-25
tier: FULL
---

# PLAN — Open-source pivot

Seven waves, dependency-ordered. W1–W3 are ordinary PRs on the still-private repo, which keeps the
org's CI runners working until the end. W4 is the external teardown. W5 is one operator-gated
sitting: archive, transfer, rewrite, flip, first publish, DNS cutover. W6–W7 are the soak and the
launch.

**Operator acts** are marked **[OP]**. Everything else is agent-drivable. Every external deletion
or rotation writes a row to the W4 receipt table (`outputs/plans/oss-pivot/RECEIPTS.md`); that
file is itself stripped at the rewrite and survives in the private archive.

---

## W1 — De-commercialize the code (4 PRs)

W0 (done before W1): the private archive repo (L13) holds every branch, tag and PR head.

PR1 and PR2 run in parallel as in-session subagents in isolated worktrees (the operator handed
the launch over on 2026-09-25); PR3 starts once both have merged; PR4 runs alone.

**PR1 `feature/oss-site-strip` — the site stops selling and becomes exportable (L10/L11).**

1. Delete the commerce and auth surface under `apps/site`: `app/dashboard/**`,
   `(marketing)/{compare,stack-fit,cart,affiliates,procurement,login,forgot-password,
reset-password}`, `marketplace/(hub)/plans`, `glossary/**`, `legal/{eula,license,refunds}`,
   every `app/api/*` except `api/search`, `demos/[[...path]]` (the proxy), `healthz`, and
   `proxy.ts`. Delete the `lib/` modules that only those used: cart, pricing, `paddle-*`,
   `upgrade-quote`, `plan-owned`, `members-gate`, `byok*`, `subscription-cancel`,
   `field-crypto-kms`, `auth`, `ask-ai`, comparisons, glossary. Delete the nav cart trigger and
   account island.
2. Marketplace becomes a demonstration gallery: the hub and `modules/[slug]` keep their layout,
   lose every price, plan, cart and buy affordance, and point at docs + the live demo instead.
   Nav: the Marketplace panel drops Plans/Compare/Stack fit and every price; Resources drops
   Glossary and keeps Evidence pack.
3. Remove every import of `@caisson/{pricebook,platform-reads,platform-migrations}` from the
   site.
4. `next.config.ts`: `output: "export"`. Drop `redirects()`/`headers()` into `public/_redirects`
   and `public/_headers` (HSTS, `nosniff`, `X-Frame-Options: DENY`, CSP without Paddle,
   Turnstile or PostHog), and drop the standalone-only options.
5. Switch search to Orama static (`staticGET()` + `staticClient()`).
6. `apps/demos`: `output: "export"` with `basePath: "/demos"` and `generateStaticParams` over
   the modules; the site build copies `apps/demos/out` into `apps/site/out/demos`. The demo
   stubs lose their "commercial / watermark" language.
7. Copy stays close to today's; this PR only removes selling language and dead links. The full
   reframe is W3.
8. Verify: the site build emits `apps/site/out/` including `out/demos/`; a link check over `out/`
   finds zero internal 404s; `grep -rE 'paddle|checkout|/cart|/dashboard|\$[0-9]'
apps/site/out` finds nothing outside the search index; site and demos unit tests green.

**PR2 `chore/oss-retire-services` — the fleet and sales back office leave the tree.**

1. Delete `services/{license,docs,intel,support-bot,betterstack-adapter}`, `apps/admin`,
   `registry/worker/` plus the registry's R2/tarball/ledger publish tooling, `deploy/`, and
   `scripts/export-public-mirror.ts` + `scripts/mirror-assets/`. Keep `registry/index.json` and
   its build script while the cli and site still read them; PR3 decides their final form.
   `apps/demos` and `tooling/demo-registry` stay (L11).
2. Delete these workflows: `deploy-{railway,production,staging,worker}.yml`, `rollback.yml`,
   `publish{,-gates,-image,-scan-proof}.yml`, `mirror-sync.yml`, `r2-parity-probe.yml`,
   `release-train.yml`, `support-bot.yml`, `aeo-probe.yml`, `nist-catalog-watch.yml`,
   `regulatory-claim-watch.yml`, `pgrls-advisory.yml`, `lighthouse.yml`. Drop the `intel-eval`
   leg from `quality.yml`.
3. Trim `turbo.json`, `knip.json`, root `package.json` workspaces and scripts, and
   `tools/security` scan targets of the deleted paths.
4. Leave `infra/` in place for now; W4 applies the teardown from it, then deletes it.
5. Verify: `bun install && bun run check` green; `knip` clean;
   `rg -l 'services/(license|docs|intel)|apps/admin|registry/worker' -g '!*.md'` returns nothing.

**PR3 `feature/oss-relicense` — every package Apache-2.0, no entitlements (needs PR1 + PR2).**

1. Delete `packages/{license-issue,license-verify,pricebook,platform-reads,platform-migrations,
ai-production,local-first,agentic-dev,provenance,everything}`.
2. `registry-schema`: delete `entitlements.ts`, `bundle-vocabulary.ts` and their tests. Shrink
   `module-manifest.ts` to `{id, version, license, dependencies, description, stability}`.
3. `cli`: delete `edition-expand.ts`, `meter.ts`, the `--edition`/`--sample`/`--demo` flags and
   `CAISSON_LICENSE_TOKEN` help text, and the registry/token lines in `templates/base/npmrc`.
   Resolve modules from public npm; the allowlist becomes a plain catalog listing.
4. `mcp-server`: delete entitlement scoping (`isEntitled`, `requiredEntitlement`,
   `expandEntitlements` in `generate`, the credit-debit contract). **Keep `authenticate()` and its
   timing-safe Bearer compare**: authentication is not entitlement, and the security floor still
   requires it on any network-reachable surface. `BuyerToken` loses `entitlements[]`.
5. `compliance`: drop the bundle wrapper, keep the evidence code. `billing-orchestration`: keep
   the drivers, drop Caisson `priceCents`/`tier`.
6. Every remaining `manifest.ts`: strip `tier`, `priceCents`, `sellable`, `members`, `editions`,
   and `kind: "bundle"|"edition"`.
7. Every remaining `package.json`: `license: "Apache-2.0"`, public npm `publishConfig`. Add the
   Apache `LICENSE` file ("Copyright 2026 Caisson Software LLC") wherever it is missing. `brand`
   stays `private: true`.
8. `tooling/standards-gate`: delete `checkOpenCoreLicensing`, `OPEN_BASE_NAMES`,
   `EDITION_NAMES`, the edition branch of `checkDownOnly`, `PRICE_AUTHORITY`, the six catalog
   checks, and `entitlement-token-scan`. Add one check: every non-private package declares
   Apache-2.0 and ships a LICENSE naming Caisson Software LLC. Mutation arm: flip one package's
   license and the gate reds.
9. Changesets for every touched package.
10. Verify: `bun run check` green; standards gate green plus its mutation arm red;
    `rg -l 'LicenseRef-Caisson-Commercial|priceCents|expandEntitlements'` returns nothing.
11. SHIP audits: `gw-code-reviewer` over the diff, and `gw-security-auditor` on `mcp-server` auth
    and the cli template (tags `security`, `auth`).

**PR3b (folded into PR3 as #497, 2026-09-26):** `registry/` leaves the tree. The cli's module
catalog is derived at build time from the workspace `package.json` + `manifest.ts` files, and the
`registry-index` CI job retired with it.

**PR4 `chore/oss-scope-rename` — `@caisson/*` becomes `@caisson-sh/*` (runs alone, last in W1).**

1. Mechanical rename of package names, imports, tsconfig paths, docs, MDX, generator templates
   and tests. `registry-schema` ids follow the rename.
2. Verify: `rg '@caisson/' --glob '!CHANGELOG.md' --glob '!knowledge/**'` returns nothing (ADR
   prose keeps its historical names); `bun install && bun run check` green; `create-caisson`
   generates into a temp dir and that app's `bun run check` passes, with workspace packages linked
   through a local `file:` override.
3. As shipped (#498, 2026-09-26): released `.sql` migrations keep their bytes (the migration
   ledger checksums them), so they sit in the zero-match exclusions with the other history. The
   generated app has no `check` script; its gates are `next build`, `oxlint` and `bun test`, run
   against `bun pm pack` tarballs through `overrides` (a bare `file:` directory cannot resolve
   `workspace:*`).

## W2 — Open-source baseline (1 PR, `chore/oss-baseline`)

1. Root `LICENSE` (Apache-2.0), `NOTICE`, `.mailmap` (the five display names → one), a rewritten
   `README.md` (what it is, install, the five module families, docs link, a maintenance posture
   line, license), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 3.0, contact
   `conduct@caisson.sh`), `SECURITY.md` (private vulnerability reporting, best-effort, 90-day
   disclosure).
2. `.github/ISSUE_TEMPLATE/{bug.yml,docs.yml,config.yml}` (blank issues off; Discussions links
   for questions and ideas), `pull_request_template.md`, `CODEOWNERS` (`* @GridWork-dev`).
3. CI collapses to four workflows (SPEC §CI): `ci.yml`, `security.yml` (from
   `security-scan.yml`: weekly instead of daily, `semgrep-pro` dropped), `release.yml`
   (`changesets/action` + trusted publish; `id-token: write`; no `registry-url` on setup-node),
   and `site.yml` (lands in W3). Every `runs-on` becomes `ubuntu-latest`; the
   `vars.CI_RUNNER_LINUX` indirection goes. `version-pr.yml`, `tsc-native-dts-drift.yml` and
   what's left of `quality.yml` fold into `ci.yml` or go. No `pull_request_target`.
4. `renovate.json`: self-contained (drop the private `gridwork-core` preset). Monthly schedule,
   `group:allNonMajor`, branch automerge on green, `minimumReleaseAge: "7 days"`, majors held on
   the dashboard, monthly `lockFileMaintenance`, actions pinned to digests.
5. `CLAUDE.md` and `AGENTS.md` rewritten as a short public guide (commands; invariants: Bun,
   strict TS, Zod `.strict()`, `fetchWithTimeout`, `timingSafeEqual`, integer money, fail-closed
   RLS; the changeset rule). The operator-private rules (fork board, ADR discipline, never
   auto-decide a fork) move into the operator's private project memory before this lands.
6. Delete the internal surfaces from the tree: `docs/{state,business,gtm,ops,archive,deploy}`,
   `docs/build-state.md`, `docs/compliance/control-traceability.md`, the internal
   `docs/security/*` files, `tooling/scripts/sot-check.ts` and the `sot` script, `orca.yaml`,
   `.gridwork/`, `.agents/`, `graphify-out/`. `outputs/` stays in the tree until W5 (this
   program's own receipts live there); the rewrite removes it everywhere.
7. `knowledge/decisions/README.md`: one paragraph explaining that links to removed internal docs
   are intentionally dead, and that ADRs are append-only.
8. `specs/00-product-spec.md` and `docs/product.md`: prepend a dated OSS-pivot note rather than
   rewriting locked history.
9. Verify: `bun run check` green; `actionlint` + `zizmor` clean on `.github/`;
   `rg -l '/home/gw|gw-ms-a2' --glob '!knowledge/**' --glob '!outputs/**'` returns nothing.

**As shipped (branch `chore/oss-public-baseline`, 2026-09-26).** Items 1, 2 and 4 landed early
in #493. Beyond the list above, W2 also:

- deletes `docs/{session-logs,operations.md,adr-index.md}` (not in the SPEC's public docs set), the
  dead ops scripts (`tooling/scripts/{railway-deploy,railway-env-sync,vault-parity-check,
aeo-probe}`), the pentest MCP set, and the Docker image scan tooling (zero Dockerfiles remain).
  W5's strip-path census must add `docs/session-logs/`, `docs/operations.md`, `docs/adr-index.md`.
- folds `quality.yml`, `tsc-native-dts-drift.yml` and `version-pr.yml` into `ci.yml`/`release.yml`
  and ends `ci.yml` with one aggregate `ci` job, the single required check. `native-ext` (macOS)
  runs on `main` only; `knip` and `semgrep-pro` are dropped; zizmor now blocks.
- `release.yml` runs `changesets/action@v1.9.0` with `tooling/scripts/version-packages.ts` and
  `publish-packages.ts` (`bun pm pack` then `npm publish <tarball>` over OIDC; `workspace:` ranges
  refused). It runs only when `github.repository == 'GridWork-dev/caisson'`, and dispatches
  `ci.yml` on the version PR's branch.
- adds `repository` (the `GridWork-dev/caisson` URL + package directory) to every published
  package, pinned by a standards-gate test: npm provenance rejects a publish without it.
- switches Renovate from branch to PR automerge: a user-owned repo cannot grant the Renovate app
  a ruleset bypass, so branch automerge would stall once `main` requires PRs.

## W3 — The OSS copy reframe (1 PR, `feature/oss-site-copy`)

No design options: L10 keeps the current design.

1. **Copy reframe:** every page (home, module families, marketplace gallery, evidence, trust,
   security, updates, writing, frameworks, footer, meta/OG/llms files) is rewritten for the
   open-source model. Apache-2.0, `bunx create-caisson`, "read the code", GitHub and Discussions
   CTAs replace purchase language. `gw-gtm-copywriter` owns claims (scraped, dated, no
   superlatives).
2. Docs (45 MDX): strip bundle, price and license language, and rewrite install steps for
   `@caisson-sh/*` and public npm (after PR4). `gw-devrel-writer` drafts the launch post as an
   unpublished `writing/` entry.
3. Analytics: Cloudflare Web Analytics replaces Plausible and PostHog.
4. **Deploy path:** `apps/site/wrangler.jsonc` (`assets.directory = "out"`,
   `not_found_handling = "404-page"`); `site.yml` deploys on `main` pushes that touch
   `apps/site` or `apps/demos` via `cloudflare/wrangler-action`. The narrow Cloudflare token
   (Workers Scripts:Edit on the account) is minted through the API (L12) and stored as the repo
   secret `CLOUDFLARE_API_TOKEN`, with the account id as a variable. Until W5, the site deploys
   to its `*.workers.dev` hostname only. **Shipped early as #496 (2026-09-26):** `site.yml` runs a
   pinned `bunx wrangler@4.141.0 deploy` on Node 22 instead of `cloudflare/wrangler-action` (the
   action npm-installs inside the Bun workspace and fails on `workspace:` deps). The token is the
   account-owned `caisson-site-deploy` (Workers Scripts Write only).
5. Verify: an `impeccable`/`uiux-audit` pass on the preview; Lighthouse ≥ 0.95 perf and 1.0 a11y
   on home and one docs page; `curl -I` on the preview shows HSTS, `nosniff` and
   `X-Frame-Options`; a responsive srcdoc sweep of every route at 360/768/1280.

**W3 as shipped (2026-09-26):**

- **#500** (copy and docs reframe, Plausible removed) also fixed three bugs that caisson.sh has
  today:
  - the docs code tokens stayed on the light palette for unpinned dark-OS visitors (1.04:1
    contrast);
  - three module pages scrolled sideways at 360px;
  - the hashed chunks were served uncacheable.
- **The follow-up PR adds Cloudflare Web Analytics.** It is a hostname-gated manual snippet:
  Cloudflare accepts reports from caisson.sh alone, so it starts counting at the W5 DNS cutover.
  The PR also carries the CSP origins, the privacy-policy update and the P1-002 flake fix.
- **Measured:**
  - a11y is 1.0 on home and docs;
  - the responsive sweep (Playwright, 91 routes × 3 widths) reads zero overflow;
  - srcdoc is blind on a Next App Router page, so the sweep uses real viewports instead;
  - perf on the workers.dev deployment is 0.93 home and 0.92 docs.
- **Operator ruling 2026-09-26:** the JS-weight ("hydration diet") work that would close the gap
  to 0.95 runs after launch; it is not a launch gate.

## W4 — Teardown and revocation (main thread; external side effects)

Every batch is pre-approved (L12); the **[OP confirms]** marks below are satisfied. Order
matters: nothing that serves caisson.sh goes before the W5 DNS cutover. Each row gets a receipt:
resource, action, timestamp, and the command output that proves the deletion. Cloudflare runs
through wrangler and the API.

1. **Inventory freeze:** list what actually exists on each platform before deleting anything
   (Railway projects/services, GCP Cloud Run/Artifact Registry/WIF, Cloudflare Workers/R2/Access,
   Neon, AWS S3/KMS, Discord, PostHog, Grafana, Better Stack, Resend, Turnstile, Paddle,
   DataForSEO, OpenRouter). Reconcile against the SPEC's teardown list; anything unexpected
   stops the wave.
2. **Data safety [OP confirms]:** `pg_dump` the Neon database(s), prove the dump is of the
   subject (row counts on known tables), and store it with the private archive.
3. **Delete** (each batch **[OP confirms]**): Railway admin/license/docs/support-bot/demos
   services (the site service stays until W5); Cloud Run leftovers (never armed, verify empty);
   the registry Worker + R2 buckets `caisson-registry-{tarballs,revocations}`; the betterstack
   Worker + status page + monitors; Neon; AWS KMS keys (schedule deletion); the S3 WORM bucket
   (if Object Lock is COMPLIANCE mode, objects can't be deleted before retain-until: set lifecycle
   expiry and record the date the bucket becomes deletable); the Discord bot app (revoke the
   token), then close the server **[OP]**; the PostHog project; the Grafana stack; the Resend
   domain + DKIM record; the Turnstile widget; the DataForSEO login; Paddle (close the sandbox
   and any pending production application **[OP]**).
4. **Cloudflare (API/CLI; terraform only if its state is reachable):** remove the Access app/policy + service token,
   the WAF/rate-limit/bot rules, and the Railway `_railway-verify` TXT + CNAMEs for
   admin/license/docs-api. Keep the apex/www records until W5, plus MX/SPF/DMARC/CAA. Then delete
   `infra/` from the tree (PR `chore/oss-drop-infra`).
5. **Revocation:** revoke or rotate every credential class in SPEC §Revocation: all six
   OpenRouter keys, the Railway account/project tokens, R2 keys, `MIRROR_PUSH_TOKEN`, Semgrep,
   DataForSEO, PostHog personal keys, and every Cloudflare token except `caisson-site-deploy`
   (the narrow site token `site.yml` uses, minted in #496). Verify the trufflehog-flagged Railway/Cloudflare strings are dead
   by trying them read-only; a live one is revoked and noted.
6. **GitHub org apps:** uninstall Blacksmith, Ubicloud, Socket, Arnica and Linear-code from
   `caisson-sh`. Delete `caisson-sh/caisson-oss` **[OP confirms]**.
7. Verify: every row in `RECEIPTS.md` carries proof; the platform inventory from step 1, re-run,
   shows only the kept rows.

**GCP/Neon teardown sequence (operator ruling 2026-09-26T18:01Z, made in the lab session).** This
supersedes the earlier drift hold. The teardown runs through gridwork-infra: #73 lifts
protection, #74 deletes. Everything goes through `apply.yml`, never a targeted apply, because a
targeted apply skips the plan-at-HEAD guard. The caisson lane drives, and the operator
dispatches each apply in Manual after reading its plan.

0. Neon dumps: the `caisson-production` and `caisson-nonproduction` databases were dumped
   2026-09-25 (0 tables each; archive `db-dumps`). A live re-check on 2026-09-26 confirmed
   `user_tables=0` on every branch.
1. dev-profile deletes its guarded GCP objects and merges #80. **Done 18:05Z.**
2. Merge #73. **Done 18:18Z at `5c913fd4`.**
3. Apply each stack once, from main's plan run at that commit, in this order: nonproduction,
   production, shared, neon (`neon-apply.yml`), edge.
   - Each plan may show only #80's gridwork-dev-site removal, #73's protection flips,
     studio-site env/scaling, and edge #71. Anything else stops the sequence.
   - The expected lists are written before each dispatch.
   - After the edge apply, `curl https://gridwork.dev/` must return 200; a 503 means the origin
     secret binding dropped. Then notify dev-profile.
4. Rebase #74 onto main: #80's deleted `gridwork-dev.gwstg.dev` edge lines stay deleted.
   Re-plan, confirm the destroy counts and that caisson.sh apex routing is untouched (W5 owns
   it), re-run the Neon check, and apply in the same stack order. Then notify DulyMark, whose
   removal PR waits on it.

The workload-identity bindings that trust this repo must be gone before W5.

## W5 — Flip day (one operator-gated sitting, main thread, in this order)

Precondition: W1–W4 merged or complete; `main` CI green; zero open PRs; `RECEIPTS.md` complete.

1. **Archive refresh:** push the final pre-rewrite `main` and any new branches/tags to the W0
   archive (`GridWork-dev/caisson-archive`), then verify that the `refs/heads` + `refs/tags`
   counts from `git ls-remote` match on both sides.
2. **Rewrite** a fresh clone of `main` only (`--single-branch --no-tags`):
   - Build `strip-paths.txt` from SPEC §Scrub plus a census of historical-only paths.
   - Build `redactions.txt` by census: `rg` every blob in `git rev-list --all --objects` for local
     home paths, the CI host name, tailnet IPs and personal names outside `LICENSE`/`NOTICE`, and
     record each pattern's pre-count.
   - Run `git filter-repo --invert-paths --paths-from-file strip-paths.txt --replace-text
redactions.txt --replace-message msg-redactions.txt`.
3. **Gates** (SPEC §Scrub step 3), each with its mutation arm. Any red stops the sitting.
4. **GitHub cleanup:** delete workflow runs (paged loop until zero), caches, releases, tags,
   environments, secrets, variables, webhooks, deploy keys, and non-`main` branches. **Keep**
   the `CLOUDFLARE_API_TOKEN` secret and the `CLOUDFLARE_ACCOUNT_ID` variable: `site.yml` deploys
   with them. Verify every other list endpoint returns empty.
5. **Transfer [OP confirms]:** `caisson-sh/caisson` → `GridWork-dev`. Verify the old URL
   redirects and that `gh repo view GridWork-dev/caisson` resolves.
6. **Push [OP authorizes the force-push]:** lift branch protection → `git push --force origin
main` (the rewritten main; the step 4 cleanup already removed every other branch and tag) →
   apply a ruleset on `main`: no force-push, no deletion, PR required, `ci` (ci.yml's aggregate
   job) and `deterministic` (security.yml) required.
7. **Re-verify what GitHub serves:** fresh `git clone` from GitHub, then re-run the Step 3 gates.
8. **Flip [OP]:** `gh repo edit GridWork-dev/caisson --visibility public
--accept-visibility-change-consequences`.
9. **Turn on:** secret scanning + push protection, private vulnerability reporting (**[OP]**
   subscribe to its notifications in the UI), CodeQL default setup, Discussions (Q&A, Ideas,
   Show and tell), Actions approval required for outside collaborators, "Allow auto-merge" (Renovate
   merges its PRs through it), "Allow GitHub Actions to create and approve pull requests" (the
   version PR), description, topics and homepage.
10. **First publish [OP mints token]:** a granular npm token (publish-only, `@caisson-sh`
    packages, 1-day expiry) as the temporary secret `NPM_BOOTSTRAP_TOKEN`. The first push to the
    public `main` makes `release.yml` open the version PR for the pending changesets; merging it
    runs the publish leg, which uses the token because no package exists yet (a `workflow_dispatch`
    of `release.yml` retries a partial run; published versions are skipped). Then `npm trust
github` for every package against `release.yml` (one 2FA window covers ~50); then delete the
    secret and revoke the token. Verify every package shows on npm with a provenance badge and a
    trusted publisher.
11. **DNS cutover:** attach `caisson.sh` + `www` to the site Worker as custom domains → verify
    200 + headers on both → delete the Railway site service and the Railway project → delete the
    old apex/www records from terraform state or the dashboard. Web Analytics starts counting
    here: its loader runs only on the caisson.sh hostname.
12. **Site identity:** once the repo is public and the packages resolve for a logged-out
    visitor, set `SAME_AS` in `apps/site/lib/jsonld.ts` to `https://github.com/GridWork-dev/caisson`
    and `https://www.npmjs.com/org/caisson-sh`, and update `lib/jsonld.test.ts`. Verify each URL
    returns 200 logged out. A sameAs entry that 404s for a crawler is a broken identity claim,
    which is why this waits for the flip.
13. **Exit checks:** SPEC criteria 1–6.

## W6 — Soak (~7 days)

1. Clean-room: in a fresh container with no checkout and no `~/.gridwork`, run
   `bunx --package @caisson-sh/cli create-caisson` (the cli's bins are `caisson` and
   `create-caisson`; no bin named `cli`). The generated app's install, build and test must pass.
   Run it for each module family.
2. Awesome-list PRs (awesome-typescript, awesome-nodejs, and a compliance/self-hosted list), one
   plain line each.
3. Fix first-contact papercuts through normal PRs and changesets.
4. Launch kit (`gw-devrel-writer` drafts, operator edits): the launch post (publish it on the
   site the morning of launch), X thread, r/typescript + r/node post, rewritten r/selfhosted +
   r/SideProject posts, newsletter blurbs, and Show HN **talking points** (the operator writes the
   HN post and first comment). Re-date `outputs/research/oss-launch-gtm-2026-07-10.md` into a
   launch runbook.

## W7 — Launch day [OP]

1. Weekday, 8–9am ET: publish the launch post → submit Show HN → post the first comment within a
   minute → reply for 3–4 hours.
2. Same day: X thread, r/typescript, r/node. Days 2–4: r/selfhosted, r/SideProject, newsletters.
3. D+7: post-launch note (stars, npm installs, issues, HN rank/comments, what broke); archive the
   Linear `Caisson` team; save one durable memory.

---

## Routes

Writers work in distinct worktrees; the main thread owns every git push, PR, merge and external
effect. Model set explicitly on every dispatch; Codex lanes go through `gw dispatch` after
`gw codex limits`.

| Task                   | Capability                   | Role                                   | Lane / model    | Concurrency       | Isolation            | permission_profile | Evidence                        |
| ---------------------- | ---------------------------- | -------------------------------------- | --------------- | ----------------- | -------------------- | ------------------ | ------------------------------- |
| W1 PR1 site strip      | code_write                   | gw-typescript-pro                      | codex sol xhigh | parallel with PR2 | worktree             | workspace-write    | green `out/` build + link check |
| W1 PR2 retire services | code_write                   | gw-platform-migrator                   | codex sol xhigh | parallel with PR1 | worktree             | workspace-write    | `bun run check` + knip          |
| W1 PR3 relicense       | code_write                   | gw-typescript-pro                      | codex sol xhigh | serial            | worktree             | workspace-write    | gate + mutation arm             |
| W1 PR4 scope rename    | code_write                   | gw-platform-migrator                   | sonnet          | serial, alone     | worktree             | workspace-write    | zero-match rg + generator run   |
| W1 PR3 audits          | code_review / security_audit | gw-code-reviewer / gw-security-auditor | opus / fable    | async             | shared-read          | repo-read          | REVIEW + SECURITY on the diff   |
| W2 baseline            | code_write                   | main thread                            | opus            | serial            | main checkout branch | workspace-write    | actionlint/zizmor + check       |
| W3 copy                | writing                      | gw-gtm-copywriter / gw-devrel-writer   | sonnet          | parallel          | worktree             | workspace-write    | dated claims ledger             |
| W4 teardown            | external-system              | main thread                            | opus            | serial            | none                 | operator-confirmed | RECEIPTS.md rows                |
| W5 flip                | external-system + secrets    | main thread                            | opus            | serial            | scratch mirror clone | operator-gated     | gate outputs + re-clone verify  |
| W6 clean-room          | verify                       | gw-test-automator                      | sonnet          | serial            | container            | repo-read          | install/build/test log          |

## Risks

- **Floor pages during the scrub:** secret-scan commands and credential words in argv page the
  authority floor. The operator answers the asks; nothing is routed around the floor.
- **PR refs (L2 residual):** accepted. Revocation, not the rewrite, is the control.
- **Trusted publishing bootstrap:** the first publish needs a token. It is minted for one day, one
  scope, and revoked once `npm trust` is configured.
- **Object Lock:** the WORM bucket may outlive the program until its retention expires; its
  receipt records the deletable-after date.
- **Name retirement on transfer:** check clone and Action-use traffic before W5 step 5. Above 100
  a week retires `caisson-sh/caisson` permanently, which is harmless because the org is kept only
  for the redirect.
