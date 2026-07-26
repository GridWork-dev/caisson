---
updated: 2026-07-25
status: live
grounds:
  - knowledge/decisions/ADR-0379-full-state-completion-program-locks.md
  - knowledge/decisions/ADR-0380-completion-fork-locks-and-module-depth-slice.md
  - knowledge/decisions/ADR-0386-everything-reprice-release-sequencing-and-wave-force-push.md
  - knowledge/decisions/ADR-0387-field-crypto-kms-backing-and-pre-deploy-arming-pass.md
  - outputs/specs/full-state-completion/SPEC.md
  - docs/state/decisions-and-forks.md
  - docs/state/production-readiness.md
  - docs/deploy/STATE.md
  - docs/business/caisson-internal-master-map.md
  - outputs/executions/2026-07-25-github-certification.md
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

| Workstream                                       | State                        | Exit evidence                                                                                                                                      |
| ------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0 — canonical truth and issue reconciliation    | **complete locally**         | SOT content gates green; only concurrent-worktree hygiene remains                                                                                  |
| T1 — TypeScript dependency graph                 | **complete locally**         | `c236681f`; 2,296 modules, 1,630 TypeScript modules, sentinels present                                                                             |
| T2 — total price authority                       | **complete locally**         | `f6122de8` + `92d930b6`; every sellable commercial package covered                                                                                 |
| T3 — route-specific limiter policy               | **complete locally**         | `014ac4de`; webhook fail-open+alert, protected routes 503                                                                                          |
| T4 — one-SHA fleet and migration 0030            | **blocked on T8**            | six runtime legs on one approved SHA; migration and parity receipts. ADR-0387 puts the KMS async wave AHEAD of the deploy — T4 no longer runs next |
| T5 — five locked product residuals               | **complete**                 | `b037b878` DS manifest; T5A merged in #332; T5B/C/E merged in #335                                                                                 |
| T6 — Inngest + Azure Key Vault + Azure Blob WORM | **complete**                 | three isolated adapter reviews and changesets, merged in #335                                                                                      |
| T7 — consolidated verification and release       | **after T8**                 | green local/CI gates, immutable tag-to-bytes and deploy receipts. ADR-0386 runs the train before the oscal wave; the oscal wave earns a second     |
| T8 — field-crypto KMS async refactor (NEW)       | **next up: SPEC then build** | ADR-0387; site BYOK and ai-kit MCP run tools off `SyncFieldKeyProvider`, Azure Key Vault wired, wrapped-DEK store homed, fail-closed on KMS loss   |

**All five wave PRs are merged.** #334 (`96aa01d2`, trunk), #333 (`6f44c60f`, Paddle onboarding +
catalog-mapping validation), #332 (`2cd41843`, module-depth pages), #336 (`70a438a4`, ADR-0386 +
tracker), #337 (`d94f9d5f`, trivy local parity), #335 (`31bf5f1c`, lane A). Zero open PRs; the
reconciled tree verified green end to end — 221/221 turbo tasks, 75 packages gate, sot green on every
content gate, security scan `rc=0` at 3,969 real semgrep targets.

There are **39 pending changeset files**. Current Changesets resolution is 40 patch package
releases and 6 minor package releases. They are consumed only by T7.

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

1. **Truth:** reconcile this tracker, production-readiness, package catalog, architecture, deploy
   state, runbooks, spec status, ADR index, and Linear.
2. **Safety:** land the dependency-graph guard, total price authority, and route-specific limiter
   behavior. Complete locally in commits `c236681f`, `f6122de8`, `014ac4de`, `92d930b6`,
   and `3e384bc5`.
3. **Fleet:** from one approved commit deploy site, admin, license, docs-RAG, support-bot, and
   registry Worker; apply migration 0030; run parity, health, checkout, entitlement, refund, RAG,
   and support probes. This is an explicit external-system/data-migration hold.
4. **Locked product gaps:** the generated 39-component DS manifest, drift guard, and shared
   contrast gate are complete locally. Three module-depth pages, admin per-row proof/export,
   tenant proof route, and buyer crosswalk remain held on their named fork-board rows.
5. **Provider adapters:** add Inngest v4 jobs, Azure Key Vault KMS, and Azure Blob immutable
   storage in isolated implementation/review lanes.
6. **oscal-spine SKU + two-price catalog move (COMPLETE on
   `feature/oscal-spine-wave`):** the whole OSCAL surface now lives in the standalone commercial
   `@caisson/oscal-spine` package, both parents depend on and re-export it, and the pricebook carries
   the $249 SKU plus its 2026-07-25 Compliance join. Compliance is $1,649 / $659 renewal; Everything
   is $2,259 / $899 renewal. The Paddle plan is 36 products / 68 prices, and Sandbox carries real
   purchase + renewal rows for the new module; `RENEWAL_BOOK` has 33 active one-year-default rows
   plus two archived forward-only resolver rows for the replaced bundle prices. The
   docs-RAG corpus, support answer source, runbooks, current state docs, storefront, manifests, and
   price authority move together. The append-only registry ledger/index remains the published
   history until the release train snapshots the current workspace manifests. **Merge point:
   before the first release train** (operator amendment in the wave brief), so the next tag consumes
   the complete catalog once rather than publishing an intermediate pricebook.
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
8. **T8 — field-crypto KMS async refactor (NEXT, ADR-0387):** the deploy's new predecessor. Azure Key
   Vault backs field-crypto in production, but `KmsKeyProvider` implements the async-only
   `FieldKeyProvider` while `apps/site/lib/byok.ts:137` and `packages/ai-kit/src/mcp-run-tools.ts:61`
   both require `SyncFieldKeyProvider` — so this is a code wave through the tenant-secret path, not an
   environment swap. A sync DEK cache is explicitly rejected by the ADR. The SPEC owns one open design
   question: `FieldCryptoContext` (`packages/field-crypto/src/column.ts:48`) is the seam, and moving
   the async boundary to context-bind time keeps `sealField`/`unsealField` sync — but the
   NO-REMIGRATION INVARIANT means a bound context must answer `deriveKey` for **any past version**,
   which bind time cannot know. Also needs a production home for the wrapped-DEK store
   (`DbWrappedKeyStore` persists through a `KeyValueStore` seam nothing wires yet) and fail-closed
   behavior when the KMS hop fails.
9. **Arming pass (operator, ADR-0387):** verify every boot-blocking variable across all six legs has
   an arming record; rotate `DOCS_SERVICE_TOKEN`, `SUPPORT_BOT_GRANT_TOKEN`, and `LICENSE_ISSUE_TOKEN`
   atomically — new value on every holder **before** restarting any, then verifier-before-issuer and
   re-probe both sides. A set-but-unrecorded value is adopted and recorded, never regenerated.
10. **Release and deploy (after T8):** merge the completed OSCAL wave before the train, then deploy
    six legs on one SHA, apply migration 0030 (operator/data-migration gate), run the parity and
    probe set, consume all changesets in one version PR, tag immutable bytes, and redeploy the Worker
    from that tag. The post-deploy docs/support probe asserts $1,649 and $2,259.

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

| Date       | Evidence                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-25 | Wave reconcile: all five PRs (#332-#337) rebased and squash-merged to `main`; four lane worktrees and panes closed out                      |
| 2026-07-25 | Adversarial grill of the four open PRs — 44 candidates, 39 refuted, 5 confirmed ([report](../../outputs/audit/2026-07-25-open-pr-grill.md)) |
| 2026-07-25 | Generated 39-component design manifest and shared contrast gate                                                                             |
| 2026-07-25 | Launch-critical dependency, price, and limiter safety fixes on this branch                                                                  |
| 2026-07-25 | Site truth-fix deployment recorded in deploy state                                                                                          |
| 2026-07-24 | Visual re-audit: 729/729 fixed                                                                                                              |
| 2026-07-23 | Media-overhaul program merged in PR #326                                                                                                    |
| 2026-07-20 | Compliance-gap SKU release and $1,449 Compliance bundle                                                                                     |

Older chronology remains in git, [build history](../archive/build-history.md), and
[deploy state](../deploy/STATE.md).
