# Kickoff H — Platform hardening + backlog: security round-2 · ops floor · commerce seams · quality gates

**Authored:** 2026-07-09 (post-repo-sweep triage picker: split **by surface**; sibling session
owns everything buyer-visible). **Sibling:** `KICKOFF-G-surface-remediation.md` — G owns
`apps/site` + docs-site content + emails; H never edits those trees except where a wave names a
shared seam (registry Worker, license service). **Branch:** `feat/platform-hardening` off `main`
(worktree). **Shape:** each wave runs investigate/research FIRST, then presents deep forks via
AskUserQuestion (rounds of ≤4, never auto-decide), then builds after locks. Waves are
tree-disjoint and fan out as parallel worktree workflows inside the session. **Routing:** recon →
haiku · bounded builds → sonnet · synthesis/picker prep/review → opus main thread · the
license/money seams in W3 → fable per the caisson routing note · every dispatch sets `model`.
**Review gate:** in-session SHIP audit lane per wave (gw-code-reviewer opus on the wave diff;
gw-security-auditor on W1 and W3), findings fixed in-branch before each PR opens.

**Sources triaged into this kickoff:** `docs/state/outstanding-work.md` §1–§3,
`docs/state/production-readiness.md`, Linear CAISSON-25/31/39/42/52–59/62/63/71, the 2026-07-09
visual-audit console triage (`outputs/reviews/visual-audit-2026-07-09.md`).

## W1 — Security round-2 (tags: `security`)

1. **Research:** round-1's own coverage-gap list (`docs/security/strix-findings-2026-07-01.md`
   §Coverage gaps); the ADR-0283 GitHub-OAuth admin auth (completely replaced since round-1
   scanned CF-Access-JWT); the E2E probe account (EXISTS since 2026-07-09 —
   `admin+caisson-e2e@gridwork.dev`, creds in `~/.gridwork/caisson.env`) as the authed-session
   vehicle; Workers rate-limit primitives (DO vs KV counters vs the native rate-limit binding)
   against the ADR-0112 token-bucket shape.
2. **Deep forks:** strix round-2 scope (full gap list vs admin+Worker only) · Worker rate-limit
   backing store + limits (per-IP anon catalog/tarball budgets) · whether the free-floor
   regression test pins the exact package list or the ADR-0136 predicate.
3. **Build:**
   - **Strix pentest round-2** (CAISSON-54): admin black-box + authed buyer/owner/seat sessions +
     support-bot command surface + registry Worker + DoS/body-size; remediate confirmed findings
     in-wave (the round-1 pattern: PR #45).
   - **Registry Worker app-level rate limit** (CAISSON-55): ADR-0112 shape on anon catalog +
     tarball routes; 429-prove it like the CF edge limit was (curl-driven).
   - **Free-floor audit** (CAISSON-63): one pass of the Worker anon response vs the ADR-0136 open
     set for the carve SKUs + ui-pro; land the regression test so drift can't recur.
   - **SHA-pin sweep** (CAISSON-62): pin all third-party actions across the 8 workflows.

## W2 — Ops floor (tags: `infra`, `observability`)

1. **Research:** `docs/archive/grafana-setup-runbook.md` (the 4 suggested rules); pg-boss failure
   event surface vs `@caisson/alerting` sinks (ADR-0150/0252/0256); the 429 mystery — re-run the
   harness slice for legal/glossary/module routes with request-URL+response logging to NAME the
   shared endpoint (the console message carries no URL); Railway backup/PITR options for the two
   Postgres services (platform DB + admin auth DB).
2. **Deep forks:** external uptime vendor (UptimeRobot-class pick) · alert routing (Discord
   webhook vs tg-bridge vs email) · 429 fix shape once the endpoint is named (raise limit vs
   cache vs remove the fetch).
3. **Build:**
   - **pg-boss failure alerting** (CAISSON-53 item 3): wire `@caisson/alerting` to job-failure
     events for credit-expiry, updates-window, intel ticks.
   - **429/502 root-cause + fix** (CAISSON-71): instrumented harness slice → named endpoint →
     fix; correlate the 502s/chunk-failure against Railway logs for the capture window and close
     or file.
   - **Incident-response runbook** (CAISSON-57): severity levels, comms, escalation, generic
     Railway rollback (`railway status` → redeploy prior image), DB-restore pointer.
   - **Restore-procedure doc** (CAISSON-52 doc half): written against whatever backup mode W2's
     operator checkpoint enables.
4. **Operator checkpoints (in-session, gated):** enable Railway Postgres backups/PITR in the
   dashboard for BOTH DBs + one test restore (CAISSON-52 — the sweep's P0) · create the Grafana
   `caisson-ops` contact point + 4 rules (console-side) · sign up + point the external uptime
   monitor at caisson.sh + license `/health` (CAISSON-53 items 1–2).

## W3 — Commerce + license seams (tags: `billing`, `security`; **fable review mandatory**)

1. **Research:** `packages/kernel/src/read-only.ts` gate call-sites (built+tested, zero live
   sources); dunning gap #53 shape (subscriber freeze during dunning — what billing event arms
   it, what disarms); the reissue route
   (`apps/admin/src/app/api/admin/license/reissue/route.ts`) + R-4 edge deny-set interplay for
   true rotation; ADR-0288 support-SKU parameters ($999/yr · next-business-day) vs the Track K
   price-agnostic plumbing (CAISSON-42's issue body carries the wire-up map); CAISSON-25's two
   code-side residuals (static-grant ordering race, subscription-refund horizon claw).
2. **Deep forks:** read-only live-source pick (admin lever only vs dunning-event-driven vs both)
   · rotation-v2 offline-token posture (extend-to-paid-horizon is the locked pattern — fork is
   the revocation-propagation timing) · support-SKU `creditsPerCycle` real number (the schema
   forbids 0 — this is the ADR-0288 rider (b) the operator still owes; surface it IN the fork
   round).
3. **Build:**
   - **Read-only wiring + dunning freeze** (CAISSON-58): admin lever + billing-event source
     calling the existing gate; fail-closed tests.
   - **License rotation v2** (CAISSON-59): new-key mint + old-key revoke through the R-4 deny
     set; never DROP a bound key read by offline perpetual tokens.
   - **Support-SKU wire-up** (CAISSON-42, UNBLOCKED by ADR-0288): price + entitlement/role
     plumbing per the locked parameters.
   - **CAISSON-25 code residuals:** static-grant ordering race + refund-horizon claw (the Paddle
     dunning-config verification is an operator checkpoint — sandbox console).

## W4 — Quality gates + release (tags: `ai` where evals; release act operator-gated)

1. **Research:** the cassette-replay pattern (`packages/ai-evals`, ADR-0062) against the three
   named targets (guardrails PII path, support-bot RAG, ask-AI widget); the live-harness env
   matrix (`docs/state/live-harness.md`) for the all-seams re-run; the 92 pending changesets vs
   the ADR-0208 consume mechanics.
2. **Deep forks:** eval-case budget per surface (a handful of high-signal cases vs broad) ·
   whether the version cut ships in this session or is scheduled as its own release sitting.
3. **Build:**
   - **Eval baseline widening** (CAISSON-56): extend cassette replay to the three AI surfaces;
     keep CI offline.
   - **Live-harness all-seams re-run:** source `~/.gridwork/caisson.env`, `bun run test:live:all`
     - both pytest live legs — proves the 2026-07-08 rotated creds across Discord/Linear/Grafana/
       analytics (the rotation's missing proof).
   - **Changeset version cut** (92 pending): `changeset version` consume + republish per
     ADR-0208 — **operator-gated release act**, staged last so the session ends on a chosen cut,
     not drift.

## Re-triage of the trigger-parked bucket (operator-ordered, 2026-07-09 picker)

All 13 `outstanding-work.md` §3 rows re-argued; verdicts to confirm in this session's first fork
round:

| Row                                                                    | Verdict                  | Why                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Wave-6 28 `build-on-trigger` rows                                      | **KEEP PARKED**          | Per-row triggers (feature requests, RAG ingestion, edition review-queue) — none fired                                       |
| Adapter/port remainder (Slack/Telegram, storage, KMS, SCIM, analytics) | **KEEP PARKED**          | Demand-driven; zero demand signals pre-launch                                                                               |
| Vertical editions/packages                                             | **KEEP PARKED**          | P7 intake unopened                                                                                                          |
| three.js signature slot / studio spike                                 | **KEEP PARKED** (queued) | Already queued for the next design-track kickoff (twelfth-sitting) — that is G-adjacent, not H                              |
| Real media on module depth pages (F2)                                  | **PULLED → G**           | Overlaps CAISSON-68's broken-diagram fix directly — fixing the placeholder pipeline without real media re-ships the same P1 |
| Persistent production KMS CMK                                          | **KEEP PARKED**          | First-customer trigger; throwaway CMKs proven                                                                               |
| Live OSCAL push                                                        | **KEEP PARKED**          | No real GRC ingest endpoint exists                                                                                          |
| Support-bot graded confidence gate                                     | **KEEP PARKED**          | Zero support traffic — thresholds untunable                                                                                 |
| Auth session-token hash-at-rest                                        | **KEEP PARKED**          | Neither ADR-0210 §3 trigger fired; spec stays live                                                                          |
| MySQL full-parity lane                                                 | **KEEP PARKED**          | ADR-0281 locked no-MySQL; demand trigger only                                                                               |
| SOC 2 for Caisson Software LLC                                         | **KEEP PARKED**          | No enterprise-procurement blocker names it                                                                                  |
| Directory-listing batch                                                | **KEEP PARKED**          | Fires the week the CF gate drops + checkout is live                                                                         |
| First-cycle credit race (CAISSON-25 disposition)                       | **PARTIAL → W3**         | The accept-vs-build fork stays operator-open, but the two bounded code residuals ride W3 now                                |

## Explicitly OUT of this session (operator-owed, runbook-tracked)

Paddle production account + catalog recreation (scripted; `--execute` operator-gated) ·
CF-Access `site_gate` flip · `caisson-oss` public flip + first npm publish (P0 sequencing gate) ·
`MIRROR_PUSH_TOKEN` rotation · `RESEND_API_KEY` verify · Discord intents · WORM
GOVERNANCE→COMPLIANCE flip · Plausible goals · Cookiy quant maturation → pricing picker ·
EULA continuity-polish approval (the clause build itself is in G) · design-partner outreach ·
branch-protection decision · Linear UI automations · Greptile app uninstall · E2E creds → launch
vault. These stay in `outstanding-work.md` §1 / `launch-runbook.md`; W2/W3 name the three that
become in-session checkpoints (backups, Grafana console, dunning config).

## Exit criteria

- Strix round-2 executed with every confirmed finding remediated or ADR'd; Worker 429-proven.
- An alert reaches the operator when a service dies or a cron job fails (proven by killing one).
- The 429 endpoint is named and fixed; free-floor regression test green.
- Read-only + rotation-v2 + support-SKU merged through fable-reviewed PRs.
- Eval baseline covers the three named AI surfaces; live harness green on every seam.
- The changeset cut executed (or explicitly re-scheduled by the operator).
- `outstanding-work.md` buckets updated; every Linear issue this kickoff names moved to Done or
  re-commented with its residual.
