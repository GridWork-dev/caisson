---
updated: 2026-07-09
status: live
grounds:
  - docs/state/outstanding-work.md
  - docs/state/launch-runbook.md
  - docs/deploy/STATE.md
  - docs/state/live-transport-checklist.md
---

# Production readiness — Caisson

Six-dimension readiness assessment from the 2026-07-09 whole-repo sweep (16-agent discovery +
2-agent re-run, every claim evidence-cited at assessment time). Verdicts use three grades:
**ready** (no blocking gaps) · **gaps** (launchable posture with named debt) · **blocked**
(cannot take real money / go public until fixed). The launch-day execution order lives in
`docs/state/launch-runbook.md`; this doc is the _state_, not the runbook. Items marked
**(tracked)** have a row in `docs/state/outstanding-work.md`.

## Verdicts

| Dimension        | Verdict     | One-line state                                                                                                            |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Deploy / infra   | **gaps**    | All 5 Railway services + Worker deployed from current main, live-verified; no undeployed code debt on main                |
| Security         | **gaps**    | Strix round-1 fully remediated; credential sweep executed 2026-07-08; named debt below                                    |
| Commerce         | **BLOCKED** | Everything built + sandbox-proven end-to-end; no Paddle production account/catalog, EIN in flight — deliberate pre-launch |
| Operational      | **gaps**    | Telemetry + intel daemon live; **Railway Postgres backup/PITR never configured** — the one true operational blocker       |
| Buyer experience | **gaps**    | All 3 P0 + 12 P1 lifecycle-audit gaps verified fixed in code; residue is the operator launch checklist                    |
| Quality gates    | **gaps**    | 4-check CI gate real and green; "required" is discipline (no branch protection on the private plan)                       |

## True go-live blockers (consolidated)

Everything a real first sale requires that does not exist today. All are known, tracked, and
mostly operator-owed — none are silent breakage:

1. **Paddle production account + catalog + EIN** — sandbox-only today (`PADDLE_ENV=sandbox` at
   every deploy). Catalog recreation is scripted (`tools/paddle-catalog-recreate.ts`, `--execute`
   operator-gated). EIN est. 2026-07-15. (tracked, runbook §1–§2)
2. **CF-Access `site_gate` flip** — public checkout is unreachable until the terraform flip; the
   flip is sequenced AFTER the live-purchase verify. (tracked, runbook §3)
3. **Railway Postgres backup/PITR** — named as an operator obligation in ADR-0115 the day Railway
   became the platform DB (2026-06-30) and never configured or tracked since. Going live on real
   commerce data without a proven backup is the sweep's only new P0. (tracked as of this sweep)
4. **EULA final legal review** — the live EULA self-labels "being finalized with legal counsel";
   five polish edits to the continuity clause await operator sign-off. (tracked)
5. **`RESEND_API_KEY` on `caisson-license`** — unverified; purchase-confirmation/license-token
   emails silently no-op (stderr warning) if unset. One `railway variables` check. (tracked)
6. **npm publish ↔ gate-flip sequencing** — every marketing/docs page shows
   `bunx @caisson-sh/cli@latest`, which 404s until the `confirm=publish` npm dispatch fires; the
   publish is itself held on the MIRROR_PUSH_TOKEN rotation. Ordering (publish BEFORE the CF flip)
   is enforced only by runbook discipline — no code guard. (tracked; the rotation is the last one
   from the ADR-0226 sweep)

## Deploy / infra — gaps

Verified live 2026-07-09: all 5 Railway services RUNNING on fresh 2026-07-08 deploys from main
HEAD; registry Worker current (46-entry index, anon floor 16, digest matching license + admin's
independently-baked copies); TLS valid on all hostnames; required CI checks green on the deployed
SHA; runscaler fleet healthy.

- **P1 (fixed in this sweep):** no documented rollback for an ordinary bad `railway up` outside
  the launch-flip act — a rollback section now lives in `docs/operations.md` §7.1.
- **P2:** `mirror-sync` red on every main push since 2026-07-04 (MIRROR_PUSH_TOKEN lacks the
  Workflows scope — same token as blocker 6). (tracked)
- **P3:** `deploy-railway.yml` auto-deploy correctly inert (`RAILWAY_TOKEN` not a repo secret).

## Security — gaps

Strix round-1 (2026-07-01): all 6 findings remediated + regression-tested (PR #45/ADR-0204).
Credential sweep (2026-07-08): per-service OpenRouter key split + 1Password recovery vault,
parity exit 0. Admin auth rearchitected to in-app GitHub OAuth with numeric-id allowlist
(ADR-0283). CF edge rate-limit live and 429-proven on docs-api.

- **P1:** MIRROR_PUSH_TOKEN — the last transcript-leaked credential (ADR-0226) — still unrotated;
  simultaneously live AND broken for its job. (tracked)
- **P1:** no Strix round-2 despite the admin-auth mechanism the round-1 scan covered having been
  completely replaced since (ADR-0283); round-1's own coverage-gap list (admin black-box, authed
  buyer sessions, support-bot, registry Worker, DoS, supply-chain) is untouched. (tracked as of
  this sweep)
- **P2:** registry Worker has zero app-level rate limiting (its own
  `public-surface-minimization.md` rec #4, never built) — enumeration/scraping cost, not data
  exposure. (tracked as of this sweep)
- **P2:** `license.caisson.sh` is un-proxied by Cloudflare (deliberate, CF-1/ADR-0219) and its
  app-level rate limiter **fails open** on an internal error (`services/license/src/app.ts:544`) —
  the money-critical surface loses rate protection exactly when the store is already unhealthy.
  Fail-mode decision worth an explicit fork. (tracked as of this sweep)
- **P2 (closed in this sweep):** authenticated live-flow verification — the E2E probe account was
  created + email-verified 2026-07-09; the buyer-dashboard leg and
  `buyer-dashboard-flow.live.test.ts` now run for real (the first credentialed run immediately
  caught a real bug: better-auth 403s auth POSTs without an `Origin` header, which the test's own
  sign-in helper never sent — fixed).
- **P3:** GitHub Action refs are version-pinned by SHA in some workflows and mutable tags in
  others — supply-chain hygiene sweep opportunity. (tracked as of this sweep)

## Commerce — BLOCKED (deliberately)

Checkout, webhook verify → grant, license mint, entitlement resolution, subscription management
(ADR-0293), refunds/clawback, chargeback alerting (ADR-0294) are all built, SHIP-audited, and
proven end-to-end against Paddle SANDBOX — including a real signed simulator purchase that drove
a real grant row (2026-07-04, which also caught the `.strict()`-envelope P0 before launch).
Real money cannot move until the consolidated blockers 1/2/4/5 above close. Additional named
debt: `adjustment.created` never live-subscribed even in sandbox (tracked); the credit
rollover/12-month-expiry/FIFO policy shows in the dashboard but not in the EULA text (tracked);
the first-cycle credit race stays open-by-choice (CAISSON-25 disposition pending).

- **Launch-runbook check (CAISSON-25 item 1):** verify in the Paddle dashboard that the
  failed-payment (dunning) setting **cancels** the subscription after the final retry — never
  pauses. A pause emits no `subscription.canceled`, so static plan entitlement rows stay active
  indefinitely. Check the SANDBOX account now and the production account at creation; this
  setting is dashboard-only (no public API reads it). CAISSON-25 items 2 and 3 (static-grant
  ordering race, subscription-refund horizon claw) were CLOSED in code by Kickoff-H W3
  (cancel-tombstone liveness check + the refund-horizon claw).

## Operational — gaps

SigNoz + Grafana OTLP pipeline live; docs/support-bot edge hardening live-verified; admin intel
daemon (ADR-0286) healthy with its scheduler bug fixed; pg-boss crons armed and DB-verified.

- **P0:** Railway Postgres backup/PITR — see consolidated blocker 3.
- **P1:** no confirmed Grafana alert rules or contact point (the archived setup runbook's 4-rule
  list was suggested, never confirmed executed) — no "service down" page reaches the operator.
  (tracked as of this sweep)
- **P2:** no external uptime/synthetic monitor (Railway restarts crashed containers but notifies
  no one). (tracked as of this sweep)
- **P2:** no written incident-response runbook — every past outage was handled ad hoc and
  recorded post-hoc in deploy-log entries. (tracked as of this sweep)
- **P2:** pg-boss cron failures (credit expiry, updates-window expiry, intel watchers) have no
  failure alerting. (tracked as of this sweep)
- **P3:** WORM bucket has immutability, not DR (single-region, no replication) — acceptable
  pre-launch; revisit with real evidence volume.

## Buyer experience — gaps

Every one of the buyer-lifecycle audit's 3 P0s and 12 P1s spot-checked directly against source
and verified fixed + shipped (11th/12th-sitting waves, PRs #165–#186): license auto-issue,
create-caisson delivery path from a packed tarball, dashboard plan/invoices/members/cancel,
entitlement gates, sign-out revocation, marketplace media 28/28 real. Remaining:

- **P1:** the marketed CLI command 404s until npm publishes (consolidated blocker 6).
- **P2:** Fumadocs depth pages exist for the 11 open base modules but only ~4 of ~18 commercial
  à-la-carte modules — thin pre-purchase technical docs for the things being sold. (tracked as of
  this sweep)
- **P2 (closed in this sweep):** live buyer-dashboard proof — E2E probe account live 2026-07-09;
  the dashboard leg + live test run against production.
- **P3:** marketplace media all-static by design (ADR-0290) — Remotion pipeline reserved for a
  future wave.

## Quality gates — gaps

The 4-check gate (check · standards-gate · registry-index · oscal-conformance) is real, green on
every recent main push/PR, and this sweep made the 3 path-filtered quality jobs (eval ·
token-drift · native-ext) unconditional on main pushes. The PGlite flake class was killed
structurally (PRs #168/#174). All 14 CI-mirror gates pass locally on this branch.

- **P1:** no GitHub branch protection (private repo, free plan) — "required" checks are
  discipline; nothing stops a direct push to main. Operator options: GitHub Pro, or make the repo
  public at the oss flip. (tracked as of this sweep)
- **P2:** live-verification harness (ADR-0224) run once end-to-end (Paddle seam, 2026-07-04);
  the 2026-07-08 credential rotation has no recorded harness re-run across the other four seams.
  (tracked as of this sweep)
- **P2:** eval baseline is 2 suites / 5 cases, frozen since creation, while 6+ AI-surface waves
  shipped — regression protection is nominal. (tracked as of this sweep)
- **P3:** `bun run sot` never runs in CI (advisory by design; a scheduled advisory run is cheap).
  (tracked as of this sweep)
- **P3:** 92 pending changesets since the last version cut (PR #131) — a deliberate release-cut
  decision, not drift; flagged so the next cut is a chosen act. (tracked as of this sweep)

## What this sweep already fixed

Local gate failures (prettier/eslint over git-ignored `.venv` artifacts — ignore entries),
`knip.json` missing `services/intel`, the 3 skipping quality jobs on main, the stale
`feat/comparison-pages` branch (verified fact merged, branch deleted), ~196 completed artifacts
archived (`outputs/archive/` + `docs/archive/harvest-program.md`) with live-doc links repointed,
23 stale docs corrected, and the visual harness extended to a categorized full-surface prod
sweep (pages · pop-outs · emails · interactions · dashboard) at mobile/desktop × light/dark.
