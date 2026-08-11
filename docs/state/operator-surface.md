---
updated: 2026-08-11
status: live
grounds:
  - docs/state/production-readiness.md
  - docs/ops/launch-runbook.md
  - docs/ops/operator-walkthrough.md
  - docs/ops/provider-console-checks.md
  - docs/ops/probe-accounts.md
  - docs/state/outstanding-work.md
  - docs/state/decisions-and-forks.md
  - docs/business/caisson-software-llc.md
  - docs/gtm/legal-entity.md
  - outputs/audit/2026-08-consolidation/PICKER-TABLE.md
---

# Operator surface — every operator-only item in one place

The consolidated map of everything that waits on the **human operator** (or counsel/CPA), born
2026-08-10 from a full-repo recon. This file is a **map, not a third checklist**: each row names
its owning doc, and the owning doc keeps the detail and the step-by-step. When a row closes, it
closes in the owning doc first; this map gets restamped. Statuses below are as of 2026-08-10;
agent-side work is deliberately absent (that lives in [outstanding-work](outstanding-work.md)).

## 1. Critical path to first sale (in order)

| #   | Rung                                                                                                                                                                                                                                                                                                                                                | Status                                                         | Owner doc                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Operating agreement + minor-IP-assignment instrument made signature-ready (counsel engaged; load-bearing — the primary code author is a minor and not a member of record)                                                                                                                                                                           | UNDER LEGAL REVIEW                                             | `docs/business/caisson-software-llc.md` §3/§5, `docs/business/legal/draft-instrument-set.md` |
| 2   | Mercury business banking — sole member applies DIRECT at mercury.com (Articles + EIN CP-575 in hand; draft OA suffices if ownership docs requested)                                                                                                                                                                                                 | UNBLOCKED, not submitted                                       | `docs/business/caisson-software-llc.md` §4 step 4                                            |
| 3   | Paddle production application (entity: Caisson Software LLC; domain-review blocker resolved by ADR-0303; payout wiring needs Mercury)                                                                                                                                                                                                               | NOT SUBMITTED — the hard launch blocker                        | `docs/ops/launch-runbook.md` §Paddle (line ~272)                                             |
| 4   | Paddle production console: payout bank + tax · Retain ends in **Cancel, never Pause** · notification events · catalog recreation (36 products / 68 prices via `tools/paddle-catalog-recreate.ts`, temp key scoped to product.write+price.write, revoked after) · webhook at `license.caisson.sh/webhook` + signing secret via the secret SoT        | open, sequenced after approval                                 | `docs/ops/launch-runbook.md` §282–314                                                        |
| 5   | Controlled real checkout → verify delivery/grant/license/registry/receipt → refund + reversal → unknown-product-ID no-grant probe                                                                                                                                                                                                                   | open (real money — operator executes or explicitly authorizes) | `docs/ops/launch-runbook.md` §315–318                                                        |
| 6   | 18 first-sale business gates + 31 adviser questions (14 counsel / 8 CPA / 9 operator) + the paid-launch go/no-go record                                                                                                                                                                                                                             | open                                                           | `docs/business/caisson-internal-master-map.md` §13                                           |
| 7   | Launch acts: release the external-system/data-migration hold · select launch SHA + rollback SHA · approve the immutable tag + byte-exact publish receipt · remove the Cloudflare Access gate on `/dashboard*`+`/cart*` (Terraform, the one sanctioned commerce change) · record WORM GOVERNANCE→COMPLIANCE · post-deploy $1,649/$2,259 price probes | open, last                                                     | `docs/ops/launch-runbook.md` §62–65, 306–341                                                 |

Public legal pages precondition for rung 3 — **verified live 2026-08-10**: `/legal/refunds`,
`/legal/eula`, `/legal/terms`, `/legal/privacy`, `/support` all 200; `/.well-known/security.txt`
serves with `Expires: 2027-06-30` (contact deliberately routed to the monitored gridwork.dev
inbox).

## 2. Legal (counsel + CPA)

| Item                                                                                                                                                                         | Status                           | Owner doc                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| CPA engagement: opening books, minor-employment payroll, tax/refund reserves, historical funding classification (backfilled to Jan 2025)                                     | UNDER CPA REVIEW                 | `docs/business/caisson-software-llc.md` §5                            |
| EULA counsel pass (text is operator-drafted, live since 27 Jun)                                                                                                              | open                             | `apps/site/app/legal/eula/page.tsx`, `docs/gtm/legal-review-brief.md` |
| EULA content gap: credit rollover / FIFO burn / 12-month expiry clause (ADR-0245) is on the dashboard copy but **missing from the EULA text**                                | gap — fold into the counsel pass | `docs/gtm/legal-entity.md` §5                                         |
| Article 50 page: one legal-wording re-verification before the D11 row closes                                                                                                 | open — CAISSON-194               | Linear                                                                |
| Seller/legal identity language vs Paddle merchant-of-record disclosures                                                                                                      | open, rides rung 3               | `docs/ops/launch-runbook.md` §273                                     |
| DPA template ready-to-send (buyer profile will ask early; not legally forced)                                                                                                | gap                              | `docs/gtm/legal-entity.md` §5                                         |
| Deferred by design (no action): MSA/enterprise template · SOC 2 · Delaware C-corp · USPTO trademark                                                                          | deferred                         | `docs/gtm/legal-entity.md` §5                                         |
| Calendar: GA annual registration Jan 1–Apr 1 2027 · membership transfer-at-18 trigger Aug 19 2027 · FinCEN BOI/CTA rule re-verify before ever filing/answering solicitations | future-dated / watch             | `docs/business/caisson-software-llc.md` §5                            |

## 3. Applications + accounts

| Item                                                                                                                                                            | Status                                          | Owner doc                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| admin@caisson.sh mailbox/alias — **delivery never verified**; it is the sole legal/privacy contact on the live site, so Paddle/counsel mail could silently fail | open gap — do before rung 3                     | `docs/business/caisson-software-llc.md` §4 step 0                        |
| Domain registrant-of-record + payer documentation for caisson.sh (closes the `[FACT]` placeholders in the instrument set)                                       | open — documentation only                       | `docs/business/legal/draft-instrument-set.md`                            |
| npm org `caisson-sh` — owned, `NPM_TOKEN` armed in the mirror repo; publish stays a manual confirm=publish dispatch                                             | done/armed — fire is CAISSON-179                | `docs/state/public-surface.md` §3                                        |
| caisson-oss repo flip to PUBLIC (+ `MIRROR_PUSH_TOKEN` rotation first) → clean-env `bunx @caisson-sh/cli@latest` verify → Show HN                               | gated on business + release gates — CAISSON-105 | `docs/state/public-surface.md` §4, `docs/ops/launch-runbook.md` §351–352 |
| Announcement post for the clean-main/browser-entries release                                                                                                    | open — CAISSON-180                              | Linear                                                                   |
| GitHub org 2FA (declined 2026-07-15, accepted residual)                                                                                                         | re-raise at launch                              | `docs/state/outstanding-work.md`                                         |

## 4. Technical receipts + armings (operator-run or operator-authorized)

| Item                                                                                                                                                                                                                                                                                                                                  | Status                                       | Owner doc                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| Four launch receipts: COMPLIANCE-mode WORM immutable-read-back · deployed-pooler RLS tenant isolation · split-brain detect/recover · real-provider KMS signing + fail-closed deletion                                                                                                                                                 | open (KMS one blocked on Azure arming below) | `docs/state/production-readiness.md` §155–158               |
| Azure Key Vault KMS arming (`site.byok-field-crypto`) — **one-way door**, no rewrap path; run the BLOCKING SQL preflight (session-level `SET row_security = off` count on `tenant_ai_credential` with the `bypasses_rls` proof — a bare `SELECT count(*)` is a false-green) before arming; then the 7-env probe + wrap/unwrap receipt | open — no arming record exists               | `docs/ops/launch-runbook.md` §81–147                        |
| Independent (non-Claude-Code) security/conformance review of the Inngest, Azure Key Vault, Azure Blob adapters + 2–3 working-auditor acceptance reviews                                                                                                                                                                               | open                                         | `docs/state/production-readiness.md` §159–160               |
| Credential-seam probes + receipts on site/admin: ask-ai-docs-retrieval · ask-ai-generation · subscription-cancellation · paddle-checkout · authentication-runtime · license-reissue/affiliate-minting; then the fleet `--configured-probe` fail-soft inventory                                                                        | open                                         | `docs/ops/launch-runbook.md` §77–83, 151–161                |
| Ring-2 buyer probe re-verification (creds exist; historical evidence must be re-proven)                                                                                                                                                                                                                                               | open                                         | `docs/ops/probe-accounts.md` §277–297                       |
| Ring-3 admin probe, four steps: create GitHub account → append numeric id to `ADMIN_GITHUB_ALLOWED_USER_IDS` + redeploy admin → first interactive OAuth sign-in → 1Password vault item + parity re-run                                                                                                                                | open — CAISSON-104                           | `docs/ops/probe-accounts.md` §193–269                       |
| Regenerate the dead `OPENROUTER_MANAGEMENT_KEY` (401s; restores per-key usage attribution)                                                                                                                                                                                                                                            | open                                         | `docs/state/production-readiness.md` §165–167               |
| `SESSION_TOKEN_HMAC_KEY` launch copy — verify against the already-armed hash-at-rest receipt before treating as new work (possibly a stale duplicate row)                                                                                                                                                                             | re-verify                                    | `docs/ops/operator-walkthrough.md` §60                      |
| WORM anchor scheduler arming (TSA/Rekor/OTS) — deliberately deferred; when picked up it carries two buried sub-gates: the R-alpha signer-model fork lock, and explicit sign-off on **one irrevocable public Rekor test entry**                                                                                                        | deferred                                     | `outputs/plans/external-anchoring/PLAN-rekor-v1.1.md` R0/R1 |

## 5. Provider-console checks (Gate D — seven)

Agent-safe (read-only browser): Railway backup recency (<25h) · Arnica zero Critical/High ·
Grafana Cloud usage <80% · Blacksmith projected spend vs the ~$79 baseline.
**HUMAN-ONLY**: DMARC aggregate reports in the personal inbox (prerequisite for p=reject) · AWS
Bedrock model-access form (console shares creds with KMS + S3-WORM) · vault/Railway/local key-name
parity (interactive `op signin` + personal Railway login). Detail + evidence formats:
`docs/ops/provider-console-checks.md`; findings append to `docs/deploy/STATE.md`.

## 6. Decision rounds waiting

| Decision                                    | Shape                                                                                                                                                                                                                                            | Source                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Consolidation picker round                  | 18 verified cuts (~1.6k LOC net) to approve/schedule + 6 gated rows: C01 analytics retirement and C04 design-critic fold need superseding ADRs; C10 waits for `field-crypto@2.0.0`; C13/C25 conditional; C16 high-risk (release-byte validation) | `outputs/audit/2026-08-consolidation/PICKER-TABLE.md`              |
| auth session-token-hashing precondition ADR | future-trigger spec — do not build until the trigger fires; opening the ADR also fixes the spec's stale lift-sweep pointer                                                                                                                       | `outputs/specs/deferred-respec/SPEC-auth-session-token-hashing.md` |
| Railway PITR                                | standing declined (2026-07-11, reconfirmed twice) — reopens only if real commerce data raises the recovery-point bar                                                                                                                             | `docs/state/decisions-and-forks.md`                                |

Every other fork is locked — the fork board's open table has exactly one row (PITR), and
`CLAUDE.md` §Still-open reads "Nothing."

## 7. Held / self-healing / watches (no operator action now)

- Renovate **#418** (non-major batch) + **#422** (jsdom 30): red only on the bun 7-day
  `minimumReleaseAge` floor; they go green as versions age. `renovate.json` now carries
  `minimumReleaseAge: "7 days"` so future batches arrive pre-aged. **#418 rider:** the
  better-auth 1.6.26 bump inside it needs the session-adapter exact-pin lockstep review
  (CAISSON-175) before merge, even on green.
- support-bot base-image digest bump (#415) reaches prod on the next release train — its Railway
  deploy is train-only.
- Monthly dispatches queued in Linear: gw-persona-walkthrough (CAISSON-184), gw-gtm-copywriter
  (CAISSON-174); pricing pulse (CAISSON-169); the intel/AEO triage stack (CAISSON-152–168) waits
  for a product sitting.
- Stale rows to clear on next owner-doc touch: operator-walkthrough's 2026-07-25 GitHub-cert
  open-PR line (those PRs merged); CAISSON-151's "hold until after 2026-07-30" date-gate has
  passed — re-triage.
