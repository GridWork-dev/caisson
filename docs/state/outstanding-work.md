---
updated: 2026-07-29
status: live
grounds:
  - knowledge/decisions/ADR-0379-full-state-completion-program-locks.md
  - knowledge/decisions/ADR-0380-completion-fork-locks-and-module-depth-slice.md
  - knowledge/decisions/ADR-0386-everything-reprice-release-sequencing-and-wave-force-push.md
  - knowledge/decisions/ADR-0387-field-crypto-kms-backing-and-pre-deploy-arming-pass.md
  - knowledge/decisions/ADR-0388-oscal-wave-runs-parallel-and-merges-before-the-first-train.md
  - outputs/specs/full-state-completion/SPEC.md
  - docs/state/decisions-and-forks.md
  - docs/state/production-readiness.md
  - docs/deploy/STATE.md
  - docs/business/caisson-internal-master-map.md
  - outputs/executions/2026-07-25-github-certification.md
  - outputs/executions/2026-07-27-project-reconciliation.md
  - outputs/research/infra-provider-audit-2026-07-16.md
  - docs/ops/provider-console-checks.md
---

# Outstanding work — Caisson

The canonical execution tracker. This file owns work; the
[fork board](decisions-and-forks.md) owns unresolved decisions; the
[first-sale master map](../business/caisson-internal-master-map.md) owns business and adviser
gates. [Build state](../build-state.md) and [deploy state](../deploy/STATE.md) own implementation
and runtime evidence.

## State matrix

| Workstream                                       | State                | Exit evidence                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0 — canonical truth and issue reconciliation    | **complete**         | SOT content gates green; PR board empty; merged-PR branches and all wave worktrees removed 2026-07-27, five reconcile-snapshot recovery refs kept on purpose                                                                                                                                                                                        |
| T1 — TypeScript dependency graph                 | **complete locally** | `c236681f`; 2,296 modules, 1,630 TypeScript modules, sentinels present                                                                                                                                                                                                                                                                              |
| T2 — total price authority                       | **complete locally** | `f6122de8` + `92d930b6`; every sellable commercial package covered                                                                                                                                                                                                                                                                                  |
| T3 — route-specific limiter policy               | **complete locally** | `014ac4de`; webhook fail-open+alert, protected routes 503                                                                                                                                                                                                                                                                                           |
| T4 — one-SHA fleet and migration 0030            | **complete**         | executed 2026-07-27 (`d99d5e95`): six legs on `e6ee01a6`, `RESULT: PARITY OK`, migration chain `schema_version` 29 → 32 with a pg_restore-verified backup and the structural receipt. The `tenant_ai_credential` BLOCKING preflight passed at `sealed_rows = 0`. `site.byok-field-crypto` stays unarmed — no Azure vault was ever provisioned       |
| T5 — five locked product residuals               | **complete**         | `b037b878` DS manifest; T5A merged in #332; T5B/C/E merged in #335                                                                                                                                                                                                                                                                                  |
| T6 — Inngest + Azure Key Vault + Azure Blob WORM | **complete**         | three isolated adapter reviews and changesets, merged in #335                                                                                                                                                                                                                                                                                       |
| T7 — consolidated verification and release       | **complete**         | `v2026.07.27.1` released 2026-07-28 on `8f930b6753d9` — first signed tag, readiness 8/8, 50 tarballs published byte-exact, R2 parity 350/350, index parity OK across repo/license/worker/admin, Worker plus four Railway services redeployed from the tag ([deploy state](../deploy/STATE.md))                                                      |
| T8 — field-crypto KMS async refactor             | **complete**         | merged `13e814da` (#353). Four review rounds; each of the first three found defects introduced by the previous round's fixes. ADR-0392 corrects three ADR-0389 claims and caps prefetch depth                                                                                                                                                       |
| T8b — scoped key operations (ADR-0393)           | **complete**         | merged `0d878553` (#354). `withKey()` lends and zeroizes instead of returning a raw DEK, closing the fork ADR-0392 deferred. Fixed a latent leak on the derived (non-KMS) path that all four T8 rounds missed                                                                                                                                       |
| T9 — post-tag audit remediation                  | **in review**        | branch `fix/post-tag-audit-remediation`. Carries every finding the `v2026.07.27.1` audit disclosed except F2, which was attempted, proven wrong, and reverted (see the addendum in the [release audit](../../outputs/audit/release-audit-v2026.07.27.1.md)); F3-F5 stay disclosed by their own dispositions. 224/224 turbo tasks and the gate green |

The earlier five-wave program is merged. The 2026-07-27 reconciliation cutoff found seven newer
open PRs: writing #345, OSCAL #346, and Ask AI evidence #347 are represented on local `main`;
green dependency PRs #349 and #350 are also represented. Full evidence and recovery refs are in the
[reconciliation report](../../outputs/executions/2026-07-27-project-reconciliation.md).

**The PR board is empty as of 2026-07-27.** Three PRs opened after that cutoff merged the same day
— scoped keys #354 (`0d878553`), runbook catalog truing #355 (`03198633`), and the test-timeout
repair #356 (`db4c693a`). Renovate #351 was closed rather than left red: every job failed because
`renovate/artifacts` could not update the lockfile inside the 7-day `minimumReleaseAge` window,
which is the supply-chain floor working as designed. #352 already reverted that batch deliberately,
none of its bumps fix a known advisory, and Renovate re-proposes once the versions age naturally.
#348 was closed earlier. Seven branches from merged or closed PRs and all six wave worktrees were
removed after each was checked for unlanded work; five reconcile-snapshot recovery refs are kept on
purpose, and they are now the only thing branch-hygiene reports.

The changeset backlog was **drained** by the version PR (#359, `52376dee`), which consumed all 54
files and bumped every package. Those versions are now **published**: the `v2026.07.27.1` train
uploaded 50 tarballs byte-exact and the R2 parity probe moved 300/350 → **350/350**. Six new
changesets have since accumulated on the post-tag remediation branch (T9 below) — kernel,
compliance, ds-manifest, jobs, registry-schema, standards-gate — so the next version PR has real
work to consume.

## Linear reconciliation

| Issue       | State                   | Canonical disposition                                                       |
| ----------- | ----------------------- | --------------------------------------------------------------------------- |
| CAISSON-150 | In Progress             | ADR-0379 completion program                                                 |
| CAISSON-134 | **Done**                | three module-depth pages; fork closed by ADR-0380 lock 6, merged in #332    |
| CAISSON-104 | Todo                    | Ring-3 operator/external act using the corrected probe runbook              |
| CAISSON-39  | Todo                    | D10 WORM receipt active; non-D10 evidence classes trigger-parked            |
| CAISSON-113 | Backlog                 | narrowed to provider-console/key-parity reads                               |
| CAISSON-151 | Backlog, due 2026-07-31 | time-gated through July 30                                                  |
| CAISSON-105 | Backlog                 | business/public-release gated                                               |
| CAISSON-101 | Backlog                 | trigger: real cassette/model change                                         |
| CAISSON-78  | Backlog                 | trigger: material competitor event                                          |
| CAISSON-130 | Backlog                 | trigger: future copy wave; frozen now                                       |
| CAISSON-131 | **Done**                | July persona findings absorbed into the completed audit/remediation program |

## Operator and external gates

| Gate                   | Required action and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub                 | Private-repository access has been authorized since 2026-06-30 (`gh auth status` shows an active `repo`-scoped token; `caisson-sh/caisson` confirmed private). Branch protection stays discipline-only on the Free plan (ADR-0327) and org 2FA was explicitly declined 2026-07-15, re-raise at launch — both accepted residuals, not open work. What remains is certifying open PRs, Actions, releases, and public-repository timing: see [2026-07-25 GitHub certification](../../outputs/executions/2026-07-25-github-certification.md). |
| Technical proof        | Produce reproducible COMPLIANCE-WORM, deployed-pooler RLS, split-brain recovery, and KMS-signing receipts.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Independent acceptance | Attach two or three working-auditor reviews before paid launch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Commerce               | Finish Paddle production approval, recreate the 36-product/68-price catalog, configure adjustment+dunning handling, and prove real checkout, refund, and entitlement flows.                                                                                                                                                                                                                                                                                                                                                               |
| Business               | Complete Mercury and the 18 first-sale governance, ownership, IP, bookkeeping, tax, reserve, export, continuity, and go/no-go gates.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Advisers               | Resolve or explicitly defer the 14 counsel, 8 CPA, and 9 operator questions in the master map.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Ring 3                 | Create the probe account and allowlist, deploy the admin changes, and verify GitHub OAuth.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Public release         | Keep cart/dashboard/checkout Cloudflare-gated; at launch remove the gates and record GOVERNANCE→COMPLIANCE WORM evidence.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| OSS/npm                | Flip the OSS repository and publish npm artifacts only after the business and release gates; run Show HN afterward.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Anchoring              | Arm the existing scheduler and add TSA/Rekor/OTS egress entries to the cross-repo security ledger.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Provider operations    | Seven Gate D provider-console checks — see [provider-console-checks](../ops/provider-console-checks.md) — plus regenerating the dead `OPENROUTER_MANAGEMENT_KEY` (401s today; regeneration restores per-key usage/attribution for the six per-service inference keys, per [infra-provider-audit-2026-07-16](../../outputs/research/infra-provider-audit-2026-07-16.md) M2).                                                                                                                                                               |
| Demand                 | After all four technical receipts, start the 30-day demand program, buyer interviews, discounted-partner proof, and five design-partner emails.                                                                                                                                                                                                                                                                                                                                                                                           |

## Active build program

1. **Truth (COMPLETE locally):** this tracker, production-readiness, package catalog,
   architecture, deploy state, runbooks, spec status, ADR index, branches, worktrees, and open PRs
   were reconciled on 2026-07-27. Recovery refs and operator-owned worktrees remain by design.
2. **Safety:** land the dependency-graph guard, total price authority, and route-specific limiter
   behavior. Complete locally in commits `c236681f`, `f6122de8`, `014ac4de`, `92d930b6`,
   and `3e384bc5`.
3. **Fleet:** from one approved commit deploy site, admin, license, docs-RAG, support-bot, and
   registry Worker; apply migration 0030; run parity, health, checkout, entitlement, refund, RAG,
   and support probes. This is an explicit external-system/data-migration hold.
4. **Locked product gaps (COMPLETE):** the generated 39-component DS manifest, drift guard,
   shared contrast gate, three module-depth pages, admin proof/export, tenant proof route, and
   buyer crosswalk are all represented locally.
5. **Provider adapters (COMPLETE):** Inngest v4 jobs, Azure Key Vault KMS, and Azure Blob
   immutable storage landed in isolated reviewed lanes. T8 is the separate production-consumer
   integration for field crypto.
6. **oscal-spine SKU + two-price catalog move (COMPLETE on local `main`):** the whole OSCAL surface now lives in the standalone commercial
   `@caisson/oscal-spine` package, both parents depend on and re-export it, and the pricebook carries
   the $249 SKU plus its 2026-07-25 Compliance join. Compliance is $1,649 / $659 renewal; Everything
   is $2,259 / $899 renewal. The Paddle plan is 36 products / 68 prices, and Sandbox carries real
   purchase + renewal rows for the new module; `RENEWAL_BOOK` has 33 active one-year-default rows
   plus two archived forward-only resolver rows for the replaced bundle prices. The
   docs-RAG corpus, support answer source, runbooks, current state docs, storefront, manifests, and
   price authority move together. The append-only registry ledger/index remains the published
   history until the release train snapshots the current workspace manifests. The ADR-0388 merge
   point is satisfied: the next tag can consume the complete catalog once rather than publishing
   an intermediate pricebook.
7. **Grill remediation (COMPLETE):** an independent adversarial audit of the four open PRs
   ([report](../../outputs/audit/2026-07-25-open-pr-grill.md)) tested 44 hypotheses, refuted 39, and
   confirmed 5 — three on #335, one on #333, one on #334 — and confirmed zero cross-PR merge
   conflicts. All four PRs were green on CI and #335's author self-reported code, security, and
   adversarial reviews PASS; none of the five were gate-shaped, which is the case for keeping an
   independent lane. **Four of the five are closed and merged.** The #334 currency defect is fixed
   (`09e8516f`, in #334). The #333 Paddle marker-only validation P1 is fixed and merged (`6f44c60f`):
   the recreate tool now validates `status`, `amount`, `currency_code`, and billing-cycle
   interval/frequency against the planned catalog before accepting a mapping, behind nine
   fail-closed tests. #332's four candidates were all refuted and it merged unchanged. **Only lane A
   remains** — the two evidence-path P1s locked by **ADR-0385** (no bundled verifier; fail-closed
   per-event export allowlist) plus the Inngest `singletonKey` P2. **All five are now closed**: lane A
   deleted the 416-line embedded verifier outright, stood up `@caisson/verify-pack` with an honest
   "not published" section, made exports fail closed per event type with negative tests on the exact
   keys the grill found, and made Inngest **throw** on `singletonKey` rather than silently discard it.
8. **T8 — field-crypto KMS async refactor (MERGED `13e814da`, #353, ADR-0387/0392):** admitted after
   four review rounds. The rounds are worth recording because each of the first three found defects
   introduced by the previous round's own fixes: round 2 found a wrong append-only WORM receipt state
   and a lost synchronous abort that returned a live plaintext DEK; round 3 found that the abort fix
   had orphaned a promise rejection (process-fatal on the GCP driver) and that the RLS preflight was
   still capable of a false green; round 4 found that the round-3 fix reported provider failures in
   place of cancellations. Treat any future edit to `kms-budget.ts`'s race as requiring the same
   scrutiny. ADR-0392 supersedes ADR-0389 decisions 1 and 3 in their stated properties and caps
   prefetch depth; the design itself was correct throughout and never changed.
9. **Arming pass (operator, ADR-0387):** verify every boot-blocking variable across all six legs has
   an arming record; rotate `DOCS_SERVICE_TOKEN`, `SUPPORT_BOT_GRANT_TOKEN`, and `LICENSE_ISSUE_TOKEN`
   atomically — new value on every holder **before** restarting any, then verifier-before-issuer and
   re-probe both sides. A set-but-unrecorded value is adopted and recorded, never regenerated.
10. **Release and deploy (Act 1 DONE; Act 2 in flight):** the fleet deploy, migration chain, and
    parity/probe set ran 2026-07-27 and the version PR consumed every changeset. What remains is the
    tag itself: `v2026.07.27` was pushed and its train **failed at readiness R3** — `bun run sot`
    red on a package-count drift, plus a missing R4 audit and per-release checklist, which readiness
    reads from the TAGGED tree. It is being re-cut as `v2026.07.27.1`, an attestation-only successor
    carrying only docs, the audit, the checklist, and unpacked fixes, so the byte gate is untouched.
    Then: R2 upload, mirror sync, Worker redeploy from the tag, and the post-deploy docs/support
    probe asserting $1,649 and $2,259.

## Trigger-parked

These are not part of the active completion program:

- CAISSON-151 until after 2026-07-30.
- CAISSON-105 until the public-release decision.
- CAISSON-101 until a real cassette/model change.
- CAISSON-78 until a competitor-event cadence fires.
- CAISSON-130 until a future copy trigger; site copy is frozen in this program.
- CAISSON-39 work outside the four D10 technical receipts.
- Affiliates, directories, multi-year pricing, production CMK, ISO claims, Railway PITR,
  vertical packages, MySQL, Socket, SOC 2, AuditKit, and rich OSCAL until their documented
  triggers fire.

## Recently closed

| Date       | Evidence                                                                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 | `v2026.07.27.1` released and fully propagated: 50 tarballs published byte-exact, R2 350/350, index parity OK, first signed release tag                                                              |
| 2026-07-28 | Release-train leg 4 found decorative: `deploy-railway` is unarmed (`RAILWAY_TOKEN` repo secret unset), skips every step, and reports green — a green train can leave the site on the previous image |
| 2026-07-28 | R4 release audit for `v2026.07.27.1`: security PASS-WITH-DISCLOSURES, code review FAIL on five blockers, all five confirmed and fixed pre-tag outside packed bytes                                  |
| 2026-07-28 | ADR-0022 dependency-graph gate repaired: `--output-type json` hardcodes `exitCode: 0`, so the boundary gate had been a no-op since the CI command changed                                           |
| 2026-07-27 | T4 Act 1 executed: six legs on `e6ee01a6`, PARITY OK, migration chain 29 → 32 with backup and structural receipt                                                                                    |
| 2026-07-27 | Board cleared: #354/#355/#356 merged, #351 closed as a `minimumReleaseAge` artifact rather than a defect, seven stale branches and six wave worktrees removed                                       |
| 2026-07-27 | Test-timeout flake class closed at the cause (#356): bun's 5s default was under 5x the idle cost of real work; 224/224 uncached, zero timeouts                                                      |
| 2026-07-27 | Launch runbook trued to the shipped catalog (#355): nine stale price and count claims against a probe that already asserted the new ones                                                            |
| 2026-07-27 | Scoped key operations replace raw DEK access (#354, ADR-0393), closing the fork ADR-0392 deferred                                                                                                   |
| 2026-07-25 | Wave reconcile: all five PRs (#332-#337) rebased and squash-merged to `main`; four lane worktrees and panes closed out                                                                              |
| 2026-07-25 | Adversarial grill of the four open PRs — 44 candidates, 39 refuted, 5 confirmed ([report](../../outputs/audit/2026-07-25-open-pr-grill.md))                                                         |
| 2026-07-25 | Generated 39-component design manifest and shared contrast gate                                                                                                                                     |
| 2026-07-25 | Launch-critical dependency, price, and limiter safety fixes on this branch                                                                                                                          |
| 2026-07-25 | Site truth-fix deployment recorded in deploy state                                                                                                                                                  |
| 2026-07-24 | Visual re-audit: 729/729 fixed                                                                                                                                                                      |
| 2026-07-23 | Media-overhaul program merged in PR #326                                                                                                                                                            |
| 2026-07-20 | Compliance-gap SKU release and $1,449 Compliance bundle                                                                                                                                             |

Older chronology remains in git, [build history](../archive/build-history.md), and
[deploy state](../deploy/STATE.md).
