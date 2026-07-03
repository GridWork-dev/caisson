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
2. `knowledge/decisions/` — the ADRs themselves (**0001–0209**: 0001–0024 founding+substrate+pipeline · 0040–0044 brand+crypto+framework · 0045–0049 Wave-0 substrate · 0050–0077 Wave-1 editions · 0078–0083 design+go-live · 0084–0088 GTM+collision-fix · 0089–0093 picker-round locks · 0094–0098 GTM-report+W1/B1 (open-core/offer/docs-svc/registry-split/credit-home) · 0099–0104 design-system harden+brand-mark+hero · 0105 support-bot impl · 0106–0109 P6 operator-gates (pricing/CF-Access/Paddle-MoR/support-bot-member-mgmt) · 0110–0113 P6 code-track (license-issuer/publish-flip/MCP-rate-limit/entitlement-revoke) · 0114–0115 unified-Railway-app + Railway-PG · 0116–0118 billing-scope + observability-SigNoz + analytics-Plausible · 0119–0128 reserved/proposed-only (adapter-expansion Tier-3, not filed) · 0129–0135 pricing + store-rework + harvest grill locks · 0136–0137 store-rework build wave (license-keyed registry gating + tooling opened to Apache-2.0 · edition reprice below-sum) · 0138 admin.caisson.sh operator control-plane + full-fleet observability charter · **0140–0176 Stage-2 four-stream build** (0140–0143 obs-admin · 0150–0153 harvest-modules · 0160–0162 edition-hardening · 0170–0176 base adapters + org account_member) · **0177–0178 provider picker** (0177 Grafana-sole-OTLP/PostHog/Linear+Cookiy/Greptile-PR-gate · 0178 edition members-fold) · **0179–0185 edition seam-completion locks** (OSCAL v1.2.2/JSON+XML-converter/all-3-frameworks · BYOK free+`apps/site` edge · transports-deferred · Bun-OTel manual spans) · **0189–0196 site-marketplace rework** (accent-lock reaffirm · Editions nav panel · 3-route marketplace+`/build` · single buy-verb · drawer-vs-cart · WCAG 2.2 AA floor · Martian-mono codify · sitewide ⌘K; 0186–0188 = LIFT sellables + audit driver) · **0197–0199 audit-remediation locks** (per-tenant CMK crypto-shred · BYOK per-action allowlist · tool-exec wired into Agentic-Dev) · **0187 + 0201–0202 editions-go-live locks** (support-impersonation dual-audit folded into compliance · live-transports GO-LIVE, supersedes the 0184 defer: AWS S3 WORM + OpenRouter both lanes + availability-gated ONNX · WORM retention-escalation extend-only+chain-evidenced) · **0200 + 0203 commerce-goes-live locks** (Paddle sole buyer webhook mount, Stripe driver dormant · Discord role-grant link + push; 0186 still reserved for agent-runner) · **0204 strix-pentest-remediation lock** (SSRF resolve-and-recheck kernel guard · `X-Real-IP`-keyed rate-limit + header-independent global cap · admin CF-Access-JWT middleware, supersedes 0140's edge-alone posture · owner-gated BYOK/attestations · Paddle multi-item lineItems fulfillment) · **0205–0209 edition-tails-ops locks** (0205 compliance runtime-composes alerting+retention-runner, closing the 0178 manifest-vs-composition gap · 0206 support-bot escalations→Linear Triage sink · 0207 admin /ops cockpit rebuilt on the Grafana Cloud Tempo query API · 0208 ops-hardening bundle (BYOK/attestation owner-gate, 0.2.0 registry ledger/index republish, Terraform R2 use_lockfile note) · 0209 local-ai Azure OpenAI + AWS Bedrock RentedTransport drivers — drafted 0204–0208, renumbered to 0205–0209 at merge since the Strix ADR claimed 0204 on `main` first, ADR-0088 convention) · **0186 + 0210–0217 lift-harvest slice-2 wave** (0186 agent-runner sandboxed+governed, filed from its reservation · 0210 reconcile + wave lock · 0211 jobs consumer-side · 0212 kernel branded-money/rounding-provenance · 0213 ai-kit metered embeddings · 0214 ai-evals eval-science depth · 0215 guardrails egress-gate+FTC-4Ps · 0216 mcp-server manifest retirement ledger · 0217 ai-meter dedup-before-meter — drafted 0204–0211, renumbered at merge per ADR-0088) · **0218–0221 deferred-respec picker locks** (0218 Paddle per-line partial refund, supersedes the 0113 full-refund clause · 0219 CF front rate-limit, docs-api proxied + Free tier · 0220 admin mutation surface v1, supersedes the 0141 mutation defer, dedicated `admin_write` role · 0221 live seams KMS proof + ONNX disposition, extends 0201) · **0222 distribution lock** (caisson-sh GitHub org + @caisson-sh public npm scope + mirror-owned npmjs publishing + credit-pack $49 / agent-runner $49 catalog completion) · **0223 registry self-hosted npm delivery** (`registry.caisson.sh` serves the npm install protocol — packuments + tarballs, license-token-authed; option-A + 8 sub-forks A1–H1; supersedes the dead GH-Packages buyer channel, generator + docs flip pending the build) · **0224 live-verification harness fork locks** (F1–F6 seam proofs, test-only, extends ADR-0201; F1 BOTH + F3 FULL-grant override the spec rec) · **0225–0227 third-picker-round locks** (0225 admin-v2 purchase-revoke — DB-only revoke + credit claw, source-scoped, one-time-only, EDGE REVOCATION LIST built in per the R-4 override; extends 0113/0218/0220 · 0226 pre-launch credential-sweep — fresh launch issuer keypair, `tooling/scripts/vault-parity-check.ts` name-parity, on-incident-only rotation per the Fork-4 override; extends 0224 F6 · 0227 compliance reprice $749→$799, below-sum invariant kept + all 14 per-module Paddle SANDBOX products created now per the posture override; supersedes the 0137 compliance number); **0218–0221 built + adversarially reviewed + MERGED 2026-07-02 (PRs #66–69); 0222–0227 locked same day** · **0228 members-fold republish second wave** (MF-A/B/C EXECUTED — all 24 pending changesets consumed, both edition `members` maps repinned, ledger 65→98 + index rebuilt, dry-run kept; extends 0208 §5, realizes 0186 F5) · **0229–0232 fourth-picker-round locks (2026-07-03)** (0229 wave-6 disposition — the compliance/billing 10-row subset builds as ONE spec/workflow/PR set, rest roadmap-only; extends 0210 §3–4 · 0230 WORM retention posture — GOVERNANCE now, COMPLIANCE at the launch flip via the 0202 gated path · 0231 OSCAL AP rlink — signed evidence bundle, relative rlinks + hashes, sibling-dir; reverses 0208 §4, amends 0179 · 0232 SEO union-renderer trigger N~20+/single-initiative + GLOSSARY PROGRAM PRE-COMMITTED per the Fork-C override, own product SPEC with the renderer as implementation detail · 0233 audit-harness v2 locks — per-dir derived+gated domain matrix, advisory, fresh ledger, oss-mirror both-views, standalone rubric per the Fork-E override; amends 0134/0188 · 0234 ask-AI widget locks — dual model lanes + both placements + expanded corpus + Turnstile, four overrides) · **0235–0236 fifth-picker-round locks (2026-07-03)** (0235 glossary-program five fork locks — 32 terms locked, adversarial agent-workflow authoring per the Fork-B override, cluster batches, curated interlinks, footer nav; realizes 0232 · 0236 ask-AI question-text capture with consent notice + 90-day retention, overriding the defer rec; extends 0234 F6 · 0237 site-presentation-rework eight fork locks + two riders — unified /marketplace hub superseding 0191, nav rebuild (centered links, three card panels, right utility cluster), module depth routes on the renderer with a media slot, TRUE module-id renames for the compliance/ai-kit collisions, bespoke icon set, full-surface copy rewrite, split analytics extending 0118, brand system tweakable (rider 1) + FULL V1-live posture retiring the 0082 Agentic-Dev roadmap exception (rider 2); three overrides) · **0238 drop the four edition-core à-la-carte rows** (11-module standalone
   catalog; F5 collision resolved by removal — grants were whole-edition and no separable core
   artifact exists; extends 0237 F5, supersedes 0227's 14-sellable clause) · **0239–0241 deploy-closeout picker locks (2026-07-03)** (0239 wave-6 close-out — the 9 remaining build-next rows built as wave-6b, ledger terminal, 28 trigger rows stay parked; amends 0229/0210 §4 · 0240 local-ai $349 canonical — affirms 0137 over 0129, no number change · 0241 changeset internal-prose source gate — standards-gate check, formatter rejected, pending-22 hand-swept); append-only, all locked. **Ceiling 0241.**). Canonical ADR catalog: `docs/adr-index.md`
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
registry ledger republish to 0.2.0; ADR-0205–0209) both merged to `main`.
The same-day deploy wave then **EXECUTED** (operator-approved): the 5 Railway services redeployed
from merged `main` (4/5 verified live; `caisson-support-bot` recovering from a transient Discord
CF-1015 egress-IP ban at first boot), the registry Worker redeployed (0.2.0 index verified, zero
drift), `caisson-admin`'s CF-Access + Grafana env and `caisson-support-bot`'s Linear env set, and
the 3 orphaned SigNoz volumes deleted (Railway soft-delete, purge 2026-07-04). **PR #47
lift-harvest slice-2** then merged same-day — the harvest program driven to **terminal state**
(`docs/state/harvest-program.md`): net-new `@caisson/agent-runner` (ADR-0186), a 10-package
hardening wave, and kernel branded-money (ADR-0210–0217, drafted 0204–0211 and renumbered at merge
per ADR-0088; the canonical ADR ceiling now lives in the SoT-hierarchy header above — **0224**, not 0217). **PR #51** also landed the CI/credit rework: Greptile
auto-review replaced by the path-scoped `greptile-gate` required check (see the PR review gate
section) and the fleet jobs re-pointed to the `caisson-amd64` runscaler scale set. Live
per-package truth: `docs/build-state.md`.

**2026-07-02-PM (org move + 11-PR merge day):** the repo home moved to
**`github.com/caisson-sh/caisson`** (transferred into the new `caisson-sh` GitHub org; the runner
scale sets on the box + Mac mini were re-pointed — the stale scale set had to be deleted + recreated,
and the Greptile app was reinstalled on the new org). **Eleven PRs merged to `main` this session:**
the ADR-0218–0221 deferred-respec wave (PRs #66–69, built + adversarially reviewed), the greptile-gate
latency fix + narrowed tooling glob (#60), a Railway env-sync tool (#63), the mirror exporter + sync/
publish pipeline (#64), the ADR-0222 distribution lock + legal-MoR copy + public-surface map (#61), the
live-harness spec (#65), and the registry npm-delivery spec + ADR-0223 (#70) + a post-wave hardening
triage spec (#71). **`caisson-sh/caisson-oss` was created PRIVATE** with the first 416-file mirror
snapshot pushed; `NPM_TOKEN` + `MIRROR_PUSH_TOKEN` are set (the mirror sync + npm publish pipelines are
**fully armed but publish stays gated on a manual `confirm=publish` dispatch**); npm org `caisson-sh`
holds the `@caisson-sh` scope. Env reconcile: 19 caisson-specific vars moved to
`~/.gridwork/caisson.env` (source-chained from `~/.gridwork/env`). Linear issues **CAISSON-5..19** filed
for all deferred review findings. **ADR ceiling → 0227** (0222 distribution · 0223 registry
self-hosted npm delivery · 0224 live-harness fork locks · 0225–0227 the same-day third picker
round: admin-v2 purchase-revoke · pre-launch credential sweep · compliance reprice + module
catalog).

**2026-07-02-LATE (execution wave + DEPLOY block):** the locked backlog EXECUTED as parallel
worktree workflows and merged serially: **PRs #75–#83 all merged** (#75 third-round locks + the
`docs/state/opportunity-backlog.md` ledger · #76 compliance reprice display · #77 cred-sweep prep
(vault-parity tool + KMS policy fix) · #78 mutation-route error mapping · #79 WORM S3 gate +
provisioning script · #80 members-fold republish **ADR-0228** · #81 live-verification harness
(ADR-0224 F1–F6) · #82 infra DNS truth · #83 registry self-hosted npm delivery build, ADR-0223)
with **#84 admin-v2 purchase-revoke (ADR-0225, incl. the R-4 edge revocation deny-set)** riding the
same queue. The §7 launch-runbook **DEPLOY block EXECUTED** (operator-approved): live migrations
`0006`–`0009` applied after a read-only checksum-drift bless (CAISSON-16), the admin mutation
surface provisioned + live-verified — grant→revoke round-trip with dual logs, WORM anchors in
`caisson-worm` under Object-Lock (GOVERNANCE, 2033) and the `admin_app` grantee gap fixed
(CAISSON-17/18), the CF edge rate-limit terraformed + 429-proven on `/query` (CAISSON-15), the 4
Paddle SANDBOX edition prices re-pointed (compliance 79900 per ADR-0227). Merge-queue CI gotchas
fixed on the way: the turbo bun-node shim breaks `node --check` (cli smoke resolves real node), and
the license PGlite integration suite got a 30s `setDefaultTimeout` (5s default flakes under runner
load). Linear CAISSON-15/16/17/18 Done.

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
- **Site go-live posture** — LOCKED (**ADR-0082**, amended by **ADR-0237 rider 2**): the site reads
  **live self-serve** (purchase CTAs, no waitlist), **committed prices** (no
  "indicative/subject-to-change" frame — supersedes ADR-0081), **artifacts true-to-built** as the
  floor, and — per 0237 rider 2 — **FULL V1-live posture**: no roadmap labels, no "coming soon", no
  future framing anywhere; the old Agentic-Dev labeled-roadmap exception is RETIRED. Real checkout +
  EULA have since shipped.

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

## PR review gate (greptile-gate, path-scoped — PRs #51 + #60, 2026-07-02)

**`greptile-gate` is the required status check** on `main` (alongside `check`, `standards-gate`,
`registry-index`, `oscal-conformance`); the old blanket `Greptile Review` requirement is retired.
Greptile auto-review is OFF (`.greptile/config.json` → `skipReview: AUTOMATIC`,
`triggerOnUpdates: false`) — reviews run **only when the gate @-mentions `@greptileai`**, and it
does that only for PRs whose diff touches a **security-critical path** (auth · tenancy-rls ·
field-crypto · audit-worm · billing · credits · ai-meter · license · tool-exec · the CI/review
config itself; the glob set lives in `.github/workflows/greptile-gate.yml`, keep in sync with
`.greptile/rules.md`). **PR #60 (2026-07-02)** narrowed the `tooling/` critical-path glob to
`tooling/standards-gate/src/` (the standards-gate logic only — not the whole tooling tree) and tuned
the latency: the gate now **waits up to 35 min** for a completed review **inside a 40-min job
ceiling**. Non-critical PRs (docs, site copy, tests) merge on the ordinary required
checks alone — the gate passes without burning a review. On a critical PR the gate requires a
completed review, re-triggers once if critical paths changed since the last-reviewed commit, and
fails (never silently passes) on timeout. A green gate reflects the confidence score only — still
resolve every inline P0/P1 finding first. On-demand local review: the gridwork-core `/greptile`
skill; manual trigger: `gh pr comment <PR> --body "@greptileai"`.

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

## Agents, skills, tools — the caisson lens (2026-07-02)

The agent roster, skills, and MCPs are GLOBAL (owned by gridwork-core, linked via `~/.claude`)
— this section is the caisson-relevant subset + bindings, NOT a second registry. Canonical:
roster `gridwork-core claude/agents/INDEX.md` · skills = `/<name>` slash commands
(`claude/playbooks/user-triggered/`) · MCP pick-table `identity/mcps.md` · everything else
routes via `identity/index.md`.

**Agents that carry caisson's recurring jobs** (dispatch with explicit `model`; all sonnet lane):

| Agent                    | Cadence / trigger                | Job                                                                                                           |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `gw-product-insights`    | per-release / monthly            | PostHog (caisson-prod, id 493539) + Cookiy + GitHub issues + Linear → ranked priorities + draft Linear issues |
| `gw-aeo-strategist`      | per-launch + quarterly           | do LLMs cite caisson; llms.txt / robots / schema.org fixes                                                    |
| `gw-pricing-analyst`     | quarterly + per-edition          | competitor scrape + checkout funnel + WTP memo; never sets a price                                            |
| `gw-persona-walkthrough` | before landing/checkout ships    | per-scroll conversion-psych critique → hands to gw-frontend-designer                                          |
| `gw-devrel-writer`       | per-release                      | launch post / changelog / tutorial drafts, diff-grounded; operator publishes                                  |
| `gw-market-intel`        | monthly + competitor events      | category/competitor watch → cited briefing + draft Linear tickets                                             |
| `gw-gtm-copywriter`      | per comparison page / case study | claims scraped + dated, PAL-challenged; stops at a committed branch                                           |

Engineering lanes (`gw-typescript-pro`, `gw-code-reviewer`, `gw-security-auditor`,
`gw-test-automator`, …) route per `identity/doctrine.md` — nothing caisson-specific.

**Caisson-specific tool bindings:**

- **PostHog MCP** → project `caisson-prod` (US Cloud) — state it per dispatch, never assume carry-over.
- **Linear MCP** → work items only (Linear owns WORK, git owns DECISIONS — §Issue tracking above).
- **Cookiy MCP** → screeners / synthetic-persona tests / survey research; positioning research only, no PII.
- **CI** → `runs-on: caisson-amd64` (runscaler scale set on gw-ms-a2; bare name, no extra labels).
  `oscal-conformance` (Maven) + `deploy-railway` (prod token) stay hosted. Review gate = `greptile-gate`
  (path-scoped, §PR review gate above).
- **GLM engine lane** (`gw engine glm "<task>"`) → bounded mechanical work on the z.ai subscription;
  sandboxed throwaway worktree, no secrets/MCPs, returns a diff — main thread owns git/PR.

## Relationship to gridwork-core

Global `~/CLAUDE.md` + the five auto-loaded gridwork rules apply. This file is additive.
Seeds are rebuilt clean from: gridwork-core, gridwork, gridworkdigital, Wardfile, tessera,
health-service, prospector. Provenance: `outputs/research/` (corpus + research + decisions —
the `library-research/` working dir was consolidated here, then deleted).
