---
slug: oss-pivot
status: locked
locked_by: ADR-0428
date: 2026-09-25
tier: FULL
tags: [external-system, security, secrets, infra, data-migration, ui, frontend]
supersedes: outputs/specs/oss-launch/SPEC-oss-launch-program.md
---

# SPEC — Open-source pivot

## Goal

Caisson becomes a fully open-source, Apache-2.0 project at `github.com/GridWork-dev/caisson`. It
keeps its real (scrubbed) history, ships 48 packages installable from public npm, and serves a
static caisson.sh built for the open-source project. One person keeps it healthy in about an hour
a month, and it is announced on one coordinated launch day.

**Done means:** a stranger runs `bunx create-caisson@latest`, gets an app that builds and passes
its own tests from public npm alone, and no service Caisson runs is involved at any step.

## Why

Paddle never left sandbox and nobody has bought anything. The sales machinery (license issuer,
entitlement-gated registry, `services/license`, `apps/admin`, the cart and dashboard, six hosted
services, 23 workflows) is most of the repo's operating cost and none of its value to a user.
Open-sourcing gives the work an audience; minimal maintenance means everything left running is free
and nothing can page anyone.

## Locked (ADR-0428, 2026-09-25)

| #   | Fork           | Outcome                                                                              |
| --- | -------------- | ------------------------------------------------------------------------------------ |
| L1  | Business model | All Apache-2.0; sales stop entirely                                                  |
| L2  | History        | `git-filter-repo` rewrite of this repo, then flip it public (residual below)         |
| L3  | Hosting        | Static caisson.sh on Cloudflare Workers static assets; every other service retires   |
| L4  | Launch         | ~1 week quiet public soak, then one coordinated day                                  |
| L5  | Ownership      | Transfer `caisson-sh/caisson` to the `GridWork-dev` user account; keep the empty org |
| L6  | npm scope      | Rename in-repo to `@caisson-sh/*`; delete the mirror exporter                        |
| L7  | Docs           | ADRs stay (scrubbed); every other internal doc surface is stripped from all history  |
| L8  | Copyright      | Caisson Software LLC stays the named holder                                          |
| L9  | Community      | GitHub Discussions only; the Discord server closes                                   |

**L2 residual (accepted by the operator after the correction was put to them):** GitHub keeps each
pull request's original commits under read-only `refs/pull/*`. After the flip, all 490 PRs still
serve their pre-rewrite diffs, bodies and review threads. The rewrite gives a clean clone, file
browser and blame; it hides nothing. So **every credential that ever appeared in any commit is
revoked before the flip** (§Revocation), and no secret's safety relies on the rewrite.

## Same-day locks (ADR-0428 L10–L13)

- **L10 site:** keep the current design. Remove Compare, Stack fit, Plans, Glossary, sign-in,
  the dashboard portal and the cart. Marketplace becomes a demonstration gallery (modules + live
  demos, no prices, no buying). Evidence pack stays under Resources. All copy is reframed for
  the open-source model.
- **L11 demos:** `apps/demos` stays as the marketplace's demo engine, converted to a static
  export served by the same Worker under `/demos`.
- **L12:** every teardown and revocation batch is pre-approved; Cloudflare work runs through the
  CLI/API.
- **L13:** a private `GridWork-dev/caisson-archive` receives every branch, tag and PR head
  before any deletion lands.

## Defaults taken (conventional; override any of them by saying so)

- Only `main` is published. Every other branch and ref is deleted (including `refs/rpr/*` and
  `refs/claude/checkpoint-*`). The 27 old tags and 13 GitHub Releases are deleted; OSS versioning
  starts fresh with the first public publish.
- Author identities are left as committed; a root `.mailmap` folds the five display-name variants
  of `admin@gridwork.dev` into one. `Claude-Session:` trailer lines (dead links to the public, on
  828 commits) are removed from messages; `Co-Authored-By:` stays.
- Analytics: Cloudflare Web Analytics (free, cookieless). PostHog and Plausible retire.
- Contributions: Apache-2.0 §5 inbound=outbound, no CLA, no DCO bot. Contributor Covenant 3.0.
- No stale bot at launch; add label-only `actions/stale` only if triage load demands it.
- GitHub Issues is the public tracker. The Linear `Caisson` team tracks this program, then is
  archived after launch.
- The Cloudflare zone stays, trimmed to apex/www → Worker, mail (MX/SPF/DKIM/DMARC), and CAA.
  `infra/` leaves the tree once the teardown has been applied from it.

## Target state

### Repository

- `GridWork-dev/caisson`, public, default branch `main`, root `LICENSE` (Apache-2.0) + `NOTICE`
  ("Copyright 2026 Caisson Software LLC"), `.mailmap`.
- Tree: `packages/` (48), `apps/site` (static), `tooling/` (lint policy, tsconfig, testing, a
  trimmed standards gate), `scripts/gen-shadcn-registry.ts`, `specs/`, `knowledge/decisions/`
  (scrubbed, append-only, next number 0429), public `docs/` (architecture, engineering, design,
  glossary, packages, product, security-model, releases), `.github/`, `apps/demos` (static).
- Community files: `README.md` (rewritten for OSS), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `.github/ISSUE_TEMPLATE/` (bug + docs forms; `config.yml` sends questions and
  ideas to Discussions, blank issues off), `pull_request_template.md`, `CODEOWNERS`.
- `CLAUDE.md` / `AGENTS.md`: rewritten as a short public contributor and agent guide (commands,
  engineering invariants). Operator-private process rules move to the operator's private memory.
- Gone from the tree: `services/` (all five), `apps/admin`, `registry/` + Worker, `deploy/`,
  `infra/`, `scripts/export-public-mirror.ts` + `mirror-assets/`,
  `tooling/scripts/sot-check.ts`, `graphify-out/`, `orca.yaml`, `.gridwork/`, `.agents/`, and 17
  of 23 workflows. (Their history stays; only the paths below are stripped from history.)

### Packages and distribution

- **Deleted (10):** `license-issue`, `license-verify`, `pricebook`, `platform-reads`,
  `platform-migrations`, and the five manifest-only bundle wrappers `ai-production`,
  `local-first`, `agentic-dev`, `provenance`, `everything`.
- **Reworked:** `registry-schema` loses the entitlement engine and commerce manifest fields
  (manifests shrink to `{id, version, license, dependencies, description, stability}`); `cli`
  loses `--edition`/`--sample`/`--demo`, `meter.ts`, the license-token `.npmrc`, and resolves
  modules from public npm; `mcp-server` loses Bearer entitlement gating and credit debit;
  `compliance` keeps its evidence code without the bundle wrapper; `billing-orchestration` keeps
  its drivers without Caisson prices.
- **All 48 remaining packages:** `license: "Apache-2.0"`, public npm `publishConfig`, name
  `@caisson-sh/<name>`, LICENSE file naming Caisson Software LLC. `brand` stays private
  (unpublished).
- **Releases:** changesets. Pushes to `main` make `changesets/action` open or update a "Version
  packages" PR; merging it publishes through npm trusted publishing (OIDC, automatic provenance).
  The only token ever used is a short-lived granular token for the one-time bootstrap publish
  (trusted publishing can only be configured on a package that already exists), revoked the same
  day.
- The ui shadcn source registry (`registry.json`) is generated at the main repo root:
  `bunx shadcn@latest add GridWork-dev/caisson/<item>`.

### Site (caisson.sh)

- Next 16 `output: "export"` + Fumadocs static + Orama static search, deployed by `wrangler` to
  Cloudflare Workers static assets on pushes to `main` that touch `apps/site`.
- Security headers (HSTS, `nosniff`, `X-Frame-Options: DENY`, CSP without Paddle, Turnstile or
  PostHog) move to `apps/site/public/_headers`; redirects to `_redirects`.
- The current design stays (L10). Keeps: home, module-family pages, marketplace as a
  demonstration gallery (module pages + live demos, no prices), docs (45 MDX, commerce
  stripped), evidence pack, updates, security, trust, UI showcase, writing (+ launch post),
  frameworks, privacy + terms (Paddle removed), llms.txt/llms-full.txt, sitemap, robots, OG
  images. `/demos/*` is served from `apps/demos`' static export in the same Worker.
- Removes: compare, stack-fit, marketplace plans, glossary, cart, dashboard, login/reset,
  affiliates, procurement, EULA/license/refunds, `proxy.ts`, and every `app/api/*` route except
  the static search index. Every price, "buy" and license-key reference goes.

### Running infrastructure — the entire list

| Surface                                                                                                                                            | Cost | What could page                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------- |
| Cloudflare zone `caisson.sh` + one Worker (static assets)                                                                                          | $0   | nothing (no origin, no compute) |
| GitHub repo: Actions on free hosted runners, CodeQL default setup, secret scanning + push protection, private vulnerability reporting, Discussions | $0   | security advisories only        |
| npm org `caisson-sh`                                                                                                                               | $0   | nothing                         |

Everything else is deleted, with a receipt per resource (PLAN W4).

### CI (four workflows, `ubuntu-latest` only)

- `ci.yml` — PR + `main`: install, trimmed standards gate, build, lint, typecheck, test.
- `security.yml` — PR + weekly: the deterministic floor (semgrep OSS rules, osv-scanner,
  trufflehog verified, zizmor).
- `release.yml` — `main`: `changesets/action` version PR, then trusted publish.
- `site.yml` — `main`, path-filtered: static build + `wrangler deploy` (one secret: a Cloudflare
  token scoped to that one Worker).

No self-hosted or third-party runners and no repo variable that selects a runner. No
`pull_request_target` and no `issue_comment` triggers. Outside-contributor workflow runs require
approval.

### Maintenance model — what "low" means

- Renovate, self-contained config (no `gridwork-core` preset): monthly schedule, every non-major
  update grouped into one PR and branch-automerged on green, `minimumReleaseAge` 7 days, majors
  held on the Dependency Dashboard, monthly lockfile maintenance.
- Private vulnerability reporting on, with the maintainer subscribed to its notifications (off by
  default). `SECURITY.md` promises best-effort triage and 90-day coordinated disclosure.
- The README's "Maintenance" section states the honest posture: best-effort, no SLA.
- **Monthly ritual, about an hour:** merge the Renovate PR if it didn't automerge, merge the
  Version PR if anything is pending, skim Discussions and issues. Nothing else is scheduled.

## Scrub model (L2 mechanics)

1. **Archive first (L13).** Every branch, tag and PR head of the untouched original goes to a new
   private `GridWork-dev/caisson-archive` before W1 deletes anything; flip day pushes the final
   pre-rewrite `main` again. Nothing internal is lost; it just leaves the public repo.
2. **Rewrite** a fresh mirror clone with `git-filter-repo`:
   - `--invert-paths --paths-from-file strip-paths.txt`: `outputs/`, `docs/{state,business,gtm,
ops,archive}/`, `docs/deploy/`, `docs/build-state.md`, `docs/compliance/
control-traceability.md`, `docs/security/{pentest-runbook,tooling-playbook,
paid-tooling-roi,strix-*}.md`, `.agents/`, `.gridwork/`, `.greptile/`, `.claude/`,
     `tools/strix/`, `graphify-out/`, the root-level early planning files and screenshots
     (`DESIGN.md`, `PRODUCT.md`, `RUN-NOTES.md`, `SUMMARY.md`, `plan.md`, four `*.png`), and the
     two real production-signed license tokens
     (`packages/license-verify/src/__golden__/prod-signed-token.json`,
     `apps/local-ai/app/demo/pipeline.ts`).
   - `--replace-text`: local home paths, the CI host name and tailnet IPs, personal names in
     prose. The exact list is built by census in PLAN W5, not by hand.
   - `--replace-message`: drop `Claude-Session:` trailer lines.
3. **Gates on the rewritten clone, all green before any push:**
   - gitleaks + trufflehog over every commit: zero findings outside a reviewed fixture allowlist.
     Mutation arm: plant a known token in a scratch commit and the scan reds.
   - Path census: `git log --all --name-only` ∩ strip list = ∅. Mutation arm: re-add one stripped
     path and the census reds.
   - String census: every `--replace-text` pattern counts zero across all blobs.
   - Tree parity: the rewritten HEAD tree equals the original HEAD tree minus stripped paths
     (`git diff --stat` shows only deletions of listed paths).
   - `bun install --frozen-lockfile && bun run check` green at the rewritten HEAD.
4. **GitHub cleanup before the push:** delete all workflow runs (6,160, which also removes the
   2,197 artifacts), caches, releases, the three environments, every secret and variable,
   webhooks and deploy keys; leave zero open PRs.
5. **Push:** delete every non-`main` branch and tag on GitHub → lift branch protection → force-push
   the rewritten `main` → reapply protection. The 490 `refs/pull/*` refs are read-only and keep
   their original commits (the L2 residual).

## Revocation (before the flip, receipt per credential)

Every credential class ever present in any commit or in the repo's secrets is revoked or
rotated. That covers all 13 Actions secrets, all Railway/Cloud Run service env vars, the six
per-service OpenRouter keys, Paddle sandbox keys, the Discord bot token, Resend, Neon URLs, R2
keys, the license signing key, session HMAC keys, `MIRROR_PUSH_TOKEN`, and the Railway- and
Cloudflare-token-shaped strings that trufflehog flagged unverified in files tracked at HEAD.
Services torn down in W4 take most of these with them; the Cloudflare credentials that remain in
use are rotated.

## Launch (L4)

- **Soak (~7 days after the flip):** repo public, npm live, site live, no announcement.
  Awesome-list PRs, clean-room install verification, fixes for first-contact papercuts.
- **Launch day (weekday, 8–9am ET):** Show HN is the anchor. The operator writes the post and
  first comment personally (HN asks for human-written text), naming one honest limitation. Same
  day: the launch post on caisson.sh/writing, an X thread, r/typescript and r/node. Staggered
  with rewritten posts: r/selfhosted and r/SideProject. Days 2–4: newsletters (TLDR, JavaScript
  Weekly, Node Weekly, Bytes). Block 3–4 hours to reply.
- The hook: a finished, commercially built compliance substrate (fail-closed Postgres RLS, WORM
  audit chain, field encryption, SOC 2/HIPAA/EU AI Act evidence, metered AI gateway, local-first
  sync) that was about to be sold and is now fully open instead.
- Grounds: `outputs/research/oss-launch-gtm-2026-07-10.md` (re-dated in W6).

## Exit criteria

1. `GridWork-dev/caisson` is public; `caisson-sh/caisson` redirects to it.
2. In a clean container with no checkout and no `~/.gridwork`, `bunx create-caisson@latest`
   produces an app whose own build and tests pass using public npm only.
3. gitleaks + trufflehog over the public repo's full history are clean against the reviewed
   allowlist; the strip-path census is clean; the revocation table has a receipt on every row.
4. caisson.sh is served by the Worker, has no route returning 5xx, and returns HSTS, `nosniff`
   and `X-Frame-Options`.
5. Running infrastructure matches the three-row table above; every retired resource has a
   deletion receipt.
6. Four workflows; self-contained Renovate; CodeQL, secret scanning, push protection and private
   vulnerability reporting are on.
7. Launch day ran; a post-launch note records stars, installs, issues and the HN thread.

## Non-goals

No new features, no package consolidation, no paid tier, no sponsorship tiers, no backdated
commits. Whether Caisson Software LLC dissolves, and its tax treatment, is the operator's
business decision outside this spec. If it ever dissolves, the copyright goes to its member
first.
