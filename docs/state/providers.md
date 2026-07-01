# External providers — live ledger

The single roster of every external service Caisson pays for or depends on: role, tier, monthly
cost, and the ADR that locked it. Companion to [`decisions-and-forks.md`](decisions-and-forks.md)
(the open provider forks live there under "Provider-optimization forks"). This file is the
**current-state** truth; it locks nothing.

_Last swept 2026-07-01 (Stage-2 deploy). Pricing verified against vendor pages by workflow
`wf_6a5ae3a3-9f5` (7 Exa-backed research agents)._

## Live stack

| Provider                   | Role                                                                                                       | Tier / cost (2026-07-01)                             | ADR                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------ |
| **Railway**                | Hosting — 5 caisson services (site/admin/license/docs/support-bot) + managed Postgres                      | Pro $20/mo base + usage → **~$20-40/mo all-in**      | 0114 / 0115        |
| **Cloudflare**             | DNS + registry Worker + CF-Access gates (Pages torn down 07-01)                                            | Free                                                 | 0047 / 0107 / 0140 |
| **Paddle**                 | Merchant-of-Record (tax/invoicing/remittance)                                                              | % of revenue (revenue-contingent)                    | 0108 / 0116        |
| **Stripe**                 | Buyer billing driver (behind `BillingProvider` port)                                                       | % of revenue                                         | 0017 / 0116        |
| **Resend**                 | Transactional email (magic-link, billing side-effects)                                                     | Free tier (3k/mo, 100/day)                           | 0018 / 0132        |
| **Trigger.dev**            | Background jobs (billing/credit side-effects, self-hostable)                                               | Free tier ($5 compute/mo)                            | 0018               |
| **OpenRouter**             | LLM inference (support-bot RAG, one key)                                                                   | Usage (pre-launch ~$0)                               | 0105               |
| **GitHub Packages**        | Private registry for commercial `@caisson/*` modules                                                       | Free within org quota                                | 0021               |
| **Plausible**              | Web analytics — **cookieless** marketing (no consent banner)                                               | $9/mo Starter (no free hosted tier)                  | 0118 (0086)        |
| **Grafana Cloud**          | Observability — **sole OTLP sink** (traces/metrics/logs), US-West · cutover DONE                           | **Free tier ($0)** — 50GB logs + 50GB traces, 14-day | 0177 (0117 super.) |
| ~~**SigNoz** (self-host)~~ | Observability — **REMOVED 2026-07-01** (5 services deleted; replaced by Grafana Cloud)                     | ~~$45-70/mo~~ → **$0**                               | 0117 → 0177        |
| **Greptile + TREX**        | AI code review — **PR required check only** (pre-push hook removed 07-01; `/greptile` for local on-demand) | Free Starter (solo); TREX $2/run since 2026-06-30    | — (not ADR-locked) |
| **Discord**                | Community + support-bot channel                                                                            | Free                                                 | 0105 / 0109        |
| **Exa** (MCP)              | Semantic web search / AI contents (internal research)                                                      | Free 20k req/mo                                      | (gridwork-core)    |
| **crawl4ai** (MCP)         | $0 local scrape / crawl / extract (loopback daemon)                                                        | Free (self-hosted, no egress)                        | (gridwork-core)    |

**Cost floor:** with SigNoz removed (2026-07-01), Railway drops to ≈$20-40/mo + Plausible $9 =
**≈$30-50/mo floor today**; everything else free-tier or revenue-contingent. Grafana Cloud Free covers
current volume ($0).

## Live URLs

- `caisson.sh` / `www.caisson.sh` → Railway `caisson-site` (proxied, **pre-launch CF-Access gate** on, removed at go-live)
- `admin.caisson.sh` → Railway `caisson-admin` (proxied, **permanent** operator CF-Access gate, ADR-0140)
- `license.caisson.sh` → Railway `caisson-license` (grey/DNS-only, Paddle webhook; cert issued)
- `docs-api.caisson.sh` → Railway `caisson-docs`
- Registry Worker → `caisson-registry.broken-wood-97a9.workers.dev` (license-keyed entitlement filtering, 32-module index)
- Observability → Grafana Cloud `caisson.grafana.net` (sole OTLP sink; SigNoz UI removed 2026-07-01)

## Open forks

Provider-optimization forks — see [`decisions-and-forks.md` → Provider-optimization forks](decisions-and-forks.md).
**Resolved 2026-07-01:** PF-1 **DROP self-hosted SigNoz → Grafana Cloud as sole OTLP** (reverses the earlier
"keep"; −$45-70/mo), PF-2 PostHog **added + live**, PF-3 Linear **added + connected**, PF-5 Cookiy **added +
connected**. Remaining forks → operator picker: PF-4 (2nd reviewer), PF-6 (Firecrawl), Edition members-fold.

## SigNoz → Grafana cutover — DONE (2026-07-01, ADR-0177)

Grafana Cloud (`caisson.grafana.net`, US-West `prod-us-west-0`) is now the **sole** OTLP sink; self-hosted
SigNoz is **removed**. Cutover executed: (1) `OTEL_EXPORTER_OTLP_ENDPOINT` (`https://otlp-gateway-prod-us-west-0.grafana.net/otlp`)

- `OTEL_EXPORTER_OTLP_HEADERS` (`Authorization=Basic <base64(1709803:glc_…)>`) set on all 5 services →
  redeployed; (2) pipeline **verified** — a manual probe span landed in Tempo (datasource-proxy TraceQL search);
  (3) the **5 SigNoz Railway services deleted** + the SigNoz UI URL dropped. Ingestion authed with a **Cloud
  Access Policy token** (`glc_`, write scopes) — the `glsa_` service-account token only manages the instance
  (`grafanactl` + query proxy), it can't auth the OTLP gateway (probe: 401). Operator UI tail: `grafana-setup-runbook.md`.

> **Known instrumentation gap (finding, 2026-07-01).** `@caisson/observability` registers OTel's
> `HttpInstrumentation` + `UndiciInstrumentation` + `PgInstrumentation`, all of which patch **Node**
> internals (`node:http`, `undici`, the `pg` package). The **Bun** services (`caisson-docs`, `caisson-license`)
> use `Bun.serve` + Bun-native fetch + Bun SQL, which bypass every one of those patches — so their **auto**
> spans never fire; only **manual** spans export (this is why the probe landed but synthetic `/query` traffic
> produced no deployed-service span). The **Node/Next** services (`caisson-site`, `caisson-admin`) auto-trace
> inbound on the Node runtime. SigNoz had the identical limitation, so its removal is a zero-observability
> regression. Closing this needs manual request spans in the Bun handlers or a Bun-compatible instrumentation
> — tracked as an edition seam (see `decisions-and-forks.md`). **Cleanup pending:** 3 detached SigNoz volumes
> (`signoz-*-volume`, ~1 GB each) — delete in the Railway dashboard (negligible storage cost).

---

## Two credential homes (do not conflate)

| Home                                    | Holds                                                                                                          | How to edit                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **`~/.gridwork/env`** (local box)       | MCP keys, CLI auth tokens, terraform vars, local-script creds — everything the **operator/agent** uses locally | append/replace `KEY=value`; sourced by shells + `link-mcps.ts`. Never committed.                     |
| **Railway _service_ env** (per service) | Runtime secrets for the **deployed apps** (DB URL, auth secret, Paddle/Resend/OTLP, etc.)                      | `railway variables -s <svc> --set K=V` or the Railway dashboard. **NOT mirrored** to the local file. |

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
| Greptile      | `greptile`                | `GREPTILE_API_KEY` (SET)                                              | `greptile review --agent`                                                  |
| Trigger.dev   | `bunx trigger.dev@latest` | `TRIGGER_SECRET_KEY` (SET)                                            | `deploy`, `dev` (npx-native, no global install)                            |
| PostHog       | `bunx @posthog/wizard`    | interactive                                                           | one-shot Next.js wire-up (already wired by hand)                           |
| Cookiy        | `npx cookiy-mcp`          | OAuth bootstrap (we use Bearer instead)                               | client bootstrap only — not needed, manifest handles it                    |

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
- **SigNoz** (self-host) — 5-svc Railway stack. **State: ⏳ BEING DROPPED** (operator call 2026-07-01, reverses the same-day "keep") — replaced by Grafana Cloud as the sole OTLP sink. Teardown is gated on the Grafana OTLP cutover completing + verified (see the cutover section above). `SIGNOZ_API_KEY` no longer needed.
- **Greptile + TREX** — `.greptile/config.json` (`statusCheck`+`triggerOnUpdates`) + `rules.md`; org TREX toggle; `GREPTILE_API_KEY` (SET). **State: ✅ PR required check only** — the advisory pre-push hook was **removed 07-01** (pushes no longer run Greptile); `/greptile` skill stays for on-demand local review of large/important uncommitted work; re-trigger a skipped PR check with `gh pr comment <PR> --body "@greptileai"`.
- **Discord** — `infra/discord/provision.ts` (idempotent REST); bot tokens on `caisson-support-bot` Railway svc. **State: ✅** guild built, bot online.
- **Exa / crawl4ai** — gridwork-core MCPs; `EXA_API_KEY` / `CRAWL4AI_API_TOKEN` (SET). **State: ✅**.

**Agent tooling / MCP providers** (gridwork-core manifests → `link-mcps.ts` → `~/.claude.json`; **connected 2026-07-01**)

- **PostHog** — _two_ keys: **(site)** `NEXT_PUBLIC_POSTHOG_KEY` (`phc_…`, client ingest) — **SET on `caisson-site` + redeployed 2026-07-01**; value pulled from the connected PostHog MCP (project `caisson-prod` id 493539), no separate fetch needed. **(MCP)** `POSTHOG_MCP_API_KEY` (`phx_…`, connected). US Cloud. **State: ✅ both live**.
- **Linear** — MCP `LINEAR_API_KEY` (`lin_api_…`, connected). **State: ✅ connected + full MCP surface** (issues/projects/cycles/docs). **Business plan** ($16/mo, the agent-automations tier) is an operator billing action in Linear → Settings → Plans; the MCP works today on any plan for issue/project CRUD.
- **Cookiy** — MCP `COOKIY_API_KEY` (`cky_…`, connected; headless Bearer, not OAuth). Scope: positioning research, **no customer PII**. **State: ✅ connected**.
- **Grafana Cloud** — `caisson.grafana.net`, US-West `prod-us-west-0`. `grafanactl` **connected** (Grafana 13.2, dashboard/stack mgmt via `GRAFANA_SERVER`+`GRAFANA_TOKEN`). **State: ⚠ OTLP credential pending** — the `glsa_` token can't auth the OTLP gateway (401); needs a `glc_` Cloud Access Policy token (or the stack's OTLP env snippet) to become the sole OTLP sink and retire SigNoz.

## Config audit — closeout (2026-07-01)

1. ✅ **MCPs connected** — linear + posthog + cookiy live (keys probe-verified).
2. ✅ **PostHog site analytics** — `NEXT_PUBLIC_POSTHOG_KEY` set on `caisson-site` + rebuilt.
3. ✅ **Plausible** — confirmed active on the $9 plan and collecting.
4. ✅ **grafanactl** — connected to `caisson.grafana.net` (dashboard/stack mgmt).
5. ✅ **Greptile pre-push hook removed** — PR required check only + `/greptile` local on-demand.
6. 🔴 **Grafana OTLP credential (BLOCKER)** — hand over a `glc_` Cloud Access Policy token (or the stack's OTLP env snippet). Gates the SigNoz→Grafana cutover + SigNoz teardown.
7. ⚠ **Paddle production** — live account + prices (go-live gate).
8. ○ **Linear Business plan** — $16/mo for agent automations (issue/project CRUD already works).
