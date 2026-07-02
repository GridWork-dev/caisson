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
2. `knowledge/decisions/` — the ADRs themselves (**0001–0203**: 0001–0024 founding+substrate+pipeline · 0040–0044 brand+crypto+framework · 0045–0049 Wave-0 substrate · 0050–0077 Wave-1 editions · 0078–0083 design+go-live · 0084–0088 GTM+collision-fix · 0089–0093 picker-round locks · 0094–0098 GTM-report+W1/B1 (open-core/offer/docs-svc/registry-split/credit-home) · 0099–0104 design-system harden+brand-mark+hero · 0105 support-bot impl · 0106–0109 P6 operator-gates (pricing/CF-Access/Paddle-MoR/support-bot-member-mgmt) · 0110–0113 P6 code-track (license-issuer/publish-flip/MCP-rate-limit/entitlement-revoke) · 0114–0115 unified-Railway-app + Railway-PG · 0116–0118 billing-scope + observability-SigNoz + analytics-Plausible · 0119–0128 reserved/proposed-only (adapter-expansion Tier-3, not filed) · 0129–0135 pricing + store-rework + harvest grill locks · 0136–0137 store-rework build wave (license-keyed registry gating + tooling opened to Apache-2.0 · edition reprice below-sum) · 0138 admin.caisson.sh operator control-plane + full-fleet observability charter · **0140–0176 Stage-2 four-stream build** (0140–0143 obs-admin · 0150–0153 harvest-modules · 0160–0162 edition-hardening · 0170–0176 base adapters + org account_member) · **0177–0178 provider picker** (0177 Grafana-sole-OTLP/PostHog/Linear+Cookiy/Greptile-PR-gate · 0178 edition members-fold) · **0179–0185 edition seam-completion locks** (OSCAL v1.2.2/JSON+XML-converter/all-3-frameworks · BYOK free+`apps/site` edge · transports-deferred · Bun-OTel manual spans) · **0189–0196 site-marketplace rework** (accent-lock reaffirm · Editions nav panel · 3-route marketplace+`/build` · single buy-verb · drawer-vs-cart · WCAG 2.2 AA floor · Martian-mono codify · sitewide ⌘K; 0186–0188 = LIFT sellables + audit driver) · **0197–0199 audit-remediation locks** (per-tenant CMK crypto-shred · BYOK per-action allowlist · tool-exec wired into Agentic-Dev) · **0187 + 0201–0202 editions-go-live locks** (support-impersonation dual-audit folded into compliance · live-transports GO-LIVE, supersedes the 0184 defer: AWS S3 WORM + OpenRouter both lanes + availability-gated ONNX · WORM retention-escalation extend-only+chain-evidenced) · **0200 + 0203 commerce-goes-live locks** (Paddle sole buyer webhook mount, Stripe driver dormant · Discord role-grant link + push; 0186 still reserved for agent-runner); append-only, all locked. **Ceiling 0203.**). Canonical ADR catalog: `docs/adr-index.md`
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
and better-auth buyer sign-in. The **2026-07-01 Stage-2 build** then merged four parallel streams +
the deploy-prep branch onto **`integration/stage2`**: Stream A obs-admin (`apps/admin` control-plane,
absorbs+removes `apps/studio`; SigNoz config; ADR-0140–0143) · Stream B harvest-modules (`@caisson/`
`alerting`/`retention-runner`/`tool-exec`/`audit-harness`; 0150–0153) · Stream C edition-hardening
(HIPAA/OSCAL · Bedrock/Azure/Ollama · MCP-HTTP · BYOK; 0160–0162) · Stream D base adapters + org
`account_member` (0170–0176). **D4 org accounts are ACTIVATED** (`getSession` resolves via
`account_member`, fail-safe to personal; `/dashboard/members` UI). Registry index rebuilt **27→32**.
The Railway services **`caisson-site` + `caisson-license` are LIVE + verified** (this branch's code).
Remaining is DEPLOY-class: **DNS cutover caisson.sh → Railway (off Cloudflare Pages) + Pages teardown**,
registry Worker redeploy (32-module index), and later `apps/admin` + SigNoz provisioning. Live
per-package truth: `docs/build-state.md`.

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
`model`, Workflow `agent()` `opts.model`). Route by work class:

- **fable** — critical-path only: security implementation/verification, crypto/money/license
  seams, the final adversarial verdict on a high-stakes finding.
- **opus** — bulk reviewers, judge panels, repo-scale synthesis.
- **sonnet** — bounded implementation (<~300 LOC), test writing, structured research/scan agents.
- **haiku** — recon, grep/classify/triage, mechanical sweeps, doc scans.

The main thread stays on the session model; this table governs dispatched agents only.

## Relationship to gridwork-core

Global `~/CLAUDE.md` + the five auto-loaded gridwork rules apply. This file is additive.
Seeds are rebuilt clean from: gridwork-core, gridwork, gridworkdigital, Wardfile, tessera,
health-service, prospector. Provenance: `outputs/research/` (corpus + research + decisions —
the `library-research/` working dir was consolidated here, then deleted).
