---
updated: 2026-07-25
status: live
grounds:
  - knowledge/decisions/ADR-0379-full-state-completion-program-locks.md
  - outputs/specs/full-state-completion/SPEC.md
  - docs/state/decisions-and-forks.md
  - docs/state/production-readiness.md
  - docs/deploy/STATE.md
  - docs/business/caisson-internal-master-map.md
---

# Outstanding work — Caisson

The canonical execution tracker. This file owns work; the
[fork board](decisions-and-forks.md) owns unresolved decisions; the
[first-sale master map](../business/caisson-internal-master-map.md) owns business and adviser
gates. [Build state](../build-state.md) and [deploy state](../deploy/STATE.md) own implementation
and runtime evidence.

## State matrix

| Workstream                                       | State                               | Exit evidence                                                          |
| ------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------- |
| T0 — canonical truth and issue reconciliation    | **complete locally**                | SOT green; Linear dispositions match this tracker                      |
| T1 — TypeScript dependency graph                 | **complete locally**                | `c236681f`; 2,296 modules, 1,630 TypeScript modules, sentinels present |
| T2 — total price authority                       | **complete locally**                | `f6122de8` + `92d930b6`; every sellable commercial package covered     |
| T3 — route-specific limiter policy               | **complete locally**                | `014ac4de`; webhook fail-open+alert, protected routes 503              |
| T4 — one-SHA fleet and migration 0030            | **held: external + migration gate** | six runtime legs on one approved SHA; migration and parity receipts    |
| T5 — five locked product residuals               | **1 complete / 4 held**             | DS manifest green; four named fork-board rows remain                   |
| T6 — Inngest + Azure Key Vault + Azure Blob WORM | **queued**                          | three isolated adapter reviews and changesets                          |
| T7 — consolidated verification and release       | **held after code waves**           | green local/CI gates, immutable tag-to-bytes and deploy receipts       |

There are **33 pending changeset files**. Current Changesets resolution is 41 patch package
releases and 4 minor package releases. They are consumed only by T7.

## Linear reconciliation

| Issue       | State                   | Canonical disposition                                                       |
| ----------- | ----------------------- | --------------------------------------------------------------------------- |
| CAISSON-150 | In Progress             | ADR-0379 completion program                                                 |
| CAISSON-134 | In Progress             | three module-depth pages; current content/mark fork is on the fork board    |
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

| Gate                   | Required action and evidence                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub                 | Authorize private-repository access, then certify open PRs, Actions, releases, branch posture, organization 2FA, and public-repository timing. Until then GitHub state is **unknown**, not green. |
| Technical proof        | Produce reproducible COMPLIANCE-WORM, deployed-pooler RLS, split-brain recovery, and KMS-signing receipts.                                                                                        |
| Independent acceptance | Attach two or three working-auditor reviews before paid launch.                                                                                                                                   |
| Commerce               | Finish Paddle production approval, recreate the 35-product/66-price catalog, configure adjustment+dunning handling, and prove real checkout, refund, and entitlement flows.                       |
| Business               | Complete Mercury and the 18 first-sale governance, ownership, IP, bookkeeping, tax, reserve, export, continuity, and go/no-go gates.                                                              |
| Advisers               | Resolve or explicitly defer the 14 counsel, 8 CPA, and 9 operator questions in the master map.                                                                                                    |
| Ring 3                 | Create the probe account and allowlist, deploy the admin changes, and verify GitHub OAuth.                                                                                                        |
| Public release         | Keep cart/dashboard/checkout Cloudflare-gated; at launch remove the gates and record GOVERNANCE→COMPLIANCE WORM evidence.                                                                         |
| OSS/npm                | Flip the OSS repository and publish npm artifacts only after the business and release gates; run Show HN afterward.                                                                               |
| Anchoring              | Arm the existing scheduler and add TSA/Rekor/OTS egress entries to the cross-repo security ledger.                                                                                                |
| Provider operations    | Verify Railway backup recency, Arnica, Grafana quota, Blacksmith minutes, DMARC, vault/key parity, Bedrock, and the launch `SESSION_TOKEN_HMAC_KEY`; remove the dead OpenRouter management key.   |
| Demand                 | After all four technical receipts, start the 30-day demand program, buyer interviews, discounted-partner proof, and five design-partner emails.                                                   |

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
6. **Release:** reconcile all code waves, run audits and full gates, consume all changesets in one
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

| Date       | Evidence                                                                   |
| ---------- | -------------------------------------------------------------------------- |
| 2026-07-25 | Generated 39-component design manifest and shared contrast gate            |
| 2026-07-25 | Launch-critical dependency, price, and limiter safety fixes on this branch |
| 2026-07-25 | Site truth-fix deployment recorded in deploy state                         |
| 2026-07-24 | Visual re-audit: 729/729 fixed                                             |
| 2026-07-23 | Media-overhaul program merged in PR #326                                   |
| 2026-07-20 | Compliance-gap SKU release and $1,449 Compliance bundle                    |

Older chronology remains in git, [build history](../archive/build-history.md), and
[deploy state](../deploy/STATE.md).
