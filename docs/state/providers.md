---
updated: 2026-08-15
status: live
grounds:
  - infra/terraform/
  - apps/site/railway.toml
  - apps/admin/railway.toml
  - services/license/railway.toml
  - services/support-bot/railway.toml
---

# External providers — live ledger

The single roster of every external service Caisson pays for or depends on: role, tier, monthly
cost, and the ADR that locked it. Companion to [`decisions-and-forks.md`](decisions-and-forks.md)
(the open provider forks live there under "Provider-optimization forks"). This file is the
**current-state** truth; it locks nothing.

_Last swept 2026-07-01 (Stage-2 deploy); OpenRouter row + credential-homes updated 2026-07-08
(credential-sweep session, PR #185). Pricing verified against vendor pages by workflow
`wf_6a5ae3a3-9f5` (7 Exa-backed research agents). **Full status+cost re-verification 2026-07-12
(session Q): `outputs/research/provider-cost-rollup-2026-07-12.md` — 10 providers live-probed +
a 10-agent pricing verification; that rollup is the current cost truth.**_

## Live stack

| Provider                   | Role                                                                                                                                                                                                                                                                                                                                 | Tier / cost (2026-07-01)                                                                                                | ADR                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Railway**                | Hosting — 6 caisson services (site/admin/license/docs/support-bot/demos — demos is private-mesh only, no public domain) + managed Postgres                                                                                                                                                                                           | Pro $20/mo base + usage → **~$20-40/mo all-in**                                                                         | 0114 / 0115        |
| **Cloudflare**             | DNS + registry Worker + CF-Access gates (Pages torn down 07-01)                                                                                                                                                                                                                                                                      | Free                                                                                                                    | 0047 / 0107 / 0140 |
| **Paddle**                 | Merchant-of-Record (tax/invoicing/remittance)                                                                                                                                                                                                                                                                                        | % of revenue (revenue-contingent)                                                                                       | 0108 / 0116        |
| **Stripe**                 | Buyer billing driver (behind `BillingProvider` port)                                                                                                                                                                                                                                                                                 | % of revenue                                                                                                            | 0017 / 0116        |
| **Resend**                 | Transactional email (magic-link, billing side-effects)                                                                                                                                                                                                                                                                               | Free tier (3k/mo, 100/day)                                                                                              | 0018 / 0132        |
| **Trigger.dev**            | Background jobs (billing/credit side-effects, self-hostable)                                                                                                                                                                                                                                                                         | Free tier ($5 compute/mo)                                                                                               | 0018               |
| **OpenRouter**             | LLM inference — split into **six per-service named keys** 2026-07-08 (`gw-box` · `caisson-docs` · `caisson-support-bot` · `caisson-site-ask` · `caisson-intel` · `caisson-aeo-probe`); per-key credit limits explicitly **waived by the operator** (attribution, not caps, was the goal)                                             | Usage (pre-launch ~$0)                                                                                                  | 0105               |
| **registry.caisson.sh**    | Private registry for commercial `@caisson/*` modules — self-hosted CF Worker npm install protocol, R2 tarball sink; supersedes GitHub Packages                                                                                                                                                                                       | R2 usage (~$0 at launch volume)                                                                                         | 0021 super. 0223   |
| **Plausible**              | Web analytics — **cookieless** marketing (no consent banner)                                                                                                                                                                                                                                                                         | $9/mo Starter (no free hosted tier)                                                                                     | 0118 (0086)        |
| **Grafana Cloud**          | Observability — **sole OTLP sink** (traces/metrics/logs), US-West · cutover DONE                                                                                                                                                                                                                                                     | **Free tier ($0)** — 50GB logs + 50GB traces, 14-day                                                                    | 0177 (0117 super.) |
| ~~**SigNoz** (self-host)~~ | Observability — **REMOVED 2026-07-01** (5 services deleted; replaced by Grafana Cloud)                                                                                                                                                                                                                                               | ~~$45-70/mo~~ → **$0**                                                                                                  | 0117 → 0177        |
| ~~**Greptile + TREX**~~    | AI code review — **RETIRED 2026-07-06** (Starter monthly limit hit mid-PR-#128; vendor dropped, no replacement — review = the in-session SHIP audit lane, CLAUDE.md §PR review gate)                                                                                                                                                 | ~~Free Starter~~ → **$0**                                                                                               | — (not ADR-locked) |
| **Discord**                | Community + support-bot channel + buyer OAuth sign-in + entitlement role push                                                                                                                                                                                                                                                        | Free                                                                                                                    | 0105 / 0109 / 0203 |
| **Better Stack**           | External uptime leg — 4 monitors: caisson.sh (2xx) + license.caisson.sh/health (200) + docs-RAG (4676344) + module registry (4677314), all on the public status page status.caisson.sh (id 255425, custom domain live 2026-07-15); plus a paused gridwork-era `wardfile` leftover (delete = open fork PF2-3), email alerts to admin@ | Free (10 monitors, ≤30s checks; first paid $25/mo)                                                                      | — (CAISSON-53)     |
| **Blacksmith**             | CI runners — the hot path runs VM-per-job Firecracker runners (`blacksmith-4vcpu-ubuntu-2404`); credential jobs stay GitHub-hosted, mac leg self-hosted                                                                                                                                                                              | Free 3,000 2vCPU-min/mo (~1,500 effective 4vCPU-min); $0.008/min beyond — **likely at/over free tier, open fork PF2-1** | 0326               |
| **Linear**                 | Issue tracking + triage automations (Business tier live 2026-07-11) — also the support-bot's third escalation sink                                                                                                                                                                                                                   | **$16/user/mo billed yearly × 1 = $16/mo**                                                                              | 0177 / 0206        |
| **Exa** (MCP)              | Semantic web search / AI contents (internal research)                                                                                                                                                                                                                                                                                | Free 20k req/mo                                                                                                         | (gridwork-core)    |
| **crawl4ai** (MCP)         | $0 local scrape / crawl / extract (loopback daemon)                                                                                                                                                                                                                                                                                  | Free (self-hosted, no egress)                                                                                           | (gridwork-core)    |

**Cost floor:** SUPERSEDED 2026-07-12 by the session-Q rollup
(`outputs/research/provider-cost-rollup-2026-07-12.md` — the old "$30–50 floor" predated the Linear
Business line): Railway ~$20–40 + Plausible $9 + Linear $16 ≈ **$45–65/mo fixed run-rate** (+
Blacksmith $0–10 pending fork PF2-1); everything else free-tier or revenue-contingent. Grafana
Cloud Free covers current volume ($0).

## Live URLs

- `caisson.sh` / `www.caisson.sh` → Railway `caisson-site` (proxied, **pre-launch CF-Access gate** on, removed at go-live)
- `admin.caisson.sh` → Railway `caisson-admin` (proxied, gated by **in-app GitHub OAuth**
  (better-auth, numeric-id allowlist) since **ADR-0283** (2026-07-07) — the CF-Access `admin_gate`
  Terraform resource (ADR-0140/ADR-0204's edge gate + JWT check) was **destroyed** at the flip
  (`terraform apply`: 2 to destroy, `site_gate` untouched); operator GitHub sign-in verified live,
  edge now 307s straight to `/login`)
- `license.caisson.sh` → Railway `caisson-license` (grey/DNS-only, Paddle webhook; cert issued)
- `docs-api.caisson.sh` → Railway `caisson-docs`
- Registry Worker → `caisson-registry.broken-wood-97a9.workers.dev` (license-keyed entitlement filtering, 46-module index — live count churns on every republish, see `registry/index.json` / `docs/state/package-catalog.md` §1)
- Observability → Grafana Cloud `caisson.grafana.net` (sole OTLP sink; SigNoz UI removed 2026-07-01)

## Open forks

Provider-optimization forks — see [`decisions-and-forks.md` → Provider-optimization forks](decisions-and-forks.md).
**Round 2 OPEN (2026-07-12, session-Q rollup):** PF2-1 Blacksmith free-tier burn (the live one) ·
PF2-2 Resend 100/day launch cap · PF2-3 Better Stack `wardfile` monitor delete · PF2-4 GitHub
org-hygiene trio ($0) · PF2-5 OpenRouter per-key caps — table on the board.
**Round 1 resolved 2026-07-01 — all closed:** PF-1 **DROP self-hosted SigNoz → Grafana Cloud as sole OTLP**
(reverses the earlier "keep"; −$45-70/mo), PF-2 PostHog **added + live**, PF-3 Linear **added + connected**,
PF-4 **kept Greptile+TREX only at the time — Greptile itself later RETIRED 2026-07-06** (see the Live-stack row above; review is now the in-session SHIP audit lane), PF-5 Cookiy **added + connected**, PF-6 **skip Firecrawl**,
PF-7 hosting stays LOCKED Railway (no change), and **Edition members-fold → FOLD into bundles (ADR-0178)**.

## SigNoz → Grafana cutover — DONE (2026-07-01, ADR-0177)

Grafana Cloud (`caisson.grafana.net`, US-West `prod-us-west-0`) is now the **sole** OTLP sink; self-hosted
SigNoz is **removed**. Cutover DONE 2026-07-01 (ADR-0177): all 5 services export via a `glc_` Cloud
Access Policy token — the `glsa_` service-account token can't auth the OTLP gateway (401), it only
manages the instance. SigNoz fully removed; setup detail (archived, task complete):
`docs/archive/grafana-setup-runbook.md`.

> **Known instrumentation gap (finding, 2026-07-01).** `@caisson/observability` registers OTel's
> `HttpInstrumentation` + `UndiciInstrumentation` + `PgInstrumentation`, all of which patch **Node**
> internals (`node:http`, `undici`, the `pg` package). The **Bun** services (`caisson-docs`, `caisson-license`)
> use `Bun.serve` + Bun-native fetch + Bun SQL, which bypass every one of those patches — so their **auto**
> spans never fire; only **manual** spans export (this is why the probe landed but synthetic `/query` traffic
> produced no deployed-service span). The **Node/Next** services (`caisson-site`, `caisson-admin`) auto-trace
> inbound on the Node runtime. SigNoz had the identical limitation, so its removal is a zero-observability
> regression.
>
> **✅ CLOSED (2026-07-01, ADR-0185 `withRequestSpan`).** The manual Bun request-span helper shipped in the
> edition seam (PR#35) and was **deployed** to both Bun services — `caisson-docs` + `caisson-license`
> redeployed from `main` @ `84052aa` (both `/health` 200), so manual request spans now fire on the Bun
> handlers and export to the Grafana OTLP sink. No auto child-spans for DB/fetch (named ceiling, ADR-0185);
> Bun-native auto-instrumentation remains the future upgrade path if/when it exists.

---

## Credential homes (do not conflate)

| Home                                                    | Holds                                                                                                                                                                                                  | How to edit                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`~/.gridwork/env`** (local box)                       | MCP keys, CLI auth tokens, terraform vars, local-script creds — everything the **operator/agent** uses locally                                                                                         | append/replace `KEY=value`; sourced by shells + `link-mcps.ts`. Never committed.                                                                                                                                              |
| **Railway _service_ env** (per service)                 | Runtime secrets for the **deployed apps** (DB URL, auth secret, Paddle/Resend/OTLP, etc.)                                                                                                              | `railway variables -s <svc> --set K=V` or the Railway dashboard. **NOT mirrored** to the local file.                                                                                                                          |
| **1Password "Caisson Launch" vault** (added 2026-07-08) | Durable **recovery store**, one item per env-var NAME (title === name), per-service concealed fields — created by the credential-sweep session (`docs/archive/operator-runbook-2026-07-08.md` Phase 2) | `op` CLI (`op vault`/`op item`) or the 1Password app; **PRIMARY secret SoT since 2026-07-10 (ADR-0317, amends 0224 F6)** — `caisson.env` + Railway are derived; 147 items, full name parity, 8 providers live-probed working. |

A cred showing `--` in `~/.gridwork/env` is only "unset locally" — the app's copy lives on its Railway
service (e.g. `DISCORD_BOT_TOKEN` is on `caisson-support-bot`, not the box).

## CLI toolbox (installed 2026-07-01)

| Provider      | CLI                       | Auth                                                                  | Common ops                                                                 |
| ------------- | ------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Railway       | `railway`                 | `~/.railway/config.json` (logged in `admin@gridwork.dev`)             | `railway up -s <svc>` (deploy), `railway variables -s <svc>`               |
| Cloudflare    | `wrangler` 4.106          | `CLOUDFLARE_API_TOKEN` (SET) → auto                                   | `wrangler deploy` (registry Worker), `wrangler pages`, DNS via terraform   |
| Grafana Cloud | `grafanactl` 0.1.10       | `GRAFANA_SERVER`+`GRAFANA_TOKEN` (SET) → **connected** (Grafana 13.2) | dashboards/datasources/rules mgmt (OTLP ingest needs a separate CAP token) |
| Stripe        | `stripe`                  | `stripe login` or `--api-key` (keys not on box)                       | `stripe listen`, `stripe trigger` (dormant — Paddle is live MoR)           |
| Resend        | `resend`                  | `RESEND_API_KEY` (SET) → auto                                         | `resend emails send`, domain checks                                        |
| GitHub        | `gh`                      | `GITHUB_PERSONAL_ACCESS_TOKEN` (SET)                                  | PRs, packages, releases                                                    |
| ~~Greptile~~  | `greptile`                | `GREPTILE_API_KEY` (stale — vendor retired 2026-07-06)                | ~~`greptile review --agent`~~ RETIRED                                      |
| Trigger.dev   | `bunx trigger.dev@latest` | `TRIGGER_SECRET_KEY` (SET)                                            | `deploy`, `dev` (npx-native, no global install)                            |
| PostHog       | `bunx @posthog/wizard`    | interactive                                                           | one-shot Next.js wire-up (already wired by hand)                           |
| Cookiy        | `npx cookiy-mcp`          | OAuth bootstrap (we use Bearer instead)                               | client bootstrap only — not needed, manifest handles it                    |

`flyctl` + `vercel` are on PATH but are **not** Caisson providers (gridwork-era). Paddle / Linear /
OpenRouter / Plausible / SigNoz / Exa / Discord have **no standalone CLI** — dashboard + API/MCP only.

## Configure / edit + state — per provider

**Live stack**

- **Railway** — CLI-deployed, not GitHub-connected, via the receipted `tooling/scripts/railway-deploy.ts` path — but since 2026-07-29 `deploy-railway.yml` self-arms on path-triggered `main` pushes (`apps/site/**`, `apps/admin/**`, `packages/**` and the #426 root-dep filter), so a matching merge DOES auto-deploy the covered services (site/admin; license is dispatch-only, docs/support-bot are not covered). Env per service via `railway variables`. Config: per-service `railway.toml` + `RAILWAY_DOCKERFILE_PATH`. **State: ✅** 11 services live (caisson-prod, US-West `sfo`).
- **Cloudflare** — DNS + registry Worker + CF-Access, driven by `infra/terraform/` (apply) and `wrangler deploy` (Worker). Token `CLOUDFLARE_API_TOKEN` (SET). **State: ✅** DNS cut over to Railway, Pages torn down, Worker live (46-module index). Edge rate-limit on the docs-api `/query` path terraformed + 429-proven 2026-07-03 (ADR-0219, CAISSON-15); registry edge revocation deny-set live (ADR-0225 R-4).
- **Paddle** (MoR) — Paddle dashboard + REST API; client token `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` + `NEXT_PUBLIC_PADDLE_ENV` on `caisson-site`; server `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` (SET local). **State: ⚠ sandbox** — 7 prices + webhook configured in sandbox; **production Paddle account + live prices are the go-live fast-follow**.
- **Stripe** — buyer billing driver behind the `BillingProvider` port; `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`. **State: ⛔ dormant** — no keys on `caisson-site` (Paddle is the live checkout). Configure only if the Stripe path is activated.
- **Resend** — dashboard for domain/DNS; `RESEND_API_KEY` + `RESEND_FROM` on `caisson-site` (SET). **State: ✅** domain + DNS verified.
- **Trigger.dev** — `bunx trigger.dev@latest deploy`; `TRIGGER_SECRET_KEY` (SET). Config `trigger.config.ts`. **State: ✅** key set; free tier.
- **OpenRouter** — six per-service `OPENROUTER_API_KEY` values (SET, split 2026-07-08 — see the
  Live stack row above), no CLI. **State: ✅** all six probe-verified live; support-bot RAG live.
- **registry.caisson.sh** — self-hosted CF Worker serves the npm install protocol (packuments + tarballs) over a git-tracked `registry/tarballs.json` inlined into the Worker bundle (same pattern as `index.json`), license-token-authed; tarballs sink to a **R2 bucket via scoped S3-compatible access keys** (GH Actions repo secrets) + a `wrangler.toml` custom-domain entry. **Live** (ADR-0223) — the custom domain + R2 `TARBALLS`/`REVOCATIONS` bindings are deployed and proven: `registry.caisson.sh` returns real 200s, and a clean-env `bun add @caisson/kernel@latest`/`@caisson/ui@latest`/`@caisson/cli@latest` installs real bytes from R2 (`docs/deploy/STATE.md` 2026-07-12 entries, post-release-train verification). `CAISSON_PUBLISH_DRY_RUN=true` still gates a different pipeline — the monorepo's own GitHub-Packages publish workflow — not this registry. Supersedes the dead GitHub Packages buyer channel (`gh` + `GITHUB_PERSONAL_ACCESS_TOKEN` + `.npmrc` scope, still used for repo-internal package resolution only). **State: ✅ live**.
- **Plausible** — script tag on marketing pages; `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` on `caisson-site` (SET). Config in the Plausible dashboard. **State: ✅** confirmed active on the $9 Starter plan and collecting (2026-07-01).
- **SigNoz** (self-host) — was a 5-svc Railway stack. **State: ✅ REMOVED** (2026-07-01) — the Grafana OTLP cutover completed + verified, all 5 Railway services deleted; replaced by Grafana Cloud as the sole OTLP sink. `SIGNOZ_API_KEY` no longer needed. The 3 detached volumes (`signoz-*-volume`) were **deleted 2026-07-02** (Railway soft-delete; purge 2026-07-04). The `apps/admin` `/ops` cockpit — orphaned by the removal (its client queried the now-dead SigNoz v5 API) — is rebuilt onto Grafana Cloud's Tempo query API (`ADR-0207`, 2026-07-02) and **deployed with env set** (see the Grafana Cloud row below).
- **Greptile + TREX** — **State: ⛔ RETIRED 2026-07-06** — the Starter plan's monthly review limit hit mid-PR-#128 and the vendor was dropped (no upgrade, no replacement external reviewer). `.github/workflows/greptile-gate.yml` + `.greptile/` deleted (recoverable from git history); review is the in-session SHIP audit lane (CLAUDE.md §PR review gate). Operator follow-ups: ~~uninstall the Greptile GitHub app from the `caisson-sh` org~~ (2026-07-16 audit: installed-apps list shows no Greptile — done); ~~drop `GREPTILE_API_KEY` from `~/.gridwork/caisson.env`~~ VERIFIED GONE 2026-07-16 (zero grep hits in both env files) — the Greptile thread is fully closed.
- **Discord** — `infra/discord/provision.ts` (idempotent REST); bot tokens on `caisson-support-bot` Railway svc. Buyer OAuth sign-in: `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` on `caisson-site`. Entitlement role push (ADR-0203, env-gated): `BILLING_GRANT_TOKEN` on `caisson-support-bot`; `SUPPORT_BOT_URL`+`SUPPORT_BOT_GRANT_TOKEN` on `caisson-license` (post-grant push) and `caisson-site` (`/api/discord/backfill`). **State: ✅** guild built, bot online; role-push env set at deploy.
- **Exa / crawl4ai** — gridwork-core MCPs; `EXA_API_KEY` / `CRAWL4AI_API_TOKEN` (SET). **State: ✅**.

**Agent tooling / MCP providers** (gridwork-core manifests → `link-mcps.ts` → `~/.claude.json`; **connected 2026-07-01**)

- **PostHog** — _two_ keys: **(site)** `NEXT_PUBLIC_POSTHOG_KEY` (`phc_…`, client ingest) — **SET on `caisson-site` + redeployed 2026-07-01**; value pulled from the connected PostHog MCP (project `caisson-prod` id 493539), no separate fetch needed. **(MCP)** `POSTHOG_MCP_API_KEY` (`phx_…`, connected). US Cloud. **State: ✅ both live**.
- **Linear** — MCP `LINEAR_API_KEY` (`lin_api_…`, connected). **State: ✅ connected + full MCP surface** (issues/projects/cycles/docs). **Business plan** ($16/mo, the agent-automations tier) is an operator billing action in Linear → Settings → Plans; the MCP works today on any plan for issue/project CRUD. Separate from this operator MCP credential: `caisson-support-bot` now posts inbound escalations to Linear Triage as a third best-effort sink (`ADR-0206`, CAISSON-3) via its own `LINEAR_API_KEY`/`LINEAR_TEAM_ID`/`LINEAR_TRIAGE_STATE_ID`. **State: ACTIVE 2026-07-02** — all three vars set on `caisson-support-bot` + redeployed (bot recovering from a transient Discord CF-1015 egress-IP ban at first boot; the sink itself is env-live). Detail: `docs/state/linear-integration.md`.
- **Cookiy** — MCP `COOKIY_API_KEY` (`cky_…`, connected; headless Bearer, not OAuth). Scope: positioning research, **no customer PII**. **State: ✅ connected**.
- **Grafana Cloud** — `caisson.grafana.net`, US-West `prod-us-west-0`. `grafanactl` **connected** (Grafana 13.2, dashboard/stack mgmt via `GRAFANA_SERVER`+`GRAFANA_TOKEN`). **State: ✅ live, sole OTLP sink** — a `glc_` Cloud Access Policy token was obtained (the `glsa_` service-account token only manages the instance, can't auth the OTLP gateway); all 5 services redeployed with the OTLP env, pipeline verified receiving data, SigNoz retired. **New (2026-07-02, `ADR-0207`):** `apps/admin`'s `/ops` cockpit reads Grafana Cloud's Tempo query API (TraceQL via datasource-proxy) in place of the deleted SigNoz client. **State: ACTIVE 2026-07-02** — `GRAFANA_URL`+`GRAFANA_QUERY_TOKEN`+`GRAFANA_TEMPO_DATASOURCE_UID` set on `caisson-admin` (existing `glsa_` token reused per the operator lock; Tempo datasource uid `grafanacloud-traces`) + redeployed.
