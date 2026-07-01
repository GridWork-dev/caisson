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

Seven provider-optimization forks are OPEN and waiting on the operator (PF-1..PF-7) — see
[`decisions-and-forks.md` → Provider-optimization forks](decisions-and-forks.md). Headline: **PF-1 the
SigNoz backend** (keep self-hosted for brand vs offload to a free managed OTLP tier for −$45-70/mo) is the
single decision needing an explicit call; the rest are $0-adds or recommended-closes.

## Fast-follow (SigNoz API key — enables admin ops widgets)

`admin` reads `SIGNOZ_API_KEY` for its ops widgets. Create it in the SigNoz UI (see the walkthrough the
operator was given 2026-07-01), then set it on the `caisson-admin` Railway service env. Requires the SigNoz
first-run admin account to exist. A second fast-follow (CF-Worker OTLP export) needs an external TCP-proxy
on `signoz-ingester`.
