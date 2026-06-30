# CLAUDE.md — Caisson working rules

Additive to the global gridwork-core surface (security floor, retrieval doctrine, coding
discipline auto-load from there). This file holds only what is specific to this repo.

**What this repo is:** a productized monorepo library — a composable base + four premium
editions (Compliance · AI Production Kit · Local-first AI · Agentic-Dev) + a `create-caisson`
generator + a custom support service. Sold one-time + bundle + per-module + subscription/credits.
Full founding spec: `specs/00-product-spec.md`. Built **rebuild-clean** from proven GridWork
repos — never a port. **Name + positioning LOCKED: Caisson · `@caisson/*` · `caisson.sh`**
(ADR-0041 name · ADR-0040 hero · ADR-0042 design).

## The one operator rule

**Never auto-decide a fork.** Every open decision lives in `docs/state/decisions-and-forks.md`
until the operator locks it; recommendations are labeled with confidence + evidence, then wait.
Locks are recorded as ADRs in `knowledge/decisions/` (append-only, `ADR-NNNN-slug.md`, never
edited — supersede with a later ADR).

## Source-of-truth hierarchy

1. `docs/state/decisions-and-forks.md` — live board (locked + open)
2. `knowledge/decisions/` — the ADRs themselves (**0001–0118**: 0001–0024 founding+substrate+pipeline · 0040–0044 brand+crypto+framework · 0045–0049 Wave-0 substrate · 0050–0077 Wave-1 editions · 0078–0083 design+go-live · 0084–0088 GTM+collision-fix · 0089–0093 picker-round locks · 0094–0098 GTM-report+W1/B1 (open-core/offer/docs-svc/registry-split/credit-home) · 0099–0104 design-system harden+brand-mark+hero · 0105 support-bot impl · 0106–0109 P6 operator-gates (pricing/CF-Access/Paddle-MoR/support-bot-member-mgmt) · 0110–0113 P6 code-track (license-issuer/publish-flip/MCP-rate-limit/entitlement-revoke) · 0114–0115 unified-Railway-app + Railway-PG · 0116–0118 billing-scope + observability-SigNoz + analytics-Plausible; append-only, all locked). Canonical ADR catalog: `docs/adr-index.md`
3. `specs/` — locked concept docs; `specs/00-product-spec.md` is the founding spec
4. `plan.md` / `SUMMARY.md` — build plan + consolidated summary
5. `outputs/` — session artifacts (kickoffs, research, syntheses)

On conflict, the higher item wins.

## Cadence (spec-first)

Research → spec → ADR lock → code. **No product code before the spec/ADR it implements is
locked.** Current state: **P0+P1, Wave-0 substrate, Wave-1 editions (merged-but-partial), P5
generator, and P6 all SHIPPED in-repo; registry Worker LIVE.** P6 closed out with Bucket C
(`services/docs` PR#23 + `services/support-bot` PR#24) merged + DEPLOYED, X-2 billing + entitlement
resolver + Worker filtering merged (PR#18), the 2026-06-30 P6 integration's **license issuer
(ADR-0110), publish-readiness flip (ADR-0111), MCP rate-limit (ADR-0112) + entitlement-revoke/
one-time/clawback (ADR-0113)**, and the 2026-06-30 unified-app session's **dashboard host/DB
(ADR-0114/0115), billing driver scope (ADR-0116), observability (ADR-0117) + web analytics
(ADR-0118)**. The unified Railway-standalone Next app (5-view buyer dashboard, real tenant reads)
and the rewired CI are **BUILT on the integration branch, not yet deployed**. Remaining work is
operator/DEPLOY-class: Railway provisioning + DNS cutover off Cloudflare Pages, the 7 services-
hardening punch-list fixes, and the Paddle webhook binding. Live per-package truth:
`docs/build-state.md`.

## Engineering invariants (locked, ADR-0002 — apply to all product code)

- **TypeScript strict**, Bun runtime/PM (never npm/yarn). **Zod `.strict()` at every boundary.**
  No `any`, no `console.log` in product code. `crypto.randomUUID()` for IDs.
- **Credits/money are integer units** — never floats (ADR-0007).
- **Append-only versions** — locked artifacts immutable; amendments supersede (ADR-0006).
- **`fetchWithTimeout` on every outbound fetch; `crypto.timingSafeEqual` for every secret/token/
  license compare.** Fail-closed RLS (ADR-0005), credit gates (402), license checks.
- **One standards gate:** `tooling/` is the single eslint/tsconfig/test source; a package ships
  only through it. Golden-file regression before any compliance logic.
- **Composable packages** (ADR-0003): editions are compositions, never forks; a package never
  depends "up" on an edition.

## Pro-private firewall (binding)

Nothing from `media-pipeline` (pro-private) may seed any package — **patterns/ideas only, never
implementation**. The harvestable license kit is taken from PUBLIC `tessera`.

## Locked since founding (no longer deferred)

- **Name + positioning + design** — LOCKED: name **Caisson** (ADR-0041); hero = **compliance
  wedge under a production-rigor umbrella** (ADR-0040); design foundation palette+type (ADR-0042),
  **expanded** into a full brand system (mark · icons · illustration · expressive motion · elevation+glow)
  by **ADR-0078** (supersedes 0042). Site SEO → **ADR-0079**; copy laws → **ADR-0080** (extends specs/04).
  The old "AI production codebase starter" frame is superseded.
- **Module production-standards + pipeline** — LOCKED: manifest · publish flow · lint gates ·
  commercial **editions** (ADR-0020-0023, **all four editions commercial** — Local-first's AGPL
  flank removed by **ADR-0083**); `tooling/`+`registry/` is the seam. **Open-core amendment (ADR-0094,
  2026-06-29):** the **Base substrate** (kernel·auth·tenancy-rls·ui·billing·credits·jobs·email·ai-config·
  mcp-server) is now **Apache-2.0**; editions + field-crypto + audit-worm + generator + registry +
  updates stay commercial. Re-licensing is **DONE in code** (work item W1, ADR-0094 + **ADR-0097**):
  the open registry contract split into Apache-2.0 `@caisson/registry-schema` (the commercial
  `@caisson/registry` service re-exports it); 11 base pkgs flipped to Apache-2.0/oss + Apache `LICENSE`
  files; the standards-gate enforces the license split + the open↔commercial no-depend-up boundary.
  Remaining W1 tail: `apps/site` licensing copy (design track owns that tree).
- **Site go-live posture** — LOCKED (**ADR-0082**): the site reads **live self-serve** (purchase CTAs,
  no waitlist), **committed prices** (no "indicative/subject-to-change" frame — supersedes ADR-0081),
  **artifacts true-to-built** (no fabricated CLI/CI for the unbuilt editions); Agentic-Dev the one
  labeled-roadmap exception. Real checkout + EULA drafting are tracked fast-follows.

## Still open (do NOT pre-bind)

- **Pricing FINAL adjustments** (anchors in ADR-0012, displayed point-values committed by ADR-0082) —
  the operator may still adjust a number before checkout goes live, but the site no longer **says** so;
  grandfathering policy stays operator-owned. The display fork is closed.

_Closed since: **app framework** → Next.js App Router (ADR-0044); **hosting/site deploy mode** →
one dynamic Next 16 `standalone` app (marketing + docs + buyer dashboard, Fumadocs MDX kept) on
**Railway**, superseding the ADR-0084 static-export-to-Cloudflare-Pages mode (ADR-0114/0115,
2026-06-30; built on the integration branch). **Currently still live on Cloudflare Pages** — the
Railway provisioning + DNS cutover + Pages teardown are DEPLOY-class and not yet done._

## Commits

Conventional commits, atomic, one logical change each. Scopes: `scaffold` `specs` `adr` `state`
`kickoffs` `tooling` `kernel` — plus the per-package scopes: `auth` `tenancy-rls`
`billing` `credits` `ai-config` `mcp` `ui` `audit-worm` `field-crypto` `compliance` `ai-kit`
`local-ai` `agent-dev` `cli` `support-bot` `license` `docs` `site` (the `apps/site` marketing+docs app).

## Relationship to gridwork-core

Global `~/CLAUDE.md` + the five auto-loaded gridwork rules apply. This file is additive.
Seeds are rebuilt clean from: gridwork-core, gridwork, gridworkdigital, Wardfile, tessera,
health-service, prospector. Provenance: `outputs/research/` (corpus + research + decisions —
the `library-research/` working dir was consolidated here, then deleted).
