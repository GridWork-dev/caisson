---
updated: 2026-07-27
status: live
grounds:
  - docs/state/outstanding-work.md
  - docs/state/production-readiness.md
  - docs/build-state.md
  - docs/deploy/STATE.md
---

# Project reconciliation — 2026-07-27

This is the local reconciliation ledger for the operator-directed pause. It records the cutoff,
the recoverability measures, the work admitted to local `main`, the work deliberately held out,
and the next implementation lane. No branch or worktree was deleted, no force-push occurred, no
remote PR was merged or modified, and no production or provider system was changed.

## Cutoff and freeze

- Repository: `/home/gw/lab/caisson`
- Remote baseline: `origin/main` at `2efeea98`
- Reconciled local line: `main`, beginning at `2efeea98`
- Sessions and agents: no separate live Caisson Claude session, `gw dispatch`, or Caisson worker
  remained after the process sweep. The reconciliation Codex session was the sole active Caisson
  agent. Unrelated GridWork Core and health-service processes were out of scope and untouched.
- Stashes: none.
- Inventory cutoff: the final GitHub refresh on 2026-07-27, after Renovate opened PRs #350 and
  #351. No automation was disabled because that would modify an external system.

## Worktrees and local state

| Worktree                         | Branch / head at cutoff                       | Uncommitted state                               | Disposition                                                     |
| -------------------------------- | --------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `/home/gw/lab/caisson`           | `main` / `2efeea98` before integration        | clean                                           | reconciliation target                                           |
| `/home/gw/lab/caisson-aiact`     | `feature/ai-act-article-50` / `ae5c77d5`      | `AIACT-BRIEF.txt`                               | code already represented upstream; brief preserved              |
| `/home/gw/lab/caisson-kms`       | `feature/field-crypto-kms-async` / `415c9a13` | `KMS-BRIEF.txt`, `outputs/repomix/`             | valuable, high-risk; preserved for fresh exact-head review      |
| `/home/gw/lab/caisson-launchfix` | `feature/launch-gap-remediation` / `aa1a60ec` | two launch briefs                               | branch tree already represented upstream; briefs preserved      |
| `/home/gw/lab/caisson-oscal`     | `feature/oscal-spine-wave` / `f2a9b96b`       | OSCAL brief and eight review packs              | validated code integrated; research preserved privately         |
| `/home/gw/lab/caisson-writing`   | `feature/writing-surface` / `341fc5cb`        | five tracked WIP files plus `WRITING-BRIEF.txt` | branch and validated WIP integrated; original worktree retained |

Other local branches at cutoff were `docs/ask-ai-production-proof`,
`docs/build-state-refresh`, and the six feature branches above. The build-state-refresh patch was
already present and obsolete. Read-only PR refs under `reconcile/pr-*` were created only to inspect
exact remote patches.

## Recoverability

Before integration, alternate-index snapshots captured each material dirty state without touching
the original worktrees:

| Recovery ref                              | Commit     | Contents                                      |
| ----------------------------------------- | ---------- | --------------------------------------------- |
| `fix/reconcile-main-base-20260727`        | `2efeea98` | exact pre-reconciliation remote-main base     |
| `fix/reconcile-snapshot-writing-20260727` | `238e1509` | writing branch, five tracked edits, and brief |
| `fix/reconcile-snapshot-aiact-20260727`   | `ffc6b66d` | AI Act branch and brief                       |
| `fix/reconcile-snapshot-kms-20260727`     | `5a0a741a` | KMS branch, brief, and review pack            |
| `fix/reconcile-snapshot-launch-20260727`  | `c70656e6` | launch branch and both briefs                 |

Blob equivalence was checked against the original files. The OSCAL packs include legal/research
material and were not committed to Git. A byte-identical, mode-0700 backup lives at:

`/home/gw/.local/state/caisson-reconciliation/2026-07-27/oscal-spine/`

It contains `OSCAL-BRIEF.txt` plus all eight `outputs/repomix/*.xml` files. Hash and recursive
directory comparisons passed. Originals remain in place.

## Feature classification

| Feature                                    | Status and overlap                                                                                                    | Risk                                                | Reconciliation disposition                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Writing surface and Article 50 watch       | valuable; branch extended remote PR #345; WIP corrected adopted-text status and source locators                       | medium, regulatory copy and outbound-source watcher | merged with preserved history; WIP regrounded in official sources                     |
| Standalone OSCAL spine and catalog reprice | valuable; remote PR #346 conflicted only in two state documents after later main work                                 | high, package ownership, entitlements, and money    | merged after prior review receipts and fresh full-repo verification                   |
| Ask AI production proof                    | complete evidence-only draft PR #347; no runtime overlap                                                              | low                                                 | cherry-picked locally                                                                 |
| `actions/checkout` v7 digest               | green PR #349; writing added one extra workflow absent from the PR                                                    | low, supply-chain pin                               | applied across all 16 workflows and independently verified                            |
| Python `3.14-slim` digest                  | green PR #350 opened during reconciliation                                                                            | low, supply-chain pin                               | applied locally after Docker Hub digest verification                                  |
| AI Act Article 50 branch                   | earlier implementation already represented by upstream PR #343/main                                                   | low                                                 | superseded; brief retained                                                            |
| Launch-gap remediation                     | branch tree exactly represented by upstream PR #344/main                                                              | low                                                 | superseded; briefs retained                                                           |
| Build-state refresh                        | patch already present                                                                                                 | low                                                 | obsolete; branch retained                                                             |
| Field-crypto KMS async refactor            | substantial exact-head implementation at `415c9a13`; overlaps crypto, BYOK, AI-kit, migrations, state, and tests      | critical, cryptography/secrets/data compatibility   | deferred from main; fresh exact-head tests and three-lane review are the resumed lane |
| Motion dependency migration, PR #348       | removes `framer-motion` while `living-chain.tsx` still imports it; no changeset                                       | medium, frontend build/runtime                      | incomplete and CI-red; deferred                                                       |
| Broad dependency batch, PR #351            | ten-file dependency/lock/workflow/image batch opened after cutoff; several required checks and Renovate artifacts red | high, broad moving baseline                         | incomplete; deferred                                                                  |

## Local-main integration

| Commit     | Change                                                                        |
| ---------- | ----------------------------------------------------------------------------- |
| `31b6d213` | merge the complete writing branch history                                     |
| `c98afa0b` | ground the Article 50 transition in adopted text and official Council sources |
| `6602d501` | merge OSCAL spine/catalog work and reconcile the two state-document conflicts |
| `376b1aca` | record the blocked Ask AI production-proof evidence                           |
| `58c2dc3a` | update all 16 checkout action pins to the verified v7 digest                  |
| `715f4df`  | update the support-bot Python slim image to the verified current digest       |

The OSCAL merge conflicts were limited to `docs/build-state.md` and
`docs/state/production-readiness.md`. Resolution retained the newer main-side ADR and launch
history while accepting the branch's factual 36-product/68-price, 81-workspace, 49-changeset, and
OSCAL-integration state. No behavioral conflict required an operator choice.

## Open PR cutoff

| PR                          | State at cutoff                                       | Local disposition                                                   |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| #345 writing                | draft; remote head behind the local branch            | represented on local main; remote untouched                         |
| #346 OSCAL                  | draft; GitHub reports conflicting against remote main | represented on local main with conflicts resolved; remote untouched |
| #347 Ask AI proof           | draft; docs-only checks skipped by path filters       | represented on local main; remote untouched                         |
| #348 motion migration       | ready; `check`, standards, and site E2E red           | deferred as incomplete                                              |
| #349 checkout digest        | ready; all checks green                               | represented on local main                                           |
| #350 Python image digest    | ready; all checks green                               | represented on local main                                           |
| #351 non-major dependencies | ready; multiple required/advisory checks red          | deferred as an unvalidated broad batch                              |

Closing, updating, or merging these PRs is a remote mutation and was not authorized.

## Verification receipts

- Article 50 / writing focused suite: 76 passed, 0 failed.
- Full repository gate after writing plus OSCAL: 224/224 tasks passed.
- Site tests within that run: 904 passed, 0 failed.
- Standards gate within that run: 76 packages checked, 5 scaffold skips, all conforming.
- Checkout pin validation: all 32 workflow references use
  `3d3c42e5aac5ba805825da76410c181273ba90b1`; 55 SOT-check tests passed.
- Ask AI evidence: all four JSON artifacts parsed and formatting passed.
- Changesets: 49 files resolving to 58 patch, 12 minor, 2 major, and 1 no-release entry.
- Security gate: `rc=0`; Semgrep ran 117 rules on 4,018 tracked targets with zero findings,
  Ruff, Trivy, OSV, TruffleHog, and Docker digest pinning all passed.
- Final formatting, security, source-of-truth, and post-ledger repository replay are recorded in
  the reconciliation commit and terminal wrap. Branch hygiene remains intentionally advisory-red
  while the recovery refs and operator-owned worktrees are retained.

## Cleanup decision

No branch, recovery ref, read-only PR ref, worktree, brief, or review pack was removed. Every
worktree sits outside the session-owned `.worktrees/` area and is therefore treated as
operator-owned. Keeping them is the only fully reversible cleanup posture until remote PR
disposition and KMS admission are decided.

## Prioritized backlog

1. **P0 — field-crypto KMS async refactor:** test exact head `415c9a13`, complete code/security/
   adversarial reviews, address verified findings, then reconcile it onto current local main.
2. **P1 — PR #348 motion migration:** restore all imports to the new package, add the required
   changeset, and run site/build/E2E gates before admission.
3. **P1 — PR #351 dependency batch:** split or repair the broad red update; do not combine it with
   KMS or release work.
4. **P1 — release and fleet proof:** after KMS, rerun the consolidated train and one-SHA fleet
   plan. Deployment, migration, credential rotation, catalog mutation, and provider work remain
   operator/external-system gates.
5. **P2 — remote reconciliation:** close or supersede represented drafts #345-#347 and green
   Renovate PRs #349-#350 only after explicit authorization.
6. **P2 — launch evidence:** four technical receipts, Ring 3, provider-console checks, auditor
   acceptance, Paddle production, and first-sale business gates.

Trigger-parked items remain parked according to `docs/state/outstanding-work.md`; they are not
silently promoted by this reconciliation.
