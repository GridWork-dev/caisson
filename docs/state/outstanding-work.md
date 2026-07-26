---
updated: 2026-07-25
status: live
grounds:
  - knowledge/decisions/ADR-0379-full-state-completion-program-locks.md
  - knowledge/decisions/ADR-0380-completion-fork-locks-and-module-depth-slice.md
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

| Workstream                                       | State                               | Exit evidence                                                                             |
| ------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| T0 — canonical truth and issue reconciliation    | **complete locally**                | SOT content gates green; only concurrent-worktree hygiene remains                         |
| T1 — TypeScript dependency graph                 | **complete locally**                | `c236681f`; 2,296 modules, 1,630 TypeScript modules, sentinels present                    |
| T2 — total price authority                       | **complete locally**                | `f6122de8` + `92d930b6`; every sellable commercial package covered                        |
| T3 — route-specific limiter policy               | **complete locally**                | `014ac4de`; webhook fail-open+alert, protected routes 503                                 |
| T4 — one-SHA fleet and migration 0030            | **held: external + migration gate** | six runtime legs on one approved SHA; migration and parity receipts                       |
| T5 — five locked product residuals               | **1 complete / 4 in build**         | `b037b878` DS manifest green; forks closed by ADR-0380 — T5B/C/E in lane A, T5A in lane B |
| T6 — Inngest + Azure Key Vault + Azure Blob WORM | **in build (lane A)**               | three isolated adapter reviews and changesets; KMS port widening is breaking              |
| T7 — consolidated verification and release       | **held after code waves**           | green local/CI gates, immutable tag-to-bytes and deploy receipts                          |

There are **33 pending changeset files**. Current Changesets resolution is 41 patch package
releases and 4 minor package releases. They are consumed only by T7.

## Linear reconciliation

| Issue       | State                   | Canonical disposition                                                        |
| ----------- | ----------------------- | ---------------------------------------------------------------------------- |
| CAISSON-150 | In Progress             | ADR-0379 completion program                                                  |
| CAISSON-134 | In Progress             | three module-depth pages; fork closed by ADR-0380 lock 6, building in lane B |
| CAISSON-104 | Todo                    | Ring-3 operator/external act using the corrected probe runbook               |
| CAISSON-39  | Todo                    | D10 WORM receipt active; non-D10 evidence classes trigger-parked             |
| CAISSON-113 | Backlog                 | narrowed to provider-console/key-parity reads                                |
| CAISSON-151 | Backlog, due 2026-07-31 | time-gated through July 30                                                   |
| CAISSON-105 | Backlog                 | business/public-release gated                                                |
| CAISSON-101 | Backlog                 | trigger: real cassette/model change                                          |
| CAISSON-78  | Backlog                 | trigger: material competitor event                                           |
| CAISSON-130 | Backlog                 | trigger: future copy wave; frozen now                                        |
| CAISSON-131 | **Done**                | July persona findings absorbed into the completed audit/remediation program  |

## Operator and external gates

| Gate                   | Required action and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub                 | Private-repository access has been authorized since 2026-06-30 (`gh auth status` shows an active `repo`-scoped token; `caisson-sh/caisson` confirmed private). Branch protection stays discipline-only on the Free plan (ADR-0327) and org 2FA was explicitly declined 2026-07-15, re-raise at launch — both accepted residuals, not open work. What remains is certifying open PRs, Actions, releases, and public-repository timing: see [2026-07-25 GitHub certification](../../outputs/executions/2026-07-25-github-certification.md). |
| Technical proof        | Produce reproducible COMPLIANCE-WORM, deployed-pooler RLS, split-brain recovery, and KMS-signing receipts.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Independent acceptance | Attach two or three working-auditor reviews before paid launch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Commerce               | Finish Paddle production approval, recreate the 35-product/66-price catalog, configure adjustment+dunning handling, and prove real checkout, refund, and entitlement flows.                                                                                                                                                                                                                                                                                                                                                               |
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
6. **oscal-spine SKU + Compliance reprice (ADR-0383 + ADR-0384, NOT STARTED):** a dedicated wave,
   ordered because each step gates the next. Carve `@caisson/oscal-spine` out of `frameworks-pack`
   and `compliance-core` — per ADR-0384 the **whole** OSCAL surface moves (not just the ADR-0363/0364
   spine), both parents depend on it and **re-export** it so no consumer breaks, and the package is
   `LicenseRef-Caisson-Commercial` → pricebook at $249 plus a Compliance membership entry,
   `BUNDLE_RETAIL.compliance = 1649`, and a `RENEWAL_BOOK` row (32 → 33) → production catalog
   **35/66 → 36/68** in `tools/paddle-catalog-recreate.ts` and every gate and runbook asserting the
   count, including its `renewalCents("compliance")` assertion **57900 → 65900** (ADR-0384: the
   reprice moves the Compliance renewal $579 → $659 through the locked 40%-X9 formula; oscal-spine's
   own renewal derives to $99) → regenerate `packages/cli/registry-index.json` → the ~10 files
   carrying $1,449 outside append-only history → the docs-RAG pricing corpus and the support-bot
   answer → the state docs. Indivisible: the price-authority gate fails on a catalog where the
   pricebook and display sheet disagree. Deployed docs/support keep answering $1,449 until the fleet
   redeploy, so the runbook's probe becomes a post-deploy check rather than a pre-deploy assertion.
   Sequencing confirmed at the 2026-07-25 picker: runs **after** the reconcile, off a clean `main`.
7. **Grill remediation (in flight):** an independent adversarial audit of the four open PRs
   ([report](../../outputs/audit/2026-07-25-open-pr-grill.md)) tested 44 hypotheses, refuted 39, and
   confirmed 5 — three on #335, one on #333, one on #334 — and confirmed zero cross-PR merge
   conflicts. All four PRs were green on CI and #335's author self-reported code, security, and
   adversarial reviews PASS; none of the five were gate-shaped, which is the case for keeping an
   independent lane. The #334 currency defect is fixed (`09e8516f`). The two evidence-path P1s are
   locked by **ADR-0385** (no bundled verifier; fail-closed per-event export allowlist) and are
   building in lane A alongside the Inngest `singletonKey` P2; the #333 Paddle marker-only
   validation P1 is building in the onboarding lane. **The reconcile waits on these** — merging a
   confirmed P1 to main is not a trade worth making.
8. **Release:** reconcile all code waves, run audits and full gates, consume all changesets in one
   version PR, tag immutable bytes, publish the tag, and redeploy the Worker from that tag.

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
| 2026-07-25 | Adversarial grill of the four open PRs — 44 candidates, 39 refuted, 5 confirmed ([report](../../outputs/audit/2026-07-25-open-pr-grill.md)) |
| 2026-07-25 | Generated 39-component design manifest and shared contrast gate                                                                             |
| 2026-07-25 | Launch-critical dependency, price, and limiter safety fixes on this branch                                                                  |
| 2026-07-25 | Site truth-fix deployment recorded in deploy state                                                                                          |
| 2026-07-24 | Visual re-audit: 729/729 fixed                                                                                                              |
| 2026-07-23 | Media-overhaul program merged in PR #326                                                                                                    |
| 2026-07-20 | Compliance-gap SKU release and $1,449 Compliance bundle                                                                                     |

Older chronology remains in git, [build history](../archive/build-history.md), and
[deploy state](../deploy/STATE.md).
