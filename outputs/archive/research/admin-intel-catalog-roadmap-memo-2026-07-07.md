# DECISION MEMO — Caisson Admin Intelligence, Catalog, Roadmap & Forks

_Synthesis of the prelaunch research fanout (legs: inventory · landscape · catalog · roadmap), 2026-07-07_

The through-line every leg converges on: **the gap is wiring, not building.** Caisson already owns exa `/monitors` (polled every 30 min), `tg-bridge /alert`, the `posthog` MCP scoped to `caisson-prod`, a built-but-unused `packages/alerting` pipeline, a proven `gw dream` synthesis pattern, two defined-but-unscheduled agents (`gw-market-intel`, `gw-product-insights`), and a self-hosted `caisson-amd64` runner. Almost nothing net-new needs to exist — the dormant pieces need triggers pointed at Caisson signals (inventory §"Gridwork-core host capabilities"; landscape §"Cross-cutting take").

---

## 1. ADMIN INTELLIGENCE / AUTOMATION LAYER

Four coherent scopes, escalating. Costs assume Claude cron work is metered on the separate USD credit (landscape §1: effective 2026-06-15, ~$0.45/50K-token Sonnet run; route triage/extraction to Haiku).

### Option A — Lean cron+agent analyzers _(reuse only, no new surface)_

- **Watches:** competitors (exa `/monitors` on 3-5 pricing/changelog pages via `tools/lib/exa-client.ts`, already polled by `gridwork-exa-monitors.timer`); OSCAL releases via `usnistgov/OSCAL/releases.atom` + `oscal-content/releases.atom` (zero LLM, unambiguous version bump — landscape §3); EU AI Act via EUR-Lex RSS + the AI Office guidance page; GitHub traction via a ~200-line stars/issue-velocity script; AEO/citation by **arming the already-built but inert `aeo-probe.yml`** (set `OPENROUTER_API_KEY` as a repo secret — inventory §4); PostHog/analytics + Linear rolled into a scheduled `gw-market-intel` / `gw-product-insights` dispatch (currently defined, never cron'd — inventory §"Gridwork-core").
- **Outputs land:** `tg-bridge /alert` (the one audited operator sink) + auto-filed **Linear Triage issues** mirroring the support-bot `escalation.py`/`linear_client.py` pattern (ADR-0206). AEO keeps appending to `docs/gtm/aeo-citation-tracking.md`.
- **Stack reuse:** exa monitors, `exa-client.ts`, `tg-bridge /alert`, `caisson-amd64` runner, `aeo-probe.yml`, `linear` MCP, existing agents. Framework detection (OSCAL/EUR-Lex feeds) is deterministic → a Claude pass only fires when tier-1 detects a change (landscape §3 two-tier pattern).
- **Effort:** Low (~1-2 days: mostly config + 1 feed-cron script + 1 stars script + scheduling YAML). **Running cost:** ~$5-15/mo (Haiku triage + one weekly Sonnet synthesis; exa monitors on existing `EXA_API_KEY`; runner minutes ≈ free; OSCAL feed = $0).

### Option B — Error-to-issue triage _(the one net-new ops pipeline)_

- **Watches:** Caisson's own prod errors — today they land nowhere durable and no one is paged (inventory §2). Source them from the `posthog` MCP's `error-tracking` domain (connected, unused) or Grafana Tempo error traces beyond the 30-min `/ops` window.
- **Outputs land:** **dogfood the built-but-unused `packages/alerting`** pipeline (`dedup`/`rateCap`/`quietHours` → drivers, ADR-0151) → `tg-bridge /alert` on an error spike + a Linear Triage issue with a Haiku root-cause brief.
- **Stack reuse:** `packages/alerting` (literally built for this, currently sold-only), PostHog MCP, Linear MCP, the ADR-0206 escalation pattern. **Effort:** Medium (an error-source poll + wire alerting's output to Linear). **Cost:** ~pennies/incident (Haiku brief); no standing infra.

### Option C — Admin-integrated intel surface + weekly "caisson-dream"

- Adds a new `apps/admin/src/app/intel` page aggregating everything from A+B (competitor diffs, compliance feed changes, PostHog metrics, Grafana error rollups, GitHub traction, AEO, Linear) into one pane — closing the "no cross-link between `apps/admin` and the cockpit/dream machinery" gap (inventory §gap 7). Backed by a **port of the `gw dream` pattern** (deterministic + LLM mining → `dream_findings`-style table → dashboard + weekly `tg-bridge` memo), scoped to Caisson product signals instead of the gridwork host.
- **Effort:** High (new admin page + data model + weekly synthesis job on top of all A detectors). **Cost:** ~$2-5/mo weekly Sonnet synthesis + A's detector costs.

### Option D — Standing `services/intel` Agent-SDK daemon

- A always-on service (peer to `services/docs`/`services/support-bot`), webhook ingestion, Sentry-Seer-class root-cause. **Landscape §1/§4 explicitly flags this class — K8s watch daemons, bespoke cron.yaml compilers, autonomous auto-fix PRs — as overbuild for one operator**; and Sentry Seer at $40/active-contributor/mo is a "buy when it hurts" if error volume ever justifies it, not a speculative in-house build.

### ⭐ Sharpest default: **Option A + the error-triage slice of B**, outputs to `tg-bridge` + Linear, no new surface.

This wires every gap the inventory named (competitors, OSCAL/EU-AI-Act, GitHub, AEO, error-triage) using pieces that already exist. **Defer C** until a few weeks of weekly briefs prove there's enough to justify a page — a dashboard nobody has data for is a maintenance liability. **Reject D** outright. This is the shape landscape's cross-cutting take endorses (cheap deterministic detection → LLM judgment step → existing delivery sink).

---

## 2. CATALOG VALUE-ADDS (ranked, grouped)

All effort/demand from the catalog leg's compat-matrix table. Effort assumes the existing driver-beside-driver DI/env-gated + round-trip-test pattern.

### Wave-1 — build soon

1. **Analytics port (PostHog + GA4 beside Plausible)** — S. Already a flagged live gap (`adapter-expansion.md` §1D); PostHog is dogfooded internally already. Lowest effort, closes a known hole. _(catalog #6)_
2. **Slack driver for support-bot** (extract `ChatPlatform` port, Discord exists) — S. Slack is the **only** enterprise-compliant chat option (SOC2/HIPAA/FedRAMP/ISO; Discord has none) → serves the compliance hero persona directly. Doubles as roadmap bucket (d). _(catalog #4)_
3. **Clerk auth driver** — S. ~1M weekly downloads, the 2026 Next.js SaaS DX-default; every named competitor (ShipFast/MakerKit/Supastarter) offers it. _(catalog #2)_
4. **BullMQ/Redis job driver** — S. 5.8-6.4M weekly downloads, dominant queue by a wide margin; unlocks Redis shops wanting a job dashboard. _(catalog #3)_
5. **Framework starter template (Next.js first)** — M, but the **highest-strategic-value item on the board**: Caisson ships zero framework template (`packages/cli/templates/*` is raw `Bun.serve`) while every competitor Caisson prices against ships a wired Next.js app. Same shape as the already-shipped deploy-template family (ADR-0268). _(catalog #1)_

### Wave-2 — after wave-1 lands

6. **Inngest job driver** — S. Serverless complement to BullMQ (Redis) + pg-boss (Postgres, shipped). _(catalog #5)_
7. **JetBrains Junie + Amazon Q emitter targets** — S. ADR-0264 already names both "near-zero-LOC follow-ups"; completes the "every major agent surface" claim. _(catalog #9)_
8. **Render deploy template** — S. "Heroku replacement" matches Caisson's DB+worker shape; complements Railway/Fly/Vercel. _(catalog #8)_
9. **Azure Blob Storage WORM driver** — M. Completes the storage triad (S3/GCS/R2 shipped); WORM-contract design risk already retired (ADR-0267). _(catalog #11)_
10. **Auth0/Okta driver** — S, but **partial WorkOS overlap lowers marginal value** — hold until a named deal stalls on it. _(catalog #7)_
11. **Cohere AI lane** — S. Narrow-but-real enterprise RAG niche; same enum+case pattern as shipped groq/mistral/together. _(catalog #10)_
12. **Turso/libSQL Local-first hosted-sync** — M. Real 2026 pattern, but **must stay scoped to Local-first's on-device path** — never the multi-tenant RLS path. _(catalog #12)_

### Not worth it _(catalog leg, all cited)_

MySQL `Transactor` (locked out by ADR-0281 — DB-enforced RLS **is** the product) · Turso as a **primary** Postgres alternative (same RLS conflict) · DeepSeek lane (100% regulatory misalignment + Chinese-ownership vs. compliance brand) · xAI/Grok (consumer-skewed, declining) · Netlify template (JAMstack, poor DB+worker fit) · HashiCorp Vault KMS (operationally heavy, orthogonal to the envelope-crypto port) · OTLP/gRPC exporter (already a config flag, no real gap) · Aider emitter (covered by the universal AGENTS.md target).

---

## 3. ROADMAP — classified pool + top-10 by leverage

**Pool shape** (roadmap leg, sourced from `outstanding-work.md` §3, `docs/archive/opportunity-backlog.md`, `decisions-and-forks.md` through the 7th 2026-07-07 sitting, `deferred-respec/*`): five buckets — **(a) revenue-expanding** (price-level locks, priority-support SKU, abandoned-checkout, credit-pack tiering, B5 agency/reseller, vertical compliance/AI/local-first packs, third-party marketplace) · **(b) buyer-trust/proof** (session-token hashing, real media on depth pages, `/updates` roadmap block, thin-surface hardening) · **(c) product depth** (wave-6 build-on-trigger rows, KMS CMK, license `KmsSigner`, support-bot confidence gate) · **(d) reach** (ChatPlatform/Slack, Azure Blob, BullMQ/Inngest, Azure KeyVault, live OSCAL push, JetBrains/AmazonQ) · **(e) ops** (grandfathering policy, doc nits, Cookiy qualitative round, comparison-page content).

**Top 10 by leverage** (roadmap leg's ranking, opinionated order kept — items 1-4 are near-zero-build decisions that gate launch revenue/trust):

1. **D2/D3 price-level lock** — picker decision, ~0 build, directly sets checkout revenue; WTP data already filling (Cookiy frame 776545 / VW 445432). _(a)_
2. **Priority-support SKU — set price + SLA** — plumbing built fail-closed (PR #145); two config values flip it live. _(a)_
3. **Abandoned-checkout email** — universally high-ROI recapture, already spec-locked (`SPEC-abandoned-checkout-email.md`), idle waiting on a PLAN. _(a)_
4. **Grandfathering policy lock** — free to decide now, costly to retrofit; removes a standing pricing-trust liability before real buyers exist. _(e)_
5. **Real media on module/edition depth pages** — closes the most-cited buyer-trust gap (14 accepted audit findings, ADR-0237 F2). _(b)_
6. **Session-token hash-at-rest** — standard hardening a compliance buyer's auditor will ask about; high hero-wedge alignment (fights ADR-0210 §3 → needs a superseding ADR). _(b)_
7. **SSO SCIM / enterprise vendors beyond WorkOS** — the compliance ICP is exactly the segment that stalls on missing SSO; **ties to catalog #10 (Auth0/Okta) + #2 (Clerk)**. _(a/d)_
8. **Credit-pack tiering** — trivial SKU-catalog addition capturing budgets the single $49/5,000 pack misses. _(a)_
9. **Vertical compliance packs** — extends the proven hero wedge into named-regime add-ons; highest-confidence P7 vertical bet ($121-152 CPC signal). _(a)_
10. **Support-bot graded confidence gate** — cheap once real traffic exists to tune thresholds; ADR-0206 sink already wired. _(c/e)_

_Deliberately excluded despite size_: third-party marketplace / community publishers (correct long-term, zero design doc, not a prelaunch move), B5 agency/reseller (unstarted fork), three.js signature spike (polish, not revenue/trust-critical).

---

## 4. FORK CANDIDATES _(decision-ready — verbatim AskUserQuestion picker)_

**Fork 1 — Intel/automation layer scope**
_What do we build for the admin intelligence layer?_

- **Wire dormant + error-triage** _(Recommended)_ — arm `aeo-probe`, point exa `/monitors` at competitors, add OSCAL/EU-AI-Act feed-crons, a GitHub-stars script, schedule `gw-market-intel`/`gw-product-insights`, AND dogfood `packages/alerting` for prod errors. Outputs → `tg-bridge` + Linear. No new surface. ~1-3 days, ~$5-15/mo.
- **Wire dormant only** — same watchers minus the error-triage pipeline; errors stay visible only via `/ops`.
- **Admin intel page + weekly caisson-dream** — all of the above plus a new `apps/admin/intel` page and a `gw dream`-style weekly synthesis. High effort; defer-worthy until data volume justifies a page.
- **Standing `services/intel` daemon** — always-on Agent-SDK service. Flagged overbuild for a solo operator (landscape §1/§4).

**Fork 2 — Compliance-framework watcher coverage**
_Which regulatory sources do we actually wire?_

- **OSCAL + EU AI Act** _(Recommended)_ — the two with real machine-readable feeds (`OSCAL/releases.atom` = zero-LLM; EUR-Lex RSS + AI Office page = highest-value, dates moving right now per the Digital Omnibus). Gated by an on-demand Claude pass against `packages/compliance` mappings.
- **OSCAL only** — cheapest, unambiguous version-bump detection, zero LLM cost; misses the live EU AI Act churn.
- **OSCAL + EU AI Act + HIPAA breach portal** — adds `ocrportal.hhs.gov` polling (the one machine-checkable HIPAA signal).
- **All four + monthly SOC2 check** — plus a monthly AICPA resources-page check (near-static since 2017; low yield).

**Fork 3 — Cron execution substrate**
_Where do the scheduled agents/watchers run?_

- **GitHub Actions on `caisson-amd64`** _(Recommended)_ — repo-versioned, survives without a machine on, reuses the owned runner fleet; keep exa-monitor polling on the existing `gridwork-exa-monitors.timer`.
- **gridwork-core host systemd timers** — extend the pattern that already runs `gridwork-exa-monitors` + `gridwork-dream`; centralizes with host telemetry but lives outside the Caisson repo.
- **Claude Code Routines** — zero-infra, Anthropic-managed, min 1-hour interval; no workflow file to own, but scheduling lives off-repo.

**Fork 4 — Catalog wave-1 batch**
_Which value-adds ship first?_

- **S-effort driver batch** _(Recommended)_ — Analytics port + Slack support-bot driver + Clerk + BullMQ. Four small, high-demand, low-risk drivers; ship the M-effort Next.js template as a fast-follow.
- **Framework template first** — build the Next.js starter (catalog #1) ahead of drivers; highest strategic value (biggest competitive gap) but M effort delays the quick wins.
- **Both in parallel** — driver batch + template concurrently via worktree isolation; more coordination, faster to full wave-1.
