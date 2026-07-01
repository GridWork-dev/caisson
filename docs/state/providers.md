# External providers — live ledger

The single roster of every external service Caisson pays for or depends on: role, tier, monthly
cost, and the ADR that locked it. Companion to [`decisions-and-forks.md`](decisions-and-forks.md)
(the open provider forks live there under "Provider-optimization forks"). This file is the
**current-state** truth; it locks nothing.

_Last swept 2026-07-01 (Stage-2 deploy). Pricing verified against vendor pages by workflow
`wf_6a5ae3a3-9f5` (7 Exa-backed research agents)._

## Live stack

| Provider               | Role                                                            | Tier / cost (2026-07-01)                                    | ADR                |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- | ------------------ |
| **Railway**            | Hosting — all 11 caisson-prod services + managed Postgres       | Pro $20/mo base + usage → **~$65-90/mo all-in**             | 0114 / 0115        |
| **Cloudflare**         | DNS + registry Worker + CF-Access gates (Pages torn down 07-01) | Free                                                        | 0047 / 0107 / 0140 |
| **Paddle**             | Merchant-of-Record (tax/invoicing/remittance)                   | % of revenue (revenue-contingent)                           | 0108 / 0116        |
| **Stripe**             | Buyer billing driver (behind `BillingProvider` port)            | % of revenue                                                | 0017 / 0116        |
| **Resend**             | Transactional email (magic-link, billing side-effects)          | Free tier (3k/mo, 100/day)                                  | 0018 / 0132        |
| **Trigger.dev**        | Background jobs (billing/credit side-effects, self-hostable)    | Free tier ($5 compute/mo)                                   | 0018               |
| **OpenRouter**         | LLM inference (support-bot RAG, one key)                        | Usage (pre-launch ~$0)                                      | 0105               |
| **GitHub Packages**    | Private registry for commercial `@caisson/*` modules            | Free within org quota                                       | 0021               |
| **Plausible**          | Web analytics — **cookieless** marketing (no consent banner)    | $9/mo Starter (no free hosted tier)                         | 0118 (0086)        |
| **SigNoz** (self-host) | Observability — OTLP backend, 5-svc stack on Railway            | $0 software; **~$45-70/mo Railway compute** (biggest lever) | 0117 / 0138        |
| **Greptile + TREX**    | AI code review (PR bot; TREX = sandboxed execution)             | Free Starter (solo); TREX $2/run since 2026-06-30           | — (not ADR-locked) |
| **Discord**            | Community + support-bot channel                                 | Free                                                        | 0105 / 0109        |
| **Exa** (MCP)          | Semantic web search / AI contents (internal research)           | Free 20k req/mo                                             | (gridwork-core)    |
| **crawl4ai** (MCP)     | $0 local scrape / crawl / extract (loopback daemon)             | Free (self-hosted, no egress)                               | (gridwork-core)    |

**Cost floor today:** Railway ≈$65-90 + Plausible $9 = **≈$75-100/mo**; everything else is free-tier or
revenue-contingent. The one material lever is the self-hosted SigNoz block (≈$45-70/mo, ClickHouse-dominated).

## Live URLs

- `caisson.sh` / `www.caisson.sh` → Railway `caisson-site` (proxied, **pre-launch CF-Access gate** on, removed at go-live)
- `admin.caisson.sh` → Railway `caisson-admin` (proxied, **permanent** operator CF-Access gate, ADR-0140)
- `license.caisson.sh` → Railway `caisson-license` (grey/DNS-only, Paddle webhook; cert issued)
- `docs-api.caisson.sh` → Railway `caisson-docs`
- Registry Worker → `caisson-registry.broken-wood-97a9.workers.dev` (license-keyed entitlement filtering, 32-module index)
- SigNoz UI → `https://signoz-signoz-production-2f89.up.railway.app` (:8080, SigNoz's own login; **not** CF-Access gated)

## Open forks

Provider-optimization forks — see [`decisions-and-forks.md` → Provider-optimization forks](decisions-and-forks.md).
**Resolved 2026-07-01:** PF-1 **keep SigNoz** (not retired; Grafana Cloud added alongside), PF-2 PostHog **added +
live**, PF-3 Linear **added + connected**, PF-5 Cookiy **added + connected**. Remaining: PF-4/PF-6/PF-7
(recommended-closes) + the Grafana token handoff.

## SigNoz — kept (API key optional)

SigNoz is **not** being retired (operator call 2026-07-01). `admin` can read `SIGNOZ_API_KEY` for its ops
widgets, but it's **optional** — the SigNoz UI login covers day-to-day ops. If you do want the widgets:
create the key in the SigNoz UI, set it on `caisson-admin`. (A CF-Worker OTLP export would separately need an
external TCP-proxy on `signoz-ingester`.)

---

## Two credential homes (do not conflate)

| Home                                    | Holds                                                                                                          | How to edit                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **`~/.gridwork/env`** (local box)       | MCP keys, CLI auth tokens, terraform vars, local-script creds — everything the **operator/agent** uses locally | append/replace `KEY=value`; sourced by shells + `link-mcps.ts`. Never committed.                     |
| **Railway _service_ env** (per service) | Runtime secrets for the **deployed apps** (DB URL, auth secret, Paddle/Resend/OTLP, etc.)                      | `railway variables -s <svc> --set K=V` or the Railway dashboard. **NOT mirrored** to the local file. |

A cred showing `--` in `~/.gridwork/env` is only "unset locally" — the app's copy lives on its Railway
service (e.g. `DISCORD_BOT_TOKEN` is on `caisson-support-bot`, not the box).

## CLI toolbox (installed 2026-07-01)

| Provider      | CLI                       | Auth                                                                    | Common ops                                                               |
| ------------- | ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Railway       | `railway`                 | `~/.railway/config.json` (logged in `admin@gridwork.dev`)               | `railway up -s <svc>` (deploy), `railway variables -s <svc>`             |
| Cloudflare    | `wrangler` 4.106          | `CLOUDFLARE_API_TOKEN` (SET) → auto                                     | `wrangler deploy` (registry Worker), `wrangler pages`, DNS via terraform |
| Grafana Cloud | `grafanactl` 0.1.10       | `grafanactl config set` (stack URL + SA token) — **not yet configured** | dashboards/datasources/rules mgmt (PF-1 target)                          |
| Stripe        | `stripe`                  | `stripe login` or `--api-key` (keys not on box)                         | `stripe listen`, `stripe trigger` (dormant — Paddle is live MoR)         |
| Resend        | `resend`                  | `RESEND_API_KEY` (SET) → auto                                           | `resend emails send`, domain checks                                      |
| GitHub        | `gh`                      | `GITHUB_PERSONAL_ACCESS_TOKEN` (SET)                                    | PRs, packages, releases                                                  |
| Greptile      | `greptile`                | `GREPTILE_API_KEY` (SET)                                                | `greptile review --agent`                                                |
| Trigger.dev   | `bunx trigger.dev@latest` | `TRIGGER_SECRET_KEY` (SET)                                              | `deploy`, `dev` (npx-native, no global install)                          |
| PostHog       | `bunx @posthog/wizard`    | interactive                                                             | one-shot Next.js wire-up (already wired by hand)                         |
| Cookiy        | `npx cookiy-mcp`          | OAuth bootstrap (we use Bearer instead)                                 | client bootstrap only — not needed, manifest handles it                  |

`flyctl` + `vercel` are on PATH but are **not** Caisson providers (gridwork-era). Paddle / Linear /
OpenRouter / Plausible / SigNoz / Exa / Discord have **no standalone CLI** — dashboard + API/MCP only.

## Configure / edit + state — per provider

**Live stack**

- **Railway** — CLI `railway up -s <svc>` deploys (services are **CLI-deployed, not GitHub-connected** → merging `main` does _not_ redeploy). Env per service via `railway variables`. Config: per-service `railway.toml` + `RAILWAY_DOCKERFILE_PATH`. **State: ✅** 11 services live (caisson-prod, US-West `sfo`).
- **Cloudflare** — DNS + registry Worker + CF-Access, driven by `infra/terraform/` (apply) and `wrangler deploy` (Worker). Token `CLOUDFLARE_API_TOKEN` (SET). **State: ✅** DNS cut over to Railway, Pages torn down, Worker live (32-module index).
- **Paddle** (MoR) — Paddle dashboard + REST API; client token `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` + `NEXT_PUBLIC_PADDLE_ENV` on `caisson-site`; server `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` (SET local). **State: ⚠ sandbox** — 7 prices + webhook configured in sandbox; **production Paddle account + live prices are the go-live fast-follow**.
- **Stripe** — buyer billing driver behind the `BillingProvider` port; `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`. **State: ⛔ dormant** — no keys on `caisson-site` (Paddle is the live checkout). Configure only if the Stripe path is activated.
- **Resend** — dashboard for domain/DNS; `RESEND_API_KEY` + `RESEND_FROM` on `caisson-site` (SET). **State: ✅** domain + DNS verified.
- **Trigger.dev** — `bunx trigger.dev@latest deploy`; `TRIGGER_SECRET_KEY` (SET). Config `trigger.config.ts`. **State: ✅** key set; free tier.
- **OpenRouter** — `OPENROUTER_API_KEY` (SET), no CLI. **State: ✅** support-bot RAG live.
- **GitHub Packages** — `gh` + `GITHUB_PERSONAL_ACCESS_TOKEN` (SET); `.npmrc` scope. **State: ✅**.
- **Plausible** — script tag on marketing pages; `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` on `caisson-site` (SET). Config in the Plausible dashboard. **State: ✅** confirmed active on the $9 Starter plan and collecting (2026-07-01).
- **SigNoz** (self-host) — 5-svc Railway stack; config in `infra/` + the SigNoz UI. **State: ✅ running — KEPT, not retired** (operator call 2026-07-01: self-hosted observability stays part of the product story). `SIGNOZ_API_KEY` for the admin ops widgets is **optional** — the SigNoz UI login covers ops; create it only if you want the widgets in `apps/admin`.
- **Greptile + TREX** — `.greptile/config.json` (`statusCheck`+`triggerOnUpdates`) + `rules.md`; org TREX toggle; `GREPTILE_API_KEY` (SET). **State: ✅** required check live on `main`; re-trigger `gh pr comment <PR> --body "@greptileai"`.
- **Discord** — `infra/discord/provision.ts` (idempotent REST); bot tokens on `caisson-support-bot` Railway svc. **State: ✅** guild built, bot online.
- **Exa / crawl4ai** — gridwork-core MCPs; `EXA_API_KEY` / `CRAWL4AI_API_TOKEN` (SET). **State: ✅**.

**Agent tooling / MCP providers** (gridwork-core manifests → `link-mcps.ts` → `~/.claude.json`; **connected 2026-07-01**)

- **PostHog** — _two_ keys: **(site)** `NEXT_PUBLIC_POSTHOG_KEY` (`phc_…`, client ingest) — **SET on `caisson-site` + redeployed 2026-07-01**; value pulled from the connected PostHog MCP (project `caisson-prod` id 493539), no separate fetch needed. **(MCP)** `POSTHOG_MCP_API_KEY` (`phx_…`, connected). US Cloud. **State: ✅ both live**.
- **Linear** — MCP `LINEAR_API_KEY` (`lin_api_…`, connected). **State: ✅ connected**; agent automations need the **Business** plan on the workspace.
- **Cookiy** — MCP `COOKIY_API_KEY` (`cky_…`, connected; headless Bearer, not OAuth). Scope: positioning research, **no customer PII**. **State: ✅ connected**.
- **Grafana Cloud** — US-West stack (operator-created). `grafanactl` installed; needs `grafanactl config set` + a Cloud Access Policy token. **State: ⚠ token pending.** SigNoz is **not** retired, so Grafana runs **alongside** (operator ops dashboards / optional second OTLP sink) — wired on token handoff.

## Config audit — closeout (2026-07-01)

1. ✅ **MCPs connected** — linear + posthog + cookiy live after CC restart (keys probe-verified).
2. ✅ **PostHog site analytics** — `NEXT_PUBLIC_POSTHOG_KEY` set on `caisson-site` + rebuilt.
3. ✅ **Plausible** — confirmed active on the $9 plan and collecting.
4. ✅ **SigNoz** — kept (not retired); `SIGNOZ_API_KEY` not required (UI login covers ops).
5. ⚠ **Grafana Cloud** — hand over the Cloud Access Policy token → `grafanactl config set` (alongside SigNoz).
6. ⚠ **Paddle production** — live account + prices (go-live gate).
7. ○ **Linear Business plan** — for agent automations (read/write already works).
