---
updated: 2026-07-05
status: live
grounds:
  - docs/state/providers.md
  - docs/state/decisions-and-forks.md
  - knowledge/decisions/ADR-0098-credit-conversion-home.md
  - knowledge/decisions/ADR-0245-credit-pooled-rollover-12mo.md
  - knowledge/decisions/ADR-0182-byok-credit-billing-policy.md
  - knowledge/decisions/ADR-0117-observability-otel-signoz.md (superseded, see ADR-0177)
---

# Tools + COGS

The real monthly bill behind caisson, and what backs each dollar of a sale. Current-state
snapshot per `docs/state/providers.md` (swept 2026-07-01) — that file is the live ledger; this
page distills it into GTM terms: what's flat, what scales with usage, and what the COGS floor
looks like per sale.

## The flat monthly stack

| Tool            | Buys                                                                                        | Cost                                                                                                                                             | Locked by                         |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Railway         | Hosting for all 5 caisson services (site/admin/license/docs/support-bot) + managed Postgres | Pro plan $20/mo base + usage → **~$20–40/mo all-in**                                                                                             | ADR-0114/0115                     |
| Plausible       | Cookieless web analytics (no consent banner)                                                | $9/mo Starter (no free hosted tier)                                                                                                              | ADR-0118                          |
| Linear          | Issue tracking + agent automations                                                          | $16/mo Business plan (issue/project CRUD works free; the $16 buys the agent-automation tier) — **not yet turned on**, an operator billing action | providers.md §Config-audit item 8 |
| Greptile + TREX | AI PR review, path-scoped to security-critical diffs only                                   | Free Starter tier; **TREX $2/run** since 2026-06-30 (per-run, not flat — bounded by how many critical-path PRs fire the gate)                    | providers.md                      |

**Flat floor today: ≈$30–50/mo** (Railway + Plausible; Linear Business and TREX runs are
optional/variable on top). This is a **big drop from the 2026-06 baseline** — self-hosted SigNoz
(~$45–70/mo) was removed 2026-07-01 and replaced by Grafana Cloud's free tier (see below).

## Free-tier / $0 today, scales with usage

| Tool                     | Buys                                                                  | Today's tier                                                  | What triggers a bill                                |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Grafana Cloud            | Sole OTLP sink — traces/metrics/logs (`caisson.grafana.net`, US-West) | Free tier: 50GB logs + 50GB traces, 14-day retention → **$0** | Ingestion volume past the free cap (traffic growth) |
| Cloudflare               | DNS + registry Worker + CF-Access edge gates                          | Free                                                          | Worker request volume / R2 storage past free limits |
| Resend                   | Transactional email (magic-link, billing side-effects)                | Free tier: 3k/mo, 100/day                                     | Email volume past the cap                           |
| Trigger.dev              | Background jobs (billing/credit side-effects), self-hostable          | Free tier: $5 compute/mo included                             | Job-run compute past the included amount            |
| registry.caisson.sh (R2) | Tarball storage for the self-hosted npm registry                      | R2 usage, ~$0 at launch volume                                | Package pull volume / stored tarball size           |
| Discord                  | Community + support-bot channel + buyer OAuth + entitlement role push | Free                                                          | — (no paid tier in use)                             |
| Exa / crawl4ai (MCP)     | Internal research tooling (web search, scrape)                        | Free tier (Exa 20k req/mo) / self-hosted $0 (crawl4ai)        | Internal tooling only — never a per-sale COGS line  |

## Revenue-contingent (no flat line — the transaction tax)

| Tool       | Buys                                                                                                                           | Cost model                          | Locked by     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------- |
| Paddle     | Merchant-of-Record — tax calc, invoicing, remittance on every sale                                                             | % of revenue                        | ADR-0108/0116 |
| Stripe     | Buyer billing driver, behind the `BillingProvider` port — currently **dormant**, no keys deployed; Paddle is the live checkout | % of revenue (if/when activated)    | ADR-0017/0116 |
| OpenRouter | LLM inference — currently the support-bot's docs-RAG, one shared key                                                           | Usage-metered; pre-launch spend ~$0 | ADR-0105      |

## One-time / build-time (not a recurring bill)

- Registry self-hosted npm delivery (ADR-0223) — built, **dormant** behind
  `CAISSON_PUBLISH_DRY_RUN=true`; going live adds a Worker route + R2 bucket, still R2-usage-priced
  (see above), not a new flat fee.
- CI runners — the `caisson-amd64` runscaler scale set (self-hosted fleet on the operator's own
  hardware) plus two hosted jobs that stay off the self-hosted fleet: `oscal-conformance` (Maven)
  and `deploy-railway` (needs the prod token). No separate SaaS line for CI compute — the box is
  the runner.

## The COGS floor per sale

Caisson sells **one-time perpetual licenses** (12 months of included updates, ~40% renewal
thereafter — ADR-0244, locked 2026-07-05) plus a **credit system** for metered AI actions (pooled
rollover, 12-month grant expiry, FIFO burn — ADR-0245, locked 2026-07-05; $49 top-up pack per
ADR-0222). Two different COGS shapes follow from that split:

1. **The license sale itself carries near-zero marginal COGS.** A one-time edition purchase is a
   license-token issuance (`packages/license`) + a registry-gated npm pull — Railway compute and
   registry R2 egress are the only marginal cost, and both are flat/shared infrastructure already
   counted above, not a per-unit charge that scales with each sale.

2. **Credit consumption is the real variable COGS line**, and it runs through two rails with
   different economics:
   - **BYOK (tenant supplies their own provider key):** **$0 credits debited, 0% token markup**
     (ADR-0182) — the tenant pays the provider directly; caisson's internal `reserve()`/
     `reconcile()`/cap metering still runs for abuse/rate-limit purposes but is not a billing
     signal. Zero inference COGS to caisson on this rail.
   - **Platform-key lane (env-pointer key, caisson pays OpenRouter):** every metered AI action
     debits credits against the canonical peg `1 credit = 1000 micro-USD = $0.001`
     (`CREDIT_CONVERSION` in `@caisson/kernel`, ADR-0098) — the ai-meter cost path rounds **up**
     (never under-bill), the commerce grant path rounds **down** (never over-grant). The $49 /
     5,000-credit top-up pack (ADR-0222) sells at **$0.0098/credit**, well above the $0.001 peg
     used for subscription-cycle grant conversion — the spread between the two is the platform's
     effective markup over raw OpenRouter inference cost on this rail. (The $0.001 peg is the
     grant-conversion constant, not a proven OpenRouter per-token cost — treat the "~9.8x spread"
     as a structural observation, not an audited margin figure.)

**Net:** the flat infra floor (~$30–50/mo) is sale-count-independent; the only COGS line that
scales per sale is platform-key credit consumption, and BYOK exists specifically to let a tenant
opt out of that line entirely.

## Open fork — do not read pricing structure as settled

The operator has redirected a related question (the compliance-edition price-split fork, R3) into
a broader catalog-doctrine research round — direction under study: _all editions become bundle
options over an individually-sellable package catalog, with an explicit OSS/commercial-line split
and package-split standards_ (`outputs/research/catalog-doctrine-2026-07.md`, forks arriving). This
does not change the tools/COGS figures above, but if that direction locks, the **per-sale COGS
shape in §"COGS floor per sale"** may need a second pass — a package-level catalog could shift
which unit ("edition" vs "package") the license-issuance COGS attaches to. Treat this section's
license-sale-COGS claim as current-state, not future-proofed.

## Contradictions found while distilling

- `docs/state/providers.md` states the post-SigNoz-removal floor as **"≈$30-50/mo"** in one place
  and **"≈$30-55/mo"** in `docs/state/decisions-and-forks.md` (PF-1 resolution note). Both are
  loose ranges (Railway usage varies), not a hard conflict — carried here as "~$30–50/mo" per the
  providers.md figure since it's the more-recently-swept file.
- No source file states a directly-measured OpenRouter $/token cost for caisson's actual traffic —
  the $0.001/credit figure is the **grant-conversion peg** (ADR-0098), not an audited inference
  cost. The "~9.8x markup" framing above is this document's own inference from the $49/5,000-credit
  top-up price vs. that peg, flagged inline rather than stated as a locked fact.
