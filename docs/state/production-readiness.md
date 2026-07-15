---
updated: 2026-07-15
status: live
grounds:
  - docs/state/outstanding-work.md
  - docs/ops/launch-runbook.md
  - docs/deploy/STATE.md
  - docs/ops/live-transport-checklist.md
---

# Production readiness — Caisson

Six-dimension readiness assessment from the 2026-07-09 whole-repo sweep (16-agent discovery +
2-agent re-run, every claim evidence-cited at assessment time). Verdicts use three grades:
**ready** (no blocking gaps) · **gaps** (launchable posture with named debt) · **blocked**
(cannot take real money / go public until fixed). The launch-day execution order lives in
`docs/ops/launch-runbook.md`; this doc is the _state_, not the runbook. Items marked
**(tracked)** have a row in `docs/state/outstanding-work.md`.

## Verdicts

| Dimension        | Verdict     | One-line state                                                                                                                                 |
| ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy / infra   | **gaps**    | All 5 Railway services + Worker deployed from current main, live-verified; no undeployed code debt on main                                     |
| Security         | **gaps**    | Strix round-1 remediated; round-2 executed 2026-07-10 (Kickoff K) — 3 DoS/supply-chain fixes, seams clean, Worker 429 proven; named debt below |
| Commerce         | **BLOCKED** | Everything built + sandbox-proven end-to-end; no Paddle production account/catalog, EIN in flight — deliberate pre-launch                      |
| Operational      | **gaps**    | Telemetry + intel daemon live; daily backups + rehearsed restore PROVEN 2026-07-11; external uptime monitor live (Better Stack)                |
| Buyer experience | **gaps**    | All 3 P0 + 12 P1 lifecycle-audit gaps verified fixed in code; residue is the operator launch checklist                                         |
| Quality gates    | **gaps**    | 5-check CI gate real and green; "required" is discipline (no branch protection on the private plan)                                            |

## True go-live blockers (consolidated)

Everything a real first sale requires that does not exist today. All are known, tracked, and
mostly operator-owed — none are silent breakage:

1. **Paddle production account + catalog + EIN** — sandbox-only today (`PADDLE_ENV=sandbox` at
   every deploy). Catalog recreation is scripted (`tools/paddle-catalog-recreate.ts`, `--execute`
   operator-gated). EIN est. 2026-07-15. (tracked, runbook §1–§2)
2. **CF-Access `site_gate` flip** — public checkout is unreachable until the terraform flip; the
   flip is sequenced AFTER the live-purchase verify. (tracked, runbook §3)
3. **Railway Postgres backup/PITR** — CLOSED 2026-07-11: daily snapshots enabled (24h/6-day
   retention) + manual backup proven (1.12 GB) + a rehearsed logical restore into a scratch
   Postgres verified full row-count parity on ALL schemas (public + intel + pgboss +
   admin_auth). Procedure: `docs/operations.md` §9 (roles-before-restore caveat included).
   PITR deliberately deferred (07-11 picker).
4. **EULA final legal review** — the live EULA self-labels "being finalized with legal counsel";
   five polish edits to the continuity clause await operator sign-off. (tracked)
5. **`RESEND_API_KEY` on `caisson-license`** — CLOSED 2026-07-11: `RESEND_API_KEY` +
   `RESEND_FROM` both present on the running service (railway key-scan; tracker row DONE
   2026-07-10, re-verified after the ADR-0324 email-wave redeploy).
6. **npm publish ↔ gate-flip sequencing** — the release train landed and rode green 2026-07-12
   (tag `v2026.07.12`, ADR-0325); the public npmjs mirror leg is deliberately unarmed pre-launch
   (ADR-0329), so the marketed `bunx @caisson-sh/cli@latest` still 404s until that leg is armed.
   See `docs/state/outstanding-work.md`.

## Deploy / infra — gaps

Verified live 2026-07-09: all 5 Railway services RUNNING on fresh 2026-07-08 deploys from main
HEAD; registry Worker current (46-entry index, anon floor 16, digest matching license + admin's
independently-baked copies); TLS valid on all hostnames; required CI checks green on the deployed
SHA; CI hot path now on Blacksmith VM-per-job runners (ADR-0326).

- **P1 (fixed in this sweep):** no documented rollback for an ordinary bad `railway up` outside
  the launch-flip act — a rollback section now lives in `docs/operations.md` §7.1.
- **P2 (closed 2026-07-10):** `mirror-sync` fixed — the rotated MIRROR_PUSH_TOKEN (Workflows
  scope) proved green on run `29117126038`; the workflow was re-enabled and a follow-up dispatch
  verified appending (`8253e76` on `905e3070`).
- **P3:** `deploy-railway.yml` auto-deploy correctly inert (`RAILWAY_TOKEN` not a repo secret).

## Security — gaps

Strix round-1 (2026-07-01): all 6 findings remediated + regression-tested (PR #45/ADR-0204).
Credential sweep (2026-07-08): per-service OpenRouter key split + 1Password recovery vault,
parity exit 0. Admin auth rearchitected to in-app GitHub OAuth with numeric-id allowlist
(ADR-0283). CF edge rate-limit live and 429-proven on docs-api; registry Worker app-level rate
limit 429-proven live 2026-07-10 (below).

- **P1 (closed 2026-07-10):** MIRROR_PUSH_TOKEN rotated (fresh fine-grained PAT, Contents +
  Workflows scope) and verified working — `mirror-sync` run `29117126038` SUCCEEDED.
- **Residual — CLOSED 2026-07-10** by the ADR-0314 security-tooling stack: the authed-admin
  black-box harness is built (`tools/security/harness-admin.sh`); the Strix black-box cross-check
  is superseded, not re-run — the Strix harness itself is RETIRED, replaced by the repo-local
  four-layer OSS stack (`docs/security/tooling-playbook.md`). See `docs/state/outstanding-work.md`.
- **P2 (closed 2026-07-10):** registry Worker app-level rate limiting — built (CAISSON-55,
  `registry/worker/rate-limit.ts`, native CF `simple` limiter, catalog 300/60s) and 429-proven
  firing live this round with a sanctioned vegeta run (round-1's negative was a load-shape
  artifact of the per-server-approximate limiter, not a missing binding).
- **P2:** `license.caisson.sh` is un-proxied by Cloudflare (deliberate, CF-1/ADR-0219) and its
  app-level rate limiter **fails open** on an internal error (`services/license/src/app.ts:544`) —
  the money-critical surface loses rate protection exactly when the store is already unhealthy.
  Fail-mode decision worth an explicit fork. (tracked as of this sweep)
- **P2 (closed in this sweep):** authenticated live-flow verification — the E2E probe account was
  created + email-verified 2026-07-09; the buyer-dashboard leg and
  `buyer-dashboard-flow.live.test.ts` now run for real (the first credentialed run immediately
  caught a real bug: better-auth 403s auth POSTs without an `Origin` header, which the test's own
  sign-in helper never sent — fixed).
- **P3:** GitHub Action refs are SHA-pinned (46/46, Kickoff-K supply-chain audit); Docker base
  images are pinned to tags not digests — Renovate `docker:pinDigests` enabled for first-party
  images (buyer scaffolds stay tag-pinned).

## Commerce — BLOCKED (deliberately)

Checkout, webhook verify → grant, license mint, entitlement resolution, subscription management
(ADR-0293), refunds/clawback, chargeback alerting (ADR-0294) are all built, SHIP-audited, and
proven end-to-end against Paddle SANDBOX — including a real signed simulator purchase that drove
a real grant row (2026-07-04, which also caught the `.strict()`-envelope P0 before launch).
Real money cannot move until the consolidated blockers 1/2/4 above close (5 closed 2026-07-11). Additional named
debt: `adjustment.created` subscribed + live-simulated in SANDBOX 2026-07-10 (200 delivered to
`license.caisson.sh/webhook`); still needs re-subscribing on the production destination once it
exists (see `docs/state/outstanding-work.md`). The credit
rollover/12-month-expiry/FIFO EULA clause SHIPPED 2026-07-09 (PR #190, CAISSON-61 —
`apps/site/app/legal/eula/page.tsx` §5 Credits, matching ADR-0245/0252 and the built ledger); the
first-cycle credit race code residuals were CLOSED by Kickoff-H W3 (ADR-0302 cancel tombstone +
liveness check) — only the operator Paddle dunning-cancel dashboard check below remains.

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

- **P0 (closed 2026-07-11):** Railway Postgres backup/PITR — daily snapshots + proven
  rehearsed restore; see consolidated blocker 3 and `docs/operations.md` §9.
- **P2 (closed 2026-07-10):** Grafana alerting armed via the provisioning API — `caisson-ops`
  contact point → Discord #ops-alerts (delivery proven) + root policy + 3 rules on real metrics
  (heartbeat-lost, 5xx-rate, p95>2s); the 4 stale console-suggested rules were deleted as provably
  dead.
- **P2 (closed 2026-07-11):** external uptime monitor live — Better Stack (free tier):
  caisson.sh (2xx) + license.caisson.sh/health (200), 3-min checks / 30s confirmation,
  email alerting to admin@ on open + recovery (Discord webhook is paid-tier; skipped).
  CAISSON-53 Done.
- **P2 (closed 2026-07-09/10, Kickoff-H W2):** incident-response + DB-restore runbooks written —
  `docs/ops/incident-response.md`.
- **P2 (closed 2026-07-09/10, Kickoff-H W2):** pg-boss cron failures (credit expiry,
  updates-window expiry, intel watchers) now alert via `@caisson/alerting`'s Discord channel on
  license/jobs/intel.
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

The 5-check gate (check · standards-gate · registry-index · oscal-conformance · deterministic —
the fifth flipped required 2026-07-11, ADR-0327/CAISSON-95) is real, green on
every recent main push/PR, and this sweep made the 3 path-filtered quality jobs (eval ·
token-drift · native-ext) unconditional on main pushes. The PGlite flake class was killed
structurally (PRs #168/#174). All 14 CI-mirror gates pass locally on this branch.

- **P1 (closed, ADR-0327):** no GitHub branch protection (private repo, free plan) — locked as
  discipline-only; revisited only on a real bypass incident or a launch-posture change.
  `caisson-oss` gets native protection free at the public flip (ADR-0318 W3).
- **P2 — CLOSED 2026-07-10:** live-verification harness (ADR-0224) — the full matrix is closed
  across all seams, the last skipped leg (support-bot public HTTP) went live
  (`discord-grant.live.test.ts` proven). See `docs/state/outstanding-work.md`'s
  "Live-harness — ALL SEAMS CLOSED" row.
- **P2 (closed 2026-07-11/12):** eval baseline expanded structurally — PR #216 grew the TS
  injection/PII suites (injection 2→20 attack classes, Wilson floor 0.8), then the ADR-0328 R
  session (PR #218) ported the eval mechanics to the support-bot Python surface (44 cases across
  injection-defense / PII-exfiltration / grounding-escalation, `eval`-marked pytest CI gate) and
  built the intel judged replay harness (cassette recording rides session 4's operator act).
- **P3:** `bun run sot` never runs in CI (advisory by design; a scheduled advisory run is cheap).
  (tracked as of this sweep)
- **P3 — RESOLVED 2026-07-12:** the version cut happened — PR #222 consumed 153 pending
  changesets and cut tag `v2026.07.12` (see `docs/state/outstanding-work.md`'s "FIRST
  RELEASE-TRAIN RIDE GREEN" row). Pending-changeset count since that cut is whatever has accrued;
  check `changeset status --since=origin/main` for the current figure.

## GitHub org apps + CI wiring (verified live 2026-07-12, org API read — session Q sweep)

The `caisson-sh` org has exactly **five** GitHub Apps installed — anything else claimed
anywhere is stale:

| App                       | Repos      | Job                                                                                                     | Wiring state                                                                                                           |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `renovate`                | selected   | Dependency updates + Dockerfile `pinDigests`                                                            | Live; strict-digests flip parked until the first pin wave lands (ADR-0315)                                             |
| `socket-security`         | selected   | Supply-chain alerts on PRs — posts the "Socket Security: Project Report" + "Pull Request Alerts" checks | Live, green on PR #205 this session                                                                                    |
| `linear-code`             | all        | Linear Code Intelligence — branch/PR/deploy sync, magic-word closes                                     | Live, proven: PR #205 "Closes CAISSON-89/90/91" auto-moved all three to Done at merge                                  |
| `blacksmith-sh`           | all        | Blacksmith VM-per-job CI runners (ADR-0326) + the Codesmith PR footer                                   | Live since 2026-07-11; hot path migrated, main runs green; free-tier burn = open fork PF2-1                            |
| `arnica-github-connector` | both repos | Security-posture scanning (free tier — no identity/permission features; those are Enterprise-only)      | Installed + org-API-verified 2026-07-12 (session Q); verdict keep-free-never-pay (`docs/security/paid-tooling-roi.md`) |

**Not apps** (repo-local, ADR-0314 four-layer stack): `semgrep-pro` is a CI job (armed by the
`SEMGREP_APP_TOKEN` secret, free-tier Pro interfile), alongside `deterministic` (gitleaks/osv/
zizmor class), `evidence-pack`, `knip`, `token-drift`, `eval`, `native-ext`, and the 4-check
required set (`check` · `standards-gate` · `registry-index` · `oscal-conformance`). Runner:
CI hot path migrated to Blacksmith VM-per-job runners (ADR-0326); `caisson-amd64` scale set
retiring. Credential jobs (`publish`/`deploy-railway`/`mirror-sync`/`release-train`) stay
`ubuntu-latest`; mac leg self-hosted `gw-macos-arm64`. Arnica installed 2026-07-12 (free tier,
posture scanning only) alongside the playbook's Layer 1-4 local stack
(`docs/security/tooling-playbook.md`).

## Email architecture (locked 2026-07-11, ADR-0324 — execution rides Kickoff O)

Inbound: Proton MX catch-all (SPF/DKIM/DMARC-quarantine all present) into the operator's
primary account. Roles: `admin@` accounts/billing/legal (legal pages only) · `support@`
user-facing contact everywhere else · `security@` disclosure/evidence · `no-reply@`
transactional sender (Resend, Reply-To `support@`) · `hello@` RETIRED (was the live
`RESEND_FROM` — the env flip is the kill). Operator act: Proton send-as alias for `support@`.

Execution state (Kickoff O email wave): the code half is DONE — `reply_to: support@caisson.sh`
on all three Resend sends (one shared seam, `packages/email` `ResendConfig.replyTo`, opted in by
site magic-links, license lifecycle, admin test-send) and the support@ copy pass across
refunds/procurement/partners/affiliates/ask-AI (legal pages keep `admin@`, `security@`
untouched). The CF routing cleanup EXECUTED 2026-07-11 (operator-approved): Cloudflare's API
treats the catch-all as an undeletable singleton, so the stale rule is neutralized instead —
`enabled: false`, action `drop`, no forward target (zone routing itself stays
disabled/unconfigured; Proton MX is the inbound truth). **ADR-0324 D3 deviation, deliberate:**
the account-level destination address `admin@gridwork.dev` is KEPT, because it is shared
plumbing: gettelesis.com, gettessera.xyz, telesis.health, and throughframe.com all have live
Email Routing forwarding to it, and deleting the address would break their inbound mail. The
`RESEND_FROM` env flip is staged on all three Railway services (skip-deploys) + the local env
mirror; the post-merge redeploy carries it live together with the reply-to code.
**EXECUTED 2026-07-11:** PR #209 merged (`4036574e`) and the operator-approved full redeploy of
caisson-site/caisson-license/caisson-admin carried env + code live — all three services report
`RESEND_FROM=Caisson <no-reply@caisson.sh>`, live route suite 13 pass / 0 fail
(`docs/deploy/STATE.md` 2026-07-11 email-wave entry). Remaining: the 1Password vault
`RESEND_FROM` item value update — DONE 2026-07-11 (fresh op session, field verified `Caisson <no-reply@caisson.sh>`) — +
the operator Proton send-as alias.

## What this sweep already fixed

Local gate/config hygiene, stale-branch cleanup, and ~196 completed-artifact archival — resolved;
detail is in git history for this sweep, not restated here.
