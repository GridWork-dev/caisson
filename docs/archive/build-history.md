---
updated: 2026-07-11
status: archived
---

# Caisson build chronology (archived from CLAUDE.md, 2026-07-11)

The per-sitting build-history narratives that accumulated in `CLAUDE.md` (the SoT-hierarchy
ADR-ceiling clause and the Cadence "current state" paragraphs), moved here verbatim in the
2026-07-11 doc-reconcile sweep. **Nothing here is live truth** — the ADR catalog is
`docs/adr-index.md`, per-package build truth is `docs/build-state.md`, the deploy log is
`docs/deploy/STATE.md`, and the work tracker is `docs/state/outstanding-work.md`. This file is
provenance: how the repo got built, sitting by sitting, in the words the working rules used at
the time.

## The ADR-ceiling narrative (CLAUDE.md SoT-hierarchy item 2, as of ceiling 0327)

Ceiling clause as it stood before the collapse: **Ceiling: ADR-0327** (0270 = the
edition-trace purge, license-seam-wave 2026-07-07; 0271 = the bundle-only index delist,
third-sitting picker 2026-07-07; 0272-0278 = the fourth-sitting research-response picker
2026-07-07 — site wave · design-partner program · evaluation access · evidence-pack
artifact · EULA continuity clause · named-regime crosswalks · priority-support SKU;
0279-0282 = the fifth-sitting locks: crosswalk claim posture mixed-by-proof-level refining
0277 · eval-verification hybrid-scoring flow refining 0274 · Postgres-required no-MySQL-lane
· EULA continuity parameters variant-A/12-month-N refining 0276; 0283-0284 = the
sixth-sitting locks: admin in-app GitHub OAuth replacing CF-Access · unified component
catalog + email consolidation; 0285 = the seventh-sitting marketplace one-surface rework —
unified grid + card viewer + stack rail, periphery standalone-but-feeding-cards, media
carousel + manifest; 0286-0287 = the eighth-sitting research picker: the admin intelligence
layer — local containerized daemon + admin intel page, all-four frameworks + monthly SOC2 ·
catalog wave-1 both-in-parallel — the S-effort driver batch + the Next.js starter template;
0288-0289 = the ninth-sitting deferred-item picker: priority-support SKU price+SLA ($999/yr ·
next-business-day, executes ADR-0278) · eval-delivery leg full-wave-next with the binding
watermark-before-issuance order, refines ADR-0274/0280); 0290-0291 = the tenth-sitting design
picker over the two gw-frontend-designer plans: marketplace media standard (live-component +
real-artifact static slides, all 28 re-standardized, no video, refines ADR-0285/0263) · UI
interactive-primitive expansion (split by complexity — simple in open @caisson/ui, Tooltip/
Popover/Menu in commercial ui-pro; hand-rolled zero-Radix, extends ADR-0099/0250);
0292-0294 = the eleventh-sitting lifecycle picker over the buyer-lifecycle audit:
license first-mint webhook-push at grant · in-app subscription management — status +
cancel + invoices, native not portal · chargeback subscribe-and-alert-only; 0295 = the
PR-#167 deviation lock: Drawer primitive + mobile-nav repoint enforced, marketplace-tabs
repoint dropped, refines ADR-0291; 0296 = the delta-review re-lock: mobile-nav reuses the
open Dialog drawer variant, ui-pro Drawer deleted, supersedes 0295 mechanism; 0297 = the
twelfth-sitting design-partner terms — 5 partners · 40% off · 12-month reverting ·
case-study contingent on conversion, executes ADR-0273; 0298 = the Kickoff-G
surface-remediation fork locks — twelve locks across footer/matrix stack, migration-list
unification, ai-keys gate, media/popout, docs full-sweep, email dark-mode, 2026-07-09;
0299 = the post-audit residual design locks — Mona-Sans zero-patch face, docs full
API-reference expansion, compare/diagram P3 dedupe, Kickoff-I spec-next, 2026-07-09;
0300-0302 = the Kickoff-H W3 commerce/license locks 2026-07-09 (renumbered from
0298-0300 at merge per ADR-0088) — read-only mutation gate as an admin lever only, no
dunning freeze · priority-support creditsPerCycle 1000 at Developer parity, executes the
0288 rider (b) · subscription-refund coverage-horizon claw, supersedes the 0269 Decision-6
accept; 0303 = the CF-Access gate scoped to the commerce surface 2026-07-10 — dashboard
and cart paths stay gated, marketing/docs/llms.txt/api serve public pre-launch for AI
indexing, amends the A2 lock + ADR-0107, applied live; 0304-0305 = the Kickoff-J pricing
picker 2026-07-10 — D3 anchor HOLD $1,049/$2,059 on the WTP memo · D2 corrected-and-closed,
licensing already per-org/no-seat per the EULA, surfaced as advantage copy; 0306-0309 =
the Kickoff-I scope-lock fork round 2026-07-09 — signature ambient depth-fog lattice field
with poster-first idle-hydrate + ≤130KB three.js-core budget, amends 0104 · sitewide
authored-motion pass executing 0078 §6 · marketplace media full-depth pass refining 0290,
F2 closes · lighthouse warn→error + wave evidence + ride-alongs; 0310-0313 = the
perf/mobile picker 2026-07-10 off the first error-level lighthouse evidence — homepage
hydration diet standard scope · perf config wave everything-measured · mobile nav
accordion + the search-stacking defect fix · CF JS-detections kill, terraform-pinned;
0314 = the Kickoff-K repo-local four-layer security-tooling stack + Strix harness
retirement, 2026-07-10; 0315 = the same-day close-out triage picker — four specs armed,
JSON-LD helper refactor, Renovate digest pins, refund-policy page answerable; 0316 =
the same-sitting admin-buildout locks — full six-wave cockpit, in-admin Loki,
PostHog federation, all riders; 0317 = 1Password as primary secret SoT + the
cred-parity sweep, amends 0224 F6; 0318 = the OSS-launch program locks 2026-07-10 —
sandbox validation gate, mirror backfill-at-cutover + append-only never-backdated,
Kickoff-L folded as W0, window → Show HN, the gated release train with GH-Release
trigger + everything-rides + fresh full re-audit per release; 0319 = the WTP-synthesis
response locks 2026-07-10 — the R3/R6/R8/R10 copy wave shipped true-to-built with ISO
27001 deliberately unclaimed, R5 code-access/demo emphasis, the screened panel re-run
deferred until an anchor move pends, TRADEMARK.md drafted in-repo for lawyer redline;
0320 = the Kickoff-N affiliate program parameters 2026-07-10 — fixed 10% buyer
discount / 30% commission stamped per-row at mint, public copy trued to the flat rate,
discount_id captured on both one-time and subscription paths, refines 0315; 0321 =
the Kickoff-M OSS-launch close-out locks 2026-07-10 — LICENSE restamp to Caisson
Software LLC (member identity stays out of repo), a standing perpetual "everything"
test-license kept forever/never published, the live retrieval-golden leg gated at
release-readiness not PR CI, and the registry P0s CAISSON-85/86 riding the W4 train;
no in-branch version cut, changesets are consumed only in the operator-gated publish,
executes 0318; 0322 = the Codex production-browser audit lane — GPT-5.6 repo skill,
three rings, probe-account mutations with mandatory verified reverts,
advisory-to-deterministic graduation boundary; drafted 0320, renumbered at merge per
ADR-0088 — Kickoff-N claimed 0320 first; 0323 = the browser-audit remediation full-wave +
Cookiy-response picker 2026-07-11 — all 7 findings one wave, Playwright graduation after
fixes, Ring-2/3 probe profiles operator act, trust/copy + architecture-diagram build with
the sandbox demo spec-first; 0324 = the caisson.sh email architecture 2026-07-11 —
admin/support/security/no-reply role map, Resend sender flip to no-reply@ with Reply-To
support@, hello@ retired, stale CF email-routing artifact deleted, execution rides Kickoff O;
0325 = the release-train commit-addressable provenance rework 2026-07-11 — version PR →
tag → publish exactly the tagged bytes, one SHA anchors source/ledger/tarballs/evidence,
amends 0318/0223, locked off the Codex host/CI audit; 0326 = the CI-runner lock 2026-07-11 —
the caisson hot path migrates to Blacksmith VM-per-job runners off the shared box, credential
jobs stay GitHub-hosted, the caisson-amd64 scale set retires at verified cutover; 0327 = the
audit follow-on picks 2026-07-11 — scan-gate required flip sequenced after CAISSON-95,
GitHub Environments as a CAISSON-94 rider, drift control via sot-check extension, branch
protection stays discipline-only).

Numbers below 0270 are narrated only in `docs/adr-index.md` (the CLAUDE.md clause was pruned
to 0270+ in the 2026-07-07 root-slim; earlier prunes live in git history of `CLAUDE.md`).

## The Cadence "current state" narrative (CLAUDE.md, as of 2026-07-11)

Current state: **P0+P1, Wave-0 substrate, Wave-1 editions (merged-but-partial), P5
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
(`docs/archive/harvest-program.md`): net-new `@caisson/agent-runner` (ADR-0186), a 10-package
hardening wave, and kernel branded-money (ADR-0210–0217, drafted 0204–0211 and renumbered at merge
per ADR-0088). **PR #51** also landed the CI/credit rework: Greptile auto-review replaced by the
path-scoped `greptile-gate` required check and the fleet jobs re-pointed to the `caisson-amd64`
runscaler scale set.

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
`docs/archive/opportunity-backlog.md` ledger · #76 compliance reprice display · #77 cred-sweep prep
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

**2026-07-05/06 (kickoff waves A/B then the E/F/D triple-merge):** the SOT expansion (PR #126 —
the `docs/state/` doc set + `bun run sot` drift tool + picker ADR-0243..0250) and Kickoff B
hygiene (PR #127) landed 07-05; the remaining pool split into three parallel kickoffs that ALL
merged 2026-07-06: **E** independent-build-wave (PR #128, ADR-0251-0256 — per-entitlement
updates-window edge enforcement, renewal SKU plumbing, credit FIFO expiry, inspector, generated
build-state counts, measurement pair), **F** dx-demos-compat (PR #129, ADR-0262-0268 —
interactive create-caisson + deploy templates, Remotion media, emitter IR-activation + new
targets, Drizzle/Prisma bridges, GCS/R2 WORM, GCP KMS + named AI lanes), and **D** the catalog
program (PR #130, ADR-0257-0261 — the **six-bundle catalog rework**: editions DISSOLVED into
compliance/ai-production/local-first/agentic-dev/provenance/everything at
$1,049/$739/$629/$329/$399/$2,059, five W1 carve extractions, credits commercial flip, the W7
Paddle SANDBOX big-bang with editions archived, all 22 modules à-la-carte, legacy entitlement
ids resolving forever via the single alias point, and the SHIP-audit remediation — notably:
license tokens sign PURCHASED ids, never the index expansion, or the Worker's purchased-id-keyed
`updatesWindows` fold goes silently fail-open). Greptile formally retired as ADR-0261. The same
day closed with two more merges: **PR #131** hygiene + package standards (CAISSON-24
compliance→bundle republish + the 14-changeset version cut, ADR-0269 Developer-plan
owned-entitlements coverage, `@caisson/ui` exports fix, the pg-pool idle-error guard, CLI
six-bundle vocabulary) and **PR #132** site-design-3 (six-bundle homepage + merged marketplace
nav, module preview modal, `/updates` absorbing `/changelog`, commerce lifecycle emails +
dashboard live updates-window with the ADR-0260 §5 40%-X9 renewal display, admin pg-pool 502
fix) — both through the in-session SHIP audit lane. `main` single-branch, ceiling 0269, sot green.

Waves after 2026-07-06 (Kickoffs G through O, the audit-response sittings, the Blacksmith
cutover) are chronicled in `docs/adr-index.md` per-sitting sections, the per-kickoff files under
`outputs/kickoffs/`, and the session memories — they were never narrated in CLAUDE.md.
