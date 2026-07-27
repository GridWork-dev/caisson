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

## Resumed implementation

The P0 field-crypto KMS work resumed in its existing isolated worktree at exact head
`415c9a137febfeca858aba59952990fa4d33ef04`; no tracked KMS file changed during reconciliation.

- Its full repository gate passed 221/221 tasks; the site suite passed 849/849 tests and the
  standards gate checked 75 packages with 5 scaffold skips.
- Exact-head review packs were prepared for the core implementation, consumers, and locked intent.
- Fresh governed code-review, security-audit, and adversarial-review dispatches were attempted.
  Current Codex headroom fell to 10%, their automatic OpenRouter spill returned empty output, and
  therefore none produced a valid verdict.
- A bounded main-thread review traced the final request budget, transaction seam, plaintext
  ownership, and AWS/GCP/Azure deletion semantics against official provider documentation. This
  supplied continuity but was not treated as the independent review gate.

The branch remains recoverably deferred rather than silently admitted. Its next unblocked action is
to obtain fresh exact-head independent verdicts when review capacity is available, address any
verified finding, and then reconcile only the validated code onto current local main.

## Cleanup decision

No branch, recovery ref, read-only PR ref, worktree, brief, or review pack was removed. Every
worktree sits outside the session-owned `.worktrees/` area and is therefore treated as
operator-owned. Keeping them is the only fully reversible cleanup posture until remote PR
disposition and KMS admission are decided.

## Prioritized backlog

1. **P0 — field-crypto KMS async refactor:** exact-head tests are green; obtain valid code/security/
   adversarial verdicts, address verified findings, then reconcile it onto current local main.
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

## Close-out (appended 2026-07-27, same day)

The reconciliation is complete and pushed. Local `main` and `origin/main` are identical at
`13e814da`.

### Backlog dispositions

| Item                          | Disposition                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0 — field-crypto KMS async   | **Merged** `13e814da` (#353) after four review rounds. See below.                                                                                                        |
| P1 — PR #348 motion migration | **Closed** without admission. The framer-motion to motion swap was not repaired in this cycle; re-propose it as its own change when wanted.                              |
| P1 — PR #351 dependency batch | Repaired as **#352** (`a00a9eff`) and merged. #351 stays **open by design**: the better-auth, `@opentelemetry/*`, storybook, and playwright bumps were reverted to mains |

## Close-out (appended 2026-07-27, same day)

The reconciliation is complete and pushed. Local `main` and `origin/main` are identical at
`13e814da`.

### Backlog dispositions

| Item                          | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 — field-crypto KMS async   | **Merged** `13e814da` (#353) after four review rounds. See below.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| P1 — PR #348 motion migration | **Closed** without admission. The framer-motion to motion swap was not repaired in this cycle; re-propose it as its own change when wanted.                                                                                                                                                                                                                                                                                                                                                   |
| P1 — PR #351 dependency batch | Repaired as **#352** (`a00a9eff`) and merged. #351 stays **open by design**: the better-auth, `@opentelemetry/*`, storybook, and playwright bumps were reverted to main's versions rather than exempted from the release-age gate — audited against osv-scanner, trivy, and upstream GHSA search, none fix a known advisory — so Renovate re-proposes them through #351 once they clear the 7-day window naturally. kysely 0.29.4 and vite 8.1.5 had already aged past the window and landed. |
| P1 — release and fleet proof  | Now the front of the queue (T4, then T7). Unchanged in substance: deploy, migration, credential rotation, catalog mutation, and provider work remain operator/external-system gates.                                                                                                                                                                                                                                                                                                          |
| P2 — remote reconciliation    | Done. #345 and #346 merged; #347, #348, #349, #350 closed.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| P2 — launch evidence          | Unchanged and still open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### The KMS admission, and why it took four rounds

Worth recording because the shape repeated. The ADR-0389 design was correct at every round and never
changed, and the no-remigration invariant held throughout. What kept failing was the **remediation**:

1. **Round 1** found the record diverging from the code, and produced ADR-0392.
2. **Round 2** found two P1s _in round 1's fixes_: `PendingReplicaDeletion` folded onto the
   `pending-deletion` receipt state, minting a permanently-wrong row in the append-only WORM chain;
   and an abort listener installed after the operation invocation, losing a synchronous abort and
   resolving with a live plaintext DEK.
3. **Round 3** found that round 2's abort fix orphaned a promise rejection — process-fatal under
   Node's default policy, reachable from the GCP driver's non-async arrow — and that the RLS
   preflight was still capable of a false green, because `SET LOCAL` outside a transaction block
   emits a WARNING and takes no effect.
4. **Round 4** found that round 3's fix reported provider failures in place of cancellations,
   because it disposed of the abort rejection on _every_ synchronous throw rather than only the
   duplicate-reason path.

Each round's finding was in the previous round's _new_ code, never in the original design. The
standing lesson for `packages/field-crypto/src/kms-budget.ts`: its settlement race has produced a
defect on every edit so far, and every ordering (sync throw, sync abort, abort-then-throw, late
resolve, late reject, double-settle) needs an explicit regression test before an edit lands.

Both remaining lower-severity items were recorded rather than fixed: the `deriveKey` raw-DEK
exposure is an **open operator fork** on the board, because eliminating it is a breaking change to a
published seam; and ADR-0392 §5 narrows the zeroization guarantee to _no context-owned plaintext
survives the request_, which is what the code actually delivers.

### Gate state at close-out

- `bun run check` — 224/224 tasks. The suite is load-sensitive: `@caisson/ai-kit` intermittently
  trips PGlite hook/test timeouts under full parallel build load and passes isolated or at
  `--concurrency=1`. Confirm a red run that way before believing it.
- `bun run sot` — all content gates GREEN. `branch-hygiene` stays advisory-red on purpose: recovery
  refs and six operator-owned wave worktrees are preserved, not destructively cleaned.
- `gate`, `format:check`, and `security --layer ci` green; PR #353 CI fully green before merge.

### Known drift left deliberately unfixed

`docs/ops/launch-runbook.md` states Compliance at `$1,449` in five places while its own post-deploy
probe requires `$1,649`. The committed prices are `164900` and `225900` in
`packages/{compliance,everything}/manifest.ts` per ADR-0386, and **the buyer-facing surface carries
no stale number** — this is internal operator-procedure drift only. Left for its own change rather
than folded into a crypto branch.

## Board-clear addendum (appended 2026-07-27, same day)

Three statements in the close-out above are no longer true. They are corrected here rather than
edited in place, so the record of what was believed at close-out survives.

### The load-sensitivity was a defect, not a property

Close-out recorded `@caisson/ai-kit` as intermittently tripping PGlite hook/test timeouts under full
parallel build load, and instructed confirming a red run at `--concurrency=1` before believing it.
That guidance is retired. The cause was found and fixed in #356 (`db4c693a`).

Bun's default test timeout is 5000ms, which is under 5x the idle cost of real work in this repo, so
CPU contention alone decided pass or fail. Measured:

- `newTestPg()` boots a Postgres-in-WASM at **0.8-1.6s idle**, and the cost **grows within a
  process** when instances are held rather than closed (10 held: 718 -> 1592ms; 10 closed: flat
  ~800ms). It sits inside `beforeEach` in seven `ai-kit` files.
- `@caisson/ui`'s design-manifest generator takes **~4.0s for one pass**; the determinism test runs
  two, and failed at 5540ms with its sibling passing at 4040ms. Structurally over budget, not
  marginal.
- `proof-panel.test.tsx`'s `settle()` flushed a fixed 3 passes with no predicate, measured at
  exactly one pass of headroom — 2 suffice idle, 1 fails.

The bound had to go on all 74 `bun test` scripts, not into one config: setting `timeout` in the root
`bunfig.toml` and re-running a deliberately-slow 7s hook reproduced the failure again, because bun
does not read bunfig from a package's working directory. `BUN_TEST_TIMEOUT` does not exist. Both
were tested rather than assumed.

Verified at `bun run check --force` with no turbo cache: **224/224 successful, 75 suites actually
run, zero timeouts.**

### The known drift is fixed

`docs/ops/launch-runbook.md` no longer states Compliance at `$1,449`. #355 (`03198633`) trued nine
stale claims — the price in five places plus the catalog counts (26 modules / 35 products / 66
prices) that predated the oscal-spine wave — against `tools/paddle-catalog-recreate.ts`'s
`selfCheck()`, which asserts 6 bundles / 27 modules / 36 products / 68 prices and cites this runbook
as what it pins to. The tool and the runbook it named had drifted apart. Severity stated honestly:
this could not have produced a wrong catalog, because the recreate tool fails closed on marker
mismatch — it could have wasted a deploy window and produced a false-failed probe.

### The worktrees are gone; the recovery refs are not

`branch-hygiene` no longer reports six operator-owned wave worktrees. All six were removed after
each was checked for unlanded work, along with seven branches whose PRs had merged or closed. One
worktree (`caisson-writing`) held five modified tracked files; every one was **older** than `main`,
not newer — its glossary still described Azure Key Vault as having no shipped driver. Dispatch
briefs were archived before removal.

Five reconcile-snapshot recovery refs are kept deliberately and are now the only thing branch-hygiene
reports, which makes it a signal again rather than permanent noise.

### Board state

The PR board is empty. #354, #355, and #356 merged; #351 was closed as a `minimumReleaseAge`
artifact rather than a defect — every job failed because `renovate/artifacts` could not update the
lockfile inside the 7-day window, #352 had already reverted that batch deliberately, and none of its
bumps fix a known advisory. Renovate re-proposes once the versions age naturally.

T4 (six legs on one SHA, migration 0030) is now the only thing between here and T7.
