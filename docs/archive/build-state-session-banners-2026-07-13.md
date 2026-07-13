---
updated: 2026-07-13
status: archived
---

# build-state.md session banners (2026-06-29 → 2026-07-02)

Archived verbatim 2026-07-13 (doc-hygiene sweep). This is the stacked per-session narrative that
used to sit in `docs/build-state.md` directly below its own compact one-line changelog — the
file's rework note claimed this history was "squashed into the one-line changelog... no history
deleted, just compacted," but the verbose paragraphs below were never actually removed until now.
Moved here unmodified for lineage; `docs/build-state.md`'s Changelog section is the live record.

---

Verified against `main` at 2026-06-29 (post-PR#24: the code-wiring stack W1 open-core → W2 migrate → B1 billing-X2 → B2 entitlement resolver + worker filtering merged via PR#16/18/19, plus PR#21 design-system, PR#22 CI fleet, PR#23 `services/docs`, PR#24 `services/support-bot`). **2026-06-30 P6 integration** then merged the go-live operator gates (`ADR-0106`–`0109`: pricing · CF-Access · Paddle-MoR · support-bot member-mgmt) + the unattended code track (`ADR-0110`–`0113`: license issuer · publish-readiness flip · MCP rate-limit · entitlement-revoke + one-time + clawback), gate green 125/125. ADR ceiling on this catalog is now **0137**.

**2026-07-01 Stage-2 Stream A** (branch `stream/obs-admin`, off clean `main`, local-only — **not
pushed**) BUILT the `admin.caisson.sh` operator control-plane + the fleet-observability backend
(charter `ADR-0138`; detail forks locked `ADR-0140`–`0143`). A1 scaffolded `apps/admin` and
absorbed+removed `apps/studio` (now its `/design` section); A2 authored the 5-service self-host
SigNoz Railway config under `infra/signoz/` (14d retention, 100% head, CF-Access UI); A3 added the
support-bot Python OTLP bootstrap + the registry-Worker CF-native SigNoz destinations (the Node
services `docs`/`license` were already instrumented); A4 built the read-only cross-tenant business
views behind a local admin-read RLS role (`TO admin USING(true)`, fail-closed-proven); A5 the SigNoz
`query_range` ops widgets; A6 a React Flow live architecture diagram (auto-topology baked at build +
hand-authored annotations); A7 the decisions/ADR-trail SOT board. `bun run check` **131/131** + gate
**45/45** green; every surface env-gated inert. **Not deployed** — the Railway provisioning of admin +
SigNoz, DNS + CF-Access apply, and the `admin` PG role are the integration/DEPLOY session's work. ADR
ceiling now **0143**.

**2026-06-30 unified-app build session** (branch `feat/dashboard-unified-and-p6-tail`, local-only —
**not pushed to origin**) then BUILT the dashboard host/DB switch (`ADR-0114`/`0115`) + the
billing-scope/observability/analytics picker round (`ADR-0116`–`0118`): one unified standalone Next
app (`output: 'standalone'`, `ADR-0114`) carrying the 5-view buyer dashboard with real `withTenant`
RLS tenant reads; CI rewired into split workflows with turbo/bun build-cache + a new
`deploy-railway.yml` (inert until `RAILWAY_TOKEN` is set); observability (OTel → SigNoz, `ADR-0117`),
jobs, and the `@caisson/ui` kit integrated into the app. **Not yet deployed** — the live site is
still served by Cloudflare Pages; Railway provisioning + DNS cutover + Pages teardown are
DEPLOY-class and operator-gated. **CI rewired for standalone mode (2026-06-30, CI half of runbook
C.2/C7):** the static-export `deploy-site.yml` (which built `out/` for Cloudflare Pages) is
**retired/deleted** — deleting the Pages project itself stays the DEPLOY-class teardown (C7);
`lighthouse.yml` is **gated to `workflow_dispatch`-only** (its `staticDistDir: out` target is gone;
re-arm against the live Railway origin post-cutover); and `deploy-railway.yml` now **guards on
`RAILWAY_TOKEN`** so it is a green no-op (never a red `main`) until the operator arms it at C2.

**2026-06-30 pricing + store-rework wave** locked the store rework (sequenced BEFORE the Railway
cutover per the operator's explicit ordering) AND built it on `feat/dashboard-unified-and-p6-tail`:
value-based per-module pricing across the module catalog + edition-bundle math (`ADR-0129`), with the
final Q4 below-sum edition points — Compliance $749 / AI Production Kit $599 / Agentic-Dev $249 /
Local-first $349 / All-Access Bundle $1,499 — locked by the reprice ADR `ADR-0137` (supersedes the
`ADR-0129`/`ADR-0106` point-values); the gated pre-launch storefront showing the full catalog with no
maturity flags (`ADR-0130`, supersedes `ADR-0082` §3/§4); a site cart feeding one multi-item Paddle
checkout with a verified fallback path (`ADR-0131`, extends `ADR-0116`); buyer sign-in via better-auth
magic-link + GitHub/Google OAuth (`ADR-0132`); and license-keyed registry gating that closes the
free-view leak while opening the ships-with-generator tooling trio (cli · migrate · license-verify) as
Apache-2.0 Base (`ADR-0136`). **Status: BUILT + integrated this session** — the reprice, storefront
catalog grid, cart + multi-item Paddle checkout, better-auth sign-in, and the license-keyed free floor
all landed; module Paddle price-ids, the buyer-account/tenant mapping, and the customer-facing copy
rewrite remain Stage-2/fast-follow seams.

**2026-06-30 harvest grill session** (document-only, this session) locked the **next initiative
after** the store rework + Railway cutover: the 11 gridwork-core infra packages become sellable
substrate for Agentic-Dev + AI Production Kit, the 6 Wardfile product-code lifts harden the base,
the cross-domain audit/validate harness gets a full build (generalizing `ADR-0101`), and two new
commercial Compliance modules (`@caisson/alerting`, `retention-runner`) join the catalog — `ADR-0133`,
`ADR-0134`, `ADR-0135`. **Status: locked, zero code** — spec-gated per package, ranked execution
order tracked in `docs/archive/harvest-program.md`. ADR ceiling on this catalog is now **0137**.
Method: `packages/*/src` + test presence, `apps/`/`services/` contents, ADR + spec artifact
trail, git chronology. Status reflects code-on-disk, not marketing copy.

> **Accuracy note (read first):** `ADR-0082` §3 (`knowledge/decisions/ADR-0082-go-live-site-posture.md`,
> the go-live _site-copy_ ADR) says four edition packages are "currently empty stubs". That line
> was written on a site-copy branch **before** the wave-1 edition branches merged (ADR-0082 commit
> `1d84a92` predates the PR#11 merge `76fd474`, same day). It governs _site copy honesty_, not
> repo build-state, and is **stale as a build-status claim**. The post-merge tree (below) shows the
> edition packages carry real implementations + passing tests. They are _not_ empty - but they are
> _not_ production-complete either (un-exercised live transports, no VERIFY trail, reference apps
> only). `docs/archive/SUMMARY.md` (dated 2026-06-27) is likewise stale on wave-1 ("editions P2-P4 ... remain").
> This file supersedes both for build-status.
