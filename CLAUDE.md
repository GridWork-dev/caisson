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
2. `knowledge/decisions/` — the ADRs themselves (**0001–0209**: 0001–0024 founding+substrate+pipeline · 0040–0044 brand+crypto+framework · 0045–0049 Wave-0 substrate · 0050–0077 Wave-1 editions · 0078–0083 design+go-live · 0084–0088 GTM+collision-fix · 0089–0093 picker-round locks · 0094–0098 GTM-report+W1/B1 (open-core/offer/docs-svc/registry-split/credit-home) · 0099–0104 design-system harden+brand-mark+hero · 0105 support-bot impl · 0106–0109 P6 operator-gates (pricing/CF-Access/Paddle-MoR/support-bot-member-mgmt) · 0110–0113 P6 code-track (license-issuer/publish-flip/MCP-rate-limit/entitlement-revoke) · 0114–0115 unified-Railway-app + Railway-PG · 0116–0118 billing-scope + observability-SigNoz + analytics-Plausible · 0119–0128 reserved/proposed-only (adapter-expansion Tier-3, not filed) · 0129–0135 pricing + store-rework + harvest grill locks · 0136–0137 store-rework build wave (license-keyed registry gating + tooling opened to Apache-2.0 · edition reprice below-sum) · 0138 admin.caisson.sh operator control-plane + full-fleet observability charter · **0140–0176 Stage-2 four-stream build** (0140–0143 obs-admin · 0150–0153 harvest-modules · 0160–0162 edition-hardening · 0170–0176 base adapters + org account_member) · **0177–0178 provider picker** (0177 Grafana-sole-OTLP/PostHog/Linear+Cookiy/Greptile-PR-gate · 0178 edition members-fold) · **0179–0185 edition seam-completion locks** (OSCAL v1.2.2/JSON+XML-converter/all-3-frameworks · BYOK free+`apps/site` edge · transports-deferred · Bun-OTel manual spans) · **0189–0196 site-marketplace rework** (accent-lock reaffirm · Editions nav panel · 3-route marketplace+`/build` · single buy-verb · drawer-vs-cart · WCAG 2.2 AA floor · Martian-mono codify · sitewide ⌘K; 0186–0188 = LIFT sellables + audit driver) · **0197–0199 audit-remediation locks** (per-tenant CMK crypto-shred · BYOK per-action allowlist · tool-exec wired into Agentic-Dev) · **0187 + 0201–0202 editions-go-live locks** (support-impersonation dual-audit folded into compliance · live-transports GO-LIVE, supersedes the 0184 defer: AWS S3 WORM + OpenRouter both lanes + availability-gated ONNX · WORM retention-escalation extend-only+chain-evidenced) · **0200 + 0203 commerce-goes-live locks** (Paddle sole buyer webhook mount, Stripe driver dormant · Discord role-grant link + push; 0186 still reserved for agent-runner) · **0204 strix-pentest-remediation lock** (SSRF resolve-and-recheck kernel guard · `X-Real-IP`-keyed rate-limit + header-independent global cap · admin CF-Access-JWT middleware, supersedes 0140's edge-alone posture · owner-gated BYOK/attestations · Paddle multi-item lineItems fulfillment) · **0205–0209 edition-tails-ops locks** (0205 compliance runtime-composes alerting+retention-runner, closing the 0178 manifest-vs-composition gap · 0206 support-bot escalations→Linear Triage sink · 0207 admin /ops cockpit rebuilt on the Grafana Cloud Tempo query API · 0208 ops-hardening bundle (BYOK/attestation owner-gate, 0.2.0 registry ledger/index republish, Terraform R2 use_lockfile note) · 0209 local-ai Azure OpenAI + AWS Bedrock RentedTransport drivers — drafted 0204–0208, renumbered to 0205–0209 at merge since the Strix ADR claimed 0204 on `main` first, ADR-0088 convention); append-only, all locked. **Ceiling 0209.**). Canonical ADR catalog: `docs/adr-index.md`
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
(ADR-0118)**, plus the 2026-06-30 **store-rework build wave** — an on-site cart + multi-item Paddle
checkout, an edition reprice below module-sum (**ADR-0137**), license-keyed registry gating with the
ships-with-generator tooling (`cli`/`migrate`/`license-verify`) opened to Apache-2.0 (**ADR-0136**),
and better-auth buyer sign-in. The **2026-07-01 Stage-2 build** merged four parallel streams to
`main` (PR#33): Stream A obs-admin (`apps/admin` control-plane, absorbs+removes `apps/studio`;
ADR-0140–0143) · Stream B harvest-modules (`@caisson/alerting`/`retention-runner`/`tool-exec`/
`audit-harness`; 0150–0153) · Stream C edition-hardening (HIPAA/OSCAL · Bedrock/Azure/Ollama ·
MCP-HTTP · BYOK; 0160–0162) · Stream D base adapters + org `account_member` (0170–0176, **D4 org
accounts ACTIVATED**), then **DEPLOYED to Railway with DNS cut over off Cloudflare Pages** (Pages
project since torn down). Registry index rebuilt 27→32. Since then the provider-picker + edition
seam-completion, LIFT slice-1, and the editions/commerce go-live locks landed, and — **latest,
2026-07-02** — **PR #45 Strix pentest remediation** (SSRF kernel guard, rate-limit trusted-IP
keying, admin CF-Access-JWT middleware, owner-gated BYOK/attestations, Paddle multi-item
fulfillment; ADR-0204) and **PR #46 edition-tails-ops** (Azure/Bedrock RentedTransport drivers,
compliance runtime composition, support-bot Linear Triage sink, admin `/ops` Grafana rebuild,
registry ledger republish to 0.2.0; ADR-0205–0209) both merged to `main`. **ADR ceiling is now 0209.**
The same-day deploy wave then **EXECUTED** (operator-approved): the 5 Railway services redeployed
from merged `main` (4/5 verified live; `caisson-support-bot` recovering from a transient Discord
CF-1015 egress-IP ban at first boot), the registry Worker redeployed (0.2.0 index verified, zero
drift), `caisson-admin`'s CF-Access + Grafana env and `caisson-support-bot`'s Linear env set, and
the 3 orphaned SigNoz volumes deleted (Railway soft-delete, purge 2026-07-04). Live per-package
truth: `docs/build-state.md`.

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
  mcp-server) is now **Apache-2.0**; editions + field-crypto + audit-worm + registry-service + updates
  stay commercial. Re-licensing is **DONE in code** (work item W1, ADR-0094 + **ADR-0097**):
  the open registry contract split into Apache-2.0 `@caisson/registry-schema` (the commercial
  `@caisson/registry` service re-exports it); 15 base pkgs flipped to Apache-2.0/oss + Apache `LICENSE`
  files (ADR-0136 added cli·migrate·license-verify — incl. the generator — to the open Base set); the
  standards-gate enforces the license split + the open↔commercial no-depend-up boundary.
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
2026-06-30). **DEPLOYED 2026-07-01** — all services LIVE on Railway (caisson.sh/www/admin/license +
docs + support-bot + SigNoz), DNS cut over to Railway, and the Cloudflare Pages project torn down._

## Commits

Conventional commits, atomic, one logical change each. Scopes: `scaffold` `specs` `adr` `state`
`kickoffs` `tooling` `kernel` — plus the per-package scopes: `auth` `tenancy-rls`
`billing` `credits` `ai-config` `mcp` `ui` `audit-worm` `field-crypto` `compliance` `ai-kit`
`local-ai` `agent-dev` `cli` `support-bot` `license` `docs` `site` (the `apps/site` marketing+docs app)
— plus the Stage-2 additions: `admin` (`apps/admin` control-plane) `alerting` `retention-runner`
`tool-exec` `audit-harness` `observability` `platform-reads` `migrate` `pricebook`.

## PR review gate (Greptile required)

`Greptile Review` is a **required status check** on `main` (alongside `check`, `standards-gate`,
`registry-index`) — no PR merges until it is green against the head commit. Config lives in
`.greptile/`: `config.json` sets `statusCheck: true` + `triggerOnUpdates: true` (posts the check on
every PR, re-reviews every push, no file-count skip); `rules.md` = the repo invariants Greptile
enforces. TREX execution runs _under_ that one review (org-level toggle, $2/run) — not a separate check.

**When Greptile skips a PR** (draft, excluded author/branch/label, oversized diff, still-indexing) the
required check never posts and the PR is stuck at "waiting for status." Force it:
`gh pr comment <PR> --body "@greptileai"` — a manual mention overrides the skip filters and posts the
check. Never merge until `Greptile Review` is green against the head SHA; a green check reflects the
confidence score only, so still resolve every inline P0/P1 finding first. Full agent workflow: the
gridwork-core `/greptile` skill (rules 7–9).

## Issue tracking (Linear)

Caisson uses **Linear** (Business tier) for execution tracking + inbound triage via the `linear` MCP.
**The boundary is binding: Linear owns WORK, git owns DECISIONS.** Full design + operating manual:
`docs/state/linear-integration.md` (ADR-0177 / PF-3).

- **Never lock a decision in Linear.** ADRs (`knowledge/decisions/`) + `decisions-and-forks.md` stay the
  git-native decision SOT. A Linear issue may _reference_ an ADR/fork by id; it never replaces one.
- Create/update issues via the `linear` MCP (`save_issue`/`save_project`/`list_issues`) in team `Caisson`
  (key `CAISSON`), project = area (Platform & Infra · Site & Buyer Dashboard · Editions & Registry ·
  Support & Docs). Put the runbook/context in the description; reference the ADR + link the PR.
- Use the issue's `gitBranchName` for the feature branch → auto-links the PR (Code Intelligence). Move
  status In Progress → In Review → Done across EXECUTE→SHIP; the decision still lands as an ADR/commit.
- **Delegate** a first-pass (scope/triage) to the built-in **Linear Agent**; the human stays owner and
  Claude Code does the real in-repo build. Don't mirror the whole fork board into Linear — only work items.

## Subagent model routing (binding)

Never default a subagent to Fable 5 — set `model` explicitly on every dispatch (Agent tool
`model`, Workflow `agent()` `opts.model`). The full lane table is canonical in gridwork-core
`identity/doctrine.md` (Model-routing lanes — promoted from this file 2026-07-02; gw agents
now also carry a harness-read `model:` frontmatter baseline). Caisson-specific note: fable
is for the crypto/money/license seams this repo is full of — never for fan-out.

## Relationship to gridwork-core

Global `~/CLAUDE.md` + the five auto-loaded gridwork rules apply. This file is additive.
Seeds are rebuilt clean from: gridwork-core, gridwork, gridworkdigital, Wardfile, tessera,
health-service, prospector. Provenance: `outputs/research/` (corpus + research + decisions —
the `library-research/` working dir was consolidated here, then deleted).
